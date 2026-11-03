import {MARKERS} from './marker.mjs';
import {defaultScene,bedroomScene,normalizeScene} from './scenes.mjs';
export const BUILTIN_MEDIA = [
  {id:'uk-runner',name:'North • Trail runner',kind:'image',audience:'UK · English',url:'/assets/artwork/uk-runner.svg'},
  {id:'uk-coffee',name:'Daybreak • Cold brew',kind:'image',audience:'UK · English',url:'/assets/artwork/uk-coffee.svg'},
  {id:'es-sun',name:'Sol • Gafas de sol',kind:'image',audience:'Spain · Spanish',url:'/assets/artwork/es-sun.svg'},
  {id:'es-drink',name:'Brisa • Agua con gas',kind:'image',audience:'Spain · Spanish',url:'/assets/artwork/es-drink.svg'},
  {id:'portal',name:'One marker. Many stories.',kind:'image',audience:'DigiPoly original',url:'/assets/artwork/portal.svg'},
  {id:'on-air',name:'On air',kind:'image',audience:'Creator identity',url:'/assets/artwork/on-air.svg'},
  {id:'next-wave',name:'The next wave',kind:'image',audience:'A change of scene',url:'/assets/artwork/next-wave.svg'},
];
export const LIMITS={environments:12,channels:4,media:50};
const id=prefix=>`${prefix}-${crypto.randomUUID()}`;
const text=(value,fallback='')=>String(value??'').trim().slice(0,80)||fallback;
export function makeChannel({name='New channel',country='',language=''}={}){return {id:id('channel'),name:text(name,'New channel'),country:text(country),language:text(language),assignments:{}};}
export function makeEnvironment({name='New environment',description=''}={}){
  return {id:id('env'),name:text(name,'New environment'),description:text(description),scene:defaultScene(),markers:MARKERS.map((m,i)=>({id:m.id,label:i?'Product placement':'Main placement'})),channels:[makeChannel({name:'UK / English',country:'United Kingdom',language:'English'}),makeChannel({name:'Spain / Spanish',country:'Spain',language:'Spanish'})]};
}
export function createWorkspace(){
  const desk=makeEnvironment({name:'Creator studio',description:'One scene. Two audiences. Different stories.'});
  Object.assign(desk.channels[0].assignments,{'DP-001':'uk-runner','DP-002':'uk-coffee'});
  Object.assign(desk.channels[1].assignments,{'DP-001':'es-sun','DP-002':'es-drink'});
  const showcase=makeEnvironment({name:'Product showcase',description:'A second setup, ready for your own campaigns.'});
  showcase.markers[0].label='Hero product';showcase.markers[1].label='Sponsor card';
  for(const channel of showcase.channels)Object.assign(channel.assignments,{'DP-001':'portal','DP-002':'on-air'});
  const state={version:2,activeEnvironmentId:desk.id,environments:[desk,showcase],media:[],examples:[]};ensureBedroomExample(state);return state;
}
export function ensureBedroomExample(state){
  state.examples ||= [];
  if(state.examples.includes('bedroom-v1'))return null;
  const existing=state.environments.find(e=>e.template==='bedroom-v1');
  if(existing){state.examples.push('bedroom-v1');return null;}
  if(state.environments.length>=LIMITS.environments)return null;
  const room=makeEnvironment({name:'Bedroom stream',description:'A wall poster and a desk-box sticker. One room, two audience editions.'});
  room.template='bedroom-v1';room.scene=bedroomScene();room.markers[0].label='Wall poster';room.markers[1].label='Desk-box sticker';
  Object.assign(room.channels[0].assignments,{'DP-001':'uk-runner','DP-002':'uk-coffee'});
  Object.assign(room.channels[1].assignments,{'DP-001':'es-sun','DP-002':'es-drink'});
  state.environments.push(room);state.examples.push('bedroom-v1');return room;
}
export function environment(state,envId=state.activeEnvironmentId){const env=state.environments.find(e=>e.id===envId);if(!env)throw new Error('Environment not found.');return env;}
export function channelFor(state,envId,channelId){const channel=environment(state,envId).channels.find(c=>c.id===channelId);if(!channel)throw new Error('Channel not found.');return channel;}
export function allMedia(state){return [...BUILTIN_MEDIA,...state.media];}
export function addEnvironment(state,fields){if(state.environments.length>=LIMITS.environments)throw new Error('This POC supports up to 12 environments.');const env=makeEnvironment(fields);state.environments.push(env);state.activeEnvironmentId=env.id;return env;}
export function duplicateEnvironment(state,envId){const source=environment(state,envId);const copy=addEnvironment(state,{name:`${source.name} copy`,description:source.description});copy.scene=structuredClone(source.scene);copy.markers=structuredClone(source.markers);copy.channels=source.channels.map(c=>({...structuredClone(c),id:id('channel')}));return copy;}
export function removeEnvironment(state,envId){environment(state,envId);if(state.environments.length===1)throw new Error('Keep at least one environment.');state.environments=state.environments.filter(e=>e.id!==envId);if(state.activeEnvironmentId===envId)state.activeEnvironmentId=state.environments[0].id;}
export function addChannel(state,envId,fields){const env=environment(state,envId);if(env.channels.length>=LIMITS.channels)throw new Error('This POC supports up to four simultaneous channels per environment.');const channel=makeChannel(fields);env.channels.push(channel);return channel;}
export function removeChannel(state,envId,channelId){const env=environment(state,envId);channelFor(state,envId,channelId);if(env.channels.length===1)throw new Error('Keep at least one campaign channel.');env.channels=env.channels.filter(c=>c.id!==channelId);}
export function updateDetails(target,fields){for(const key of ['name','description','country','language'])if(key in fields)target[key]=text(fields[key],key==='name'?target.name:'');}
export function addMarker(state,envId,markerId,label){const env=environment(state,envId);if(!MARKERS.some(m=>m.id===markerId)||env.markers.some(m=>m.id===markerId))throw new Error('Choose an available coded marker.');env.markers.push({id:markerId,label:text(label,markerId)});}
export function removeMarker(state,envId,markerId){const env=environment(state,envId);env.markers=env.markers.filter(m=>m.id!==markerId);for(const c of env.channels)delete c.assignments[markerId];}
export function assignMedia(state,envId,channelId,markerId,mediaId){const env=environment(state,envId),channel=channelFor(state,envId,channelId);if(!env.markers.some(m=>m.id===markerId))throw new Error('Marker is not in this environment.');if(mediaId&&!allMedia(state).some(m=>m.id===mediaId))throw new Error('Media is not in the library.');if(mediaId)channel.assignments[markerId]=mediaId;else delete channel.assignments[markerId];}
export function mediaUsage(state,mediaId){return state.environments.flatMap(e=>e.channels.flatMap(c=>Object.entries(c.assignments).filter(([,value])=>value===mediaId).map(([markerId])=>({environment:e.name,channel:c.name,markerId}))));}
export function removeMedia(state,mediaId){if(BUILTIN_MEDIA.some(m=>m.id===mediaId))throw new Error('Studio samples cannot be removed.');state.media=state.media.filter(m=>m.id!==mediaId);for(const e of state.environments)for(const c of e.channels)for(const key of Object.keys(c.assignments))if(c.assignments[key]===mediaId)delete c.assignments[key];}
export function validateWorkspace(raw){
  if(!raw||![1,2].includes(raw.version)||!Array.isArray(raw.environments)||!raw.environments.length||!Array.isArray(raw.media))throw new Error('Saved workspace could not be read. Your saved data has not been replaced.');
  const state=structuredClone(raw),ids=new Set();state.version=2;state.examples=Array.isArray(state.examples)?state.examples:[];
  for(const env of state.environments){
    if(typeof env.id!=='string'||ids.has(env.id)||!Array.isArray(env.markers)||!Array.isArray(env.channels)||!env.channels.length)throw new Error('Saved environment is invalid.');ids.add(env.id);
    env.name=text(env.name,'Environment');env.description=text(env.description);env.scene=normalizeScene(env.scene);
    const markers=new Set();for(const marker of env.markers){if(!MARKERS.some(m=>m.id===marker.id)||markers.has(marker.id))throw new Error('Saved marker is invalid.');markers.add(marker.id);marker.label=text(marker.label,marker.id);}
    for(const c of env.channels){if(typeof c.id!=='string'||ids.has(c.id)||!c.assignments||typeof c.assignments!=='object'||Array.isArray(c.assignments))throw new Error('Saved channel is invalid.');ids.add(c.id);updateDetails(c,{name:c.name,country:c.country,language:c.language});for(const key of Object.keys(c.assignments))if(!markers.has(key))delete c.assignments[key];}
  }
  for(const media of state.media)if(typeof media.id!=='string'||!['image','video'].includes(media.kind)||ids.has(media.id)||BUILTIN_MEDIA.some(m=>m.id===media.id))throw new Error('Saved media is invalid.');else ids.add(media.id);
  if(!state.environments.some(e=>e.id===state.activeEnvironmentId))state.activeEnvironmentId=state.environments[0].id;
  return state;
}
