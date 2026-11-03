// Read the fixed 8-bit RGBA PNG design fixture without adding a runtime dependency.
import {inflateSync} from 'node:zlib';
export function rgbaPng(bytes){
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  if(bytes[24]!==8||bytes[25]!==6||bytes[28]!==0)throw new Error('Fixture must be a non-interlaced 8-bit RGBA PNG.');
  const chunks=[];for(let at=8;at<bytes.length;){const length=bytes.readUInt32BE(at),type=bytes.toString('ascii',at+4,at+8);if(type==='IDAT')chunks.push(bytes.subarray(at+8,at+8+length));at+=length+12;}
  const packed=inflateSync(Buffer.concat(chunks)),stride=width*4,rgba=new Uint8Array(stride*height);let at=0;
  const paeth=(a,b,c)=>{const p=a+b-c,x=Math.abs(p-a),y=Math.abs(p-b),z=Math.abs(p-c);return x<=y&&x<=z?a:y<=z?b:c;};
  for(let y=0;y<height;y++){const filter=packed[at++];for(let x=0;x<stride;x++){const i=y*stride+x,a=x>=4?rgba[i-4]:0,b=y?rgba[i-stride]:0,c=y&&x>=4?rgba[i-stride-4]:0;rgba[i]=(packed[at++]+[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter])&255;}}
  return {width,height,rgba};
}
