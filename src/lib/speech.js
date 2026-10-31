const path = require('node:path'), fs = require('node:fs'), os = require('node:os');
const { spawnCLI, providerEnvironment, executable } = require('./providers');
const sessions = new Map();
function start(owner, onResult) {
  if (sessions.has(owner)) throw new Error('Dictation is already running.');
  const native = file => path.join(__dirname,'../native',file).replace('app.asar'+path.sep,'app.asar.unpacked'+path.sep);
  let file, args, stopFile;
  if (process.platform === 'darwin') { file = native('kairo-speech'); args = []; if (!fs.existsSync(file)) throw new Error('Build native speech support before using dictation.'); }
  else if (process.platform === 'win32') { file = executable('powershell'); stopFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(),'kairo-dictation-')),'stop'); args = ['-NoProfile','-File',native('speech.ps1'),'-StopFile',stopFile]; }
  else throw new Error('Use your operating system dictation on this platform.');
  if (!file) { if(stopFile)fs.rmSync(path.dirname(stopFile),{recursive:true,force:true});throw new Error('Native speech tools are unavailable.'); }
  const child = spawnCLI(file,args,{env:providerEnvironment({kind:'claude'}),stdio:['ignore','pipe','pipe']}); let output='', error='', finished=false;
  sessions.set(owner,{child,stopFile,cancelled:false});
  const finish = result => { if(finished)return;finished=true;const session=sessions.get(owner);sessions.delete(owner);if(stopFile)fs.rmSync(path.dirname(stopFile),{recursive:true,force:true});if(!session?.cancelled)onResult(result); };
  child.stdout.on('data',data=>{output=(output+data).slice(-20000);}); child.stderr.on('data',data=>{error=(error+data).slice(-1000);});
  child.once('error',()=>finish({error:'Native dictation could not start.'}));
  child.once('close',code=>{if(code!==0){finish({error:error||'Dictation stopped.'});return;}try{const result=JSON.parse(output);if(typeof result.text!=='string')throw new Error();finish({text:result.text});}catch{finish({error:'Dictation returned an invalid result.'});}});
  return true;
}
function stop(owner, cancel = false) { const session=sessions.get(owner);if(!session)return;session.cancelled=cancel;if(session.stopFile&&!cancel)fs.writeFileSync(session.stopFile,'stop',{mode:0o600});else session.child.kill(process.platform==='darwin'&&!cancel?'SIGUSR1':'SIGTERM'); }
function stopAll() { for (const owner of sessions.keys()) stop(owner,true); }
module.exports = { start, stop, stopAll };
