import {MARKERS} from './marker.mjs';
// Never associate by left/right position or contour order. A decoded ID owns its
// own smoothing/confirmation state; a missed frame immediately clears its lock.
export class MarkerTracks {
  constructor(){this.states=new Map();}
  reset(){this.states.clear();}
  update(detections){
    const next=new Map();
    for(const marker of MARKERS){
      const matches=detections.filter(d=>d.id===marker.id);
      if(matches.length!==1)continue;
      const detection=matches[0],previous=this.states.get(marker.id);
      const shift=previous?detection.corners.reduce((sum,p,i)=>sum+Math.hypot(p.x-previous.corners[i].x,p.y-previous.corners[i].y),0)/4:Infinity;
      const alpha=shift>6?1:.7;
      const corners=previous?detection.corners.map((p,i)=>({x:previous.corners[i].x+(p.x-previous.corners[i].x)*alpha,y:previous.corners[i].y+(p.y-previous.corners[i].y)*alpha})):detection.corners;
      const count=(previous?.count||0)+1;
      next.set(marker.id,{...detection,corners,count,locked:count>=2});
    }
    this.states=next;return [...next.values()];
  }
}
export class MarkerAssignments {
  constructor(){this.content=new Map([['DP-001','portal'],['DP-002','on-air']]);}
  get(id){return this.content.get(id);}
  set(id,key){if(!this.content.has(id))throw new Error(`Unknown marker: ${id}`);this.content.set(id,key);}
}
