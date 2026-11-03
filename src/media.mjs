export function validateFile(file){
  const kind=['image/png','image/jpeg','image/webp'].includes(file.type)?'image':['video/mp4','video/webm'].includes(file.type)?'video':null;
  if(!kind)throw new Error('Choose PNG, JPEG, WebP, MP4 or WebM.');
  if(file.size>(kind==='video'?100:10)*1024*1024)throw new Error(kind==='video'?'Videos must be under 100 MB.':'Images must be under 10 MB.');
  return kind;
}
function ready(element,event,url){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{cleanup();reject(new Error('This media took too long to load. Try a smaller file or another format.'));},15000);const cleanup=()=>{clearTimeout(timer);element.removeEventListener(event,success);element.removeEventListener('error',failure);};const success=()=>{cleanup();resolve(element);};const failure=()=>{cleanup();reject(new Error('This browser cannot decode that file. Try a PNG image or an H.264 MP4 / WebM video.'));};element.addEventListener(event,success,{once:true});element.addEventListener('error',failure,{once:true});element.src=url;if(element instanceof HTMLVideoElement)element.load();});}
export function squareFrame(element,canvas=document.createElement('canvas')){
  if(canvas.width!==600||canvas.height!==600)canvas.width=canvas.height=600;
  const w=element.videoWidth||element.naturalWidth||element.width,h=element.videoHeight||element.naturalHeight||element.height;
  if(!w||!h)throw new Error('Media has no readable image.');
  const s=Math.min(w,h),ctx=canvas.getContext('2d');ctx.fillStyle='#101b2b';ctx.fillRect(0,0,600,600);ctx.drawImage(element,(w-s)/2,(h-s)/2,s,s,0,0,600,600);return canvas;
}
export class MediaLibrary {
  constructor(){this.entries=new Map();}
  async load(metadata,record){
    if(this.entries.has(metadata.id))return this.entries.get(metadata.id);
    const url=record?URL.createObjectURL(record.blob):metadata.url;
    if(!url)throw new Error(`Missing file: ${metadata.name}`);
    let element;
    try{
      element=metadata.kind==='video'?document.createElement('video'):new Image();
      if(metadata.kind==='video'){element.muted=true;element.loop=true;element.playsInline=true;element.preload='auto';}
      await ready(element,metadata.kind==='video'?'loadeddata':'load',url);
      const pixels=(element.videoWidth||element.naturalWidth)*(element.videoHeight||element.naturalHeight);
      if(pixels>40000000)throw new Error('Use media below 40 megapixels.');
      const raster=squareFrame(element),poster=record?.poster||await new Promise(resolve=>raster.toBlob(resolve,'image/jpeg',.82));
      const entry={...metadata,element,raster,url,ownedUrl:Boolean(record),poster,posterUrl:URL.createObjectURL(poster),dynamic:metadata.kind==='video',lastTime:-1,revision:0};
      this.entries.set(metadata.id,entry);return entry;
    }catch(error){if(element instanceof HTMLVideoElement){element.pause();element.removeAttribute('src');element.load();}if(record)URL.revokeObjectURL(url);throw error;}
  }
  async import(file){const kind=validateFile(file),metadata={id:`media-${crypto.randomUUID()}`,name:file.name.slice(0,100),kind,size:file.size,type:file.type,createdAt:Date.now()};const entry=await this.load(metadata,{blob:file});return {metadata,record:{id:metadata.id,blob:file,poster:entry.poster}};}
  get(id){return this.entries.get(id);}
  frame(id){const entry=this.get(id);if(!entry)return null;if(entry.dynamic&&entry.element.readyState>=2&&entry.lastTime!==entry.element.currentTime){squareFrame(entry.element,entry.raster);entry.lastTime=entry.element.currentTime;entry.revision++;}return entry;}
  async syncPlayback(ids){const active=new Set(ids),blocked=[];await Promise.all([...this.entries.values()].filter(e=>e.dynamic).map(async entry=>{if(active.has(entry.id)){if(entry.element.paused)try{await entry.element.play();}catch{blocked.push(entry.name);}}else entry.element.pause();}));return blocked;}
  release(id){const entry=this.get(id);if(!entry)return;if(entry.dynamic){entry.element.pause();entry.element.removeAttribute('src');entry.element.load();}if(entry.ownedUrl)URL.revokeObjectURL(entry.url);URL.revokeObjectURL(entry.posterUrl);this.entries.delete(id);}
  close(){for(const id of [...this.entries.keys()])this.release(id);}
}
