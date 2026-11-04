// Small icon slots use the optically adjusted favicon. Larger slots use the
// printable v4 master so the dock and Finder icon match the marker.
import {mkdtemp,mkdir,rm,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';
if(process.platform!=='darwin')throw new Error('Icon generation requires macOS sips and iconutil. The generated .icns is committed for packaging.');
const root=fileURLToPath(new URL('../',import.meta.url)),temp=await mkdtemp(join(tmpdir(),'digipoly-icon-')),iconset=join(temp,'DigiPoly.iconset');
const favicon={16:'favicon-16.png',32:'favicon-32.png',64:'favicon-64.png'};
try{
  await mkdir(iconset);
  for(const size of [16,32,128,256,512])for(const scale of [1,2]){
    const pixels=size*scale,out=join(iconset,`icon_${size}x${size}${scale===2?'@2x':''}.png`);
    if(favicon[pixels])await copyFile(join(root,'assets/brand',favicon[pixels]),out);
    else execFileSync('/usr/bin/sips',['-z',String(pixels),String(pixels),join(root,'assets/brand/portal-logo.png'),'--out',out],{stdio:'ignore'});
  }
  execFileSync('/usr/bin/iconutil',['-c','icns',iconset,'-o',join(root,'assets/brand/digipoly.icns')]);
  console.log('Updated DigiPoly Live macOS icon.');
}finally{await rm(temp,{recursive:true,force:true});}
