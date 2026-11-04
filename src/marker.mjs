// Portal v4: the linked logo, redrawn so the corner blocks and central arrow
// keep their weight when the mark is small. DP-001 is the logo. DP-002 turns
// the inner link in each corner by 180 degrees around that corner's centre.
// Printed v3 and v2 markers stay in marker-v3.mjs and marker-v2.mjs.
export const MARKER_SIZE=800,MARKER_VERSION=4,BACKGROUND='#090a0b';
export const MARKERS=[
  {id:'DP-001',slug:'dp-001',color:'#60e3d2',bits:[1,0,1,0,1,0,1,0]},
  {id:'DP-002',slug:'dp-002',color:'#c19aff',bits:[0,1,0,1,0,1,0,1]},
];
export const BODY=[[272,188],[440,188],[612,348],[612,452],[440,612],[272,612],[272,528],[192,528],[192,444],[272,444],[272,360],[192,360],[192,276],[272,276]];
// Corner cluster is 192px, 28% larger than v3's 150px cluster, with 36px
// strokes and 16px gaps. It stays clear of the D.
const OUTER_LINKS=[
  [[36,36],[124,36],[124,72],[72,72],[72,124],[36,124]],
  [[140,36],[228,36],[228,124],[192,124],[192,72],[140,72]],
  [[36,140],[72,140],[72,192],[124,192],[124,228],[36,228]],
];
const INNER_LINK=[[88,88],[176,88],[176,124],[124,124],[124,176],[88,176]];
const CORNER_PIVOT=132;
// The four block pieces of the v3 arrow, shifted left so the opening sits
// nearer the older logo's optical centre, with the gaps between pieces opened.
export const APERTURES=[
  [[335,342],[359,366],[386,340],[412,366],[437,342],[386,291]],
  [[444,349],[419,374],[445,400],[419,426],[444,451],[495,400]],
  [[387,349],[363,374],[390,400],[363,426],[387,451],[437,400]],
  [[335,458],[386,509],[437,458],[412,434],[386,460],[359,434]],
];
export const CORNERS=[[false,false],[true,false],[false,true],[true,true]];
const reflect=(polygon,[flipX,flipY])=>polygon.map(([x,y])=>[flipX?800-x:x,flipY?800-y:y]);
export const CELL_SIZE=20;
// The corner clusters are four-fold symmetric, so they are not part of the
// orientation silhouette. Identity is read from the cells inside this box.
export const IDENTITY_BOUNDS={min:28,max:240};
export const CODE_CELLS=CORNERS.flatMap(([fx,fy])=>[[96,96],[148,148]].map(([x,y])=>[fx?800-x-CELL_SIZE:x,fy?800-y-CELL_SIZE:y]));
export function getMarker(id){const marker=MARKERS.find(m=>m.id===id);if(!marker)throw new Error(`Unknown marker: ${id}`);return marker;}
export function whiteShapes(id='DP-001',{includeCode=true}={}){
  getMarker(id);
  const inner=id==='DP-001'?INNER_LINK:INNER_LINK.map(([x,y])=>[CORNER_PIVOT*2-x,CORNER_PIVOT*2-y]);
  return [BODY,...CORNERS.flatMap(c=>[...OUTER_LINKS,...(includeCode?[inner]:[])].map(p=>reflect(p,c)))];
}
function inside(x,y,polygon){let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const [xi,yi]=polygon[i],[xj,yj]=polygon[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)hit=!hit;}return hit;}
export function markerPixels(size=128,id='DP-001',options={}){
  const shapes=whiteShapes(id,options),data=new Uint8Array(size*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const px=(x+.5)*800/size,py=(y+.5)*800/size;data[y*size+x]=shapes.some(p=>inside(px,py,p))&&!APERTURES.some(p=>inside(px,py,p))?255:0;}
  return data;
}
export function markerSvg({id='DP-001',quiet=0}={}){
  const points=p=>p.map(v=>v.join(',')).join(' ');getMarker(id);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${800+quiet*2}" height="${800+quiet*2}" viewBox="${-quiet} ${-quiet} ${800+quiet*2} ${800+quiet*2}"><title>DigiPoly ${id} — Portal v4 linked marker</title>${quiet?`<rect x="${-quiet}" y="${-quiet}" width="${800+quiet*2}" height="${800+quiet*2}" fill="white"/>`:''}<rect width="800" height="800" fill="${BACKGROUND}"/>${whiteShapes(id).map(p=>`<polygon points="${points(p)}" fill="white"/>`).join('')}${APERTURES.map(p=>`<polygon points="${points(p)}" fill="${BACKGROUND}"/>`).join('')}</svg>`;
}
