const fs = require('node:fs');
const path = require('node:path');

function verifyBrand(root = path.resolve(__dirname, '..')) {
  const read = file => fs.readFileSync(path.join(root, file));
  function png(data, width, height, file) {
    if (data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
      data.readUInt32BE(16) !== width || data.readUInt32BE(20) !== height)
      throw new Error(`Invalid branding PNG: ${file}`);
  }
  for (const size of [16, 24, 32, 48, 64, 128, 256, 512, 1024]) {
    const file = `build/icon-${size}.png`;
    png(read(file), size, size, file);
  }
  png(read('src/assets/branding/icon.png'), 1024, 1024, 'app icon');
  png(read('build/dmg-background.png'), 900, 600, 'DMG background');
  png(read('build/dmg-background@2x.png'), 1800, 1200, 'Retina DMG background');
  const frameHashes = new Set();
  for (let index = 0; index < 32; index++) {
    const file = `src/assets/branding/frames/frame-${String(index).padStart(2, '0')}.png`;
    const data = read(file);
    png(data, 256, 256, file);
    frameHashes.add(require('node:crypto').createHash('sha256').update(data).digest('hex'));
  }
  if (frameHashes.size !== 32) throw new Error('Launcher animation needs 32 distinct frames.');

  const icns = read('build/icon.icns');
  if (icns.toString('ascii', 0, 4) !== 'icns' || icns.readUInt32BE(4) !== icns.length)
    throw new Error('Invalid macOS icon container.');
  let at = 8;
  const tags = new Map([['icp4', 16], ['icp5', 32], ['icp6', 64], ['ic07', 128],
    ['ic08', 256], ['ic09', 512], ['ic10', 1024], ['ic11', 32], ['ic12', 64], ['ic13', 256], ['ic14', 512]]);
  while (at < icns.length) {
    const tag = icns.toString('ascii', at, at + 4), size = tags.get(tag), length = icns.readUInt32BE(at + 4);
    if (!size || length < 32 || at + length > icns.length) throw new Error('Invalid ICNS representation.');
    png(icns.subarray(at + 8, at + length), size, size, tag);
    tags.delete(tag); at += length;
  }
  if (tags.size) throw new Error('Missing macOS icon sizes.');

  const ico = read('build/icon.ico'), sizes = [16, 24, 32, 48, 64, 128, 256];
  if (ico.readUInt16LE(0) !== 0 || ico.readUInt16LE(2) !== 1 || ico.readUInt16LE(4) !== sizes.length)
    throw new Error('Invalid Windows icon container.');
  sizes.forEach((size, index) => {
    const entry = 6 + index * 16, length = ico.readUInt32LE(entry + 8), offset = ico.readUInt32LE(entry + 12);
    if ((ico[entry] || 256) !== size || (ico[entry + 1] || 256) !== size || offset + length > ico.length)
      throw new Error('Invalid Windows icon size.');
    png(ico.subarray(offset, offset + length), size, size, 'Windows icon');
  });

  for (const [name, width, height] of [['sidebar', 164, 314], ['header', 150, 57]]) {
    const bmp = read(`build/installer-${name}.bmp`);
    if (bmp.toString('ascii', 0, 2) !== 'BM' || bmp.readUInt32LE(2) !== bmp.length ||
      bmp.readUInt32LE(10) !== 54 || bmp.readUInt32LE(14) !== 40 || bmp.readInt32LE(18) !== width ||
      bmp.readInt32LE(22) !== height || bmp.readUInt16LE(28) !== 24 ||
      bmp.length !== 54 + Math.ceil(width * 3 / 4) * 4 * height)
      throw new Error(`Invalid Windows installer ${name} artwork.`);
  }
  const guide = read('build/Start here.html').toString('utf8');
  if (guide.includes('{{MASCOT}}') || guide.includes('{{ICON}}') ||
    !guide.includes('<svg') || !guide.includes('data:image/png;base64,'))
    throw new Error('Generate the standalone animated setup guide with npm run build:brand.');
  return { frames: frameHashes.size, windowsSizes: sizes.length };
}

module.exports = verifyBrand;
if (require.main === module) {
  verifyBrand();
  console.log('Kairo branding validated: app icons, 32 motion frames, installer artwork and animated guide.');
}
