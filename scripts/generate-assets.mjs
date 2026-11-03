import {writeFile} from 'node:fs/promises';
import {MARKERS,markerSvg} from '../src/marker.mjs';
for(const marker of MARKERS){
  await writeFile(new URL(`../assets/brand/${marker.slug}.svg`,import.meta.url),markerSvg({id:marker.id}));
  await writeFile(new URL(`../assets/brand/${marker.slug}-print.svg`,import.meta.url),markerSvg({id:marker.id,quiet:25}));
}
console.log('Generated both Portal v2 marker masters and print tiles. Original logo assets retained.');
