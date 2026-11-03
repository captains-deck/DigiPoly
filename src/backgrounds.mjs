import {drawCover} from './scenes.mjs';
export class BackgroundLibrary {
  constructor(){this.entries=new Map();}
  async load(background,record){
    if(background.type==='grid')return null;
    const id=background.assetId||background.type;if(this.entries.has(id))return this.entries.get(id).image;
    const url=background.type==='bedroom'?'/assets/backgrounds/bedroom-stream.png':record?.blob?URL.createObjectURL(record.blob):null;
    if(!url)throw new Error(`Background file unavailable: ${background.name}`);
    try{const image=new Image();image.src=url;await image.decode();this.entries.set(id,{image,url,owned:background.type!=='bedroom'});return image;}catch(error){if(background.type!=='bedroom')URL.revokeObjectURL(url);throw error;}
  }
  get(background){return this.entries.get(background.assetId||background.type)?.image;}
  async fromFile(file){
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024)throw new Error('Choose a PNG, JPEG or WebP background under 10 MB.');
    const url=URL.createObjectURL(file);
    try{const image=new Image();image.src=url;await image.decode();if(image.naturalWidth*image.naturalHeight>40000000)throw new Error('Use a background below 40 megapixels.');return await this.fromSource(image,'upload',file.name);}finally{URL.revokeObjectURL(url);}
  }
  async fromSource(source,type='capture',name='Camera background'){
    const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;drawCover(canvas.getContext('2d'),source);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.92));if(!blob)throw new Error('Background could not be saved.');
    const assetId=`background-${crypto.randomUUID()}`,background={type,name:name.slice(0,100),assetId},record={id:assetId,blob,kind:'background'};await this.load(background,record);return {background,record};
  }
  release(id){const entry=this.entries.get(id);if(entry?.owned)URL.revokeObjectURL(entry.url);this.entries.delete(id);}
  close(){for(const id of [...this.entries.keys()])this.release(id);}
}
