import {markerPixels,MARKERS,CODE_CELLS,CELL_SIZE,MARKER_SIZE,CORNERS} from './marker.mjs';
import {assessLegacyPortal} from './legacy-marker-matcher.mjs';
import {orderCorners} from './geometry.mjs';
import {TRACKING} from './tracking-policy.mjs';
export const NORMALIZED_SIZE=128;
const SIZE=NORMALIZED_SIZE,template=markerPixels(SIZE,'DP-001',{includeCode:false}),samples=[];
// The inner corner links carry identity. Compare the shared silhouette separately
// so a large central D cannot overpower a wrong or damaged corner code.
for(let y=3;y<SIZE-3;y++)for(let x=3;x<SIZE-3;x++){
  const px=(x+.5)*800/SIZE,py=(y+.5)*800/SIZE;
  if(!CORNERS.some(([fx,fy])=>{const cx=fx?800-px:px,cy=fy?800-py:py;return cx>=88&&cx<=168&&cy>=88&&cy<=168;}))samples.push([x,y,template[y*SIZE+x]>0]);
}
function pixelAt(pixels,x,y,r){if(r===1)return pixels[x*SIZE+SIZE-1-y];if(r===2)return pixels[(SIZE-1-y)*SIZE+SIZE-1-x];if(r===3)return pixels[(SIZE-1-x)*SIZE+y];return pixels[y*SIZE+x];}
function assessLinked(pixels){
  const rotations=[];
  for(let r=0;r<4;r++){let white=0,black=0,whiteHit=0,blackHit=0;for(const [x,y,expected] of samples){const actual=pixelAt(pixels,x,y,r)>127;if(expected){white++;if(actual)whiteHit++;}else{black++;if(!actual)blackHit++;}}rotations.push({rotation:r,score:(whiteHit/white+blackHit/black)/2});}
  rotations.sort((a,b)=>b.score-a.score);const best=rotations[0];
  const read=CODE_CELLS.map(([cx,cy])=>{let white=0,total=0;for(let y=Math.ceil(cy*SIZE/MARKER_SIZE);y<Math.floor((cy+CELL_SIZE)*SIZE/MARKER_SIZE);y++)for(let x=Math.ceil(cx*SIZE/MARKER_SIZE);x<Math.floor((cx+CELL_SIZE)*SIZE/MARKER_SIZE);x++){white+=pixelAt(pixels,x,y,best.rotation)>127?1:0;total++;}const level=total?white/total:0;return level>=.78?1:level<=.22?0:null;});
  const uncertain=read.filter(b=>b===null).length;
  const ranked=MARKERS.map(marker=>({id:marker.id,errors:read.reduce((n,b,i)=>n+(b!==null&&b!==marker.bits[i]?1:0),0)})).sort((a,b)=>a.errors-b.errors);
  return {rotation:best.rotation,score:best.score,margin:best.score-rotations[1].score,uncertain,errors:ranked[0].errors,separation:ranked[1].errors-ranked[0].errors,id:ranked[0].id};
}
function acceptLinked(assessed){
  if(assessed.score<.9||assessed.margin<.08||assessed.uncertain>1||assessed.errors>1||assessed.separation<5)return null;
  return {rotation:assessed.rotation,score:assessed.score,id:assessed.id,identityConfidence:(8-assessed.errors-assessed.uncertain)/8,version:3};
}
function hint(assessed,score,margin,uncertain,errors,separation,version){
  if(assessed.score<score||assessed.margin<margin)return null;
  const identified=assessed.uncertain<=uncertain&&assessed.errors<=errors&&assessed.separation>=separation;
  return {rotation:assessed.rotation,score:assessed.score,version,...(identified?{id:assessed.id}:{})};
}
function judgePortal(pixels){
  const linked=assessLinked(pixels),legacy=assessLegacyPortal(pixels);
  const strongL=acceptLinked(linked),strongG=legacy.score<.87||legacy.margin<.08||legacy.uncertain>1||legacy.errors>1||legacy.separation<6?null:{rotation:legacy.rotation,score:legacy.score,id:legacy.id,identityConfidence:(16-legacy.errors-legacy.uncertain)/16,version:2};
  if(strongL&&strongG&&strongL.id!==strongG.id)return null;
  if(strongL||strongG)return {kind:'strong',...(strongL||strongG)};
  const weakL=hint(linked,TRACKING.linkedWeakScore,TRACKING.linkedWeakMargin,2,2,3,3);
  const weakG=hint(legacy,TRACKING.legacyWeakScore,TRACKING.legacyWeakMargin,2,3,4,2);
  if(weakL?.id&&weakG?.id&&weakL.id!==weakG.id){const best=weakL.score>=weakG.score?weakL:weakG;return {kind:'observation',rotation:best.rotation,score:best.score,quality:'geometry',version:best.version};}
  const best=[weakL,weakG].filter(Boolean).sort((a,b)=>b.score-a.score)[0];
  return best?{kind:'observation',rotation:best.rotation,score:best.score,quality:best.id?'weak':'geometry',version:best.version,...(best.id?{id:best.id}:{})}:null;
}
export function matchPortal(pixels){
  const judged=judgePortal(pixels);
  if(judged?.kind!=='strong')return null;
  const {kind,...match}=judged;
  return match;
}
function centre(d){return {x:d.corners.reduce((s,p)=>s+p.x,0)/4,y:d.corners.reduce((s,p)=>s+p.y,0)/4};}
function reportDetections(candidates){
  const ranked=[...candidates].sort((a,b)=>Number(b.kind==='strong')-Number(a.kind==='strong')||b.confidence-a.confidence);
  const unique=[];
  for(const candidate of ranked){
    const c=centre(candidate);
    if(unique.some(d=>{const p=centre(d);return Math.hypot(p.x-c.x,p.y-c.y)<Math.sqrt(Math.min(d.area,candidate.area))*.25;}))continue;
    unique.push(candidate);
  }
  // Two physically separate prints of the same ID are ambiguous. Hide that ID
  // and say so, so a tracker does not treat the clash as an ordinary miss.
  const ambiguous=new Set();
  for(const item of unique) if(item.kind==='strong'&&item.id&&unique.filter(other=>other.kind==='strong'&&other.id===item.id).length>1) ambiguous.add(item.id);
  const weakCount=new Map();
  for(const item of unique) if(item.kind!=='strong'&&item.id&&!ambiguous.has(item.id)) weakCount.set(item.id,(weakCount.get(item.id)||0)+1);
  const publish=d=>{const {kind,...rest}=d;return rest;};
  const hasStrong=id=>unique.some(d=>d.kind==='strong'&&d.id===id);
  return {
    detections:unique.filter(d=>d.kind==='strong'&&!ambiguous.has(d.id)).map(d=>({...publish(d),quality:'strong'})).sort((a,b)=>a.id.localeCompare(b.id)),
    observations:unique.filter(d=>d.kind!=='strong'&&!ambiguous.has(d.id)&&(!d.id||(!hasStrong(d.id)&&weakCount.get(d.id)===1))).map(publish),
    ambiguous:[...ambiguous].sort(),
  };
}

export class PortalDetector {
  constructor(cv) { this.cv=cv; }
  detect(rgba,width,height){return this.inspect(rgba,width,height).detections;}
  inspect(rgba,width,height) {
    const cv=this.cv, owned=[];
    const keep=x=>(owned.push(x),x);
    try {
      const src=keep(cv.matFromArray(height,width,cv.CV_8UC4,rgba));
      const gray=keep(new cv.Mat()), blurred=keep(new cv.Mat()), binary=keep(new cv.Mat());
      cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(gray,blurred,new cv.Size(3,3),0);
      const destination=keep(cv.matFromArray(4,1,cv.CV_32FC2,[0,0,SIZE-1,0,SIZE-1,SIZE-1,0,SIZE-1]));
      const found=[];
      for(let pass=0;pass<2;pass++) {
        if(pass===0) cv.threshold(blurred,binary,0,255,cv.THRESH_BINARY_INV|cv.THRESH_OTSU);
        else cv.adaptiveThreshold(blurred,binary,255,cv.ADAPTIVE_THRESH_GAUSSIAN_C,cv.THRESH_BINARY_INV,31,7);
        const contours=new cv.MatVector(), hierarchy=new cv.Mat();
        try {
          cv.findContours(binary,contours,hierarchy,cv.RETR_LIST,cv.CHAIN_APPROX_SIMPLE);
          // Bound work on busy scenes; larger contours are the most useful targets.
          const candidates=[];
          for(let i=0;i<contours.size();i++) {
            const contour=contours.get(i);
            const area=cv.contourArea(contour); contour.delete();
            if(area>1000 && area<width*height*.85) candidates.push({i,area});
          }
          candidates.sort((a,b)=>b.area-a.area);
          for(const candidate of candidates.slice(0,36)) {
            const contour=contours.get(candidate.i), approx=new cv.Mat();
            try {
              cv.approxPolyDP(contour,approx,.025*cv.arcLength(contour,true),true);
              if(approx.rows!==4 || !cv.isContourConvex(approx)) continue;
              const corners=orderCorners(Array.from({length:4},(_,i)=>({x:approx.data32S[i*2],y:approx.data32S[i*2+1]})));
              const edges=corners.map((p,i)=>Math.hypot(p.x-corners[(i+1)%4].x,p.y-corners[(i+1)%4].y));
              if(Math.min(...edges)<55 || Math.max(...edges)/Math.min(...edges)>4)continue;
              const from=cv.matFromArray(4,1,cv.CV_32FC2,corners.flatMap(p=>[p.x,p.y]));
              const transform=cv.getPerspectiveTransform(from,destination), normalized=new cv.Mat();
              try {
                cv.warpPerspective(gray,normalized,transform,new cv.Size(SIZE,SIZE),cv.INTER_LINEAR);
                cv.threshold(normalized,normalized,0,255,cv.THRESH_BINARY|cv.THRESH_OTSU);
                const judged=judgePortal(normalized.data);
                if(judged){
                  const oriented=corners.map((_,i)=>corners[(i+judged.rotation)%4]);
                  found.push({...judged,corners:oriented,confidence:judged.score,area:candidate.area});
                }
              } finally {from.delete();transform.delete();normalized.delete();}
            } finally {contour.delete();approx.delete();}
          }
        } finally {contours.delete();hierarchy.delete();}
      }
      return reportDetections(found);
    } finally {owned.forEach(x=>x.delete());}
  }
}
