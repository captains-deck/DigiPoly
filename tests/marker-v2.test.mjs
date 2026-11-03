import test from 'node:test';
import assert from 'node:assert/strict';
import cvModule from '../vendor/opencv.js';
import {PortalDetector,matchPortal,NORMALIZED_SIZE} from '../src/detector.mjs';
import {MARKERS,markerPixels,CODE_CELLS,CELL_SIZE} from '../src/marker-v2.mjs';
const cv=await cvModule,detector=new PortalDetector(cv),width=800,height=450;
const square=(x=160,y=120,s=170)=>[{x,y},{x:x+s,y},{x:x+s,y:y+s},{x,y:y+s}];
function changeCell(pixels,size,index,value){const [cx,cy]=CODE_CELLS[index];for(let y=0;y<size;y++)for(let x=0;x<size;x++){const px=(x+.5)*200/size,py=(y+.5)*200/size;if(px>=cx&&px<cx+CELL_SIZE&&py>=cy&&py<cy+CELL_SIZE)pixels[y*size+x]=value;}}
function scene(markers,{brightness=1,blur=0,occlude=false}={}){
  const gray=new cv.Mat(height,width,cv.CV_8UC1,new cv.Scalar(230)),rgba=new cv.Mat();
  for(const {id='DP-001',corners=square(),kind='portal'} of markers){
    const size=200,mono=markerPixels(size,id,{includeCode:kind!=='uncoded'});
    if(kind==='blank')mono.fill(0);
    if(kind==='noise')for(let i=0;i<mono.length;i++)mono[i]=((Math.floor(i/size/18)*7+Math.floor(i%size/18)*11)%5<2)?255:0;
    const src=cv.matFromArray(size,size,cv.CV_8UC1,mono),warped=new cv.Mat();
    const from=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,size-1,0,size-1,size-1,0,size-1]),to=cv.matFromArray(4,1,cv.CV_32FC2,corners.flatMap(p=>[p.x,p.y])),transform=cv.getPerspectiveTransform(from,to);
    cv.warpPerspective(src,warped,transform,new cv.Size(width,height),cv.INTER_LINEAR,cv.BORDER_CONSTANT,new cv.Scalar(255));cv.min(gray,warped,gray);
    [src,warped,from,to,transform].forEach(m=>m.delete());
  }
  if(occlude)cv.rectangle(gray,new cv.Point(190,110),new cv.Point(280,300),new cv.Scalar(190),-1);
  if(blur)cv.GaussianBlur(gray,gray,new cv.Size(blur,blur),0);
  if(brightness!==1)gray.convertTo(gray,-1,brightness);
  cv.cvtColor(gray,rgba,cv.COLOR_GRAY2RGBA);const data=new Uint8Array(rgba.data);gray.delete();rgba.delete();return data;
}
const detect=(markers,options)=>detector.detect(scene(markers,options),width,height);
test('legacy v2: both border identities survive all four rotations with correct orientation',()=>{
  for(const marker of MARKERS)for(let r=0;r<4;r++){
    const base=square(),corners=base.map((_,i)=>base[(i+r)%4]),results=detect([{id:marker.id,corners}]);
    assert.equal(results.length,1,`${marker.id} rotation ${r}`);const result=results[0];assert.equal(result.id,marker.id);assert.ok(result.confidence>.9);
    for(let i=0;i<4;i++)assert.ok(Math.hypot(result.corners[i].x-corners[i].x,result.corners[i].y-corners[i].y)<5);
  }
});
test('legacy v2: detects both markers in one frame under mixed perspective and lighting',()=>{
  const markers=[{id:'DP-001',corners:[{x:110,y:50},{x:280,y:90},{x:270,y:260},{x:130,y:235}]},{id:'DP-002',corners:square(490,160,170)}];
  for(const options of [{},{brightness:.4},{blur:3}])assert.deepEqual(detect(markers,options).map(m=>m.id),['DP-001','DP-002']);
});
test('legacy v2: border decoding rejects absent, mixed and damaged codes without guessing',()=>{
  assert.equal(matchPortal(markerPixels(NORMALIZED_SIZE,'DP-001',{includeCode:false})),null);
  const corrupt=markerPixels(NORMALIZED_SIZE,'DP-001');changeCell(corrupt,NORMALIZED_SIZE,0,0);changeCell(corrupt,NORMALIZED_SIZE,1,0);assert.equal(matchPortal(corrupt),null);
  const oneError=markerPixels(NORMALIZED_SIZE,'DP-001');changeCell(oneError,NORMALIZED_SIZE,0,0);assert.equal(matchPortal(oneError)?.id,'DP-001');
  const hybrid=markerPixels(NORMALIZED_SIZE,'DP-001');for(const i of [0,1,2,3,8,9])changeCell(hybrid,NORMALIZED_SIZE,i,MARKERS[1].bits[i]*255);assert.equal(matchPortal(hybrid),null);
});
test('legacy v2: rejects blank/coded distractors and partial coverage; keeps the unaffected marker',()=>{
  for(const kind of ['blank','noise','uncoded'])assert.deepEqual(detect([{kind}]),[]);
  assert.deepEqual(detect([]),[]);
  assert.deepEqual(detect([{id:'DP-001',corners:square()},{id:'DP-002',corners:square(500,130)}],{occlude:true}).map(d=>d.id),['DP-002']);
});
test('legacy v2: same ID on two different prints is suppressed instead of jumping between copies',()=>{
  assert.deepEqual(detect([{id:'DP-001',corners:square(60,90,140)},{id:'DP-001',corners:square(330,90,140)}]),[]);
});
