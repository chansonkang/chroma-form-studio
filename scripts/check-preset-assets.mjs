import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {presets,sanitizeParams} from '../src/state.js';
const root=new URL('../src/assets/presets/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
assert.equal(manifest.presets.length,presets.length,'Regenerate preset assets after adding/removing a preset.');
const hashes=new Set();
for(let i=0;i<presets.length;i++){
 const record=manifest.presets[i];
 assert.equal(record.name,presets[i].name,'Preset name changed; regenerate thumbnails.');
 assert.deepEqual(record.params,sanitizeParams(presets[i].params),`${record.name}: preset parameters changed; render new thumbnails via design/preset-export.`);
 const png=await readFile(new URL(record.file,root));
 assert.equal(png.subarray(1,4).toString(),'PNG');
 assert.equal(png.readUInt32BE(16),manifest.width);assert.equal(png.readUInt32BE(20),manifest.height);
 hashes.add(createHash('sha256').update(png).digest('hex'));
}
assert.equal(hashes.size,presets.length,'Presets must not share duplicated placeholder images.');
console.log(`PASS: ${presets.length} distinct rendered thumbnails match current names and parameters.`);
