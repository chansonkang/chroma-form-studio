export function normalizeViewZoom(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(Math.max(40, Math.min(400, value))) : 100;
}

// Share one camera value between OrbitControls gestures and the workbench.
export function bindViewZoom(camera, controls, initial, onChange = () => {}) {
  let percent = normalizeViewZoom(initial);
  function changed() {
    const next = normalizeViewZoom(camera.zoom * 100);
    if (next === percent) return;
    percent = next;
    onChange(next);
  }
  function apply(value, notify = false) {
    const next = normalizeViewZoom(value), previous = percent;
    percent = next;
    camera.zoom = next / 100;
    camera.updateProjectionMatrix();
    controls.update();
    if (notify && previous !== next) onChange(next);
    return next;
  }
  controls.addEventListener('change', changed);
  apply(percent);
  return { apply, dispose() {controls.removeEventListener('change', changed);} };
}
