import {createArtRenderer} from '../../src/minitool-renderer.js';
import {presets} from '../../src/state.js';
const names=['soft-candy','prism-bloom','sunset-orbit','lime-totem'];
const $=s=>document.querySelector(s);
$('#render').onclick=async()=>{
 $('#render').disabled=true;let renderer;
 try{
  renderer=createArtRenderer($('#source'),presets[0].params);
  if($('#source').textContent.trim())throw new Error('未获得3D画布，停止生成以防混入降级图');
  for(let i=0;i<presets.length;i++){
   const preset=presets[i];$('#status').textContent='正在渲染 '+preset.name;
   renderer.update(preset.params);renderer.resetView(false);renderer.setTime(0);
   const blob=await renderer.exportPNG(480,320),url=URL.createObjectURL(blob);
   const card=document.createElement('section'),a=document.createElement('a'),img=document.createElement('img');
   a.textContent='下载 '+preset.name;a.href=url;a.download=names[i]+'.png';img.src=url;img.alt=preset.name+'真实预览';card.appendChild(a);card.appendChild(img);$('#results').appendChild(card);
  }
  const manifest={renderer:'src/minitool-renderer.js',time:0,width:480,height:320,presets:presets.map((p,i)=>({file:names[i]+'.png',name:p.name,params:p.params}))};
  const a=document.createElement('a');a.textContent='下载参数清单';a.download='manifest.json';a.href=URL.createObjectURL(new Blob([JSON.stringify(manifest,null,2)],{type:'application/json'}));document.body.appendChild(a);
  $('#status').textContent='四张真实预设缩略图生成完成。';
 }catch(e){$('#status').textContent='生成失败：'+e.message;$('#render').disabled=false;}
 finally{renderer?.dispose();}
};
