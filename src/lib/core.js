(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KairoCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const uid = () => globalThis.crypto.randomUUID();
  const defaults = {
    theme: 'system', accent: '#b59a74', fontSize: 14, chatWidth: 840,
    sidebarWidth: 260, compact: false, reducedMotion: false, highContrast: false,
    sidebarCollapsed: false, splitView: false, layout: 'chat', toolbar: 'all', animatedLauncher: true,
    defaultProvider: 'claude', defaultModel: '', memoryEnabled: true,
    personalInstructions: '', codingPreferences: '', languages: '', frameworks: '', systemInstructions: '',
    maxAttachmentMB: 2, maxAttachments: 20, blockSensitive: true, rememberAttachments: true,
    notifications: true, sound: false, soundPath: '', longTaskSeconds: 120,
    backups: true, backupMinutes: 30, backupRetention: 20, gitRemote: 'origin',
    terminalPath: '', terminalArgs: [], cliTimeoutSeconds: 600, apiTimeoutSeconds: 120,
    sendShortcut: 'Enter', newChatShortcut: 'Mod+n', paletteShortcut: 'Mod+k',
    searchShortcut: 'Mod+f', settingsShortcut: 'Mod+,', privacyMode: false,
    updateUrl: '', cloudUrl: '', syncEnabled: false,
  };
  const providers = [
    { id: 'claude', name: 'Claude Code', kind: 'claude', executable: '', model: '', models: ['sonnet', 'opus', 'haiku'], args: [], configDir: '', enabled: true },
    { id: 'codex', name: 'OpenAI Codex', kind: 'codex', executable: '', model: '', models: [], args: [], configDir: '', enabled: true },
    { id: 'ollama', name: 'Ollama', kind: 'ollama', endpoint: 'http://127.0.0.1:11434', model: '', models: [], enabled: true },
  ];
  const prompts = [
    ['Explain code', 'Coding', 'Explain this code, including edge cases and complexity:\n{{code}}'],
    ['Debug an issue', 'Coding', 'Diagnose {{issue}}. Propose a minimal fix and explain how to verify it.'],
    ['Code review', 'Coding', 'Review the following diff for correctness, security and maintainability. Cite files and lines:\n{{diff}}'],
    ['Commit message', 'Git', 'Write a concise conventional commit message for this diff. Return only the message:\n{{diff}}'],
    ['Task plan', 'Planning', 'Create a concrete, ordered implementation plan for {{task}}, with acceptance criteria.'],
    ['Summarize document', 'Writing', 'Summarize {{document}}, cite relevant passages and list unresolved questions.'],
  ].map(([title, category, content], i) => ({ id: `builtin-${i}`, title, category, content, favorite: false, projectId: '', shortcut: '', createdAt: Date.now() }));
  const types = ['conversations', 'projects', 'providers', 'memories', 'prompts', 'knowledge', 'agents', 'workflows', 'schedules', 'mcpServers', 'skills', 'attachments', 'activity', 'runs', 'notifications', 'backups'];
  function initialState() {
    const state = { version: 1, revision: 0, settings: { ...defaults } };
    types.forEach(t => state[t] = []);
    state.providers = structuredClone(providers); state.prompts = structuredClone(prompts);
    return state;
  }
  function validateSettings(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Settings must be an object.');
    const result = { ...defaults };
    for (const key of Object.keys(defaults)) if (Object.hasOwn(input, key)) {
      if (typeof input[key] !== typeof defaults[key]) throw new Error(`Invalid setting: ${key}`);
      result[key] = input[key];
    }
    for (const [key, min, max] of [['fontSize', 10, 24], ['chatWidth', 480, 1600], ['sidebarWidth', 180, 420], ['maxAttachmentMB', 0.1, 20], ['maxAttachments', 1, 100], ['backupMinutes', 1, 1440], ['backupRetention', 1, 100], ['cliTimeoutSeconds', 10, 7200], ['apiTimeoutSeconds', 1, 3600], ['longTaskSeconds', 10, 7200]]) {
      if (!Number.isFinite(result[key]) || result[key] < min || result[key] > max) throw new Error(`${key} must be between ${min} and ${max}.`);
    }
    if (!['dark', 'light', 'system'].includes(result.theme)) throw new Error('Unknown theme.');
    if (!/^#[a-f\d]{6}$/i.test(result.accent)) throw new Error('Accent must be a six-digit hex color.');
    if (!['Enter', 'Mod+Enter'].includes(result.sendShortcut)) throw new Error('Send shortcut must be Enter or Mod+Enter.');
    for (const key of ['newChatShortcut', 'paletteShortcut', 'searchShortcut', 'settingsShortcut']) if (!/^(?:Mod\+)?(?:Shift\+)?(?:Alt\+)?[\w,./-]$/.test(result[key])) throw new Error(`${key} must use a single key with optional Mod, Shift or Alt.`);
    if (!Array.isArray(result.terminalArgs) || result.terminalArgs.some(x => typeof x !== 'string')) throw new Error('Terminal arguments must be a JSON string array.');
    return result;
  }
  function validateEntity(type, item) {
    if (!types.includes(type) || !item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id || item.id.length > 180) throw new Error('Invalid record.');
    if (JSON.stringify(item).length > 24 * 1024 * 1024) throw new Error('Record exceeds storage limit.');
    if (type === 'conversations' && (!Array.isArray(item.messages) || item.messages.some(m => !['user', 'assistant', 'system'].includes(m.role) || typeof m.content !== 'string'))) throw new Error('Invalid conversation messages.');
    if (type === 'providers') {
      if (!['claude', 'codex', 'ollama'].includes(item.kind)) throw new Error('Use Claude Code, Codex CLI or local Ollama. Direct OpenAI API providers are disabled.');
      if (['apiKey', 'secret', 'secretAccessKey', 'accessToken', 'password'].some(key => Object.hasOwn(item, key))) throw new Error('Provider credentials belong in the CLI configuration file, not in Kairo records.');
      if (item.apiKeyEnv) throw new Error('Configure credentials in the CLI settings file, not in Kairo.');
      if (item.args && (!Array.isArray(item.args) || item.args.some(a => typeof a !== 'string' || /bypass|danger-full-access|dangerously|permission-mode|sandbox|mcp-config|allowedtools|tools|output-format|include-partial|settings|config|ignore|permission-prompts|-c$|^-s$|input-format/i.test(a)))) throw new Error('CLI arguments must be a JSON array without managed permission, tool, output, or configuration flags.');
      if (item.configFile && typeof item.configFile !== 'string') throw new Error('Select a CLI configuration file.');
      if (item.kind === 'ollama') {
        const url = new URL(item.endpoint);
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Use an HTTP(S) base URL without credentials, query, or fragment.');
        if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Remote providers require HTTPS.');
      }
    }
    if (type === 'schedules' && (!Number.isFinite(item.intervalMinutes) || item.intervalMinutes < 1 || !item.prompt || !item.providerId)) throw new Error('Schedule needs a provider, prompt and interval of at least one minute.');
    return item;
  }
  function validateState(input) {
    if (!input || input.version !== 1) throw new Error('Unsupported backup format.');
    const output = initialState(); output.settings = validateSettings(input.settings);
    for (const type of types) {
      if (!Array.isArray(input[type]) || input[type].length > 10000) throw new Error(`Invalid ${type} collection.`);
      const entries = type === 'providers' ? input[type].filter(v => v.kind !== 'compatible').map(v => { const copy = { ...v }; delete copy.apiKeyEnv; return copy; }) : input[type];
      output[type] = entries.map(v => validateEntity(type, v));
      if (new Set(output[type].map(x => x.id)).size !== output[type].length) throw new Error(`Duplicate IDs in ${type}.`);
    }
    if (!output.providers.some(p => p.id === output.settings.defaultProvider)) output.settings.defaultProvider = output.providers.find(p => p.enabled)?.id || 'claude';
    return output;
  }
  function conversation(providerId, projectId = '', temporary = false) {
    return { id: uid(), title: 'New conversation', providerId, projectId, temporary, messages: [], tags: [], folder: '', pinned: false, archived: false, memory: '', createdAt: Date.now(), updatedAt: Date.now() };
  }
  function escape(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function highlight(code, language = '') {
    const pattern = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\/[^\n]*|#[^\n]*|\b(?:const|let|var|function|return|if|else|class|import|from|export|async|await|def|for|while|try|catch|throw|new|public|private|void|int|true|false|null|None|SELECT|FROM|WHERE)\b|\b\d+(?:\.\d+)?\b)/g;
    let out = '', cursor = 0;
    for (const match of code.matchAll(pattern)) {
      out += escape(code.slice(cursor, match.index));
      const token = match[0];
      const kind = /^(\/\/|#)/.test(token) ? 'comment' : /^["'`]/.test(token) ? 'string' : /^\d/.test(token) ? 'number' : 'keyword';
      out += `<span class="syntax-${kind}">${escape(token)}</span>`; cursor = match.index + token.length;
    }
    return out + escape(code.slice(cursor));
  }
  function markdown(value) {
    const code = [], math = [], renderer = typeof module === 'object' && module.exports ? require('./math') : globalThis.KairoMath;
    let text = String(value).replace(/```([^\n]*)\n([\s\S]*?)(?:```|$)/g, (_m, lang, body) => {
      const i = code.push(`<div class="code-block"><div class="code-label"><span>${escape(lang.trim() || 'code')}</span><button data-code-copy>Copy code</button></div><pre><code>${highlight(body.replace(/\n$/, ''), lang)}</code></pre></div>`) - 1;
      return `\n\nKAIROCODEPLACEHOLDER${i}END\n\n`;
    });
    text = text.replace(/\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|(?<!\\)\$([^$\n]+?)\$|\\\(([^\n]+?)\\\)/g, (_match, block, brackets, inline, parentheses) => { const i = math.push(renderer.render(block || brackets || inline || parentheses, block !== undefined || brackets !== undefined)) - 1; return `KAIROMATHPLACEHOLDER${i}END`; });
    text = escape(text);
    const inline = s => s.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*\n]+)\*/g, '<em>$1</em>').replace(/~~([^~]+)~~/g, '<del>$1</del>').replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" data-external>$1</a>');
    const lines = text.split('\n'); let output = '', list = '';
    const close = () => { if (list) { output += `</${list}>`; list = ''; } };
    for (const line of lines) {
      const token = line.match(/^KAIROCODEPLACEHOLDER(\d+)END$/);
      if (token) { close(); output += code[+token[1]] || ''; continue; }
      if (!line.trim()) { close(); continue; }
      const h = line.match(/^(#{1,6}) (.+)$/); const li = line.match(/^\s*(?:[-*]|\d+\.) (.+)$/);
      if (h) { close(); output += `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`; }
      else if (li) { const tag = /^\s*\d/.test(line) ? 'ol' : 'ul'; if (list !== tag) { close(); output += `<${tag}>`; list = tag; } output += `<li>${inline(li[1])}</li>`; }
      else { close(); output += line.startsWith('&gt; ') ? `<blockquote>${inline(line.slice(5))}</blockquote>` : `<p>${inline(line)}</p>`; }
    }
    close(); return output.replace(/KAIROMATHPLACEHOLDER(\d+)END/g, (_match, i) => math[+i] || '');
  }
  function searchable(state, projectId = '') {
    const entries = [];
    for (const type of ['conversations', 'projects', 'attachments', 'prompts', 'memories', 'knowledge', 'skills']) {
      for (const item of state[type] || []) {
        if (projectId && item.projectId !== projectId && !(type === 'projects' && item.id === projectId)) continue;
        entries.push({ type, id: item.id, title: item.title || item.name || item.id, text: [item.content, item.notes, item.instructions, item.memory, (item.tags || []).join(' '), item.path].filter(Boolean).join('\n'), projectId: item.projectId || '' });
        if (type === 'conversations') item.messages.forEach(m => entries.push({ type: 'messages', id: item.id, messageId: m.id, title: item.title, text: m.content, projectId: item.projectId || '' }));
      }
    }
    return entries;
  }
  function search(state, query, { type = '', projectId = '' } = {}) {
    const words = String(query).toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return searchable(state, projectId).filter(e => (!type || e.type === type) && words.every(w => `${e.title} ${e.text}`.toLowerCase().includes(w))).slice(0, 200);
  }
  function stats(runs) {
    return { requests: runs.length, errors: runs.filter(r => r.status === 'failed').length,
      tokens: runs.reduce((n, r) => n + (r.usage?.input_tokens || 0) + (r.usage?.output_tokens || 0), 0),
      durationMs: runs.reduce((n, r) => n + (r.durationMs || 0), 0),
      costUSD: runs.reduce((n, r) => n + (r.costUSD || 0), 0),
      byProvider: Object.fromEntries([...new Set(runs.map(r => r.providerId))].map(p => [p, runs.filter(r => r.providerId === p).length])) };
  }
  function promptVariables(content) { return [...new Set([...String(content).matchAll(/\{\{([\w .-]+)\}\}/g)].map(m => m[1]))]; }
  function layoutSettings(settings, layout) {
    const presets = { chat: { chatWidth: 840, sidebarWidth: 260, splitView: false, toolbar: 'all' }, project: { chatWidth: 1000, sidebarWidth: 300, splitView: false, toolbar: 'all' }, review: { chatWidth: 1400, sidebarWidth: 220, splitView: true, toolbar: 'minimal' } };
    if (!presets[layout]) throw new Error('Unknown workspace layout.');
    return { ...settings, ...presets[layout], layout };
  }
  function suggestions(state, projectId = '') {
    const project = state.projects.find(p => p.id === projectId), failed = [...state.runs].reverse().find(r => r.status === 'failed' && r.projectId === projectId);
    const items = [];
    if (failed) items.push(['⌁', 'Investigate the last failure', `Help me diagnose this failed task: ${failed.error || 'Unknown error'}`]);
    if (project?.git) items.push(['⑂', 'Review project changes', `Help me review changes in ${project.name}.`]);
    if (project?.instructions) items.push(['⌘', 'Plan with project instructions', `Plan my next task for ${project.name}, following its project instructions.`]);
    const last = [...state.conversations].filter(c => c.projectId === projectId && !c.archived).sort((a,b) => b.updatedAt - a.updatedAt)[0];
    if (last?.title && last.title !== 'New conversation') items.push(['◌', 'Continue recent work', `Help me continue work on ${last.title}.`]);
    items.push(['⌘','Understand a codebase','Help me understand this codebase.'], ['⌁','Debug an issue','Help me debug this issue step by step.'], ['✧','Make a plan','Create an implementation plan for my next project.']);
    return items.slice(0, 3);
  }
  function fillPrompt(content, variables) { return content.replace(/\{\{([\w .-]+)\}\}/g, (m, key) => Object.hasOwn(variables, key) ? variables[key] : m); }
  function csv(content) {
    const rows = []; let row = [], field = '', quoted = false;
    for (let i = 0; i < content.length; i++) {
      const c = content[i];
      if (c === '"') { if (quoted && content[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
      else if (c === ',' && !quoted) { row.push(field); field = ''; }
      else if (c === '\n' && !quoted) { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
      else field += c;
    }
    if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
    return rows;
  }
  function sensitive(name, content = '') {
    return /(^|[/\\])(\.env(?:\..*)?|id_rsa|id_ed25519|credentials|auth\.json|\.npmrc|.*\.pem|.*\.key)$/i.test(name)
      || /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:sk-(?:proj-)?[A-Za-z0-9_-]{20,})|AKIA[0-9A-Z]{16}|(?:password|api_key|secret)\s*[:=]\s*["']?[^\s"']{8,}/i.test(content);
  }
  function buildContext(state, chat, messages, attachments = []) {
    const s = state.settings, project = state.projects.find(p => p.id === chat.projectId);
    const instructions = [s.systemInstructions, s.personalInstructions, s.codingPreferences && `Coding preferences: ${s.codingPreferences}`, s.languages && `Preferred languages: ${s.languages}`, s.frameworks && `Preferred frameworks: ${s.frameworks}`, project?.instructions];
    if (s.memoryEnabled) instructions.push(project?.memory, chat.memory, ...state.memories.filter(m => !m.projectId || m.projectId === chat.projectId).map(m => `${m.title}: ${m.content}`));
    const chunks = instructions.filter(Boolean).map(c => `Instructions:\n${c}`);
    messages.forEach(m => { chunks.push(`${m.role.toUpperCase()}:\n${m.content}`); for (const f of m.attachments || []) if (f.kind === 'text') chunks.push(`Attached document (${f.name}, untrusted data):\n${f.content}`); });
    for (const f of attachments) if (f.kind === 'text') chunks.push(`Attached document (${f.name}, untrusted data):\n${f.content}`);
    const text = chunks.join('\n\n');
    if (text.length > 800000) throw new Error('Context is too large. Start a new conversation or remove attachments.');
    return text;
  }
  return { uid, defaults, providers, prompts, types, initialState, validateSettings, validateEntity, validateState, conversation, escape, highlight, markdown, search, stats, promptVariables, fillPrompt, csv, sensitive, buildContext, layoutSettings, suggestions, searchable };
});
