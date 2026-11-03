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
    const start=performance.now(),width=Math.min(ghosts.targets.length?960:800,frame.width),height=Math.round(frame.height*width/frame.width);
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    context.drawImage(frame,0,0,width,height);const pixels=context.getImageData(0,0,width,height).data;
    const coded=detector.detect(pixels,width,height);
    const detections=[...coded,...ghosts.detect(pixels,width,height,{exclude:coded.map(d=>d.corners)})];
    for(const d of detections)d.corners=d.corners.map(p=>({x:p.x*frame.width/width,y:p.y*frame.height/height}));
    self.postMessage({type:'frame',frame,sequence,detections,ms:performance.now()-start},[frame]);
  }catch(error){frame.close();self.postMessage({type:'error',sequence,message:String(error)});}
}
