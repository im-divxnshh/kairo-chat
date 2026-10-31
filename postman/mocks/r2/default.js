const http = require('node:http');
const { createBucket } = require('../../../tests/fixtures/cloud');
const bucket=createBucket();
http.createServer(async(req,res)=>{
  try{
    const {handleRequest}=await import('../../../cloudflare/worker.mjs');const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);
    const response=await handleRequest(new Request('http://storage.kairo.test'+req.url,{method:req.method,headers:req.headers,...(body.length?{body,duplex:'half'}:{})}),{FIREBASE_PROJECT_ID:'demo-kairo',BUCKET:bucket},{verify:async token=>{if(!/^fixture-token-[\w-]+$/.test(token))throw new Error('Unauthorized');return token.slice(14);}});
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500);res.end();}
}).listen(process.env.PORT || 4012);
