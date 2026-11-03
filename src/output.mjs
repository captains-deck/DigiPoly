const feed=document.getElementById('feed'),message=document.getElementById('message');
const params=new URLSearchParams(location.search),envId=params.get('environment'),channelId=params.get('channel');
let stream,timer,closed=false,playbackBlocked=false;
function show(text){message.hidden=false;message.textContent=text;feed.hidden=true;}
function check(){
  if(!window.opener||window.opener.closed){show('The studio is closed. Open this channel’s clean output from DigiPoly Studio again.');return false;}
  try{
    const info=window.opener.digipoly?.getOutputInfo(envId,channelId);
    if(!info?.exists){show('This environment or channel is no longer available. Open an existing channel’s clean output in DigiPoly Studio.');return false;}
    document.title=`DigiPoly — ${info.environment} — ${info.name}`;
    if(!info.active){show(`Output paused. Select “${info.environment}” in DigiPoly Studio to resume “${info.name}”.`);return false;}
    if(!info.ready){show('Waiting for the studio to resume processing.');return false;}
    if(!stream?.active){show('This output has stopped. Reopen it from its campaign channel in DigiPoly Studio.');return false;}
    if(playbackBlocked)return false;message.hidden=true;feed.hidden=false;return true;
  }catch{show('The studio connection changed. Reopen this channel’s clean output from DigiPoly Studio.');return false;}
}
try{
  if(!envId||!channelId||!window.opener?.digipoly)throw new Error('Open a channel’s Clean output button in DigiPoly Studio. Keep the studio open while capturing.');
  stream=window.opener.digipoly.getOutputStream(envId,channelId);feed.srcObject=stream;
  feed.play().catch(()=>{playbackBlocked=true;show('Click to start this output.');const start=document.createElement('button');start.textContent='Start output';start.onclick=async()=>{await feed.play();playbackBlocked=false;check();};message.append(start);});
  function pump(){if(closed)return;try{window.opener?.digipoly?.pump();}catch{}requestAnimationFrame(pump);}requestAnimationFrame(pump);check();timer=setInterval(check,500);
}catch(error){show(error.message);const link=document.createElement('a');link.href='/';link.textContent='Open DigiPoly Studio';message.append(link);}
window.addEventListener('beforeunload',()=>{closed=true;clearInterval(timer);feed.srcObject=null;});
document.addEventListener('dblclick',()=>document.documentElement.requestFullscreen?.().catch(()=>{}));
