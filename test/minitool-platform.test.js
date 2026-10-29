import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlatform } from '../src/minitool-platform.js';

class MockReader {
  readAsDataURL(blob) {
    blob.arrayBuffer().then(bytes => {
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(bytes).toString('base64')}`;
      this.onload();
    });
  }
}
function fixture(version = 9490001) {
  const cache = new Map(), files = new Map(), calls = [];
  const api = {
    async getStorage({key}) { return {data: cache.get(key) || null}; },
    async setStorage({key,data}) { cache.set(key,data); },
    async getFileStorageInfo() { return {usedBytes:0,limitBytes:10000,writeChunkMaxBytes:8}; },
    async writeFile({filePath,data}) { const bytes=Buffer.from(data,'base64');files.set(filePath,bytes);calls.push(['write',bytes.length]);return {writtenBytes:bytes.length}; },
    async appendFile({filePath,data}) { const bytes=Buffer.from(data,'base64');files.set(filePath,Buffer.concat([files.get(filePath),bytes]));calls.push(['append',bytes.length]);return {writtenBytes:bytes.length}; },
    async unlink({filePath}) {files.delete(filePath);},
    async writeTempFile({data}) { calls.push(['temp',data]);return {filePath:'native-temp-handle'}; },
    async saveImageToPhotosAlbum({filePath}) {calls.push(['album',filePath]);},
  };
  const env = {FileReader:MockReader,xhs:{miniTool:api,launchOptions:{miniToolEnv:{buildVersion:version,userDataPath:'native-root'}}},localStorage:{getItem(){throw Error('fallback not allowed');},setItem(){throw Error('fallback not allowed');}}};
  return {env,api,files,cache,calls};
}
test('native storage is version gated, snapshots values and never falls back on native failure',async()=>{
  const f=fixture();const p=await createPlatform(f.env);
  const value={x:1};const pending=p.write('key',value);value.x=2;await pending;
  assert.deepEqual(await p.read('key'),{x:1});
  f.api.setStorage=async()=>{throw {errMsg:'quota rejected'};};
  await assert.rejects(p.write('key',3),/quota rejected/);
});
test('unknown version uses guarded legacy storage; async launch options supports native version',async()=>{
  const f=fixture();delete f.env.xhs.launchOptions;
  f.api.getLaunchOptions=async()=>({miniToolEnv:{buildVersion:9462004}});
  const p=await createPlatform(f.env);assert.equal(p.version,9462);await p.write('a',[1]);assert.deepEqual(await p.read('a'),[1]);
  const legacy=await createPlatform({localStorage:{getItem:()=>'{"x":1}',setItem(){throw Error('denied');}}});
  assert.deepEqual(await legacy.read('a'),{x:1});await assert.rejects(legacy.write('a',{}),/denied/);assert.deepEqual(await legacy.listVideos(),[]);
});
test('MP4 files use dynamic aligned chunks and survive adapter reload through the index',async()=>{
  const f=fixture();const p=await createPlatform(f.env);const bytes=Buffer.from('12345678901234567');
  const saved=await p.saveVideo(new Blob([bytes],{type:'video/mp4'}));
  assert.deepEqual(f.files.get(saved.path),bytes);assert.deepEqual(f.calls,[['write',6],['append',6],['append',5]]);
  assert.deepEqual((await (await createPlatform(f.env)).listVideos()).map(v=>v.path),[saved.path]);
  await p.deleteVideo(saved.path);assert.equal(f.files.size,0);assert.deepEqual(await p.listVideos(),[]);
});
test('save rollback removes partial files when index commit fails',async()=>{
  const f=fixture();const p=await createPlatform(f.env);
  f.api.setStorage=async()=>{throw {errMsg:'index unavailable'};};
  await assert.rejects(p.saveVideo(new Blob(['0123456789'],{type:'video/mp4'})),/index unavailable/);
  assert.equal(f.files.size,0);
});
test('quota, unsupported types and versions reject before file writes',async()=>{
  const f=fixture();const p=await createPlatform(f.env);
  await assert.rejects(p.saveVideo(new Blob(['x'],{type:'video/webm'})),/MP4/);
  f.api.getFileStorageInfo=async()=>({usedBytes:100,limitBytes:100,writeChunkMaxBytes:6});
  await assert.rejects(p.saveVideo(new Blob(['x'],{type:'video/mp4'})),/空间不足/);assert.equal(f.files.size,0);
  assert.equal((await createPlatform(fixture(9489999).env)).canSaveVideo,false);
});
test('album save uses native temporary handle and exposes permission failure',async()=>{
  const f=fixture();const p=await createPlatform(f.env);await p.saveImage(new Blob(['png'],{type:'image/png'}));
  assert.deepEqual(f.calls[1],['album','native-temp-handle']);
  f.api.saveImageToPhotosAlbum=async()=>{throw {errMsg:'permission denied'};};
  await assert.rejects(p.saveImage(new Blob(['png'],{type:'image/png'})),/permission denied/);
  await assert.rejects((await createPlatform(fixture(9419999).env)).saveImage(new Blob(['png'],{type:'image/png'})),/9.42/);
});
test('window coordinates set insets and native button clearance without overriding viewport',async()=>{
  const f=fixture();const vars=new Map();f.env.document={documentElement:{style:{setProperty:(key,value)=>vars.set(key,value)}}};
  f.api.getWindowInfo=async()=>({windowWidth:390,windowHeight:800,safeArea:{top:44,left:0,right:390,bottom:766},menuButtons:{back:{bottom:88},share:null}});
  await (await createPlatform(f.env)).applyWindowInfo();assert.equal(vars.get('--safe-area-inset-bottom'),'34px');assert.equal(vars.get('--native-menu-bottom'),'88px');assert.equal(vars.has('--app-height'),false);
});
test('missing native buttons retain safe top clearance',async()=>{
  const f=fixture();const vars=new Map();f.env.document={documentElement:{style:{setProperty:(k,v)=>vars.set(k,v)}}};
  f.api.getWindowInfo=async()=>({windowWidth:390,windowHeight:800,safeArea:{top:44,left:0,right:390,bottom:766},menuButtons:{back:null,me:null,share:null}});
  await (await createPlatform(f.env)).applyWindowInfo();assert.equal(vars.get('--native-menu-bottom'),'44px');
});
test('delete index rejection retains file; retry removes both',async()=>{
  const f=fixture();const p=await createPlatform(f.env);const saved=await p.saveVideo(new Blob(['mp4'],{type:'video/mp4'}));
  const set=f.api.setStorage;f.api.setStorage=async()=>{throw Error('storage unavailable');};
  await assert.rejects(p.deleteVideo(saved.path),/storage unavailable/);assert.equal(f.files.has(saved.path),true);
  f.api.setStorage=set;await p.deleteVideo(saved.path);assert.equal(f.files.size,0);assert.deepEqual(await p.listVideos(),[]);
});
test('delete file rejection restores index and reports a failed rollback explicitly',async()=>{
  const f=fixture();const p=await createPlatform(f.env);const saved=await p.saveVideo(new Blob(['mp4'],{type:'video/mp4'}));
  f.api.unlink=async()=>{throw Error('file locked');};
  await assert.rejects(p.deleteVideo(saved.path),/file locked/);assert.equal((await p.listVideos())[0].path,saved.path);
  const set=f.api.setStorage;let count=0;f.api.setStorage=async args=>{if(++count===2)throw Error('rollback unavailable');return set(args);};
  await assert.rejects(p.deleteVideo(saved.path),/列表恢复失败.*native-root/);assert.equal(f.files.has(saved.path),true);
});
