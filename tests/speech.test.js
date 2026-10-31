const test=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),{spawn}=require('node:child_process');
const pause=()=>new Promise(r=>setTimeout(r,30));
test('native dictation transport returns stopped text, cleans Windows stop files, and suppresses cancelled results',async()=>{
  const originalLoad=Module._load,platform=Object.getOwnPropertyDescriptor(process,'platform'),children=[];
  let stopFile;
  Module._load=function(request,parent,isMain){
    if(request==='./providers'&&require('node:path').basename(parent.filename)==='speech.js')return {
      executable:()=>'/fixture/powershell.exe',providerEnvironment:()=>({...process.env}),
      spawnCLI:(_file,args,options)=>{
        stopFile=args.at(-1);const child=spawn(process.execPath,['-e',`const fs=require('node:fs');process.stdout.write('');const file=process.argv[1];const timer=setInterval(()=>{if(fs.existsSync(file)){clearInterval(timer);console.log(JSON.stringify({text:'Stopped words'}));}},10);`,stopFile],options);children.push(child);return child;
      }
    };
    return originalLoad.call(this,request,parent,isMain);
  };
  Object.defineProperty(process,'platform',{value:'win32',configurable:true});
  try {
    const speech=require('../src/lib/speech');const received=[];speech.start(1,result=>received.push(result));assert.throws(()=>speech.start(1,()=>{}),/already running/);await pause();speech.stop(1);
    for(let i=0;i<80&&!received.length;i++)await pause();assert.equal(received[0].text,'Stopped words');assert.equal(require('node:fs').existsSync(require('node:path').dirname(stopFile)),false);
    speech.start(2,result=>received.push(result));await pause();speech.stopAll();await new Promise(resolve=>children.at(-1).once('close',resolve));assert.equal(received.length,1);
  } finally {Module._load=originalLoad;Object.defineProperty(process,'platform',platform);for(const child of children)child.kill();}
});
