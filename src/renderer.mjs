import {homography} from './geometry.mjs';
export class PlaneRenderer {
  constructor(width=1280,height=720) {
    this.canvas=document.createElement('canvas');this.canvas.width=width;this.canvas.height=height;
    const gl=this.gl=this.canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false});
    if(!gl)throw new Error('WebGL is unavailable. Enable hardware acceleration in your browser.');
    const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
    const vs=compile(gl.VERTEX_SHADER,`attribute vec2 uv; uniform mat3 plane; uniform vec2 size; varying vec2 tex; void main(){vec3 p=plane*vec3(uv,1.);gl_Position=vec4(2.*p.x/size.x-p.z,p.z-2.*p.y/size.y,0.,p.z);tex=uv;}`);
    const fs=compile(gl.FRAGMENT_SHADER,`precision mediump float; uniform sampler2D image; varying vec2 tex; void main(){gl_FragColor=texture2D(image,tex);}`);
    const program=this.program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,1,1,0,0,1,1,0,1]),gl.STATIC_DRAW);
    const uv=gl.getAttribLocation(program,'uv');gl.enableVertexAttribArray(uv);gl.vertexAttribPointer(uv,2,gl.FLOAT,false,0,0);
    this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    this.textures=new Map([['default',this.texture]]);
    this.raster=document.createElement('canvas');this.raster.width=this.raster.height=600;
    this.plane=gl.getUniformLocation(program,'plane');this.size=gl.getUniformLocation(program,'size');
    gl.uniform1i(gl.getUniformLocation(program,'image'),0);
  }
  setImage(image,key='default') {
    const gl=this.gl;
    if(!this.textures.has(key)){
      const texture=gl.createTexture();this.textures.set(key,texture);gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    }
    gl.bindTexture(gl.TEXTURE_2D,this.textures.get(key));
    // Rasterise SVGs and reuse the staging canvas instead of allocating per video frame.
    const ctx=this.raster.getContext('2d');ctx.clearRect(0,0,600,600);ctx.drawImage(image,0,0,600,600);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.raster);
    if(gl.getError()!==gl.NO_ERROR)throw new Error('Media could not be loaded into the graphics renderer.');
  }
  useTexture(key='default'){const texture=this.textures.get(key);if(!texture)return false;this.gl.bindTexture(this.gl.TEXTURE_2D,texture);return true;}
  removeTexture(key){const texture=this.textures.get(key);if(texture)this.gl.deleteTexture(texture);this.textures.delete(key);}
  dispose(){for(const key of [...this.textures.keys()])this.removeTexture(key);this.gl.getExtension('WEBGL_lose_context')?.loseContext();}
  draw(corners,width=this.canvas.width,height=this.canvas.height) {
    if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
    const gl=this.gl,h=homography(corners);gl.viewport(0,0,width,height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniformMatrix3fv(this.plane,false,new Float32Array([h[0],h[3],h[6],h[1],h[4],h[7],h[2],h[5],h[8]]));gl.uniform2f(this.size,width,height);gl.drawArrays(gl.TRIANGLES,0,6);
    return this.canvas;
  }
}
