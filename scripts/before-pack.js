const buildNative = require('./build-native');
const verifyBrand = require('./verify-brand');
module.exports = async context => {
  verifyBrand(context.packager?.projectDir);
  if (context.electronPlatformName !== 'darwin') return;
  const arch = typeof context.arch === 'string' ? context.arch : {1:'x64',3:'arm64',4:'universal'}[context.arch];
  if (!arch) throw new Error('Unsupported macOS package architecture.');
  await buildNative(arch);
};
