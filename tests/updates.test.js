const test = require('node:test'), assert = require('node:assert/strict');
const U = require('../src/lib/updates');
test('update versions compare numerically and unsafe release locations are rejected', () => {
  const release = version => ({version, url:'https://releases.example.test/kairo.dmg'});
  assert.equal(U.manifest(release('0.10.0'),'0.2.9').newer,true);
  assert.equal(U.manifest(release('0.2.0'),'0.2.0').newer,false);
  assert.equal(U.manifest(release('0.1.99'),'0.2.0').newer,false);
  for (const url of ['http://example.test/app','https://user:pass@example.test/app','file:///tmp/app','javascript:alert(1)']) assert.throws(()=>U.manifest({version:'0.3.0',url},'0.2.0'));
  for (const version of ['latest','0.3','0.3.0-beta','999999999999999999.0.0']) assert.throws(()=>U.manifest(release(version),'0.2.0'));
});
test('update reader checks HTTP errors, bounded bytes and malformed manifests', async () => {
  const original = global.fetch;
  try {
    global.fetch = async (_url, options) => { assert.equal(options.redirect,'error'); return new Response(JSON.stringify({version:'1.0.0',url:'https://example.test/app'})); };
    assert.equal((await U.check('https://example.test/manifest','0.2.0')).newer,true);
    global.fetch = async()=>new Response('offline',{status:503}); await assert.rejects(U.check('https://example.test/manifest','0.2.0'),/503/);
    global.fetch = async()=>new Response(' '.repeat(10001)); await assert.rejects(U.check('https://example.test/manifest','0.2.0'),/too large/);
    global.fetch = async()=>new Response('{'); await assert.rejects(U.check('https://example.test/manifest','0.2.0'),SyntaxError);
  } finally {global.fetch = original;}
});
