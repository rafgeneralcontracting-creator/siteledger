import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=resolve(root,'www');
const config=JSON.parse(await readFile(resolve(root,'capacitor.config.json'),'utf8'));
await rm(out,{recursive:true,force:true}); await mkdir(out,{recursive:true});
let html=await readFile(resolve(root,'index.html'),'utf8');
// Native apps use their installed bundle, never remote application code or a service worker.
html=html.replace(/<script>if\('serviceWorker'[\s\S]*?<\/script>/,'');
html=html.replaceAll('SiteLedger',config.appName).replace('</head>','<link rel="stylesheet" href="native.css"></head>');
html=html.replace('<script defer src="app.js','<script defer src="native.js"></script><script defer src="app.js');
const assets=new Set([...html.matchAll(/(?:src|href)="([^"?#]+)(?:\?[^"#]*)?"/g)].map(m=>m[1]));
for(const asset of assets){
  if(asset==='native.js'||asset==='native.css')continue;
  let content=await readFile(resolve(root,asset),'utf8');
  if(asset.endsWith('.js')){
    for(const phrase of ['Loading SiteLedger…','Sign in to SiteLedger','SiteLedger beta','No SiteLedger profile found.','You were invited to SiteLedger.'])content=content.replaceAll(phrase,phrase.replace('SiteLedger',config.appName));
    content=content.replaceAll('>SiteLedger<','>'+config.appName+'<').replaceAll("||'SiteLedger'","||'"+config.appName+"'").replaceAll("shell('SiteLedger'","shell('"+config.appName+"'").replaceAll('class="logo">SL<','class="logo">RAF<');
    if(asset==='team-management.js')content=content.replaceAll('${location.origin}${location.pathname}','https://rafgeneralcontracting-creator.github.io/siteledger/');
  }
  if(asset==='manifest.webmanifest'){const m=JSON.parse(content);m.name=config.appName;m.short_name='RAF CM';content=JSON.stringify(m,null,2)}
  if(asset==='icon.svg')content=content.replace('font-size="150"','font-size="112"').replace('>SL<','>RAF<');
  if(asset==='lazy-libraries.js')content=content.replaceAll('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/','vendor/').replaceAll('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/','vendor/').replaceAll('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/','vendor/').replaceAll('pdf.worker.min.js','pdf.worker.min.mjs');
  await writeFile(resolve(out,asset),content);
}
await mkdir(resolve(out,'vendor'),{recursive:true});
for(const [from,to] of [['pdfjs-dist/legacy/build/pdf.worker.min.mjs','pdf.worker.min.mjs'],['jspdf/dist/jspdf.umd.min.js','jspdf.umd.min.js'],['jszip/dist/jszip.min.js','jszip.min.js']])await cp(resolve(root,'node_modules',from),resolve(out,'vendor',to));
await cp(resolve(root,'node_modules/pdfjs-dist/cmaps'),resolve(out,'vendor/cmaps'),{recursive:true});
await cp(resolve(root,'node_modules/pdfjs-dist/standard_fonts'),resolve(out,'vendor/standard_fonts'),{recursive:true});
await cp(resolve(root,'node_modules/pdfjs-dist/wasm'),resolve(out,'vendor/wasm'),{recursive:true});
await build({entryPoints:[resolve(root,'mobile/pdf-runtime.mjs')],outfile:resolve(out,'vendor/pdf.min.js'),bundle:true,format:'iife',target:['es2022'],platform:'browser'});
await cp(resolve(root,'mobile/native.css'),resolve(out,'native.css'));
await build({entryPoints:[resolve(root,'mobile/native.js')],outfile:resolve(out,'native.js'),bundle:true,format:'iife',target:['es2022'],platform:'browser'});
await writeFile(resolve(out,'index.html'),html);
console.log('Built installed mobile bundle: '+out);
