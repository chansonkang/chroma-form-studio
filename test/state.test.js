import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaults, sanitizeParams, presets } from '../src/state.js';

test('import clamps geometry to supported ranges and rejects unsafe values', () => {
  const p = sanitizeParams({petals:1e8,layers:-3,twist:Infinity,grain:NaN,background:'url(javascript:evil)',shape:'invalid',palette:'invalid'});
  assert.equal(p.petals,32);assert.equal(p.layers,1);assert.equal(p.twist,defaults.twist);
  assert.equal(p.grain,defaults.grain);assert.equal(p.background,defaults.background);
  assert.equal(p.shape,'flower');assert.equal(p.palette,defaults.palette);
});
test('exported parameter data round-trips all presets without loss', () => {
  for(const preset of presets) assert.deepEqual(sanitizeParams(JSON.parse(JSON.stringify(preset.params))),preset.params);
});
test('fractional counts become integers and malformed documents fail', () => {
  assert.equal(sanitizeParams({petals:6.7,layers:2.2}).petals,7);
  assert.equal(sanitizeParams({petals:6.7,layers:2.2}).layers,2);
  for(const input of [null,[], 'bad']) assert.throws(()=>sanitizeParams(input));
});

test('view zoom survives parameter round trips and old projects retain 100 percent framing', () => {
  assert.equal(sanitizeParams({}).viewZoom,100);
  assert.equal(sanitizeParams({viewZoom:-50}).viewZoom,40);
  assert.equal(sanitizeParams({viewZoom:999}).viewZoom,400);
  assert.equal(sanitizeParams({viewZoom:NaN}).viewZoom,100);
  const params=sanitizeParams({viewZoom:175});
  assert.equal(sanitizeParams(JSON.parse(JSON.stringify(params))).viewZoom,175);
});
