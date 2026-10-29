import { bindViewZoom } from './view-zoom.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { getVideoFormats, recordCanvasVideo } from './video-export.js';

const PALETTES = {
  tutorial: ['#1934c7', '#79828c', '#a7b76a', '#eb9b3d', '#df442f'],
  iridescent: ['#423dcc', '#a5a4f4', '#bbce7a', '#efaa4a', '#ec5d99'],
  sunset: ['#503086', '#ad4480', '#e46b69', '#f9a94c', '#f3d099'],
  candy: ['#7958d6', '#afa6eb', '#a2d1d0', '#ecc6a3', '#ec88b1'],
  acid: ['#243c53', '#6e8368', '#a4be59', '#d3df5f', '#f0c448'],
};
const FALLBACK = { shape: 'flower', petals: 15, layers: 3, thickness: 0.27, spacing: 1.04, scale: 1, twist: 0, petalLength: 1.79, petalWidth: 0.75, tilt: 55, gradient: 0.11, phase: 80.6, hue: 0, softness: 0.15, grain: 0.035, speed: 0.5, palette: 'tutorial', background: '#d9dafa', backgroundMode: 'solid', backgroundAngle: 0, backgroundTop: null, backgroundBottom: null, waveAxis: 'y', mappingX: 0, mappingY: 0, mappingZ: 0, mappingScale: 1, seed: 42 };

function createMaterial(params) {
  const uniforms = {
    uPalette: { value: (PALETTES[params.palette] || PALETTES.tutorial).map(color => new THREE.Color(color)) },
    uScale: { value: params.gradient },
    uPhase: { value: params.phase },
    uHue: { value: params.hue / 360 },
    uWaveAxis: { value: new THREE.Vector3(0, 1, 0) },
    uMapping: { value: new THREE.Matrix3() },
    uMappingScale: { value: params.mappingScale },
  };
  return new THREE.ShaderMaterial({
    uniforms,
    toneMapped: false,
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldPosition = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPosition;
      uniform vec3 uPalette[5];
      uniform float uScale, uPhase, uHue, uMappingScale;
      uniform vec3 uWaveAxis;
      uniform mat3 uMapping;
      vec3 hueShift(vec3 color, float hue) {
        vec3 axis = normalize(vec3(1.0));
        float angle = hue * 6.28318530718;
        return clamp(color * cos(angle) + cross(axis, color) * sin(angle) + axis * dot(axis, color) * (1.0 - cos(angle)), 0.0, 1.0);
      }
      void main() {
        // Blender Wave Texture: sine bands, undistorted. All instances sample
        // the same world field, so translating a layer never resets its colors.
        vec3 mappedPosition = uMapping * (vWorldPosition * uMappingScale);
        float axis = dot(mappedPosition, uWaveAxis);
        float factor = 0.5 + 0.5 * sin(axis * uScale * 20.0 + uPhase - 1.57079632679);
        float t = factor * 4.0;
        vec3 color = uPalette[0];
        for (int i=0; i<4; i++) color = mix(color, uPalette[i+1], clamp(t-float(i), 0.0, 1.0));
        gl_FragColor = vec4(hueShift(color, uHue), 1.0);
      }
    `,
  });
}

// Grain is a compositing pass, not painted onto individual petals. Keeping the
// sample pattern stable makes a paused frame and its PNG export deterministic.
const GrainShader = {
  uniforms: { tDiffuse: { value: null }, uGrain: { value: 0.035 }, uSeed: { value: 42 }, uResolution: { value: new THREE.Vector2(1, 1) } },
  vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uGrain, uSeed;
    uniform vec2 uResolution;
    varying vec2 vUv;
    float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+uSeed)*43758.5453);}
    void main(){
      vec4 color=texture2D(tDiffuse,vUv);
      vec2 cell=floor(vUv*uResolution/1.25);
      float grain=(hash(cell)+hash(cell+47.3)-1.0);
      color.rgb += grain*uGrain;
      gl_FragColor=color;
    }
  `,
};

export function createArtRenderer(container, initialParams, options = {}) {
  let params = { ...FALLBACK, ...initialParams }, disposed = false, frame = 0, time = 0, exporting = false;
  let renderer, activeVideoAbort = null;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' }); }
  catch { throw new Error('WebGL 初始化失败，请开启浏览器硬件加速后重试'); }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
  renderer.domElement.setAttribute('aria-label', '由独立椭球花瓣组成的参数化三维花环');
  renderer.domElement.setAttribute('role', 'img');
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(params.background);
  // A 2D scene background stays fixed to the viewport and is included by the
  // compositor at every export resolution; it is not a CSS-only decoration.
  const backgroundCanvas = document.createElement('canvas');
  const backgroundContext = backgroundCanvas.getContext('2d');
  let backgroundTexture = null, backgroundSignature = '';
  function updateBackground(width = container.clientWidth, height = container.clientHeight) {
    const isGradient = params.backgroundMode === 'gradient';
    const top = isGradient ? (params.backgroundTop || params.background) : params.background;
    const bottom = isGradient ? (params.backgroundBottom || params.background) : params.background;
    const aspect = Math.max(width, 1) / Math.max(height, 1);
    const textureWidth = aspect >= 1 ? 1024 : Math.max(1, Math.round(1024 * aspect));
    const textureHeight = aspect >= 1 ? Math.max(1, Math.round(1024 / aspect)) : 1024;
    const angle = ((Number(params.backgroundAngle) || 0) % 360 + 360) % 360;
    const signature = `${top}|${bottom}|${angle}|${textureWidth}x${textureHeight}`;
    if (signature === backgroundSignature) return;
    backgroundSignature = signature;
    if (top.toLowerCase() === bottom.toLowerCase()) {
      scene.background = new THREE.Color(top);
      backgroundTexture?.dispose(); backgroundTexture = null;
      return;
    }
    if (!backgroundContext) throw new Error('浏览器无法创建渐变背景');
    // Match the target aspect so a 45° gradient remains 45° in the viewport
    // and in differently shaped PNG exports. Recreate resized GPU textures.
    if (backgroundCanvas.width !== textureWidth || backgroundCanvas.height !== textureHeight) {
      backgroundTexture?.dispose(); backgroundTexture = null;
      backgroundCanvas.width = textureWidth; backgroundCanvas.height = textureHeight;
    }
    const radians = THREE.MathUtils.degToRad(angle);
    const dx = Math.sin(radians), dy = Math.cos(radians);
    const cx = textureWidth / 2, cy = textureHeight / 2;
    // Project all four corners onto the direction: the two end colors reach
    // the rectangle's opposing extremes, with no unpainted area at any angle.
    const reach = Math.abs(dx) * cx + Math.abs(dy) * cy;
    const gradient = backgroundContext.createLinearGradient(cx - dx * reach, cy - dy * reach, cx + dx * reach, cy + dy * reach);
    gradient.addColorStop(0, top); gradient.addColorStop(1, bottom);
    backgroundContext.fillStyle = gradient;
    backgroundContext.fillRect(0, 0, textureWidth, textureHeight);
    if (!backgroundTexture) {
      backgroundTexture = new THREE.CanvasTexture(backgroundCanvas);
      backgroundTexture.colorSpace = THREE.SRGBColorSpace;
      backgroundTexture.minFilter = THREE.LinearFilter;
      backgroundTexture.magFilter = THREE.LinearFilter;
      backgroundTexture.generateMipmaps = false;
    }
    backgroundTexture.needsUpdate = true;
    scene.background = backgroundTexture;
  }
  const camera = new THREE.OrthographicCamera(-2.3, 2.3, 2.3, -2.3, 0.1, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.09; controls.enablePan = false;
  controls.minZoom = 0.4; controls.maxZoom = 4;
  controls.minPolarAngle = 0.08; controls.maxPolarAngle = Math.PI - 0.08;
  controls.autoRotateSpeed = 0.65;
  const viewZoom = bindViewZoom(camera, controls, params.viewZoom, value => {
    params.viewZoom = value; options.onZoomChange?.(value);
  });
  const sculpture = new THREE.Group(); scene.add(sculpture);
  // Three detail 15 gives 20 × 16² = 5120 triangles, the same density
  // as the tutorial’s Blender Ico Sphere subdivision level 5.
  const geometry = new THREE.IcosahedronGeometry(1, 15);
  const material = createMaterial(params);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.12, 0.55, 0.65); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grain = new ShaderPass(GrainShader); composer.addPass(grain);
  const basis = new THREE.Matrix4(), rotation = new THREE.Matrix4(), orientation = new THREE.Quaternion();
  const mappingRotation = new THREE.Matrix4(), mappingStep = new THREE.Matrix4();
  const tangent = new THREE.Vector3(), radial = new THREE.Vector3(), vertical = new THREE.Vector3(0, 1, 0);
  let viewHeight = 4.3, minimumViewWidth = 3.4;

  function stack() {
    sculpture.clear();
    for (let layer = 0; layer < params.layers; layer++) {
      const ring = new THREE.Group(); ring.userData.layer = layer;
      for (let petal = 0; petal < params.petals; petal++) {
        const mesh = new THREE.Mesh(geometry, material); mesh.userData.petal = petal; ring.add(mesh);
      }
      sculpture.add(ring);
    }
    arrange();
  }
  function arrange() {
    // Rotate Instances in Blender rotates each ellipsoid around its own local
    // tangent X axis. It does not rotate the complete stack or deform a torus.
    // Tutorial timeline: 120 frames at 24 fps, one full local rotation.
    // The caller supplies speed-adjusted time; do not apply speed a second time.
    const animatedTilt = params.tilt + (time % 5) * 360 / 5;
    sculpture.scale.setScalar(params.scale);
    sculpture.children.forEach((ring, layer) => {
      ring.position.y = (layer - (params.layers - 1) * 0.5) * params.spacing;
      ring.rotation.y = THREE.MathUtils.degToRad(layer * params.twist);
      ring.children.forEach((mesh, index) => {
        const angle = index / params.petals * Math.PI * 2;
        const radius = params.shape === 'star' ? 1 + 0.12 * (index % 2 ? -1 : 1) : 1;
        mesh.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
        tangent.set(-Math.sin(angle), 0, Math.cos(angle)); radial.set(Math.cos(angle), 0, Math.sin(angle));
        // Local Y is the curve normal (radial), and local Z starts vertical.
        basis.makeBasis(tangent, radial, vertical);
        rotation.makeRotationX(THREE.MathUtils.degToRad(animatedTilt)); basis.multiply(rotation);
        orientation.setFromRotationMatrix(basis); mesh.quaternion.copy(orientation);
        if (params.shape === 'ring') mesh.scale.setScalar(params.thickness);
        else mesh.scale.set(params.thickness * params.petalWidth, params.thickness, params.thickness * params.petalLength);
      });
    });
    material.uniforms.uPhase.value = params.phase;
  }
  function setProjection(aspect) {
    // Fit both dimensions, including the 9:16 portrait canvas. This preserves
    // the orthographic framing across resize without cropping the outer petals.
    const height = Math.max(viewHeight, minimumViewWidth / aspect);
    camera.left = -height * aspect / 2; camera.right = height * aspect / 2;
    camera.top = height / 2; camera.bottom = -height / 2; camera.updateProjectionMatrix();
  }
  function resetView(resetZoom = true) {
    const effectiveLength = params.shape === 'ring' ? 1 : params.petalLength;
    const effectiveWidth = params.shape === 'ring' ? 1 : params.petalWidth;
    const totalHeight = ((params.layers - 1) * params.spacing + params.thickness * effectiveLength * 2) * params.scale;
    viewHeight = Math.max(4.15, totalHeight * 1.18);
    const ringRadius = params.shape === 'star' ? 1.12 : 1;
    const petalRadius = params.thickness * Math.max(1, effectiveWidth, effectiveLength);
    minimumViewWidth = (ringRadius + petalRadius) * 2 * params.scale * 1.12;
    controls.target.set(0, 0, 0);
    camera.position.set(0, 10 * Math.sin(Math.PI / 9), 10 * Math.cos(Math.PI / 9));
    params.viewZoom = viewZoom.apply(resetZoom ? 100 : params.viewZoom, resetZoom);
    setProjection(Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1));
  }
  function resize() {
    if (disposed || exporting) return;
    const width = Math.max(container.clientWidth, 1), height = Math.max(container.clientHeight, 1);
    renderer.setSize(width, height, false); composer.setSize(width, height);
    setProjection(width / height);
    updateBackground(width, height);
    grain.uniforms.uResolution.value.set(width * renderer.getPixelRatio(), height * renderer.getPixelRatio());
    composer.render();
  }
  function update(next) {
    const previous = params; params = { ...params, ...next };
    params.viewZoom = viewZoom.apply(params.viewZoom);
    if (previous.layers !== params.layers || previous.petals !== params.petals) stack(); else arrange();
    material.uniforms.uPalette.value = (PALETTES[params.palette] || PALETTES.tutorial).map(color => new THREE.Color(color));
    material.uniforms.uScale.value = params.gradient; material.uniforms.uPhase.value = params.phase; material.uniforms.uHue.value = params.hue / 360;
    material.uniforms.uWaveAxis.value.set(params.waveAxis === 'x' ? 1 : 0, !['x', 'z'].includes(params.waveAxis) ? 1 : 0, params.waveAxis === 'z' ? 1 : 0);
    // Scale first, then rotate the shared coordinates around X, Y, and Z.
    // The zero-rotation / unit-scale mapping is exactly the previous field.
    mappingRotation.makeRotationZ(THREE.MathUtils.degToRad(params.mappingZ));
    mappingRotation.multiply(mappingStep.makeRotationY(THREE.MathUtils.degToRad(params.mappingY)));
    mappingRotation.multiply(mappingStep.makeRotationX(THREE.MathUtils.degToRad(params.mappingX)));
    material.uniforms.uMapping.value.setFromMatrix4(mappingRotation);
    material.uniforms.uMappingScale.value = params.mappingScale;
    updateBackground();
    bloom.strength = params.softness * 0.4; bloom.radius = 0.55;
    grain.uniforms.uGrain.value = params.grain; grain.uniforms.uSeed.value = params.seed;
    if (previous.layers !== params.layers) resetView(false);
  }
  function setTime(seconds) { if (exporting) return; time = Number.isFinite(seconds) ? seconds : 0; arrange(); }
  async function withExportFrame(width, height, operation) {
    if (disposed) throw new Error('画布已关闭');
    if (exporting) throw new Error('已有导出正在进行，请等待完成或取消后重试。');
    width = Math.round(Number(width)); height = Math.round(Number(height));
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width > 8192 || height > 8192) throw new Error('导出尺寸须在 1–8192 像素之间');
    const savedSize = renderer.getSize(new THREE.Vector2()), savedRatio = renderer.getPixelRatio();
    const savedProjection = { left: camera.left, right: camera.right, top: camera.top, bottom: camera.bottom };
    const savedTime = time, savedControls = { enabled: controls.enabled, autoRotate: controls.autoRotate };
    exporting = true; controls.enabled = false; controls.autoRotate = false;
    try {
      renderer.setPixelRatio(1); renderer.setSize(width, height, false);
      composer.setPixelRatio(1); composer.setSize(width, height);
      const currentWidth = camera.right - camera.left, currentHeight = camera.top - camera.bottom;
      const exportHeight = Math.max(currentHeight, currentWidth / (width / height));
      camera.left = -exportHeight * width / height / 2; camera.right = -camera.left;
      camera.top = exportHeight / 2; camera.bottom = -camera.top; camera.updateProjectionMatrix();
      updateBackground(width, height);
      grain.uniforms.uResolution.value.set(width, height); composer.render();
      return await operation();
    } finally {
      // Disposal may be requested while the encoder is running. In that case
      // its abort handler has stopped all tracks; never touch disposed GL state.
      exporting = false;
      if (!disposed) {
        try {
          time = savedTime; arrange();
          renderer.setPixelRatio(savedRatio); renderer.setSize(savedSize.x, savedSize.y, false);
          composer.setPixelRatio(savedRatio); composer.setSize(savedSize.x, savedSize.y);
          Object.assign(camera, savedProjection); camera.updateProjectionMatrix();
          updateBackground(savedSize.x, savedSize.y);
          grain.uniforms.uResolution.value.set(savedSize.x * savedRatio, savedSize.y * savedRatio);
          composer.render();
        } finally { Object.assign(controls, savedControls); }
      }
    }
  }
  async function exportPNG(width = 2048, height = 2048) {
    return withExportFrame(width, height, () => new Promise((resolve, reject) => renderer.domElement.toBlob(blob => blob ? resolve(blob) : reject(new Error('浏览器未能编码 PNG')), 'image/png')));
  }
  async function exportVideo({ width = 720, height = 1280, duration = 5, fps = 24, startTime = 0, speed = 1, mimeType, onProgress, signal } = {}) {
    if (!Number.isFinite(startTime) || !Number.isFinite(speed) || speed <= 0) throw new Error('视频起始时间或速度无效。');
    if (signal?.aborted) throw new DOMException('视频导出已取消', 'AbortError');
    return withExportFrame(width, height, async () => {
      const abortController = new AbortController(); activeVideoAbort = abortController;
      const forwardAbort = () => abortController.abort();
      signal?.addEventListener('abort', forwardAbort, { once: true });
      if (signal?.aborted) abortController.abort();
      try {
        return await recordCanvasVideo(renderer.domElement, {
          duration, fps, mimeType, onProgress, signal: abortController.signal,
          renderFrame: elapsed => { time = startTime + elapsed * speed; arrange(); composer.render(); },
        });
      } finally {
        signal?.removeEventListener('abort', forwardAbort);
        if (activeVideoAbort === abortController) activeVideoAbort = null;
      }
    });
  }
  const observer = new ResizeObserver(resize); observer.observe(container);
  function render() { if (disposed) return; frame = requestAnimationFrame(render); if (!exporting) { controls.update(); composer.render(); } }
  function dispose() {
    disposed = true; activeVideoAbort?.abort(); cancelAnimationFrame(frame); observer.disconnect(); viewZoom.dispose(); controls.dispose(); geometry.dispose(); material.dispose();
    bloom.dispose(); grain.dispose(); composer.dispose(); backgroundTexture?.dispose(); renderer.dispose(); renderer.domElement.remove();
  }
  stack(); update(params); resetView(false); resize(); render();
  return { update, setTime, resize, exportPNG, exportVideo, getVideoFormats, dispose, resetView, setAutoRotate: enabled => { controls.autoRotate = Boolean(enabled); } };
}
