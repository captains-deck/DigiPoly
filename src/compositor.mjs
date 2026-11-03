import {PlaneRenderer} from './renderer.mjs';
// All audience variants consume the exact same detected source frame and poses.
// Outputs are bound to environment + channel IDs, never the currently selected card.
export class ChannelCompositor {
  constructor(library){this.library=library;this.renderer=new PlaneRenderer();this.outputs=new Map();this.revisions=new Map();this.activeEnvironmentId=null;}
  key(envId,channelId){return `${envId}/${channelId}`;}
  ensure(envId,channelId){const key=this.key(envId,channelId);if(!this.outputs.has(key)){const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;this.outputs.set(key,{envId,channelId,canvas,ctx:canvas.getContext('2d'),stream:null});}return this.outputs.get(key);}
  activate(envId){if(this.activeEnvironmentId===envId)return;this.activeEnvironmentId=envId;for(const output of this.outputs.values()){output.ctx.fillStyle='#000';output.ctx.fillRect(0,0,1280,720);}}
  render(env,frame,tracks){
    this.activate(env.id);
    const ids=new Set(env.channels.flatMap(c=>env.markers.map(m=>c.assignments[m.id]).filter(Boolean)));
    for(const id of ids){const media=this.library.frame(id);if(media&&this.revisions.get(id)!==media.revision){this.renderer.setImage(media.raster,id);this.revisions.set(id,media.revision);}}
    for(const channel of env.channels){
      const output=this.ensure(env.id,channel.id);output.ctx.drawImage(frame,0,0,1280,720);
      for(const track of [...tracks].sort((a,b)=>b.area-a.area)){
        if(!env.markers.some(m=>m.id===track.id))continue;
        const mediaId=channel.assignments[track.id];
        if(mediaId&&this.library.get(mediaId)&&this.renderer.useTexture(mediaId))output.ctx.drawImage(this.renderer.draw(track.corners),0,0);
      }
    }
  }
  stream(envId,channelId){const output=this.ensure(envId,channelId);if(!output.stream)output.stream=output.canvas.captureStream(30);return output.stream;}
  prune(state){for(const [key,output] of this.outputs){const env=state.environments.find(e=>e.id===output.envId);if(!env?.channels.some(c=>c.id===output.channelId)){output.stream?.getTracks().forEach(t=>t.stop());this.outputs.delete(key);}}}
  removeMedia(id){this.renderer.removeTexture(id);this.revisions.delete(id);}
  close(){for(const output of this.outputs.values())output.stream?.getTracks().forEach(t=>t.stop());this.renderer.dispose();}
}
