const http = require('node:http');
const { createFirebaseMock } = require('../../../tests/fixtures/cloud');
const mock = createFirebaseMock();
http.createServer(async (req,res) => {
  try {
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const body=Buffer.concat(chunks);
    const response=await mock.handle(new Request('http://firebase.test'+req.url,{method:req.method,headers:req.headers,...(body.length?{body,duplex:'half'}:{})}));
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  } catch {res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{message:'MOCK_ERROR'}}));}
}).listen(process.env.PORT || 4011);
