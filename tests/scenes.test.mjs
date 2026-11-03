import test from 'node:test';
import assert from 'node:assert/strict';
import * as W from '../src/workspace.mjs';
import {defaultScene,bedroomScene,replaceBackground,validQuad,backgroundReferences} from '../src/scenes.mjs';
import {CameraCapture} from '../src/camera-capture.mjs';

test('existing v3 workspace upgrades without losing environments, media or assignments',()=>{
 const old=W.createWorkspace();old.version=1;old.environments=old.environments.filter(e=>!e.template);delete old.examples;for(const env of old.environments)delete env.scene;
 const ids=old.environments.map(e=>e.id),assignments=structuredClone(old.environments[0].channels[0].assignments);
 const state=W.validateWorkspace(old),example=W.ensureBedroomExample(state);
 assert.deepEqual(state.environments.slice(0,2).map(e=>e.id),ids);assert.deepEqual(state.environments[0].channels[0].assignments,assignments);assert.equal(state.version,2);assert.equal(state.environments[0].scene.layout,'moving');
 assert.equal(example.name,'Bedroom stream');assert.equal(example.markers[0].label,'Wall poster');assert.equal(example.markers[1].label,'Desk-box sticker');
 assert.equal(W.ensureBedroomExample(state),null);W.removeEnvironment(state,example.id);assert.equal(W.ensureBedroomExample(state),null,'removed example is not recreated on reload');
});
test('backgrounds and layouts belong to each environment and duplicates share only saved file identity',()=>{
 const state=W.createWorkspace(),original=W.environment(state);original.scene=replaceBackground(defaultScene(),{type:'upload',assetId:'background-user',name:'My room'});
 const copy=W.duplicateEnvironment(state,original.id);copy.scene.placements['DP-001'][0].x+=10;copy.scene.background.name='Copy room';
 assert.notEqual(copy.scene.placements['DP-001'][0].x,original.scene.placements['DP-001'][0].x);assert.equal(original.scene.background.name,'My room');assert.equal(backgroundReferences(state,'background-user'),2);
 W.removeEnvironment(state,copy.id);assert.equal(backgroundReferences(state,'background-user'),1);
 const restored=W.validateWorkspace(JSON.parse(JSON.stringify(state)));assert.deepEqual(restored.environments[0].scene,original.scene);
});
test('bedroom layout is readable and perspective edits reject inverted or tiny quads',()=>{
 const scene=bedroomScene();for(const q of Object.values(scene.placements))assert.equal(validQuad(q),true);
 const q=scene.placements['DP-001'];assert.equal(validQuad([q[0],q[2],q[1],q[3]]),false);assert.equal(validQuad([{x:0,y:0},{x:20,y:0},{x:20,y:20},{x:0,y:20}]),false);
});
function fakeCamera(){let stops=0;return {get stops(){return stops;},getTracks:()=>[{stop:()=>stops++}]};}
const fakeVideo=()=>({srcObject:null,play:async()=>{}});
test('camera capture closes an owned stream but never closes a borrowed live camera',async()=>{
 const owned=fakeCamera(),shared=fakeCamera(),video=fakeVideo(),capture=new CameraCapture(video,async()=>owned);
 assert.equal(await capture.start(),true);capture.stop();assert.equal(owned.stops,1);assert.equal(video.srcObject,null);
 assert.equal(await capture.start(shared),true);capture.stop();assert.equal(shared.stops,0);
});
test('closing camera capture while permission is pending stops the late stream',async()=>{
 let deliver;const stream=fakeCamera(),video=fakeVideo(),capture=new CameraCapture(video,()=>new Promise(resolve=>deliver=resolve));const starting=capture.start();capture.stop();deliver(stream);
 assert.equal(await starting,false);assert.equal(stream.stops,1);assert.equal(video.srcObject,null);
});
test('camera errors release owned tracks and leave the dialog retryable',async()=>{
 const stream=fakeCamera(),video={srcObject:null,play:async()=>{throw new Error('video failed');}},capture=new CameraCapture(video,async()=>stream);
 await assert.rejects(capture.start(),/video failed/);assert.equal(stream.stops,1);assert.equal(video.srcObject,null);
});
