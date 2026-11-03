// A capture dialog owns only streams it opened. Borrowing the live source never
// stops the studio camera; closing during a pending permission request is safe.
export class CameraCapture {
  constructor(video,getStream=()=>navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720}},audio:false})){this.video=video;this.getStream=getStream;this.serial=0;this.stream=null;this.owned=false;}
  async start(shared){
    this.stop();const serial=this.serial,owned=!shared;let stream;
    try{stream=shared||await this.getStream();if(serial!==this.serial){if(owned)stream.getTracks().forEach(t=>t.stop());return false;}this.stream=stream;this.owned=owned;this.video.srcObject=stream;await this.video.play();if(serial!==this.serial)return false;return true;}
    catch(error){if(serial===this.serial)this.stop();else if(owned)stream?.getTracks().forEach(t=>t.stop());throw error;}
  }
  stop(){this.serial++;if(this.owned)this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.owned=false;this.video.srcObject=null;}
}
