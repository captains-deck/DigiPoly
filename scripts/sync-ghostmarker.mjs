import {copyFile,mkdir,readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const source=new URL('../../GhostMarker/',import.meta.url),dest=new URL('../vendor/ghostmarker/',import.meta.url);
// Explicit vendored snapshot: a fresh DigiPoly checkout needs no sibling folder.
await mkdir(dest,{recursive:true});const files=['codec.mjs','detector.mjs','tracking.mjs','browser.mjs','probe.js'],hashes={};
for(const file of files){const input=new URL(`src/${file}`,source);await copyFile(input,new URL(file,dest));hashes[file]=createHash('sha256').update(await readFile(input)).digest('hex');}
await copyFile(new URL('LICENSE',source),new URL('LICENSE',dest));await writeFile(new URL('snapshot.json',dest),JSON.stringify({project:'GhostMarker',version:'0.1.0',files:hashes},null,2)+'\n');
console.log('Updated the GhostMarker 0.1.0 source snapshot.');
