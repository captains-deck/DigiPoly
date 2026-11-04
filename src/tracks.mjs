import {MARKERS} from './marker.mjs';
import {TRACKING,meanEdge,centre,poseError,scaleOk,holdMs,sampleSpeed,classifyMotion} from './tracking-policy.mjs';
// Identity stays on the confirmed marker. A miss can coast, but only after a
// lock, only for a motion-dependent time, and never across an identity conflict.
export class MarkerTracks {
  constructor(){this.states=new Map();}
  reset(){this.states.clear();}
  forget(id){this.states.delete(id);}
  snapshot(){return MARKERS.map(marker=>this.states.get(marker.id)).filter(Boolean);}
  alive(state,now){
    if(!state.locked) return now-state.geometryAt<=TRACKING.movingHoldMs;
    return now-state.geometryAt<=holdMs(state.motion)&&now-state.verifiedAt<=TRACKING.identityWindowMs;
  }
  expire(now){
    let removed=false;
    for(const [id,state] of this.states) if(!this.alive(state,now)){this.states.delete(id);removed=true;}
    return removed;
  }
  update(detections,now=performance.now()){
    const list=detections||[],ambiguous=new Set(list.filter(d=>d.ambiguous&&d.id).map(d=>d.id));
    const strong=[],weak=[],geometry=[];
    for(const detection of list){
      if(detection.ambiguous||detection.kind==='ghost'||!validPose(detection)) continue;
      const quality=detection.quality==='weak'?'weak':detection.quality==='geometry'||!detection.id?'geometry':'strong';
      if(quality==='strong') strong.push(detection);
      else if(quality==='weak') weak.push(detection);
      else geometry.push(detection);
    }
    for(const id of new Set(strong.map(d=>d.id))) if(strong.filter(d=>d.id===id).length>1) ambiguous.add(id);
    const usableStrong=strong.filter(d=>!ambiguous.has(d.id)),usableWeak=weak.filter(d=>!ambiguous.has(d.id));
    const geometryFor=assignGeometry([...this.states.values()].filter(s=>s.locked),geometry,now);
    for(const marker of MARKERS){
      const id=marker.id;
      if(ambiguous.has(id)){this.states.delete(id);continue;}
      let state=this.states.get(id)||null;
      const strongHit=usableStrong.find(d=>d.id===id)||null;
      if(state?.locked&&usableStrong.some(d=>d.id!==id&&poseError(state.corners,d.corners)<=TRACKING.conflictGate)){
        const sameQuad=strongHit&&usableStrong.some(d=>d.id!==id&&poseError(strongHit.corners,d.corners)<=TRACKING.conflictGate);
        this.states.delete(id);state=null;
        if(sameQuad||!strongHit) continue;
      }
      if(strongHit){
        const dt=state?(now-state.geometryAt)/1000:0;
        this.states.set(id,!state||continuous(state,strongHit,dt)?this.confirm(state,strongHit,now):this.fresh(strongHit,now));
        continue;
      }
      if(state?.locked&&now-state.verifiedAt<=TRACKING.identityWindowMs){
        const near=usableWeak.find(d=>d.id===id&&scaleOk(state.corners,d.corners)&&poseError(state.corners,d.corners)<=TRACKING.poseGate);
        if(near||geometryFor.get(id)){this.states.set(id,this.follow(state,near||geometryFor.get(id),now));continue;}
      }
      if(state&&this.alive(state,now)){if(state.locked) state.phase='holding';continue;}
      this.states.delete(id);
    }
    return this.snapshot();
  }
  fresh(detection,now){
    const point=centre(detection.corners),size=meanEdge(detection.corners);
    return {...fields(detection),corners:copy(detection.corners),count:1,locked:false,phase:'acquiring',motion:'moving',speed:0,verifiedAt:now,geometryAt:now,samples:[{t:now,x:point.x,y:point.y,size}],confidence:detection.confidence??1,area:detection.area??size*size};
  }
  confirm(previous,detection,now){
    const corners=smooth(previous?.corners,detection.corners),point=centre(corners),size=meanEdge(corners);
    const samples=trim([...(previous?.samples||[]),{t:now,x:point.x,y:point.y,size}],now);
    const count=(previous?.count||0)+1,locked=Boolean(previous?.locked)||count>=TRACKING.confirmations;
    return {...fields(detection),corners,count,locked,phase:locked?'tracking':'acquiring',motion:classifyMotion(samples,previous?.motion||'moving'),speed:sampleSpeed(samples),verifiedAt:now,geometryAt:now,samples,confidence:detection.confidence??previous?.confidence??1,identityConfidence:detection.identityConfidence??previous?.identityConfidence,version:detection.version??previous?.version,area:detection.area??previous?.area??size*size};
  }
  follow(state,detection,now){
    const corners=smooth(state.corners,detection.corners),point=centre(corners),size=meanEdge(corners);
    const samples=trim([...(state.samples||[]),{t:now,x:point.x,y:point.y,size}],now);
    return {...state,corners,phase:'holding',motion:classifyMotion(samples,state.motion),speed:sampleSpeed(samples),geometryAt:now,samples,area:detection.area??state.area};
  }
}
export class MarkerAssignments {
  constructor(){this.content=new Map([['DP-001','portal'],['DP-002','on-air']]);}
  get(id){return this.content.get(id);}
  set(id,key){if(!this.content.has(id))throw new Error(`Unknown marker: ${id}`);this.content.set(id,key);}
}
function fields(detection){return {id:detection.id,confidence:detection.confidence,identityConfidence:detection.identityConfidence,version:detection.version,quality:'strong'};}
function copy(corners){return corners.map(p=>({x:p.x,y:p.y}));}
function smooth(previous,next){
  if(!previous) return copy(next);
  const shift=previous.reduce((sum,p,i)=>sum+Math.hypot(p.x-next[i].x,p.y-next[i].y),0)/4;
  const alpha=shift>Math.max(6,meanEdge(previous)*0.08)?1:.72;
  return next.map((p,i)=>({x:previous[i].x+(p.x-previous[i].x)*alpha,y:previous[i].y+(p.y-previous[i].y)*alpha}));
}
function trim(samples,now){return samples.filter(s=>now-s.t<=TRACKING.motionWindowMs).slice(-8);}
function validPose(detection){
  const corners=detection.corners;
  if(!corners||corners.length!==4||corners.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y))) return false;
  const edges=corners.map((p,i)=>Math.hypot(p.x-corners[(i+1)%4].x,p.y-corners[(i+1)%4].y));
  const min=Math.min(...edges),max=Math.max(...edges);
  return min>=TRACKING.minSize&&max/min<=TRACKING.maxAspect;
}
function continuous(state,detection,dt){
  if(!scaleOk(state.corners,detection.corners)) return false;
  const allowed=Math.max(TRACKING.jumpBase,(state.speed||0)*dt*2.5+.45);
  return poseError(state.corners,detection.corners)<=allowed;
}
function assignGeometry(tracks,observations,now){
  const hits=[];
  for(const observation of observations){
    const matches=[];
    for(const track of tracks){
      if(now-track.verifiedAt>TRACKING.identityWindowMs||!scaleOk(track.corners,observation.corners)) continue;
      if(poseError(track.corners,observation.corners)<=TRACKING.poseGate) matches.push(track.id);
    }
    if(matches.length===1) hits.push({id:matches[0],observation});
  }
  const assigned=new Map();
  for(const hit of hits) assigned.set(hit.id,assigned.has(hit.id)?null:hit.observation);
  for(const [id,observation] of assigned) if(!observation) assigned.delete(id);
  return assigned;
}
