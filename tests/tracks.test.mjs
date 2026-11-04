import test from 'node:test';
import assert from 'node:assert/strict';
import {MarkerTracks} from '../src/tracks.mjs';
import {AllTracks} from '../src/all-tracks.mjs';
import {TRACKING,placementLabel} from '../src/tracking-policy.mjs';

const square=(x,y,s=160)=>[{x,y},{x:x+s,y},{x:x+s,y:y+s},{x,y:y+s}];
const strong=(id,corners,confidence=.98)=>({id,corners,confidence,quality:'strong',area:160*160});
const at=(tracks,id)=>tracks.snapshot().find(t=>t.id===id);
function lock(tracks,id='DP-001',origin=square(80,60),t=0,step=40){
  for(let i=0;i<5;i++) tracks.update([strong(id,origin.map(p=>({x:p.x+(i?1:0),y:p.y})))],t+i*step);
  return t+4*step;
}
function oldStep(states,detections){
  const next=new Map();
  for(const id of ['DP-001','DP-002']){
    const matches=detections.filter(d=>d.id===id&&d.corners&&d.quality!=='weak'&&d.quality!=='geometry'&&!d.ambiguous);
    if(matches.length!==1) continue;
    const count=(states.get(id)?.count||0)+1;
    next.set(id,{count,locked:count>=2});
  }
  return next;
}

test('a confirmed stationary marker coasts through a brief miss and then drops',()=>{
  const tracks=new MarkerTracks(),seen=lock(tracks);
  assert.equal(at(tracks,'DP-001').motion,'stationary');
  const held=tracks.update([],seen+250);
  assert.equal(held.find(t=>t.id==='DP-001').phase,'holding');
  assert.equal(held.find(t=>t.id==='DP-001').locked,true);
  assert.equal(placementLabel(held.find(t=>t.id==='DP-001')),'Brief hold');
  assert.equal(tracks.update([],seen+TRACKING.stationaryHoldMs+25).some(t=>t.id==='DP-001'),false);
  assert.equal(placementLabel(undefined),'Out of view');
});

test('moving targets and camera motion use the shorter hold',()=>{
  const tracks=new MarkerTracks();
  let now=0;
  for(let i=0;i<6;i++){tracks.update([strong('DP-001',square(40+i*18,70), .99)],now);now+=33;}
  assert.equal(at(tracks,'DP-001').motion,'moving');
  assert.equal(tracks.update([],now+90).find(t=>t.id==='DP-001').locked,true);
  assert.equal(tracks.update([],now+TRACKING.movingHoldMs+20).some(t=>t.id==='DP-001'),false);
  const camera=new MarkerTracks();
  now=0;
  for(let i=0;i<6;i++){camera.update([strong('DP-001',square(100+i*14,80)),strong('DP-002',square(420+i*14,80))],now);now+=33;}
  assert.equal(at(camera,'DP-001').motion,'moving');
  assert.equal(at(camera,'DP-002').motion,'moving');
  camera.update([],now+TRACKING.movingHoldMs+20);
  assert.equal(camera.snapshot().length,0);
});

test('weak reads cannot acquire, and cannot refresh identity after a lock',()=>{
  const early=new MarkerTracks(),home=square(90,70,180);
  for(let i=0;i<5;i++) early.update([{id:'DP-001',corners:home,confidence:.84,quality:'weak'}],i*40);
  assert.equal(early.snapshot().length,0);
  const tracks=new MarkerTracks(),seen=lock(tracks,'DP-001',home);
  const moved=home.map(p=>({x:p.x+10,y:p.y+4}));
  let followed;
  for(let t=seen+100;t<=seen+1100;t+=100) followed=tracks.update([{id:'DP-001',corners:moved,confidence:.83,quality:'weak'}],t);
  const held=followed.find(t=>t.id==='DP-001');
  assert.equal(held.phase,'holding');
  assert.equal(held.verifiedAt,seen);
  assert.ok(held.corners[0].x>home[0].x);
  assert.equal(tracks.update([{id:'DP-001',corners:moved,confidence:.83,quality:'weak'}],seen+TRACKING.identityWindowMs+30).some(t=>t.id==='DP-001'),false);
});

test('readable geometry keeps a lock only until the identity window',()=>{
  const tracks=new MarkerTracks(),home=square(70,50,170),seen=lock(tracks,'DP-002',home);
  const shifted=home.map(p=>({x:p.x+12,y:p.y+6}));
  let followed;
  for(let t=seen+200;t<=seen+1000;t+=200) followed=tracks.update([{corners:shifted,confidence:.86,quality:'geometry',area:170*170}],t);
  assert.equal(followed.find(t=>t.id==='DP-002').phase,'holding');
  assert.equal(followed.find(t=>t.id==='DP-002').verifiedAt,seen);
  assert.equal(tracks.update([{corners:shifted,confidence:.86,quality:'geometry'}],seen+TRACKING.identityWindowMs+10).some(t=>t.id==='DP-002'),false);
});

test('duplicates, conflicts, jumps and bad geometry do not leave the old overlay in place',()=>{
  const tracks=new MarkerTracks(),home=square(60,40,150),seen=lock(tracks,'DP-001',home);
  assert.equal(tracks.update([{id:'DP-001',ambiguous:true}],seen+20).some(t=>t.id==='DP-001'),false);
  const again=lock(tracks,'DP-001',home,seen+100);
  const conflict=tracks.update([strong('DP-002',home)],again+30);
  assert.equal(conflict.some(t=>t.id==='DP-001'),false);
  assert.equal(conflict.find(t=>t.id==='DP-002').locked,false);
  assert.equal(placementLabel(conflict.find(t=>t.id==='DP-002')),'Reacquiring');
  const jumped=new MarkerTracks(),start=lock(jumped);
  const far=jumped.update([strong('DP-001',square(820,60))],start+33);
  assert.equal(far.find(t=>t.id==='DP-001').locked,false);
  assert.ok(far.find(t=>t.id==='DP-001').corners[0].x>700);
  const coasted=new MarkerTracks(),ready=lock(coasted);
  const homeAgain=coasted.snapshot().find(t=>t.id==='DP-001').corners.map(p=>({...p}));
  const stayed=coasted.update([{id:'DP-001',corners:square(700,400,150),confidence:.8,quality:'weak'}],ready+30);
  assert.equal(stayed.find(t=>t.id==='DP-001').phase,'holding');
  assert.ok(Math.abs(stayed.find(t=>t.id==='DP-001').corners[0].x-homeAgain[0].x)<5);
  const broken=coasted;
  const coast=broken.update([{id:'DP-001',quality:'strong',corners:[{x:Number.NaN,y:1},{x:2,y:1},{x:2,y:2},{x:1,y:2}]}],ready+40);
  assert.equal(coast.find(t=>t.id==='DP-001').phase,'holding');
  assert.ok(coast.find(t=>t.id==='DP-001').corners.every(p=>Number.isFinite(p.x)));
});

test('crossings keep each identity and a source reset requires a new lock',()=>{
  const tracks=new MarkerTracks();
  let now=0;
  for(let i=0;i<8;i++){
    const result=tracks.update([strong('DP-001',square(40+i*50,40,110)),strong('DP-002',square(520-i*50,240,110))],now);
    now+=33;
    assert.equal(result.find(t=>t.id==='DP-001').locked,i>0);
    assert.ok(Math.abs(result.find(t=>t.id==='DP-001').corners[0].x-(40+i*50))<8);
    assert.ok(Math.abs(result.find(t=>t.id==='DP-002').corners[0].x-(520-i*50))<8);
  }
  tracks.reset();
  assert.equal(tracks.update([strong('DP-001',square(200,80))],now)[0].locked,false);
});

test('one marker can expire while its neighbour is still healthy',()=>{
  const tracks=new MarkerTracks();
  let now=0;
  for(let i=0;i<5;i++){tracks.update([strong('DP-001',square(30,40)),strong('DP-002',square(40+i*20,300,120))],now);now+=40;}
  assert.equal(at(tracks,'DP-001').motion,'stationary');
  assert.equal(at(tracks,'DP-002').motion,'moving');
  const next=tracks.update([strong('DP-001',square(31,40))],now+TRACKING.movingHoldMs+30);
  assert.equal(next.find(t=>t.id==='DP-001').phase,'tracking');
  assert.equal(next.some(t=>t.id==='DP-002'),false);
});

test('stalls expire coded tracks even when no detection arrives',()=>{
  const tracks=new AllTracks(),coded=strong('DP-001',square(20,20));
  tracks.update([coded],0);tracks.update([coded],50);
  assert.equal(tracks.sweep(50+TRACKING.movingHoldMs-5),false);
  assert.equal(tracks.sweep(50+TRACKING.movingHoldMs+5),true);
  assert.equal(tracks.snapshot().length,0);
  const settled=new MarkerTracks();
  const seen=lock(settled,'DP-001',square(20,20),0,50);
  assert.equal(settled.expire(seen+200),false);
  assert.equal(settled.expire(seen+TRACKING.stationaryHoldMs+5),true);
});

test('removing one placement does not drop the other lock',()=>{
  const tracks=new AllTracks();
  let now=0;
  for(let i=0;i<4;i++){tracks.update([strong('DP-001',square(20,30)),strong('DP-002',square(400,30))],now);now+=40;}
  tracks.forget('DP-002');
  assert.equal(at(tracks.portal,'DP-001').locked,true);
  assert.equal(tracks.portal.states.has('DP-002'),false);
});

test('brief gaps drop fewer overlays than immediate removal, and a departure cannot coast forever',()=>{
  const gap=6,step=33,present=square(100,80);
  let old=new Map(),neu=new MarkerTracks(),oldMiss=0,newMiss=0;
  for(let i=0;i<14;i++){
    const detections=i>=5&&i<5+gap?[]:[strong('DP-001',present)];
    old=oldStep(old,detections);
    const locked=neu.update(detections,i*step).some(t=>t.id==='DP-001'&&t.locked);
    if(i>1&&!old.get('DP-001')?.locked) oldMiss++;
    if(i>1&&!locked) newMiss++;
  }
  assert.ok(oldMiss>=gap);
  assert.equal(newMiss,0);
  let stale=0;
  const moving=new MarkerTracks();
  let now=0;
  for(let i=0;i<6;i++){moving.update([strong('DP-001',square(30+i*16,90))],now);now+=step;}
  for(let i=1;i<=12;i++) if(moving.update([],now+i*step).some(t=>t.locked)) stale++;
  assert.ok(stale>=1&&stale<=5);
  const recovered=new MarkerTracks();
  assert.equal(recovered.update([strong('DP-001',present)],0).some(t=>t.locked),false);
  assert.equal(recovered.update([strong('DP-001',present)],TRACKING.stationaryHoldMs+100).some(t=>t.locked),true);
  recovered.reset();
  assert.equal(recovered.update([strong('DP-001',present)],0).some(t=>t.locked),false);
});
