// Project a unit square into a clockwise quadrilateral. Homogeneous coordinates
// preserve perspective, including artwork orientation when the marker rotates.
export function homography(q) {
  const [a,b,c,d] = q;
  const dx1=b.x-c.x, dx2=d.x-c.x, dx3=a.x-b.x+c.x-d.x;
  const dy1=b.y-c.y, dy2=d.y-c.y, dy3=a.y-b.y+c.y-d.y;
  const det=dx1*dy2-dx2*dy1;
  let g=0, h=0;
  if (Math.abs(dx3)+Math.abs(dy3)>1e-8) {
    if (Math.abs(det)<1e-8) throw new Error('Degenerate marker plane');
    g=(dx3*dy2-dx2*dy3)/det; h=(dx1*dy3-dx3*dy1)/det;
  }
  return [b.x-a.x+g*b.x,d.x-a.x+h*d.x,a.x,b.y-a.y+g*b.y,d.y-a.y+h*d.y,a.y,g,h,1];
}

export function project(h,x,y) {
  const w=h[6]*x+h[7]*y+h[8];
  return { x:(h[0]*x+h[1]*y+h[2])/w, y:(h[3]*x+h[4]*y+h[5])/w };
}

export function orderCorners(points) {
  const cx=points.reduce((s,p)=>s+p.x,0)/4, cy=points.reduce((s,p)=>s+p.y,0)/4;
  const ordered=[...points].sort((a,b)=>Math.atan2(a.y-cy,a.x-cx)-Math.atan2(b.y-cy,b.x-cx));
  let start=0;
  for(let i=1;i<4;i++) if(ordered[i].x+ordered[i].y<ordered[start].x+ordered[start].y) start=i;
  return [...ordered.slice(start),...ordered.slice(0,start)];
}
