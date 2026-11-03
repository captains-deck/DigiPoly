export async function gather(pc,timeout=4000){
  if(pc.iceGatheringState==='complete')return;
  await new Promise(resolve=>{const done=()=>{clearTimeout(timer);pc.removeEventListener('icegatheringstatechange',check);resolve();};const check=()=>{if(pc.iceGatheringState==='complete')done();};const timer=setTimeout(done,timeout);pc.addEventListener('icegatheringstatechange',check);});
}
