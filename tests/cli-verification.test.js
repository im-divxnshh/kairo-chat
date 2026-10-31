const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const V=require('../scripts/verify-cli');
test('CLI verifier supports bounded timeout and explicit Claude safe mode',()=>{
  assert.deepEqual(V.options([]),{selected:['claude','codex'],timeout:60,safeMode:false});
  assert.deepEqual(V.options([],'codex'),{selected:['codex'],timeout:60,safeMode:false});
  assert.deepEqual(V.options(['--provider','claude'],'codex'),{selected:['claude'],timeout:60,safeMode:false});
  assert.deepEqual(V.options(['--provider','claude','--timeout','120','--safe-mode']),{selected:['claude'],timeout:120,safeMode:true});
  for(const args of [['--safe-mode'],['--provider','codex','--safe-mode'],['--timeout','0'],['--timeout','601'],['--timeout','NaN'],['--provider','invalid'],['--unknown']])assert.throws(()=>V.options(args));
});
test('Claude diagnostics describe alias mapping without exposing credentials or hook commands',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'kairo-cli-info-')),configFile=path.join(directory,'settings.json');
  try {fs.writeFileSync(configFile,JSON.stringify({model:'haiku',env:{ANTHROPIC_BASE_URL:'https://private-user:private-password@gateway.example.test/api?token=private-query',ANTHROPIC_AUTH_TOKEN:'private-token',ANTHROPIC_DEFAULT_HAIKU_MODEL:'gateway-model'},hooks:{SessionStart:[{hooks:[{type:'command',command:'private-hook'}]}]},enabledPlugins:{'example@test':true}}));const output=V.diagnostic({kind:'claude',configFile});assert.match(output,/gateway\.example\.test/);assert.match(output,/haiku → gateway-model/);assert.ok(!/private-|token=/.test(output));}
  finally {fs.rmSync(directory,{recursive:true,force:true});}
});
