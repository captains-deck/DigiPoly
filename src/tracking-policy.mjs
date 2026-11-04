// Shared Studio/Live timing for coded markers. Scores stay similarity measures.
// A lock requires two strong reads. After that, image motion chooses the coast
// and weak geometry can follow only until the last strong identification.
export const TRACKING=Object.freeze({
  confirmations:2,
  stationaryHoldMs:340,
  movingHoldMs:140,
  identityWindowMs:1200,
  // Net sizes per second over the recent window. The band between these two
  // keeps the previous class so corner jitter does not flip the hold length.
  stationarySpeed:0.35,
  movingSpeed:0.75,
  motionWindowMs:240,
  minMotionDt:0.09,
  poseGate:0.42,
  conflictGate:0.45,
  jumpBase:1.15,
  minSize:20,
  maxAspect:4,
  maxScaleRatio:1.6,
  // Continuity only. Strong acceptance stays at the matcher gates.
  linkedWeakScore:0.8,
  linkedWeakMargin:0.05,
  legacyWeakScore:0.78,
  legacyWeakMargin:0.05,
});

export function meanEdge(corners){
  let sum=0;
  for(let i=0;i<4;i++) sum+=Math.hypot(corners[i].x-corners[(i+1)%4].x,corners[i].y-corners[(i+1)%4].y);
  return sum/4;
}
export function centre(corners){return {x:corners.reduce((s,p)=>s+p.x,0)/4,y:corners.reduce((s,p)=>s+p.y,0)/4};}
export function poseError(a,b){
  const size=Math.max(1,(meanEdge(a)+meanEdge(b))/2);
  let sum=0;
  for(let i=0;i<4;i++) sum+=Math.hypot(a[i].x-b[i].x,a[i].y-b[i].y);
  return sum/4/size;
}
export function scaleOk(a,b){
  const ratio=meanEdge(b)/Math.max(1,meanEdge(a));
  return ratio>=1/TRACKING.maxScaleRatio&&ratio<=TRACKING.maxScaleRatio;
}
export function holdMs(motion){return motion==='stationary'?TRACKING.stationaryHoldMs:TRACKING.movingHoldMs;}
export function sampleSpeed(samples){
  if(samples.length<2) return 0;
  const a=samples[0],b=samples.at(-1),dt=(b.t-a.t)/1000;
  if(dt<=0) return 0;
  return Math.hypot(b.x-a.x,b.y-a.y)/((a.size+b.size)/2)/dt;
}
export function classifyMotion(samples,previous='moving'){
  if(samples.length<3) return previous;
  const a=samples[0],b=samples.at(-1),dt=(b.t-a.t)/1000;
  if(dt<TRACKING.minMotionDt) return previous;
  const speed=Math.hypot(b.x-a.x,b.y-a.y)/((a.size+b.size)/2)/dt;
  if(speed>=TRACKING.movingSpeed) return 'moving';
  if(speed<=TRACKING.stationarySpeed) return 'stationary';
  return previous;
}
export function placementLabel(track){
  if(!track) return 'Out of view';
  if(track.kind==='ghost') return track.locked?(track.status==='image-tracked'?'Following image · brief hold':'Hidden ID verified'):'Confirming identity…';
  if(track.phase==='holding') return 'Brief hold';
  if(track.locked) return `Tracking · ${Math.round((track.confidence??0)*100)}% match`;
  return 'Reacquiring';
}
