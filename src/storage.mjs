// Configuration and imported files share a transaction, so assignments never
// claim a file was saved when the file write failed (for example, on quota errors).
export class WorkspaceRepository {
  constructor(name='digipoly-studio-v3'){this.name=name;this.queue=Promise.resolve();}
  async open(){this.db=await new Promise((resolve,reject)=>{const request=indexedDB.open(this.name,1);request.onupgradeneeded=()=>{request.result.createObjectStore('workspace');request.result.createObjectStore('media',{keyPath:'id'});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('Close older DigiPoly tabs to open saved media.'));});return this;}
  async read(store,key){return new Promise((resolve,reject)=>{const request=this.db.transaction(store).objectStore(store).get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
  load(){return this.read('workspace','current');}
  getMedia(id){return this.read('media',id);}
  metadata(key){return this.read('workspace',key);}
  save(state,{put=[],remove=[],metadata={}}={}){
    const snapshot=structuredClone(state);
    const savedMetadata=structuredClone(metadata);
    const write=()=>new Promise((resolve,reject)=>{const tx=this.db.transaction(['workspace','media'],'readwrite');tx.objectStore('workspace').put(snapshot,'current');for(const [key,value] of Object.entries(savedMetadata))tx.objectStore('workspace').put(value,key);for(const record of put)tx.objectStore('media').put(record);for(const id of remove)tx.objectStore('media').delete(id);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error||new Error('Local save failed.'));tx.onerror=()=>{};});
    const result=this.queue.then(write);this.queue=result.catch(()=>{});return result;
  }
  close(){this.db?.close();}
}
