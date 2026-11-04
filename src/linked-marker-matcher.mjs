// Shared silhouette and corner-cell reading for one linked-marker generation.
// Thresholds stay with the caller so a new outline cannot loosen an older one.
export function createLinkedAssessment(mod,size=128){
  const template=mod.markerPixels(size,'DP-001',{includeCode:false}),samples=[];
  const {min,max}=mod.IDENTITY_BOUNDS;
  for(let y=3;y<size-3;y++)for(let x=3;x<size-3;x++){
    const px=(x+.5)*mod.MARKER_SIZE/size,py=(y+.5)*mod.MARKER_SIZE/size;
    const coded=mod.CORNERS.some(([fx,fy])=>{const cx=fx?mod.MARKER_SIZE-px:px,cy=fy?mod.MARKER_SIZE-py:py;return cx>=min&&cx<=max&&cy>=min&&cy<=max;});
    if(!coded)samples.push([x,y,template[y*size+x]>0]);
  }
  const full=Object.fromEntries(mod.MARKERS.map(marker=>[marker.id,mod.markerPixels(size,marker.id)]));
  const pixelAt=(pixels,x,y,r)=>{if(r===1)return pixels[x*size+size-1-y];if(r===2)return pixels[(size-1-y)*size+size-1-x];if(r===3)return pixels[(size-1-x)*size+y];return pixels[y*size+x];};
  const agreement=(pixels,expected,rotation)=>{
    let white=0,black=0,whiteHit=0,blackHit=0;
    for(let y=3;y<size-3;y++)for(let x=3;x<size-3;x++){
      const want=expected[y*size+x]>0,actual=pixelAt(pixels,x,y,rotation)>127;
      if(want){white++;if(actual)whiteHit++;}else{black++;if(!actual)blackHit++;}
    }
    return (whiteHit/white+blackHit/black)/2;
  };
  return function assess(pixels){
    const rotations=[];
    for(let r=0;r<4;r++){let white=0,black=0,whiteHit=0,blackHit=0;for(const [x,y,expected] of samples){const actual=pixelAt(pixels,x,y,r)>127;if(expected){white++;if(actual)whiteHit++;}else{black++;if(!actual)blackHit++;}}rotations.push({rotation:r,score:(whiteHit/white+blackHit/black)/2});}
    rotations.sort((a,b)=>b.score-a.score);const best=rotations[0];
    const read=mod.CODE_CELLS.map(([cx,cy])=>{let white=0,total=0;for(let y=Math.ceil(cy*size/mod.MARKER_SIZE);y<Math.floor((cy+mod.CELL_SIZE)*size/mod.MARKER_SIZE);y++)for(let x=Math.ceil(cx*size/mod.MARKER_SIZE);x<Math.floor((cx+mod.CELL_SIZE)*size/mod.MARKER_SIZE);x++){white+=pixelAt(pixels,x,y,best.rotation)>127?1:0;total++;}const level=total?white/total:0;return level>=.78?1:level<=.22?0:null;});
    const uncertain=read.filter(b=>b===null).length;
    const ranked=mod.MARKERS.map(marker=>({id:marker.id,errors:read.reduce((n,b,i)=>n+(b!==null&&b!==marker.bits[i]?1:0),0)})).sort((a,b)=>a.errors-b.errors);
    const structure=agreement(pixels,full[ranked[0].id],best.rotation);
    return {rotation:best.rotation,score:best.score,margin:best.score-rotations[1].score,uncertain,errors:ranked[0].errors,separation:ranked[1].errors-ranked[0].errors,id:ranked[0].id,version:mod.MARKER_VERSION,structure};
  };
}
