import {encode} from '../vendor/ghostmarker/codec.mjs';
import {createTarget,imageBlob} from '../vendor/ghostmarker/browser.mjs';
import {createWorkspace,environment,addGhostMarker} from '../src/workspace.mjs';
import {LiveRuntime} from '../live/runtime.mjs';import {sha256} from '../src/cloud.mjs';
const results=document.getElementById('results'),previews=document.getElementById('previews');let runtime;
document.getElementById('run').onclick=async()=>{
 document.getElementById('run').disabled=true;results.textContent='Encoding the example…';runtime?.close();previews.replaceChildren();
 try{
 const target=await createTarget(await(await fetch('/assets/backgrounds/bedroom-stream.png')).blob(),{strength:96,mirror:true,name:'Browser test picture'});
 // Reproducible payloads let the browser check catch identity-dependent failures.
 const original=await createImageBitmap(await(await fetch(target.original)).blob()),tile=document.createElement('canvas');tile.width=target.width;tile.height=target.height;const ctx=tile.getContext('2d');ctx.drawImage(original,0,0);original.close();
 const encoded=encode(ctx.getImageData(0,0,tile.width,tile.height).data,tile.width,tile.height,{id:new URL(location.href).searchParams.get('id')||'GM-11223344',strength:target.strength,textured:true});ctx.putImageData(new ImageData(encoded.rgba,tile.width,tile.height),0,0);Object.assign(target,encoded,{image:tile.toDataURL('image/png')});
 const blob=await imageBlob(target),referenceId='ghostref-browser-test',workspace=createWorkspace(),env=environment(workspace);
 env.scene.layout='placed';env.scene.motion=false;addGhostMarker(workspace,env.id,{...target,label:target.name,kind:'ghost',referenceId});const id=target.id;
 env.channels[0].assignments[id]='uk-runner';env.channels[1].assignments[id]='es-sun';

 const url=URL.createObjectURL(blob),snapshot={workspace,files:{[referenceId]:{url,size:blob.size,type:'image/png',hash:await sha256(blob)}}};let count=0,ghostFrames=0,both=0;
 runtime=await new LiveRuntime(snapshot,({tracks,ms})=>{count++;ghostFrames+=tracks.some(t=>t.id===id&&t.locked)?1:0;both+=tracks.some(t=>t.id==='DP-002')&&tracks.some(t=>t.id===id)?1:0;results.textContent=JSON.stringify({frames:count,ghostLockedFrames:ghostFrames,codedAndGhostFrames:both,detectionMs:Math.round(ms),tracks:tracks.map(t=>({id:t.id,status:t.status,confidence:t.confidence}))},null,2);if(count===12){clearInterval(runtime.timer);const a=runtime.compositor.ensure(env.id,env.channels[0].id).canvas,b=runtime.compositor.ensure(env.id,env.channels[1].id).canvas;previews.append(a,b);const ca=a.getContext('2d').getImageData(650,150,1,1).data,cb=b.getContext('2d').getImageData(650,150,1,1).data,distinct=ca.some((x,i)=>x!==cb[i]);results.textContent+='\n'+JSON.stringify({pass:ghostFrames>=8&&both>=8&&distinct,distinctAudiencePixels:distinct});document.getElementById('run').disabled=false;URL.revokeObjectURL(url);}},error=>{results.textContent+='\nERROR '+error.message;document.getElementById('run').disabled=false;}).init();runtime.start();
 }catch(e){results.textContent='FAIL '+e.stack;document.getElementById('run').disabled=false;}
};window.addEventListener('beforeunload',()=>runtime?.close());
