const test = require('node:test');
const assert = require('node:assert/strict');
const { createFirebaseMock, createBucket } = require('./fixtures/cloud');
const { verifyCloud } = require('../src/lib/cloud-verification');
const configuration = { firebase: { apiKey: 'test-public-key', projectId: 'demo-kairo' }, workerURL: 'https://storage.fixture.test', passphrase: 'a sufficiently long fixture passphrase' };
test('cloud verification exercises real clients and cleans up disposable users, records and R2 objects', async () => {
  const firebase = createFirebaseMock(), bucket = createBucket(), { handleRequest } = await import('../cloudflare/worker.mjs');
  const fetchImpl = (url, options) => String(url).startsWith(configuration.workerURL) ? handleRequest(new Request(url, options), { FIREBASE_PROJECT_ID: 'demo-kairo', BUCKET: bucket }, { verify: async token => { const uid = token.slice(14); if (!token.startsWith('fixture-token-') || ![...firebase.users.values()].some(user => user.localId === uid)) throw new Error('Unauthorized'); return uid; } }) : firebase.fetch(url, options);
  const report = await verifyCloud(configuration, { writeChecks: true, fetchImpl });
  assert.equal(report.passed, true, JSON.stringify(report.checks.filter(check => !check.passed)));
  assert.equal(report.fullVerification, true);
  assert.equal(firebase.users.size, 0); assert.equal(firebase.documents.size, 0); assert.equal(bucket.objects.size, 0);
  assert.ok(report.checks.some(check => check.name.includes('invalid record schemas')));
  assert.ok(!JSON.stringify(report).includes(configuration.passphrase));
  assert.ok(!JSON.stringify(report).includes('fixture-token'));
});
test('read-only verification does not create accounts and detects an incorrect Worker binding', async () => {
  const firebase = createFirebaseMock(), { handleRequest } = await import('../cloudflare/worker.mjs');
  const fetchImpl = (url, options) => String(url).startsWith(configuration.workerURL) ? handleRequest(new Request(url, options), { FIREBASE_PROJECT_ID: 'demo-kairo' }) : firebase.fetch(url, options);
  const report = await verifyCloud(configuration, { fetchImpl });
  assert.equal(report.passed, false); assert.equal(report.fullVerification, false);
  assert.equal(firebase.users.size, 0); assert.equal(firebase.documents.size, 0);
  assert.ok(report.checks.find(check => check.name.includes('binding')).error);
});
