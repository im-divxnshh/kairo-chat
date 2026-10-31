const core = require('./core');
const friendlyErrors = {
  EMAIL_EXISTS: 'An account with this email already exists.',
  INVALID_LOGIN_CREDENTIALS: 'Email or password is incorrect.',
  EMAIL_NOT_FOUND: 'Email or password is incorrect.', INVALID_PASSWORD: 'Email or password is incorrect.',
  USER_DISABLED: 'This account has been disabled.', TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many attempts. Try again later.',
  OPERATION_NOT_ALLOWED: 'Enable Email/Password sign-in in Firebase Authentication.',
  INVALID_API_KEY: 'Check your Firebase web API key.', PROJECT_NOT_FOUND: 'Check your Firebase project ID.',
  PERMISSION_DENIED: 'Firestore denied access. Check your deployed security rules and sign-in status.',
};
class FirebaseError extends Error {
  constructor(code, message, status = 0) { super(message); this.name = 'FirebaseError'; this.code = code; this.status = status; }
}
function validateConfig(input) {
  if (!input || typeof input !== 'object') throw new Error('Firebase configuration is required.');
  const config = Object.fromEntries(['apiKey', 'projectId', 'authDomain', 'appId', 'authEmulator', 'firestoreEmulator'].map(k => [k, String(input[k] || '').trim()]));
  if (!config.apiKey || !/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(config.projectId)) throw new Error('Enter a Firebase web API key and valid project ID.');
  for (const key of ['authEmulator', 'firestoreEmulator']) if (config[key]) {
    const url = new URL(config[key]);
    if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Firebase emulators must use a loopback HTTP URL, such as http://127.0.0.1:9099.');
    config[key] = url.origin;
  }
  if (Boolean(config.authEmulator) !== Boolean(config.firestoreEmulator)) throw new Error('Configure both emulators together to keep test accounts away from production.');
  return config;
}
class Firebase {
  constructor(config, { fetchImpl = globalThis.fetch, onSession = () => {} } = {}) {
    this.config = validateConfig(config); this.fetch = fetchImpl; this.onSession = onSession;
    this.session = null; this.refreshing = null; this.generation = 0;
  }
  async request(url, { method = 'POST', body, headers = {}, token = false, retry = true } = {}) {
    if (token) headers = { ...headers, Authorization: `Bearer ${await this.token()}` };
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await this.fetch(url, { method, headers: { 'Content-Type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }), signal: controller.signal, redirect: 'error' });
      const raw = await response.text(); let data;
      try { data = raw ? JSON.parse(raw) : {}; } catch { throw new FirebaseError('INVALID_RESPONSE', 'Firebase returned an invalid response.', response.status); }
      if (!response.ok) {
        if (response.status === 401 && token && retry && this.session) { await this.refresh(); return this.request(url, { method, body, headers, token, retry: false }); }
        const code = data.error?.status || data.error?.message?.split(' : ')[0] || `HTTP_${response.status}`;
        const message = friendlyErrors[code] || (code.startsWith('WEAK_PASSWORD') ? 'Use a password with at least 6 characters.' : `Firebase request failed (${code}).`);
        throw new FirebaseError(code, message, response.status);
      }
      return data;
    } catch (error) { if (error instanceof FirebaseError) throw error; throw new FirebaseError('NETWORK', controller.signal.aborted ? 'Firebase connection timed out.' : 'Cannot reach Firebase. Check your connection.'); }
    finally { clearTimeout(timeout); }
  }
  authURL(action) { return `${this.config.authEmulator ? this.config.authEmulator + '/identitytoolkit.googleapis.com' : 'https://identitytoolkit.googleapis.com'}/v1/accounts:${action}?key=${encodeURIComponent(this.config.apiKey)}`; }
  get documentsURL() { return `${this.config.firestoreEmulator || 'https://firestore.googleapis.com'}/v1/projects/${this.config.projectId}/databases/(default)/documents`; }
  get documentPrefix() { return `projects/${this.config.projectId}/databases/(default)/documents/users/${this.session?.uid}`; }
  publicSession() { return this.session ? { uid: this.session.uid, email: this.session.email, emailVerified: Boolean(this.session.emailVerified), displayName: this.session.displayName || '' } : null; }
  async authenticate(action, email, password) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || password.length < 6) throw new Error('Enter a valid email and password of at least 6 characters.');
    const generation = ++this.generation;
    const data = await this.request(this.authURL(action), { body: { email, password, returnSecureToken: true } });
    if (generation !== this.generation) throw new Error('Authentication was cancelled.');
    this.session = { uid: data.localId, email: data.email, idToken: data.idToken, refreshToken: data.refreshToken, expiresAt: Date.now() + Number(data.expiresIn) * 1000, emailVerified: false };
    await this.lookup(); await this.onSession(this.session); return this.publicSession();
  }
  async lookup() {
    const data = await this.request(this.authURL('lookup'), { body: { idToken: await this.token() } });
    const user = data.users?.[0]; if (!user || user.localId !== this.session.uid) throw new Error('Firebase account lookup failed.');
    Object.assign(this.session, { email: user.email, emailVerified: !!user.emailVerified, displayName: user.displayName || '' });
    return this.publicSession();
  }
  async restore(refreshToken) {
    this.session = { refreshToken, expiresAt: 0 }; await this.refresh(); await this.lookup(); return this.publicSession();
  }
  async token() { if (!this.session) throw new FirebaseError('UNAUTHENTICATED', 'Sign in to continue.'); if (!this.session.idToken || this.session.expiresAt < Date.now() + 60000) await this.refresh(); return this.session.idToken; }
  async refresh() {
    if (!this.session?.refreshToken) throw new FirebaseError('UNAUTHENTICATED', 'Sign in to continue.');
    if (this.refreshing) return this.refreshing;
    const generation = this.generation;
    this.refreshing = (async () => {
      const base = this.config.authEmulator ? `${this.config.authEmulator}/securetoken.googleapis.com` : 'https://securetoken.googleapis.com';
      const data = await this.request(`${base}/v1/token?key=${encodeURIComponent(this.config.apiKey)}`, { body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: this.session.refreshToken }).toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      if (generation !== this.generation || !this.session) throw new Error('Authentication was cancelled.');
      Object.assign(this.session, { uid: data.user_id, idToken: data.id_token, refreshToken: data.refresh_token, expiresAt: Date.now() + Number(data.expires_in) * 1000 });
      await this.onSession(this.session);
    })();
    try { await this.refreshing; } finally { this.refreshing = null; }
  }
  async resetPassword(email) { if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email.'); await this.request(this.authURL('sendOobCode'), { body: { requestType: 'PASSWORD_RESET', email } }); }
  async verifyEmail() { await this.request(this.authURL('sendOobCode'), { body: { requestType: 'VERIFY_EMAIL', idToken: await this.token() } }); }
  async signOut() { this.generation++; this.session = null; await this.onSession(null); }
  recordKey(type, id) {
    if (!core.types.includes(type) && type !== 'settings') throw new Error('Invalid record collection.');
    if (!/^[\w.-]{1,180}$/.test(id)) throw new Error('Invalid record ID.');
    return `${type}--${id}`;
  }
  async listRecords(since = null, knownMeta = {}) {
    await this.token(); const records = []; let cursor = null, snapshotTime = null;
    do {
      const structuredQuery = { from: [{ collectionId: 'records' }], limit: 300, orderBy: [{ field: { fieldPath: 'modifiedAt' }, direction: 'ASCENDING' }, { field: { fieldPath: '__name__' }, direction: 'ASCENDING' }] };
      if (since) structuredQuery.where = { fieldFilter: { field: { fieldPath: 'modifiedAt' }, op: 'GREATER_THAN', value: { timestampValue: since } } };
      if (cursor) structuredQuery.startAt = { values: [{ timestampValue: cursor.fields.modifiedAt.timestampValue }, { referenceValue: cursor.name }], before: false };
      const response = await this.request(`${this.documentsURL}/users/${this.session.uid}:runQuery`, { body: { structuredQuery, ...(snapshotTime ? { readTime: snapshotTime } : {}) }, token: true });
      if (!Array.isArray(response)) throw new Error('Invalid Firestore query response.');
      if (!snapshotTime) snapshotTime = response.find(r => r.readTime)?.readTime || null;
      const page = response.filter(r => r.document).map(r => r.document); records.push(...page);
      cursor = page.length === 300 ? page[page.length - 1] : null;
      if (records.length > 10000) throw new Error('Too many cloud records.');
    } while (cursor);
    const results = [];
    // Limit concurrency and preserve multi-part records without a Firestore 1 MiB overflow.
    for (let i = 0; i < records.length; i += 6) results.push(...await Promise.all(records.slice(i, i + 6).map(r => {
      const key = this.recordKey(r.fields.type.stringValue, r.fields.id.stringValue);
      return knownMeta[key]?.updateTime === r.updateTime ? { type: r.fields.type.stringValue, id: r.fields.id.stringValue, unchanged: true } : this.decodeRecord(r);
    })));
    return { records: results, readTime: snapshotTime };
  }
  async getRecord(type, id) {
    const key = this.recordKey(type, id);
    try { return await this.decodeRecord(await this.request(`${this.documentsURL}/users/${this.session.uid}/records/${key}`, { method: 'GET', token: true })); }
    catch (error) { if (error.status === 404) return null; throw error; }
  }
  async decodeRecord(document) {
    const fields = document.fields || {}; const type = fields.type?.stringValue, id = fields.id?.stringValue;
    this.recordKey(type, id);
    const chunks = (fields.chunks?.arrayValue?.values || []).map(v => v.stringValue);
    if (chunks.length > 80 || chunks.some(v => !/^[\w-]+$/.test(v))) throw new Error('Invalid cloud record chunks.');
    const deleted = fields.deleted?.booleanValue === true;
    let payload = fields.payload?.stringValue || '';
    if (chunks.length && !deleted) {
      payload = '';
      for (const key of chunks) {
        const chunk = await this.request(`${this.documentsURL}/users/${this.session.uid}/records/${this.recordKey(type, id)}/chunks/${key}`, { method: 'GET', token: true });
        payload += chunk.fields.payload.stringValue;
      }
    }
    let item = deleted ? null : JSON.parse(payload);
    if (type === 'providers' && item) {
      if (item.kind === 'compatible') item = null;
      else { item = { ...item }; delete item.apiKeyEnv; }
    }
    if (item) { if (type === 'settings') core.validateSettings(item); else core.validateEntity(type, item); }
    return { type, id, item, updateTime: document.updateTime, chunks, deleted };
  }
  async writeRecord(type, id, item, previous = null) {
    await this.token(); const key = this.recordKey(type, id);
    if (item) { if (type === 'settings') core.validateSettings(item); else core.validateEntity(type, item); }
    const payload = item === null ? '' : JSON.stringify(item);
    if (Buffer.byteLength(payload) > 6 * 1024 * 1024) throw new Error('Record exceeds 6 MB. Export the conversation and start a new one.');
    const name = `${this.documentPrefix}/records/${key}`, chunks = [], writes = [];
    if (Buffer.byteLength(payload) > 600000) {
      const generation = core.uid().replace(/-/g, '');
      // UTF-16 slicing may divide a surrogate pair. JSON encodes it and joining restores the original.
      for (let offset = 0, i = 0; offset < payload.length; offset += 180000, i++) {
        const chunkId = `${generation}-${i}`; chunks.push(chunkId);
        writes.push({ update: { name: `${name}/chunks/${chunkId}`, fields: { payload: { stringValue: payload.slice(offset, offset + 180000) } } }, currentDocument: { exists: false } });
      }
    }
    const fields = { type: { stringValue: type }, id: { stringValue: id }, deleted: { booleanValue: item === null }, payload: { stringValue: chunks.length ? '' : payload }, chunks: { arrayValue: { values: chunks.map(v => ({ stringValue: v })) } }, schemaVersion: { integerValue: '1' } };
    writes.push({ update: { name, fields }, updateTransforms: [{ fieldPath: 'modifiedAt', setToServerValue: 'REQUEST_TIME' }], currentDocument: previous?.updateTime ? { updateTime: previous.updateTime } : { exists: false } });
    for (const old of previous?.chunks || []) writes.push({ delete: `${name}/chunks/${old}` });
    const result = await this.request(`${this.documentsURL}:commit`, { body: { writes }, token: true });
    return { type, id, item, deleted: item === null, chunks, updateTime: result.writeResults[chunks.length].updateTime };
  }
}
module.exports = { Firebase, FirebaseError, validateConfig };
