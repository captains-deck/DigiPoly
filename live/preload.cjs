const {contextBridge,ipcRenderer}=require('electron');
const invoke=name=>(...args)=>ipcRenderer.invoke(`live:${name}`,...args);
contextBridge.exposeInMainWorld('live',{status:invoke('status'),signIn:invoke('signin'),sync:invoke('sync'),load:invoke('load'),channels:invoke('channels'),offer:invoke('offer'),diagnostic:invoke('diagnostic'),frame:invoke('frame'),copy:invoke('copy'),portal:invoke('portal'),cameraPermission:invoke('camera-permission'),
  onEvent:callback=>{const listener=(_event,message)=>callback(message);ipcRenderer.on('live:event',listener);return()=>ipcRenderer.removeListener('live:event',listener);}});
