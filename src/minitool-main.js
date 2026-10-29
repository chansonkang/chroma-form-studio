import {PROJECT_KEY, LEGACY_PROJECT_KEY, resolveStartupProject} from './project-session.js';
// 小工具独立入口；网页版保留原有导出能力。
import './style.css';
import './minitool.css';
import { createPlatform } from './minitool-platform.js';
import { setupMinitoolLayout } from './minitool-layout.js';
import { createArtRenderer } from './minitool-renderer.js';
import { defaults, presets, sanitizeParams } from './state.js';
import { getPresetThumbnail } from './preset-thumbnails.js';

async function boot(platform) {
const icons = {
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>', download:'<path d="M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5"/>',
  play:'<path d="m8 5 11 7-11 7Z" fill="currentColor" stroke="none"/>', pause:'<path d="M9 5v14M15 5v14" stroke-width="3"/>',
  reset:'<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>', flower:'<path d="M12 7c-5-9-11 1-5 5-9 5 1 11 5 5 5 9 11-1 5-5 9-5-1-11-5-5Z"/>',
  ring:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>', star:'<path d="m12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1Z"/>',
  shuffle:'<path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-3 6-6s4-6 6-6h3m-4-4 4 4-4 4"/>',
  expand:'<path d="M9 3H3v6m12-6h6v6M3 15v6h6m6 0h6v-6"/>', layers:'<path d="m3 8 9-5 9 5-9 5Zm0 5 9 5 9-5m-18 5 9 5 9-5"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
  save:'<path d="M5 3h12l3 3v15H4V3Zm3 0v6h8V3M8 21v-8h8v8"/>', info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>'
};
const icon = (name, cls='') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||''}</svg>`;
let legacyProject = null;
let params = {...defaults}, art, playing = false, elapsed = 0, lastTime = 0, selected = 0;
let saved = [], initialReadError = '';
try { const session=resolveStartupProject(await platform.read(PROJECT_KEY),await platform.read(LEGACY_PROJECT_KEY));params=session.params;legacyProject=session.legacy; saved=await platform.read('chroma-presets-v2')||[]; if(!Array.isArray(saved))saved=[]; saved=saved.slice(0,12).filter(p=>p&&typeof p.name==='string'&&p.params).map(p=>({...p,params:sanitizeParams(p.params)})); } catch (error) { saved=[]; initialReadError=error.message||'无法读取已保存的作品'; }

selected=[...presets,...saved].findIndex(p=>JSON.stringify(sanitizeParams(p.params))===JSON.stringify(params));
const slider = (key,label,min,max,step,unit='') => `<label class="slider-control"><span>${label}<span class="numeric"><input type="number" data-param="${key}" aria-label="${label}数值" min="${min}" max="${max}" step="${step}" value="${params[key]}">${unit}</span></span><input aria-label="${label}" type="range" data-param="${key}" min="${min}" max="${max}" step="${step}" value="${params[key]}"></label>`;
document.querySelector('#app').innerHTML = `
<header class="topbar"><a class="brand" href="#" aria-label="CHROMA 首页"><span class="brand-orb"></span><span>CHROMA</span><i>/</i><small>形色实验室</small></a><nav aria-label="工作区"><button class="nav-active" id="workspace">工作台</button><button id="presets-nav">灵感预设 <span>04</span></button></nav><div class="header-actions"><button class="icon-button" id="help" aria-label="使用说明">${icon('info')}</button><button class="export-top" data-export>${icon('download')}<span>导出作品</span></button></div></header>
<main><div class="section-line"><span><i class="status-dot"></i> GENERATIVE FORM STUDIO <b>/</b> 自由探索形态与色彩</span><span class="local-status">本地创作 · 自动保存</span></div>
<div class="studio"><section class="viewport-section" aria-label="三维作品预览"><div class="artboard" id="artboard"><div id="canvas-host"></div><div class="canvas-top"><span class="canvas-tag"><i></i> LIVE CANVAS</span><div class="canvas-tools"><button id="reset-view" title="重置视角" aria-label="重置视角">${icon('reset')}</button><button id="fullscreen" title="全屏画布" aria-label="全屏画布">${icon('expand')}</button></div></div><div class="canvas-caption"><span id="art-title">柔糖花序 <small>SOFT CANDY — 001</small></span><span>9:16 · 拖拽旋转 · 滚轮缩放</span></div><div class="render-error" id="render-error" hidden></div></div><div class="transport"><button class="transport-play" id="play-small" aria-label="播放动画">${icon('play')}</button><span id="time-label">00:00</span><input id="timeline" type="range" min="0" max="5" step="0.01" value="0" aria-label="动画时间"><span class="duration">00:05</span><button id="rewind" class="icon-button" aria-label="回到动画起点">${icon('reset')}</button><span class="loop-label">循环</span></div></section>
<aside class="controls" aria-label="设计参数"><section class="tile view-tile" aria-label="画布视角调节"><div class="tile-heading"><span>画布视角 <small>VIEW</small></span><button id="reset-zoom" class="view-reset">还原 100%</button></div><div class="view-zoom-row"><button id="zoom-out" class="zoom-step" aria-label="拉远视角">−</button>${slider('viewZoom','视角缩放',40,400,1,'%')}<button id="zoom-in" class="zoom-step" aria-label="拉近视角">＋</button></div><p>拉远 ↔ 拉近 · 与滚轮、双指缩放同步</p></section><div class="form-row"><div class="tile form-tile"><div class="tile-heading"><span>基础形态</span><small>FORM</small></div><div class="shape-options">${['flower','ring','star'].map((s,i)=>`<button data-shape="${s}" aria-label="${['花瓣','圆环','星形'][i]}" title="${['花瓣','圆环','星形'][i]}">${icon(s)}<span>${['花瓣','圆环','星形'][i]}</span></button>`).join('')}</div></div><div class="tile petals-tile"><span>花瓣数量</span><div id="petal-value">08</div><small>PETALS</small></div><div class="stepper"><button id="petal-plus" aria-label="增加花瓣">＋</button><button id="petal-minus" aria-label="减少花瓣">−</button></div></div>
<div class="tile twist-tile"><div class="twist-symbol">↻</div>${slider('tilt','花瓣旋转',-360,360,1,'°')}</div>
<div class="color-row"><div class="tile layers-tile"><span>堆叠层数</span><div class="layers-value"><button id="layer-minus" aria-label="减少层数">−</button><span id="layer-value">4</span><button id="layer-plus" aria-label="增加层数">＋</button></div><small>${icon('layers')} LAYERS</small></div><div class="tile palette-tile"><div class="tile-heading"><span>色彩映射</span><small id="palette-name">虹彩</small></div><div class="palette-options">${['tutorial','sunset','candy','acid'].map((p,i)=>`<button class="color-orb ${p}" data-palette="${p}" aria-label="${['教程','日落','糖果','酸性'][i]}配色" title="${['教程','日落','糖果','酸性'][i]}"></button>`).join('')}</div><div class="gradient-strip"></div></div></div>
<div class="motion-row"><button class="tile motion-tile" id="play-main">${icon('play')}<span id="play-label">让它流动</span><span class="motion-arrow">↗</span></button><div class="tile glow-tile">${slider('softness','柔光强度',0,1,0.01)}</div></div>
<div class="tile detail-tile"><div class="detail-heading"><span>精细调节 <small>FINE TUNE</small></span>${legacyProject?'<button id="restore-legacy">恢复旧版创作</button>':''}<button id="reset-params">恢复默认</button></div><div class="fine-grid">${slider('thickness','花瓣半径',0.1,0.65,0.01)}${slider('spacing','层间距离',0.25,1.8,0.01)}${slider('gradient','波纹比例',0.01,0.5,0.001)}${slider('phase','色带相位',0,150,0.1)}</div><details><summary>更多参数 <span>＋</span></summary><div class="fine-grid advanced">${slider('petalLength','花瓣纵向拉伸',0.5,3,0.01)}${slider('petalWidth','花瓣横向压缩',0.25,2,0.01)}${slider('twist','层间扭转',-90,90,1,'°')}${slider('grain','胶片颗粒',0,0.15,0.005)}${slider('hue','色相偏移',0,360,1,'°')}${slider('speed','动画速度',0.1,2,0.1)}${slider('scale','形体比例',0.7,1.3,0.01)}<label class="background-label">色带方向<select id="wave-axis" aria-label="色带方向"><option value="y">垂直</option><option value="x">水平</option><option value="z">纵深</option></select></label>${slider('mappingX','映射 X 旋转',-180,180,1,'°')}${slider('mappingY','映射 Y 旋转',-180,180,1,'°')}${slider('mappingZ','映射 Z 旋转',-180,180,1,'°')}${slider('mappingScale','映射缩放',0.1,3,0.01)}</div></details></div>
<section class="tile background-tile" aria-label="背景调节"><div class="tile-heading"><span>背景调节 <small>BACKGROUND</small></span><div class="background-modes"><button data-background-mode="solid">纯色</button><button data-background-mode="gradient">渐变</button></div></div><div class="background-swatch" id="background-preview"></div><div id="solid-settings"><label class="background-color-field"><span>背景颜色</span><input type="color" data-color="background" aria-label="背景颜色"><input type="text" data-hex="background" aria-label="背景颜色 HEX" maxlength="7" spellcheck="false"></label></div><div id="gradient-settings"><div class="background-color-grid"><label class="background-color-field"><span>起始颜色</span><input type="color" data-color="backgroundTop" aria-label="渐变起始颜色"><input type="text" data-hex="backgroundTop" aria-label="渐变起始 HEX" maxlength="7" spellcheck="false"></label><label class="background-color-field"><span>结束颜色</span><input type="color" data-color="backgroundBottom" aria-label="渐变结束颜色"><input type="text" data-hex="backgroundBottom" aria-label="渐变结束 HEX" maxlength="7" spellcheck="false"></label></div><div class="background-angle">${slider('backgroundAngle','渐变方向',0,360,1,'°')}<button id="swap-background" aria-label="交换渐变颜色">⇄</button></div></div><div class="background-presets"><span>快捷配色</span><button data-bg-preset="mist" title="雾紫" aria-label="雾紫背景"></button><button data-bg-preset="pearl" title="珍珠" aria-label="珍珠背景"></button><button data-bg-preset="night" title="夜幕" aria-label="夜幕背景"></button><button data-bg-preset="peach" title="蜜桃" aria-label="蜜桃背景"></button></div></section>
<div class="action-row"><button class="tile random-button" id="randomize">${icon('shuffle')} 随机探索</button><button class="tile export-button" data-export>导出作品 ${icon('download')}</button></div></aside></div>
<section class="presets-section" id="preset-section"><div class="presets-heading"><span>从一个灵感开始 <small>CURATED PRESETS</small></span><button id="import-button">导入参数 ↗</button></div><div class="presets-grid" id="presets-grid"></div></section></main>
<footer><span>CHROMA <i>©</i> 2026 · 1.0.5</span><span>形态有序，灵感自由。</span><span>视觉灵感 · Ducky 3D / Teknosis</span></footer><div class="toast" id="toast" role="status"></div>
<dialog id="export-dialog"><div class="dialog-heading"><div><small>MAKE IT YOURS</small><h2>把灵感带走。</h2></div><button data-close="export-dialog" aria-label="关闭导出">×</button></div><div class="export-tabs" aria-label="导出类型"><button data-export-mode="image" aria-pressed="true">静态图片</button><button data-export-mode="video" aria-pressed="false">动画视频</button></div><section id="image-export-settings"><p>保存当前视角、背景与动画时刻。</p><label class="export-label">图像尺寸<select id="export-size"><option value="540">540 × 960 · 轻量</option><option value="720" selected>720 × 1280 · 9:16</option></select></label><button class="export-button dialog-export" id="download-png">${icon('download')} 保存图片到相册</button></section><section id="video-export-settings" hidden><p>从当前时刻录制，保留画面效果与动画速度。</p><div class="video-options"><label>清晰度<select id="video-size"><option value="540">540 × 960</option><option value="720" selected>720 × 1280</option></select></label><label>时长<select id="video-duration"><option value="5">5 秒</option><option value="10">10 秒</option></select></label><label>文件格式<select id="video-format"></select></label><span class="video-fps">24 FPS · 无声动画</span></div><p class="record-note" id="video-support-note">录制期间请保持当前标签页可见。</p><button class="export-button dialog-export" id="download-video">${icon('play')} 生成并保存 MP4</button><div id="recording-progress" hidden><progress id="video-progress" max="100" value="0" aria-label="视频生成进度"></progress><div><span id="video-progress-text" role="status">准备录制…</span><button id="cancel-video">取消录制</button></div></div><div id="video-result" hidden><video id="exported-video" controls playsinline preload="none" aria-label="保存的视频预览"></video><p>已保存在小工具文件区。此处保存不会写入系统相册。</p></div></section><div id="saved-videos" class="saved-videos"></div><button class="secondary-button" id="download-json">${icon('save')} 查看 / 备份参数</button><small class="export-note">本地创作 · 无需上传</small></dialog>
<dialog id="help-dialog"><div class="dialog-heading"><h2>欢迎来到形色实验室</h2><button data-close="help-dialog" aria-label="关闭说明">×</button></div><p>拖动花瓣数量、层数和滑杆，实时雕塑你的作品。数值可以直接输入，支持精确调整。</p><p>拖拽画布旋转视角，滚轮或双指缩放。工作台「画布视角」可输入 40%–400% 精确缩放，导出保留当前取景。点击「让它流动」播放动画，拖动进度条停在喜欢的一帧。</p><p>点击下方预设切换风格，或「保存当前」收藏到本机。导出 PNG 获得图片，参数文本可再次粘贴导入编辑。</p><p>小工具版：图片可保存到相册；支持 MP4 编码的设备可将视频保存到小工具文件区。参数支持文本备份与粘贴导入。</p></dialog>`;
document.querySelector('#app').insertAdjacentHTML('beforeend', '<dialog id="params-dialog"><div class="dialog-heading"><h2 id="params-title">参数文本</h2><button data-close="params-dialog" aria-label="关闭参数">×</button></div><p id="params-note">选中文本，使用系统文本操作备份。</p><textarea id="params-text" aria-label="作品参数 JSON" spellcheck="false" maxlength="100000"></textarea><button id="apply-params" class="export-button dialog-export">应用参数</button></dialog>');
const $ = s=>document.querySelector(s);
setupMinitoolLayout();
platform.applyWindowInfo();
$('.brand').onclick=e=>{e.preventDefault();window.scrollTo(0,0);};
let toastTimer;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3000);}
let persistTimer;
function persist(){if(initialReadError)return;clearTimeout(persistTimer);persistTimer=setTimeout(()=>platform.write(PROJECT_KEY,params).then(()=>{$('.local-status').textContent='本地创作 · 已保存';}).catch(()=>{$('.local-status').textContent='保存失败 · 请备份参数';}),300);}

function sync(){
  $('#zoom-out').disabled=params.viewZoom<=40;$('#zoom-in').disabled=params.viewZoom>=400;
  document.querySelectorAll('[data-param]').forEach(el=>{if(document.activeElement!==el||el.type!=='number')el.value=params[el.dataset.param];if(el.type==='range')el.style.setProperty('--fill',`${(el.value-el.min)/(el.max-el.min)*100}%`);});
  $('#petal-value').textContent=String(params.petals).padStart(2,'0');$('#layer-value').textContent=params.layers;
  document.querySelectorAll('[data-shape]').forEach(el=>{el.classList.toggle('selected',el.dataset.shape===params.shape);el.setAttribute('aria-pressed',el.dataset.shape===params.shape);});
  document.querySelectorAll('[data-palette]').forEach(el=>{el.classList.toggle('selected',el.dataset.palette===params.palette);el.setAttribute('aria-pressed',el.dataset.palette===params.palette);});
  $('#palette-name').textContent={tutorial:'教程',iridescent:'虹彩',sunset:'日落',candy:'糖果',acid:'酸性'}[params.palette];
  $('.gradient-strip').className=`gradient-strip ${params.palette}`;syncBackground();$('#wave-axis').value=params.waveAxis;
  $('#petal-plus').disabled=params.petals>=32;$('#petal-minus').disabled=params.petals<=3;$('#layer-plus').disabled=params.layers>=7;$('#layer-minus').disabled=params.layers<=1;
}
function update(next,custom=true){params=sanitizeParams({...params,...next});art?.update(params);sync();persist();if(custom){selected=-1;document.querySelectorAll('.preset-card').forEach(el=>el.classList.remove('active'));$('#art-title').innerHTML='自由创作 <small>YOUR EXPLORATION</small>';}}
document.querySelectorAll('[data-param]').forEach(el=>{
  el.addEventListener('input',()=>{if(el.value===''||!Number.isFinite(Number(el.value)))return;update({[el.dataset.param]:Number(el.value)});});
  if(el.type==='number')el.addEventListener('blur',()=>{el.value=params[el.dataset.param];});
});
document.querySelectorAll('[data-shape]').forEach(el=>el.onclick=()=>update({shape:el.dataset.shape}));
document.querySelectorAll('[data-palette]').forEach(el=>el.onclick=()=>update({palette:el.dataset.palette}));
$('#petal-plus').onclick=()=>update({petals:params.petals+1});$('#petal-minus').onclick=()=>update({petals:params.petals-1});
$('#layer-plus').onclick=()=>update({layers:params.layers+1});$('#layer-minus').onclick=()=>update({layers:params.layers-1});
function syncBackground(){
  const gradient=params.backgroundMode==='gradient';
  $('#solid-settings').hidden=gradient;$('#gradient-settings').hidden=!gradient;
  document.querySelectorAll('[data-background-mode]').forEach(el=>el.setAttribute('aria-pressed',el.dataset.backgroundMode===params.backgroundMode));
  document.querySelectorAll('[data-color]').forEach(el=>el.value=params[el.dataset.color]);
  document.querySelectorAll('[data-hex]').forEach(el=>{if(el!==document.activeElement)el.value=params[el.dataset.hex].toUpperCase();});
  $('#background-preview').style.background=gradient?`linear-gradient(${180-params.backgroundAngle}deg,${params.backgroundTop},${params.backgroundBottom})`:params.background;
}
document.querySelectorAll('[data-background-mode]').forEach(el=>el.onclick=()=>{
  const next={backgroundMode:el.dataset.backgroundMode};
  if(next.backgroundMode==='gradient'&&params.backgroundTop===params.backgroundBottom){next.backgroundTop=params.background;next.backgroundBottom='#fbf5ef';}
  update(next);
});
document.querySelectorAll('[data-color]').forEach(el=>el.oninput=()=>update({[el.dataset.color]:el.value}));
document.querySelectorAll('[data-hex]').forEach(el=>{
  el.oninput=()=>{let color=el.value.trim();if(!color.startsWith('#'))color='#'+color;if(/^#[0-9a-f]{6}$/i.test(color))update({[el.dataset.hex]:color});};
  el.onblur=()=>{el.value=params[el.dataset.hex].toUpperCase();};
});
$('#swap-background').onclick=()=>update({backgroundTop:params.backgroundBottom,backgroundBottom:params.backgroundTop});
const backgroundPresets={mist:['#d6d7ef','#f3eaf7'],pearl:['#c3c6ca','#f5f3ed'],night:['#10182b','#4c416c'],peach:['#e5a9bc','#fff2d0']};
document.querySelectorAll('[data-bg-preset]').forEach(el=>{const colors=backgroundPresets[el.dataset.bgPreset];el.style.background=`linear-gradient(135deg,${colors[0]},${colors[1]})`;el.onclick=()=>update({backgroundMode:'gradient',backgroundTop:colors[0],backgroundBottom:colors[1]});});
$('#wave-axis').onchange=e=>update({waveAxis:e.target.value});$('#reset-params').onclick=()=>{setPlaying(false);selected=0;update(defaults,false);elapsed=0;timeSync();art?.resetView(false);$('#art-title').textContent=presets[0].name;renderPresets();toast('已恢复柔糖默认预设');};
if(legacyProject)$('#restore-legacy').onclick=()=>{setPlaying(false);update(legacyProject);elapsed=0;timeSync();art?.resetView(false);toast('已恢复旧版创作，可保存到预设库');};
$('#zoom-out').onclick=()=>update({viewZoom:params.viewZoom-10});
$('#zoom-in').onclick=()=>update({viewZoom:params.viewZoom+10});
$('#reset-zoom').onclick=()=>update({viewZoom:100});
function onZoomChange(value){if(params.viewZoom===value)return;params={...params,viewZoom:value};document.querySelectorAll('[data-param="viewZoom"]').forEach(el=>el.value=value);sync();persist();}
$('#reset-view').onclick=()=>{art?.resetView?.();toast('视角已重置');};
$('#fullscreen').onclick=()=>{const active=$('#artboard').classList.toggle('immersive');document.body.classList.toggle('canvas-immersive',active);$('#fullscreen').setAttribute('aria-pressed',active);window.dispatchEvent(new Event('chroma-layout'));};
function setPlaying(value){playing=value;if(value&&!document.hidden&&!animationFrame){lastTime=performance.now();animationFrame=requestAnimationFrame(animate);}else if(!value&&animationFrame){cancelAnimationFrame(animationFrame);animationFrame=0;}$('#play-label').textContent=value?'暂停流动':'让它流动';$('#play-main .icon').outerHTML=icon(value?'pause':'play');$('#play-small').innerHTML=icon(value?'pause':'play');$('#play-small').setAttribute('aria-label',value?'暂停动画':'播放动画');$('#play-main').setAttribute('aria-pressed',value);}
$('#play-main').onclick=$('#play-small').onclick=()=>setPlaying(!playing);
function timeSync(){art?.setTime(elapsed);$('#timeline').value=elapsed;$('#time-label').textContent=`00:${String(Math.floor(elapsed)).padStart(2,'0')}`;}
$('#timeline').oninput=e=>{setPlaying(false);elapsed=Number(e.target.value);timeSync();};$('#rewind').onclick=()=>{elapsed=0;timeSync();};
let animationFrame=0;
function animate(now){animationFrame=0;if(document.hidden)return;if(playing){elapsed=(elapsed+Math.min((now-lastTime)/1000,0.1)*params.speed)%5;timeSync();}lastTime=now;animationFrame=requestAnimationFrame(animate);}
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(animationFrame);animationFrame=0;clearTimeout(persistTimer);if(!initialReadError)platform.write(PROJECT_KEY,params).catch(()=>{});const v=$('#exported-video');if(v)v.pause();}else{lastTime=performance.now();if(playing&&!animationFrame)animationFrame=requestAnimationFrame(animate);}});

document.addEventListener('keydown',e=>{if(e.code==='Space'&&!/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)&&!document.querySelector('dialog[open]')){e.preventDefault();setPlaying(!playing);}});
$('#randomize').onclick=()=>{const palette=['iridescent','sunset','candy','acid'][Math.floor(Math.random()*4)];update({petals:4+Math.floor(Math.random()*9),layers:2+Math.floor(Math.random()*4),twist:Math.round(Math.random()*120-60),thickness:Math.round((0.23+Math.random()*0.25)*100)/100,spacing:Math.round((0.45+Math.random()*0.5)*100)/100,palette,hue:Math.round(Math.random()*50),seed:Math.floor(Math.random()*99999)});toast('一个新的形态，等你继续探索');};
document.querySelectorAll('[data-export]').forEach(el=>el.onclick=()=>{refreshVideoFormats();refreshSavedVideos();$('#export-dialog').showModal();});
document.querySelectorAll('[data-close]').forEach(el=>el.onclick=()=>{if(el.dataset.close==='export-dialog'&&recordingController)return;document.getElementById(el.dataset.close).close();});
document.querySelectorAll('dialog').forEach(el=>el.addEventListener('click',e=>{if(e.target===el){if(el.id==='export-dialog'&&recordingController)return;const r=el.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)el.close();}}));
$('#help').onclick=()=>$('#help-dialog').showModal();$('#workspace').onclick=()=>window.scrollTo({top:0,behavior:'smooth'});$('#presets-nav').onclick=()=>$('#preset-section').scrollIntoView({behavior:'smooth',block:'center'});
let recordingController=null;
function refreshVideoFormats(){
  const formats=platform.canSaveVideo&&typeof AbortController==='function'?(art?.getVideoFormats?.()||[]).filter(f=>f.mimeType.includes('mp4')):[];
  const select=$('#video-format');select.textContent='';
  formats.forEach(format=>{const option=document.createElement('option');option.value=format.mimeType;option.textContent=format.label;select.appendChild(option);});
  $('#download-video').disabled=!formats.length;
  $('#video-support-note').textContent=formats.length?'视频将保存到小工具文件区；录制时请保持页面可见。':'当前环境暂不支持 MP4 保存。需要客户端 9.49+、文件接口及 MP4 录制能力；图片与参数仍可保存。';
}
document.querySelectorAll('[data-export-mode]').forEach(el=>el.onclick=()=>{
  const isVideo=el.dataset.exportMode==='video';$('#image-export-settings').hidden=isVideo;$('#video-export-settings').hidden=!isVideo;
  document.querySelectorAll('[data-export-mode]').forEach(button=>button.setAttribute('aria-pressed',button===el));if(!isVideo)$('#exported-video').pause();
});
$('#export-dialog').addEventListener('cancel',e=>{if(recordingController)e.preventDefault();});
$('#export-dialog').addEventListener('close',()=>{$('#exported-video').pause();$('#exported-video').removeAttribute('src');$('#exported-video').load();});
$('#cancel-video').onclick=()=>recordingController?.abort();
function recordingUI(active){
  $('#recording-progress').hidden=!active;
  $('#export-dialog').querySelectorAll('select,[data-export-mode],[data-close],#download-json,#download-png,#download-video').forEach(el=>el.disabled=active);
  $('#download-video').textContent=active?'正在生成视频…':'生成并保存 MP4';
}
$('#download-video').onclick=async()=>{
  if(recordingController||!art)return;
  const controller=new AbortController();recordingController=controller;const wasPlaying=playing;setPlaying(false);recordingUI(true);
  $('#video-result').hidden=true;$('#exported-video').pause();$('#video-progress').value=0;
  const duration=Number($('#video-duration').value),width=Number($('#video-size').value);
  try{
    const result=await art.exportVideo({width,height:Math.round(width*16/9),duration,fps:24,startTime:elapsed,speed:params.speed,mimeType:$('#video-format').value,signal:controller.signal,onProgress:value=>{
      $('#video-progress').value=Math.round(value*100);$('#video-progress-text').textContent='正在录制 '+Math.round(value*100)+'%';
    }});
    if(controller.signal.aborted)throw new DOMException('已取消','AbortError');
    $('#video-progress-text').textContent='正在保存到小工具文件区…';$('#cancel-video').disabled=true;
    const savedVideo=await platform.saveVideo(result.blob);
    $('#exported-video').src=typeof savedVideo==='string'?savedVideo:savedVideo.path;$('#video-result').hidden=false;await refreshSavedVideos();toast('MP4 已保存到小工具文件区');
  }catch(error){toast(error.name==='AbortError'?'已取消录制':'视频保存失败：'+error.message);}
  finally{recordingController=null;$('#cancel-video').disabled=false;recordingUI(false);timeSync();setPlaying(wasPlaying);refreshVideoFormats();}
};
async function refreshSavedVideos(){
  const list=$('#saved-videos');list.textContent='';
  try{const videos=await platform.listVideos();if(!videos.length)return;const title=document.createElement('p');title.textContent='已保存的视频';list.appendChild(title);
    videos.forEach(item=>{const row=document.createElement('div');const play=document.createElement('button');play.textContent=item.name||'已保存 MP4';play.onclick=()=>{$('#video-export-settings').hidden=false;$('#image-export-settings').hidden=true;document.querySelectorAll('[data-export-mode]').forEach(el=>el.setAttribute('aria-pressed',el.dataset.exportMode==='video'));$('#exported-video').src=item.path;$('#video-result').hidden=false;};
    const remove=document.createElement('button');remove.textContent='删除';remove.onclick=async()=>{remove.disabled=true;try{await platform.deleteVideo(item.path);if($('#exported-video').getAttribute('src')===item.path){$('#exported-video').pause();$('#exported-video').removeAttribute('src');$('#exported-video').load();$('#video-result').hidden=true;}await refreshSavedVideos();}catch(e){toast('删除失败：'+e.message);remove.disabled=false;}};row.appendChild(play);row.appendChild(remove);list.appendChild(row);});
  }catch(e){list.textContent='视频列表暂不可用：'+e.message;}
}
$('#download-json').onclick=()=>{$('#params-title').textContent='备份作品参数';$('#params-note').textContent='选中文本，使用系统文本操作备份。';$('#params-text').value=JSON.stringify({version:2,name:'CHROMA',params},null,2);$('#params-text').readOnly=true;$('#apply-params').hidden=true;$('#params-dialog').showModal();$('#params-text').select();};
$('#download-png').onclick=async()=>{const button=$('#download-png');button.disabled=true;button.textContent='正在渲染图片…';const wasPlaying=playing;setPlaying(false);try{if(!art)throw new Error('画布尚未就绪');const size=Number($('#export-size').value);const blob=await art.exportPNG(size,Math.round(size*16/9));if(!blob)throw new Error('无法生成图片');await platform.saveImage(blob);toast('图片已保存到相册');$('#export-dialog').close();}catch(e){toast('保存失败：'+e.message);}finally{button.disabled=false;button.innerHTML=icon('download')+' 保存图片到相册';setPlaying(wasPlaying);}};
$('#import-button').onclick=()=>{$('#params-title').textContent='导入作品参数';$('#params-note').textContent='在下方粘贴 CHROMA 参数 JSON。';$('#params-text').value='';$('#params-text').readOnly=false;$('#apply-params').hidden=false;$('#params-dialog').showModal();};
$('#apply-params').onclick=()=>{try{const raw=$('#params-text').value;if(raw.length>100000)throw new Error('参数文本过长');const data=JSON.parse(raw);if(![1,2].includes(data.version)||!data.params)throw new Error('请输入 CHROMA 参数 JSON');update(sanitizeParams(data.params));elapsed=0;timeSync();$('#params-dialog').close();toast('参数已导入');}catch(e){toast(e.message||'无法解析参数');}};
function renderPresets(){const list=[...presets,...saved];$('#presets-grid').innerHTML=list.map((p,i)=>`<button class="preset-card ${i===selected?'active':''}" data-preset="${i}"><div class="preset-art ${p.params.palette}"><span class="preset-placeholder">${i<presets.length?'预览待生成':'已保存参数'}</span><b>${String(i+1).padStart(2,'0')}</b></div><div class="preset-info"><span></span><small>${i<4?p.subtitle:'YOUR COLLECTION'}</small><i>↗</i></div></button>`).join('')+'<button class="save-preset" id="save-preset"><span>＋</span><b>保存当前</b><small>留住这一刻的灵感</small></button>';
  document.querySelectorAll('[data-preset]').forEach(el=>{const i=Number(el.dataset.preset);el.querySelector('.preset-info span').textContent=list[i].name;const thumb=getPresetThumbnail(list[i].params);if(thumb){const img=document.createElement('img');img.src=thumb;img.alt=list[i].name+'预览';const preview=el.querySelector('.preset-art');preview.querySelector('.preset-placeholder').remove();preview.appendChild(img);}el.onclick=()=>{selected=i;update(list[i].params,false);elapsed=0;timeSync();$('#art-title').textContent=list[i].name;renderPresets();};});
  
  $('#save-preset').onclick=async()=>{if(initialReadError){toast('未能读取已有预设，请备份当前参数后重新打开工具');return;}if(saved.length>=12){toast('最多保存 12 个预设，请备份参数');return;}const button=$('#save-preset');button.disabled=true;const next=saved.concat([{name:`我的探索 ${String(saved.length+1).padStart(2,'0')}`,params:{...params}}]);try{await platform.write('chroma-presets-v2',next);saved=next;selected=presets.length+saved.length-1;renderPresets();toast('已保存到本机预设库');}catch{button.disabled=false;toast('保存失败，请备份参数文本');}};
}
sync();renderPresets();
$('#art-title').textContent=selected>=0?[...presets,...saved][selected].name:'上次创作';
if(initialReadError){$('.local-status').textContent='读取失败 · 请备份参数后重开';toast(initialReadError);}
try { art=createArtRenderer($('#canvas-host'),params,{onZoomChange});timeSync(); } catch(error){$('#render-error').hidden=false;$('#render-error').textContent=`三维画布无法启动：${error.message}。请使用支持 WebGL 的浏览器。`;}

}
createPlatform().then(boot).catch(error=>{const app=document.querySelector('#app');app.textContent='启动失败：'+error.message;});
