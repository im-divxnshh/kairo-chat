const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage, Notification, nativeImage, systemPreferences } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const core = require('./lib/core');
const { Firebase, validateConfig } = require('./lib/firebase');
const { CloudStore, atomicJSON } = require('./lib/cloud-store');
const providers = require('./lib/providers');
const workspace = require('./lib/workspace');
const mcp = require('./lib/mcp');
const environment = require('./lib/env');
const { R2Storage } = require('./lib/r2');
const runtime = require('./lib/runtime');
const knowledge = require('./lib/knowledge');
const speech = require('./lib/speech');
const branding = require('./lib/branding');
const updates = require('./lib/updates');
let firebase = null, store = null, config = null, dataDir, syncTimer, backupTimer, scheduleTimer, healthTimer;
let r2 = null, syncDebounce = null;
let booting = true, startupError = '';
const activeRuns = new Map(), grantedRoots = new Set(), attachmentPaths = new Map(), providerHealth = new Map();
branding.applyIdentity(app);
const launcher = branding.createLauncher({app,BrowserWindow,nativeImage,systemPreferences,settings:()=>store?.state.settings || core.defaults,busy:()=>activeRuns.size>0});
const localProjectPaths = new Map();
const permissions = new Map();
let sessionPersistence = false;
const rendererURL = pathToFileURL(path.join(__dirname, 'index.html')).href;
function trustedSender(event) {
  try { const source = new URL(event.senderFrame?.url || ''); source.search = ''; source.hash = ''; return source.href === rendererURL; } catch { return false; }
}
const secureFile = () => path.join(app.getPath('userData'), 'session.bin');
const redact = value => {
  let text = String(value || '').replace(/(?:sk-[\w-]{16,}|AIza[\w-]{20,}|eyJ[\w.-]{30,})/g, '[redacted]');
  for (const [name, secret] of Object.entries(process.env)) if ((name.startsWith('KAIRO_PROVIDER_') || name === 'KAIRO_BACKUP_PASSPHRASE') && secret?.length >= 6) text = text.replaceAll(secret, '[redacted]');
  return text.slice(-16000);
};
function encryptionAvailable() { return safeStorage.isEncryptionAvailable() && (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text'); }
function broadcast(channel, payload) { for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send(channel, payload); }
function requireStore() { if (!store || !firebase?.publicSession()) throw new Error('Sign in to your Firebase account first.'); return store; }
function notify(title, body, kind = 'info') {
  if (!store) return;
  const n = { id: core.uid(), title, content: body, kind, createdAt: Date.now(), read: false };
  store.upsert('notifications', n);
  let customSound = null;
  if (store.state.settings.notifications && store.state.settings.sound && store.state.settings.soundPath) {
    try { const file = store.state.settings.soundPath, size = fs.statSync(file).size; if (size <= 5 * 1024 * 1024 && /\.(wav|mp3|ogg|m4a)$/i.test(file)) customSound = { dataURL: 'data:audio/' + (path.extname(file).toLowerCase() === '.mp3' ? 'mpeg' : path.extname(file).slice(1)) + ';base64,' + fs.readFileSync(file).toString('base64') }; } catch { /* Fall back to the system sound. */ }
  }
  const soundWindow = BrowserWindow.getAllWindows().find(window => !window.isDestroyed());
  if (store.state.settings.notifications && Notification.isSupported()) new Notification({ title, body, silent: !store.state.settings.sound || !!(customSound && soundWindow) }).show();
  if (customSound && soundWindow) soundWindow.webContents.send('notification:sound', customSound);
}
async function checkProvider(s, provider) {
  let status;
  try { status = await providers.health(environment.cliProvider(provider)); }
  catch (error) { status = { id: provider.id, healthy: false, authentication: 'unknown', error: redact(error.message), checkedAt: Date.now() }; }
  if (store !== s) return status;
  const previous = providerHealth.get(provider.id);
  providerHealth.set(provider.id, status); broadcast('provider:health', status);
  if (previous?.healthy && (!status.healthy || status.authentication === 'signed out') && previous.authentication !== 'signed out') notify('CLI disconnected', provider.name + ': ' + (status.error || 'Sign in to your CLI again.'), 'disconnected');
  return status;
}
function authState() { return { configured: !!config, booting, startupError, environment: environment.publicEnvironment(), user: firebase?.publicSession() || null, sessionPersistence, sync: store?.status() || null }; }
function activity(s, title, projectId = '', content = '') { if (store === s) s.upsert('activity', { id: core.uid(), title, projectId, content, createdAt: Date.now() }); }
function requestPermission(event, requestId, input, signal) {
  return new Promise(resolve => {
    const id = core.uid();
    const finish = allowed => { clearTimeout(timer); signal?.removeEventListener('abort', deny); permissions.delete(id); resolve(allowed); };
    const deny = () => finish(false), timer = setTimeout(deny, 120000);
    permissions.set(id, { owner: event.sender.id, requestId, finish }); signal?.addEventListener('abort', deny, { once: true });
    if (signal?.aborted || event.sender.isDestroyed()) { deny(); return; }
    notify('Permission requested', input.tool + ' requires your approval.', 'permission');
    event.sender.send('agent:permission', { permissionId: id, requestId, ...input });
  });
}

function endSession() {
  speech.stopAll();
  clearInterval(syncTimer); clearInterval(backupTimer); clearInterval(scheduleTimer); clearInterval(healthTimer);
  clearTimeout(syncDebounce);
  for (const run of activeRuns.values()) run.controller.abort(); activeRuns.clear();
  for (const permission of [...permissions.values()]) permission.finish(false);
  if (store) store.close(); store = null; r2 = null; grantedRoots.clear(); localProjectPaths.clear(); attachmentPaths.clear(); providerHealth.clear();
}
function activateStore() {
  if (store) store.close();
  r2 = process.env.KAIRO_R2_WORKER_URL ? new R2Storage(process.env.KAIRO_R2_WORKER_URL, firebase) : null;
  store = new CloudStore(dataDir, firebase, (state, sync) => {
    broadcast('state:changed', { state: environment.activeState(state), sync });
    launcher.refresh();
    if (sync.pending && !sync.syncing && !sync.lastError) { clearTimeout(syncDebounce); syncDebounce = setTimeout(() => store?.sync(), 600); }
  });
  const mappingFile = path.join(store.directory, 'project-paths.json');
  try {
    if (fs.existsSync(mappingFile)) for (const [id, root] of Object.entries(JSON.parse(fs.readFileSync(mappingFile, 'utf8')))) {
      if (typeof root === 'string' && path.isAbsolute(root) && fs.existsSync(root) && fs.statSync(root).isDirectory() && fs.realpathSync(root) === root) { localProjectPaths.set(id, root); grantedRoots.add(root); }
    }
  } catch { /* Ignore a broken device mapping; users can reconnect through the folder picker. */ }
  syncTimer = setInterval(() => store?.sync(), 15000);
  let lastBackup = Date.now();
  backupTimer = setInterval(() => { if (store && runtime.backupDue(store.state.settings, lastBackup)) { try { store.backup(); lastBackup = Date.now(); if (r2 && process.env.KAIRO_BACKUP_PASSPHRASE) cloudBackup().catch(e => broadcast('app:error', redact(e.message))); } catch (e) { broadcast('app:error', redact(e.message)); } } }, 60000);
  scheduleTimer = setInterval(runSchedules, 15000);
  const s = store; let checkingHealth = false;
  healthTimer = setInterval(async () => {
    if (checkingHealth || store !== s) return; checkingHealth = true;
    try { await Promise.all(environment.activeState(s.state).providers.filter(p => p.enabled && providerHealth.has(p.id)).map(p => checkProvider(s, p))); }
    finally { checkingHealth = false; }
  }, 60000);
  store.sync(); broadcast('auth:changed', authState());
}
async function configure(input) {
  if (firebase?.publicSession()) throw new Error('Sign out before changing Firebase projects.');
  config = validateConfig(input);
  firebase = new Firebase(config, { onSession: async session => {
    sessionPersistence = encryptionAvailable();
    if (session && sessionPersistence) fs.writeFileSync(secureFile(), safeStorage.encryptString(JSON.stringify({ projectId: config.projectId, authEmulator: config.authEmulator, refreshToken: session.refreshToken })), { mode: 0o600 });
    else if (!session && fs.existsSync(secureFile())) fs.unlinkSync(secureFile());
  } });
  return authState();
}
function createWindow(projectId = '') {
  const window = new BrowserWindow({ width: 1360, height: 880, minWidth: 640, minHeight: 520, title: branding.identity.name, icon:branding.identity.icon, backgroundColor: '#141416', titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default', webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  launcher.refresh();
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (url !== window.webContents.getURL()) event.preventDefault(); });
  window.loadFile(path.join(__dirname, 'index.html'), { query: { projectId } });
  const ownerId = window.webContents.id;
  window.on('closed', () => { speech.stop(ownerId,true); for (const run of activeRuns.values()) if (run.owner === ownerId) run.controller.abort(); });
  return window;
}
function parent(event) { return BrowserWindow.fromWebContents(event.sender); }
async function pickJSON(event) {
  const account = requireStore();
  const result = await dialog.showOpenDialog(parent(event), { properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (result.canceled) return null;
  if (store !== account) throw new Error('Account changed during file selection.');
  if (fs.statSync(result.filePaths[0]).size > 50 * 1024 * 1024) throw new Error('Import exceeds 50 MB.');
  return JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8'));
}
async function exportJSON(event, data, defaultPath = 'kairo-export.json') {
  const account = requireStore();
  const result = await dialog.showSaveDialog(parent(event), { defaultPath, filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (result.canceled) return null; if (store !== account) throw new Error('Account changed during export.'); atomicJSON(result.filePath, data); return result.filePath;
}
function projectRoot(id) {
  const project = requireStore().state.projects.find(p => p.id === id);
  if (!project) throw new Error('Project not found.');
  const root = localProjectPaths.get(id);
  if (!root || !grantedRoots.has(root) || !fs.existsSync(root) || fs.realpathSync(root) !== root) throw new Error('Reconnect this project folder on this device to allow file and Git access.');
  return root;
}
async function attachPaths(paths, { folder = false } = {}) {
  const s = requireStore();
  const targets = paths.flatMap(root => fs.statSync(root).isDirectory() ? workspace.files(root, { max: s.state.settings.maxAttachments }).map(f => path.join(root, f.relative)) : [root]);
  if (targets.length > s.state.settings.maxAttachments) throw new Error(`Attach at most ${s.state.settings.maxAttachments} files.`);
  const attachments = await Promise.all(targets.map(file => workspace.readAttachment(file, s.state.settings)));
  if (store !== s) throw new Error('Account changed during attachment extraction.');
  for (const attachment of attachments) attachmentPaths.set(attachment.id, attachment.path);
  return attachments;
}
function requireR2() { if (!r2) throw new Error('Set KAIRO_R2_WORKER_URL in .env and restart the app to use R2 file storage.'); return r2; }
async function prepareRecord(type, item) {
  core.validateEntity(type, item);
  if (type === 'conversations') {
    const result = structuredClone(item), storage = item.messages.some(m => m.attachments?.some(f => !f.objectKey)) ? requireR2() : r2;
    for (const message of result.messages) if (message.attachments?.length) {
      for (let i = 0; i < message.attachments.length; i += 3) {
        const batch = message.attachments.slice(i, i + 3);
        const uploaded = await Promise.all(batch.map(f => f.objectKey ? f : storage.uploadAttachment(f)));
        message.attachments.splice(i, uploaded.length, ...uploaded);
      }
    }
    return result;
  }
  return item;
}
async function cloudBackup() { const s = requireStore(), metadata = await requireR2().backup(s.snapshot(), process.env.KAIRO_BACKUP_PASSPHRASE); if (store === s) s.upsert('backups', metadata); return metadata; }
async function execute(event, payload) {
  try { return await executeRequest(event, payload); }
  catch (error) {
    const s = store;
    if (s && payload?.requestId && !activeRuns.has(payload.requestId) && !payload.temporaryChat && !s.state.runs.some(r => r.id === payload.requestId)) {
      const message = redact(error.message); notify('Agent failed before starting', message.slice(0,180), 'failed');
      s.upsert('runs', { id: payload.requestId, providerId: payload.providerId || '', projectId: s.state.conversations.find(c => c.id === payload.chatId)?.projectId || '', status: 'failed', error: message, createdAt: Date.now(), durationMs: 0, events: [{ type: 'preflight-failed', at: 0 }] });
    }
    throw error;
  }
}
async function executeRequest(event, payload) {
  const s = requireStore(), owner = event.sender.id;
  if (!payload || typeof payload.requestId !== 'string' || activeRuns.has(payload.requestId)) throw new Error('Invalid or duplicate request.');
  const chat = payload.temporaryChat || s.state.conversations.find(c => c.id === payload.chatId);
  if (!chat) throw new Error('Conversation not found.'); core.validateEntity('conversations', chat);
  const history = structuredClone(payload.history || chat.messages.filter(m => m.status !== 'running'));
  core.validateEntity('conversations', { ...chat, messages: history });
  for (const message of history) if (message.attachments?.length) message.attachments = await Promise.all(message.attachments.map(f => f.objectKey ? requireR2().hydrate(f) : f));
  if (store !== s) throw new Error('Account changed during request preparation.');
  const baseProvider = environment.activeState(s.state).providers.find(p => p.id === payload.providerId);
  if (!baseProvider?.enabled) throw new Error('Enable and configure this provider.');
  const provider = environment.cliProvider({ ...baseProvider, model: payload.model || baseProvider.model || '' });
  const agent = s.state.agents.find(a => a.id === payload.agentId);
  const skills = s.state.skills.filter(skill => skill.enabled && (!skill.projectId || skill.projectId === chat.projectId));
  const prompt = core.buildContext(s.state, chat, history) + [agent?.instructions, ...skills.map(x => x.content)].filter(Boolean).map(v => '\n\nAdditional instructions:\n' + v).join('');
  const rawImages = history.flatMap(m => m.attachments || []).filter(f => f.kind === 'image');
  for (const f of history.flatMap(m => m.attachments || [])) if (s.state.settings.blockSensitive && core.sensitive(f.name, f.content || '')) throw new Error('Sensitive attachment blocked. Review the attachment before changing file settings.');
  const images = rawImages.map(f => {
    if (!/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(f.dataURL || '') || f.dataURL.length > s.state.settings.maxAttachmentMB * 1500000) throw new Error('Invalid image attachment.');
    let file = attachmentPaths.get(f.id);
    if (!file) { const dir = path.join(s.directory, 'files'); fs.mkdirSync(dir, { recursive: true }); file = path.join(dir, crypto.createHash('sha256').update(f.dataURL).digest('hex') + '.png'); fs.writeFileSync(file, Buffer.from(f.dataURL.split(',')[1], 'base64')); }
    return { ...f, path: file };
  });
  const cwd = chat.projectId && localProjectPaths.has(chat.projectId) ? projectRoot(chat.projectId) : os.homedir();
  if (payload.capability === 'agent' && !chat.projectId) throw new Error('Select an opened project before running a coding task.');
  const controller = new AbortController(), start = Date.now(); let firstChunk = null, content = '';
  activeRuns.set(payload.requestId, { controller, owner, chatId: chat.id });
  const longTimer = setTimeout(() => { if (store === s && !chat.temporary) notify('Task still running', provider.name + ' is still working.', 'long-running'); }, s.state.settings.longTaskSeconds * 1000);
  const record = { id: payload.requestId, providerId: provider.id, model: provider.model, conversationId: chat.id, projectId: chat.projectId || '', agentId: payload.agentId || '', createdAt: start, status: 'running', contextCharacters: prompt.length, estimatedContextTokens: Math.ceil(prompt.length / 4), events: [{ type: 'cli-start', at: 0 }], cli: provider.kind };
  try {
    const servers = s.state.mcpServers.filter(server => server.enabled);
    let mcpConfig = null;
    if (servers.length) {
      mcpConfig = path.join(s.directory, 'mcp-servers.json');
      atomicJSON(mcpConfig, { mcpServers: Object.fromEntries(servers.map(server => [server.name, { command: server.command, args: server.args || [] }])) });
    }
    const result = await providers.runProvider(provider, { prompt, images, cwd, temporary: chat.temporary, settings: s.state.settings, mcpConfig, capability: ['research','agent'].includes(payload.capability) ? payload.capability : 'chat', signal: controller.signal,
      onPermission: input => requestPermission(event, payload.requestId, input, controller.signal),
      onEvent: type => { if (record.events.length < 200) record.events.push({ type, at: Date.now() - start }); },
      onChunk: chunk => { if (firstChunk === null) firstChunk = Date.now(); content += chunk; if (!event.sender.isDestroyed()) event.sender.send('agent:chunk', { requestId: payload.requestId, chatId: chat.id, chunk }); },
    });
    Object.assign(record, { status: 'completed', usage: result.usage, costUSD: result.costUSD || 0, durationMs: Date.now() - start, requestDurationMs: (firstChunk || Date.now()) - start, responseDurationMs: firstChunk ? Date.now() - firstChunk : 0 });
    finishMessage(s, chat, payload.requestId, result.content, record);
    if (store === s && !chat.temporary) notify('Agent completed', provider.name + ' finished your task.', 'completed');
    return { ...result, stderr: undefined, record };
  } catch (error) {
    const message = redact(error.message);
    Object.assign(record, { status: controller.signal.aborted ? 'stopped' : 'failed', error: message, durationMs: Date.now() - start });
    finishMessage(s, chat, payload.requestId, content || message, record, !content);
    if (store === s && !chat.temporary && record.status === 'failed') notify('Agent failed', message.slice(0, 180), 'failed');
    throw new Error(message);
  } finally {
    record.events.push({ type: 'cli-' + record.status, at: Date.now() - start });
    clearTimeout(longTimer); activeRuns.delete(payload.requestId);
    if (store === s && !chat.temporary) { s.upsert('runs', record); s.sync(); }
  }
}
function finishMessage(s, chat, requestId, content, record, error = false) {
  if (chat.temporary || store !== s) return;
  const latest = structuredClone(s.state.conversations.find(c => c.id === chat.id)); if (!latest) return;
  const message = latest.messages.find(m => m.id === requestId); if (!message) return;
  Object.assign(message, { content, status: record.status, error, usage: record.usage, durationMs: record.durationMs });
  s.upsert('conversations', latest);
}
async function runSchedules() {
  if (!store) return;
  const s = store, window = BrowserWindow.getAllWindows()[0];
  const sender = window?.webContents || { id:0,isDestroyed:()=>true,send:()=>{} };
  for (const schedule of s.state.schedules) {
    if (!environment.activeState(s.state).providers.some(p=>p.id === schedule.providerId && p.enabled)) continue;
    if (!schedule.enabled || schedule.nextRunAt > Date.now() || activeRuns.size >= 4) continue;
    const chat = core.conversation(schedule.providerId, schedule.projectId || ''); chat.title = 'Scheduled: ' + schedule.title;
    chat.messages.push({ id: core.uid(), role: 'user', content: schedule.prompt, timestamp: Date.now() });
    const requestId = core.uid(); chat.messages.push({ id: requestId, role: 'assistant', content: '', status: 'running', timestamp: Date.now() });
    s.upsert('conversations', chat); s.upsert('schedules', runtime.nextSchedule(schedule));
    execute({ sender }, { requestId, chatId: chat.id, providerId: schedule.providerId }).then(() => {
      const current = s.state.schedules.find(x => x.id === schedule.id); if (store === s && current) s.upsert('schedules', { ...current, lastStatus: 'completed' });
    }).catch(error => {
      const current = s.state.schedules.find(x => x.id === schedule.id); if (store === s && current) { try { s.upsert('schedules', { ...current, lastStatus: 'failed', lastError: redact(error.message) }); } catch { broadcast('app:error','A scheduled task could not save its status.'); } }
    });
  }
}
const operations = {
  'app:bootstrap': () => ({ auth: authState(), state: environment.activeState(store?.snapshot() || core.initialState()), health: [...providerHealth.values()], features: JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/features.json'))), version: app.getVersion() }),
  'app:setupGuide': () => fs.readFileSync(path.join(__dirname, '../docs/FIREBASE_R2_SETUP.md'), 'utf8'),
  'auth:signIn': (_e, input) => authenticate('signInWithPassword', input),
  'auth:signUp': (_e, input) => authenticate('signUp', input),
  'auth:signOut': async () => { endSession(); await firebase?.signOut(); broadcast('auth:changed', authState()); return authState(); },
  'auth:reset': async (_e, { email }) => { if (!firebase) throw new Error('Configure Firebase first.'); await firebase.resetPassword(email); return true; },
  'auth:verify': async () => { requireStore(); await firebase.verifyEmail(); return true; },
  'auth:refresh': async () => { requireStore(); await firebase.lookup(); broadcast('auth:changed', authState()); return authState(); },
  'state:upsert': async (_e, { type, item, expectedRevision }) => { const s = requireStore(), prepared = await prepareRecord(type, item); if (store !== s) throw new Error('Account changed during save.'); const value = s.upsert(type, prepared, expectedRevision); if (['projects', 'conversations'].includes(type)) activity(s, 'Saved ' + (type === 'projects' ? 'project' : 'conversation'), type === 'projects' ? value.id : value.projectId, value.title || value.name); return value; },
  'state:remove': (_e, { type, id }) => { const s = requireStore(), item = s.state[type]?.find(x => x.id === id); if (type === 'conversations') for (const run of activeRuns.values()) if (run.chatId === id) run.controller.abort(); s.remove(type, id); if (['projects', 'conversations'].includes(type)) activity(s, 'Deleted ' + type, type === 'projects' ? id : item?.projectId, item?.title || item?.name || id); return true; },
  'settings:save': (_e, input) => requireStore().settings(input),
  'speech:start': event => { const s = requireStore(); return speech.start(event.sender.id,result=>{if(store===s&&!event.sender.isDestroyed())event.sender.send('speech:result',result);}); },
  'speech:stop': event => { requireStore(); speech.stop(event.sender.id); return true; },
  'notification:chooseSound': async event => { const s = requireStore(), result = await dialog.showOpenDialog(parent(event), { properties: ['openFile'], filters: [{name:'Notification sound',extensions:['wav','mp3','ogg','m4a']}] }); if (result.canceled) return false; if (store !== s) throw new Error('Account changed during selection.'); const file = result.filePaths[0]; if (!/\.(wav|mp3|ogg|m4a)$/i.test(file) || fs.statSync(file).size > 5 * 1024 * 1024) throw new Error('Choose an audio file up to 5 MB.'); s.settings({...s.state.settings,soundPath:file,sound:true}); return true; },
  'app:checkUpdates': async () => {
    const s = requireStore(); if (!s.state.settings.updateUrl) throw new Error('Set an HTTPS release manifest URL in Diagnostics settings.');
    const release = await updates.check(s.state.settings.updateUrl, app.getVersion()), newer = release.newer;
    if (store !== s) throw new Error('Account changed during update check.'); if (newer) notify('Kairo update available', 'Version ' + release.version + ' is available.', 'update');
    return { newer, version:release.version, url:release.url };
  },
  'sync:now': async () => { const s = requireStore(); await s.sync(); return s.status(); },
  'sync:resolve': (_e, input) => { const s = requireStore(); s.resolve(input.type, input.id, input.choice); s.sync(); return s.status(); },
  'provider:test': async (_e, { id }) => { const s = requireStore(), p = environment.activeState(s.state).providers.find(p => p.id === id); if (!p) throw new Error('Provider not found.'); if (!p.enabled) throw new Error('This provider is inactive. Check your provider settings and KAIRO_ACTIVE_PROVIDER.'); const status = await checkProvider(s, p); if (store !== s) throw new Error('Account changed during connection test.'); return status; },
  'agent:send': execute,
  'knowledge:search': async (event, { query, projectId = '', type = '', providerId, requestId }) => {
    const s = requireStore(), entries = knowledge.candidates(s.state, query, { projectId, type }); if (!entries.length) return [];
    const active = environment.activeState(s.state), p = active.providers.find(p => p.id === (providerId || active.settings.defaultProvider) && p.enabled);
    if (!p) throw new Error('Select an enabled CLI provider.');
    if (typeof requestId !== 'string' || activeRuns.has(requestId)) throw new Error('Invalid search request.');
    const controller = new AbortController(), start = Date.now(), record = { id: requestId, providerId: p.id, projectId, kind: 'semantic-search', status: 'running', createdAt: start, events: [{ type: 'cli-start', at: 0 }] }; activeRuns.set(requestId, { controller, owner: event.sender.id });
    try { const result = await providers.runProvider(environment.cliProvider(p), { prompt: knowledge.searchPrompt(query, entries), temporary: true, settings: s.state.settings, signal: controller.signal, onEvent: type => { if (record.events.length < 200) record.events.push({type, at: Date.now() - start}); } }); if (store !== s) throw new Error('Account changed during search.'); const matches = knowledge.parseResults(result.content, entries); Object.assign(record, { status: 'completed', usage: result.usage }); return matches; }
    catch (error) { Object.assign(record, {status: controller.signal.aborted ? 'stopped' : 'failed', error: redact(error.message)}); throw error; }
    finally { activeRuns.delete(requestId); if (store === s) { record.durationMs = Date.now() - start; record.events.push({type: 'cli-' + record.status, at: record.durationMs}); s.upsert('runs', record); } }
  },
  'agent:stop': (event, { requestId }) => { const run = activeRuns.get(requestId); if (run?.owner === event.sender.id) run.controller.abort(); return true; },
  'agent:permission': (event, { permissionId, allow }) => { const permission = permissions.get(permissionId); if (!permission || permission.owner !== event.sender.id) throw new Error('Permission request is no longer available.'); permission.finish(allow === true); return true; },
  'files:pick': async (event, { folder = false } = {}) => { const s = requireStore(); const result = await dialog.showOpenDialog(parent(event), { properties: folder ? ['openDirectory'] : ['openFile', 'multiSelections'] }); if (result.canceled) return []; if (store !== s) throw new Error('Account changed during file selection.'); return attachPaths(result.filePaths, { folder }); },
  'files:preview': async (_e, { attachment }) => { const s = requireStore(); const value = attachment.objectKey ? await requireR2().hydrate(attachment) : attachment; if (store !== s) throw new Error('Account changed during preview.'); return value; },
  'project:open': async (event, { create = false, id = '' } = {}) => {
    const s = requireStore(), result = await dialog.showOpenDialog(parent(event), { properties: ['openDirectory', ...(create ? ['createDirectory'] : [])] }); if (result.canceled) return null;
    const root = fs.realpathSync(result.filePaths[0]); grantedRoots.add(root);
    const existing = id ? s.state.projects.find(p => p.id === id) : s.state.projects.find(p => localProjectPaths.get(p.id) === root || p.path === root);
    if (id && !existing) throw new Error('Project not found.');
    const project = { id: existing?.id || core.uid(), name: path.basename(root), path: root, instructions: '', memory: '', notes: '', bookmarks: [], configuration: {}, ...existing, lastOpenedAt: Date.now(), git: await workspace.repository(root) };
    const saved = s.upsert('projects', project); localProjectPaths.set(saved.id, root);
    atomicJSON(path.join(s.directory, 'project-paths.json'), Object.fromEntries(localProjectPaths));
    return saved;
  },
  'project:create': async (event, { name }) => {
    const s = requireStore(), result = await dialog.showOpenDialog(parent(event), { title: 'Choose a parent folder for the new project', properties: ['openDirectory'] });
    if (result.canceled) return null;
    if (store !== s) throw new Error('Account changed during file selection.');
    const root = runtime.createProject(result.filePaths[0], name), project = { id: core.uid(), name, path: root, instructions: '', memory: '', notes: '', bookmarks: [], configuration: {}, lastOpenedAt: Date.now(), git: false };
    grantedRoots.add(root); localProjectPaths.set(project.id, root); atomicJSON(path.join(s.directory, 'project-paths.json'), Object.fromEntries(localProjectPaths));
    return s.upsert('projects', project);
  },
  'project:files': (_e, { id, query = '' }) => workspace.files(projectRoot(id), { query }),
  'project:read': (_e, { id, file }) => workspace.readAttachment(workspace.inside(projectRoot(id), path.resolve(projectRoot(id), file)), requireStore().state.settings),
  'project:window': (_e, { id }) => { requireStore(); createWindow(id); return true; },
  'git:run': async (_e, { projectId, operation, input }) => { const root = projectRoot(projectId), s = requireStore(); const result = await workspace.git(root, operation, input); s.upsert('activity', { id: core.uid(), projectId, title: 'Git ' + operation, content: '', createdAt: Date.now() }); return result; },
  'git:conflictFiles': async (_e, { projectId }) => { const root = projectRoot(projectId); return runtime.conflictFiles(root, await workspace.git(root, 'conflicts')); },
  'git:applyResolution': (_e, { projectId, file, content, hash }) => { const s = requireStore(), result = runtime.applyResolution(projectRoot(projectId), { file, content, hash }); s.upsert('activity', { id: core.uid(), projectId, title: 'Applied reviewed conflict resolution', content: file, createdAt: Date.now() }); return result; },
  'terminal:open': (_e, { projectId = '' } = {}) => { const s = requireStore(), cwd = projectId ? projectRoot(projectId) : os.homedir(), command = runtime.terminalCommand(cwd, s.state.settings); return new Promise((resolve, reject) => { const child = providers.spawnCLI(command.file, command.args, { cwd, env: providers.providerEnvironment({ kind: 'claude' }), detached: true, stdio: 'ignore' }); child.once('error', reject); child.once('spawn', () => { child.unref(); resolve(true); }); }); },
  'storage:location': () => { requireStore(); return dataDir; },
  'storage:choose': async event => {
    const s = requireStore(), result = await dialog.showOpenDialog(parent(event), { title: 'Move local Kairo cache and backups', properties: ['openDirectory'] });
    if (result.canceled) return null;
    if (store !== s) throw new Error('Account changed during selection.');
    if (activeRuns.size) throw new Error('Stop active tasks before moving local data.');
    await s.sync(); if (store !== s) throw new Error('Account changed during synchronization.');
    s.persist(); const destination = runtime.copyStorage(dataDir, result.filePaths[0]);
    atomicJSON(path.join(app.getPath('userData'), 'storage-location.json'), { directory: destination });
    endSession(); dataDir = destination; activateStore(); return destination;
  },
  'app:resetAll': async () => {
    const s = requireStore(); if (Object.keys(s.conflicts).length) throw new Error('Resolve cloud conflicts before resetting.');
    for (const run of activeRuns.values()) run.controller.abort(); await s.sync(); if (store !== s) throw new Error('Account changed during reset.');
    s.backup(); for (const type of core.types) for (const item of [...s.state[type]]) s.remove(type, item.id);
    const fresh = core.initialState(); for (const type of ['providers', 'prompts']) for (const item of fresh[type]) s.upsert(type, item);
    s.settings(fresh.settings); localProjectPaths.clear(); grantedRoots.clear(); atomicJSON(path.join(s.directory, 'project-paths.json'), {});
    endSession(); activateStore(); const next = requireStore(); await next.sync(); if (Object.keys(next.pending).length && !next.lastError) await next.sync();
    return next.status();
  },
  'github:prs': async (_e, { projectId }) => { const root = projectRoot(projectId), gh = providers.executable('gh'); if (!gh) throw new Error('Install and authenticate the GitHub CLI (gh).'); const result = await providers.runFile(gh, ['pr', 'list', '--json', 'number,title,url,headRefName,body'], { cwd: root }); if (result.code) throw new Error(redact(result.stderr)); return JSON.parse(result.stdout); },
  'github:diff': async (_e, { projectId, number }) => { if (!Number.isInteger(number) || number < 1) throw new Error('Invalid PR number.'); const result = await providers.runFile(providers.executable('gh'), ['pr', 'diff', String(number)], { cwd: projectRoot(projectId) }); if (result.code) throw new Error(redact(result.stderr)); return result.stdout; },
  'mcp:tools': async (_e, { id }) => { const s = requireStore(), server = s.state.mcpServers.find(x => x.id === id); if (!server) throw new Error('Server not found.'); const result = await mcp.call(server, 'tools/list'); s.upsert('mcpServers', { ...server, tools: result.tools || [] }); return result; },
  'mcp:call': async (_e, { id, name, arguments: args }) => { const s = requireStore(), server = s.state.mcpServers.find(x => x.id === id); if (!server?.tools?.some(t => t.name === name)) throw new Error('Discover this tool before calling it.'); return mcp.call(server, 'tools/call', { name, arguments: args }); },
  'backup:manual': () => requireStore().backup(),
  'backup:cloud': cloudBackup,
  'backup:cloudRestore': async (_e, { id }) => { const s = requireStore(), metadata = s.state.backups.find(b => b.id === id); if (!metadata) throw new Error('Backup not found.'); const state = await requireR2().restore(metadata.objectKey, process.env.KAIRO_BACKUP_PASSPHRASE); if (store !== s) throw new Error('Account changed during restore.'); s.backup(); s.import(state); return true; },
  'backup:restore': async event => { const input = await pickJSON(event); if (!input) return false; const s = requireStore(); core.validateState(input); s.backup(); s.import(input); return true; },
  'data:export': async (event, { type, id } = {}) => { const state = requireStore().snapshot(); let value = state; if (type) { if (!core.types.includes(type) && type !== 'settings') throw new Error('Unknown export type.'); value = { format: 'kairo', version: 1, type, items: type === 'settings' ? state.settings : state[type].filter(x => !id || x.id === id) }; } return exportJSON(event, value); },
  'data:import': async event => { const input = await pickJSON(event); if (!input) return false; const s = requireStore(); if (input.version === 1 && (input.type === 'settings' || core.types.includes(input.type)) && Object.hasOwn(input,'items')) { if (input.type === 'settings') s.settings(input.items); else { if (!Array.isArray(input.items)) throw new Error('Invalid export.'); input.items.forEach(item => core.validateEntity(input.type, item)); for (const item of input.items) s.upsert(input.type, item); } } else s.import(input); return true; },
  'data:legacy': () => { const file = path.join(app.getPath('userData'), 'data/history.json'); if (!fs.existsSync(file)) return 0; const chats = JSON.parse(fs.readFileSync(file, 'utf8')); if (!Array.isArray(chats)) throw new Error('Invalid legacy history.'); const s = requireStore(); for (const old of chats) { const chat = { ...core.conversation(old.provider || 'claude'), ...old, providerId: old.provider || 'claude' }; core.validateEntity('conversations', chat); s.upsert('conversations', chat); } return chats.length; },
  'app:external': (_e, { url }) => { const target = new URL(url); if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Only HTTP(S) links are supported.'); return shell.openExternal(target.href); },
  'app:fullscreen': event => { const window = parent(event); window.setFullScreen(!window.isFullScreen()); return window.isFullScreen(); },
  'app:logs': async event => exportJSON(event, { runs: requireStore().state.runs, sync: store.status(), health: [...providerHealth.values()].map(h => ({ ...h, executable: undefined, configPath: undefined })) }, 'kairo-diagnostics.json'),
  'app:reset': () => { const s = requireStore(); s.backup(); s.settings(core.defaults); return true; },
};
ipcMain.handle('kairo:request', async (event, { operation, payload } = {}) => {
  if (!trustedSender(event)) throw new Error('Untrusted IPC sender.');
  if (!Object.hasOwn(operations, operation)) throw new Error('Unknown operation.');
  const account = store;
  try { return { ok: true, value: await operations[operation](event, payload) }; }
  catch (error) {
    if (operation === 'agent:send' && store && store === account && payload?.chatId) {
      const chat = store.state.conversations.find(c => c.id === payload.chatId), message = chat?.messages.find(m => m.id === payload.requestId);
      if (message?.status === 'running') { const copy = structuredClone(chat); Object.assign(copy.messages.find(m => m.id === payload.requestId), { status: 'failed', content: redact(error.message), error: true }); try { store.upsert('conversations', copy); } catch {} }
    }
    return { ok: false, error: redact(error.message) };
  }
});
ipcMain.handle('kairo:drop', async (event, paths) => {
  if (!trustedSender(event)) throw new Error('Untrusted file drop.');
  try { if (!Array.isArray(paths) || paths.length > 100 || paths.some(p => typeof p !== 'string' || !path.isAbsolute(p))) throw new Error('Invalid file drop.'); return { ok: true, value: await attachPaths(paths) }; }
  catch (error) { return { ok: false, error: redact(error.message) }; }
});
async function authenticate(action, { email, password }) {
  if (booting) throw new Error('Session is still being restored. Try again shortly.');
  if (!firebase) throw new Error('Add Firebase configuration to .env and restart the app.');
  endSession(); await firebase.signOut(); await configure(config);
  await firebase.authenticate(action, email, password); activateStore(); return authState();
}
app.whenReady().then(async () => {
  dataDir = path.join(app.getPath('userData'), 'data');
  const locationFile = path.join(app.getPath('userData'), 'storage-location.json');
  if (fs.existsSync(locationFile)) { try { const saved = JSON.parse(fs.readFileSync(locationFile, 'utf8')).directory; if (path.isAbsolute(saved) && fs.statSync(saved).isDirectory()) dataDir = fs.realpathSync(saved); } catch { startupError = 'The selected local data folder is unavailable. Using the default folder.'; } }
  fs.mkdirSync(dataDir, { recursive: true });
  try {
    const envFile = process.env.KAIRO_ENV_FILE || (app.isPackaged ? path.join(app.getPath('userData'), '.env') : path.join(__dirname, '../.env'));
    environment.loadEnv(envFile);
    const settings = environment.firebaseConfig(); if (settings.apiKey && settings.projectId) await configure(settings);
    createWindow();
    if (firebase && encryptionAvailable() && fs.existsSync(secureFile())) {
      const saved = JSON.parse(safeStorage.decryptString(fs.readFileSync(secureFile())));
      if (saved.projectId === config.projectId && (saved.authEmulator || '') === config.authEmulator) { await firebase.restore(saved.refreshToken); activateStore(); }
    }
  } catch (error) { if (firebase) firebase.session = null; startupError = redact(error.message); }
  booting = false; if (!BrowserWindow.getAllWindows().length) createWindow(); broadcast('auth:changed', authState());
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('before-quit', () => {launcher.dispose();endSession();});
app.on('window-all-closed', () => {launcher.stop();if (process.platform !== 'darwin') app.quit();});
