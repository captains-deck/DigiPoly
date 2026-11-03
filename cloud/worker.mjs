import {verifyAccess} from './auth.mjs';
import {HASH,FILE_TYPES,validateSnapshot} from './model.mjs';
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function api(request,env,user){
  const url=new URL(request.url),path=url.pathname;
  if(!['GET','HEAD'].includes(request.method)){
    if(request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return json({error:'Invalid request origin.'},403);
    if(request.headers.get('X-DigiPoly-Client')!=='1')return json({error:'Missing DigiPoly request header.'},403);
  }
  if(path==='/api/me'&&request.method==='GET')return json({email:user.email,id:user.id});
  if(path==='/api/workspace'){
    if(request.method==='GET'){
      const row=await env.DB.prepare('SELECT revision,saved_at,document FROM workspaces WHERE owner=?').bind(user.id).first();
      return json(row?{...JSON.parse(row.document),revision:row.revision,savedAt:row.saved_at}: {revision:0,workspace:null,files:{}});
    }
    if(request.method==='PUT'){
      if(Number(request.headers.get('Content-Length'))>512*1024)return json({error:'Workspace is too large.'},413);
      const body=await request.text();if(body.length>512*1024)return json({error:'Workspace is too large.'},413);
      let snapshot;try{snapshot=validateSnapshot(JSON.parse(body));}catch(e){return json({error:e.message},400);}
      for(const f of Object.values(snapshot.files)){
        const row=await env.DB.prepare('SELECT size,type,ready FROM uploads WHERE owner=? AND hash=?').bind(user.id,f.hash).first();
        if(!row?.ready||row.size!==f.size||row.type!==f.type)return json({error:'Upload every file before saving this environment.'},400);
      }
      const revision=snapshot.baseRevision+1,savedAt=new Date().toISOString(),document=JSON.stringify({workspace:snapshot.workspace,files:snapshot.files});
      const result=snapshot.baseRevision===0?
        await env.DB.prepare('INSERT OR IGNORE INTO workspaces(owner,revision,saved_at,document) VALUES(?,?,?,?)').bind(user.id,revision,savedAt,document).run():
        await env.DB.prepare('UPDATE workspaces SET revision=?,saved_at=?,document=? WHERE owner=? AND revision=?').bind(revision,savedAt,document,user.id,snapshot.baseRevision).run();
      if(!result.meta.changes)return json({error:'The cloud copy changed on another device. Load it before saving again.'},409);
      return json({revision,savedAt});
    }
  }
  const match=path.match(/^\/api\/files\/([a-f0-9]{64})$/);
  if(match){
    const hash=match[1],key=`${user.id}/${hash}`;
    if(request.method==='GET'||request.method==='HEAD'){
      const object=request.method==='HEAD'?await env.MEDIA.head(key):await env.MEDIA.get(key);
      if(!object)return json({error:'File not found.'},404);
      const headers=new Headers({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'",'Content-Disposition':'attachment','Content-Length':String(object.size),'ETag':object.httpEtag});object.writeHttpMetadata(headers);
      return new Response(request.method==='HEAD'?null:object.body,{headers});
    }
    if(request.method==='PUT'){
      const size=Number(request.headers.get('Content-Length')),type=request.headers.get('Content-Type');
      if(!FILE_TYPES.has(type)||!Number.isInteger(size)||size<=0||size>(type.startsWith('video/')?100:10)*1024*1024)return json({error:'Choose a supported image (10 MB) or video (100 MB).'},400);
      const existing=await env.MEDIA.head(key);if(existing)return existing.size===size&&existing.httpMetadata.contentType===type?json({hash}):json({error:'File metadata does not match.'},409);
      const reserved=await env.DB.prepare('INSERT OR IGNORE INTO uploads(owner,hash,size,type) SELECT ?,?,?,? WHERE (SELECT COALESCE(SUM(size),0) FROM uploads WHERE owner=?) + ? <= 1073741824').bind(user.id,hash,size,type,user.id,size).run();
      if(!reserved.meta.changes){const row=await env.DB.prepare('SELECT size,type FROM uploads WHERE owner=? AND hash=?').bind(user.id,hash).first();if(!row)return json({error:'Cloud storage is full (1 GB POC limit).'},413);if(row.size!==size||row.type!==type)return json({error:'Upload metadata mismatch.'},409);}
      try{
        await env.MEDIA.put(key,request.body,{sha256:hash,httpMetadata:{contentType:type}});
        await env.DB.prepare('UPDATE uploads SET ready=1 WHERE owner=? AND hash=?').bind(user.id,hash).run();
      }catch(e){await env.DB.prepare('DELETE FROM uploads WHERE owner=? AND hash=? AND ready=0').bind(user.id,hash).run();throw e;}
      return json({hash});
    }
  }
  return json({error:'Not found.'},404);
}
export default {async fetch(request,env){
  if(!new URL(request.url).pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
  let user;try{user=await verifyAccess(request.headers.get('Cf-Access-Jwt-Assertion'),{issuer:env.ACCESS_ISSUER,audience:env.ACCESS_AUD});}catch{return json({error:'Sign in to DigiPoly, then try again.'},401);}
  try{return await api(request,env,user);}catch(error){console.error('DigiPoly API error:',error.message);return json({error:'Cloud storage could not complete this request. Your local copy is safe.'},500);}
}};
