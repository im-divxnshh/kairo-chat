const fs = require('node:fs');
const path = require('node:path');
const env = require('../src/lib/env');
const { executable, runFile, spawnCLI } = require('../src/lib/providers');
const { validateConfig } = require('../src/lib/firebase');
const { validateWorkerURL } = require('../src/lib/r2');
const root = path.resolve(__dirname, '..');
async function run(file, args, options = {}) {
  const result = await runFile(file, args, { cwd: root, timeout: 60000, env: { ...process.env, NO_UPDATE_NOTIFIER: '1' }, ...options });
  if (result.code !== 0) {
    const output = (result.stderr || result.stdout).replace(/AIza[\w-]+|Bearer\s+\S+|eyJ[\w.-]+/g, '[redacted]').slice(-1800);
    throw new Error(output || 'Deployment command failed.');
  }
  return result.stdout;
}
function runInteractive(file, args) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return run(file, args);
  return new Promise((resolve, reject) => {
    const child = spawnCLI(file, args, { cwd: root, env: { ...process.env, NO_UPDATE_NOTIFIER: '1' }, stdio: 'inherit' });
    child.once('error', reject); child.once('close', code => code === 0 ? resolve() : reject(new Error('Wrangler failed. Run npx wrangler login, then retry npm run deploy:cloud.')));
  });
}
async function main() {
  env.loadEnv(process.env.KAIRO_ENV_FILE || path.join(root, '.env'));
  const config = validateConfig(env.firebaseConfig()), url = new URL(validateWorkerURL(process.env.KAIRO_R2_WORKER_URL));
  if (config.authEmulator || config.firestoreEmulator) throw new Error('Use production Firebase configuration for deployment.');
  const firebase = executable('firebase'); if (!firebase) throw new Error('Install Firebase CLI and run firebase login first.');
  const workerConfig = path.join(root, 'cloudflare/wrangler.toml'), text = fs.readFileSync(workerConfig, 'utf8');
  if (!/^binding\s*=\s*"BUCKET"$/m.test(text) || !/^bucket_name\s*=\s*"[^"\n]+"$/m.test(text)) throw new Error('Set the private R2 bucket with the BUCKET binding in cloudflare/wrangler.toml.');
  const configuredName = text.match(/^name\s*=\s*"([^"\n]+)"/m)?.[1];
  // Deploy to the existing workers.dev URL supplied by the user.
  const workerName = configuredName;
  if (!/^[a-z0-9-]+$/.test(workerName || '')) throw new Error('Set a valid Cloudflare Worker name.');
  console.log('Deploying firestore.rules to the Firebase project from .env…');
  await run(firebase, ['deploy', '--only', 'firestore:rules', '--project', config.projectId, '--non-interactive'], { env: { ...process.env, CI: 'true', NO_UPDATE_NOTIFIER: '1' } });
  console.log('Firestore rules deployed. Deploying the Worker to the configured existing URL…');
  const wrangler = executable('wrangler'), npx = executable('npx'); if (!wrangler && !npx) throw new Error('Install Wrangler or npm to deploy the Worker.');
  const command = wrangler || npx, prefix = wrangler ? [] : ['--yes', 'wrangler'];
  await runInteractive(command, [...prefix, 'deploy', '--config', workerConfig, '--name', workerName]);
  console.log('Worker deployed. Setting its Firebase project ID…');
  await run(command, [...prefix, 'secret', 'put', 'FIREBASE_PROJECT_ID', '--config', workerConfig, '--name', workerName], { input: config.projectId + '\n' });
  if (url.hostname.endsWith('.workers.dev') && url.hostname.split('.')[0] !== workerName) {
    url.hostname = [workerName, ...url.hostname.split('.').slice(1)].join('.');
    const envFile = process.env.KAIRO_ENV_FILE || path.join(root, '.env'), contents = fs.readFileSync(envFile, 'utf8');
    const line = 'KAIRO_R2_WORKER_URL=' + url.href.replace(/\/$/, '');
    fs.writeFileSync(envFile, /^KAIRO_R2_WORKER_URL=/m.test(contents) ? contents.replace(/^KAIRO_R2_WORKER_URL=.*$/m, line) : contents + '\n' + line + '\n', { mode: 0o600 });
    console.log('Updated .env to use the deployed kairo-chat Worker URL.');
  }
  console.log('Firebase rules and the R2 Worker are deployed. Run npm run verify:cloud -- --write-checks.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
