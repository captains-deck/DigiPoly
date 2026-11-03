// Portal v3: vector reconstruction of the supplied interlocking-link design.
// DP-001 is the logo. DP-002 turns the inner link in each corner by 180 degrees.
// The old sixteen-cell prints remain supported through marker-v2.mjs.
export const MARKER_SIZE=800,MARKER_VERSION=3,BACKGROUND='#090a0b';
export const MARKERS=[
  {id:'DP-001',slug:'dp-001',color:'#60e3d2',bits:[1,0,1,0,1,0,1,0]},
  {id:'DP-002',slug:'dp-002',color:'#c19aff',bits:[0,1,0,1,0,1,0,1]},
];
export const BODY=[[272,188],[440,188],[612,348],[612,452],[440,612],[272,612],[272,528],[192,528],[192,444],[272,444],[272,360],[192,360],[192,276],[272,276]];
const OUTER_LINKS=[
  [[53,53],[122,53],[122,82],[82,82],[82,122],[53,122]],
  [[134,53],[203,53],[203,122],[174,122],[174,82],[134,82]],
  [[53,134],[82,134],[82,174],[122,174],[122,203],[53,203]],
];
const INNER_LINK=[[93,93],[163,93],[163,122],[122,122],[122,163],[93,163]];
export const APERTURES=[
  [[362,346],[386,370],[413,344],[439,370],[464,346],[413,295]],
  [[467,349],[442,374],[468,400],[442,426],[467,451],[518,400]],
  [[413,349],[389,374],[416,400],[389,426],[413,451],[464,400]],
  [[362,454],[413,505],[464,454],[439,430],[413,456],[386,430]],
];
export const CORNERS=[[false,false],[true,false],[false,true],[true,true]];
const reflect=(polygon,[flipX,flipY])=>polygon.map(([x,y])=>[flipX?800-x:x,flipY?800-y:y]);
export const CELL_SIZE=20;
export const CODE_CELLS=CORNERS.flatMap(([fx,fy])=>[[98,98],[138,138]].map(([x,y])=>[fx?800-x-CELL_SIZE:x,fy?800-y-CELL_SIZE:y]));
export function getMarker(id){const marker=MARKERS.find(m=>m.id===id);if(!marker)throw new Error(`Unknown marker: ${id}`);return marker;}
export function whiteShapes(id='DP-001',{includeCode=true}={}){
  getMarker(id);const inner=id==='DP-001'?INNER_LINK:INNER_LINK.map(([x,y])=>[256-x,256-y]);
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
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${800+quiet*2}" height="${800+quiet*2}" viewBox="${-quiet} ${-quiet} ${800+quiet*2} ${800+quiet*2}"><title>DigiPoly ${id} — Portal v3 linked marker</title>${quiet?`<rect x="${-quiet}" y="${-quiet}" width="${800+quiet*2}" height="${800+quiet*2}" fill="white"/>`:''}<rect width="800" height="800" fill="${BACKGROUND}"/>${whiteShapes(id).map(p=>`<polygon points="${points(p)}" fill="white"/>`).join('')}${APERTURES.map(p=>`<polygon points="${points(p)}" fill="${BACKGROUND}"/>`).join('')}</svg>`;
}
