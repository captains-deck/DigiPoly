// Classic worker: OpenCV's upstream UMD runtime expects importScripts.
let detector;
const ready=(async()=>{
  importScripts('../vendor/opencv.js');
  const cv=await self.cv;
  const {PortalDetector}=await import('./detector.mjs');
  detector=new PortalDetector(cv);
  self.postMessage({type:'ready'});
})();
ready.catch(error=>self.postMessage({type:'error',message:String(error)}));
const canvas=new OffscreenCanvas(800,450);
const context=canvas.getContext('2d',{willReadFrequently:true});
self.onmessage=async({data})=>{
  if(data.type!=='frame')return;
  const {frame,sequence}=data;
  try {
    await ready;
    const start=performance.now(), width=Math.min(800,frame.width),height=Math.round(frame.height*width/frame.width);
    if(canvas.width!==width || canvas.height!==height){canvas.width=width;canvas.height=height;}
    context.drawImage(frame,0,0,width,height);
    const detections=detector.detect(context.getImageData(0,0,width,height).data,width,height);
    for(const detection of detections) detection.corners=detection.corners.map(p=>({x:p.x*frame.width/width,y:p.y*frame.height/height}));
    self.postMessage({type:'frame',frame,sequence,detections,ms:performance.now()-start},[frame]);
  } catch(error) {
    frame.close();self.postMessage({type:'error',sequence,message:String(error)});
  }
};
