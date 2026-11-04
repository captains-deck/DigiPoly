import {crc32,deflateSync} from 'node:zlib';
function chunk(type,data){
  const length=Buffer.alloc(4);length.writeUInt32BE(data.length);
  const body=Buffer.concat([Buffer.from(type),data]);
  const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(body)>>>0);
  return Buffer.concat([length,body,crc]);
}
export function encodePng(width,height,rgb){
  const raw=Buffer.alloc(height*(width*3+1));
  for(let y=0;y<height;y++){
    raw[y*(width*3+1)]=0;
    Buffer.from(rgb.buffer,rgb.byteOffset+y*width*3,width*3).copy(raw,y*(width*3+1)+1);
  }
  const header=Buffer.alloc(13);
  header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR',header),
    chunk('IDAT',deflateSync(raw)),
    chunk('IEND',Buffer.alloc(0)),
  ]);
}
export function monoPng(pixels,size,{background=[9,10,11],foreground=[255,255,255]}={}){
  const rgb=new Uint8Array(size*size*3);
  for(let i=0;i<pixels.length;i++){
    const color=pixels[i]?foreground:background;
    rgb[i*3]=color[0];rgb[i*3+1]=color[1];rgb[i*3+2]=color[2];
  }
  return encodePng(size,size,rgb);
}
