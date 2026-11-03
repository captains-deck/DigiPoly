import { markerPixels, MARKERS, CODE_CELLS, CELL_SIZE } from './marker-v2.mjs';

export const NORMALIZED_SIZE=128;
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
export function matchLegacyPortal(pixels){
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
