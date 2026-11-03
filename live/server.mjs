import http from 'node:http';
import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {readFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {join,extname,resolve} from 'node:path';
const types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
const idPattern=/^[a-zA-Z0-9_-]{1,100}$/;
export async function startServer({root,secret,port=18777,onPeer=()=>{},onAnswer=()=>{},onLeave=()=>{},onImageDemand=()=>{},resolveMedia=()=>null}){
  let channels=new Map();const peers=new Map(),imageClients=new Map(),frameTimes=new Map();
  const demand=()=>onImageDemand([...imageClients.keys()].filter(id=>imageClients.get(id).size));
  const token=id=>createHmac('sha256',secret).update(id).digest('hex');
  const valid=(actual,id)=>typeof actual==='string'&&actual.length===64&&timingSafeEqual(Buffer.from(actual),Buffer.from(token(id)));
  const remove=id=>{if(peers.delete(id))onLeave(id);};
  const server=http.createServer(async(req,res)=>{
    const reply=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
    try{
      const origin=`http://127.0.0.1:${server.address().port}`;
      if(req.headers.host!==new URL(origin).host){reply({error:'Invalid host'},403);return;}
      res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
      res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; img-src 'self' blob: data:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'");
      const url=new URL(req.url,origin),path=decodeURIComponent(url.pathname);
      // OpenCV's generated loader needs eval inside its isolated worker only.
      if(path==='/src/tracker-worker.js')res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-eval'; connect-src 'self'");
      if(req.headers.origin&&req.headers.origin!==origin){reply({error:'Invalid origin'},403);return;}
      if(path==='/health'&&req.method==='GET'){reply({app:'DigiPoly Live',channels:channels.size,imageReceivers:[...imageClients.values()].reduce((n,set)=>n+set.size,0),receivers:[...peers.values()].map(p=>({offered:Boolean(p.offer),answered:p.answer,diagnostic:p.diagnostic}))});return;}
      if(path.startsWith('/obs/')){
        const channel=url.searchParams.get('channel');
        if(!idPattern.test(channel||'')||!valid(url.searchParams.get('key'),channel)){reply({error:'Invalid source link'},403);return;}
        if(!channels.has(channel)){reply({error:'Waiting for this environment in DigiPoly Live'},503);return;}
        if(path==='/obs/alive'&&req.method==='GET'){reply({ok:true,lastFrame:frameTimes.get(channel)||0});return;}
        if(path==='/obs/images'&&req.method==='GET'){
          if([...imageClients.values()].reduce((n,set)=>n+set.size,0)>=16){reply({error:'Too many receivers'},429);return;}
          res.writeHead(200,{'Content-Type':'multipart/x-mixed-replace; boundary=digipoly-frame','Connection':'keep-alive'});res.flushHeaders();
          if(!imageClients.has(channel))imageClients.set(channel,new Set());imageClients.get(channel).add(res);demand();
          res.on('close',()=>{imageClients.get(channel)?.delete(res);demand();});return;
        }
        if(path==='/obs/join'&&req.method==='POST'){
          if(peers.size>=16){reply({error:'Too many receivers'},429);return;}
          const id=randomUUID();peers.set(id,{channel,touched:Date.now(),offer:null,answer:false});reply({peer:id,name:channels.get(channel)});onPeer({id,channel});return;
        }
        const id=url.searchParams.get('peer'),peer=peers.get(id);
        if(!peer||peer.channel!==channel){reply({error:'Reconnect receiver'},404);return;}peer.touched=Date.now();
        if(path==='/obs/poll'&&req.method==='GET'){reply({offer:peer.offer});return;}
        if(path==='/obs/leave'&&req.method==='POST'){remove(id);reply({ok:true});return;}
        if(path==='/obs/answer'&&req.method==='POST'){
          let body='';for await(const chunk of req){body+=chunk;if(body.length>64000){reply({error:'Answer too large'},413);return;}}
          const answer=JSON.parse(body);if(answer.type!=='answer'||typeof answer.sdp!=='string'){reply({error:'Invalid answer'},400);return;}
          if(!peer.answer){peer.answer=true;onAnswer({id,answer});}reply({ok:true});return;
        }
        reply({error:'Not found'},404);return;
      }
      if(!['GET','HEAD'].includes(req.method)){reply({error:'Not allowed'},405);return;}
      if(/^\/cached\/[a-f0-9]{64}$/.test(path)){
        const hash=path.split('/')[2];if(!valid(url.searchParams.get('key'),`file:${hash}`)){reply({error:'Invalid file link'},403);return;}
        const file=resolveMedia(hash);if(!file){reply({error:'Unavailable file'},404);return;}
        const info=await stat(file.path);res.setHeader('Content-Type',file.type);res.setHeader('Content-Length',info.size);if(req.method==='HEAD')res.end();else createReadStream(file.path).pipe(res);return;
      }
      const relative=path==='/'?'live/index.html':path.slice(1);
      if(!/^(live\/(index\.html|style\.css|app\.mjs|runtime\.mjs|peer\.mjs|receiver\.html|receiver\.mjs)|src\/[\w.-]+\.(mjs|js)|vendor\/(opencv\.js|ghostmarker\/[\w.-]+\.(mjs|js))|assets\/[\w/.-]+\.(svg|png|jpg|webp))$/.test(relative)){reply({error:'Not found'},404);return;}
      const file=resolve(root,relative);if(!file.startsWith(resolve(root)+'/')){reply({error:'Not found'},404);return;}
      const bytes=await readFile(file);res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.setHeader('Content-Length',bytes.length);res.end(req.method==='HEAD'?undefined:bytes);
    }catch{if(!res.headersSent)reply({error:'Unavailable'},500);else res.end();}
  });
  await new Promise((ok,no)=>{server.once('error',no);server.listen(port,'127.0.0.1',ok);});
  const origin=`http://127.0.0.1:${server.address().port}`;
  const cleanup=setInterval(()=>{for(const [id,p]of peers)if(Date.now()-p.touched>15000)remove(id);},5000);cleanup.unref();
  return {origin,token,peers,mediaUrl:hash=>`${origin}/cached/${hash}?key=${token(`file:${hash}`)}`,
    setChannels:list=>{for(const id of peers.keys())remove(id);for(const clients of imageClients.values())for(const res of clients)res.end();imageClients.clear();frameTimes.clear();demand();channels=new Map(list.map(c=>[c.id,c.name]));return list.map(c=>({...c,url:`${origin}/live/receiver.html?channel=${encodeURIComponent(c.id)}&key=${token(c.id)}`}));},
    frame:(channel,data)=>{if(!channels.has(channel)||data.byteLength>1024*1024)return;const bytes=Buffer.from(data);if(bytes[0]!==255||bytes[1]!==216)return;frameTimes.set(channel,Date.now());for(const res of imageClients.get(channel)||[]){if(res.destroyed||res.writableLength>1024*1024)continue;res.write(`--digipoly-frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${bytes.length}\r\n\r\n`);res.write(bytes);res.write('\r\n');}},
    offer:(id,offer)=>{const peer=peers.get(id);if(peer)peer.offer=offer;},
    close:async()=>{clearInterval(cleanup);for(const id of peers.keys())remove(id);for(const clients of imageClients.values())for(const res of clients)res.end();imageClients.clear();server.closeAllConnections();await new Promise(r=>server.close(r));}};
}
