const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {writeCLI}=require('./fixtures/cli');
const {streamEvents,runProvider,runHTTP}=require('../src/lib/providers'),C=require('../src/lib/core');
test('Finder-style launches resolve node for CLI version checks and chat subprocesses',{skip:process.platform==='win32'},async()=>{
  const {spawnSync}=require('node:child_process'),{health}=require('../src/lib/providers');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'kairo-finder-path-')),file=path.join(directory,'claude'),settingsFile=path.join(directory,'settings.json'),oldPath=process.env.PATH;
  try{
    fs.symlinkSync(process.execPath,path.join(directory,'node'));fs.writeFileSync(settingsFile,'{}');
    writeCLI(file,`#!/usr/bin/env node\nif(process.argv.includes('--version')){console.log('fixture CLI');process.exit(0);}if(process.argv.includes('auth')){console.log('{"loggedIn":true}');process.exit(0);}let input='';process.stdin.on('data',chunk=>input+=chunk);process.stdin.on('end',()=>console.log(JSON.stringify({type:'result',result:input,usage:{output_tokens:1}})));\n`);
    const limited=path.join(directory,'empty-path');fs.mkdirSync(limited);
    const broken=spawnSync(file,['--version'],{env:{...process.env,PATH:limited},encoding:'utf8'});assert.notEqual(broken.status,0);assert.match(broken.stderr,/node/);
    process.env.PATH=limited;
    const provider={id:'finder-fixture',name:'Finder fixture',kind:'claude',executable:file,configFile:settingsFile,enabled:true};
    const status=await health(provider);assert.equal(status.healthy,true);assert.equal(status.authentication,'authenticated');
    const result=await runProvider(provider,{prompt:'Chat launched from Finder',settings:{...C.defaults,cliTimeoutSeconds:10}});assert.equal(result.content,'Chat launched from Finder');
  }finally{if(oldPath===undefined)delete process.env.PATH;else process.env.PATH=oldPath;fs.rmSync(directory,{recursive:true,force:true});}
});

test('CLI discovery and subprocess PATH include nvm installations without loading a shell profile',()=>{
  const {searchDirectories,executionEnvironment}=require('../src/lib/process-path'),{executable}=require('../src/lib/providers');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'kairo-node-discovery-')),oldNvm=process.env.NVM_DIR;
  try{
    const root=path.join(directory,'nvm'),newer=path.join(root,'versions/node/v22.12.0/bin'),older=path.join(root,'versions/node/v22.9.0/bin');fs.mkdirSync(newer,{recursive:true});fs.mkdirSync(older,{recursive:true});
    const dirs=searchDirectories({env:{PATH:'/usr/bin:/bin',NVM_DIR:root},home:directory,platform:'darwin',runtimePath:''});assert.ok(dirs.includes(newer));assert.ok(dirs.indexOf(newer)<dirs.indexOf(older));assert.ok(dirs.includes('/opt/homebrew/bin'));assert.ok(dirs.includes('/usr/local/bin'));
    const name='kairo-fixture-node-tool',file=path.join(newer,name+(process.platform==='win32'?'.cmd':''));fs.writeFileSync(file,'fixture',{mode:0o755});process.env.NVM_DIR=root;
    if(process.platform!=='win32')assert.equal(executable(name),file);
    const env=executionEnvironment({PATH:path.join(directory,'inherited'),Path:'duplicate',NVM_DIR:root,KAIRO_TEST:'kept'},file);assert.equal(env.PATH.split(path.delimiter)[0],newer);assert.equal(env.Path,undefined);assert.equal(env.KAIRO_TEST,'kept');
  }finally{if(oldNvm===undefined)delete process.env.NVM_DIR;else process.env.NVM_DIR=oldNvm;fs.rmSync(directory,{recursive:true,force:true});}
});

test('missing Node produces actionable CLI diagnostics',{skip:process.platform==='win32'},async()=>{
  const {health}=require('../src/lib/providers'),directory=fs.mkdtempSync(path.join(os.tmpdir(),'kairo-missing-node-')),file=path.join(directory,'claude'),settingsFile=path.join(directory,'settings.json');
  try{
    fs.writeFileSync(file,"#!/bin/sh\nprintf 'env: node: No such file or directory\\n' >&2\nexit 127\n",{mode:0o755});fs.writeFileSync(settingsFile,'{}');
    const provider={id:'missing-node',name:'Missing Node fixture',kind:'claude',executable:file,configFile:settingsFile};
    const status=await health(provider);assert.equal(status.healthy,false);assert.match(status.error,/Install Node.js 22/);
    await assert.rejects(runProvider(provider,{prompt:'Hi',settings:C.defaults}),/Install Node.js 22/);
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('Claude text deltas are not duplicated by final assistant messages; usage and errors are preserved',()=>{let emitted='';const p=streamEvents('claude',chunk=>emitted+=chunk);p.consume({type:'stream_event',event:{delta:{type:'text_delta',text:'Hello '}}});p.consume({type:'stream_event',event:{delta:{type:'text_delta',text:'world'}}});p.consume({type:'assistant',message:{content:[{type:'text',text:'Hello world'}]}});p.consume({type:'result',usage:{input_tokens:10,output_tokens:3},total_cost_usd:0.01});assert.equal(emitted,'Hello world');assert.equal(p.result().usage.input_tokens,10);p.consume({type:'result',is_error:true,result:'Denied'});assert.equal(p.result().terminalError,'Denied');});
test('Codex agent messages and turn usage are parsed without showing tool JSON',()=>{let emitted='';const p=streamEvents('codex',chunk=>emitted+=chunk);p.consume({type:'item.completed',item:{type:'command_execution',aggregated_output:'hidden tool result'}});p.consume({type:'item.completed',item:{type:'agent_message',text:'Answer'}});p.consume({type:'turn.completed',usage:{input_tokens:7,output_tokens:2}});assert.equal(emitted,'Answer');assert.equal(p.result().usage.output_tokens,2);});
test('real child process CLI transport uses stdin, preserves Unicode and honors stop generation',async()=>{const directory=fs.mkdtempSync(path.join(os.tmpdir(),'kairo-provider-test-')),file=path.join(directory,process.platform==='win32'?'claude.cmd':'claude');writeCLI(file,`#!/usr/bin/env node\nlet input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{if(input==='wait'){setInterval(()=>{},1000);return;}for(const event of [{type:'stream_event',event:{delta:{type:'text_delta',text:'Hello 🌍'}}},{type:'result',usage:{input_tokens:5,output_tokens:2}}]){const bytes=Buffer.from(JSON.stringify(event)+'\\n');for(const byte of bytes)process.stdout.write(Buffer.from([byte]));}});\n`,{mode:0o755});try{let chunks='';const provider={id:'fixture',name:'Fixture CLI',kind:'claude',executable:file,args:[]};const result=await runProvider(provider,{prompt:'input only over stdin',cwd:directory,settings:{...C.defaults,cliTimeoutSeconds:10},onChunk:c=>chunks+=c});assert.equal(result.content,'Hello 🌍');assert.equal(chunks,'Hello 🌍');const controller=new AbortController();setTimeout(()=>controller.abort(),100);await assert.rejects(runProvider(provider,{prompt:'wait',cwd:directory,settings:C.defaults,signal:controller.signal}),/stopped/);}finally{fs.rmSync(directory,{recursive:true,force:true});}});
test('local Ollama streams JSON, handles errors and rejects direct OpenAI API providers',async()=>{const original=global.fetch,provider={id:'p',kind:'ollama',name:'Local fixture',endpoint:'http://127.0.0.1:11434',model:'fixture-model'};const options={prompt:'Hi',images:[],settings:C.defaults,onChunk:()=>{}};try{let output='';global.fetch=async(url,request)=>{assert.equal(url,'http://127.0.0.1:11434/api/chat');assert.equal(request.headers.Authorization,undefined);assert.ok(JSON.parse(request.body).stream);return new Response(JSON.stringify({message:{content:'Answer'}})+'\n'+JSON.stringify({done:true,prompt_eval_count:4,eval_count:2})+'\n');};const result=await runHTTP(provider,{...options,onChunk:c=>output+=c});assert.equal(output,'Answer');assert.equal(result.usage.input_tokens,4);global.fetch=async()=>new Response('limit',{status:429});await assert.rejects(runHTTP(provider,options),/rate limit/);global.fetch=async()=>new Response('{"message":{"content":"partial"}}\n');await assert.rejects(runHTTP(provider,options),/before completion/);global.fetch=()=>{throw new Error('Direct API must never be contacted');};await assert.rejects(runProvider({...provider,kind:'compatible',endpoint:'https://api.openai.com/v1'},options),/disabled/);}finally{global.fetch=original;}});

test('CLI environment strips application API keys and backup passphrases',()=>{const {providerEnvironment}=require('../src/lib/providers');const oldKey=process.env.KAIRO_PROVIDER_TEST_KEY,oldPass=process.env.KAIRO_BACKUP_PASSPHRASE;process.env.KAIRO_PROVIDER_TEST_KEY='fixture-secret';process.env.KAIRO_BACKUP_PASSPHRASE='fixture-passphrase';try{const env=providerEnvironment({kind:'codex',configDir:'/tmp/fixture-codex'});assert.equal(env.KAIRO_PROVIDER_TEST_KEY,undefined);assert.equal(env.KAIRO_BACKUP_PASSPHRASE,undefined);assert.equal(env.CODEX_HOME,'/tmp/fixture-codex');}finally{if(oldKey===undefined)delete process.env.KAIRO_PROVIDER_TEST_KEY;else process.env.KAIRO_PROVIDER_TEST_KEY=oldKey;if(oldPass===undefined)delete process.env.KAIRO_BACKUP_PASSPHRASE;else process.env.KAIRO_BACKUP_PASSPHRASE=oldPass;}});

test('vision and research transport delivers images and tools to native CLI subprocesses',async()=>{
  
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'kairo-vision-')),file=path.join(directory,process.platform==='win32'?'cli.cmd':'cli'),imageFile=path.join(directory,'image.png');fs.writeFileSync(imageFile,'fixture');
  writeCLI(file,`#!/usr/bin/env node\nlet input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{const args=process.argv.slice(2);const content=JSON.stringify({args,input});const event=args.includes('exec')?{type:'item.completed',item:{type:'agent_message',text:content}}:{type:'result',result:content};console.log(JSON.stringify(event));});\n`,{mode:0o755});
  try {
    const image={path:imageFile,dataURL:'data:image/png;base64,aW1hZ2U='};
    for(const kind of ['claude','codex']){
      const result=JSON.parse((await runProvider({id:'vision',name:'Fixture',kind,executable:file},{prompt:'Analyze layout',images:[image],capability:'research',cwd:directory,settings:C.defaults})).content);
      if(kind==='claude'){assert.ok(result.args.includes('WebSearch,WebFetch'));assert.ok(result.args.includes('--input-format'));const blocks=JSON.parse(result.input).message.content;assert.equal(blocks[1].source.data,'aW1hZ2U=');assert.equal(blocks[0].text,'Analyze layout');}
      else {assert.ok(result.args.includes('web_search="live"'));assert.equal(result.args[result.args.indexOf('-i')+1],imageFile);assert.equal(result.input,'Analyze layout');assert.equal(result.args.at(-1),'-');}
    }
  } finally {fs.rmSync(directory,{recursive:true,force:true});}
});

test('terminal CLI events complete requests without waiting for lingering session hooks',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'kairo-cli-final-')),file=path.join(directory,process.platform==='win32'?'cli.cmd':'cli');
  writeCLI(file,`#!/usr/bin/env node\nlet input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{if(process.argv.includes('exec')){console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'KAIRO_OK'}}));console.log(JSON.stringify({type:'turn.completed',usage:{output_tokens:2}}));}else{console.log(JSON.stringify({type:'result',result:'KAIRO_OK',usage:{output_tokens:2}}));}setInterval(()=>{},1000);});\n`);
  try {for(const kind of ['claude','codex']){const result=await runProvider({id:kind,name:kind,kind,executable:file},{prompt:'Check',cwd:directory,settings:{...C.defaults,cliTimeoutSeconds:1}});assert.equal(result.content,'KAIRO_OK');assert.equal(result.usage.output_tokens,2);}}
  finally {fs.rmSync(directory,{recursive:true,force:true});}
});
test('CLI timeouts distinguish startup, initialized requests and partial responses',async()=>{
  // Leave time for native subprocess startup under parallel macOS/Windows test load.
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'kairo-cli-phase-')),file=path.join(directory,process.platform==='win32'?'cli.cmd':'cli');
  writeCLI(file,`#!/usr/bin/env node\nlet mode='';process.stdin.on('data',c=>mode+=c);process.stdin.on('end',()=>{if(mode!=='startup')console.log(JSON.stringify({type:'system',subtype:'init'}));if(mode==='response')console.log(JSON.stringify({type:'stream_event',event:{delta:{type:'text_delta',text:'Partial'}}}));setInterval(()=>{},1000);});\n`);
  try {for(const phase of ['startup','request','response'])await assert.rejects(runProvider({id:'claude',name:'Claude',kind:'claude',executable:file},{prompt:phase,cwd:directory,settings:{...C.defaults,cliTimeoutSeconds:2}}),error=>error.code==='KAIRO_CLI_TIMEOUT'&&error.phase===phase);}
  finally {fs.rmSync(directory,{recursive:true,force:true});}
});
test('Claude diagnostic safe mode preserves explicit native settings and model selection',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'kairo-cli-safe-')),file=path.join(directory,process.platform==='win32'?'cli.cmd':'cli'),settingsFile=path.join(directory,'settings.json');fs.writeFileSync(settingsFile,'{"model":"native-model"}');
  writeCLI(file,`#!/usr/bin/env node\nprocess.stdin.resume();process.stdin.on('end',()=>console.log(JSON.stringify({type:'result',result:JSON.stringify(process.argv.slice(2))})));\n`);
  try {const args=JSON.parse((await runProvider({id:'claude',name:'Claude',kind:'claude',executable:file,configFile:settingsFile},{prompt:'Test',cwd:directory,safeMode:true})).content);assert.ok(args.includes('--safe-mode'));assert.equal(args[args.indexOf('--settings')+1],settingsFile);assert.ok(!args.includes('--model'));assert.ok(!args.includes('--bare'));await assert.rejects(runProvider({id:'codex',name:'Codex',kind:'codex',executable:file},{prompt:'Test',safeMode:true}),/Claude only/);}
  finally {fs.rmSync(directory,{recursive:true,force:true});}
});
