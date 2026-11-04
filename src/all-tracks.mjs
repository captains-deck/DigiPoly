import {MarkerTracks} from './tracks.mjs';
import {GhostTracks} from '../vendor/ghostmarker/tracking.mjs';
export class AllTracks {
 constructor(){this.portal=new MarkerTracks();this.ghost=new GhostTracks();}
 snapshot(){return [...this.portal.snapshot(),...this.ghost.states.values()];}
 forget(id){this.portal.forget(id);this.ghost.states.delete(id);}
 sweep(now=performance.now()){
  const coded=this.portal.expire(now);
  let ghost=false;
  for(const [id,track] of [...this.ghost.states]) if(track.locked&&now-track.seenAt>=600){this.ghost.states.delete(id);ghost=true;}
  return coded||ghost;
 }
 reset(){this.portal.reset();this.ghost.reset();}
 update(detections,now=performance.now()){const list=detections||[],ordinary=this.portal.update(list.filter(d=>d.kind!=='ghost'),now);this.ghost.update(list.filter(d=>d.kind==='ghost'),now);return [...ordinary,...this.ghost.states.values()];}
}
