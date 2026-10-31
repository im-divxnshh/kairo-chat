const { spawnCLI, providerEnvironment } = require('./providers');
const { StringDecoder } = require('node:string_decoder');
async function call(server, method, params = {}) {
  if (!server.enabled) throw new Error('Enable this MCP server first.');
  if (!server.command || !Array.isArray(server.args || [])) throw new Error('Set the MCP executable and argument array.');
  return new Promise((resolve, reject) => {
    let pending = '', initialized = false, complete = false;
    const decoder = new StringDecoder('utf8');
    const child = spawnCLI(server.command, server.args || [], { stdio: ['pipe', 'pipe', 'pipe'], env: providerEnvironment({ kind: 'claude' }) });
    const finish = (error, result) => { if (complete) return; complete = true; clearTimeout(timeout); child.kill(); error ? reject(error) : resolve(result); };
    const timeout = setTimeout(() => finish(new Error('MCP server timed out.')), 20000);
    const send = packet => child.stdin.write(JSON.stringify(packet) + '\n');
    child.on('error', e => finish(e)); child.on('close', () => { if (!complete) finish(new Error('MCP server disconnected.')); });
    child.stdin.on('error', () => {}); child.stderr.on('data', () => {});
    child.stdout.on('data', chunk => {
      pending += decoder.write(chunk); const lines = pending.split('\n'); pending = lines.pop();
      if (pending.length > 2 * 1024 * 1024) return finish(new Error('MCP message too large.'));
      for (const line of lines) {
        if (line.length > 2 * 1024 * 1024) return finish(new Error('MCP message too large.'));
        let message; try { message = JSON.parse(line); } catch { continue; }
        if (message.id === 1 && !initialized) {
          if (message.error) return finish(new Error(message.error.message));
          initialized = true; send({ jsonrpc: '2.0', method: 'notifications/initialized' }); send({ jsonrpc: '2.0', id: 2, method, params });
        } else if (message.id === 2) { if (message.error) finish(new Error(message.error.message)); else finish(null, message.result); }
      }
    });
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'kairo-chat', version: '0.2.0' } } });
  });
}
module.exports = { call };
