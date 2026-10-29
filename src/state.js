export const defaults = Object.freeze({ shape: 'flower', viewZoom: 100, petals: 12, layers: 6, twist: 0, thickness: 0.45, spacing: 1.3, scale: 1, petalLength: 1.79, petalWidth: 0.75, tilt: 65, phase: 114, hue: 0, gradient: 0.065, softness: 0.85, grain: 0.035, speed: 1, background: '#e6d6f0', palette: 'candy', seed: 42, waveAxis: 'y', mappingX: 0, mappingY: 0, mappingZ: 0, mappingScale: 1, backgroundTop: '#e6d6f0', backgroundBottom: '#e6d6f0', backgroundMode: 'solid', backgroundAngle: 0 });
export const limits = {viewZoom:[40,400], petals:[3,32], layers:[1,7], twist:[-90,90], thickness:[0.1,0.65], spacing:[0.25,1.8], scale:[0.7,1.3], petalLength:[0.5,3], petalWidth:[0.25,2], tilt:[-360,360], phase:[0,150], hue:[0,360], gradient:[0.01,0.5], softness:[0,1], grain:[0,0.15], speed:[0.1,2], seed:[0,99999], mappingX:[-180,180], mappingY:[-180,180], mappingZ:[-180,180], mappingScale:[0.1,3], backgroundAngle:[0,360]};
export function sanitizeParams(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('参数文件格式不正确');
  const out = {...defaults};
  for (const [key,[min,max]] of Object.entries(limits)) {
    if (typeof input[key] === 'number' && Number.isFinite(input[key])) out[key] = Math.max(min,Math.min(max,input[key]));
  }
  for (const key of ['petals','layers','seed','viewZoom']) out[key] = Math.round(out[key]);
  if (['flower','ring','star'].includes(input.shape)) out.shape = input.shape;
  if (['tutorial','iridescent','sunset','candy','acid'].includes(input.palette)) out.palette = input.palette;
  for (const key of ['background','backgroundTop','backgroundBottom']) if (typeof input[key] === 'string' && /^#[\da-f]{6}$/i.test(input[key])) out[key] = input[key];
  if (['solid','gradient'].includes(input.backgroundMode)) out.backgroundMode=input.backgroundMode;
  if (['x','y','z'].includes(input.waveAxis)) out.waveAxis=input.waveAxis;
  if (!input.backgroundTop) out.backgroundTop=out.background;
  if (!input.backgroundBottom) out.backgroundBottom=out.background;
  return out;
}
export const presets = [
  {name:'柔糖花序', subtitle:'SOFT CANDY', params:{...defaults}},
  {name:'流彩花冠', subtitle:'PRISM BLOOM', params:{...defaults,petals:15,layers:3,tilt:35,phase:80.6,thickness:0.27,spacing:1.04,palette:'tutorial',gradient:0.11,softness:0.15,background:'#d9dafa',backgroundTop:'#d9dafa',backgroundBottom:'#c5b8de',backgroundMode:'gradient',backgroundAngle:145}},
  {name:'落日轨道', subtitle:'SUNSET ORBIT', params:{...defaults,shape:'ring',petals:32,layers:2,tilt:0,phase:2.4,thickness:0.25,spacing:0.8,palette:'sunset',gradient:0.18,softness:0.12,grain:0.018,background:'#20152f',backgroundTop:'#20152f',backgroundBottom:'#5d304a',backgroundMode:'gradient',backgroundAngle:160}},
  {name:'青柠星塔', subtitle:'LIME TOTEM', params:{...defaults,shape:'star',petals:8,layers:5,tilt:12,twist:27,thickness:0.3,petalLength:2.5,petalWidth:0.5,spacing:0.75,phase:4.1,palette:'acid',gradient:0.17,softness:0.1,grain:0.025,background:'#101f26',backgroundTop:'#101f26',backgroundBottom:'#273d37',backgroundMode:'gradient',backgroundAngle:25}}
];
