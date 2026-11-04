import {MARKERS} from './marker.mjs';
const requested=new URLSearchParams(location.search).get('id');
const selected=MARKERS.filter(m=>!requested||m.id===requested);
const markers=selected.length?selected:MARKERS;
const container=document.getElementById('sheets');
for(const marker of markers){
  const sheet=document.createElement('section');sheet.className='sheet';
  sheet.innerHTML=`<h1>DigiPoly</h1><div class="kicker">ONE IDENTITY. YOUR STORY.</div><img class="marker" src="/assets/brand/${marker.slug}-print.svg" alt="${marker.id} Portal v4 linked marker"><div class="caption">${marker.id}</div><p>${marker.id==='DP-001'?'Logo and DP-001 share this corner pattern.':'Inner corner links are turned to distinguish this ID.'} Assign content in DigiPoly Studio.</p><p class="note">Print on white, matte paper at 100% scale. Disable browser headers and footers.<br>Keep all four corner links and the white border intact. Mount flat and light evenly.<br>Use one copy of each ID in view. This is a visual marker, not a QR link.<br>Older v3 and v2 prints keep their original IDs. New prints need Studio/Live 0.8 or later.</p><div class="version">PORTAL V4 · ${marker.id} · DIGIPOLY STUDIO</div>`;
  container.append(sheet);
}
document.getElementById('print-button').onclick=()=>window.print();
