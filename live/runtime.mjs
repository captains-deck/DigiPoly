import {DemoScene} from '../src/demo.mjs';
import {BackgroundLibrary} from '../src/backgrounds.mjs';
import {MediaLibrary} from '../src/media.mjs';
import {ChannelCompositor} from '../src/compositor.mjs';
import {AllTracks as MarkerTracks} from '../src/all-tracks.mjs';
import {GhostLibrary} from '../src/ghosts.mjs';
import {MARKERS} from '../src/marker.mjs';
import {allMedia,environment} from '../src/workspace.mjs';
import {sha256} from '../src/cloud.mjs';
export class LiveRuntime {
  constructor(snapshot,onFrame=()=>{},onError=()=>{}){this.snapshot=snapshot;this.env=environment(snapshot.workspace);this.library=new MediaLibrary();this.backgrounds=new BackgroundLibrary();this.tracks=new MarkerTracks();this.ghosts=new GhostLibrary();this.source=document.createElement('canvas');this.source.width=1280;this.source.height=720;this.ctx=this.source.getContext('2d');this.onFrame=onFrame;this.onError=onError;this.mode='demo';this.sequence=0;this.closed=false;this.pending=false;}
  async record(id){const f=this.snapshot.files[id];if(!f)throw new Error('An uploaded file is missing. Download the cloud copy again.');const response=await fetch(f.url);if(!response.ok)throw new Error('A cached file is unavailable. Download the cloud copy again.');const blob=await response.blob();if(blob.size!==f.size||await sha256(blob)!==f.hash)throw new Error('A cached file failed verification. Download the cloud copy again.');return {id,blob};}
  async init(){
    try{
      const needed=new Set(this.env.channels.flatMap(c=>Object.values(c.assignments)));
      for(const media of allMedia(this.snapshot.workspace).filter(m=>needed.has(m.id)))await this.library.load(media,media.url?undefined:await this.record(media.id));
      const bg=this.env.scene.background;await this.backgrounds.load(bg,bg.assetId?await this.record(bg.assetId):undefined);
      const images=await Promise.all(MARKERS.map(async marker=>{const im=new Image();im.src=`/assets/brand/${marker.slug}.svg`;await im.decode();return im;}));this.demo=new DemoScene(images);for(const marker of this.env.markers.filter(m=>m.kind==='ghost'))await this.ghosts.load(marker,await this.record(marker.referenceId));this.demo.setGhosts(this.env.markers.filter(m=>m.kind==='ghost').map(m=>this.ghosts.get(m)));this.compositor=new ChannelCompositor(this.library);
      this.worker=new Worker('/src/tracker-worker.js');
      await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Marker recognition did not start.')),30000);this.worker.onerror=e=>{clearTimeout(timer);reject(new Error(e.message));};this.worker.onmessage=({data})=>{if(data.type==='ready'){clearTimeout(timer);resolve();}else if(data.type==='error'){clearTimeout(timer);reject(new Error(data.message));}};});
      await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('GhostMarker setup timed out.')),30000);this.worker.onmessage=({data})=>{if(data.type==='ghost-configured'){clearTimeout(timer);data.error?reject(new Error(data.error)):resolve();}};this.worker.postMessage({type:'ghost-config',targets:this.ghosts.forEnvironment(this.env)});});
      this.worker.onmessage=({data})=>{
        if(data.type==='error'){this.pending=false;this.onError(new Error(data.message));return;}
        if(data.type!=='frame')return;this.pending=false;
        try{if(this.closed||data.sequence!==this.sequence)return;const locked=this.tracks.update(data.detections).filter(t=>t.locked);this.compositor.render(this.env,data.frame,locked);this.onFrame({frame:data.frame,tracks:locked,ms:data.ms});}catch(error){this.onError(error);}finally{data.frame.close();}
      };
      this.worker.onerror=e=>this.onError(new Error(e.message));
      await this.library.syncPlayback([...needed]);return this;
    }catch(error){this.close();throw error;}
  }
  input(mode,video=null){this.mode=mode;this.video=video;this.sequence++;this.tracks.reset();if(mode==='paused'){this.ctx.fillStyle='#000';this.ctx.fillRect(0,0,1280,720);for(const output of this.compositor?.outputs.values()||[]){output.ctx.fillStyle='#000';output.ctx.fillRect(0,0,1280,720);}}}
  start(){this.timer=setInterval(()=>this.tick(),34);this.tick();}
  async tick(){
    if(!this.closed&&this.compositor&&this.tracks.sweep()){this.compositor.render(this.env,this.source,[]);this.onFrame({frame:this.source,tracks:[],ms:0});}
    if(this.closed||this.pending||this.mode==='camera'&&this.video?.readyState<2)return;
    this.pending=true;const sequence=this.sequence;
    try{
      this.ctx.fillStyle='#000';this.ctx.fillRect(0,0,1280,720);
      if(this.mode==='demo')this.demo.draw(this.ctx,performance.now(),this.env.scene,this.backgrounds.get(this.env.scene.background),this.env.markers.map(m=>m.id));
      else if(this.mode==='camera'&&this.video){const scale=Math.min(1280/this.video.videoWidth,720/this.video.videoHeight),w=this.video.videoWidth*scale,h=this.video.videoHeight*scale;this.ctx.drawImage(this.video,(1280-w)/2,(720-h)/2,w,h);}
      const frame=await createImageBitmap(this.source);if(this.closed){frame.close();return;}this.worker.postMessage({type:'frame',frame,sequence},[frame]);
    }catch(error){this.pending=false;this.onError(error);}
  }
  stream(id){return this.compositor.stream(this.env.id,id);}
  close(){this.closed=true;clearInterval(this.timer);this.worker?.terminate();this.compositor?.close();this.library.close();this.backgrounds.close();this.demo?.close();}
}
