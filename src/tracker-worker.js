// Classic worker: OpenCV's upstream UMD runtime expects importScripts.
let detector,ghosts,cv,sequenceSeen,queue=Promise.resolve();
const ready=(async()=>{
  importScripts('../vendor/opencv.js');cv=await self.cv;
  const [{PortalDetector},{GhostDetector}]=await Promise.all([import('./detector.mjs'),import('../vendor/ghostmarker/detector.mjs')]);
  detector=new PortalDetector(cv);ghosts=new GhostDetector(cv);
  self.postMessage({type:'ready'});
})();
ready.catch(error=>self.postMessage({type:'error',message:String(error)}));
const canvas=new OffscreenCanvas(960,540),context=canvas.getContext('2d',{willReadFrequently:true});
self.onmessage=({data})=>{queue=queue.then(()=>handle(data)).catch(error=>self.postMessage({type:'error',sequence:data.sequence,message:String(error)}));};
async function handle(data){
  await ready;
  if(data.type==='ghost-config'){
    ghosts.close();const {GhostDetector}=await import('../vendor/ghostmarker/detector.mjs');
    try{ghosts=new GhostDetector(cv,data.targets||[]);sequenceSeen=undefined;self.postMessage({type:'ghost-configured',request:data.request});}
    catch(error){ghosts=new GhostDetector(cv);self.postMessage({type:'ghost-configured',request:data.request,error:error.message||String(error)});}return;
  }
  if(data.type!=='frame')return;
  const {frame,sequence}=data;
  try{
    if(sequenceSeen!==sequence){ghosts.reset();sequenceSeen=sequence;}
    // 960 is the width already used for GhostMarkers. The v3 inner links are only
    // a few pixels wide after a 1280-frame is reduced to 800, and that aliasing
    // drops identity on sharp frames. Acceptance thresholds are unchanged.
    const start=performance.now(),width=Math.min(960,frame.width),height=Math.round(frame.height*width/frame.width);
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    context.drawImage(frame,0,0,width,height);const pixels=context.getImageData(0,0,width,height).data;
    const report=detector.inspect(pixels,width,height);
    const coded=[...report.detections,...report.observations,...report.ambiguous.map(id=>({id,ambiguous:true}))];
    const detections=[...coded,...ghosts.detect(pixels,width,height,{exclude:report.detections.map(d=>d.corners)})];
    for(const d of detections) if(d.corners) d.corners=d.corners.map(p=>({x:p.x*frame.width/width,y:p.y*frame.height/height}));
    self.postMessage({type:'frame',frame,sequence,detections,ms:performance.now()-start},[frame]);
  }catch(error){frame.close();self.postMessage({type:'error',sequence,message:String(error)});}
}
