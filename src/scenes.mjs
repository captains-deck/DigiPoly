// Coordinates are source-image pixels in a 1280 × 720 scene, in TL/TR/BR/BL order.
export const DEFAULT_PLACEMENTS={
  'DP-001':[{x:180,y:170},{x:450,y:170},{x:450,y:440},{x:180,y:440}],
  'DP-002':[{x:870,y:360},{x:1070,y:360},{x:1070,y:560},{x:870,y:560}],
};
export const BEDROOM_PLACEMENTS={
  'DP-001':[{x:224,y:86},{x:434,y:86},{x:434,y:300},{x:224,y:300}],
  'DP-002':[{x:1075,y:366},{x:1213,y:370},{x:1213,y:493},{x:1075,y:484}],
};
export function defaultScene(){return {background:{type:'grid',name:'Demo studio'},layout:'moving',motion:false,placements:structuredClone(DEFAULT_PLACEMENTS)};}
export function bedroomScene(){return {background:{type:'bedroom',name:'Bedroom stream example'},layout:'placed',motion:true,placements:structuredClone(BEDROOM_PLACEMENTS)};}
export function validQuad(points){
  if(!Array.isArray(points)||points.length!==4||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<12||p.x>1268||p.y<12||p.y>708))return false;
  let sign=0;
  for(let i=0;i<4;i++){const a=points[i],b=points[(i+1)%4],c=points[(i+2)%4],cross=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);if(Math.hypot(b.x-a.x,b.y-a.y)<72||cross<=0)return false;sign+=cross;}
  return sign>15000;
}
export function normalizeScene(raw){
  if(!raw)return defaultScene();const scene=structuredClone(raw);
  if(!['grid','bedroom','upload','capture'].includes(scene.background?.type)||!['moving','placed','photo'].includes(scene.layout))throw new Error('Saved environment background is invalid.');
  if(['upload','capture'].includes(scene.background.type)&&typeof scene.background.assetId!=='string')throw new Error('Saved background file is missing its identity.');
  scene.placements ||= structuredClone(DEFAULT_PLACEMENTS);
  for(const id of ['DP-001','DP-002'])if(!validQuad(scene.placements[id]))scene.placements[id]=structuredClone(DEFAULT_PLACEMENTS[id]);
  scene.motion=Boolean(scene.motion);return scene;
}
export function replaceBackground(scene,background){return {...normalizeScene(scene),background:structuredClone(background),layout:'placed',motion:false};}
export function backgroundReferences(state,id){return state.environments.filter(e=>e.scene?.background?.assetId===id).length;}
export function drawCover(ctx,image,width=1280,height=720){
  const iw=image.videoWidth||image.naturalWidth||image.width,ih=image.videoHeight||image.naturalHeight||image.height;
  if(!iw||!ih)throw new Error('No image is ready to capture.');
  const scale=Math.max(width/iw,height/ih),sw=width/scale,sh=height/scale;ctx.drawImage(image,(iw-sw)/2,(ih-sh)/2,sw,sh,0,0,width,height);
}
