import test from 'node:test';
import assert from 'node:assert/strict';
import * as W from '../src/workspace.mjs';
import {validateFile} from '../src/media.mjs';

test('UK and Spain resolve different products on the same marker IDs',()=>{
 const state=W.createWorkspace(),env=W.environment(state),[uk,es]=env.channels;
 assert.deepEqual(env.markers.map(m=>m.id),['DP-001','DP-002']);
 assert.deepEqual(uk.assignments,{'DP-001':'uk-runner','DP-002':'uk-coffee'});
 assert.deepEqual(es.assignments,{'DP-001':'es-sun','DP-002':'es-drink'});
 W.assignMedia(state,env.id,uk.id,'DP-001','on-air');
 assert.equal(es.assignments['DP-001'],'es-sun');assert.equal(uk.assignments['DP-002'],'uk-coffee');
});
test('environments and duplicate configurations are independent',()=>{
 const state=W.createWorkspace(),original=W.environment(state),other=state.environments[1],copy=W.duplicateEnvironment(state,original.id);
 assert.notEqual(copy.channels[0].id,original.channels[0].id);
 W.assignMedia(state,copy.id,copy.channels[0].id,'DP-001','next-wave');copy.markers[0].label='New name';
 assert.equal(original.channels[0].assignments['DP-001'],'uk-runner');assert.equal(original.markers[0].label,'Main placement');assert.equal(other.channels[0].assignments['DP-001'],'portal');
});
test('marker removal only clears assignments in its environment and re-add starts empty',()=>{
 const state=W.createWorkspace(),env=W.environment(state),other=state.environments[1];W.removeMarker(state,env.id,'DP-001');
 for(const channel of env.channels)assert.equal(channel.assignments['DP-001'],undefined);
 assert.equal(other.channels[0].assignments['DP-001'],'portal');
 W.addMarker(state,env.id,'DP-001','Poster');assert.equal(env.markers.find(m=>m.id==='DP-001').label,'Poster');assert.equal(env.channels[0].assignments['DP-001'],undefined);
 assert.throws(()=>W.addMarker(state,env.id,'DP-001','Duplicate'));
 assert.throws(()=>W.addMarker(state,env.id,'DP-999','Unsupported'));
});
test('removing shared uploaded media clears all references without changing other media',()=>{
 const state=W.createWorkspace();state.media.push({id:'custom-video',name:'My campaign',kind:'video'});
 for(const env of state.environments)for(const channel of env.channels)W.assignMedia(state,env.id,channel.id,'DP-001','custom-video');
 assert.equal(W.mediaUsage(state,'custom-video').length,6);W.removeMedia(state,'custom-video');
 assert.equal(W.mediaUsage(state,'custom-video').length,0);assert.equal(state.media.length,0);
 assert.equal(state.environments[0].channels[0].assignments['DP-002'],'uk-coffee');assert.throws(()=>W.removeMedia(state,'portal'));
});
test('channel and environment lifecycle retains a valid active workspace',()=>{
 const state=W.createWorkspace(),env=W.environment(state);const added=W.addChannel(state,env.id,{name:'Global',country:'Worldwide',language:'English'});assert.deepEqual(added.assignments,{});
 W.removeChannel(state,env.id,added.id);assert.equal(env.channels.length,2);
 W.removeEnvironment(state,state.environments[2].id);W.removeEnvironment(state,env.id);assert.ok(state.environments.some(e=>e.id===state.activeEnvironmentId));assert.throws(()=>W.removeEnvironment(state,state.activeEnvironmentId));
 const last=W.environment(state);W.removeChannel(state,last.id,last.channels[1].id);assert.throws(()=>W.removeChannel(state,last.id,last.channels[0].id));
});
test('saved workspace round-trips metadata, mappings and reusable media without sharing objects',()=>{
 const state=W.createWorkspace();state.media.push({id:'uploaded',name:'Local image',kind:'image',size:12});const env=W.environment(state);W.assignMedia(state,env.id,env.channels[1].id,'DP-001','uploaded');
 const restored=W.validateWorkspace(JSON.parse(JSON.stringify(state)));assert.deepEqual(restored,state);restored.environments[0].channels[0].name='Edited';assert.notEqual(restored.environments[0].channels[0].name,env.channels[0].name);
 assert.throws(()=>W.validateWorkspace({...state,version:99}));
});
test('unregistered assignments and unsupported or oversized uploads are rejected',()=>{
 const state=W.createWorkspace(),env=W.environment(state);assert.throws(()=>W.assignMedia(state,env.id,env.channels[0].id,'DP-001','unknown'));
 assert.throws(()=>W.assignMedia(state,env.id,env.channels[0].id,'DP-999','portal'));
 assert.equal(validateFile({type:'video/mp4',size:1000}),'video');assert.equal(validateFile({type:'image/png',size:1000}),'image');
 assert.throws(()=>validateFile({type:'text/html',size:10}));assert.throws(()=>validateFile({type:'video/webm',size:101*1024*1024}));assert.throws(()=>validateFile({type:'image/jpeg',size:11*1024*1024}));
});
