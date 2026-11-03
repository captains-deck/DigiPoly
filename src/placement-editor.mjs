import {validQuad} from './scenes.mjs';
import {MARKERS} from './marker.mjs';
const centre=q=>({x:q.reduce((s,p)=>s+p.x,0)/4,y:q.reduce((s,p)=>s+p.y,0)/4});
const inside=(point,q)=>q.every((a,i)=>{const b=q[(i+1)%4];return (b.x-a.x)*(point.y-a.y)-(b.y-a.y)*(point.x-a.x)>=0;});
export class PlacementEditor {
  constructor({dialog,canvas,select,demo,getBackground,onSave}){
    Object.assign(this,{dialog,canvas,select,demo,getBackground,onSave});this.ctx=canvas.getContext('2d');
    canvas.onpointerdown=event=>{const point=this.point(event),q=this.scene.placements[this.select.value];if(!q)return;const corner=q.findIndex(p=>Math.hypot(p.x-point.x,p.y-point.y)<24);if(corner<0&&!inside(point,q))return;this.drag={corner,start:point,quad:structuredClone(q)};canvas.setPointerCapture(event.pointerId);event.preventDefault();};
    canvas.onpointermove=event=>{if(!this.drag)return;const point=this.point(event),dx=point.x-this.drag.start.x,dy=point.y-this.drag.start.y,q=this.drag.quad.map((p,i)=>this.drag.corner<0||this.drag.corner===i?{x:p.x+dx,y:p.y+dy}:{...p});this.change(q);};
    canvas.onpointerup=canvas.onpointercancel=()=>{this.drag=null;};select.onchange=()=>this.draw();
    canvas.onkeydown=event=>{const move={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(!move)return;event.preventDefault();const step=event.shiftKey?10:1;this.change(this.scene.placements[select.value].map(p=>({x:p.x+move[0]*step,y:p.y+move[1]*step})));};
  }
  open(environment){this.envId=environment.id;this.scene=structuredClone(environment.scene);this.scene.layout='placed';this.scene.motion=false;this.markers=environment.markers;this.select.replaceChildren(...this.markers.map(m=>new Option(`${m.label} · ${m.id}`,m.id)));this.dialog.showModal();this.draw();}
  point(event){const rect=this.canvas.getBoundingClientRect();return {x:(event.clientX-rect.left)*1280/rect.width,y:(event.clientY-rect.top)*720/rect.height};}
  change(q){if(validQuad(q)){this.scene.placements[this.select.value]=q;this.draw();}}
  scale(factor){const q=this.scene.placements[this.select.value],c=centre(q);this.change(q.map(p=>({x:c.x+(p.x-c.x)*factor,y:c.y+(p.y-c.y)*factor})));}
  draw(){this.demo.draw(this.ctx,0,this.scene,this.getBackground(this.scene.background),this.markers.map(m=>m.id));const q=this.scene.placements[this.select.value];if(!q)return;this.ctx.save();this.ctx.lineWidth=3;this.ctx.strokeStyle='#4df2d0';this.ctx.beginPath();q.forEach((p,i)=>i?this.ctx.lineTo(p.x,p.y):this.ctx.moveTo(p.x,p.y));this.ctx.closePath();this.ctx.stroke();for(const p of q){this.ctx.fillStyle='#fff';this.ctx.fillRect(p.x-7,p.y-7,14,14);this.ctx.strokeRect(p.x-7,p.y-7,14,14);}this.ctx.restore();}
  save(){this.onSave(this.envId,this.scene.placements);this.dialog.close();}
}
