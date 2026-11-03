/** GhostMarker GM1: experimental DCT pair quantisation, spatial repetition and CRC.
 * No model, account or original image is needed to read an already rectified tile.
 * Reference images are used by the locator and optional photometric compensation.
 */
export const CODEC='ghostmarker-dct-v1';
export const BLOCK=16, BITS=72;
const SIZE=BLOCK*BLOCK;
const A=Float64Array.from({length:SIZE},(_,i)=>2/BLOCK*Math.cos(Math.PI*(2*(i%BLOCK)+1)*1/(2*BLOCK))*Math.cos(Math.PI*(2*Math.floor(i/BLOCK)+1)*2/(2*BLOCK)));
const B=Float64Array.from({length:SIZE},(_,i)=>2/BLOCK*Math.cos(Math.PI*(2*(i%BLOCK)+1)*2/(2*BLOCK))*Math.cos(Math.PI*(2*Math.floor(i/BLOCK)+1)*1/(2*BLOCK)));
export function validId(id){return typeof id==='string'&&/^GM-[A-F0-9]{8}$/.test(id);}
export function makeId(){const values=new Uint32Array(1);crypto.getRandomValues(values);return 'GM-'+values[0].toString(16).padStart(8,'0').toUpperCase();}
function crc16(bytes){let crc=0xffff;for(const byte of bytes){crc^=byte<<8;for(let j=0;j<8;j++)crc=(crc&0x8000)?((crc<<1)^0x1021)&0xffff:(crc<<1)&0xffff;}return crc;}
function packet(id){if(!validId(id))throw new Error('Use a GhostMarker ID such as GM-12AB34CD.');const bytes=new Uint8Array(9);bytes.set([71,77,1]);for(let i=0;i<4;i++)bytes[i+3]=parseInt(id.slice(3+i*2,5+i*2),16);const crc=crc16(bytes.subarray(0,7));bytes[7]=crc>>8;bytes[8]=crc&255;return bytes;}
export function validateDimensions(width,height){if(!Number.isInteger(width)||!Number.isInteger(height)||width%16||height%16||width<256||height<256||width>768||height>768)throw new Error('GhostMarker tiles must be 256–768 pixels per side, in steps of 16.');}
function config(width,height,strength){validateDimensions(width,height);if(!Number.isFinite(strength)||strength<24||strength>128)throw new Error('Choose strength between 24 and 128.');}
export function luminance(rgba){const gray=new Float64Array(rgba.length/4);for(let i=0;i<gray.length;i++)gray[i]=.299*rgba[i*4]+.587*rgba[i*4+1]+.114*rgba[i*4+2];return gray;}
function allCells(width,height){const list=Array.from({length:width*height/SIZE},(_,i)=>i);let random=0x474d7631;for(let i=list.length-1;i>0;i--){random^=random<<13;random^=random>>>17;random^=random<<5;const j=(random>>>0)%(i+1);[list[i],list[j]]=[list[j],list[i]];}return list;}
function coefficient(gray,width,cell){const cols=width/BLOCK,x=cell%cols*BLOCK,y=Math.floor(cell/cols)*BLOCK;let sum=0;for(let j=0;j<SIZE;j++)sum+=gray[(y+Math.floor(j/BLOCK))*width+x+j%BLOCK]*(A[j]-B[j]);return sum;}
export function encode(rgba,width,height,{id=makeId(),strength=64,textured=false}={}){
  config(width,height,strength);if(rgba.length!==width*height*4)throw new Error('Invalid image pixels.');
  const result=new Uint8ClampedArray(rgba),gray=luminance(rgba),bytes=packet(id),order=allCells(width,height).filter(cell=>{if(!textured)return true;const x=cell%(width/BLOCK)*BLOCK,y=Math.floor(cell/(width/BLOCK))*BLOCK;let sum=0,squared=0;for(let j=0;j<SIZE;j++){const v=gray[(y+Math.floor(j/BLOCK))*width+x+j%BLOCK];sum+=v;squared+=v*v;}return squared/SIZE-(sum/SIZE)**2>=36;}),cols=width/BLOCK;
  if(order.length<BITS*3)throw new Error('This picture has too little texture for subtle encoding. Choose a more detailed photograph.');
  for(let k=0;k<order.length;k++){
    const bit=(bytes[Math.floor((k%BITS)/8)]>>(7-k%BITS%8))&1,cell=order[k],diff=coefficient(gray,width,cell);
    const target=(Math.round((diff/strength-bit)/2)*2+bit)*strength,delta=(target-diff)/2;
    const x=cell%cols*BLOCK,y=Math.floor(cell/cols)*BLOCK;
    for(let j=0;j<SIZE;j++){const ix=((y+Math.floor(j/BLOCK))*width+x+j%BLOCK)*4,change=delta*(A[j]-B[j]);for(let c=0;c<3;c++)result[ix+c]=Math.max(0,Math.min(255,rgba[ix+c]+change));result[ix+3]=255;}
  }
  let squared=0;for(let i=0;i<rgba.length;i++)if(i%4!==3)squared+=(result[i]-rgba[i])**2;
  const mse=squared/(width*height*3);return {rgba:result,id,codec:CODEC,strength,width,height,...(textured?{cells:order}:{}),psnr:mse?10*Math.log10(255**2/mse):Infinity};
}
export function validateCells(cells,width,height){if(cells===undefined)return undefined;if(!Array.isArray(cells)||cells.length<BITS*3||cells.length>width*height/SIZE||new Set(cells).size!==cells.length||cells.some(i=>!Number.isInteger(i)||i<0||i>=width*height/SIZE))throw new Error('Invalid GhostMarker texture layout.');return [...cells];}
export function decode(rgba,width,height,{strength=64,reference,cells}={}){
  config(width,height,strength);if(rgba.length!==width*height*4)throw new Error('Invalid image pixels.');
  const gray=luminance(rgba);let gain=1;
  if(reference){if(reference.length!==rgba.length)throw new Error('Reference dimensions do not match.');const ref=luminance(reference);let x=0,y=0,xx=0,xy=0,n=0;for(let i=0;i<gray.length;i+=3){x+=ref[i];y+=gray[i];xx+=ref[i]**2;xy+=ref[i]*gray[i];n++;}const slope=(xy-x*y/n)/(xx-x*x/n);if(Number.isFinite(slope)&&slope>.35&&slope<2.5)gain=1/slope;}
  const scores=new Float64Array(BITS),counts=new Uint16Array(BITS),order=validateCells(cells,width,height)||allCells(width,height);
  for(let k=0;k<order.length;k++){const q=coefficient(gray,width,order[k])*gain/strength;const even=Math.abs(q-2*Math.round(q/2)),odd=Math.abs(q-(2*Math.round((q-1)/2)+1));scores[k%BITS]+=even-odd;counts[k%BITS]++;}
  const bytes=new Uint8Array(9);for(let b=0;b<BITS;b++)if(scores[b]>0)bytes[Math.floor(b/8)]|=1<<(7-b%8);
  const confidence=Array.from(scores,(s,i)=>Math.abs(s)/counts[i]).reduce((a,b)=>a+b,0)/BITS;
  const valid=bytes[0]===71&&bytes[1]===77&&bytes[2]===1&&crc16(bytes.subarray(0,7))===(bytes[7]<<8|bytes[8]);
  return {valid,id:valid?'GM-'+Array.from(bytes.subarray(3,7),x=>x.toString(16).padStart(2,'0')).join('').toUpperCase():null,confidence,gain};
}
export function validateTarget(raw){
  if(!raw||raw.codec!==CODEC||!validId(raw.id))throw new Error('Not a supported GhostMarker target.');config(raw.width,raw.height,raw.strength);
  if(typeof raw.image!=='string'||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(raw.image)||raw.image.length>4*1024*1024)throw new Error('Target needs its encoded PNG reference (maximum 3 MB).');
  return {version:1,codec:CODEC,id:raw.id,width:raw.width,height:raw.height,strength:raw.strength,name:String(raw.name||raw.id).slice(0,80),...(raw.cells?{cells:validateCells(raw.cells,raw.width,raw.height)}:{}),image:raw.image};
}

/** Coarse normalised image correlation prevents two near-identical references. */
export function samePicture(a,b){
 if(Math.abs(a.width/a.height-b.width/b.height)>.05)return false;
 let sx=0,sy=0,xx=0,yy=0,xy=0,n=0;
 for(let y=0;y<24;y++)for(let x=0;x<24;x++){const ia=(Math.floor((y+.5)*a.height/24)*a.width+Math.floor((x+.5)*a.width/24))*4,ib=(Math.floor((y+.5)*b.height/24)*b.width+Math.floor((x+.5)*b.width/24))*4;const va=.299*a.rgba[ia]+.587*a.rgba[ia+1]+.114*a.rgba[ia+2],vb=.299*b.rgba[ib]+.587*b.rgba[ib+1]+.114*b.rgba[ib+2];sx+=va;sy+=vb;xx+=va*va;yy+=vb*vb;xy+=va*vb;n++;}
 const denominator=Math.sqrt((xx-sx*sx/n)*(yy-sy*sy/n));return denominator>0&&(xy-sx*sy/n)/denominator>.97;
}
