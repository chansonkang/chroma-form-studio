import { normalizeViewZoom } from './view-zoom.js';
// A deliberately labelled, low-cost approximation when 3D cannot run.
export function createFallbackRenderer(container, initial, reason, options = {}) {
  let params = {...initial}, time = 0, disposed = false;
  const canvas = document.createElement('canvas'), notice = document.createElement('div');
  canvas.style.cssText = 'width:100%;height:100%;display:block';
  canvas.setAttribute('aria-label', '参数化花环简化预览');
  notice.textContent = reason || '简化预览';
  notice.style.cssText = 'position:absolute;left:12px;right:12px;bottom:12px;padding:8px;background:#222;color:#fff;font-size:12px;border-radius:8px';
  container.appendChild(canvas); container.appendChild(notice);
  const ctx = canvas.getContext('2d');
  function draw() {
    if (disposed || document.hidden || !ctx) return;
    const w = canvas.width, h = canvas.height;
    let background = params.background;
    if (params.backgroundMode === 'gradient') {
      const a = params.backgroundAngle * Math.PI / 180, dx = Math.sin(a), dy = Math.cos(a), reach = Math.abs(dx) * w / 2 + Math.abs(dy) * h / 2;
      background = ctx.createLinearGradient(w / 2 - dx * reach, h / 2 - dy * reach, w / 2 + dx * reach, h / 2 + dy * reach);
      background.addColorStop(0, params.backgroundTop); background.addColorStop(1, params.backgroundBottom);
    }
    ctx.fillStyle = background; ctx.fillRect(0, 0, w, h);
    const unit = Math.min(w / 4, h / (params.layers * params.spacing + 3)) * params.scale * normalizeViewZoom(params.viewZoom) / 100;
    for (let l = 0; l < params.layers; l++) {
      const cy = h / 2 + (l - (params.layers - 1) / 2) * params.spacing * unit;
      for (let i = 0; i < params.petals; i++) {
        const a = i * Math.PI * 2 / params.petals + l * params.twist * Math.PI / 180;
        const x = w / 2 + Math.cos(a) * unit, y = cy + Math.sin(a) * unit * .35;
        ctx.save(); ctx.translate(x, y); ctx.rotate(a + (params.tilt + time * 72) * Math.PI / 180);
        const length = unit * params.thickness * params.petalLength, width = unit * params.thickness * params.petalWidth;
        const gradient = ctx.createLinearGradient(0, -length, 0, length);
        gradient.addColorStop(0, `hsl(${220 + params.hue},65%,58%)`); gradient.addColorStop(.5, `hsl(${65 + params.hue},45%,65%)`); gradient.addColorStop(1, `hsl(${20 + params.hue},80%,58%)`);
        ctx.fillStyle = gradient; ctx.beginPath(); ctx.ellipse(0, 0, width, length, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
    }
  }
  function resize() { const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight), ratio = Math.min(1, Math.sqrt(1000000 / (w * h))); canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio); draw(); }
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  if (observer) observer.observe(container); else window.addEventListener('resize', resize);
  window.addEventListener('chroma-canvas-resize', resize);
  document.addEventListener('visibilitychange', draw); resize();
  return {
    update(next) {params = {...params, ...next}; draw();}, setTime(value) {time = value; draw();}, resize,
    resetView(resetZoom = true) {if(resetZoom){const previous=normalizeViewZoom(params.viewZoom);params.viewZoom=100;if(previous!==100)options.onZoomChange?.(100);}draw();}, setAutoRotate() {}, getVideoFormats() {return [];},
    exportVideo() {return Promise.reject(new Error('简化预览不支持视频，请在支持 3D 的设备重试'));},
    exportPNG(width, height) {return new Promise((resolve, reject) => {
      if (!ctx) return reject(new Error('此设备无法创建画布'));
      const ratio = Math.min(1, Math.sqrt(1000000 / (width * height)));
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); draw();
      canvas.toBlob(blob => {resize(); blob ? resolve(blob) : reject(new Error('图片编码失败'));}, 'image/png');
    });},
    dispose() {disposed = true; if (observer) observer.disconnect(); else window.removeEventListener('resize', resize); window.removeEventListener('chroma-canvas-resize', resize); document.removeEventListener('visibilitychange', draw); canvas.remove(); notice.remove();}
  };
}
