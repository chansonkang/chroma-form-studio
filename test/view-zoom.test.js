import test from 'node:test';
import assert from 'node:assert/strict';
import { OrthographicCamera, EventDispatcher } from 'three';
import { bindViewZoom } from '../src/view-zoom.js';
function setup(initial) {
  const camera=new OrthographicCamera(-1,1,1,-1), controls=new EventDispatcher(), changes=[];
  controls.update=()=>controls.dispatchEvent({type:'change'});
  const zoom=bindViewZoom(camera,controls,initial,value=>changes.push(value));
  return {camera,controls,changes,zoom};
}
test('restored workbench zoom applies to projection without a gesture feedback loop',()=>{
  const {camera,changes,zoom}=setup(175);
  assert.equal(camera.zoom,1.75);
  assert.equal(camera.projectionMatrix.elements[0],1.75);
  zoom.apply(250);assert.equal(camera.zoom,2.5);assert.deepEqual(changes,[]);
  zoom.dispose();
});
test('gesture changes notify once per displayed percentage and explicit reset restores 100%',()=>{
  const {camera,controls,changes,zoom}=setup(100);
  camera.zoom=1.456;controls.update();controls.update();
  assert.deepEqual(changes,[146]);
  zoom.apply(100,true);assert.equal(camera.zoom,1);assert.deepEqual(changes,[146,100]);
  zoom.apply(100,true);assert.deepEqual(changes,[146,100]);
  zoom.dispose();camera.zoom=2;controls.update();assert.deepEqual(changes,[146,100]);
});
test('view fitting can reapply current zoom; bad inputs cannot exceed supported bounds',()=>{
  const {camera,zoom}=setup(260);
  camera.left=-5;camera.right=5;zoom.apply(260);assert.equal(camera.zoom,2.6);
  assert.equal(zoom.apply(9999),400);assert.equal(zoom.apply(-1),40);
  assert.equal(zoom.apply(NaN),100);zoom.dispose();
});
