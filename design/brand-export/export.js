import {createArtRenderer} from '../../src/renderer.js';
import {defaults} from '../../src/state.js';
const $=s=>document.querySelector(s);
function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});}
function png(canvas){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG编码失败')),'image/png'));}
async function offer(blob,name,label,preview=true){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.textContent=label;$('#links').appendChild(link);if(preview){const img=await loadImage(url);img.alt=label;$('#previews').appendChild(img);}return blob;}
$('#generate').onclick=async()=>{
 $('#generate').disabled=true;$('#status').textContent='正在按默认参数渲染…';let art;
 try{
  const icon=document.createElement('canvas');icon.width=icon.height=1024;
  icon.getContext('2d').drawImage(await loadImage('/favicon.svg'),0,0,1024,1024);
  await offer(await png(icon),'chroma-icon-web.png','下载网页同款图标');
  art=createArtRenderer($('#source'),{...defaults});art.setTime(0);
  const raw=await art.exportPNG(1080,1920);
  await offer(raw,'chroma-default-art.png','下载默认参数原图',false);
  // Use the same renderer at the cover art area aspect ratio; no generated imagery.
  const image=await loadImage(URL.createObjectURL(await art.exportPNG(1080,1180)));
  const cover=document.createElement('canvas');cover.width=1080;cover.height=1440;
  const ctx=cover.getContext('2d');
  ctx.drawImage(image,0,0);const pixel=ctx.getImageData(0,0,1,1).data;
  ctx.fillStyle=`rgb(${pixel[0]},${pixel[1]},${pixel[2]})`;ctx.fillRect(0,0,1080,1440);
  ctx.drawImage(image,0,260,1080,1180);
  ctx.fillStyle='#202126';ctx.textAlign='center';ctx.font='600 128px -apple-system, BlinkMacSystemFont, sans-serif';ctx.fillText('CHROMA',540,145);
  ctx.font='400 46px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';ctx.fillText('形色实验室',540,215);
  ctx.fillStyle='#66636c';ctx.font='400 24px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';ctx.fillText('参数化创作 · 实时调节',540,262);
  await offer(await png(cover),'chroma-cover-actual.png','下载真实效果封面');
  $('#status').textContent='生成完成：图标 1024 × 1024；封面 1080 × 1440；原图 1080 × 1920。全部来自现有图标或实际默认参数渲染。';
 }catch(error){$('#status').textContent='生成失败：'+error.message;$('#generate').disabled=false;}
 finally{art?.dispose();}
};
