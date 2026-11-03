import {validateWorkspace, BUILTIN_MEDIA, LIMITS} from '../src/workspace.mjs';
export const HASH=/^[a-f0-9]{64}$/;
export const FILE_TYPES=new Set(['image/png','image/jpeg','image/webp','video/mp4','video/webm']);
export function fileIds(state){return [...new Set([...state.media.map(m=>m.id),...state.environments.map(e=>e.scene.background.assetId).filter(Boolean)])];}
export function validateSnapshot(raw){
  const state=validateWorkspace(raw?.workspace),files=raw?.files;
  if(!Number.isInteger(raw.baseRevision)||raw.baseRevision<0||!files||typeof files!=='object'||Array.isArray(files))throw new Error('Invalid cloud save.');
  if(state.environments.length>LIMITS.environments||state.media.length>LIMITS.media)throw new Error('Workspace limit exceeded.');
  const safeId=/^[a-zA-Z0-9_-]{1,100}$/;
  const mediaIds=new Set([...BUILTIN_MEDIA,...state.media].map(m=>m.id));
  for(const e of state.environments){
    if(!safeId.test(e.id)||e.channels.length>LIMITS.channels)throw new Error('Invalid environment.');
    for(const c of e.channels)if(!safeId.test(c.id)||Object.values(c.assignments).some(id=>!mediaIds.has(id)))throw new Error('Invalid channel assignment.');
  }
  const cleanFiles={};let size=0;
  for(const id of fileIds(state)){
    const f=files[id];if(!safeId.test(id)||!f||!HASH.test(f.hash)||!FILE_TYPES.has(f.type)||!Number.isInteger(f.size)||f.size<=0||f.size>(f.type.startsWith('video/')?100:10)*1024*1024)throw new Error('A required upload is invalid or missing.');
    if(state.environments.some(e=>e.scene.background.assetId===id)&&!f.type.startsWith('image/'))throw new Error('Backgrounds must be images.');
    cleanFiles[id]={hash:f.hash,type:f.type,size:f.size};size+=f.size;
  }
  if(size>512*1024*1024)throw new Error('This POC supports 512 MB per workspace.');
  // Uploaded metadata must never introduce remote URLs into the desktop renderer.
  state.media=state.media.map(m=>({id:m.id,name:String(m.name||'Upload').slice(0,100),kind:cleanFiles[m.id].type.startsWith('video/')?'video':'image',type:cleanFiles[m.id].type,size:cleanFiles[m.id].size}));
  return {workspace:state,files:cleanFiles,baseRevision:raw.baseRevision};
}
