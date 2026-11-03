import {packager} from '@electron/packager';
import {mkdir,rm,cp,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url)),stage=join(root,'releases/stage');
await rm(stage,{recursive:true,force:true});await mkdir(stage,{recursive:true});
for(const path of ['live','src','assets','vendor','LICENSE','THIRD_PARTY_NOTICES.md'])await cp(join(root,path),join(stage,path),{recursive:true});
await mkdir(join(stage,'cloud'));await cp(join(root,'cloud/model.mjs'),join(stage,'cloud/model.mjs'));
const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
await writeFile(join(stage,'package.json'),JSON.stringify({name:'digipoly-live',productName:'DigiPoly Live',version:pkg.version,license:pkg.license,main:'live/main.mjs',private:true}));
const paths=await packager({dir:stage,out:join(root,'releases'),name:'DigiPoly Live',appBundleId:'uk.co.digipoly.live',appVersion:pkg.version,electronVersion:pkg.devDependencies.electron,platform:process.platform,arch:process.arch,overwrite:true,asar:true,prune:false,extendInfo:{NSCameraUsageDescription:'DigiPoly Live uses your camera to track printed markers and create local OBS video outputs.',CFBundleURLTypes:[{CFBundleURLName:'DigiPoly Live',CFBundleURLSchemes:['digipoly-live']}]}});
if(process.platform==='darwin')for(const path of paths){
  // Keep runtime notices with the .app when it is copied out of the release folder.
  const notices=join(path,'DigiPoly Live.app','Contents','Resources','third-party');
  await mkdir(notices,{recursive:true});
  await cp(join(path,'LICENSE'),join(notices,'Electron-LICENSE'));
  await cp(join(path,'LICENSES.chromium.html'),join(notices,'LICENSES.chromium.html'));
  execFileSync('/usr/bin/codesign',['--force','--deep','--sign','-',join(path,'DigiPoly Live.app')],{stdio:'inherit'});
}
console.log('Packaged DigiPoly Live:',paths.join(', '));
