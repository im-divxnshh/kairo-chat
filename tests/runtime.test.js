const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const R = require('../src/lib/runtime'), C = require('../src/lib/core'), K = require('../src/lib/knowledge');
test('project creation refuses traversal and existing folders; storage relocation preserves queued edits', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'kairo-runtime-'));
  try {
    const project = R.createProject(base, 'My project'); assert.ok(fs.statSync(project).isDirectory());
    for (const name of ['../escape', 'a/b', 'CON', 'trailing.']) assert.throws(() => R.createProject(base, name));
    assert.throws(() => R.createProject(base, 'My project'));
    const source = path.join(base, 'source'), parent = path.join(base, 'destination'); fs.mkdirSync(source); fs.mkdirSync(parent); fs.writeFileSync(path.join(source, 'cache.json'), '{"pending":true}');
    const destination = R.copyStorage(source, parent); assert.equal(fs.readFileSync(path.join(destination, 'cache.json'), 'utf8'), '{"pending":true}'); assert.ok(fs.existsSync(path.join(source, 'cache.json')));
    assert.throws(() => R.copyStorage(source, source)); assert.throws(() => R.copyStorage(source, parent));
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});
test('reviewed merge resolution rejects stale edits, retains a backup and refuses remaining conflict markers', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'kairo-resolution-')), original = '<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> branch\n';
  try {
    fs.writeFileSync(path.join(base, 'file.txt'), original); const file = R.conflictFiles(base, 'file.txt')[0];
    assert.throws(() => R.applyResolution(base, { ...file, content: original }), /markers/);
    assert.throws(() => R.applyResolution(base, { ...file, hash: 'stale', content: 'resolved\n' }), /changed/);
    const result = R.applyResolution(base, { ...file, content: 'resolved\n' }); assert.equal(fs.readFileSync(path.join(base, 'file.txt'), 'utf8'), 'resolved\n'); assert.equal(fs.readFileSync(path.join(base, result.backup), 'utf8'), original);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});
test('missed schedule recovery advances from its original cadence and backup timing respects settings', () => {
  const schedule = { intervalMinutes: 1, nextRunAt: 1000 }, next = R.nextSchedule(schedule, 181000);
  assert.equal(next.nextRunAt, 241000); assert.equal(next.missedRuns, 3); assert.equal(R.backupDue({ backups: true, backupMinutes: 1 }, 1000, 61000), true); assert.equal(R.backupDue({ backups: false, backupMinutes: 1 }, 1000, 61000), false);
});
test('semantic search maps only returned scoped IDs and refuses fabricated results', () => {
  const state = C.initialState(); state.knowledge.push({ id: 'a', title: 'Authentication', content: 'Logging in with your account', projectId: 'one' }, { id: 'b', title: 'Other project', content: 'Private material', projectId: 'two' });
  const candidates = K.candidates(state, 'sign in', { projectId: 'one', type: 'knowledge' }); assert.equal(candidates.length, 1); assert.ok(K.searchPrompt('sign in', candidates).includes('Logging in'));
  assert.equal(K.parseResults('["0"]', candidates)[0].id, 'a'); assert.throws(() => K.parseResults('["not-a-real-id"]', candidates));
  assert.equal(C.layoutSettings(C.defaults, 'review').splitView, true); state.runs.push({ status: 'failed', projectId: 'one', error: 'Failure' }); assert.ok(C.suggestions(state, 'one')[0][2].includes('Failure'));
});
