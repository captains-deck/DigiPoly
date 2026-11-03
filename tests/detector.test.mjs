import {readFileSync} from 'node:fs';
import {rgbaPng} from './png-fixture.mjs';
import {markerPixels as legacyPixels} from '../src/marker-v2.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import cvModule from '../vendor/opencv.js';
import {PortalDetector,matchPortal,NORMALIZED_SIZE} from '../src/detector.mjs';
import {MARKERS,markerPixels,CODE_CELLS,CELL_SIZE,MARKER_SIZE,markerSvg} from '../src/marker.mjs';
import {MarkerTracks,MarkerAssignments} from '../src/tracks.mjs';
import {homography,project} from '../src/geometry.mjs';
const reference=rgbaPng(readFileSync(new URL('./fixtures/portal-v3-reference.png',import.meta.url)));
const cv=await cvModule,detector=new PortalDetector(cv),width=800,height=450;
const square=(x=160,y=120,s=170)=>[{x,y},{x:x+s,y},{x:x+s,y:y+s},{x,y:y+s}];
function changeCell(pixels,size,index,value){const [cx,cy]=CODE_CELLS[index];for(let y=0;y<size;y++)for(let x=0;x<size;x++){const px=(x+.5)*MARKER_SIZE/size,py=(y+.5)*MARKER_SIZE/size;if(px>=cx&&px<cx+CELL_SIZE&&py>=cy&&py<cy+CELL_SIZE)pixels[y*size+x]=value;}}
function scene(markers,{brightness=1,blur=0,occlude=false}={}){
  const gray=new cv.Mat(height,width,cv.CV_8UC1,new cv.Scalar(230)),rgba=new cv.Mat();
  for(const {id='DP-001',corners=square(),kind='portal'} of markers){
    const size=kind==='reference'?reference.width:200,mono=kind==='reference'?Uint8Array.from({length:size*size},(_,i)=>reference.rgba[i*4]):kind==='legacy'?legacyPixels(size,id):markerPixels(size,id,{includeCode:kind!=='uncoded'});
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
test('both border identities survive all four rotations with correct orientation',()=>{
  for(const marker of MARKERS)for(let r=0;r<4;r++){
    const base=square(),corners=base.map((_,i)=>base[(i+r)%4]),results=detect([{id:marker.id,corners}]);
    assert.equal(results.length,1,`${marker.id} rotation ${r}`);const result=results[0];assert.equal(result.id,marker.id);assert.ok(result.confidence>.9);
    for(let i=0;i<4;i++)assert.ok(Math.hypot(result.corners[i].x-corners[i].x,result.corners[i].y-corners[i].y)<5);
  }
});
test('detects both markers in one frame under mixed perspective and lighting',()=>{
  const markers=[{id:'DP-001',corners:[{x:110,y:50},{x:280,y:90},{x:270,y:260},{x:130,y:235}]},{id:'DP-002',corners:square(490,160,170)}];
  for(const options of [{},{brightness:.4},{blur:3}])assert.deepEqual(detect(markers,options).map(m=>m.id),['DP-001','DP-002']);
});
test('border decoding rejects absent, mixed and damaged codes without guessing',()=>{
  assert.equal(matchPortal(markerPixels(NORMALIZED_SIZE,'DP-001',{includeCode:false})),null);
  const corrupt=markerPixels(NORMALIZED_SIZE,'DP-001');changeCell(corrupt,NORMALIZED_SIZE,0,0);changeCell(corrupt,NORMALIZED_SIZE,2,0);assert.equal(matchPortal(corrupt),null);
  const oneError=markerPixels(NORMALIZED_SIZE,'DP-001');changeCell(oneError,NORMALIZED_SIZE,0,0);assert.equal(matchPortal(oneError)?.id,'DP-001');
  const hybrid=markerPixels(NORMALIZED_SIZE,'DP-001');for(const i of [0,1,2,3])changeCell(hybrid,NORMALIZED_SIZE,i,MARKERS[1].bits[i]*255);assert.equal(matchPortal(hybrid),null);
});
test('rejects blank/coded distractors and partial coverage; keeps the unaffected marker',()=>{
  for(const kind of ['blank','noise','uncoded'])assert.deepEqual(detect([{kind}]),[]);
  assert.deepEqual(detect([]),[]);
  assert.deepEqual(detect([{id:'DP-001',corners:square()},{id:'DP-002',corners:square(500,130)}],{occlude:true}).map(d=>d.id),['DP-002']);
});
test('same ID on two different prints is suppressed instead of jumping between copies',()=>{
  assert.deepEqual(detect([{id:'DP-001',corners:square(60,90,140)},{id:'DP-001',corners:square(330,90,140)}]),[]);
});
test('identity and assigned content survive crossing trajectories, reordered detections and re-entry',()=>{
  const tracks=new MarkerTracks(),assignments=new MarkerAssignments();assignments.set('DP-001','custom-one');assignments.set('DP-002','custom-two');
  for(let i=0;i<=8;i++){
    const first=square(70+i*60,40,125),second=square(550-i*60,275,125);
    const detections=detect([{id:'DP-001',corners:first},{id:'DP-002',corners:second}]);assert.equal(detections.length,2);
    const result=tracks.update(i%2?detections.reverse():detections);
    for(const [id,expected,key] of [['DP-001',first,'custom-one'],['DP-002',second,'custom-two']]){
      const track=result.find(d=>d.id===id);assert.equal(assignments.get(track.id),key);assert.ok(Math.abs(track.corners[0].x-expected[0].x)<5);assert.equal(track.locked,i>0);
    }
  }
  const visible=detect([{id:'DP-002',corners:square(90,260,125)}]);assert.deepEqual(tracks.update(visible).map(t=>t.id),['DP-002']);
  const returned=detect([{id:'DP-001',corners:square(400,40,125)},{id:'DP-002',corners:square(90,260,125)}]);
  assert.equal(tracks.update(returned).find(t=>t.id==='DP-001').locked,false);assert.equal(tracks.update(returned).find(t=>t.id==='DP-001').locked,true);assert.equal(assignments.get('DP-001'),'custom-one');
});
test('content changes affect only their marker and locks clear on source reset',()=>{
  const assignments=new MarkerAssignments();assignments.set('DP-002','next-wave');assert.equal(assignments.get('DP-001'),'portal');assert.equal(assignments.get('DP-002'),'next-wave');
  const tracks=new MarkerTracks(),data=detect([{id:'DP-001'}]);tracks.update(data);assert.equal(tracks.update(data)[0].locked,true);tracks.reset();assert.equal(tracks.update(data)[0].locked,false);
});
test('homography maps artwork corners exactly to the target quadrilateral',()=>{
  const corners=[{x:175,y:40},{x:420,y:110},{x:375,y:310},{x:210,y:260}],h=homography(corners);
  [[0,0],[1,0],[1,1],[0,1]].forEach(([x,y],i)=>{const p=project(h,x,y);assert.ok(Math.hypot(p.x-corners[i].x,p.y-corners[i].y)<1e-7);});
});

test('the supplied artwork itself decodes as DP-001 through rotations, perspective and lighting',()=>{
 for(let r=0;r<4;r++){const q=[{x:125,y:45},{x:345,y:75},{x:330,y:300},{x:110,y:255}],corners=q.map((_,i)=>q[(i+r)%4]);const out=detect([{kind:'reference',corners}],{brightness:.55,blur:3});assert.equal(out.length,1);assert.equal(out[0].id,'DP-001');assert.equal(out[0].version,3);for(let i=0;i<4;i++)assert.ok(Math.hypot(out[0].corners[i].x-corners[i].x,out[0].corners[i].y-corners[i].y)<5);}
});
test('vector reconstruction preserves the supplied design at its native resolution',()=>{
 const pixels=markerPixels(800),different=pixels.reduce((count,value,i)=>count+((value>127)!==(reference.rgba[i*4]>127)),0);assert.ok(1-different/pixels.length>.999,'More than 99.9% of black/white pixels should match the supplied design.');
});
test('new and legacy prints coexist, while duplicate IDs across versions are suppressed',()=>{
 const out=detect([{id:'DP-001',kind:'legacy',corners:square(60,90,170)},{id:'DP-002',corners:square(460,130,170)}]);assert.deepEqual(out.map(d=>[d.id,d.version]),[['DP-001',2],['DP-002',3]]);
 assert.deepEqual(detect([{id:'DP-001',kind:'legacy',corners:square(60,90,140)},{id:'DP-001',corners:square(330,90,140)}]),[]);
});

test('published logo and print SVGs match the recognition geometry',()=>{
 for(const marker of MARKERS)for(const quiet of [0,100]){const file=`../assets/brand/${marker.slug}${quiet?'-print':''}.svg`;assert.equal(readFileSync(new URL(file,import.meta.url),'utf8'),markerSvg({id:marker.id,quiet}));}
 assert.equal(readFileSync(new URL('../assets/brand/portal-marker.svg',import.meta.url),'utf8'),markerSvg());
 assert.deepEqual(readFileSync(new URL('../assets/brand/portal-logo.png',import.meta.url)),readFileSync(new URL('./fixtures/portal-v3-reference.png',import.meta.url)));
});
