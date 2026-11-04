import * as currentMarker from './marker.mjs';
import * as markerV3 from './marker-v3.mjs';
import {assessLegacyPortal} from './legacy-marker-matcher.mjs';
import {createLinkedAssessment} from './linked-marker-matcher.mjs';
import {orderCorners} from './geometry.mjs';
import {TRACKING} from './tracking-policy.mjs';
export const NORMALIZED_SIZE=128;
const SIZE=NORMALIZED_SIZE;
const assessCurrent=createLinkedAssessment(currentMarker,NORMALIZED_SIZE);
const assessV3=createLinkedAssessment(markerV3,NORMALIZED_SIZE);
function acceptLinked(assessed){
  if(assessed.score<.9||assessed.margin<.08||assessed.uncertain>1||assessed.errors>1||assessed.separation<5)return null;
  return {rotation:assessed.rotation,score:assessed.score,id:assessed.id,identityConfidence:(8-assessed.errors-assessed.uncertain)/8,version:assessed.version,structure:assessed.structure};
}
function acceptLegacy(assessed){
  if(assessed.score<.87||assessed.margin<.08||assessed.uncertain>1||assessed.errors>1||assessed.separation<6)return null;
  return {rotation:assessed.rotation,score:assessed.score,id:assessed.id,identityConfidence:(16-assessed.errors-assessed.uncertain)/16,version:2};
}
function hint(assessed,score,margin,uncertain,errors,separation){
  if(assessed.score<score||assessed.margin<margin)return null;
  const identified=assessed.uncertain<=uncertain&&assessed.errors<=errors&&assessed.separation>=separation;
  return {rotation:assessed.rotation,score:assessed.score,version:assessed.version,...(identified?{id:assessed.id}:{})};
}
function bestOf(matches){return matches.filter(Boolean).sort((a,b)=>b.score-a.score)[0]||null;}
function judgePortal(pixels){
  const current=assessCurrent(pixels),previous=assessV3(pixels),legacy=assessLegacyPortal(pixels);
  const strong=[acceptLinked(current),acceptLinked(previous),acceptLegacy(legacy)].filter(Boolean);
  if(new Set(strong.map(match=>match.id)).size>1)return null;
  const chosen=strong.sort((a,b)=>(b.structure??b.score)-(a.structure??a.score)||b.score-a.score)[0];
  if(chosen){const {structure,...match}=chosen;return {kind:'strong',...match};}
  const weak=[
    hint(current,TRACKING.linkedWeakScore,TRACKING.linkedWeakMargin,2,2,3),
    hint(previous,TRACKING.linkedWeakScore,TRACKING.linkedWeakMargin,2,2,3),
    hint(legacy,TRACKING.legacyWeakScore,TRACKING.legacyWeakMargin,2,3,4),
  ].filter(Boolean);
  const candidate=bestOf(weak);
  if(!candidate)return null;
  const identified=weak.filter(match=>match.id);
  if(new Set(identified.map(match=>match.id)).size>1)return {kind:'observation',rotation:candidate.rotation,score:candidate.score,quality:'geometry',version:candidate.version};
  const weakChoice=bestOf(identified)||candidate;
  return {kind:'observation',rotation:weakChoice.rotation,score:weakChoice.score,quality:weakChoice.id?'weak':'geometry',version:weakChoice.version,...(weakChoice.id?{id:weakChoice.id}:{})};
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
