const fs = require('node:fs');
function parseEnv(text) {
  const output = {};
  for (const [i, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim(); if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!match) throw new Error(`Invalid environment variable on line ${i + 1}.`);
    let value = match[2];
    if (value.startsWith('"') || value.startsWith("'")) {
      const quote = value[0], end = value.lastIndexOf(quote);
      if (end <= 0 || (value.slice(end + 1).trim() && !value.slice(end + 1).trim().startsWith('#'))) throw new Error(`Invalid quoted value on line ${i + 1}.`);
      value = value.slice(1, end); if (quote === '"') value = value.replace(/\\n/g, '\n').replace(/\\"/g, '"');
    } else value = value.replace(/\s+#.*$/, '').trim();
    output[match[1]] = value;
  }
  return output;
}
function loadEnv(file, target = process.env) {
  if (!fs.existsSync(file)) return false;
  if (fs.statSync(file).size > 65536) throw new Error('Environment file exceeds 64 KB.');
  const variables = parseEnv(fs.readFileSync(file, 'utf8'));
  for (const [key, value] of Object.entries(variables)) if (target[key] === undefined) target[key] = value;
  return true;
}
function firebaseConfig(env = process.env) {
  return { apiKey: env.KAIRO_FIREBASE_API_KEY || '', projectId: env.KAIRO_FIREBASE_PROJECT_ID || '', authDomain: env.KAIRO_FIREBASE_AUTH_DOMAIN || '', appId: env.KAIRO_FIREBASE_APP_ID || '', authEmulator: env.KAIRO_FIREBASE_AUTH_EMULATOR || '', firestoreEmulator: env.KAIRO_FIREBASE_FIRESTORE_EMULATOR || '' };
}
function publicEnvironment(env = process.env) {
  return { firebaseConfigured: !!(env.KAIRO_FIREBASE_API_KEY && env.KAIRO_FIREBASE_PROJECT_ID), projectId: env.KAIRO_FIREBASE_PROJECT_ID || '', r2Configured: !!env.KAIRO_R2_WORKER_URL, encryptedBackupsConfigured: !!env.KAIRO_BACKUP_PASSPHRASE, activeProvider: env.KAIRO_ACTIVE_PROVIDER || '', source: 'environment variables' };
}
function activeState(state, env = process.env) {
  const kind = env.KAIRO_ACTIVE_PROVIDER;
  if (!kind) return state;
  if (!['claude','codex','ollama'].includes(kind)) throw new Error('KAIRO_ACTIVE_PROVIDER must be claude, codex or ollama.');
  const selected = state.providers.find(p => p.id === state.settings.defaultProvider && p.kind === kind) || state.providers.find(p => p.id === kind && p.kind === kind) || state.providers.find(p => p.kind === kind);
  return {...state, settings:{...state.settings, defaultProvider:selected?.id || kind, defaultModel:selected?.id === state.settings.defaultProvider ? state.settings.defaultModel : ''}, providers:state.providers.map(p=>({...p,enabled:p.kind === kind}))};
}
function cliProvider(provider, env = process.env) {
  const file = provider.kind === 'claude' ? env.KAIRO_CLAUDE_SETTINGS_FILE : provider.kind === 'codex' ? env.KAIRO_CODEX_CONFIG_FILE : '';
  return file && !provider.configFile && !provider.configDir ? { ...provider, configFile: file } : provider;
}
module.exports = { parseEnv, loadEnv, firebaseConfig, publicEnvironment, cliProvider, activeState };
