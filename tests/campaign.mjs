import * as W from '../src/workspace.mjs';
import {WorkspaceRepository} from '../src/storage.mjs';
import {MediaLibrary} from '../src/media.mjs';
import {ChannelCompositor} from '../src/compositor.mjs';
import {DemoScene} from '../src/demo.mjs';
import {MARKERS} from '../src/marker.mjs';
import {homography,project} from '../src/geometry.mjs';
const $=id=>document.getElementById(id);
function check(condition,message){const li=document.createElement('li');li.textContent=`${condition?'PASS':'FAIL'} — ${message}`;li.className=condition?'pass':'fail';$('results').append(li);if(!condition)throw new Error(message);}
const pixel=(canvas,x,y)=>canvas.getContext('2d',{willReadFrequently:true}).getImageData(Math.round(x),Math.round(y),1,1).data;
const near=(a,b)=>[0,1,2].every(i=>Math.abs(a[i]-b[i])<35);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const blob=canvas=>new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
async function sampleVideo(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=120;const ctx=canvas.getContext('2d');ctx.fillStyle='#ed4040';ctx.fillRect(0,0,120,120);
 const stream=canvas.captureStream(20),mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp8')?'video/webm;codecs=vp8':'video/webm',recorder=new MediaRecorder(stream,{mimeType:mime}),chunks=[];
 const complete=new Promise(resolve=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=()=>resolve(new File(chunks,'Campaign video test.webm',{type:'video/webm'}));});recorder.start();
 await pause(350);ctx.fillStyle='#3055ef';ctx.fillRect(0,0,120,120);await pause(350);recorder.stop();const file=await complete;stream.getTracks().forEach(t=>t.stop());return file;
}
$('run').onclick=async()=>{
 $('run').disabled=true;$('results').replaceChildren();$('done').textContent='Running…';
 let worker,repo,compositor,library=new MediaLibrary(),restoredLibrary,dbName=`digipoly-verification-${crypto.randomUUID()}`,demo;
 try{
  const state=W.createWorkspace(),env=W.environment(state),[uk,es]=env.channels;
  await Promise.all(W.BUILTIN_MEDIA.map(a=>library.load(a)));
  const images=await Promise.all(MARKERS.map(async m=>{const im=new Image();im.src=`/assets/brand/${m.slug}.svg`;await im.decode();return im;}));demo=new DemoScene(images);compositor=new ChannelCompositor(library);
  const source=document.createElement('canvas');source.width=1280;source.height=720;const ctx=source.getContext('2d');
  worker=new Worker('/src/tracker-worker.js');await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Worker timeout')),20000);worker.onmessage=({data})=>{if(data.type==='ready'){clearTimeout(timer);resolve();}else if(data.type==='error'){clearTimeout(timer);reject(new Error(data.message));}};worker.onerror=e=>reject(new Error(e.message));});
  let lastFrame,lastDetections;
  for(const time of [0,4488,8976]){
   demo.draw(ctx,time);const frame=await createImageBitmap(source);
   const data=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Detection timeout')),8000);worker.onmessage=({data})=>{clearTimeout(timer);if(data.type==='frame')resolve(data);else reject(new Error(data.message));};worker.postMessage({type:'frame',frame,sequence:time},[frame]);});
   check(data.detections.length===2,`Two marker identities detected at ${time} ms`);
   compositor.render(env,data.frame,data.detections);
   for(const [channel,target] of [[uk,'uk'],[es,'es']]){
    const output=compositor.ensure(env.id,channel.id).canvas;$(target).getContext('2d').drawImage(output,0,0);
    for(const track of data.detections){const media=library.get(channel.assignments[track.id]),p=project(homography(track.corners),.9,.2);check(near(pixel(output,p.x,p.y),pixel(media.raster,540,120)),`${channel.name} carries its own ${track.id} media at ${time} ms`);}
    check(near(pixel(output,15,300),pixel(source,15,300)),`${channel.name} preserves the shared source outside placements`);
   }
   lastFrame?.close();lastFrame=data.frame;lastDetections=data.detections;
  }
  const ukStream=compositor.stream(env.id,uk.id),esStream=compositor.stream(env.id,es.id);check(ukStream.getVideoTracks()[0].id!==esStream.getVideoTracks()[0].id&&ukStream.getAudioTracks().length===0&&esStream.getAudioTracks().length===0,'Audience outputs have separate video tracks and no audio');
  const originalSpanish=JSON.stringify(es.assignments);W.assignMedia(state,env.id,uk.id,'DP-001','portal');compositor.render(env,lastFrame,lastDetections);check(JSON.stringify(es.assignments)===originalSpanish,'Changing UK content leaves Spanish assignments intact');
  compositor.activate(state.environments[1].id);check(pixel(compositor.ensure(env.id,uk.id).canvas,640,360)[0]===0,'Inactive environment output is cleared rather than showing another environment');
  compositor.render(env,lastFrame,lastDetections);check(compositor.stream(env.id,uk.id)===ukStream,'Returning to an environment resumes the same bound output stream');
  repo=await new WorkspaceRepository(dbName).open();const imageCanvas=document.createElement('canvas');imageCanvas.width=imageCanvas.height=100;imageCanvas.getContext('2d').fillStyle='#e53174';imageCanvas.getContext('2d').fillRect(0,0,100,100);
  const uploaded=await library.import(new File([await blob(imageCanvas)],'Campaign image test.png',{type:'image/png'}));state.media.push(uploaded.metadata);W.assignMedia(state,env.id,uk.id,'DP-001',uploaded.metadata.id);W.assignMedia(state,state.environments[1].id,state.environments[1].channels[0].id,'DP-002',uploaded.metadata.id);
  const video=await library.import(await sampleVideo());state.media.push(video.metadata);W.assignMedia(state,env.id,es.id,'DP-002',video.metadata.id);
  await repo.save(state,{put:[uploaded.record,video.record]});repo.close();repo=await new WorkspaceRepository(dbName).open();const restored=W.validateWorkspace(await repo.load());
  check(restored.environments[0].channels[0].assignments['DP-001']===uploaded.metadata.id,'Environment and channel assignments survive database reopen');
  check(W.mediaUsage(restored,uploaded.metadata.id).length===2,'One saved upload is reusable across environments');
  const imageRecord=await repo.getMedia(uploaded.metadata.id),videoRecord=await repo.getMedia(video.metadata.id);check(imageRecord.blob.size>0&&videoRecord.blob.size>0,'Image and video bytes persist with the workspace');
  restoredLibrary=new MediaLibrary();const restoredImage=await restoredLibrary.load(uploaded.metadata,imageRecord),restoredVideo=await restoredLibrary.load(video.metadata,videoRecord);
  check(near(pixel(restoredImage.raster,10,10),[229,49,116]),'Stored image decodes back to the original pixels');check(restoredVideo.element.muted&&restoredVideo.element.loop,'Imported video is muted and loops');
  const v=library.get(video.metadata.id).element;v.pause();v.currentTime=.05;await new Promise(resolve=>v.addEventListener('seeked',resolve,{once:true}));compositor.render(env,lastFrame,lastDetections);const track=lastDetections.find(t=>t.id==='DP-002'),point=project(homography(track.corners),.5,.5),before=pixel(compositor.ensure(env.id,es.id).canvas,point.x,point.y);
  v.currentTime=.5;await new Promise(resolve=>v.addEventListener('seeked',resolve,{once:true}));compositor.render(env,lastFrame,lastDetections);const after=pixel(compositor.ensure(env.id,es.id).canvas,point.x,point.y);check(before[0]>150&&after[2]>150&&!near(before,after),'Video frames update inside the tracked marker');
  const still=pixel(compositor.ensure(env.id,uk.id).canvas,...Object.values(project(homography(lastDetections.find(t=>t.id==='DP-001').corners),.5,.5)));check(near(still,[229,49,116]),'Video in one audience does not replace another audience’s image');
  W.removeMedia(restored,uploaded.metadata.id);await repo.save(restored,{remove:[uploaded.metadata.id]});check(!(await repo.getMedia(uploaded.metadata.id))&&W.mediaUsage(await repo.load(),uploaded.metadata.id).length===0,'Removing shared media clears its bytes and all assignment references together');
  W.removeChannel(state,env.id,es.id);compositor.prune(state);check(!esStream.active&&ukStream.active,'Removing one channel stops only that channel’s output');lastFrame.close();
  $('done').textContent=`All ${$('results').children.length} campaign checks passed.`;
 }catch(error){$('done').textContent=`FAILED: ${error.message}`;}
 finally{worker?.terminate();compositor?.close();demo?.planes.forEach(p=>p.dispose());library.close();restoredLibrary?.close();repo?.close();indexedDB.deleteDatabase(dbName);$('run').disabled=false;}
};
