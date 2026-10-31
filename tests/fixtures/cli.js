const fs = require('node:fs');
function writeCLI(file, source) {
  if (process.platform === 'win32') {
    fs.writeFileSync(file + '.js', source);
    fs.writeFileSync(file, '@echo off\r\n"' + process.execPath + '" "' + file + '.js" %*\r\n');
  } else fs.writeFileSync(file, source, {mode:0o755});
}
module.exports = {writeCLI};
