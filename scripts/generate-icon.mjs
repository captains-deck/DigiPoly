// macOS packaging uses the supplied PNG artwork; no generated/AI reinterpretation.
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';
if(process.platform!=='darwin')throw new Error('Icon generation requires macOS sips and iconutil. The generated .icns is committed for packaging.');
const root=fileURLToPath(new URL('../',import.meta.url)),temp=await mkdtemp(join(tmpdir(),'digipoly-icon-')),iconset=join(temp,'DigiPoly.iconset');
try{await mkdir(iconset);for(const size of [16,32,128,256,512])for(const scale of [1,2])execFileSync('/usr/bin/sips',['-z',String(size*scale),String(size*scale),join(root,'assets/brand/portal-logo.png'),'--out',join(iconset,`icon_${size}x${size}${scale===2?'@2x':''}.png`)],{stdio:'ignore'});execFileSync('/usr/bin/iconutil',['-c','icns',iconset,'-o',join(root,'assets/brand/digipoly.icns')]);console.log('Updated DigiPoly Live macOS icon.');}finally{await rm(temp,{recursive:true,force:true});}
