import {copyFile,mkdir,readdir,rm,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,relative,extname} from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url)),out=join(root,'dist');
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
const files=['studio.html','index.html','live-setup.html','output.html','print.html','404.html','LICENSE','THIRD_PARTY_NOTICES.md','_headers','vendor/opencv.js','vendor/LICENSE-OpenCV.txt'];
async function collect(dir,extensions){for(const entry of await readdir(join(root,dir),{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())await collect(path,extensions);else if(entry.isFile()&&extensions.includes(extname(path)))files.push(path);}}
await collect('website',['.html','.css','.js']);
await collect('src',['.mjs','.js','.css']);await collect('assets',['.svg','.png','.jpg','.jpeg','.webp']);
let bytes=0;for(const file of files){const target=join(out,file);await mkdir(join(target,'..'),{recursive:true});await copyFile(join(root,file),target);bytes+=(await stat(target)).size;}
console.log(`Prepared ${files.length} public files (${(bytes/1024/1024).toFixed(1)} MB) in ${relative(root,out)}/. Development files and reference images are excluded.`);
