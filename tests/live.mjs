import {LiveRuntime} from '../live/runtime.mjs';
import {createWorkspace} from '../src/workspace.mjs';
import {gather} from '../live/peer.mjs';
import {CloudClient} from '../src/cloud.mjs';
const result=document.getElementById('result');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
document.getElementById('run').onclick=async()=>{
  const peers=[],videos=[];let runtime,timer,feed;const lines=[];let passed=0,tracked=0,frameCount=0;
  const check=(condition,name)=>{if(!condition)throw new Error(name);passed++;lines.push('PASS '+name);result.textContent=lines.join('\n');};
  document.getElementById('run').disabled=true;
  try{
    // Exercise the default browser fetch path: an unbound Window.fetch fails here.
    const old=globalThis.fetch;let called=false;globalThis.fetch=function(...args){if(this!==globalThis)throw new Error('Illegal invocation');called=true;return Promise.resolve(Response.json({email:'test@example.test'}));};
    try{await new CloudClient().me();check(called,'cloud requests retain the browser fetch receiver');}finally{globalThis.fetch=old;}
    const workspace=createWorkspace();runtime=await new LiveRuntime({workspace,files:{},revision:1},({tracks})=>{tracked=Math.max(tracked,tracks.length);frameCount++;},error=>{throw error;}).init();runtime.start();
    for(const channel of runtime.env.channels){
      const sender=new RTCPeerConnection({iceServers:[]}),receiver=new RTCPeerConnection({iceServers:[]}),video=document.createElement('video');video.autoplay=true;video.muted=true;video.playsInline=true;video.width=480;videos.push(video);document.getElementById('previews').append(video);peers.push(sender,receiver);
      receiver.ontrack=event=>{video.srcObject=event.streams[0];video.play().catch(()=>{});};const output=runtime.stream(channel.id);for(const track of output.getTracks())sender.addTrack(track,output);
      await sender.setLocalDescription(await sender.createOffer());await gather(sender);await receiver.setRemoteDescription(sender.localDescription);await receiver.setLocalDescription(await receiver.createAnswer());await gather(receiver);await sender.setRemoteDescription(receiver.localDescription);
    }
    for(let i=0;i<50&&!videos.every(v=>v.videoWidth===1280&&v.videoHeight===720);i++)await sleep(200);
    check(tracked===2,'real detector locks both border-coded markers');check(videos.every(v=>v.videoWidth===1280&&v.videoHeight===720),`both WebRTC receivers receive 1280 × 720 video (${videos.map(v=>`${v.videoWidth}×${v.videoHeight}`).join(', ')}; ${peers.map(p=>p.connectionState).join(', ')})`);
    const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;const ctx=canvas.getContext('2d',{willReadFrequently:true});
    const pixels=videos.map(v=>{ctx.drawImage(v,0,0);return ctx.getImageData(0,0,1280,720).data;});let differences=0;for(let i=0;i<pixels[0].length;i+=4)if(Math.abs(pixels[0][i]-pixels[1][i])>25)differences++;
    check(differences>10000,'UK and Spanish receivers show different campaign content');
    const source=document.createElement('canvas');source.width=1280;source.height=720;const sourceCtx=source.getContext('2d');timer=setInterval(()=>runtime.demo.draw(sourceCtx,performance.now(),runtime.env.scene,undefined,runtime.env.markers.map(m=>m.id)),34);feed=source.captureStream(30);const camera=document.createElement('video');camera.muted=true;camera.srcObject=feed;await camera.play();runtime.input('camera',camera);const before=frameCount;tracked=0;await sleep(1500);
    check(frameCount>before+10&&tracked===2,'camera-input path tracks moving markers from an actual video stream');
    for(const receiver of [peers[1],peers[3]]){const stats=await receiver.getStats();check([...stats.values()].some(s=>s.type==='inbound-rtp'&&s.kind==='video'&&s.framesDecoded>20),'receiver continuously decodes audience frames');}
    runtime.input('paused');await sleep(500);ctx.drawImage(videos[0],0,0);const black=ctx.getImageData(640,360,1,1).data;check(black[0]<5&&black[1]<5&&black[2]<5,'stopping input clears output to black');
    result.textContent=lines.join('\n')+`\n${passed} checks passed.`;
  }catch(error){result.textContent=lines.join('\n')+'\nFAIL '+error.message;}
  finally{clearInterval(timer);feed?.getTracks().forEach(t=>t.stop());peers.forEach(p=>p.close());runtime?.close();document.getElementById('run').disabled=false;}
};
