import {encode,decode,validateTarget} from './codec.mjs';
export function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
export const targetBlob=target=>new Blob([JSON.stringify(validateTarget(target),null,2)],{type:'application/json'});
export async function imageBlob(target){const raw=atob(validateTarget(target).image.split(',')[1]);return new Blob([Uint8Array.from(raw,c=>c.charCodeAt(0))],{type:'image/png'});}
export async function pixelsFromTarget(raw){
 const target=validateTarget(raw),blob=await imageBlob(target),bitmap=await createImageBitmap(blob);
 try{if(bitmap.width!==target.width||bitmap.height!==target.height)throw new Error('Reference dimensions do not match the target file.');const c=document.createElement('canvas');c.width=target.width;c.height=target.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);const rgba=ctx.getImageData(0,0,c.width,c.height).data;if(decode(rgba,c.width,c.height,target).id!==target.id)throw new Error('The reference does not contain the expected GhostMarker ID.');return {...target,rgba};}finally{bitmap.close();}
}
export async function importTarget(file){if(file.size>4*1024*1024)throw new Error('Target files must be smaller than 4 MB.');return pixelsFromTarget(JSON.parse(await file.text()));}
export async function createTarget(file,{strength=96,name=file.name||'Picture',mirror=false}={}){
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024)throw new Error('Choose a PNG, JPEG or WebP smaller than 10 MB.');
 const bitmap=await createImageBitmap(file);
 try{
  const ratio=bitmap.width/bitmap.height;if(ratio<.5||ratio>2||Math.min(bitmap.width,bitmap.height)<256)throw new Error('Choose an image at least 256 pixels on each side, with an aspect ratio between 1:2 and 2:1.');
  const width=Math.round((ratio>=1?512:512*ratio)/16)*16,height=Math.round((ratio<=1?512:512/ratio)/16)*16,c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);if(mirror){ctx.translate(width,0);ctx.scale(-1,1);}ctx.drawImage(bitmap,0,0,width,height);ctx.setTransform(1,0,0,1,0,0);
  const original=c.toDataURL('image/png'),result=encode(ctx.getImageData(0,0,width,height).data,width,height,{strength,textured:true});ctx.putImageData(new ImageData(result.rgba,width,height),0,0);
  const target={...result,name,image:c.toDataURL('image/png')};if(decode(result.rgba,width,height,target).id!==target.id)throw new Error('This picture did not encode reliably. Try a stronger setting or a different photograph.');
  return {...target,original};
 }finally{bitmap.close();}
}
export function checkFeatures(target){
 return new Promise((resolve,reject)=>{const worker=new Worker(new URL('./probe.js',import.meta.url)),timer=setTimeout(()=>finish(new Error('Image recognition did not start. Reload and try again.')),30000);function finish(error,value){clearTimeout(timer);worker.terminate();error?reject(error):resolve(value);}worker.onmessage=({data})=>finish(data.error?new Error(data.error):null,data);worker.onerror=e=>finish(new Error(e.message));worker.postMessage({target:{id:target.id,codec:target.codec,width:target.width,height:target.height,strength:target.strength,cells:target.cells,rgba:target.rgba}});});
}
