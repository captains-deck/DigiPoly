// Portal v2: shared D and corner brackets, with sixteen identity cells.
// Geometry is reconstructed from the supplied two-marker concept. Print these
// canonical assets; an arbitrary screenshot is not the calibrated target.
export const MARKERS = [
  { id: 'DP-001', slug: 'dp-001', color: '#60e3d2', bits: [1,1,0,1, 0,1,0,1, 0,1,1,1, 1,0,0,1] },
  { id: 'DP-002', slug: 'dp-002', color: '#c19aff', bits: [0,0,1,0, 0,1,0,1, 1,0,0,0, 0,1,1,0] },
];
export const WHITE_SHAPES = [
  [[12,12],[60,12],[60,22],[22,22],[22,64],[12,64]],
  [[142,12],[188,12],[188,64],[178,64],[178,22],[142,22]],
  [[12,138],[22,138],[22,178],[60,178],[60,188],[12,188]],
  [[178,138],[188,138],[188,188],[142,188],[142,178],[178,178]],
  [[68,47],[110,47],[153,87],[153,113],[110,153],[68,153],[68,132],[48,132],[48,111],[68,111],[68,90],[48,90],[48,69],[68,69]],
];
export const APERTURE = [[88,68],[132,100],[88,132]];
export const CELL_SIZE=11;
export const CODE_CELLS = [[28,28],[44,28],[28,44],[44,44], [146,28],[162,28],[146,44],[162,44], [28,146],[44,146],[28,162],[44,162], [146,146],[162,146],[146,162],[162,162]];
export function getMarker(id){const marker=MARKERS.find(m=>m.id===id);if(!marker)throw new Error(`Unknown marker: ${id}`);return marker;}
function inside(x,y,polygon){let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const [xi,yi]=polygon[i],[xj,yj]=polygon[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)hit=!hit;}return hit;}
export function markerPixels(size=96,id='DP-001',{includeCode=true}={}){
  const marker=getMarker(id),data=new Uint8Array(size*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const px=(x+.5)*200/size,py=(y+.5)*200/size;
    const structure=WHITE_SHAPES.some(p=>inside(px,py,p))&&!inside(px,py,APERTURE);
    const bit=includeCode&&CODE_CELLS.some(([cx,cy],i)=>marker.bits[i]&&px>=cx&&px<cx+CELL_SIZE&&py>=cy&&py<cy+CELL_SIZE);
    data[y*size+x]=structure||bit?255:0;
  }
  return data;
}
export function markerSvg({id='DP-001',quiet=0}={}){
  const marker=getMarker(id),points=p=>p.map(v=>v.join(',')).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${200+quiet*2}" height="${200+quiet*2}" viewBox="${-quiet} ${-quiet} ${200+quiet*2} ${200+quiet*2}"><title>DigiPoly ${id} — Portal v2</title>${quiet?`<rect x="${-quiet}" y="${-quiet}" width="${200+2*quiet}" height="${200+2*quiet}" fill="white"/>`:''}<rect width="200" height="200" fill="#08090b"/>${WHITE_SHAPES.map(p=>`<polygon points="${points(p)}" fill="white"/>`).join('')}<polygon points="${points(APERTURE)}" fill="#08090b"/>${CODE_CELLS.map(([x,y],i)=>marker.bits[i]?`<rect x="${x}" y="${y}" width="${CELL_SIZE}" height="${CELL_SIZE}" fill="white"/>`:'').join('')}</svg>`;
}
