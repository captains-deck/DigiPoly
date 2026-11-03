import * as W from '../src/workspace.mjs';
import {BackgroundLibrary} from '../src/backgrounds.mjs';
import {CameraCapture} from '../src/camera-capture.mjs';
import {WorkspaceRepository} from '../src/storage.mjs';
import {MediaLibrary} from '../src/media.mjs';
import {ChannelCompositor} from '../src/compositor.mjs';
import {DemoScene} from '../src/demo.mjs';
import {MARKERS} from '../src/marker.mjs';
import {homography,project} from '../src/geometry.mjs';
import {replaceBackground} from '../src/scenes.mjs';
const $=id=>document.getElementById(id);
function check(ok,message){const li=document.createElement('li');li.textContent=`${ok?'PASS':'FAIL'} — ${message}`;li.className=ok?'pass':'fail';$('results').append(li);if(!ok)throw new Error(message);}
const pixel=(canvas,x,y)=>canvas.getContext('2d',{willReadFrequently:true}).getImageData(Math.round(x),Math.round(y),1,1).data;
const near=(a,b)=>[0,1,2].every(i=>Math.abs(a[i]-b[i])<35);
const png=canvas=>new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
$('run').onclick=async()=>{
 $('run').disabled=true;$('results').replaceChildren();$('done').textContent='Running…';
 const backgrounds=new BackgroundLibrary(),media=new MediaLibrary(),dbName=`digipoly-room-verification-${crypto.randomUUID()}`;
 let worker,demo,compositor,repo,camera,restoredBackgrounds,lastFrame,simulationTimer;
 try{
  const state=W.createWorkspace(),env=state.environments.find(e=>e.template==='bedroom-v1'),[uk,es]=env.channels;
  const room=await backgrounds.load(env.scene.background);await Promise.all(W.BUILTIN_MEDIA.map(a=>media.load(a)));
  const images=await Promise.all(MARKERS.map(async m=>{const image=new Image();image.src=`/assets/brand/${m.slug}.svg`;await image.decode();return image;}));demo=new DemoScene(images);compositor=new ChannelCompositor(media);
  const source=document.createElement('canvas');source.width=1280;source.height=720;const ctx=source.getContext('2d');
  worker=new Worker('/src/tracker-worker.js');await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Worker timeout')),20000);worker.onmessage=({data})=>{if(data.type==='ready'){clearTimeout(timer);resolve();}else if(data.type==='error'){clearTimeout(timer);reject(Error(data.message));}};worker.onerror=e=>reject(Error(e.message));});
  async function detect(){const frame=await createImageBitmap(source);return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Detection timeout')),8000);worker.onmessage=({data})=>{clearTimeout(timer);if(data.type==='frame')resolve(data);else reject(Error(data.message));};worker.postMessage({type:'frame',frame,sequence:0},[frame]);});}
  for(const time of [0,4000,12000]){
   demo.draw(ctx,time,env.scene,room);const data=await detect();lastFrame?.close();lastFrame=data.frame;
   check(data.detections.length===2&&new Set(data.detections.map(d=>d.id)).size===2,`Poster and box identities detected during room drift at ${time} ms`);
   compositor.render(env,data.frame,data.detections);
   for(const [channel,target] of [[uk,'uk'],[es,'es']]){
    const output=compositor.ensure(env.id,channel.id).canvas;$(target).getContext('2d').drawImage(output,0,0);
    for(const track of data.detections){const asset=media.get(channel.assignments[track.id]),p=project(homography(track.corners),.9,.2);check(near(pixel(output,p.x,p.y),pixel(asset.raster,540,120)),`${channel.name}: correct ${track.id} artwork at ${time} ms`);}
    check(near(pixel(output,640,360),pixel(source,640,360)),`${channel.name}: room preserved outside placements at ${time} ms`);
   }
  }
  const upload=await backgrounds.fromFile(new File([await png(source)],'Room with printed markers.png',{type:'image/png'}));
  check(backgrounds.get(upload.background).naturalWidth===1280&&backgrounds.get(upload.background).naturalHeight===720,'Uploaded background is saved at output resolution');
  const stillScene=replaceBackground(env.scene,upload.background);stillScene.layout='photo';demo.draw(ctx,0,stillScene,backgrounds.get(upload.background));
  const photo=await detect();check(photo.detections.length===2,'Photo mode detects the two codes already in the image');photo.frame.close();
  const blank=document.createElement('canvas');blank.width=blank.height=300;blank.getContext('2d').fillStyle='#d14379';blank.getContext('2d').fillRect(0,0,300,300);
  const emptyUpload=await backgrounds.fromFile(new File([await png(blank)],'Blank.png',{type:'image/png'}));
  demo.draw(ctx,0,{...stillScene,background:emptyUpload.background},backgrounds.get(emptyUpload.background));const noMarkers=await detect();check(noMarkers.detections.length===0,'Photo mode does not insert demo markers into a marker-free image');noMarkers.frame.close();
  const video=document.createElement('video');video.muted=true;video.playsInline=true;const simulated=blank.captureStream(10);simulationTimer=setInterval(()=>blank.getContext('2d').fillRect(0,0,300,300),100);camera=new CameraCapture(video,async()=>simulated);await Promise.race([camera.start(),new Promise((_,reject)=>setTimeout(()=>reject(Error('Simulated video timeout')),8000))]);
  const captured=await backgrounds.fromSource(video,'capture','Simulated camera room');camera.stop();
  check(simulated.getTracks().every(t=>t.readyState==='ended'),'Camera still capture releases its owned video track');
  env.scene=stillScene;state.environments[0].scene=replaceBackground(state.environments[0].scene,captured.background);
  repo=await new WorkspaceRepository(dbName).open();await repo.save(state,{put:[upload.record,captured.record]});repo.close();repo=await new WorkspaceRepository(dbName).open();const restored=W.validateWorkspace(await repo.load());
  restoredBackgrounds=new BackgroundLibrary();for(const e of restored.environments)if(e.scene.background.assetId)await restoredBackgrounds.load(e.scene.background,await repo.getMedia(e.scene.background.assetId));
  check(restored.environments.find(e=>e.id===env.id).scene.layout==='photo','Background choice and marker source survive database reopen');
  check(JSON.stringify(restored.environments.find(e=>e.id===env.id).channels)===JSON.stringify(env.channels),'Background changes preserve audience media assignments');
  const restoredCamera=restoredBackgrounds.get(restored.environments[0].scene.background);ctx.drawImage(restoredCamera,0,0);check(near(pixel(source,640,360),[209,67,121]),'Captured still pixels survive database reopen independently of the room upload');
  $('done').textContent=`All ${$('results').children.length} room checks passed.`;
 }catch(error){$('done').textContent=`FAILED: ${error.message}`;}
 finally{clearInterval(simulationTimer);lastFrame?.close();worker?.terminate();camera?.stop();compositor?.close();demo?.planes.forEach(p=>p.dispose());backgrounds.close();restoredBackgrounds?.close();media.close();repo?.close();indexedDB.deleteDatabase(dbName);$('run').disabled=false;}
};
