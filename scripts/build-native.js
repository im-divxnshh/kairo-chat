const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { executable, runFile } = require('../src/lib/providers');
async function buildNative(arch = process.arch) {
  if (process.platform !== 'darwin') return;
  const compiler = executable('swiftc'); if (!compiler) throw new Error('Install Xcode command line tools to build native PDF support.');
  const root = path.resolve(__dirname, '..'), cacheKey = crypto.createHash('sha256').update(root).digest('hex').slice(0, 12);
  const cache = path.join(root, '.native-cache', 'native-' + cacheKey); fs.mkdirSync(cache, { recursive: true });
  for (const name of ['pdf','speech']) {
    const output = path.join(root,'src/native/kairo-' + name), arches = arch === 'universal' ? ['x64','arm64'] : [arch];
    for (const target of arches) {
      if (!['x64','arm64'].includes(target)) throw new Error('Unsupported macOS architecture: ' + target);
      const args = ['-module-cache-path',cache,'-target',(target === 'x64' ? 'x86_64' : 'arm64') + '-apple-macosx12.0',path.join(root,'src/native/' + name + '.swift'),'-o',arches.length > 1 ? output + '-' + target : output];
      if (name === 'speech') args.push('-Xlinker','-sectcreate','-Xlinker','__TEXT','-Xlinker','__info_plist','-Xlinker',path.join(root,'src/native/speech-info.plist'));
      const result = await runFile(compiler,args,{timeout:300000}); if (result.code) throw new Error(result.stderr);
    }
    if (arches.length > 1) {
      const result = await runFile('/usr/bin/lipo',['-create',...arches.map(target=>output+'-'+target),'-output',output]); if (result.code) throw new Error(result.stderr);
      for (const target of arches) fs.unlinkSync(output+'-'+target);
    }
  }
  console.log('Native PDF and speech helpers built for ' + arch + '.');
}
module.exports = buildNative;
if (require.main === module) buildNative(process.argv[2] || process.arch).catch(error => { console.error(error.message); process.exitCode = 1; });
