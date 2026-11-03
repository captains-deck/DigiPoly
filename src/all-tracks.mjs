import {MarkerTracks} from './tracks.mjs';
import {GhostTracks} from '../vendor/ghostmarker/tracking.mjs';
export class AllTracks {
 constructor(){this.portal=new MarkerTracks();this.ghost=new GhostTracks();}
 sweep(now=performance.now()){if([...this.ghost.states.values()].some(t=>t.locked&&now-t.seenAt>=600)){this.reset();return true;}return false;}
 reset(){this.portal.reset();this.ghost.reset();}
 update(detections,now=performance.now()){const ordinary=this.portal.update(detections.filter(d=>d.kind!=='ghost'));this.ghost.update(detections.filter(d=>d.kind==='ghost'),now);return [...ordinary,...this.ghost.states.values()];}
}
