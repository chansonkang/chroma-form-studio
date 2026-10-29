import { readFile,readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const dir='dist-minitool';
const html=await readFile(`${dir}/index.html`,'utf8');
const js=await readFile(`${dir}/assets/app.js`,'utf8');
assert.match(html,/viewport-fit=cover/);
assert.match(html,/<html lang="zh-CN">/);
assert.doesNotMatch(html,/<base\b|<iframe\b|<object\b|type=["']module|\son\w+=|http-equiv=["']Content-Security-Policy|(?:src|href)=["'](?:https?:|\/)/i);
const scriptTags=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
assert.ok(scriptTags.length>0);for(const tag of scriptTags){assert.match(tag[1],/src=["']\.\//);assert.equal(tag[2].trim(),'');}
for(const match of html.matchAll(/(?:src|href)=["'](\.\/[^"']+)/g)){await readFile(`${dir}/${match[1].slice(2)}`);}
// Fail on callable prohibited APIs, not on inert WebGL enum names or SVG namespace strings.
const banned=[/\bfetch\s*\(/,/\bXMLHttpRequest\b/,/new\s+(?:Worker|SharedWorker|WebSocket|EventSource|RTCPeerConnection|Function)\s*\(/,/\beval\s*\(/,/WebAssembly\s*\./,/\.requestFullscreen\s*\(/,/\.exitFullscreen\s*\(/,/\.webkitRequestFullscreen\s*\(/,/window\.(?:open|prompt)\s*\(/,/navigator\.(?:clipboard|geolocation|bluetooth|usb|hid|serial|credentials|locks|serviceWorker|xr)\b/,/\.getBattery\s*\(/,/\.getDisplayMedia\s*\(/,/\.enumerateDevices\s*\(/,/\.download\s*=/,/target=["']_blank/,/type=["']module/,/\bimport\s*\(/];
for(const pattern of banned)assert.doesNotMatch(js,pattern,`Forbidden capability: ${pattern}`);
const allowed=/\.(?:html|css|js|png|jpe?g|gif|webp|svg|woff2?|json)$/i;
async function walk(path){for(const item of await readdir(path,{withFileTypes:true})){const name=`${path}/${item.name}`;if(item.isDirectory())await walk(name);else assert.match(name,allowed);}}
await walk(dir);
const presetImages=(await readdir(`${dir}/assets`)).filter(name=>/^(soft-candy|prism-bloom|sunset-orbit|lime-totem)-.*\.png$/.test(name));
assert.equal(presetImages.length,4,'Four preset images must ship in the ZIP');
for(const name of presetImages)assert.ok(js.includes('./assets/'+name),`Missing relative image reference: ${name}`);
execFileSync(process.execPath,['--check',`${dir}/assets/app.js`]);
console.log('PASS: entry, relative assets, classic script, syntax, extension and prohibited API scan. CSS/GPU/runtime contracts require separate review.');
