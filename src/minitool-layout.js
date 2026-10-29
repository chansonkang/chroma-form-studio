// Run after document.body exists. No UA sniffing and no device APIs.
export function setupMinitoolLayout() {
  const root = document.documentElement;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;display:flex;flex-direction:column;row-gap:1px;padding:0;border:0';
  probe.appendChild(document.createElement('div'));
  probe.appendChild(document.createElement('div'));
  document.body.appendChild(probe);
  root.classList.toggle('supports-flex-gap', probe.scrollHeight === 1);
  probe.parentNode.removeChild(probe);
  let frame = 0;
  function layout() {
    frame = 0;
    const viewport = window.visualViewport;
    root.style.setProperty('--app-height', Math.round(viewport ? viewport.height : window.innerHeight) + 'px');
    const board = document.querySelector('.artboard');
    const host = document.getElementById('canvas-host');
    if (board && host) {
      const height = Math.max(1, Math.min(board.clientHeight - 74, (board.clientWidth - 30) * 16 / 9));
      host.style.width = (height * 9 / 16) + 'px';
      host.style.height = height + 'px';
      window.dispatchEvent(new Event('chroma-canvas-resize')); 
    }
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(layout); }
  window.addEventListener('resize', schedule);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', schedule);
  window.addEventListener('chroma-layout', schedule);
  // A single queued pass also covers markup added immediately after installation.
  schedule();
  return function dispose() {
    if (frame) cancelAnimationFrame(frame);
    window.removeEventListener('resize', schedule);
    if (window.visualViewport) window.visualViewport.removeEventListener('resize', schedule);
    window.removeEventListener('chroma-layout', schedule);
  };
}
