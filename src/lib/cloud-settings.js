const fs = require('node:fs');
const path = require('node:path');
const { validateConfig } = require('./firebase');
const { validateWorkerURL } = require('./r2');
const { atomicJSON } = require('./cloud-store');

function validateSettings(input) {
  if (!input || typeof input !== 'object') throw new Error('Enter your backend settings.');
  const firebase = validateConfig(input.firebase);
  const r2WorkerUrl = String(input.r2WorkerUrl || '').trim();
  const backupPassphrase = String(input.backupPassphrase || '');
  if (backupPassphrase && (backupPassphrase.length < 16 || backupPassphrase.length > 4096)) throw new Error('Use a backup passphrase between 16 and 4096 characters.');
  if (firebase.apiKey.length > 4096 || firebase.authDomain.length > 512 || firebase.appId.length > 512 || r2WorkerUrl.length > 2048) throw new Error('Backend settings are too long.');
  return { firebase, r2WorkerUrl: r2WorkerUrl ? validateWorkerURL(r2WorkerUrl) : '', backupPassphrase };
}

class CloudSettings {
  constructor(directory, { encryptionAvailable = () => false, encrypt, decrypt } = {}) {
    this.file = path.join(directory, 'cloud-settings.json');
    this.encryptionAvailable = encryptionAvailable; this.encrypt = encrypt; this.decrypt = decrypt;
  }
  load() {
    if (!fs.existsSync(this.file)) return null;
    if (fs.statSync(this.file).size > 65536) throw new Error('Saved backend settings are too large.');
    const saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    if (saved.version !== 1) throw new Error('Unsupported backend settings version.');
    if (saved.encrypted) {
      if (!this.encryptionAvailable()) throw new Error('Unlock your operating system credential storage to load backend settings.');
      return validateSettings(JSON.parse(this.decrypt(Buffer.from(saved.data, 'base64'))));
    }
    if (saved.settings?.backupPassphrase) throw new Error('Backup passphrases must use operating system encryption.');
    return validateSettings(saved.settings);
  }
  save(input) {
    const settings = validateSettings(input), encrypted = this.encryptionAvailable();
    if (settings.backupPassphrase && !encrypted) throw new Error('Operating system secure storage is unavailable. Leave the backup passphrase empty to save your Firebase and R2 settings.');
    const saved = encrypted ? { version: 1, encrypted: true, data: this.encrypt(JSON.stringify(settings)).toString('base64') } : { version: 1, encrypted: false, settings };
    atomicJSON(this.file, saved);
    return settings;
  }
}

function applySettings(settings, env = process.env) {
  const names = { apiKey: 'KAIRO_FIREBASE_API_KEY', projectId: 'KAIRO_FIREBASE_PROJECT_ID', authDomain: 'KAIRO_FIREBASE_AUTH_DOMAIN', appId: 'KAIRO_FIREBASE_APP_ID', authEmulator: 'KAIRO_FIREBASE_AUTH_EMULATOR', firestoreEmulator: 'KAIRO_FIREBASE_FIRESTORE_EMULATOR' };
  for (const [key, name] of Object.entries(names)) env[name] = settings.firebase[key];
  env.KAIRO_R2_WORKER_URL = settings.r2WorkerUrl;
  if (settings.backupPassphrase) env.KAIRO_BACKUP_PASSPHRASE = settings.backupPassphrase;
  else delete env.KAIRO_BACKUP_PASSPHRASE;
}

module.exports = { CloudSettings, validateSettings, applySettings };
