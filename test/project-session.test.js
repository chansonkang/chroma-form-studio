import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults} from '../src/state.js';
import {PROJECT_KEY,LEGACY_PROJECT_KEY,resolveStartupProject} from '../src/project-session.js';

test('legacy tutorial cache cannot override the approved default on upgrade and remains recoverable',()=>{
  const old={...defaults,petals:15,layers:3,palette:'tutorial',viewZoom:96};
  const before=JSON.stringify(old);
  const session=resolveStartupProject(null,old);
  assert.notEqual(PROJECT_KEY,LEGACY_PROJECT_KEY);
  assert.deepEqual(session.params,defaults);
  assert.deepEqual(session.legacy,old);
  assert.equal(JSON.stringify(old),before);
});
test('new sessions resume edits and keep legacy recovery separate',()=>{
  const current={...defaults,viewZoom:150,layers:4};
  const old={...defaults,palette:'tutorial'};
  assert.deepEqual(resolveStartupProject(current,old),{params:current,legacy:old});
  assert.deepEqual(resolveStartupProject(null,null),{params:{...defaults},legacy:null});
});
