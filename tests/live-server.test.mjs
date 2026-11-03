import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {startServer} from '../live/server.mjs';
test('OBS bridge is loopback only, authenticates each channel and reconnects after environment changes',async()=>{
  const joined=[],answers=[];const server=await startServer({root:fileURLToPath(new URL('../',import.meta.url)),secret:'test-only-key',port:0,onPeer:p=>joined.push(p),onAnswer:p=>answers.push(p)});
  try{
    const outputs=server.setChannels([{id:'uk',name:'UK'},{id:'es',name:'Spain'}]);const uk=new URL(outputs[0].url).search,es=new URL(outputs[1].url).search;
    assert.equal((await fetch(server.origin+'/obs/join?channel=uk&key=no',{method:'POST'})).status,403);
    assert.equal((await fetch(server.origin+'/obs/join'+uk,{method:'POST',headers:{Origin:'https://evil.example'}})).status,403);
    assert.equal((await fetch(server.origin+'/live/main.mjs')).status,404);
    const peer=await fetch(server.origin+'/obs/join'+uk,{method:'POST'}).then(r=>r.json());assert.equal(joined[0].channel,'uk');
    assert.equal((await fetch(server.origin+'/obs/poll'+es+'&peer='+peer.peer)).status,404);
    server.offer(peer.peer,{type:'offer',sdp:'test'});assert.equal((await fetch(server.origin+'/obs/poll'+uk+'&peer='+peer.peer).then(r=>r.json())).offer.sdp,'test');
    await fetch(server.origin+'/obs/answer'+uk+'&peer='+peer.peer,{method:'POST',body:JSON.stringify({type:'answer',sdp:'response'})});assert.equal(answers[0].answer.sdp,'response');
    const again=server.setChannels([{id:'uk',name:'UK'}]);assert.equal(again[0].url,outputs[0].url);assert.equal((await fetch(server.origin+'/obs/poll'+uk+'&peer='+peer.peer)).status,404);
  }finally{await server.close();}
});
test('compatibility stream delivers only its audience and clears when the environment changes',async()=>{
  const demands=[];const server=await startServer({root:fileURLToPath(new URL('../',import.meta.url)),secret:'compatibility-test-key',port:0,onImageDemand:ids=>demands.push(ids)});
  const controller=new AbortController();
  try{
    const outputs=server.setChannels([{id:'uk',name:'UK'},{id:'es',name:'Spain'}]),query=new URL(outputs[0].url).search;
    const response=await fetch(server.origin+'/obs/images'+query,{signal:controller.signal});assert.match(response.headers.get('content-type'),/multipart\/x-mixed-replace/);assert.deepEqual(demands.at(-1),['uk']);
    server.frame('es',new Uint8Array([255,216,69,83,255,217]));server.frame('uk',new Uint8Array([255,216,85,75,255,217]));
    const reader=response.body.getReader(),chunk=Buffer.from((await reader.read()).value);assert.ok(chunk.includes(Buffer.from([255,216,85,75,255,217])));assert.ok(!chunk.includes(Buffer.from([255,216,69,83,255,217])));
    const health=await fetch(server.origin+'/obs/alive'+query).then(r=>r.json());assert.ok(health.lastFrame>0);
    server.setChannels([{id:'different',name:'Other environment'}]);assert.equal((await fetch(server.origin+'/obs/alive'+query)).status,503);await reader.cancel();
  }finally{controller.abort();await server.close();}
});
