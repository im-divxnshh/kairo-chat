const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const {writeCLI}=require('./fixtures/cli');
const { runProvider } = require('../src/lib/providers'), C = require('../src/lib/core');
test('Claude control protocol returns the user permission decision before proceeding', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kairo-permission-')), file = path.join(directory, process.platform==='win32'?'claude.cmd':'claude');
  writeCLI(file, `#!/usr/bin/env node
let pending='';process.stdin.on('data',chunk=>{pending+=chunk;let i;while((i=pending.indexOf('\\n'))>=0){const line=pending.slice(0,i);pending=pending.slice(i+1);const packet=JSON.parse(line);if(packet.type==='user')process.stdout.write(JSON.stringify({type:'control_request',request_id:'permission-1',request:{subtype:'can_use_tool',tool_name:'Edit',input:{file_path:'example.js'}}})+'\\n');if(packet.type==='control_response'){process.stdout.write(JSON.stringify({type:'result',result:packet.response.response.behavior})+'\\n');process.exit(0);}}});
`, { mode: 0o755 });
  try {
    const provider = { id: 'fixture', kind: 'claude', name: 'Claude fixture', executable: file, enabled: true, args: [] };
    for (const allowed of [true,false]) { let requests = 0; const result = await runProvider(provider, { prompt: 'Test task', cwd: directory, capability: 'agent', settings: {...C.defaults,cliTimeoutSeconds:5}, onPermission: async request => { requests++; assert.equal(request.tool,'Edit'); return allowed; } }); assert.equal(requests,1); assert.equal(result.content, allowed?'allow':'deny'); }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
