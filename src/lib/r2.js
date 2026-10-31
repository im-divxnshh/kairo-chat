const crypto = require('node:crypto');
const core = require('./core');
function validateWorkerURL(value) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || !['https:', 'http:'].includes(url.protocol)) throw new Error('Invalid R2 Worker URL.');
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('R2 Worker URL must use HTTPS.');
  return url.href.replace(/\/$/, '');
}
class R2Storage {
  constructor(url, firebase, { fetchImpl = globalThis.fetch } = {}) { this.url = validateWorkerURL(url); this.firebase = firebase; this.fetch = fetchImpl; this.cache = new Map(); this.cacheBytes = 0; }
  validateKey(key) { if (!/^(attachments|backups)\/[\w.-]{1,180}$/.test(key)) throw new Error('Invalid object reference.'); return key; }
  async request(key, { method = 'GET', data, contentType = 'application/octet-stream' } = {}) {
    this.validateKey(key); const token = await this.firebase.token();
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await this.fetch(`${this.url}/v1/objects/${key}`, { method, headers: { Authorization: `Bearer ${token}`, ...(data ? { 'Content-Type': contentType, 'Content-Length': String(data.byteLength) } : {}) }, ...(data ? { body: data } : {}), signal: controller.signal, redirect: 'error' });
      if (!response.ok) throw new Error(`R2 request failed (HTTP ${response.status}).${response.status === 401 ? ' Check Firebase project configuration on the Worker.' : ''}`);
      let buffer = null;
      if (method === 'GET') {
        if (Number(response.headers.get('Content-Length')) > 24 * 1024 * 1024) throw new Error('R2 object exceeds the download limit.');
        const chunks = []; let length = 0;
        for await (const chunk of response.body) {
          length += chunk.byteLength;
          if (length > 24 * 1024 * 1024) { controller.abort(); throw new Error('R2 object exceeds the download limit.'); }
          chunks.push(Buffer.from(chunk));
        }
        buffer = Buffer.concat(chunks, length);
      }
      return { buffer, etag: response.headers.get('etag'), size: Number(response.headers.get('content-length')), contentType: response.headers.get('content-type') };
    } catch (error) { if (controller.signal.aborted) throw new Error('R2 request timed out.'); throw error; }
    finally { clearTimeout(timeout); }
  }
  remember(key, buffer) {
    if (this.cache.has(key)) this.cacheBytes -= this.cache.get(key).length;
    this.cache.delete(key); this.cache.set(key, buffer); this.cacheBytes += buffer.length;
    while (this.cacheBytes > 24 * 1024 * 1024) { const oldest = this.cache.keys().next().value; this.cacheBytes -= this.cache.get(oldest).length; this.cache.delete(oldest); }
  }
  async get(key) { this.validateKey(key); if (this.cache.has(key)) { const value = this.cache.get(key); this.remember(key, value); return value; } const { buffer } = await this.request(key); this.remember(key, buffer); return buffer; }
  async head(key) { return this.request(key, { method: 'HEAD' }); }
  async delete(key) { await this.request(key, { method: 'DELETE' }); if (this.cache.has(key)) { this.cacheBytes -= this.cache.get(key).length; this.cache.delete(key); } }
  async uploadAttachment(attachment) {
    if (attachment.objectKey) { this.validateKey(attachment.objectKey); return attachment; }
    if (!/^[\w-]{1,180}$/.test(attachment.id)) throw new Error('Invalid attachment ID.');
    const key = `attachments/${attachment.id}`;
    const image = attachment.kind === 'image';
    const buffer = image ? Buffer.from(attachment.dataURL.split(',')[1], 'base64') : Buffer.from(attachment.content || '', 'utf8');
    if (buffer.length > 20 * 1024 * 1024) throw new Error('Attachment exceeds 20 MB.');
    const contentType = image ? attachment.dataURL.split(';')[0].slice(5) : 'text/plain; charset=utf-8';
    if (!this.cache.has(key)) await this.request(key, { method: 'PUT', data: buffer, contentType });
    this.remember(key, buffer);
    return { id: attachment.id, name: attachment.name, size: buffer.length, kind: attachment.kind, language: attachment.language || '', sensitive: !!attachment.sensitive, contentType, objectKey: key };
  }
  async hydrate(attachment) {
    if (!attachment.objectKey) return attachment;
    const buffer = await this.get(attachment.objectKey);
    return attachment.kind === 'image' ? { ...attachment, dataURL: `data:${attachment.contentType};base64,${buffer.toString('base64')}` } : { ...attachment, content: buffer.toString('utf8') };
  }
  async backup(state, passphrase) {
    if (!passphrase || passphrase.length < 16) throw new Error('Set KAIRO_BACKUP_PASSPHRASE to at least 16 characters.');
    const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
    const key = await new Promise((resolve, reject) => crypto.scrypt(passphrase, salt, 32, (error, result) => error ? reject(error) : resolve(result)));
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv), data = Buffer.concat([cipher.update(JSON.stringify(state)), cipher.final()]);
    const payload = Buffer.from(JSON.stringify({ format: 'kairo-encrypted-backup', version: 1, salt: salt.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') }));
    if (payload.length > 24 * 1024 * 1024) throw new Error('Backup exceeds 24 MB. Export collections separately.');
    const id = core.uid(), objectKey = `backups/${id}`; await this.request(objectKey, { method: 'PUT', data: payload, contentType: 'application/json' });
    return { id, objectKey, name: new Date().toISOString(), size: payload.length, encrypted: true, createdAt: Date.now() };
  }
  async restore(objectKey, passphrase) {
    const envelope = JSON.parse((await this.get(objectKey)).toString('utf8'));
    if (typeof envelope.format !== 'string' || !/^[a-z]+-encrypted-backup$/.test(envelope.format) || envelope.version !== 1) throw new Error('Unsupported encrypted backup.');
    const salt = Buffer.from(envelope.salt, 'base64'), iv = Buffer.from(envelope.iv, 'base64'), tag = Buffer.from(envelope.tag, 'base64');
    if (salt.length !== 16 || iv.length !== 12 || tag.length !== 16) throw new Error('Invalid backup encryption metadata.');
    const key = await new Promise((resolve, reject) => crypto.scrypt(passphrase, salt, 32, (error, result) => error ? reject(error) : resolve(result)));
    try { const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv); decipher.setAuthTag(tag); return core.validateState(JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]).toString('utf8'))); }
    catch { throw new Error('Backup could not be decrypted. Check the passphrase and file integrity.'); }
  }
}
module.exports = { R2Storage, validateWorkerURL };
