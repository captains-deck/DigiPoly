import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {api} from '../cloud/worker.mjs';
import {verifyAccess} from '../cloud/auth.mjs';
import {validateSnapshot} from '../cloud/model.mjs';
import {createWorkspace} from '../src/workspace.mjs';
import {CloudClient} from '../src/cloud.mjs';
async function fixture(){
  const db=new DatabaseSync(':memory:');db.exec(await readFile(new URL('../cloud/migrations/0001_cloud.sql',import.meta.url),'utf8'));
  const DB={prepare:sql=>({bind:(...args)=>({first:async()=>db.prepare(sql).get(...args),run:async()=>({meta:db.prepare(sql).run(...args)})})})};
  const objects=new Map();const object=value=>value?{size:value.bytes.length,httpEtag:'test',httpMetadata:{contentType:value.type},body:value.bytes,writeHttpMetadata:h=>h.set('Content-Type',value.type)}:null;
  const MEDIA={head:async key=>object(objects.get(key)),get:async key=>object(objects.get(key)),put:async(key,body,options)=>{const bytes=Buffer.from(await new Response(body).arrayBuffer());assert.equal(createHash('sha256').update(bytes).digest('hex'),options.sha256);objects.set(key,{bytes,type:options.httpMetadata.contentType});}};
  const env={DB,MEDIA},user={id:'alice',email:'alice@example.test'};
  const request=(path,method='GET',body,headers={})=>new Request(`https://digipoly.co.uk/api/${path}`,{method,headers:{'X-DigiPoly-Client':'1',...headers},...(body?{body}:{} )});
  return {env,user,request,db};
}
test('cloud saves are atomic, versioned and isolated between identities',async()=>{
  const {env,user,request,db}=await fixture();const workspace=createWorkspace();
  const payload=baseRevision=>JSON.stringify({workspace,files:{},baseRevision});
  assert.equal((await api(request('workspace','PUT',payload(0)),env,user)).status,200);
  assert.equal((await api(request('workspace','PUT',payload(0)),env,user)).status,409);
  assert.equal((await api(request('workspace'),env,user).then(r=>r.json())).revision,1);
  assert.equal((await api(request('workspace'),env,{id:'bob'}).then(r=>r.json())).workspace,null);
  assert.equal((await api(request('workspace','PUT',payload(1),{Origin:'https://evil.example'}),env,user)).status,403);
  assert.equal((await api(request('workspace','PUT',payload(1)),env,user)).status,200);db.close();
});
test('cloud upload requires complete verified files and never shares another owner’s media',async()=>{
  const {env,user,request,db}=await fixture(),workspace=createWorkspace();const bytes=Buffer.from('test image bytes'),hash=createHash('sha256').update(bytes).digest('hex');workspace.media.push({id:'media-test',name:'Test',kind:'image',url:'https://evil.example/image'});
  const files={'media-test':{hash,size:bytes.length,type:'image/png'}},save=()=>api(request('workspace','PUT',JSON.stringify({workspace,files,baseRevision:0})),env,user);
  assert.equal((await save()).status,400);
  assert.equal((await api(request(`files/${hash}`,'PUT',bytes,{'Content-Length':String(bytes.length),'Content-Type':'image/png'}),env,user)).status,200);
  assert.equal((await save()).status,200);const saved=await api(request('workspace'),env,user).then(r=>r.json());assert.equal(saved.workspace.media[0].url,undefined);
  assert.equal((await api(request(`files/${hash}`),env,{id:'bob'})).status,404);assert.equal((await api(request(`files/${hash}`),env,user)).status,200);
  workspace.environments[0].scene.background={type:'upload',assetId:'media-test',name:'test'};files['media-test'].type='video/mp4';assert.throws(()=>validateSnapshot({workspace,files,baseRevision:1}),/Backgrounds/);db.close();
});
test('client failed uploads never publish a partial workspace',async()=>{
  let published=false;const client=new CloudClient(async(path,options={})=>{if(path==='/api/workspace')published=true;return Response.json({error:'Upload failed'},{status:503});});const state=createWorkspace();state.media.push({id:'media-test',kind:'image',name:'test'});
  await assert.rejects(()=>client.save(state,0,async()=>({blob:new Blob(['test'],{type:'image/png'})})),/Upload failed/);assert.equal(published,false);
});
test('Access verifies signatures, issuer, application audience and expiry',async()=>{
  const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);jwk.kid='test-key';
  const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');const issuer='https://test.cloudflareaccess.com',audience='digipoly-test',now=Math.floor(Date.now()/1000);
  const sign=async claims=>{const input=b64({alg:'RS256',kid:jwk.kid})+'.'+b64({iss:issuer,aud:[audience],sub:'one',email:'one@example.test',exp:now+60,...claims});return input+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,Buffer.from(input))).toString('base64url');};
  const config={issuer,audience,now,fetcher:async()=>Response.json({keys:[jwk]})};const valid=await sign({});assert.equal((await verifyAccess(valid,config)).email,'one@example.test');
  await assert.rejects(()=>verifyAccess(valid.slice(0,-5)+'abcde',config));
  for(const claims of [{aud:['another-app']},{iss:'https://evil.example'},{exp:now-1},{sub:null}])await assert.rejects(()=>sign(claims).then(token=>verifyAccess(token,config)));
});
