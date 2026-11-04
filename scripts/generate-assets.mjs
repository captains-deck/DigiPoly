import {writeFile,copyFile} from 'node:fs/promises';
import {MARKERS,markerSvg,markerPixels} from '../src/marker.mjs';
import {faviconPixels,faviconSvg} from '../src/favicon-marker.mjs';
import {monoPng} from './png.mjs';
const brand=path=>new URL(`../assets/brand/${path}`,import.meta.url);
for(const marker of MARKERS){
  await writeFile(brand(`${marker.slug}.svg`),markerSvg({id:marker.id}));
  await writeFile(brand(`${marker.slug}-print.svg`),markerSvg({id:marker.id,quiet:100}));
}
await writeFile(brand('portal-marker.svg'),markerSvg());
await writeFile(brand('portal-print.svg'),markerSvg({quiet:100}));
await writeFile(brand('portal-logo.png'),monoPng(markerPixels(800),800));
await writeFile(brand('favicon.svg'),faviconSvg());
for(const size of [16,32,48,64])await writeFile(brand(`favicon-${size}.png`),monoPng(faviconPixels(size),size));
await copyFile(new URL('../tests/fixtures/portal-v3-reference.png',import.meta.url),brand('portal-logo-v3.png'));
console.log('Generated Portal v4 logo, favicon, marker pair and print tiles. v3 and v2 recognition retained.');
