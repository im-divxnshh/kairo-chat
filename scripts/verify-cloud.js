const fs = require('node:fs');
const path = require('node:path');
const environment = require('../src/lib/env');
const { verifyCloud } = require('../src/lib/cloud-verification');
async function main() {
  environment.loadEnv(process.env.KAIRO_ENV_FILE || path.join(__dirname, '../.env'));
  const writeChecks = process.argv.includes('--write-checks');
  console.log(writeChecks ? 'Checking live Firebase and R2 using disposable accounts and objects; cleanup runs after checks.' : 'Checking cloud configuration and connectivity without creating accounts or data.');
  const report = await verifyCloud({ firebase: environment.firebaseConfig(), workerURL: process.env.KAIRO_R2_WORKER_URL, passphrase: process.env.KAIRO_BACKUP_PASSPHRASE }, { writeChecks, onCheck: result => console.log(`${result.passed ? 'PASS' : 'FAIL'} ${result.name}${result.error ? ' (' + result.error + ')' : ''}`) });
  fs.mkdirSync(path.join(__dirname, '../test-results'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '../test-results/cloud-verification.json'), JSON.stringify({ timestamp: new Date().toISOString(), ...report }, null, 2), { mode: 0o600 });
  if (!writeChecks && report.passed) console.log('Connectivity passed. Run with --write-checks to verify deployed rules, account isolation, R2 operations and backup restore.');
  process.exitCode = report.passed ? 0 : 1;
}
main().catch(error => { console.error('Cloud verification could not finish: ' + (error.code || error.name)); process.exitCode = 1; });
