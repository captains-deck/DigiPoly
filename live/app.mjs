import {LiveRuntime} from './runtime.mjs';
import {gather} from './peer.mjs';
const $=id=>document.getElementById(id),api=window.live,peers=new Map();
let runtime,info,stream,mode='demo',cameraRequest=0,busy=false,loadedRevision=0,lastStats=0,frames=0;
let imageChannels=[],imageBusy=false,lastImage=0;
async function imageFrames(){
  if(!runtime||imageBusy||!imageChannels.length||performance.now()-lastImage<50)return;imageBusy=true;lastImage=performance.now();const engine=runtime;
  try{await Promise.all(imageChannels.filter(id=>engine.env.channels.some(c=>c.id===id)).map(async id=>{const blob=await new Promise(r=>engine.compositor.ensure(engine.env.id,id).canvas.toBlob(r,'image/jpeg',.88));if(blob&&engine===runtime)await api.frame(id,new Uint8Array(await blob.arrayBuffer()));}));}catch{}finally{imageBusy=false;}
}
const notice=(message,error=false)=>{$('notice').textContent=message;$('notice').classList.toggle('error',error);};
const message=error=>String(error.message||error).replace(/^Error invoking remote method '[^']+': Error: /,'');
function controls(value){busy=value;for(const id of ['signin','sync','load','environment'])$(id).disabled=value;}
function summary(data){info=data;const selected=$('environment').value;$('environment').replaceChildren(...data.environments.map(e=>new Option(e.name,e.id)));if(data.environments.some(e=>e.id===selected))$('environment').value=selected;if(data.environmentId&&data.environments.some(e=>e.id===data.environmentId))$('environment').value=data.environmentId;$('account').textContent=data.cached?`${data.email} · cached cloud v${data.revision}`:'Sample workspace · available offline';}
function peerCount(){const connected=[...peers.values()].filter(p=>p.connectionState==='connected').length;$('receivers').textContent=`${connected+imageChannels.length} output connections${imageChannels.length?' · compatibility stream':''}${peers.size>connected?` · ${peers.size-connected} connecting`:''}`;}
function removePeer(id){const pc=peers.get(id);pc?.close();peers.delete(id);peerCount();}
function closePeers(){for(const id of peers.keys())removePeer(id);}
async function handlePeer(data){
  if(!runtime||!runtime.env.channels.some(c=>c.id===data.channel))return;
  const engine=runtime,pc=new RTCPeerConnection({iceServers:[]});peers.set(data.id,pc);peerCount();
  pc.onconnectionstatechange=()=>{peerCount();if(pc.connectionState==='failed')removePeer(data.id);};
  setTimeout(async()=>{if(!peers.has(data.id))return;const stats=[...(await pc.getStats()).values()];api.diagnostic(data.id,{state:pc.connectionState,ice:pc.iceConnectionState,gather:pc.iceGatheringState,local:stats.filter(s=>s.type==='local-candidate').map(s=>({type:s.candidateType,protocol:s.protocol})),remote:stats.filter(s=>s.type==='remote-candidate').map(s=>({type:s.candidateType,protocol:s.protocol})),pairs:stats.filter(s=>s.type==='candidate-pair').map(s=>({state:s.state,sent:s.bytesSent,received:s.bytesReceived,nominated:s.nominated}))}).catch(()=>{});},8000);
  try{const output=engine.stream(data.channel);for(const track of output.getTracks())pc.addTrack(track,output);await pc.setLocalDescription(await pc.createOffer());await gather(pc);if(engine!==runtime||!peers.has(data.id))return;await api.offer(data.id,pc.localDescription.toJSON());}catch(error){removePeer(data.id);notice(`OBS connection: ${message(error)}`,true);}
}
function outputs(list){
  $('outputs').replaceChildren(...list.map(channel=>{
    const card=document.createElement('article');card.className='output';const top=document.createElement('header'),title=document.createElement('div'),h=document.createElement('h3'),sub=document.createElement('p');h.textContent=channel.name;sub.textContent=[channel.country,channel.language].filter(Boolean).join(' · ');title.append(h,sub);top.append(title);
    const canvas=runtime.compositor.ensure(runtime.env.id,channel.id).canvas;canvas.setAttribute('aria-label',`${channel.name} output preview`);
    const actions=document.createElement('div');actions.className='actions';const label=document.createElement('span');label.textContent='1280 × 720 · video only';const copy=document.createElement('button');copy.textContent='Copy OBS link';copy.setAttribute('aria-label',`Copy OBS link for ${channel.name}`);copy.onclick=async()=>{try{await api.copy(channel.url);notice(`${channel.name} link copied. Paste it into an OBS Browser Source at 1280 × 720.`);}catch(error){notice(message(error),true);}};actions.append(label,copy);card.append(top,canvas,actions);return card;
  }));
}
async function load(){
  if(busy)return;controls(true);notice('Preparing the environment and checking its media…');let next;
  try{
    const snapshot=await api.load($('environment').value);
    next=await new LiveRuntime(snapshot,({frame,tracks,ms})=>{
      if(runtime!==next)return;imageFrames();$('source').getContext('2d').drawImage(frame,0,0,640,360);frames++;if(performance.now()-lastStats>1000){$('tracking').textContent=`${tracks.filter(t=>runtime.env.markers.some(m=>m.id===t.id)).length}/${runtime.env.markers.length} markers · ${Math.round(frames*1000/(performance.now()-lastStats))} fps`;lastStats=performance.now();frames=0;}
    },error=>{pause();notice(`Output paused: ${message(error)}`,true);}).init();
    next.input(mode,$('webcam'));const list=await api.channels(next.env.channels);const previous=runtime;runtime=next;closePeers();outputs(list);previous?.close();runtime.start();loadedRevision=snapshot.revision;
    $('active').textContent=runtime.env.name;notice(`${loadedRevision?`Cloud v${loadedRevision}`:'Sample environment'} loaded. ${mode==='camera'?'Webcam is live.':mode==='demo'?'Demo scene is running. Start your webcam when ready.':'Outputs are paused.'}`);
  }catch(error){if(next!==runtime)next?.close();notice(message(error),true);}finally{controls(false);}
}
function stopCamera(){cameraRequest++;$('camera').disabled=false;stream?.getTracks().forEach(t=>t.stop());stream=null;$('webcam').srcObject=null;$('devices').hidden=true;$('stop').hidden=true;}
function pause(){stopCamera();mode='paused';runtime?.input(mode);const ctx=$('source').getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,640,360);$('source-state').textContent='Paused · black output';}
async function startCamera(deviceId){
  const request=++cameraRequest;$('camera').disabled=true;$('stop').hidden=false;notice('Waiting for camera permission. Allow DigiPoly Live in the macOS prompt, or press Stop camera to cancel.');let acquired;
  try{
    const allowed=await api.cameraPermission();if(request!==cameraRequest)return;
    if(!allowed)throw new Error('Allow DigiPoly Live camera access in macOS System Settings → Privacy & Security → Camera.');
    notice('Connecting to your camera…');
    acquired=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30},...(deviceId?{deviceId:{exact:deviceId}}:{})},audio:false});
    if(request!==cameraRequest){acquired.getTracks().forEach(t=>t.stop());return;}
    const old=stream;stream=acquired;$('webcam').srcObject=stream;await $('webcam').play();if(request!==cameraRequest){acquired.getTracks().forEach(t=>t.stop());return;}old?.getTracks().forEach(t=>t.stop());
    mode='camera';runtime?.input(mode,$('webcam'));$('source-state').textContent='Webcam live';$('stop').hidden=false;
    const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');$('devices').replaceChildren(...devices.map((d,i)=>new Option(d.label||`Camera ${i+1}`,d.deviceId)));$('devices').value=stream.getVideoTracks()[0].getSettings().deviceId;$('devices').hidden=false;
    stream.getVideoTracks()[0].onended=()=>{if(mode==='camera'){pause();notice('Camera disconnected. Outputs are black until you reconnect or choose Demo scene.',true);}};notice('Webcam live. Both audiences share the same tracked frames. Add your microphone separately in OBS.');
  }catch(error){acquired?.getTracks().forEach(t=>t.stop());if(request===cameraRequest){pause();notice(message(error),true);}}finally{if(request===cameraRequest)$('camera').disabled=false;}
}
$('camera').onclick=()=>startCamera();$('devices').onchange=()=>startCamera($('devices').value);
$('stop').onclick=()=>{pause();notice('Camera stopped. Both outputs are black.');};
$('demo').onclick=()=>{stopCamera();mode='demo';runtime?.input(mode);$('source-state').textContent='Demo scene';notice('Demo scene selected. No camera is being captured.');};
$('load').onclick=load;$('portal').onclick=()=>api.portal();
$('signin').onclick=async()=>{controls(true);try{const identity=await api.signIn();notice(`Signed in as ${identity.email}. Download your cloud copy next.`);}catch(error){notice(message(error),true);}finally{controls(false);}};
$('sync').onclick=async()=>{controls(true);try{summary(await api.sync());notice(`Cloud v${info.revision} downloaded. Choose an environment and click Load environment to apply it. Current outputs continue unchanged.`);}catch(error){notice(message(error),true);}finally{controls(false);}};
if(!api)notice('Open this screen in the DigiPoly Live desktop app.',true);
else{
  api.onEvent(data=>{
    if(data.type==='image-demand'){imageChannels=data.channels;peerCount();}
    if(data.type==='peer')handlePeer(data);
    if(data.type==='answer')peers.get(data.id)?.setRemoteDescription(data.answer).catch(()=>removePeer(data.id));
    if(data.type==='leave')removePeer(data.id);
    if(data.type==='progress')notice(data.message);
    if(data.type==='environment'){if([...$('environment').options].some(o=>o.value===data.id)){$('environment').value=data.id;notice('Environment selected from the portal. Click Load environment when ready.');}else notice('Download your latest cloud copy to load the environment selected in the portal.');}
  });
  summary(await api.status());await load();
}
window.addEventListener('beforeunload',()=>{stopCamera();closePeers();runtime?.close();});
