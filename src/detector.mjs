import { markerPixels, MARKERS, CODE_CELLS, CELL_SIZE } from './marker.mjs';
import { orderCorners } from './geometry.mjs';

export const NORMALIZED_SIZE=96;
const SIZE=NORMALIZED_SIZE, template=markerPixels(SIZE,'DP-001',{includeCode:false});
const structureSamples=[];
for(let y=3;y<SIZE-3;y++)for(let x=3;x<SIZE-3;x++){
  const px=(x+.5)*200/SIZE,py=(y+.5)*200/SIZE;
  if(!CODE_CELLS.some(([cx,cy])=>px>=cx-3&&px<=cx+CELL_SIZE+3&&py>=cy-3&&py<=cy+CELL_SIZE+3))structureSamples.push([x,y,template[y*SIZE+x]>0]);
}
function pixelAt(pixels,x,y,r){
  let sx=x,sy=y;
  if(r===1){sx=SIZE-1-y;sy=x;}
  if(r===2){sx=SIZE-1-x;sy=SIZE-1-y;}
  if(r===3){sx=y;sy=SIZE-1-x;}
  return pixels[sy*SIZE+sx];
}
export function matchPortal(pixels){
  const rotations=[];
  for(let r=0;r<4;r++){
    let white=0,black=0,whiteHit=0,blackHit=0;
    for(const [x,y,expected] of structureSamples){
      const actual=pixelAt(pixels,x,y,r)>127;
      if(expected){white++;if(actual)whiteHit++;}else{black++;if(!actual)blackHit++;}
    }
    rotations.push({score:(whiteHit/white+blackHit/black)/2,rotation:r});
  }
  rotations.sort((a,b)=>b.score-a.score);
  const best=rotations[0];
  if(best.score<.87||best.score-rotations[1].score<.08)return null;
  const read=CODE_CELLS.map(([cx,cy])=>{
    let white=0,total=0;
    for(let y=Math.ceil((cy+2)*SIZE/200);y<Math.floor((cy+CELL_SIZE-2)*SIZE/200);y++)
      for(let x=Math.ceil((cx+2)*SIZE/200);x<Math.floor((cx+CELL_SIZE-2)*SIZE/200);x++){white+=pixelAt(pixels,x,y,best.rotation)>127?1:0;total++;}
    const level=white/total;return level>.78?1:level<.22?0:null;
  });
  const uncertain=read.filter(b=>b===null).length;
  if(uncertain>1)return null;
  const ranked=MARKERS.map(marker=>({...marker,errors:read.reduce((n,b,i)=>n+(b!==null&&b!==marker.bits[i]?1:0),0)})).sort((a,b)=>a.errors-b.errors);
  // The two codewords differ in twelve cells. Reject ambiguous/damaged codes;
  // do not let the much larger shared D hide a bad identity match.
  if(ranked[0].errors>1||ranked[1].errors-ranked[0].errors<6)return null;
  return {...best,id:ranked[0].id,identityConfidence:(16-ranked[0].errors-uncertain)/16};
}
function centre(d){return {x:d.corners.reduce((s,p)=>s+p.x,0)/4,y:d.corners.reduce((s,p)=>s+p.y,0)/4};}
function distinctDetections(candidates){
  const unique=[];
  for(const candidate of candidates.sort((a,b)=>b.confidence-a.confidence)){
    const c=centre(candidate);
    if(unique.some(d=>{const p=centre(d);return Math.hypot(p.x-c.x,p.y-c.y)<Math.sqrt(Math.min(d.area,candidate.area))*.25;}))continue;
    unique.push(candidate);
  }
  // Two physically separate prints of the same ID are ambiguous. Hide that ID
  // instead of letting the highest score jump between copies.
  return unique.filter(d=>unique.filter(other=>other.id===d.id).length===1).sort((a,b)=>a.id.localeCompare(b.id));
}

export class PortalDetector {
  constructor(cv) { this.cv=cv; }
  detect(rgba,width,height) {
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
                const match=matchPortal(normalized.data);
                if(match){
                  const oriented=corners.map((_,i)=>corners[(i+match.rotation)%4]);
                  found.push({id:match.id,corners:oriented,confidence:match.score,identityConfidence:match.identityConfidence,area:candidate.area});
                }
              } finally {from.delete();transform.delete();normalized.delete();}
            } finally {contour.delete();approx.delete();}
          }
        } finally {contours.delete();hierarchy.delete();}
      }
      return distinctDetections(found);
    } finally {owned.forEach(x=>x.delete());}
  }
}
