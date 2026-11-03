import {DemoScene} from './demo.mjs';
import {BackgroundLibrary} from './backgrounds.mjs';
import {CameraCapture} from './camera-capture.mjs';
import {PlacementEditor} from './placement-editor.mjs';
import {defaultScene,bedroomScene,replaceBackground,backgroundReferences,drawCover} from './scenes.mjs';
import {MARKERS} from './marker.mjs';
import {AllTracks as MarkerTracks} from './all-tracks.mjs';
import {GhostLibrary,ghostDialog} from './ghosts.mjs';
import {imageBlob} from '../vendor/ghostmarker/browser.mjs';
import {ChannelCompositor} from './compositor.mjs';
import {MediaLibrary} from './media.mjs';
import {WorkspaceRepository} from './storage.mjs';
import * as W from './workspace.mjs';
import {CloudClient} from './cloud.mjs';

const $=id=>document.getElementById(id),width=1280,height=720;
const source=document.createElement('canvas');source.width=width;source.height=height;
const sourceCtx=source.getContext('2d'),sourcePreview=$('source-preview').getContext('2d'),video=$('camera');
const backgrounds=new BackgroundLibrary(),capture=new CameraCapture($('capture-preview'));
let placementEditor,backgroundTarget=null,captureTarget=null,backgroundBusy=false;
const ghosts=new GhostLibrary();
const library=new MediaLibrary(),tracks=new MarkerTracks(),channelViews=new Map();
let state,repo,compositor,worker,demo,stream=null,mode='demo',ready=false,pending=false,generation=0,cameraRequest=0,disposed=false,tab='studio';
let frameCount=0,lastStats=performance.now(),lastSend=0,saveSerial=0,storageAvailable=true;
const env=()=>W.environment(state);
const cloud=new CloudClient();let cloudUser=null,cloudRevision=null,cloudBusy=false;
const cloudStatus=message=>{$('cloud-status').textContent=message;};
function cloudButtons(){for(const id of ['cloud-save','cloud-load'])$(id).disabled=cloudBusy||!cloudUser||!storageAvailable;$('cloud-save').disabled ||= cloudRevision===null;}
async function initCloud(){
  try{
    $('cloud-restore').hidden=!await repo.metadata('before-cloud-load');
    cloudUser=await cloud.me();const [remote,sync]=await Promise.all([cloud.load(),repo.metadata('cloud-sync')]);
    cloudRevision=sync?.user===cloudUser.id?sync.revision:remote.revision===0?0:null;
    cloudStatus(`${cloudUser.email} · ${remote.revision?`Cloud v${remote.revision}${cloudRevision===null?' · load to continue':''}`:'Ready for your first cloud save'}`);
  }catch(error){cloudStatus(location.hostname==='digipoly.co.uk'?`Cloud unavailable: ${error.message} Reload to reconnect.`:'Local copy · open digipoly.co.uk/studio to save online');}finally{cloudButtons();}
}
async function saveCloud(){
  if(cloudBusy||cloudRevision===null)return;cloudBusy=true;cloudButtons();const snapshot=structuredClone(state),serial=saveSerial;
  try{
    const result=await cloud.save(snapshot,cloudRevision,id=>repo.getMedia(id),cloudStatus);cloudRevision=result.revision;
    await repo.save(state,{metadata:{'cloud-sync':{user:cloudUser.id,revision:result.revision}}});
    cloudStatus(`Cloud v${result.revision} saved · ${serial===saveSerial?'Ready to load in DigiPoly Live':'New local changes still need saving'}`);
  }catch(error){cloudStatus(error.message);if(error.status===409)cloudRevision=null;}finally{cloudBusy=false;cloudButtons();}
}
function loadCloud(){
  modal({title:'Load your cloud workspace?',description:'This replaces the local environments and library with your latest cloud save. A recovery copy of the current workspace is kept on this device.',submit:'Load cloud copy',onSubmit:async()=>{
    cloudBusy=true;cloudButtons();try{
      const remote=await cloud.load();if(!remote.workspace)throw new Error('Save a workspace to the cloud first.');
      const next=W.validateWorkspace(remote.workspace),put=await cloud.records(remote,cloudStatus);
      await repo.save(next,{put,metadata:{'before-cloud-load':{workspace:structuredClone(state),sync:await repo.metadata('cloud-sync')},'cloud-sync':{user:cloudUser.id,revision:remote.revision}}});
      location.reload();
    }finally{cloudBusy=false;cloudButtons();}
  }});
}
function notice(message,error=false){$('notice').textContent=message;$('notice').classList.toggle('error',error);}
function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
function button(text,className,onClick){const node=element('button',className,text);node.type='button';node.onclick=onClick;return node;}
function markerImage(id){const marker=MARKERS.find(m=>m.id===id),im=element('img');const placement=env().markers.find(m=>m.id===id);im.src=marker?`/assets/brand/${marker.slug}-print.svg`:ghosts.get(placement)?.image||'/assets/brand/portal-marker.svg';im.alt=`${id} ${marker?'coded marker':'GhostMarker picture'}`;return im;}
async function persist(options){
  const serial=++saveSerial;$('save-status').textContent='Saving…';
  if(!storageAvailable){$('save-status').textContent='Session only · not saved';return;}
  try{await repo.save(state,options);if(serial===saveSerial)$('save-status').textContent='Saved on this device';}
  catch(error){$('save-status').textContent='Changes not saved';notice(`Could not save locally: ${error.message} Keep this tab open; your current changes are still here.`,true);throw error;}
}
function save(){persist().catch(()=>{});}
function syncMedia(){if(!state)return;const e=env(),ids=e.channels.flatMap(c=>e.markers.map(m=>c.assignments[m.id]).filter(Boolean));library.syncPlayback(ids).then(blocked=>{if(blocked.length)notice('Video playback is paused by the browser. Click a media assignment or switch to Live studio to retry.',true);});}
function configureGhosts(){if(!state)return;const e=env();demo?.setGhosts(e.markers.filter(m=>m.kind==='ghost').flatMap(m=>ghosts.get(m)?[ghosts.get(m)]:[]));worker?.postMessage({type:'ghost-config',targets:ghosts.forEnvironment(e)});}
function switchEnvironment(id){state.activeEnvironmentId=id;generation++;tracks.reset();compositor.activate(id);configureGhosts();sourcePreview.clearRect(0,0,640,360);showTab('studio');refresh();save();syncMedia();notice(`${env().name} is active. Its channels share the current ${mode==='demo'?'demo':'camera'} input.`);}
function showTab(name){tab=name;$('studio-view').hidden=name!=='studio';$('library-view').hidden=name!=='media';for(const key of ['studio','media']){$(`${key}-tab`).classList.toggle('active',key===name);$(`${key}-tab`).setAttribute('aria-pressed',String(key===name));}if(name==='media')libraryUI();syncMedia();}
function environmentUI(){
  $('open-live').href=`digipoly-live://environment/${encodeURIComponent(env().id)}`;
  $('environment-count').textContent=state.environments.length;$('environment-title').textContent=env().name;$('environment-description').textContent=env().description||'A physical scene with its own markers and audience channels.';
  $('environment-list').replaceChildren(...state.environments.map(e=>{const node=button('',`environment ${e.id===state.activeEnvironmentId?'active':''}`,()=>switchEnvironment(e.id));node.setAttribute('aria-pressed',String(e.id===state.activeEnvironmentId));node.setAttribute('aria-label',`Open environment ${e.name}`);const copy=element('span');copy.append(element('strong','',e.name),element('small','',`${e.channels.length} channels · ${e.markers.length} markers`));node.append(element('span','env-icon','◈'),copy);return node;}));
}
function channelUI(){
  const e=env(),media=W.allMedia(state);channelViews.clear();$('channel-count').textContent=e.channels.length;$('new-channel').disabled=e.channels.length>=W.LIMITS.channels;
  $('channel-grid').replaceChildren(...e.channels.map((channel,i)=>{
    const card=element('article','channel-card');card.style.setProperty('--accent',i%2?'#ac87ec':'#69d3c0');card.style.setProperty('--tint',i%2?'#f1ebfc':'#e7f5f1');
    const top=element('div','channel-top'),title=element('div','channel-title');title.append(element('h3','',channel.name),element('p','',[channel.country,channel.language].filter(Boolean).join(' · ')||'Custom audience'));
    const edit=button('•••','icon-button',()=>editChannel(channel.id));edit.setAttribute('aria-label',`Edit channel ${channel.name}`);top.append(element('span','channel-icon',`CH ${String(i+1).padStart(2,'0')}`),title,edit);
    const screen=element('div','channel-screen'),canvas=element('canvas');canvas.width=width;canvas.height=height;canvas.setAttribute('aria-label',`${channel.name} campaign preview`);channelViews.set(channel.id,canvas.getContext('2d'));
    const label=element('span','screen-label');label.append(element('i'),document.createTextNode('AUDIENCE PREVIEW'));screen.append(canvas,label);
    const actions=element('div','channel-actions'),open=button('↗ Clean output','button',()=>openOutput(e.id,channel.id));open.disabled=!ready;open.dataset.outputButton='';open.setAttribute('aria-label',`Open clean output for ${channel.name}`);actions.append(element('span','',`${channel.language||'Audience'} edition · video only`),open);
    const assignments=element('div','assignments');
    if(!e.markers.length)assignments.append(element('p','hint','Add an environment marker to place campaign media.'));
    for(const marker of e.markers){
      const row=element('div','assignment-row'),label=element('label','',marker.label);label.append(element('small','',marker.id));
      const select=element('select');select.id=`assignment-${channel.id}-${marker.id}`;select.setAttribute('aria-label',`${channel.name}: ${marker.label} (${marker.id}) media`);label.htmlFor=select.id;select.append(new Option('Original marker / no media',''));
      for(const asset of media){const option=new Option(`${asset.kind==='video'?'▶ ':''}${asset.name}${library.get(asset.id)?'':' (unavailable)'}`,asset.id);option.disabled=!library.get(asset.id);select.append(option);}select.value=channel.assignments[marker.id]||'';
      select.onchange=()=>{W.assignMedia(state,e.id,channel.id,marker.id,select.value);save();syncMedia();notice(`${channel.name} · ${marker.label}: ${media.find(m=>m.id===select.value)?.name||'original marker'}.`);};
      row.append(markerImage(marker.id),label,select);assignments.append(row);
    }
    const footer=element('div','assignment-footer');footer.append(element('span','','CONTENT FOLLOWS THE MARKER ID'),button('Browse media ↗','text-button',()=>showTab('media')));assignments.append(footer);card.append(top,screen,actions,assignments);return card;
  }));
}
function markersUI(){
  $('new-marker').disabled=MARKERS.every(m=>env().markers.some(p=>p.id===m.id));$('new-ghost').disabled=env().markers.filter(m=>m.kind==='ghost').length>=W.LIMITS.ghostMarkers;
  $('marker-list').replaceChildren(...env().markers.map(marker=>{const row=element('div','marker-row'),info=element('div','marker-info');info.append(element('strong','',marker.label),element('p','',`${marker.id} · ${marker.kind==='ghost'?'GhostMarker · reference-assisted':marker.id==='DP-001'?'Cyan tracking guide':'Purple tracking guide'}`));const status=element('span','marker-status','Looking for marker…');status.id=`status-${marker.id}`;info.append(status);const edit=button('Edit','text-button',()=>editMarker(marker.id));edit.setAttribute('aria-label',`Edit marker ${marker.id}`);const actions=element('div','ghost-marker-actions');actions.append(edit);if(marker.kind==='ghost'){actions.append(button('PNG','text-button',()=>ghosts.print(marker).catch(e=>notice(e.message,true))),button('Target file','text-button',()=>ghosts.export(marker).catch(e=>notice(e.message,true))));}row.append(markerImage(marker.id),info,actions);return row;}));
  if(!env().markers.length)$('marker-list').append(element('p','empty','No placements yet. Add a coded marker to get started.'));
}
function libraryUI(){
  if(!state)return;const all=W.allMedia(state),search=$('media-search').value.toLocaleLowerCase().trim(),shown=all.filter(a=>`${a.name} ${a.audience||''} ${a.kind}`.toLocaleLowerCase().includes(search));
  $('media-count').textContent=all.length;$('library-summary').textContent=`${state.media.length} uploaded · ${W.BUILTIN_MEDIA.length} studio samples`;$('empty-media').hidden=shown.length!==0;
  $('media-grid').replaceChildren(...shown.map(asset=>{const card=element('article','media-card'),picture=element('div','media-picture'),runtime=library.get(asset.id);if(runtime){const im=element('img');im.src=runtime.posterUrl;im.alt=asset.name;picture.append(im);}else picture.append(element('span','missing','Media unavailable in this browser'));
    picture.append(element('span','media-kind',asset.kind==='video'?'▶ LOOPING VIDEO':'IMAGE'));
    const info=element('div','media-info');info.append(element('h3','',asset.name),element('p','',asset.audience||`${(asset.size/1024/1024).toFixed(1)} MB · Your upload`),element('p','',`${W.mediaUsage(state,asset.id).length} campaign placements`));
    if(!W.BUILTIN_MEDIA.some(m=>m.id===asset.id))info.append(button('Remove from library','text-button danger',()=>deleteMedia(asset.id)));else info.append(element('p','','Included studio sample'));
    card.append(picture,info);return card;
  }));
}
function sceneUI(){
  if(!state)return;const e=env(),scene=e.scene;
  $('background-name').textContent=scene.background.name||'Environment background';
  $('background-hint').textContent=scene.layout==='photo'?'Saved still: DigiPoly detects the printed markers already in this image.':scene.background.type==='grid'?'Choose a room image or capture a camera still, then position your demo markers.':'A saved room scene with real coded demo markers. Both audience editions share this layout.';
  const ctx=$('background-preview').getContext('2d'),image=backgrounds.get(scene.background);
  ctx.fillStyle='#142134';ctx.fillRect(0,0,320,180);
  if(image)drawCover(ctx,image,320,180);else{ctx.fillStyle='#90a6c1';ctx.font='12px sans-serif';ctx.fillText(scene.background.type==='grid'?'Moving marker studio':'Background unavailable',23,94);}
  $('scene-layout').value=scene.layout;$('scene-layout').querySelector('[value="moving"]').disabled=scene.background.type!=='grid';
  $('scene-motion').checked=scene.motion;$('scene-motion').disabled=scene.layout==='moving';
  $('background-layout-button').disabled=!placementEditor||!ready||!e.markers.length;
  for(const id of ['background-upload-button','background-capture-button','background-reset-button'])$(id).disabled=backgroundBusy;
}
function sceneChanged(id){W.ensureGhostPlacements(W.environment(state,id));if(state.activeEnvironmentId===id){startDemo();tracks.reset();generation++;sceneUI();}notice('Environment background and marker layout updated.');}
async function pruneBackground(id){if(!id||backgroundReferences(state,id))return;try{await persist({remove:[id]});backgrounds.release(id);}catch{}}
async function saveBackground(id,prepared){
  if(!storageAvailable)throw new Error('Local storage is unavailable. Reload before saving a background.');
  const target=W.environment(state,id),oldId=target.scene.background.assetId,next=structuredClone(state);
  W.environment(next,id).scene=replaceBackground(target.scene,prepared.background);
  // Save the file before exposing it to subsequent workspace saves.
  try{await repo.save(next,{put:[prepared.record]});}catch(error){backgrounds.release(prepared.background.assetId);throw error;}
  const current=state.environments.find(e=>e.id===id);
  if(!current){await pruneBackground(prepared.background.assetId);return;}
  current.scene=replaceBackground(current.scene,prepared.background);await persist();sceneChanged(id);await pruneBackground(oldId);
}
async function openCapture(){
  if(backgroundBusy)return;captureTarget=env().id;$('capture-dialog').showModal();$('capture-status').textContent='Opening camera…';$('capture-save').disabled=true;
  try{const started=await capture.start(mode==='camera'?stream:null);if(started&&$('capture-dialog').open){$('capture-status').textContent='Frame your room. Only the still you capture will be saved on this device.';$('capture-save').disabled=false;}}
  catch(error){if($('capture-dialog').open)$('capture-status').textContent=error.name==='NotAllowedError'?'Camera permission was declined. Allow camera access in your browser, then reopen capture.':`Camera could not start: ${error.message}`;}
}
function refresh(){environmentUI();channelUI();markersUI();libraryUI();sceneUI();compositor?.prune(state);}
function modal({title,description='',fields=[],submit='Save',extra,onSubmit}){
  const dialog=$('editor');$('editor-title').textContent=title;$('editor-description').textContent=description;$('editor-error').textContent='';$('editor-submit').textContent=submit;$('editor-extra').hidden=!extra;
  if(extra){$('editor-extra').textContent=extra.label;$('editor-extra').onclick=()=>{dialog.close();extra.action();};}
  $('editor-fields').replaceChildren(...fields.map(field=>{const label=element('label','',field.label),input=element(field.options?'select':'input');input.name=field.name;if(field.options)for(const option of field.options)input.append(new Option(option.label,option.value));else{input.type='text';input.maxLength=80;}input.value=field.value||'';input.required=Boolean(field.required);label.append(input);return label;}));
  $('editor').oncancel=event=>{if($('editor-submit').disabled)event.preventDefault();};
  $('editor-form').onsubmit=async event=>{event.preventDefault();for(const id of ['editor-submit','editor-cancel','editor-close','editor-extra'])$(id).disabled=true;try{await onSubmit(Object.fromEntries(new FormData(event.target)));dialog.close();}catch(error){$('editor-error').textContent=error.message;}finally{for(const id of ['editor-submit','editor-cancel','editor-close','editor-extra'])$(id).disabled=false;}};dialog.showModal();$('editor-fields').querySelector('input,select')?.focus();
}
function confirmAction(title,description,action){modal({title,description,submit:'Remove',onSubmit:action});}
function editEnvironment(isNew=false){const e=env();modal({title:isNew?'New environment':'Edit environment',description:'A reusable scene with its own marker placements and campaign channels.',fields:[{name:'name',label:'Environment name',value:isNew?'':e.name,required:true},{name:'description',label:'Description',value:isNew?'':e.description}],submit:isNew?'Create environment':'Save changes',extra:!isNew&&state.environments.length>1?{label:'Remove environment',action:()=>confirmAction(`Remove ${e.name}?`,'This removes its channel assignments. Your uploaded media and other environments are kept.',()=>{const backgroundId=e.scene.background.assetId;W.removeEnvironment(state,e.id);switchEnvironment(state.activeEnvironmentId);pruneBackground(backgroundId);})}:null,onSubmit:values=>{if(isNew){const next=W.addEnvironment(state,values);switchEnvironment(next.id);}else{W.updateDetails(e,values);refresh();save();}}});}
function editChannel(channelId){const e=env(),channel=channelId?W.channelFor(state,e.id,channelId):null;modal({title:channel?'Edit campaign channel':'New campaign channel',description:'Audience labels describe this edition. Choose different media for each marker after creating it.',fields:[{name:'name',label:'Channel name',value:channel?.name,required:true},{name:'country',label:'Country or audience',value:channel?.country},{name:'language',label:'Language',value:channel?.language}],submit:channel?'Save changes':'Create channel',extra:channel&&e.channels.length>1?{label:'Remove channel',action:()=>confirmAction(`Remove ${channel.name}?`,'Its clean output will stop. Other channels and your media will be kept.',()=>{W.removeChannel(state,e.id,channel.id);refresh();save();syncMedia();})}:null,onSubmit:values=>{if(channel)W.updateDetails(channel,values);else W.addChannel(state,e.id,values);refresh();save();syncMedia();}});}
function editMarker(markerId){const e=env(),marker=e.markers.find(m=>m.id===markerId),available=MARKERS.filter(m=>!e.markers.some(p=>p.id===m.id));modal({title:marker?'Edit marker placement':'Add marker placement',description:marker?`${marker.id} is the physical identity. Its name can be different in each environment.`:'Choose one of the coded prints supported by this POC. Use one copy of each ID in the scene.',fields:[...(!marker?[{name:'id',label:'Coded marker',value:available[0]?.id,options:available.map(m=>({label:m.id,value:m.id}))}]:[]),{name:'label',label:'Placement name',value:marker?.label,required:true}],extra:marker?{label:'Remove placement',action:()=>confirmAction(`Remove ${marker.label}?`,'This clears this marker’s assignments in every channel of this environment. The target can be imported again.',()=>{W.removeMarker(state,e.id,marker.id);generation++;tracks.reset();configureGhosts();refresh();save();syncMedia();})}:null,onSubmit:values=>{if(marker)marker.label=values.label.trim()||marker.id;else W.addMarker(state,e.id,values.id,values.label);refresh();save();}});}
function deleteMedia(id){
  const asset=state.media.find(m=>m.id===id);if(!asset)return;const usage=W.mediaUsage(state,id);
  confirmAction('Remove this media?',`${asset.name} is used in ${usage.length} campaign placements. Those placements will show the original physical marker.`,async()=>{
    if(!storageAvailable)throw new Error('Storage is unavailable. Reload before removing saved files.');
    const references=state.environments.flatMap(e=>e.channels.flatMap(c=>Object.entries(c.assignments).filter(([,value])=>value===id).map(([markerId])=>({envId:e.id,channelId:c.id,markerId}))));
    W.removeMedia(state,id);
    try{await persist({remove:[id]});}catch(error){state.media.push(asset);for(const ref of references){const channel=W.channelFor(state,ref.envId,ref.channelId);channel.assignments[ref.markerId]=id;}refresh();throw error;}
    library.release(id);compositor.removeMedia(id);refresh();syncMedia();notice('Media removed and its assignments cleared.');
  });
}

function openOutput(envId,channelId){const channel=W.channelFor(state,envId,channelId);const url=`/output.html?environment=${encodeURIComponent(envId)}&channel=${encodeURIComponent(channelId)}`;const win=window.open(url,`digipoly-${envId}-${channelId}`,'width=1280,height=760');if(!win)notice(`Allow pop-ups to open ${channel.name} output.`,true);}
window.digipoly={
  getOutputInfo:(envId,channelId)=>{const e=state?.environments.find(e=>e.id===envId),c=e?.channels.find(c=>c.id===channelId);return c?{exists:true,active:state.activeEnvironmentId===envId,ready,name:c.name,environment:e.name}: {exists:false};},
  getOutputStream:(envId,channelId)=>{W.channelFor(state,envId,channelId);return compositor.stream(envId,channelId);},
  pump:()=>processFrame(performance.now()),
};
function stopTracks(){if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}video.srcObject=null;}
function setMode(next){mode=next;generation++;tracks.reset();for(const key of ['demo','camera']){$(`${key}-button`).classList.toggle('active',mode===key);$(`${key}-button`).setAttribute('aria-pressed',String(mode===key));}$('mode-label').textContent=mode==='demo'?'Environment scene':'Live camera';$('stop-button').hidden=mode!=='camera';$('camera-select').hidden=mode!=='camera';$('source-hint').textContent=mode==='demo'?'One tracked scene, shared by every channel.':'Camera stays on this device. All channels share this input.';}
function startDemo(){cameraRequest++;setMode('demo');stopTracks();$('camera-button').disabled=!ready;notice('Environment scene selected. Its saved background feeds every audience channel.');}
async function startCamera(deviceId){
  if(!navigator.mediaDevices?.getUserMedia){notice('Open the studio on localhost or HTTPS to use a camera.',true);return;}
  const request=++cameraRequest;setMode('demo');stopTracks();$('camera-button').disabled=true;notice('Allow camera access when your browser asks.');let acquired;
  try{
    acquired=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30},...(deviceId?{deviceId:{exact:deviceId}}:{facingMode:'user'})},audio:false});
    if(request!==cameraRequest){acquired.getTracks().forEach(t=>t.stop());return;}stream=acquired;video.srcObject=stream;await video.play();if(request!==cameraRequest){acquired.getTracks().forEach(t=>t.stop());return;}setMode('camera');
    const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');if(request!==cameraRequest)return;$('camera-select').replaceChildren(...devices.map((d,i)=>new Option(d.label||`Camera ${i+1}`,d.deviceId)));$('camera-select').value=stream.getVideoTracks()[0].getSettings().deviceId||'';
    stream.getVideoTracks()[0].onended=()=>{if(mode==='camera'){startDemo();notice('Camera disconnected. Demo scene is now active.',true);}};notice('Camera live. Both audience editions use the same source and marker positions.');
  }catch(error){acquired?.getTracks().forEach(t=>t.stop());if(request===cameraRequest){startDemo();notice(`Camera could not start: ${error.name==='NotAllowedError'?'Allow camera access in your browser and try again.':error.message}`,true);}}finally{if(request===cameraRequest)$('camera-button').disabled=!ready;}
}
function drawGuide(ctx,track){const color=MARKERS.find(m=>m.id===track.id)?.color||'#7ef0ce';ctx.save();ctx.strokeStyle=color;ctx.lineWidth=3;ctx.setLineDash([8,5]);ctx.beginPath();track.corners.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();const x=Math.max(6,Math.min(...track.corners.map(p=>p.x))),y=Math.max(27,Math.min(...track.corners.map(p=>p.y))-9);ctx.fillStyle='#0d1928dd';ctx.fillRect(x-5,y-22,track.kind==='ghost'?145:89,30);ctx.fillStyle=color;ctx.font='15px sans-serif';ctx.fillText(track.id,x+4,y);ctx.restore();}
function render({frame,detections,ms,sequence}){
  if(sequence!==generation){frame.close();return;}
  try{
    const e=env(),states=tracks.update(detections),locked=states.filter(t=>t.locked&&e.markers.some(m=>m.id===t.id));compositor.render(e,frame,locked);sourcePreview.drawImage(frame,0,0,640,360);
    for(const channel of e.channels){const ctx=channelViews.get(channel.id);if(!ctx)continue;ctx.drawImage(compositor.ensure(e.id,channel.id).canvas,0,0);if($('show-outline').checked)for(const track of locked)drawGuide(ctx,track);}
    for(const marker of e.markers){const found=states.find(s=>s.id===marker.id),node=$(`status-${marker.id}`);if(node){node.textContent=found?.locked?(found.kind==='ghost'?(found.status==='image-tracked'?'Following image · brief hold':'Hidden ID verified'):`Tracking · ${Math.round(found.confidence*100)}% match`):found?'Confirming identity…':'Out of view';node.classList.toggle('tracking',Boolean(found?.locked));}}
    $('tracking-label').textContent=`${locked.length} / ${e.markers.length} markers tracked`;frameCount++;
    if(performance.now()-lastStats>700){$('fps').textContent=Math.round(frameCount*1000/(performance.now()-lastStats));$('latency').textContent=Math.round(ms);lastStats=performance.now();frameCount=0;}
  }finally{frame.close();}
}
async function processFrame(now){
  if(state&&compositor&&tracks.sweep(now)){compositor.render(env(),source,[]);for(const c of env().channels)channelViews.get(c.id)?.drawImage(compositor.ensure(env().id,c.id).canvas,0,0);for(const m of env().markers){const node=$(`status-${m.id}`);if(node){node.textContent='Awaiting fresh tracking frame';node.classList.remove('tracking');}}$('tracking-label').textContent='Tracking paused';}
  if(disposed||!ready||pending||now-lastSend<1000/30||mode==='camera'&&video.readyState<2)return;
  pending=true;lastSend=now;const sequence=generation;
  try{if(mode==='demo')demo.draw(sourceCtx,matchMedia('(prefers-reduced-motion: reduce)').matches?0:now,env().scene,backgrounds.get(env().scene.background),env().markers.map(m=>m.id));else{sourceCtx.fillStyle='#000';sourceCtx.fillRect(0,0,width,height);const scale=Math.min(width/video.videoWidth,height/video.videoHeight),w=video.videoWidth*scale,h=video.videoHeight*scale;sourceCtx.drawImage(video,(width-w)/2,(height-h)/2,w,h);}const frame=await createImageBitmap(source);if(disposed){frame.close();return;}worker.postMessage({type:'frame',frame,sequence},[frame]);}catch(error){pending=false;notice(error.message,true);}
}
function loop(now){if(disposed)return;requestAnimationFrame(loop);processFrame(now);}
function fail(error){ready=false;pending=false;stopTracks();$('loading').hidden=false;$('loading').querySelector('strong').textContent='The studio needs attention';$('loading').querySelector('p').textContent=String(error);$('camera-button').disabled=true;document.querySelectorAll('[data-output-button]').forEach(b=>b.disabled=true);notice(String(error),true);}

$('new-environment').onclick=()=>editEnvironment(true);$('edit-environment').onclick=()=>editEnvironment();
$('cloud-save').onclick=saveCloud;$('cloud-load').onclick=loadCloud;
$('cloud-restore').onclick=()=>modal({title:'Restore your previous local copy?',description:'This restores the workspace kept immediately before your last cloud load. The cloud version stays unchanged.',submit:'Restore local copy',onSubmit:async()=>{const backup=await repo.metadata('before-cloud-load');if(!backup?.workspace)throw new Error('No recovery copy is available.');await repo.save(W.validateWorkspace(backup.workspace),{metadata:{'cloud-sync':backup.sync||null,'before-cloud-load':null}});location.reload();}});
$('duplicate-environment').onclick=()=>{try{const copy=W.duplicateEnvironment(state,env().id);switchEnvironment(copy.id);}catch(error){notice(error.message,true);}};
$('new-channel').onclick=()=>editChannel();$('new-marker').onclick=()=>editMarker();
$('studio-tab').onclick=()=>showTab('studio');$('media-tab').onclick=()=>showTab('media');$('media-search').oninput=libraryUI;
$('editor-close').onclick=$('editor-cancel').onclick=()=>$('editor').close();
$('demo-button').onclick=$('stop-button').onclick=startDemo;$('camera-button').onclick=()=>startCamera();$('camera-select').onchange=event=>startCamera(event.target.value);
$('background-upload-button').onclick=()=>{backgroundTarget=env().id;$('background-upload').click();};
$('background-upload').onchange=async event=>{const file=event.target.files[0],target=backgroundTarget;event.target.value='';if(!file||!target)return;backgroundBusy=true;sceneUI();try{const prepared=await backgrounds.fromFile(file);await saveBackground(target,prepared);notice('Background saved. Use Adjust placements to fit the poster and sticker to your image.');}catch(error){notice(error.message,true);}finally{backgroundBusy=false;sceneUI();}};
$('background-reset-button').onclick=()=>{const e=env(),oldId=e.scene.background.assetId;e.scene=e.template==='bedroom-v1'?bedroomScene():defaultScene();sceneChanged(e.id);save();pruneBackground(oldId);};
$('scene-layout').onchange=event=>{env().scene.layout=event.target.value;sceneChanged(env().id);save();};
$('scene-motion').onchange=event=>{env().scene.motion=event.target.checked;sceneChanged(env().id);save();};
$('background-layout-button').onclick=()=>placementEditor.open(env());
$('layout-close').onclick=$('layout-cancel').onclick=()=>$('layout-dialog').close();
$('layout-smaller').onclick=()=>placementEditor.scale(.94);$('layout-larger').onclick=()=>placementEditor.scale(1.06);$('layout-save').onclick=()=>placementEditor.save();
$('background-capture-button').onclick=openCapture;
$('capture-close').onclick=$('capture-cancel').onclick=()=>$('capture-dialog').close();
$('capture-dialog').onclose=()=>{capture.stop();captureTarget=null;};
$('capture-dialog').oncancel=event=>{if(backgroundBusy)event.preventDefault();};
$('capture-save').onclick=async()=>{
  const target=captureTarget;if(!target)return;backgroundBusy=true;sceneUI();for(const id of ['capture-save','capture-close','capture-cancel'])$(id).disabled=true;$('capture-status').textContent='Saving this camera still…';
  try{const prepared=await backgrounds.fromSource($('capture-preview'),'capture',`Camera capture · ${new Date().toLocaleString('en-GB')}`);await saveBackground(target,prepared);capture.stop();$('capture-dialog').close();notice('Camera still saved as this environment’s background. Adjust the demo placements, or detect markers already in the photo.');}
  catch(error){$('capture-status').textContent=error.message;}
  finally{backgroundBusy=false;for(const id of ['capture-save','capture-close','capture-cancel'])$(id).disabled=false;sceneUI();}
};
$('upload-button').onclick=()=>$('upload').click();
$('upload').onchange=async event=>{
  const files=[...event.target.files];event.target.value='';if(!files.length)return;
  if(!storageAvailable){notice('Browser storage is unavailable. Allow local storage and reload before adding media.',true);return;}
  $('upload-button').disabled=true;let added=0;const failures=[];
  for(const file of files){
    let imported;
    try{
      if(state.media.length>=W.LIMITS.media)throw new Error('The POC library supports up to 50 uploaded assets.');
      notice(`Adding ${file.name}…`);imported=await library.import(file);
      // Do not expose an asset to other saves until its file transaction succeeds.
      const next=structuredClone(state);next.media.push(imported.metadata);
      try{await repo.save(next,{put:[imported.record]});}catch(error){library.release(imported.metadata.id);throw error;}
      state.media.push(imported.metadata);added++;await persist();
    }catch(error){failures.push(`${file.name}: ${error.message}`);}
  }
  $('upload-button').disabled=false;refresh();syncMedia();notice(`${added} media ${added===1?'asset':'assets'} added. ${failures.length?failures.join(' '):'Choose it in any channel’s marker menu.'}`,Boolean(failures.length));
};
$('new-ghost').onclick=()=>{const targetEnv=env().id;ghostDialog({onAdd:async target=>{
 if(!storageAvailable)throw new Error('Allow local storage before adding a GhostMarker.');
 const next=structuredClone(state),referenceId=`ghostref-${crypto.randomUUID()}`,marker={id:target.id,kind:'ghost',label:target.name,codec:target.codec,width:target.width,height:target.height,strength:target.strength,...(target.cells?{cells:target.cells}:{}),referenceId};
 const e=W.environment(next,targetEnv);ghosts.assertDistinct(e,target);W.addGhostMarker(next,targetEnv,marker);if(e.scene.layout==='moving')e.scene.layout='placed';
 for(const c of e.channels)c.assignments[marker.id]=c.assignments['DP-001']||(c.language==='Spanish'?'es-sun':'uk-runner');
 await repo.save(next,{put:[{id:referenceId,blob:await imageBlob(target)}]});state=next;ghosts.remember(referenceId,target);generation++;tracks.reset();configureGhosts();refresh();await persist();syncMedia();notice('GhostMarker added. Download its encoded PNG, adjust its demo placement, and assign content per channel. Save to cloud to use it in DigiPoly Live.');
 }});};
window.addEventListener('beforeunload',()=>{disposed=true;cameraRequest++;stopTracks();worker?.terminate();compositor?.close();library.close();backgrounds.close();capture.stop();demo?.close();repo?.close();});
async function init(){
  try{repo=await new WorkspaceRepository().open();}catch(error){storageAvailable=false;notice(`Local storage could not open: ${error.message} This session will not be saved.`,true);}
  if(storageAvailable){const stored=await repo.load();state=stored?W.validateWorkspace(stored):W.createWorkspace();const added=W.ensureBedroomExample(state);if(added)state.activeEnvironmentId=added.id;if(!stored||added||stored.version!==state.version)await persist();else $('save-status').textContent='Saved on this device';}else{state=W.createWorkspace();$('save-status').textContent='Session only · not saved';}
  const missing=[];
  await Promise.all(W.allMedia(state).map(async media=>{try{const record=W.BUILTIN_MEDIA.some(m=>m.id===media.id)?undefined:await repo.getMedia(media.id);if(!media.url&&!record)throw new Error('File not found');await library.load(media,record);}catch(error){missing.push(media.name);}}));
  await Promise.all(state.environments.map(async e=>{try{await backgrounds.load(e.scene.background,e.scene.background.assetId?await repo.getMedia(e.scene.background.assetId):undefined);}catch{missing.push(`${e.name} background`);}}));
  for(const e of state.environments)for(const m of e.markers.filter(m=>m.kind==='ghost'))try{await ghosts.load(m,await repo.getMedia(m.referenceId));}catch{missing.push(`${m.label} GhostMarker reference`);}
  compositor=new ChannelCompositor(library);compositor.activate(state.activeEnvironmentId);refresh();
  if(storageAvailable)initCloud();
  const images=await Promise.all(MARKERS.map(async marker=>{const im=new Image();im.src=`/assets/brand/${marker.slug}.svg`;await im.decode();return im;}));demo=new DemoScene(images);configureGhosts();
  placementEditor=new PlacementEditor({dialog:$('layout-dialog'),canvas:$('layout-canvas'),select:$('layout-marker'),demo,getBackground:bg=>backgrounds.get(bg),onSave:(id,placements)=>{const e=W.environment(state,id);e.scene.placements=structuredClone(placements);e.scene.layout='placed';sceneChanged(id);save();}});
  sceneUI();demo.draw(sourceCtx,0,env().scene,backgrounds.get(env().scene.background),env().markers.map(m=>m.id));sourcePreview.drawImage(source,0,0,640,360);
  worker=new Worker('/src/tracker-worker.js');const timeout=setTimeout(()=>fail('Marker recognition took too long. Reload in Chrome or Edge.'),30000);
  worker.onmessage=({data})=>{if(data.type==='ghost-configured'){if(data.error)notice(`GhostMarker could not start: ${data.error}`,true);return;}if(data.type==='ready'){configureGhosts();clearTimeout(timeout);ready=true;$('loading').hidden=true;$('camera-button').disabled=false;sceneUI();document.querySelectorAll('[data-output-button]').forEach(b=>b.disabled=false);if(missing.length)notice(`Some saved media could not load: ${missing.join(', ')}. Affected placements show the original marker.`,true);else if(storageAvailable)notice('Compare your audience editions. Change any placement below a preview, or add your own media.');syncMedia();}else if(data.type==='frame'){pending=false;try{render(data);}catch(error){fail(error.message);}}else if(data.type==='error'){clearTimeout(timeout);fail(data.message);}};
  worker.onerror=event=>{clearTimeout(timeout);fail(event.message);};requestAnimationFrame(loop);
}
init().catch(error=>fail(error.message));
