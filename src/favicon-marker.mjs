// Optically adjusted tab icon. Same D, corner language and block arrow as the
// printable v4 marker, with heavier corner strokes and wider gaps. It is not a
// tracking target; printed markers use marker.mjs.
export const MARKER_SIZE=800,BACKGROUND='#090a0b';
const BODY=[[272,188],[440,188],[612,348],[612,452],[440,612],[272,612],[272,528],[192,528],[192,444],[272,444],[272,360],[192,360],[192,276],[272,276]];
const OUTER_LINKS=[
  [[32,32],[126,32],[126,70],[70,70],[70,126],[32,126]],
  [[144,32],[238,32],[238,126],[200,126],[200,70],[144,70]],
  [[32,144],[70,144],[70,200],[126,200],[126,238],[32,238]],
];
const INNER_LINK=[[88,88],[182,88],[182,126],[126,126],[126,182],[88,182]];
const APERTURES=[
  [[333,341],[357,365],[384,339],[409,365],[434,341],[384,290]],
  [[443,349],[418,374],[444,400],[418,426],[443,451],[493,400]],
  [[384,349],[361,374],[387,400],[361,426],[384,451],[435,400]],
  [[333,459],[384,510],[434,459],[409,435],[384,461],[357,435]],
];
const CORNERS=[[false,false],[true,false],[false,true],[true,true]];
const reflect=(polygon,[flipX,flipY])=>polygon.map(([x,y])=>[flipX?800-x:x,flipY?800-y:y]);
function shapes(){
  const inner=INNER_LINK;
  return [BODY,...CORNERS.flatMap(c=>[...OUTER_LINKS,inner].map(p=>reflect(p,c)))];
}
function inside(x,y,polygon){let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const [xi,yi]=polygon[i],[xj,yj]=polygon[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)hit=!hit;}return hit;}
export function faviconPixels(size=32){
  const drawn=shapes(),data=new Uint8Array(size*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const px=(x+.5)*800/size,py=(y+.5)*800/size;data[y*size+x]=drawn.some(p=>inside(px,py,p))&&!APERTURES.some(p=>inside(px,py,p))?255:0;}
  return data;
}
export function faviconSvg(){
  const points=p=>p.map(v=>v.join(',')).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 800 800" shape-rendering="crispEdges"><title>DigiPoly favicon</title><rect width="800" height="800" fill="${BACKGROUND}"/>${shapes().map(p=>`<polygon points="${points(p)}" fill="white"/>`).join('')}${APERTURES.map(p=>`<polygon points="${points(p)}" fill="${BACKGROUND}"/>`).join('')}</svg>`;
}
