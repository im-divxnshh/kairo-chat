const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const P = require('../src/lib/providers');
const C = require('../src/lib/core');
const env = require('../src/lib/env');
test('native CLI configuration honors explicit files without changing Claude authentication storage', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kairo-config-'));
  try {
    const settings = path.join(directory, 'settings.json'), config = path.join(directory, 'config.toml');
    fs.writeFileSync(settings, JSON.stringify({ model: 'custom-model', env: { PRIVATE_KEY: 'never-copy-this' } })); fs.writeFileSync(config, 'model_provider="custom"\n');
    assert.equal(P.configuration({ kind: 'claude', configFile: settings }).file, settings);
    assert.equal(P.providerEnvironment({ kind: 'claude', configFile: settings }).CLAUDE_CONFIG_DIR, process.env.CLAUDE_CONFIG_DIR);
    assert.equal(P.providerEnvironment({ kind: 'codex', configFile: config }).CODEX_HOME, directory);
    assert.throws(() => P.configuration({ kind: 'codex', configFile: settings }), /config.toml/);
    assert.equal(env.cliProvider({ kind: 'claude' }, { KAIRO_CLAUDE_SETTINGS_FILE: settings }).configFile, settings);
    assert.equal(env.cliProvider({ kind: 'claude', configFile: '/explicit' }, { KAIRO_CLAUDE_SETTINGS_FILE: settings }).configFile, '/explicit');
    assert.ok(!JSON.stringify(env.publicEnvironment({ KAIRO_CLAUDE_SETTINGS_FILE: settings })).includes('PRIVATE_KEY'));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
test('existing backups remove direct API profiles while preserving conversations and native CLI profiles', () => {
  const state = C.initialState(); state.providers.push({ id: 'obsolete-api', name: 'Legacy API', kind: 'compatible', endpoint: 'https://api.example.test/v1', enabled: true });
  state.settings.defaultProvider = 'obsolete-api'; const chat = C.conversation('obsolete-api'); chat.messages.push({ id: 'saved-message', role: 'user', content: 'Preserve this history' }); state.conversations.push(chat);
  const migrated = C.validateState(state);
  assert.ok(!migrated.providers.some(provider => provider.kind === 'compatible'));
  assert.equal(migrated.settings.defaultProvider, 'claude'); assert.equal(migrated.conversations[0].messages[0].content, 'Preserve this history');
});
test('cache migration retains pending user edits and rejects future versions without rewriting them', () => {
  const {CloudStore} = require('../src/lib/cloud-store');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'kairo-cache-version-'));
  const firebase = {publicSession:()=>({uid:'cache-user'}),recordKey:(type,id)=>type+'--'+id};
  try {
    const first = new CloudStore(directory,firebase), state = C.initialState();
    state.providers.push({id:'legacy',name:'Old',kind:'compatible',endpoint:'https://example.test',enabled:true});
    const cache = {state,pending:{'memories--edit':{type:'memories',id:'edit',item:{id:'edit',content:'Keep this offline edit'},nonce:'nonce'},'providers--legacy':{type:'providers',id:'legacy',item:state.providers.at(-1)}},meta:{},conflicts:{}};
    fs.mkdirSync(path.dirname(first.file),{recursive:true}); fs.writeFileSync(first.file,JSON.stringify(cache));
    const migrated = new CloudStore(directory,firebase); assert.equal(migrated.pending['memories--edit'].item.content,'Keep this offline edit'); assert.equal(migrated.pending['providers--legacy'],undefined);
    migrated.persist(); assert.equal(JSON.parse(fs.readFileSync(first.file)).cacheVersion,2);
    cache.cacheVersion = 999; fs.writeFileSync(first.file,JSON.stringify(cache)); const original = fs.readFileSync(first.file,'utf8');
    assert.throws(()=>new CloudStore(directory,firebase),/newer version/); assert.equal(fs.readFileSync(first.file,'utf8'),original);
  } finally {fs.rmSync(directory,{recursive:true,force:true});}
});
test('device provider mode uses Codex without changing stored Claude configuration or history', () => {
  const state = C.initialState(); state.settings.defaultModel = 'claude-model'; state.providers.find(p=>p.kind === 'codex').enabled = false;
  state.providers.find(p=>p.kind === 'claude').configFile = '/native/settings.json'; const chat = C.conversation('claude'); state.conversations.push(chat);
  const original = structuredClone(state), active = env.activeState(state,{KAIRO_ACTIVE_PROVIDER:'codex'});
  assert.equal(active.settings.defaultProvider,'codex'); assert.equal(active.settings.defaultModel,''); assert.deepEqual(active.providers.filter(p=>p.enabled).map(p=>p.kind),['codex']);
  assert.equal(active.conversations[0].providerId,'claude'); assert.equal(active.providers.find(p=>p.kind === 'claude').configFile,'/native/settings.json'); assert.deepEqual(state,original);
  assert.equal(env.activeState(state,{}),state); assert.throws(()=>env.activeState(state,{KAIRO_ACTIVE_PROVIDER:'invalid'}),/KAIRO_ACTIVE_PROVIDER/);
});
