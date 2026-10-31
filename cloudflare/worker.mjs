const certURL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let cachedKeys = null, cacheExpires = 0, fetchingKeys = null;
function base64url(value) { const padded = value.replace(/-/g, '+').replace(/_/g, '/'); return Uint8Array.from(atob(padded), c => c.charCodeAt(0)); }
function json(value, status = 200) { return Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } }); }
export async function verifyFirebaseToken(token, projectId, { fetchImpl = fetch, now = Date.now(), keys } = {}) {
  if (!projectId || !token || token.length > 16384) throw new Error('Unauthorized');
  const parts = token.split('.'); if (parts.length !== 3) throw new Error('Unauthorized');
  const header = JSON.parse(new TextDecoder().decode(base64url(parts[0]))), claims = JSON.parse(new TextDecoder().decode(base64url(parts[1])));
  const seconds = Math.floor(now / 1000);
  if (header.alg !== 'RS256' || !header.kid || claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}` || !Number.isFinite(claims.exp) || claims.exp <= seconds || !Number.isFinite(claims.iat) || claims.iat > seconds + 30 || !Number.isFinite(claims.auth_time) || claims.auth_time > seconds + 30 || typeof claims.sub !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(claims.sub)) throw new Error('Unauthorized');
  if (!keys) {
    if (!cachedKeys || cacheExpires <= now) {
      if (!fetchingKeys) fetchingKeys = (async () => { const response = await fetchImpl(certURL); if (!response.ok) throw new Error('Identity verification unavailable'); const data = await response.json(); cachedKeys = data.keys; cacheExpires = now + 3600000; })();
      try { await fetchingKeys; } finally { fetchingKeys = null; }
    }
    keys = cachedKeys;
  }
  const jwk = keys?.find(key => key.kid === header.kid); if (!jwk) throw new Error('Unauthorized');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, base64url(parts[2]), new TextEncoder().encode(parts.slice(0, 2).join('.')))) throw new Error('Unauthorized');
  return claims.sub;
}
export async function handleRequest(request, env, { verify = verifyFirebaseToken } = {}) {
  const url = new URL(request.url);
  if (url.pathname === '/health' && request.method === 'GET') return json({ service: 'kairo-storage', firebaseConfigured: !!env.FIREBASE_PROJECT_ID, bucketConfigured: !!env.BUCKET }, env.FIREBASE_PROJECT_ID && env.BUCKET ? 200 : 503);
  if (!env.FIREBASE_PROJECT_ID || !env.BUCKET) return json({ error: 'Storage is not configured' }, 503);
  const match = url.pathname.match(/^\/v1\/objects\/(attachments|backups)\/([\w.-]{1,180})$/);
  if (!match || match[2] === '..' || match[2] === '.') return json({ error: 'Not found' }, 404);
  if (!['PUT', 'GET', 'HEAD', 'DELETE'].includes(request.method)) return json({ error: 'Method not allowed' }, 405);
  let uid;
  try { const authorization = request.headers.get('Authorization') || ''; if (!authorization.startsWith('Bearer ')) throw new Error(); uid = await verify(authorization.slice(7), env.FIREBASE_PROJECT_ID); }
  catch { return json({ error: 'Unauthorized' }, 401); }
  const key = `${uid}/${match[1]}/${match[2]}`;
  if (request.method === 'PUT') {
    const declaredSize = request.headers.get('Content-Length');
    const size = declaredSize === null ? NaN : Number(declaredSize);
    if (!request.body || !Number.isSafeInteger(size) || size < 0) return json({ error: 'Content-Length required' }, 411);
    if (size > 24 * 1024 * 1024) return json({ error: 'Object too large' }, 413);
    const contentType = request.headers.get('Content-Type') || 'application/octet-stream';
    if (!/^(text\/plain|application\/json|application\/octet-stream|image\/(png|jpeg|webp|gif))(?:;.*)?$/.test(contentType)) return json({ error: 'Unsupported content type' }, 415);
    const reader = request.body.getReader(), parts = []; let received = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      received += value.byteLength;
      if (received > 24 * 1024 * 1024) { await reader.cancel(); return json({ error: 'Object too large' }, 413); }
      if (received > size) { await reader.cancel(); return json({ error: 'Content-Length does not match body' }, 400); }
      parts.push(value);
    }
    if (received !== size) return json({ error: 'Content-Length does not match body' }, 400);
    const bytes = new Uint8Array(received); let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    const object = await env.BUCKET.put(key, bytes, { httpMetadata: { contentType }, customMetadata: { owner: uid } });
    return json({ objectKey: `${match[1]}/${match[2]}`, size, etag: object.etag }, 201);
  }
  if (request.method === 'DELETE') { await env.BUCKET.delete(key); return new Response(null, { status: 204 }); }
  const object = request.method === 'HEAD' ? await env.BUCKET.head(key) : await env.BUCKET.get(key);
  if (!object) return json({ error: 'Object not found' }, 404);
  const headers = new Headers({ 'ETag': object.httpEtag || object.etag, 'Content-Length': String(object.size), 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'attachment' });
  object.writeHttpMetadata(headers);
  return new Response(request.method === 'HEAD' ? null : object.body, { status: 200, headers });
}
export default { async fetch(request, env) { try { return await handleRequest(request, env); } catch { return json({ error: 'Storage request failed' }, 503); } } };
