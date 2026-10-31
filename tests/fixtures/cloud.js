const crypto = require('node:crypto');
function json(data,status=200){return Response.json(data,{status});}
function error(code,status=400){return json({error:{message:code,status:code}},status);}
function createFirebaseMock(){
  const users=new Map(),documents=new Map(),requests=[];let clock=Date.now(),offline=false;
  const now=()=>new Date(++clock).toISOString();
  function uidFrom(token){if(!token?.startsWith('fixture-token-'))return null;const uid=token.slice(14);return [...users.values()].some(u=>u.localId===uid)?uid:null;}
  async function handle(request){
    if(offline)throw new Error('Fixture offline');
    const url=new URL(request.url),raw=await request.text(),body=raw?(request.headers.get('Content-Type')?.includes('urlencoded')?Object.fromEntries(new URLSearchParams(raw)):JSON.parse(raw)):{};
    requests.push({path:url.pathname,method:request.method,body,authorization:request.headers.get('Authorization')});
    const action=url.pathname.match(/accounts:(\w+)$/)?.[1];
    if(action==='signUp'||action==='signInWithPassword'){
      let user=users.get(body.email);
      if(action==='signUp'){if(user)return error('EMAIL_EXISTS');user={localId:crypto.randomUUID().replace(/-/g,''),email:body.email,password:body.password,emailVerified:false};users.set(body.email,user);}
      if(!user||user.password!==body.password)return error('INVALID_LOGIN_CREDENTIALS');
      return json({localId:user.localId,email:user.email,idToken:'fixture-token-'+user.localId,refreshToken:'fixture-refresh-'+user.localId,expiresIn:'3600'});
    }
    if(action==='lookup'){const uid=uidFrom(body.idToken);const user=[...users.values()].find(u=>u.localId===uid);return user?json({users:[{localId:user.localId,email:user.email,emailVerified:user.emailVerified}]}):error('INVALID_ID_TOKEN',401);}
    if(action==='delete'){const uid=uidFrom(body.idToken);const user=[...users.values()].find(u=>u.localId===uid);if(!user)return error('INVALID_ID_TOKEN',401);users.delete(user.email);return json({});}
    if(action==='sendOobCode')return json({email:body.email||[...users.values()].find(u=>'fixture-token-'+u.localId===body.idToken)?.email});
    if(url.pathname.endsWith('/v1/token')){const uid=String(body.refresh_token||'').replace('fixture-refresh-','');const user=[...users.values()].find(u=>u.localId===uid);return user?json({user_id:uid,id_token:'fixture-token-'+uid,refresh_token:'fixture-refresh-'+uid,expires_in:'3600'}):error('INVALID_REFRESH_TOKEN',401);}
    const token=request.headers.get('Authorization')?.replace('Bearer ',''),uid=uidFrom(token);if(!uid)return error('UNAUTHENTICATED',401);
    const prefix='projects/demo-kairo/databases/(default)/documents/users/'+uid+'/records/';
    if(url.pathname.endsWith('documents:commit')){
      for(const write of body.writes){const name=write.update?.name||write.delete;if(!name.startsWith(prefix))return error('PERMISSION_DENIED',403);const old=documents.get(name),condition=write.currentDocument;
        if(write.update){const f=write.update.fields||{},suffix=name.slice(prefix.length);if(!suffix.includes('/')){const allowed=['type','id','payload','chunks','deleted','schemaVersion','modifiedAt'];if(Object.keys(f).some(k=>!allowed.includes(k))||!f.type?.stringValue||!f.id?.stringValue||typeof f.payload?.stringValue!=='string'||!f.chunks?.arrayValue||typeof f.deleted?.booleanValue!=='boolean'||f.schemaVersion?.integerValue!=='1'||suffix!==f.type.stringValue+'--'+f.id.stringValue||!write.updateTransforms?.some(t=>t.fieldPath==='modifiedAt'&&t.setToServerValue==='REQUEST_TIME'))return error('PERMISSION_DENIED',403);}else if(typeof f.payload?.stringValue!=='string'||Object.keys(f).length!==1)return error('PERMISSION_DENIED',403);}
        if(condition?.exists===false&&old)return error('ALREADY_EXISTS',409);
        if(condition?.updateTime&&(!old||old.updateTime!==condition.updateTime))return error('FAILED_PRECONDITION',409);
      }
      const time=now(),writeResults=[];
      for(const write of body.writes){if(write.delete){documents.delete(write.delete);writeResults.push({updateTime:time});continue;}const record=structuredClone(write.update);if(write.updateTransforms?.some(t=>t.fieldPath==='modifiedAt'))record.fields.modifiedAt={timestampValue:time};record.updateTime=time;record.createTime=documents.get(record.name)?.createTime||time;documents.set(record.name,record);writeResults.push({updateTime:time});}
      return json({writeResults,commitTime:time});
    }
    if(url.pathname.endsWith(':runQuery')){
      if(!url.pathname.includes('/users/'+uid+':runQuery'))return error('PERMISSION_DENIED',403);
      const q=body.structuredQuery,since=q.where?.fieldFilter.value.timestampValue,after=q.startAt?.values;
      let records=[...documents.values()].filter(r=>r.name.startsWith(prefix)&&!r.name.slice(prefix.length).includes('/')&&r.fields.modifiedAt&&(!since||r.fields.modifiedAt.timestampValue>since));
      records.sort((a,b)=>a.fields.modifiedAt.timestampValue.localeCompare(b.fields.modifiedAt.timestampValue)||a.name.localeCompare(b.name));
      if(after)records=records.filter(r=>r.fields.modifiedAt.timestampValue>after[0].timestampValue||(r.fields.modifiedAt.timestampValue===after[0].timestampValue&&r.name>after[1].referenceValue));
      const readTime=body.readTime||now();const results=records.slice(0,q.limit||300).map(document=>({document,readTime}));return json(results.length?results:[{readTime}]);
    }
    if(request.method==='GET'||request.method==='DELETE'){
      const name=decodeURIComponent(url.pathname.replace(/^\/v1\//,''));
      if(!name.startsWith(prefix))return error('PERMISSION_DENIED',403);
      if(request.method==='DELETE'){documents.delete(name);return json({});}
      return documents.has(name)?json(documents.get(name)):error('NOT_FOUND',404);
    }
    return error('NOT_IMPLEMENTED',501);
  }
  return {handle,users,documents,requests,setOffline:value=>offline=value,fetch:async(url,options={})=>handle(new Request(url,options))};
}
function createBucket(){
  const objects=new Map();
  function object(key,value){return {key,etag:value.etag,httpEtag:'"'+value.etag+'"',size:value.data.length,body:new Uint8Array(value.data),writeHttpMetadata:headers=>headers.set('Content-Type',value.contentType)};}
  return {objects,async put(key,stream,options){const data=Buffer.from(await new Response(stream).arrayBuffer()),value={data,contentType:options.httpMetadata.contentType,etag:crypto.createHash('sha256').update(data).digest('hex')};objects.set(key,value);return object(key,value);},async get(key){const value=objects.get(key);return value?object(key,value):null;},async head(key){return this.get(key);},async delete(key){objects.delete(key);}};
}
module.exports={createFirebaseMock,createBucket};
