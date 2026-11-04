import test from 'node:test';
import assert from 'node:assert/strict';
import cvModule from '../vendor/opencv.js';
import {PortalDetector} from '../src/detector.mjs';
import {markerPixels} from '../src/marker.mjs';
import {markerPixels as v3Pixels} from '../src/marker-v3.mjs';
const cv=await cvModule,detector=new PortalDetector(cv),width=800,height=450;
const square=(x,y,s)=>[{x,y},{x:x+s,y},{x:x+s,y:y+s},{x,y:y+s}];
function scene(markers,{brightness=1,blur=0}={}){
  const gray=new cv.Mat(height,width,cv.CV_8UC1,new cv.Scalar(230)),rgba=new cv.Mat();
  for(const {id,corners,kind} of markers){
    const size=220,mono=kind==='v3'?v3Pixels(size,id):markerPixels(size,id);
    const src=cv.matFromArray(size,size,cv.CV_8UC1,mono),warped=new cv.Mat();
    const from=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,size-1,0,size-1,size-1,0,size-1]),to=cv.matFromArray(4,1,cv.CV_32FC2,corners.flatMap(p=>[p.x,p.y])),transform=cv.getPerspectiveTransform(from,to);
    cv.warpPerspective(src,warped,transform,new cv.Size(width,height),cv.INTER_LINEAR,cv.BORDER_CONSTANT,new cv.Scalar(255));cv.min(gray,warped,gray);
    [src,warped,from,to,transform].forEach(m=>m.delete());
  }
  if(blur)cv.GaussianBlur(gray,gray,new cv.Size(blur,blur),0);
  if(brightness!==1)gray.convertTo(gray,-1,brightness);
  cv.cvtColor(gray,rgba,cv.COLOR_GRAY2RGBA);const data=new Uint8Array(rgba.data);gray.delete();rgba.delete();return data;
}
const seen=(markers,options)=>detector.detect(scene(markers,options),width,height);
test('v4 stays at least as readable as v3 under rotation, scale, light and blur',()=>{
  let previous=0,current=0,trials=0;
  for(const s of [120,150,180,220])for(const r of [0,1,2,3])for(const brightness of [1,.55])for(const blur of [0,3])for(const id of ['DP-001','DP-002']){
    trials++;
    const base=square(70,36,s),corners=base.map((_,i)=>base[(i+r)%4]);
    if(r%2)corners[1]={x:corners[1].x+18,y:corners[1].y+12};
    if(seen([{id,kind:'v3',corners}],{brightness,blur}).some(d=>d.id===id&&d.version===3))previous++;
    if(seen([{id,corners}],{brightness,blur}).some(d=>d.id===id&&d.version===4))current++;
  }
  assert.ok(current>=previous,`Portal v4 resolved ${current}/${trials}; v3 resolved ${previous}/${trials}.`);
  assert.ok(current>=trials*.9,`Portal v4 should hold the shared stress set, resolved ${current}/${trials}.`);
});
test('both v4 identities survive together with legacy prints and reject a repeated ID',()=>{
  const both=seen([{id:'DP-001',corners:[{x:80,y:40},{x:250,y:70},{x:230,y:250},{x:70,y:220}]},{id:'DP-002',corners:square(460,150,180)}],{brightness:.7,blur:3});
  assert.deepEqual(both.map(d=>[d.id,d.version]),[['DP-001',4],['DP-002',4]]);
  const mixed=seen([{id:'DP-001',kind:'v3',corners:square(40,30,150)},{id:'DP-002',corners:square(430,180,170)}],{brightness:.5});
  assert.deepEqual(mixed.map(d=>[d.id,d.version]),[['DP-001',3],['DP-002',4]]);
  assert.deepEqual(seen([{id:'DP-001',kind:'v3',corners:square(30,40,150)},{id:'DP-001',corners:square(340,40,150)}]),[]);
});
