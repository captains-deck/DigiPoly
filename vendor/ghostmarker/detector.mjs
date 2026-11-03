import {decode,validateDimensions,validId,CODEC,validateCells,samePicture} from './codec.mjs';
const point=(h,x,y)=>{const z=h[6]*x+h[7]*y+h[8];return {x:(h[0]*x+h[1]*y+h[2])/z,y:(h[3]*x+h[4]*y+h[5])/z};};
const area=q=>Math.abs(q.reduce((s,p,i)=>s+p.x*q[(i+1)%4].y-p.y*q[(i+1)%4].x,0))/2;
function goodQuad(q,w,h){return q.every((p,i)=>{const b=q[(i+1)%4],c=q[(i+2)%4];return Number.isFinite(p.x+p.y)&&p.x>=-8&&p.y>=-8&&p.x<=w+8&&p.y<=h+8&&(b.x-p.x)*(c.y-b.y)-(b.y-p.y)*(c.x-b.x)>0&&Math.hypot(b.x-p.x,b.y-p.y)>110;})&&area(q)>24000&&area(q)<w*h*1.02;}
/** Image features locate a candidate. Only its rectified pixels are decoded.
 * OpenCV objects are owned by this instance; call close() when replacing it.
 */
export class GhostDetector {
  constructor(cv,targets=[]){this.cv=cv;this.targets=[];this.frameNumber=0;this.last=new Map();this.orb=new cv.ORB(1600,1.2,8,16,0,2,0,31,12);this.matcher=new cv.BFMatcher(cv.NORM_HAMMING,false);try{this.configure(targets);}catch(e){this.close();throw e;}}
  configure(targets){
    if(!Array.isArray(targets)||targets.length>2)throw new Error('Use at most two GhostMarkers per environment.');
    for(const t of this.targets){t.gray.delete();t.keys.delete();t.desc.delete();}this.targets=[];this.reset();
    for(const target of targets){
      validateDimensions(target.width,target.height);if(!validId(target.id)||target.codec!==CODEC||target.rgba?.length!==target.width*target.height*4||!(target.strength>=24&&target.strength<=128)||this.targets.some(t=>t.id===target.id))throw new Error('Invalid GhostMarker reference.');
      validateCells(target.cells,target.width,target.height);if(this.targets.some(t=>samePicture(t,target)))throw new Error('Use a different picture for each GhostMarker in an environment.');
      const cv=this.cv,src=cv.matFromArray(target.height,target.width,cv.CV_8UC4,target.rgba),gray=new cv.Mat(),keys=new cv.KeyPointVector(),desc=new cv.Mat(),mask=new cv.Mat();
      try{cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY);this.orb.detectAndCompute(gray,mask,keys,desc);if(keys.size()<45)throw new Error('This image has too little detail to track. Choose a photograph or detailed illustration.');this.targets.push({...target,rgba:new Uint8Array(target.rgba),gray,keys,desc});}catch(e){gray.delete();keys.delete();desc.delete();throw e;}finally{src.delete();mask.delete();}
    }
  }
  reset(){this.last.clear();this.frameNumber=0;}
  detect(rgba,width,height,{exclude=[]}={}){
    if(!this.targets.length)return [];
    const cv=this.cv,owned=[],keep=x=>(owned.push(x),x);this.frameNumber++;
    try{
      const src=keep(cv.matFromArray(height,width,cv.CV_8UC4,rgba)),gray=keep(new cv.Mat()),keys=keep(new cv.KeyPointVector()),desc=keep(new cv.Mat());cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY);
      // Restrict feature extraction to known picture regions while following all
      // targets. Periodically scan the frame again, and immediately after a loss.
      const local=this.last.size===this.targets.length&&this.frameNumber%15!==0;
      const mask=keep(local||exclude.length?new cv.Mat(height,width,cv.CV_8UC1,new cv.Scalar(local?0:255)):new cv.Mat());
      if(local)for(const q of this.last.values()){const xs=q.map(p=>p.x),ys=q.map(p=>p.y),margin=90;cv.rectangle(mask,new cv.Point(Math.max(0,Math.min(...xs)-margin),Math.max(0,Math.min(...ys)-margin)),new cv.Point(Math.min(width-1,Math.max(...xs)+margin),Math.min(height-1,Math.max(...ys)+margin)),new cv.Scalar(255),-1);}
      // Known coded-marker regions can dominate the feature budget. Exclude
      // their geometry from localisation only; decoding still reads source pixels.
      for(const q of exclude){if(q?.length!==4||q.some(p=>!Number.isFinite(p.x+p.y)))continue;const points=keep(cv.matFromArray(4,1,cv.CV_32SC2,q.flatMap(p=>[Math.round(p.x),Math.round(p.y)])));cv.fillConvexPoly(mask,points,new cv.Scalar(0));}
      this.orb.detectAndCompute(gray,mask,keys,desc);const found=[];this.last.clear();
      if(desc.empty())return found;
      for(const t of this.targets){const d=this.locate(t,src,gray,keys,desc,width,height);if(d){this.last.set(t.id,d.corners);found.push({...d,search:local?'local':'full'});}}
      return found;
    }finally{for(const x of owned.reverse())x.delete();}
  }
  locate(t,src,gray,keys,desc,width,height){
    const cv=this.cv,owned=[],keep=x=>(owned.push(x),x);
    try{
      const matches=keep(new cv.DMatchVectorVector());this.matcher.knnMatch(desc,t.desc,matches,2);
      const pairs=[];
      for(let i=0;i<matches.size();i++){const row=matches.get(i);try{if(row.size()<2)continue;const a=row.get(0),b=row.get(1);if(a.distance<.73*b.distance)pairs.push([t.keys.get(a.trainIdx).pt,keys.get(a.queryIdx).pt]);}finally{row.delete();}}
      if(pairs.length<16)return null;
      const from=keep(cv.matFromArray(pairs.length,1,cv.CV_32FC2,pairs.flatMap(p=>[p[0].x,p[0].y]))),to=keep(cv.matFromArray(pairs.length,1,cv.CV_32FC2,pairs.flatMap(p=>[p[1].x,p[1].y]))),inliers=keep(new cv.Mat()),h=keep(cv.findHomography(from,to,cv.RANSAC,2.5,inliers,1000,.995));
      if(h.empty())return null;
      const hits=pairs.filter((_,i)=>inliers.data[i]);if(hits.length<14||hits.length/pairs.length<.5)return null;
      // Multiple physical copies are ambiguous, even if only one decodes. Look
      // for a second spatially separate homography among the remaining matches.
      const rest=pairs.filter((_,i)=>!inliers.data[i]);
      if(rest.length>=16){const f=keep(cv.matFromArray(rest.length,1,cv.CV_32FC2,rest.flatMap(p=>[p[0].x,p[0].y]))),v=keep(cv.matFromArray(rest.length,1,cv.CV_32FC2,rest.flatMap(p=>[p[1].x,p[1].y]))),mask=keep(new cv.Mat()),other=keep(cv.findHomography(f,v,cv.RANSAC,2.5,mask,600,.99));if(!other.empty()){
        const count=Array.from(mask.data).reduce((n,b)=>n+b,0),q=[[0,0],[t.width-1,0],[t.width-1,t.height-1],[0,t.height-1]].map(([x,y])=>point(other.data64F,x,y)),c=point(h.data64F,t.width/2,t.height/2),oc=point(other.data64F,t.width/2,t.height/2);
        if(count>=14&&count/rest.length>=.5&&goodQuad(q,width,height)&&Math.hypot(c.x-oc.x,c.y-oc.y)>100)return null;
      }}
      const xs=hits.map(p=>p[0].x),ys=hits.map(p=>p[0].y);if((Math.max(...xs)-Math.min(...xs))*(Math.max(...ys)-Math.min(...ys))<t.width*t.height*.20)return null;
      let corners=[[0,0],[t.width-1,0],[t.width-1,t.height-1],[0,t.height-1]].map(([x,y])=>point(h.data64F,x,y));if(!goodQuad(corners,width,height))return null;
      // Refine feature-based alignment against actual image pixels. ECC estimates
      // geometry only: no reference pixels are mixed into the decoded frame.
      const warp=keep(new cv.Mat());h.convertTo(warp,cv.CV_32F);
      try{cv.findTransformECC(t.gray,gray,warp,cv.MOTION_HOMOGRAPHY,new cv.TermCriteria(cv.TermCriteria_COUNT+cv.TermCriteria_EPS,25,.0002),keep(new cv.Mat()));}catch{/* Feature geometry remains useful even if illumination prevents ECC. */}
      const refined=[[0,0],[t.width-1,0],[t.width-1,t.height-1],[0,t.height-1]].map(([x,y])=>point(warp.data32F,x,y));
      if(goodQuad(refined,width,height)&&refined.every((p,i)=>Math.hypot(p.x-corners[i].x,p.y-corners[i].y)<12))corners=refined;else h.convertTo(warp,cv.CV_32F);
      const tile=keep(new cv.Mat());cv.warpPerspective(src,tile,warp,new cv.Size(t.width,t.height),cv.INTER_LINEAR+cv.WARP_INVERSE_MAP,cv.BORDER_CONSTANT,new cv.Scalar(0,0,0,255));
      const decoded=decode(tile.data,t.width,t.height,{strength:t.strength,reference:t.rgba,cells:t.cells});
      return {id:t.id,kind:'ghost',corners,area:area(corners),geometryGood:true,verified:decoded.valid&&decoded.id===t.id,conflict:decoded.valid&&decoded.id!==t.id,confidence:decoded.confidence,inliers:hits.length,decodedId:decoded.id};
    }finally{for(const x of owned.reverse())x.delete();}
  }
  close(){for(const t of this.targets){t.gray.delete();t.keys.delete();t.desc.delete();}this.targets=[];this.orb?.delete();this.matcher?.delete();}
}
