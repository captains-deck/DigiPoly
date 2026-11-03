export const referencedFiles=state=>[...new Set([...state.media.map(m=>m.id),...state.environments.flatMap(e=>e.markers.filter(m=>m.kind==='ghost').map(m=>m.referenceId)),...state.environments.map(e=>e.scene.background.assetId).filter(Boolean)])];
export async function sha256(blob){const data=blob instanceof Blob?await blob.arrayBuffer():blob;return [...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export class CloudClient {
  constructor(fetcher=(...args)=>globalThis.fetch(...args)){this.fetcher=fetcher;}
  async request(path,options={}){
    const response=await this.fetcher(`/api/${path}`,{...options,headers:{'X-DigiPoly-Client':'1',...options.headers}});
    if(response.redirected||response.headers.get('content-type')?.includes('text/html'))throw new Error('Open the online studio and sign in to use cloud saving.');
    if(!response.ok){let data;try{data=await response.json();}catch{}const error=new Error(data?.error||`Cloud request failed (${response.status}).`);error.status=response.status;throw error;}
    return response;
  }
  async me(){return (await this.request('me')).json();}
  async load(){return (await this.request('workspace')).json();}
  async save(workspace,baseRevision,getRecord,progress=()=>{}){
    const files={};
    for(const id of referencedFiles(workspace)){
      progress(`Uploading ${id.startsWith('background-')?'background':'media'}…`);
      const record=await getRecord(id);if(!record?.blob)throw new Error('A local upload is missing. Re-add it before saving to the cloud.');
      const hash=await sha256(record.blob);files[id]={hash,type:record.blob.type,size:record.blob.size};
      const head=await this.fetcher(`/api/files/${hash}`,{method:'HEAD'});
      if(!head.ok)await this.request(`files/${hash}`,{method:'PUT',headers:{'Content-Type':record.blob.type},body:record.blob});
    }
    progress('Saving environments…');
    return (await this.request('workspace',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({workspace,files,baseRevision})})).json();
  }
  async records(snapshot,progress=()=>{}){
    const records=[];
    for(const id of referencedFiles(snapshot.workspace)){
      progress(`Downloading file ${records.length+1} of ${referencedFiles(snapshot.workspace).length}…`);
      const f=snapshot.files[id];if(!f)throw new Error('The cloud copy is missing an upload.');
      const blob=await (await this.request(`files/${f.hash}`)).blob();
      if(blob.size!==f.size||await sha256(blob)!==f.hash)throw new Error('A download was incomplete. Try loading again.');
      records.push({id,blob});
    }
    return records;
  }
}
