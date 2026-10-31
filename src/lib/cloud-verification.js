const crypto = require('node:crypto');
const core = require('./core');
const { Firebase, validateConfig } = require('./firebase');
const { R2Storage, validateWorkerURL } = require('./r2');

async function verifyCloud({ firebase: input, workerURL, passphrase }, { writeChecks = false, fetchImpl = globalThis.fetch, onCheck = () => {} } = {}) {
  const checks = [], accounts = [], records = [], objects = [];
  const check = async (name, action) => {
    try { await action(); checks.push({ name, passed: true }); }
    catch (error) { checks.push({ name, passed: false, error: error.code && /^[A-Z_0-9]+$/.test(error.code) ? error.code : error.cause?.code || error.name || 'FAILED' }); }
    onCheck(checks[checks.length - 1]); return checks[checks.length - 1].passed;
  };
  const expect = (condition, code) => { if (!condition) { const error = new Error(code); error.code = code; throw error; } };
  const configOK = await check('Firebase and R2 configuration', () => {
    validateConfig(input); validateWorkerURL(workerURL);
    expect(!input.authEmulator && !input.firestoreEmulator, 'USE_PRODUCTION_CONFIGURATION');
    expect(typeof passphrase === 'string' && passphrase.length >= 16, 'BACKUP_PASSPHRASE_TOO_SHORT');
  });
  if (!configOK) return { mode: writeChecks ? 'live-write' : 'read-only', passed: false, checks };
  const url = validateWorkerURL(workerURL), firebase = new Firebase(input, { fetchImpl });
  await check('Worker health and private bucket binding', async () => {
    const response = await fetchImpl(url + '/health', { signal: AbortSignal.timeout(10000), redirect: 'error' });
    expect(response.status === 200, 'WORKER_NOT_READY');
    let body; try { body = await response.json(); } catch { expect(false, 'WORKER_NOT_KAIRO_STORAGE_API'); }
    expect(body.service === 'kairo-storage' && body.firebaseConfigured === true && body.bucketConfigured === true, 'WORKER_CONFIGURATION_MISMATCH');
  });
  await check('R2 rejects unauthenticated requests', async () => {
    const response = await fetchImpl(url + '/v1/objects/attachments/kairo-verification', { method: 'HEAD', signal: AbortSignal.timeout(10000), redirect: 'error' });
    expect(response.status === 401, 'R2_EXPECTED_401_GOT_' + response.status);
  });
  const authOK = await check('Firebase API key and Email/Password authentication', async () => {
    try {
      await firebase.request(firebase.authURL('signInWithPassword'), { body: { email: `kairo-check-${crypto.randomUUID()}@example.invalid`, password: crypto.randomBytes(24).toString('hex'), returnSecureToken: true } });
      throw new Error('Unexpected account lookup success.');
    } catch (error) { expect(['INVALID_LOGIN_CREDENTIALS', 'EMAIL_NOT_FOUND', 'INVALID_PASSWORD'].includes(error.code), error.code || 'FIREBASE_AUTH_UNAVAILABLE'); }
  });
  if (!writeChecks || !authOK) return { mode: writeChecks ? 'live-write' : 'read-only', passed: checks.every(c => c.passed), fullVerification: false, checks };

  const password = crypto.randomBytes(24).toString('hex'), runId = crypto.randomUUID();
  try {
    const alice = new Firebase(input, { fetchImpl }), bob = new Firebase(input, { fetchImpl }); accounts.push(alice, bob);
    const accountsOK = await check('Disposable Firebase account registration and sign-in', async () => {
      await alice.authenticate('signUp', `kairo-check-${runId}-a@example.invalid`, password);
      await bob.authenticate('signUp', `kairo-check-${runId}-b@example.invalid`, password);
      await alice.authenticate('signInWithPassword', alice.publicSession().email, password);
      expect(alice.publicSession().uid !== bob.publicSession().uid, 'ACCOUNT_ISOLATION_FAILED');
    });
    if (!accountsOK) return { mode: 'live-write', passed: false, fullVerification: false, checks };
    await check('Firebase token refresh and account lookup', async () => { await alice.refresh(); const user = await alice.lookup(); expect(!!user.uid, 'TOKEN_REFRESH_FAILED'); });
    const item = { id: runId, title: 'Disposable Kairo verification', content: 'Private test text 🌍', projectId: '' };
    records.push({ account: alice, type: 'knowledge', id: item.id });
    let saved;
    const recordOK = await check('Firestore private record write and read', async () => { saved = await alice.writeRecord('knowledge', item.id, item); const read = await alice.getRecord('knowledge', item.id); expect(read?.item?.content === item.content, 'FIRESTORE_ROUND_TRIP_FAILED'); });
    await check('Firestore rejects cross-account reads', async () => {
      let denied = false;
      try { await bob.request(`${bob.documentsURL}/users/${alice.publicSession().uid}/records/knowledge--${item.id}`, { method: 'GET', token: true }); }
      catch (error) { denied = error.status === 403; }
      expect(denied, 'FIRESTORE_OWNER_RULES_NOT_ENFORCED');
    });
    await check('Firestore rejects anonymous reads', async () => {
      const response = await fetchImpl(`${alice.documentsURL}/users/${alice.publicSession().uid}/records/knowledge--${item.id}`, { signal: AbortSignal.timeout(10000), redirect: 'error' });
      expect([401,403].includes(response.status), 'FIRESTORE_ANONYMOUS_READ_ALLOWED');
    });
    if (recordOK) await check('Firestore optimistic concurrency preconditions', async () => {
      await alice.writeRecord('knowledge', item.id, { ...item, title: 'Updated verification' }, saved);
      let conflict = false; try { await alice.writeRecord('knowledge', item.id, item, saved); } catch (error) { conflict = ['FAILED_PRECONDITION','ABORTED'].includes(error.code); }
      expect(conflict, 'FIRESTORE_PRECONDITIONS_NOT_ENFORCED');
    });
    await check('Firestore rejects invalid record schemas', async () => {
      records.push({ account: alice, type: 'knowledge', id: runId + '-invalid', skipDecode: true });
      let denied = false;
      try { await alice.request(`${alice.documentsURL}:commit`, { token: true, body: { writes: [{ update: { name: `${alice.documentPrefix}/records/knowledge--${runId}-invalid`, fields: { payload: { stringValue: 'invalid' } } } }] } }); }
      catch (error) { denied = error.status === 403; }
      expect(denied, 'FIRESTORE_SCHEMA_RULES_NOT_ENFORCED');
    });
    const r2 = new R2Storage(url, alice, { fetchImpl }), other = new R2Storage(url, bob, { fetchImpl });
    const attachment = { id: runId, name: 'kairo-verification.txt', kind: 'text', content: 'Private R2 round trip 🌍' };
    objects.push({ storage: r2, key: 'attachments/' + runId }); let reference;
    const attachmentOK = await check('R2 upload, metadata and uncached download', async () => {
      reference = await r2.uploadAttachment(attachment);
      const fresh = new R2Storage(url, alice, { fetchImpl }), restored = await fresh.hydrate(reference), head = await fresh.head(reference.objectKey);
      expect(restored.content === attachment.content && head.size === Buffer.byteLength(attachment.content), 'R2_ROUND_TRIP_FAILED');
    });
    if (attachmentOK) await check('R2 rejects cross-account object access', async () => {
      let denied = false; try { await other.get(reference.objectKey); } catch (error) { denied = /HTTP 404/.test(error.message); }
      expect(denied, 'R2_OWNER_ISOLATION_FAILED');
    });
    await check('Encrypted R2 backup and restore', async () => {
      const state = core.initialState(); state.memories.push({ id: runId, title: 'Round trip', content: 'Private backup text' });
      const backup = await r2.backup(state, passphrase); objects.push({ storage: r2, key: backup.objectKey });
      const restored = await new R2Storage(url, alice, { fetchImpl }).restore(backup.objectKey, passphrase);
      expect(restored.memories[0]?.content === 'Private backup text', 'BACKUP_RESTORE_FAILED');
      let wrongPasswordRejected = false; try { await r2.restore(backup.objectKey, passphrase + '-wrong'); } catch { wrongPasswordRejected = true; }
      expect(wrongPasswordRejected, 'BACKUP_AUTHENTICATION_FAILED');
    });
  } finally {
    for (const object of objects) await check('Clean up disposable R2 object', () => object.storage.delete(object.key));
    for (const record of records) if (record.account.publicSession()) await check('Clean up disposable Firestore record', async () => {
      const value = record.skipDecode ? null : await record.account.getRecord(record.type, record.id);
      const base = `${record.account.documentsURL}/users/${record.account.publicSession().uid}/records/${record.account.recordKey(record.type, record.id)}`;
      for (const chunk of value?.chunks || []) await record.account.request(base + '/chunks/' + chunk, { method: 'DELETE', token: true });
      try { await record.account.request(base, { method: 'DELETE', token: true }); } catch (error) { if (error.status !== 404) throw error; }
    });
    for (const account of accounts) if (account.publicSession()?.uid) await check('Clean up disposable Firebase account', async () => { await account.request(account.authURL('delete'), { body: { idToken: await account.token() } }); await account.signOut(); });
  }
  return { mode: 'live-write', passed: checks.every(c => c.passed), fullVerification: checks.every(c => c.passed), checks };
}
module.exports = { verifyCloud };
