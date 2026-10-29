import { build } from 'esbuild';
import { mkdir, rm, writeFile, copyFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
execFileSync(process.execPath,['scripts/check-preset-assets.mjs'],{stdio:'inherit'});
const out=resolve(root,'dist-minitool');
await rm(out,{recursive:true,force:true});
await mkdir(resolve(out,'assets'),{recursive:true});
const { minitoolThreePlugin }=await import('./minitool-three-plugin.mjs');
await build({entryPoints:['src/minitool-main.js'],outfile:resolve(out,'assets/app.js'),bundle:true,loader:{'.png':'file'},assetNames:'[name]-[hash]',publicPath:'./assets',format:'iife',target:['es2017','chrome61'],minify:true,legalComments:'none',sourcemap:false,plugins:[minitoolThreePlugin()],logLevel:'info'});
await copyFile('public/favicon.svg',resolve(out,'favicon.svg'));
await writeFile(resolve(out,'index.html'),`<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"><meta name="theme-color" content="#090a0b"><title>CHROMA · 形色实验室</title><link rel="icon" type="image/svg+xml" href="./favicon.svg"><link rel="stylesheet" href="./assets/app.css"></head><body><div id="app" role="main">正在准备画布…</div><script src="./assets/app.js"></script></body></html>`);
execFileSync(process.execPath,['scripts/check-minitool.mjs'],{stdio:'inherit'});
execFileSync('python3',['scripts/audit-artifact.py',out],{stdio:'inherit'});
await mkdir('artifacts',{recursive:true});
const zip=resolve(root,'artifacts/chroma-minitool.zip');
await rm(zip,{force:true});
execFileSync('zip',['-q','-r',zip,'.'],{cwd:out,stdio:'inherit'});
execFileSync('python3',['scripts/audit-artifact.py',zip],{stdio:'inherit'});
console.log(`ZIP: ${zip} (${(await stat(zip)).size} bytes)`);
