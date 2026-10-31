const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const core = require('./core');

function atomicJSON(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.tmp', JSON.stringify(value), { mode: 0o600 }); fs.renameSync(file + '.tmp', file);
}
class CloudStore {
  constructor(directory, firebase, onChange = () => {}) {
    if (!firebase.publicSession()) throw new Error('Sign in before opening cloud storage.');
    this.firebase = firebase; this.onChange = onChange; this.disposed = false; this.syncing = null;
    this.uid = firebase.publicSession().uid;
    this.directory = path.join(directory, 'accounts', crypto.createHash('sha256').update(this.uid).digest('hex').slice(0, 24));
    this.file = path.join(this.directory, 'cache.json');
    this.state = core.initialState(); this.meta = {}; this.pending = {}; this.conflicts = {}; this.lastError = ''; this.lastSync = null; this.cloudCursor = null;
    if (fs.existsSync(this.file)) {
      const cache = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if ((cache.cacheVersion || 1) > 2) throw new Error('This cache was created by a newer version of Kairo. Update the app before opening it.');
      this.state = core.validateState(cache.state);
      this.meta = cache.meta || {}; this.pending = cache.pending || {}; this.conflicts = cache.conflicts || {};
      this.cloudCursor = cache.cloudCursor || null;
      for (const [key, change] of Object.entries(this.pending)) if (change.type === 'providers') {
        if (change.item?.kind === 'compatible') { delete this.pending[key]; delete this.conflicts[key]; }
        else if (change.item) delete change.item.apiKeyEnv;
      }
    }
  }
  key(type, id) { return this.firebase.recordKey(type, id); }
  persist() { if (!this.disposed) atomicJSON(this.file, { cacheVersion: 2, state: this.state, meta: this.meta, pending: this.pending, conflicts: this.conflicts, cloudCursor: this.cloudCursor }); }
  snapshot() { return structuredClone(this.state); }
  status() { return { pending: Object.keys(this.pending).length, syncing: !!this.syncing, conflicts: Object.values(this.conflicts).map(c => ({ type: c.type, id: c.id, title: c.local?.title || c.local?.name || c.id })), lastError: this.lastError, lastSync: this.lastSync }; }
  changed() { this.state.revision++; this.persist(); this.onChange(this.snapshot(), this.status()); }
  apply(type, id, item) {
    if (type === 'settings') { if (item) this.state.settings = core.validateSettings(item); return; }
    this.state[type] = this.state[type].filter(x => x.id !== id);
    if (type === 'providers' && item?.kind === 'compatible') return;
    if (type === 'providers' && item) { item = { ...item }; delete item.apiKeyEnv; }
    if (item) this.state[type].push(item);
  }
  upsert(type, item, expectedRevision) {
    core.validateEntity(type, item); if (type === 'conversations' && item.temporary) throw new Error('Temporary chats stay in memory.');
    const old = this.state[type].find(x => x.id === item.id);
    if (expectedRevision !== undefined && old && (old._revision || 0) !== expectedRevision) throw new Error('This record changed. Reopen it before saving.');
    const value = { ...item, _revision: (old?._revision || 0) + 1, updatedAt: Date.now() };
    this.queue(type, item.id, value); return structuredClone(value);
  }
  remove(type, id) { if (!core.types.includes(type)) throw new Error('Invalid collection.'); this.queue(type, id, null); }
  settings(value) { const settings = core.validateSettings(value); this.queue('settings', 'global', settings); return settings; }
  queue(type, id, item) {
    if (this.disposed) throw new Error('Account storage is closed.');
    const key = this.key(type, id);
    if (this.conflicts[key]) throw new Error('Resolve this record’s sync conflict before editing.');
    if (item && Buffer.byteLength(JSON.stringify(item)) > 6 * 1024 * 1024) throw new Error('Record exceeds the 6 MB limit.');
    this.apply(type, id, item);
    this.pending[key] = { type, id, item: structuredClone(item), base: this.pending[key]?.base || this.meta[key] || null, nonce: core.uid() };
    this.changed();
  }
  async sync() {
    if (this.disposed) return; if (this.syncing) return this.syncing;
    this.syncing = this.performSync(); this.onChange(this.snapshot(), this.status());
    try { return await this.syncing; } finally { this.syncing = null; if (!this.disposed) { this.persist(); this.onChange(this.snapshot(), this.status()); } }
  }
  async performSync() {
    this.lastError = '';
    let remoteChanged = false;
    try {
      for (const [key, pending] of Object.entries(this.pending)) {
        if (this.disposed) return; if (this.conflicts[key]) continue;
        try {
          const saved = await this.firebase.writeRecord(pending.type, pending.id, pending.item, pending.base);
          if (this.disposed) return; this.meta[key] = { updateTime: saved.updateTime, chunks: saved.chunks };
          if (this.pending[key]?.nonce === pending.nonce) delete this.pending[key]; else if (this.pending[key]) this.pending[key].base = this.meta[key];
          this.persist();
        } catch (error) {
          if (['FAILED_PRECONDITION', 'ABORTED', 'ALREADY_EXISTS'].includes(error.code)) {
            const remote = await this.firebase.getRecord(pending.type, pending.id);
            if (this.disposed) return;
            this.conflicts[key] = { type: pending.type, id: pending.id, local: this.pending[key]?.item, remote };
          } else throw error;
        }
      }
      const query = await this.firebase.listRecords(this.cloudCursor, this.meta); if (this.disposed) return;
      const records = query.records;
      for (const r of records) {
        if (r.unchanged) continue;
        const key = this.key(r.type, r.id); if (this.pending[key] || this.conflicts[key]) continue;
        this.apply(r.type, r.id, r.item); this.meta[key] = { updateTime: r.updateTime, chunks: r.chunks };
        remoteChanged = true;
      }
      this.cloudCursor = query.readTime || this.cloudCursor;
      // Seed only once, after a successful empty cloud read.
      if (!records.length && !Object.keys(this.meta).length && !Object.keys(this.pending).length) {
        for (const provider of this.state.providers) this.queue('providers', provider.id, provider);
        for (const prompt of this.state.prompts) this.queue('prompts', prompt.id, prompt);
        this.queue('settings', 'global', this.state.settings);
      }
      this.lastSync = Date.now(); if (remoteChanged) this.changed(); else this.persist();
    } catch (error) { this.lastError = error.message; this.persist(); }
  }
  resolve(type, id, choice) {
    const key = this.key(type, id), conflict = this.conflicts[key]; if (!conflict) throw new Error('Conflict no longer exists.');
    if (!['local', 'remote'].includes(choice)) throw new Error('Choose local or cloud version.');
    if (choice === 'remote') { this.apply(type, id, conflict.remote?.item || null); delete this.pending[key]; }
    else { this.pending[key] = { type, id, item: conflict.local, base: conflict.remote ? { updateTime: conflict.remote.updateTime, chunks: conflict.remote.chunks } : null, nonce: core.uid() }; }
    if (conflict.remote) this.meta[key] = { updateTime: conflict.remote.updateTime, chunks: conflict.remote.chunks }; else delete this.meta[key];
    delete this.conflicts[key]; this.changed();
  }
  backup() {
    const dir = path.join(this.directory, 'backups'), file = path.join(dir, `kairo-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    atomicJSON(file, this.snapshot());
    const files = fs.readdirSync(dir).filter(n => /^kairo-.*\.json$/.test(n)).sort();
    for (const old of files.slice(0, -this.state.settings.backupRetention)) fs.unlinkSync(path.join(dir, old));
    return file;
  }
  import(input) {
    const state = core.validateState(input);
    // Merge by ID; imported records still use preconditions and participate in conflicts.
    for (const type of core.types) for (const item of state[type]) this.queue(type, item.id, item);
    this.settings(state.settings);
  }
  close() { this.persist(); this.disposed = true; }
}
module.exports = { CloudStore, atomicJSON };
