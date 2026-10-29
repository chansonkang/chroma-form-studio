import path from 'node:path';
import {readFile} from 'node:fs/promises';
// Import source modules so unused browser loaders can be tree-shaken. XR is
// explicitly replaced: WebGLRenderer constructs it even in non-XR scenes.
export function minitoolThreePlugin() { return {
  name: 'minitool-three-browser-surface',
  setup(build) {
    build.onResolve({filter: /^three$/}, () => ({path: path.resolve('node_modules/three/src/Three.js')}));
    build.onLoad({filter: /three\/src\/renderers\/webgl\/WebGLTextures\.js$/}, async ({path}) => {
      let contents = await readFile(path, 'utf8');
      if (!contents.includes('let useOffscreenCanvas = false;')) throw new Error('Three texture source changed; re-audit the minitool adapter');
      contents = contents.replace(/\tlet useOffscreenCanvas = false;[\s\S]*?(?=\tfunction resizeImage)/, "\tfunction createCanvas() { return createElementNS('canvas'); }\n\n");
      return {loader: 'js', contents};
    });
    build.onLoad({filter: /three\/src\/renderers\/webxr\/WebXRManager\.js$/}, async () => ({
      loader: 'js', contents: await readFile(new URL('../src/minitool-xr.js', import.meta.url), 'utf8')
    }));
  }
}; }
