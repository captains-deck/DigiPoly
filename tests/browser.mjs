import {DemoScene} from '../src/demo.mjs';
import {PlaneRenderer} from '../src/renderer.mjs';
import {homography,project} from '../src/geometry.mjs';
import {MARKERS} from '../src/marker.mjs';
import {MarkerAssignments} from '../src/tracks.mjs';
const list=document.getElementById('results'),canvas=document.getElementById('scene'),ctx=canvas.getContext('2d',{willReadFrequently:true});
function check(condition,text){const li=document.createElement('li');li.textContent=`${condition?'PASS':'FAIL'} — ${text}`;li.className=condition?'pass':'fail';list.append(li);if(!condition)throw new Error(text);}
async function image(url){const im=new Image();im.src=url;await im.decode();return im;}
let worker;
try{
  const images=await Promise.all(MARKERS.map(m=>image(`/assets/brand/${m.slug}.svg`))),demo=new DemoScene(images),assignments=new MarkerAssignments();
  assignments.set('DP-001','on-air');assignments.set('DP-002','next-wave');
  const artwork=new Map(),planes=new Map();
  for(const marker of MARKERS){const key=assignments.get(marker.id),im=await image(`/assets/artwork/${key}.svg`),plane=new PlaneRenderer();plane.setImage(im);artwork.set(key,im);planes.set(marker.id,plane);}
  worker=new Worker('/src/tracker-worker.js');
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Worker timeout')),15000);worker.onmessage=({data})=>{if(data.type==='ready'){clearTimeout(timer);resolve();}if(data.type==='error'){clearTimeout(timer);reject(new Error(data.message));}};worker.onerror=e=>reject(new Error(e.message));});
  check(true,'OpenCV loads locally in its worker');
  let firstX;
  for(const time of [0,1500,4488,6500,8976,12500]){
    demo.draw(ctx,time);const frame=await createImageBitmap(canvas);
    const result=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Frame timeout')),5000);worker.onmessage=({data})=>{clearTimeout(timer);if(data.type==='frame')resolve(data);else if(data.type==='error')reject(new Error(data.message));};worker.postMessage({type:'frame',frame,sequence:time},[frame]);});
    check(result.detections.length===2,`Both rendered border identities detected at ${time} ms`);
    ctx.drawImage(result.frame,0,0);result.frame.close();
    const x=result.detections.find(d=>d.id==='DP-001').corners.reduce((sum,p)=>sum+p.x,0)/4;
    if(time===0)firstX=x;if(time===8976)check(x>firstX+400,'DP-001 has crossed to the opposite side without changing identity');
    for(const detection of result.detections){
      const key=assignments.get(detection.id),im=artwork.get(key),overlay=planes.get(detection.id).draw(detection.corners);ctx.drawImage(overlay,0,0);
      const reference=document.createElement('canvas');reference.width=reference.height=600;const referenceCtx=reference.getContext('2d',{willReadFrequently:true});referenceCtx.drawImage(im,0,0,600,600);
      const point=project(homography(detection.corners),.2,.2),expected=referenceCtx.getImageData(120,120,1,1).data,actual=ctx.getImageData(Math.round(point.x),Math.round(point.y),1,1).data;
      check([0,1,2].every(i=>Math.abs(actual[i]-expected[i])<35),`${detection.id} carries its own ${key} content at ${time} ms`);
    }
  }
  const stream=canvas.captureStream(30);check(stream.getVideoTracks().length===1&&stream.getAudioTracks().length===0,'One clean combined video stream contains both placements');stream.getTracks().forEach(t=>t.stop());
  document.getElementById('done').textContent='All two-marker browser checks passed.';
}catch(error){document.getElementById('done').textContent=`FAILED: ${error.message}`;}finally{worker?.terminate();}
