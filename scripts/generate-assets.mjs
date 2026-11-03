import {writeFile} from 'node:fs/promises';
import {MARKERS,markerSvg} from '../src/marker.mjs';
for(const marker of MARKERS){
  await writeFile(new URL(`../assets/brand/${marker.slug}.svg`,import.meta.url),markerSvg({id:marker.id}));
  await writeFile(new URL(`../assets/brand/${marker.slug}-print.svg`,import.meta.url),markerSvg({id:marker.id,quiet:100}));
}
await writeFile(new URL('../assets/brand/portal-marker.svg',import.meta.url),markerSvg());
await writeFile(new URL('../assets/brand/portal-print.svg',import.meta.url),markerSvg({quiet:100}));
console.log('Generated Portal v3 logo, marker pair and print tiles. Legacy recognition retained.');
