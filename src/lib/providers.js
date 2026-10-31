const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { StringDecoder } = require('node:string_decoder');
const core = require('./core');

function executable(name, custom = '') {
  if (custom) {
    if (!path.isAbsolute(custom)) throw new Error('Executable path must be absolute.');
    fs.accessSync(custom, process.platform === 'win32' ? fs.constants.F_OK : fs.constants.X_OK);
    return custom;
  }
  const home = os.homedir();
  const directories = [...(process.env.PATH || '').split(path.delimiter), '/opt/homebrew/bin', '/usr/local/bin', path.join(home, '.local/bin'), path.join(home, '.npm-global/bin'), path.join(home, '.volta/bin'), path.join(process.env.APPDATA || path.join(home, 'AppData/Roaming'), 'npm'), path.join(home, 'scoop/shims')];
  for (const directory of directories.filter(Boolean)) for (const suffix of process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : ['']) {
    const file = path.join(directory, name + suffix);
    try { fs.accessSync(file, process.platform === 'win32' ? fs.constants.F_OK : fs.constants.X_OK); return file; } catch { /* next candidate */ }
  }
  return null;
}
function spawnCLI(file, args, options = {}) {
  if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(file)) {
    // Windows batch shims require cmd.exe. Prompt content only travels over stdin.
    const quote = value => { if (/["&|<>^%!\r\n]/.test(value)) throw new Error('Unsafe character in Windows executable or argument. Use an .exe path.'); return `"${value}"`; };
    return spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `"${[file, ...args].map(quote).join(' ')}"`], { ...options, windowsVerbatimArguments: true, shell: false, windowsHide: true });
  }
  return spawn(file, args, { ...options, shell: false, windowsHide: true });
}
function runFile(file, args, { cwd = os.homedir(), env = providerEnvironment({kind:'claude'}), timeout = 10000, input = '', maxOutput = 4 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    let stdout = '', stderr = '', done = false;
    const child = spawnCLI(file, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    const timer = setTimeout(() => { child.kill(); finish(new Error('Command timed out.')); }, timeout);
    const finish = (error, code) => { if (done) return; done = true; clearTimeout(timer); if (error) reject(error); else resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() }); };
    child.stdout.on('data', c => { stdout += c; if (stdout.length > maxOutput) { child.kill(); finish(new Error('Command output limit exceeded.')); } });
    child.stderr.on('data', c => { stderr = (stderr + c).slice(-32000); });
    child.on('error', e => finish(e)); child.on('close', code => finish(null, code));
    child.stdin.on('error', () => {}); child.stdin.end(input);
  });
}
function configuration(provider) {
  const filename = provider.kind === 'codex' ? 'config.toml' : 'settings.json';
  const inherited = process.env[provider.kind === 'codex' ? 'CODEX_HOME' : 'CLAUDE_CONFIG_DIR'];
  const directory = provider.configDir || inherited || path.join(os.homedir(), `.${provider.kind}`);
  const file = provider.configFile || path.join(directory, filename);
  if (!path.isAbsolute(file)) throw new Error('Configuration file path must be absolute.');
  if (provider.configFile && (!fs.existsSync(file) || !fs.statSync(file).isFile())) throw new Error('The selected CLI configuration file does not exist.');
  if (provider.kind === 'codex' && path.basename(file) !== 'config.toml') throw new Error('Select a file named config.toml. Codex loads it from its configuration directory.');
  if (provider.kind === 'claude' && fs.existsSync(file)) {
    const settings = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('Claude settings must be a JSON object.');
  }
  return { file, directory: provider.kind === 'codex' ? path.dirname(file) : directory, exists: fs.existsSync(file) };
}
function providerEnvironment(provider) {
  const env = { ...process.env };
  // App API credentials and the backup passphrase belong only to the main process.
  for (const key of Object.keys(env)) if (key.startsWith('KAIRO_')) delete env[key];
  for (const key of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_API_KEY', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) delete env[key];
  if (provider.configDir) {
    if (!path.isAbsolute(provider.configDir)) throw new Error('Configuration directory must be absolute.');
    env[provider.kind === 'codex' ? 'CODEX_HOME' : 'CLAUDE_CONFIG_DIR'] = provider.configDir;
  }
  if (provider.kind === 'codex' && provider.configFile) env.CODEX_HOME = configuration(provider).directory;
  return env;
}
async function health(provider, getKey = () => '') {
  core.validateEntity('providers', provider);
  if (['claude', 'codex'].includes(provider.kind)) {
    const file = executable(provider.kind, provider.executable);
    const config = configuration(provider);
    const status = { id: provider.id, executable: file, configPath: config.file, configExists: config.exists, healthy: false, authentication: 'unknown', version: '', checkedAt: Date.now() };
    if (!file) return { ...status, error: 'CLI not found. Set a custom executable path or install the CLI.' };
    const env = providerEnvironment(provider);
    const version = await runFile(file, ['--version'], { env }); status.version = version.stdout || version.stderr; status.healthy = version.code === 0;
    try {
      const result = await runFile(file, provider.kind === 'codex' ? ['login', 'status'] : ['auth', 'status', '--json'], { env });
      if (provider.kind === 'claude') { const data = JSON.parse(result.stdout); status.authentication = data.loggedIn === true ? 'authenticated' : data.loggedIn === false ? 'signed out' : 'unknown'; }
      else status.authentication = result.code === 0 ? 'authenticated' : 'signed out';
    } catch { status.authentication = 'unknown'; }
    if (provider.kind === 'codex' && config.exists && status.authentication !== 'authenticated') {
      const text = fs.readFileSync(config.file, 'utf8');
      const selected = text.match(/^\s*model_provider\s*=\s*["']([^"']+)["']/m)?.[1];
      const section = text.split(/(?=^\s*\[)/m).find(s => s.startsWith(`[model_providers.${selected}]`));
      if (selected && selected !== 'openai' && section) {
        if (/^\s*experimental_bearer_token\s*=\s*["'][^"']+["']/m.test(section)) status.authentication = 'configured in config.toml';
        else {
          const envKey = section.match(/^\s*env_key\s*=\s*["']([^"']+)["']/m)?.[1];
          if (envKey && env[envKey]) status.authentication = 'configured by CLI environment';
        }
      }
    }
    return status;
  }
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const base = provider.endpoint.replace(/\/$/, '');
    const response = await fetch(base + '/api/tags', { signal: controller.signal, redirect: 'error' });
    if (!response.ok) throw new Error(`Connection test failed: HTTP ${response.status}`);
    const data = await response.json();
    return { id: provider.id, healthy: true, authentication: 'local Ollama', models: (data.models || []).map(m => m.name), checkedAt: Date.now() };
  } catch (error) { return { id: provider.id, healthy: false, authentication: 'unknown', error: error.message, checkedAt: Date.now() }; }
  finally { clearTimeout(timeout); }
}
function streamEvents(kind, emit) {
  let text = '', usage = {}, costUSD = 0, terminalError = '', hadDeltas = false;
  const consume = event => {
    if (kind === 'claude') {
      const delta = event.event?.delta;
      if (event.type === 'stream_event' && delta?.type === 'text_delta') { text += delta.text; hadDeltas = true; emit(delta.text); }
      if (event.type === 'assistant' && !hadDeltas) { const value = (event.message?.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n'); if (value) { text += value; emit(value); } }
      if (event.type === 'result') {
        if (!text && event.result) { text = event.result; emit(text); }
        usage = event.usage || {}; costUSD = event.total_cost_usd || 0;
        if (event.is_error) terminalError = (event.errors || [event.result || 'Claude reported an error.']).join('\n');
      }
    } else {
      if (event.type === 'item.completed' && event.item?.type === 'agent_message') { const value = event.item.text || ''; text += (text ? '\n\n' : '') + value; emit((text === value ? '' : '\n\n') + value); }
      if (event.type === 'turn.completed') usage = event.usage || {};
      if (event.type === 'error' || event.type === 'turn.failed') terminalError = event.message || event.error?.message || 'Codex reported an error.';
    }
  };
  return { consume, result: () => ({ content: text, usage, costUSD, terminalError }) };
}
async function runProvider(provider, { prompt, messages = [], images = [], cwd = os.homedir(), temporary = false, settings = core.defaults, mcpConfig, capability = 'chat', safeMode = false, onChunk = () => {}, onEvent = () => {}, onPermission = async () => false, signal, getKey = () => '' }) {
  core.validateEntity('providers', provider);
  if (safeMode && provider.kind !== 'claude') throw new Error('Safe-mode diagnostics are available for Claude only.');
  if (provider.kind === 'ollama') return runHTTP(provider, { prompt, messages, images, settings, onChunk, signal });
  const config = configuration(provider);
  const file = executable(provider.kind, provider.executable); if (!file) throw new Error(`${provider.name} CLI not found.`);
  const args = provider.kind === 'claude' ? ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--permission-mode', 'dontAsk', '--tools', '', '--strict-mcp-config'] : ['exec', '--skip-git-repo-check', '--sandbox', 'read-only', '--json', '--color', 'never'];
  if (safeMode) args.push('--safe-mode');
  if (capability === 'research') {
    if (provider.kind === 'claude') { args[args.indexOf('--tools') + 1] = 'WebSearch,WebFetch'; args.push('--allowedTools', 'WebSearch,WebFetch'); }
    else args.push('-c', 'web_search="live"');
  }
  if (capability === 'agent') {
    if (provider.kind === 'claude') { args[args.indexOf('--tools') + 1] = 'Read,Glob,Grep,Bash,Edit,Write'; args[args.indexOf('--permission-mode') + 1] = 'manual'; args.push('--input-format','stream-json','--permission-prompts','host'); }
    else {
      if (!await onPermission({ tool: 'Codex workspace access', input: { folder: cwd, access: 'Read and edit files in this project' } })) throw new Error('Workspace permission denied.');
      args[args.indexOf('--sandbox') + 1] = 'workspace-write';
    }
  }
  if (provider.model) args.push(provider.kind === 'codex' ? '-m' : '--model', provider.model);
  if (provider.kind === 'claude' && config.exists) args.push('--settings', config.file);
  if (temporary || settings.privacyMode) args.push(provider.kind === 'claude' ? '--no-session-persistence' : '--ephemeral');
  if (mcpConfig && provider.kind === 'claude') args.push('--mcp-config', mcpConfig);
  if (images.length && provider.kind === 'codex') for (const img of images) args.push('-i', img.path);
  if (images.length && provider.kind === 'claude' && capability !== 'agent') args.push('--input-format', 'stream-json');
  args.push(...(provider.args || [])); if (provider.kind === 'codex') args.push('-');
  return new Promise((resolve, reject) => {
    let settled = false, pending = '', stderr = '', initialized = false, responseStarted = false, exitTimer;
    const decoder = new StringDecoder('utf8');
    const parser = streamEvents(provider.kind, chunk => { responseStarted = true; onChunk(chunk); });
    const child = spawnCLI(file, args, { cwd, env: providerEnvironment(provider), stdio: ['pipe', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    const kill = () => { try { if (process.platform !== 'win32') process.kill(-child.pid, 'SIGTERM'); else { const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); killer.on('error', () => child.kill()); } } catch { child.kill(); } };
    const abort = () => { kill(); finish(new Error('Generation stopped.')); };
    const timer = setTimeout(() => { kill(); finish(Object.assign(new Error('Provider request timed out.'), { code: 'KAIRO_CLI_TIMEOUT', phase: responseStarted ? 'response' : initialized ? 'request' : 'startup' })); }, settings.cliTimeoutSeconds * 1000);
    const finish = (error) => {
      if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
      if (error) reject(error); else {
        const result = parser.result();
        // A terminal protocol event completes the request even if session hooks delay process exit.
        child.stdin.end(); exitTimer = setTimeout(kill, 1000); exitTimer.unref();
        if (result.terminalError) reject(Object.assign(new Error(result.terminalError), {code:'KAIRO_CLI_RESPONSE_ERROR'})); else resolve({ ...result, content: result.content || '(Empty response)', stderr });
      }
    };
    const line = value => { if (settled || !value.trim()) return; try {
      const event = JSON.parse(value);
      if (event.type === 'system' && event.subtype === 'init' || event.type === 'thread.started') initialized = true;
      if (event.type === 'control_request' && event.request?.subtype === 'can_use_tool') {
        Promise.resolve(onPermission({ tool: event.request.tool_name, input: event.request.input })).then(allow => {
          if (!settled) child.stdin.write(JSON.stringify({ type: 'control_response', response: { subtype: 'success', request_id: event.request_id, response: allow ? { behavior: 'allow', updatedInput: event.request.input } : { behavior: 'deny', message: 'Permission denied by the user.' } } }) + '\n');
        }).catch(() => { if (!settled) child.stdin.write(JSON.stringify({ type: 'control_response', response: { subtype: 'success', request_id: event.request_id, response: { behavior: 'deny', message: 'Permission unavailable.' } } }) + '\n'); });
        onEvent('permission-request'); return;
      }
      parser.consume(event); onEvent(event.item?.type || event.type);
      if (provider.kind === 'claude' && event.type === 'result' || provider.kind === 'codex' && ['turn.completed','turn.failed'].includes(event.type)) finish();
    } catch { stderr = (stderr + '\nUnrecognized CLI output.').slice(-16000); } };
    child.stdout.on('data', chunk => { pending += decoder.write(chunk); const lines = pending.split('\n'); pending = lines.pop(); for (const value of lines) line(value); if (pending.length > 8 * 1024 * 1024) { kill(); finish(new Error('CLI event exceeds output limit.')); } });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-16000); });
    child.on('error', e => finish(e));
    child.on('close', code => { pending += decoder.end(); line(pending); if (!settled) finish(code === 0 ? null : Object.assign(new Error(stderr.trim() || `${provider.name} exited with code ${code}.`), {code:'KAIRO_CLI_EXIT'})); clearTimeout(exitTimer); });
    child.stdin.on('error', () => {});
    const input = (images.length || capability === 'agent') && provider.kind === 'claude' ? JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: prompt }, ...images.map(img => ({ type: 'image', source: { type: 'base64', media_type: img.dataURL.split(';')[0].slice(5), data: img.dataURL.split(',')[1] } }))] } }) + '\n' : prompt;
    if (provider.kind === 'claude' && capability === 'agent') child.stdin.write(input); else child.stdin.end(input);
    if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
  });
}
async function runHTTP(provider, { prompt, images, settings, onChunk, signal, getKey }) {
  core.validateEntity('providers', provider);
  if (provider.kind !== 'ollama') throw new Error('Use Claude settings.json or Codex config.toml for AI access.');
  if (!provider.model) throw new Error('Select a model in provider settings first.');
  const controller = new AbortController(); const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true }); if (signal?.aborted) controller.abort();
  const timeout = setTimeout(() => controller.abort(new Error('Provider request timed out.')), settings.apiTimeoutSeconds * 1000);
  try {
    const message = { role: 'user', content: prompt, ...(images.length ? { images: images.map(f => f.dataURL.split(',')[1]) } : {}) };
    const response = await fetch(provider.endpoint.replace(/\/$/, '') + '/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: provider.model, messages: [message], stream: true }), signal: controller.signal, redirect: 'error',
    });
    if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}${response.status === 401 ? ': check authentication.' : response.status === 429 ? ': rate limit reached.' : '.'}`);
    let content = '', usage = {}, pending = '', done = false;
    const decoder = new TextDecoder();
    const consume = line => {
      if (!line.trim()) return;
      const value = line;
      let event; try { event = JSON.parse(value); } catch { throw new Error('Provider returned malformed streaming JSON.'); }
      if (event.error) throw new Error(typeof event.error === 'string' ? event.error : event.error.message || 'Provider stream failed.');
      const delta = event.message?.content || '';
      content += delta; if (delta) onChunk(delta);
      if (event.done) { usage = { input_tokens: event.prompt_eval_count || 0, output_tokens: event.eval_count || 0 }; done = true; }
    };
    for await (const chunk of response.body) {
      pending += decoder.decode(chunk, { stream: true }); const lines = pending.split('\n'); pending = lines.pop(); lines.forEach(consume);
      if (content.length > 4 * 1024 * 1024 || pending.length > 8 * 1024 * 1024) throw new Error('Provider response exceeds output limit.');
    }
    pending += decoder.decode(); if (pending.trim()) consume(pending);
    if (!done) throw new Error('Provider stream ended before completion.');
    return { content: content || '(Empty response)', usage, costUSD: 0 };
  } catch (error) { if (signal?.aborted) throw new Error('Generation stopped.'); if (controller.signal.aborted) throw new Error('Provider request timed out.'); throw error; }
  finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}
module.exports = { executable, spawnCLI, runFile, health, streamEvents, runProvider, runHTTP, providerEnvironment, configuration };
