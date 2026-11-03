import {app,BrowserWindow,ipcMain,session,clipboard,shell,systemPreferences,dialog} from 'electron';
import {readFile,writeFile,mkdir,rename,stat} from 'node:fs/promises';
import {createHash,randomBytes} from 'node:crypto';
import {join} from 'node:path';
import {startServer} from './server.mjs';
import {validateSnapshot} from '../cloud/model.mjs';
import {createWorkspace,validateWorkspace} from '../src/workspace.mjs';
const PORTAL='https://digipoly.co.uk';
let win,server,cloudSession,cache,cacheDir,syncing=false,signingIn=null,pendingEnvironment=null;
app.setName('DigiPoly Live');
if(process.env.DIGIPOLY_DATA_DIR&&!app.isPackaged)app.setPath('userData',process.env.DIGIPOLY_DATA_DIR);
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
const event=message=>{if(win&&!win.isDestroyed())win.webContents.send('live:event',message);};
function openLink(url){try{const parsed=new URL(url);if(parsed.protocol==='digipoly-live:'&&parsed.hostname==='environment'&&/^\/[\w-]{1,100}$/.test(parsed.pathname)){pendingEnvironment=parsed.pathname.slice(1);event({type:'environment',id:pendingEnvironment});}win?.show();win?.focus();}catch{}}
if(!app.requestSingleInstanceLock())app.exit();
app.on('second-instance',(_e,args)=>{args.filter(a=>a.startsWith('digipoly-live:')).forEach(openLink);win?.show();win?.focus();});
app.on('open-url',(e,url)=>{e.preventDefault();openLink(url);});
async function cloud(path,options={}){
  const response=await cloudSession.fetch(`${PORTAL}/api/${path}`,{...options,credentials:'include',headers:{'X-DigiPoly-Client':'1',...options.headers}});
  if(!response.ok||response.redirected||response.headers.get('content-type')?.includes('text/html'))throw new Error('Sign in to DigiPoly to load your cloud workspace.');
  return response;
}
async function signIn(){
  if(signingIn)return signingIn;
  signingIn=new Promise((resolve,reject)=>{
    const login=new BrowserWindow({title:'Sign in to DigiPoly',width:700,height:800,parent:win,modal:true,webPreferences:{session:cloudSession,nodeIntegration:false,contextIsolation:true,sandbox:true}});
    let complete=false,checking=false;
    login.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    login.webContents.on('will-navigate',(e,url)=>{if(!url.startsWith('https://'))e.preventDefault();});
    login.webContents.on('did-finish-load',async()=>{
      if(checking||!login.webContents.getURL().startsWith(`${PORTAL}/`))return;checking=true;
      try{const identity=await (await cloud('me')).json();complete=true;resolve(identity);login.close();}catch{}finally{checking=false;}
    });
    login.on('closed',()=>{if(!complete)reject(new Error('Sign-in closed. Cached environments are still available.'));});
    login.loadURL(`${PORTAL}/live-setup?signin=1`);
  }).finally(()=>{signingIn=null;});return signingIn;
}
function validateCache(raw){const validated=validateSnapshot({...raw,baseRevision:raw.revision});if(!/^[a-f0-9]{64}$/.test(raw.owner))throw new Error('Invalid cache owner');return {...raw,...validated};}
async function sync(){
  if(syncing)throw new Error('A download is already in progress.');syncing=true;
  try{
    const identity=await (await cloud('me')).json(),remote=await (await cloud('workspace')).json();
    if(!remote.workspace)throw new Error('Save an environment to cloud in the portal first.');
    const next=validateCache({...remote,owner:identity.id,email:identity.email});
    const folder=join(cacheDir,next.owner);await mkdir(folder,{recursive:true,mode:0o700});let i=0;
    for(const f of Object.values(next.files)){
      event({type:'progress',message:`Downloading media ${++i} of ${Object.keys(next.files).length}…`});const path=join(folder,f.hash);
      let valid=false;try{const bytes=await readFile(path);valid=bytes.length===f.size&&createHash('sha256').update(bytes).digest('hex')===f.hash;}catch{}
      if(!valid){const response=await cloud(`files/${f.hash}`);const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length!==f.size||createHash('sha256').update(bytes).digest('hex')!==f.hash)throw new Error('Download verification failed. The previous version is still available.');await writeFile(`${path}.part`,bytes,{mode:0o600});await rename(`${path}.part`,path);}
    }
    await writeFile(join(cacheDir,'workspace.next'),JSON.stringify(next),{mode:0o600});await rename(join(cacheDir,'workspace.next'),join(cacheDir,'workspace.json'));cache=next;
    return summary();
  }finally{syncing=false;}
}
function summary(){return {revision:cache?.revision||0,email:cache?.email||null,savedAt:cache?.savedAt,environmentId:pendingEnvironment,environments:(cache?.workspace||demo).environments.map(e=>({id:e.id,name:e.name})),cached:Boolean(cache)};}
let demo;
app.whenReady().then(async()=>{
cacheDir=join(app.getPath('userData'),'cloud-cache');await mkdir(cacheDir,{recursive:true,mode:0o700});
let secret;try{secret=await readFile(join(cacheDir,'source-key'),'utf8');}catch{secret=randomBytes(32).toString('hex');await writeFile(join(cacheDir,'source-key'),secret,{mode:0o600});}
try{cache=validateCache(JSON.parse(await readFile(join(cacheDir,'workspace.json'),'utf8')));}catch{}
try{demo=validateWorkspace(JSON.parse(await readFile(join(cacheDir,'demo.json'),'utf8')));}catch{demo=createWorkspace();await writeFile(join(cacheDir,'demo.json'),JSON.stringify(demo),{mode:0o600});}
try{pendingEnvironment ||= JSON.parse(await readFile(join(cacheDir,'selection.json'),'utf8')).environmentId;}catch{}
server=await startServer({root:app.getAppPath(),secret,port:18777,onImageDemand:channels=>event({type:'image-demand',channels}),onPeer:p=>event({type:'peer',...p}),onAnswer:p=>event({type:'answer',...p}),onLeave:id=>event({type:'leave',id}),resolveMedia:hash=>{const file=Object.values(cache?.files||{}).find(f=>f.hash===hash);return file?{path:join(cacheDir,cache.owner,hash),type:file.type}:null;}}).catch(error=>{console.error(`DigiPoly Live cannot start: ${error.message}. Close another app using port 18777.`);app.quit();throw error;});
cloudSession=session.fromPartition('persist:digipoly-cloud');cloudSession.setPermissionRequestHandler((_w,_p,callback)=>callback(false));cloudSession.setPermissionCheckHandler(()=>false);
const localSession=session.fromPartition('persist:digipoly-local');
localSession.setPermissionRequestHandler((contents,permission,callback,details)=>callback(contents===win?.webContents&&contents.getURL().startsWith(server.origin+'/')&&permission==='media'&&details.mediaTypes?.every(t=>t==='video')));
localSession.setPermissionCheckHandler((contents,permission,origin)=>{try{return contents===win?.webContents&&new URL(origin).origin===server.origin&&permission==='media';}catch{return false;}});
win=new BrowserWindow({title:'DigiPoly Live',width:1320,height:900,minWidth:1000,minHeight:720,backgroundColor:'#101826',webPreferences:{session:localSession,preload:join(app.getAppPath(),'live/preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});
win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(e,url)=>{if(!url.startsWith(server.origin+'/'))e.preventDefault();});
const handle=(name,fn)=>ipcMain.handle(`live:${name}`,(e,...args)=>{if(e.sender!==win.webContents||e.senderFrame!==win.webContents.mainFrame||!e.senderFrame.url.startsWith(server.origin+'/'))throw new Error('Untrusted request');return fn(...args);});
handle('status',summary);handle('signin',signIn);handle('sync',sync);
handle('load',async id=>{
  const workspace=cache?.workspace||demo;if(!workspace.environments.some(e=>e.id===id))throw new Error('Choose an available environment.');
  pendingEnvironment=id;await writeFile(join(cacheDir,'selection.json'),JSON.stringify({environmentId:id}),{mode:0o600});
  return {workspace:{...workspace,activeEnvironmentId:id},revision:cache?.revision||0,files:Object.fromEntries(Object.entries(cache?.files||{}).map(([id,f])=>[id,{...f,url:server.mediaUrl(f.hash)}]))};
});
handle('channels',list=>{if(!Array.isArray(list)||list.length>4||list.some(c=>!/^[-\w]{1,100}$/.test(c.id)||typeof c.name!=='string'))throw new Error('Invalid outputs');return server.setChannels(list);});
handle('offer',(id,offer)=>{if(offer?.type!=='offer'||typeof offer.sdp!=='string'||offer.sdp.length>64000)throw new Error('Invalid offer');server.offer(id,offer);});
handle('diagnostic',(id,data)=>{const peer=server.peers.get(id);if(peer&&JSON.stringify(data).length<2048)peer.diagnostic=data;});
handle('frame',(channel,data)=>{if(typeof channel!=='string'||!(data instanceof Uint8Array)||data.byteLength>1024*1024)throw new Error('Invalid frame');server.frame(channel,data);});
handle('copy',url=>{const u=new URL(url);if(u.origin!==server.origin||u.pathname!=='/live/receiver.html')throw new Error('Invalid output');clipboard.writeText(url);});
handle('portal',()=>shell.openExternal(`${PORTAL}/studio`));
handle('camera-permission',async()=>process.platform==='darwin'?systemPreferences.askForMediaAccess('camera'):true);
if(app.isPackaged)app.setAsDefaultProtocolClient('digipoly-live');
await win.loadURL(server.origin+'/live/index.html');
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',()=>{server?.close();});
}).catch(error=>{console.error(error);dialog.showErrorBox('DigiPoly Live could not start',error.message);app.quit();});
