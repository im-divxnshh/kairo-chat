const path = require('node:path'), fs = require('node:fs');
const environment = require('../src/lib/env'), P = require('../src/lib/providers'), C = require('../src/lib/core');
function options(args, activeProvider = '') {
  let selected = ['claude','codex'].includes(activeProvider) ? [activeProvider] : ['claude','codex'], timeout = 60, safeMode = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--provider' && ['claude','codex'].includes(args[i+1])) selected = [args[++i]];
    else if (args[i] === '--timeout' && /^\d+$/.test(args[i+1] || '')) timeout = Number(args[++i]);
    else if (args[i] === '--safe-mode') safeMode = true;
    else throw new Error('Use --provider claude|codex, --timeout 10–600 and optional --safe-mode for Claude.');
  }
  if (timeout < 10 || timeout > 600 || safeMode && (selected.length !== 1 || selected[0] !== 'claude')) throw new Error('Use a timeout of 10–600 seconds; --safe-mode requires --provider claude.');
  return {selected, timeout, safeMode};
}
function diagnostic(provider) {
  if (provider.kind !== 'claude') return '';
  const config = P.configuration(provider);
  const settings = config.exists ? JSON.parse(fs.readFileSync(config.file,'utf8')) : {};
  const env = {...process.env,...(settings.env || {})};
  let host = 'Claude default';
  if (env.ANTHROPIC_BASE_URL) { try {host = new URL(env.ANTHROPIC_BASE_URL).hostname;} catch {host = 'invalid base URL';} }
  const model = provider.model || settings.model || 'CLI default';
  const alias = {'haiku':'ANTHROPIC_DEFAULT_HAIKU_MODEL','sonnet':'ANTHROPIC_DEFAULT_SONNET_MODEL','opus':'ANTHROPIC_DEFAULT_OPUS_MODEL'}[model];
  const effective = alias && env[alias] ? env[alias] : model;
  // Only names are printed; never settings contents, URLs with credentials or tokens.
  const safe = value => /^[a-zA-Z0-9._:/()[\] -]{1,160}$/.test(String(value)) ? String(value) : 'configured';
  return `Claude gateway: ${safe(host)}; model: ${safe(model)}${effective !== model ? ' → ' + safe(effective) : ''}; hooks: ${settings.hooks ? 'configured' : 'none'}; plugins: ${Object.keys(settings.enabledPlugins || {}).length}`;
}
async function main() {
  environment.loadEnv(process.env.KAIRO_ENV_FILE || path.join(__dirname,'../.env'));
  const opt = options(process.argv.slice(2), process.env.KAIRO_ACTIVE_PROVIDER);
  let failed = false;
  for (const kind of opt.selected) {
    const provider = environment.cliProvider({id:kind,name:kind,kind,args:[],enabled:true});
    let initialized = false, responseStarted = false;
    try {
      const status = await P.health(provider); console.log(`${kind}: ${status.authentication}; native configuration ${status.configExists?'found':'missing'}`);
      const detail = diagnostic(provider); if (detail) console.log(detail);
      console.log(`Response timeout: ${opt.timeout}s${opt.safeMode ? '; Claude safe mode enabled (customizations disabled)' : ''}`);
      if (!status.healthy) throw new Error('CLI unavailable.');
      const result = await P.runProvider(provider,{
        prompt:'Reply with exactly KAIRO_OK. Do not use any tools.',temporary:true,safeMode:opt.safeMode,settings:{...C.defaults,cliTimeoutSeconds:opt.timeout},
        onEvent:type => {if (['system','thread.started'].includes(type)) initialized = true;},onChunk:()=>{responseStarted=true;}
      });
      if (!result.content.includes('KAIRO_OK')) throw new Error('Unexpected verification response.');
      console.log(`PASS ${kind} live response through native CLI configuration${opt.safeMode ? ' in safe mode; normal-mode verification remains required' : ''}`);
    } catch (error) {
      failed = true;
      const timeout = error.code === 'KAIRO_CLI_TIMEOUT' || /timed out/.test(error.message);
      const phase = error.phase || (responseStarted ? 'response' : initialized ? 'request' : 'startup');
      console.log(`FAIL ${kind}: ${timeout ? `Request timed out after ${opt.timeout}s during ${phase}` : /ENOTFOUND|network|connect/i.test(error.message) ? 'Network unavailable' : 'CLI request failed; check the CLI configuration and its authentication'}`);
      if (kind === 'claude' && timeout) {
        console.log(phase === 'startup' ? 'Claude did not emit its initialization event. Check session hooks and plugin startup.' : 'Claude started but did not finish. Check gateway connectivity, the configured model and provider service.');
        if (!opt.safeMode) console.log('Isolate customizations: npm run verify:cli -- --provider claude --safe-mode --timeout 120');
      }
    }
  }
  process.exitCode = failed ? 1 : 0;
}
module.exports = {options, diagnostic, main};
if (require.main === module) main().catch(error=>{console.error(error.message.startsWith('Use ') ? error.message : 'CLI configuration check failed.');process.exitCode=1;});
