function httpsURL(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Use an HTTPS release URL without credentials.');
  return url;
}
function manifest(value, current) {
  if (!value || !/^\d+\.\d+\.\d+$/.test(value.version) || typeof value.url !== 'string') throw new Error('Invalid release manifest.');
  httpsURL(value.url);
  const available = value.version.split('.').map(Number), installed = current.split('.').map(Number);
  if (available.some(n => !Number.isSafeInteger(n))) throw new Error('Invalid release version.');
  let newer = false;
  for (let i = 0; i < 3; i++) if (available[i] !== installed[i]) { newer = available[i] > installed[i]; break; }
  return {newer, version: value.version, url: value.url};
}
async function check(url, current) {
  const response = await fetch(httpsURL(url), {signal: AbortSignal.timeout(10000), redirect: 'error'});
  if (!response.ok) throw new Error('Update check failed (HTTP ' + response.status + ').');
  let text = '', size = 0; const decoder = new TextDecoder();
  for await (const bytes of response.body) {
    size += bytes.length;
    if (size > 10000) throw new Error('Update manifest is too large.');
    text += decoder.decode(bytes, {stream: true});
  }
  return manifest(JSON.parse(text + decoder.decode()), current);
}
module.exports = {httpsURL, manifest, check};
