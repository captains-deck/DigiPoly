/** Confirmation and bounded hold. Geometry is required on every emitted frame. */
export class GhostTracks {
  constructor({holdMs=1500,confirmations=2,maxMotion=100}={}){this.holdMs=holdMs;this.confirmations=confirmations;this.maxMotion=maxMotion;this.states=new Map();}
  reset(){this.states.clear();}
  update(detections,now=performance.now()){
    const next=new Map(),output=[];
    for(const d of detections){
      if(detections.filter(x=>x.id===d.id).length!==1||d.conflict||!d.geometryGood)continue;
      const old=this.states.get(d.id),continuous=old&&now-old.seenAt<600&&d.corners.reduce((n,p,i)=>n+Math.hypot(p.x-old.corners[i].x,p.y-old.corners[i].y),0)/4<this.maxMotion;
      const previous=continuous&&(!old.locked||now-old.verifiedAt<=this.holdMs)?old:null;
      const count=d.verified?(previous?.count||0)+1:previous?.locked?previous.count:0;
      const confirmed=d.verified&&count>=this.confirmations||Boolean(previous?.locked);
      const verifiedAt=d.verified?now:previous?.verifiedAt??-Infinity;
      const locked=confirmed&&(d.verified||now-verifiedAt<=this.holdMs);
      const current={...d,count,locked,verifiedAt,seenAt:now,status:locked?(d.verified?'verified':'image-tracked'):'confirming'};
      next.set(d.id,current);if(locked)output.push(current);
    }
    this.states=next;return output;
  }
}
