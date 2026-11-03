import { PlaneRenderer } from './renderer.mjs';
import { homography, project } from './geometry.mjs';
import { MARKERS } from './marker.mjs';
import {defaultScene,drawCover} from './scenes.mjs';

export class DemoScene {
  constructor(images) {this.planes=MARKERS.map((marker,i)=>{const plane=new PlaneRenderer();plane.setImage(images[i]);return plane;});}
  draw(ctx,time,scene=defaultScene(),background,markerIds=MARKERS.map(m=>m.id)) {
    const t=time/1000;
    if(scene.layout!=='moving'){
      ctx.save();
      if(scene.motion){ctx.translate(640+Math.sin(t*.24)*2,360+Math.cos(t*.19)*1.5);ctx.scale(1.012,1.012);ctx.translate(-640,-360);}
      if(background)drawCover(ctx,background);else this.drawGrid(ctx);
      if(scene.layout==='placed')for(const id of markerIds){const index=MARKERS.findIndex(m=>m.id===id);if(index>=0)this.drawMarker(ctx,index,scene.placements[id]);}
      ctx.restore();return;
    }
    this.drawGrid(ctx);
    const theta=t*.35;
    MARKERS.forEach((marker,index)=>{
      if(!markerIds.includes(marker.id))return;
      const direction=index===0?-1:1;
      const cx=640+direction*Math.cos(theta)*270,cy=365+direction*Math.sin(theta)*150;
      const size=220,tilt=Math.sin(t*.6+index)*.26;
      const angle=Math.sin(t*.22+index)*.13;
      const raw=[{x:-size/2-tilt*45,y:-size/2+tilt*65},{x:size/2,y:-size/2-tilt*60},{x:size/2+tilt*45,y:size/2+tilt*60},{x:-size/2,y:size/2-tilt*65}];
      const q=raw.map(p=>({x:cx+p.x*Math.cos(angle)-p.y*Math.sin(angle),y:cy+p.x*Math.sin(angle)+p.y*Math.cos(angle)}));
      this.drawMarker(ctx,index,q);
      const border=[[-.12,-.12],[1.12,-.12],[1.12,1.12],[-.12,1.12]].map(([x,y])=>project(homography(q),x,y));
      ctx.font='14px sans-serif';ctx.fillStyle=marker.color;ctx.fillText(marker.id,cx-26,Math.max(...border.map(p=>p.y))+24);
    });
  }
  drawGrid(ctx){
    const g=ctx.createLinearGradient(0,0,1280,720);g.addColorStop(0,'#24384a');g.addColorStop(.6,'#1b293b');g.addColorStop(1,'#101b2b');ctx.fillStyle=g;ctx.fillRect(0,0,1280,720);
    const glow=ctx.createRadialGradient(800,280,20,800,280,660);glow.addColorStop(0,'#b9c5d31b');glow.addColorStop(1,'#b9c5d300');ctx.fillStyle=glow;ctx.fillRect(0,0,1280,720);
    ctx.lineWidth=1;ctx.strokeStyle='#a1c9dc0e';
    for(let x=0;x<1280;x+=80){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,570);ctx.stroke();}
    for(let y=10;y<570;y+=80){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1280,y);ctx.stroke();}
    ctx.fillStyle='#09142366';ctx.fillRect(0,570,1280,150);ctx.strokeStyle='#718ba321';ctx.beginPath();ctx.moveTo(0,570);ctx.lineTo(1280,570);ctx.stroke();
    for(let x=-800;x<2100;x+=170){ctx.beginPath();ctx.moveTo(640+(x-640)*.7,570);ctx.lineTo(x,720);ctx.stroke();}
    ctx.fillStyle='#8ca4bd';ctx.font='13px sans-serif';ctx.fillText('THE DIGIPOLY DEMO STUDIO',58,62);
    ctx.fillStyle='#cbd9e9';ctx.font='22px sans-serif';ctx.fillText('Two identities. Content that follows.',58,101);
  }
  drawMarker(ctx,index,q){
    if(!q)return;
    const h=homography(q),border=[[-.12,-.12],[1.12,-.12],[1.12,1.12],[-.12,1.12]].map(([x,y])=>project(h,x,y));
    ctx.save();ctx.shadowColor='#0005';ctx.shadowBlur=8;ctx.shadowOffsetX=1;ctx.shadowOffsetY=3;ctx.beginPath();border.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle='#f4f3ee';ctx.fill();ctx.restore();
    ctx.drawImage(this.planes[index].draw(q),0,0);
  }
}
