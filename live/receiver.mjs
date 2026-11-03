import {gather} from './peer.mjs';
const params=new URLSearchParams(location.search),video=document.querySelector('video'),picture=document.querySelector('#compatibility'),status=document.querySelector('#status');
let pc,peer,stopped=false,attempt=0,timer,watchdog,compatibility=false,retrying=false;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function url(route){const q=new URLSearchParams(params);if(peer)q.set('peer',peer);return `/obs/${route}?${q}`;}
async function call(route,options={}){const response=await fetch(url(route),options);if(!response.ok)throw new Error('Waiting for DigiPoly Live and the selected environment…');return response.json();}
function clear(){clearInterval(timer);clearTimeout(watchdog);pc?.close();pc=null;video.srcObject=null;video.hidden=true;picture.hidden=true;picture.removeAttribute('src');status.hidden=false;}
function imageStream(){
  if(stopped||retrying)return;retrying=true;compatibility=true;attempt++;const oldPeer=peer;if(oldPeer)call('leave',{method:'POST'}).catch(()=>{});clear();peer=null;status.textContent='Connecting compatibility stream…';
  picture.src=url('images')+'&attempt='+Date.now();
  const show=()=>{if(picture.naturalWidth){picture.hidden=false;status.hidden=true;}};picture.onload=show;
  picture.onerror=()=>{picture.hidden=true;status.hidden=false;status.textContent='Waiting for DigiPoly Live…';};
  let checking=false;timer=setInterval(async()=>{if(checking||stopped)return;checking=true;try{const health=await call('alive');if(health.lastFrame&&Date.now()-health.lastFrame<2500)show();else throw new Error('Waiting for video…');}catch{clear();status.textContent='Waiting for DigiPoly Live…';await sleep(1500);retrying=false;imageStream();}finally{checking=false;}},1000);retrying=false;
}
async function connect(){
  if(compatibility){imageStream();return;}const current=++attempt;clear();peer=null;video.hidden=false;watchdog=setTimeout(()=>{if(!stopped&&current===attempt)imageStream();},10000);
  try{
    const joined=await call('join',{method:'POST'});peer=joined.peer;document.title=`DigiPoly Live · ${joined.name}`;status.textContent='Waiting for Live to prepare video…';
    let offer;for(let i=0;i<20&&!stopped&&current===attempt;i++){offer=(await call('poll')).offer;if(offer)break;await sleep(500);}if(current!==attempt||stopped)return;if(!offer)throw new Error('Waiting for the output…');
    const connection=pc=new RTCPeerConnection({iceServers:[]});status.textContent='Connecting video…';
    connection.ontrack=event=>{video.srcObject=event.streams[0];video.play().catch(()=>{});};
    video.onplaying=()=>{if(current!==attempt)return;clearTimeout(watchdog);status.hidden=true;};
    await connection.setRemoteDescription(offer);await connection.setLocalDescription(await connection.createAnswer());await gather(connection);if(current!==attempt||stopped)return;
    await call('answer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(connection.localDescription)});
    let checking=false;timer=setInterval(async()=>{if(checking)return;checking=true;try{await call('poll');if(['failed','closed','disconnected'].includes(connection.connectionState))throw new Error('Connection interrupted.');}catch{imageStream();}finally{checking=false;}},2000);
  }catch(error){if(current!==attempt||stopped)return;status.textContent=error.message;imageStream();}
}
window.addEventListener('beforeunload',()=>{stopped=true;attempt++;if(peer)call('leave',{method:'POST',keepalive:true}).catch(()=>{});clear();});
connect();
