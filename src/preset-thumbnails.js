import softCandy from './assets/presets/soft-candy.png';
import prismBloom from './assets/presets/prism-bloom.png';
import sunsetOrbit from './assets/presets/sunset-orbit.png';
import limeTotem from './assets/presets/lime-totem.png';
import { presets, sanitizeParams } from './state.js';

// Real, pre-rendered images ship with both builds. No second WebGL context is
// needed on mobile to show the built-in preset gallery.
const images = [softCandy, prismBloom, sunsetOrbit, limeTotem];
const byParams = new Map(presets.map((preset, index) => [JSON.stringify(sanitizeParams(preset.params)), images[index]]));
export function getPresetThumbnail(params) {
  return byParams.get(JSON.stringify(sanitizeParams(params))) || null;
}
