const path = require('node:path'), fs = require('node:fs'), os = require('node:os');
const { executable, runFile, providerEnvironment } = require('./providers');
async function extract(file) {
  const native = path.join(__dirname, '../native/kairo-pdf').replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep), pdftotext = executable('pdftotext', process.env.KAIRO_PDFTOTEXT_PATH || '');
  let command, args;
  if (process.platform === 'darwin' && fs.existsSync(native)) { command = native; args = [file]; }
  else if (pdftotext) { command = pdftotext; args = ['-enc','UTF-8','-layout',file,'-']; }
  else if (process.platform === 'darwin') {
    command = executable('swift'); if (!command) throw new Error('Build the bundled PDF helper or install pdftotext.');
    const cache = path.join(os.tmpdir(), 'kairo-swift-cache'); fs.mkdirSync(cache, { recursive: true });
    args = ['-module-cache-path', cache, path.join(__dirname, '../native/pdf.swift'), file];
  } else throw new Error('Install pdftotext (Poppler) to extract PDFs on this platform.');
  const result = await runFile(command, args, { timeout: 60000, maxOutput: 4 * 1024 * 1024, env: providerEnvironment({kind:'claude'}) });
  if (result.code !== 0) throw new Error(result.stderr.slice(-600) || 'PDF text extraction failed.');
  if (!result.stdout.trim()) throw new Error('No text found in this PDF. Attach page screenshots for visual analysis.');
  return result.stdout.slice(0, 800000);
}
module.exports = { extract };
