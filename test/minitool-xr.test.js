import test from 'node:test';
import assert from 'node:assert/strict';
import { WebGLBackground } from 'three/src/renderers/webgl/WebGLBackground.js';
import { Color, Scene, Texture, SRGBColorSpace } from 'three';
import { WebXRManager } from '../src/minitool-xr.js';
import { build } from 'esbuild';
import { minitoolThreePlugin } from '../scripts/minitool-three-plugin.mjs';
import vm from 'node:vm';

// Exercise the real Three background pass against the adapter actually emitted
// by the minitool build, without replacing the failing method with a test mock.
async function builtXR() {
  const result = await build({stdin:{contents:'export { WebXRManager } from "three/src/renderers/webxr/WebXRManager.js";',resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',target:['es2017','chrome61'],plugins:[minitoolThreePlugin()]});
  const module = {exports:{}};
  vm.runInNewContext(result.outputFiles[0].text,{module,exports:module.exports});
  return new module.exports.WebXRManager();
}
function backgroundHarness(xr) {
  const calls=[];
  const renderer={xr,outputColorSpace:SRGBColorSpace,getRenderTarget:()=>null,autoClear:true,autoClearColor:true,autoClearDepth:true,autoClearStencil:true,clear:(...args)=>calls.push(args)};
  const state={buffers:{color:{setClear(){},setMask(){}},depth:{setTest(){},setMask(){}}}};
  const textures={get:texture=>texture};
  return {background:WebGLBackground(renderer,textures,textures,state,{update(){}},false,false),calls};
}
test('offline adapter has the same no-session blend mode as Three',()=>{
  const xr=new WebXRManager();
  assert.equal(xr.enabled,false);assert.equal(xr.isPresenting,false);
  assert.equal(xr.getEnvironmentBlendMode(),undefined);
});
test('built adapter allows actual Three background pass for solid, gradient texture and empty scenes',async()=>{
  const {background,calls}=backgroundHarness(await builtXR());
  const scene=new Scene();
  for(const value of [new Color('#d9dafa'),new Texture(),null]){
    scene.background=value;
    assert.doesNotThrow(()=>background.render(scene));
  }
  assert.equal(calls.length,3);
  background.dispose();
});
test('regression reproducer: old incomplete adapter fails during normal 3D background rendering',()=>{
  const {background}=backgroundHarness({enabled:false,isPresenting:false});
  assert.throws(()=>background.render(new Scene()),/getEnvironmentBlendMode/);
});
