const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const source=name=>fs.readFileSync(path.join(root,name),'utf8');
const flush=async()=>{for(let i=0;i<100;i++)await Promise.resolve()};
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}};
function environment(){
  const elements=new Map(),timers=new Map(),events=[],renders=[],requests=[],saved=[],destroyed=[];
  let timerId=0,mobile=true,blockRender=false,blockedSheet=null,pdfLoads=0,offlineReads=0;
  function element(id){
    const e={id,style:{},dataset:{},width:0,height:0,clientWidth:416,clientHeight:300,scrollLeft:0,scrollTop:0,textContent:'',innerHTML:'',handlers:{},classList:{add(){},remove(){},toggle(){}},addEventListener(n,f){this.handlers[n]=f},getBoundingClientRect(){return {left:0,top:0,width:parseInt(this.style.width)||416,height:parseInt(this.style.height)||300}},getContext(){return new Proxy({drawImage(){e.paints=(e.paints||0)+1}}, {get:(o,k)=>o[k]||(()=>{})})},querySelectorAll(){return [...elements.values()].filter(x=>x.id.includes('canvas')||x.id==='sl_overlay'||x.id==='sl_markup_layer')}};
    Object.defineProperty(e,'scrollWidth',{get(){return parseInt(elements.get('sl_canvas_stage')?.style.width)||416}});
    Object.defineProperty(e,'scrollHeight',{get(){return parseInt(elements.get('sl_canvas_stage')?.style.height)||300}});
    return e;
  }
  function shell(){elements.clear();for(const id of ['sl_canvas_wrap','sl_canvas_stage','sl_pdf_canvas','sl_overlay','sl_page_label','sl_zoom_label','sl_scale_status','sl_measure_list','sl_tool_actions','sl_markup_layer'])elements.set(id,element(id))}
  const calibration={id:'cal',p1_x:0,p1_y:0,p2_x:100,p2_y:0,known_distance:10,unit:'ft'};
  const pdf={numPages:3,getPage:async number=>{
    const w=number===2?600:1000,h=number===2?1000:600;
    return {view:[0,0,w,h],getViewport:({scale})=>({width:w*scale,height:h*scale}),getOperatorList:async()=>[],render:opts=>{
      const d=deferred(),task={promise:d.promise,cancel(){const e=new Error('cancelled');e.name='RenderingCancelledException';task.cancelled=true;d.reject(e)}};
      renders.push({number,opts,task,resolve:d.resolve});if(!blockRender)d.resolve();return task;
    }};
  },destroy:async()=>destroyed.push('pdf')};
  const ctx={console,URL,Promise,Uint8Array,Math,Number,Date,Set,Map,Error,navigator:{onLine:true},me:{id:'user',organization_id:'org'},route:{screen:'home',projectId:'project'},devicePixelRatio:3,
    matchMedia:()=>({matches:mobile}),requestIdleCallback(){},setTimeout(fn){const id=++timerId;timers.set(id,fn);return id},clearTimeout(id){timers.delete(id)},
    document:{head:{appendChild(){}},createElement:()=>element('buffer'),getElementById:id=>elements.get(id),querySelector(){return null},querySelectorAll(){return []}},
    addEventListener(){},dispatchEvent(e){events.push(e)},CustomEvent:class{constructor(type,opt){this.type=type;this.detail=opt.detail}},
    logout(){ctx.me=null},projectPage:async()=>{},go:async s=>{ctx.route.screen=s;elements.clear()},loading(){},shell,$:id=>elements.get(id),esc:x=>String(x),notice:x=>x,projects:async()=>[{id:'project',name:'Project'}],
    ensureSiteLedgerLibrary:async()=>{},pdfjsLib:{getDocument(){pdfLoads++;return {promise:Promise.resolve(pdf)}}},siteLedgerOfflineDrawing:{bytes:async()=>{offlineReads++;return null}},
    fetch:async()=>({ok:true,json:async()=>({signedURL:'https://storage.test/pdf'})}),SB:'https://storage.test',KEY:'public',token:'token',
    rest:async(p,opt={})=>{
      requests.push(p);
      if(opt.method==='POST'&&p==='drawing_measurements'){const row={id:'measurement',...JSON.parse(opt.body)};saved.push(row);return [row]}
      if(p.startsWith('drawings?'))return [{id:'drawing',project_id:'project',storage_path:'v1.pdf',file_size_bytes:1000,uploaded_at:'now'}];
      if(p.startsWith('drawing_sheets?')){if(blockedSheet)await blockedSheet.promise;const n=Number(p.match(/page_number=eq\.(\d+)/)?.[1]||1);return [{id:'sheet'+n,drawing_id:'drawing',page_number:n,page_width_points:n===2?600:1000,page_height_points:n===2?1000:600}]}
      if(p.startsWith('drawing_calibrations?'))return [calibration];
      return [];
    }};
  ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source('drawing-performance.js'),ctx);vm.runInContext(source('drawings.js'),ctx);
  return {ctx,elements,timers,renders,requests,events,saved,destroyed,pdf,flush,blockRender:v=>blockRender=v,blockSheet:d=>blockedSheet=d,mobile:v=>mobile=v,loads:()=>pdfLoads,offlineReads:()=>offlineReads,async runTimers(){const pending=[...timers.values()];timers.clear();for(const f of pending)f();await flush()}};
}
async function rendering(){
  const e=environment(),c=e.ctx,gate=deferred();e.blockSheet(gate);
  const opening=c.go('drawing','drawing');await flush();
  assert.equal(e.renders.length,1,'first page renders once');
  assert.equal(e.elements.get('sl_pdf_canvas').paints,1,'image appears before metadata finishes');
  assert(e.requests.some(p=>p.startsWith('drawing_sheets?')),'sheet request overlaps rendering');
  gate.resolve();e.blockSheet(null);await opening;
  assert.equal(c.siteLedgerDrawingContext().sheet.id,'sheet1');
  const overlay=e.elements.get('sl_overlay');
  c.startDrawingTool('count');overlay.onclick({clientX:100,clientY:60});
  const before=overlay.width,renderCount=e.renders.length;
  for(let n=0;n<8;n++)c.changeDrawingZoom(.25);
  assert.equal(e.renders.length,renderCount,'zoom is immediate without synchronous PDF renders');
  assert.equal(e.elements.get('sl_markup_layer').style.width,overlay.style.width,'markup scales with the drawing during zoom');
  await e.runTimers();
  assert.equal(e.renders.length,renderCount+1,'a burst of zoom changes sharpens only once');
  assert(overlay.width>before);
  const rect=overlay.getBoundingClientRect();overlay.onclick({clientX:rect.width*.25,clientY:rect.height*.25});await c.finishDrawingTakeoff();
  assert.equal(e.saved[0].points.length,2,'draft points survive zoom');
  assert(Math.abs(e.saved[0].points[1].x-250)<.001,'takeoff remains in original sheet coordinates');
  assert(Math.abs(e.saved[0].points[1].y-150)<.001);
  assert(e.renders.every(r=>r.opts.canvasContext),'all redraws use an off-screen context');
  assert(overlay.width*overlay.height<=2000000,'overlay memory is bounded');
  // Do not blank the displayed image while a slow sharper render is underway.
  e.blockRender(true);const displayed=e.elements.get('sl_pdf_canvas'),oldWidth=displayed.width,oldPaints=displayed.paints;
  c.changeDrawingZoom(.25);await e.runTimers();
  assert.equal(displayed.width,oldWidth);assert.equal(displayed.paints,oldPaints);
  const stale=e.renders.at(-1);e.blockRender(false);await c.nextDrawingPage();
  assert(stale.task.cancelled,'page change cancels an in-flight zoom redraw');
  assert.equal(c.siteLedgerDrawingContext().page,2);assert.equal(c.siteLedgerDrawingContext().sheet.id,'sheet2');
  assert.equal(e.elements.get('sl_page_label').textContent,'2 / 3','stale redraw cannot overwrite new page');
  assert.equal(e.loads(),1);
  const wrap=e.elements.get('sl_canvas_wrap'),touches=[{clientX:100,clientY:120},{clientX:200,clientY:120}],pinchBefore=e.renders.length;
  wrap.handlers.touchstart({touches});
  wrap.handlers.touchmove({touches:[{clientX:50,clientY:120},{clientX:250,clientY:120}],preventDefault(){}});
  assert.equal(e.renders.length,pinchBefore);assert.equal(e.timers.size,0,'no raster work while pinching');
  wrap.handlers.touchend({touches:[]});await e.runTimers();assert.equal(e.renders.length,pinchBefore+1);
  await c.go('drawings','project');await c.go('drawing','drawing');
  assert.equal(e.loads(),1,'reopening uses the parsed document');
  assert.equal(e.offlineReads(),1,'memory hit avoids another offline blob read');
  c.logout();await flush();assert(e.destroyed.length,'logout destroys retained PDFs');
  console.log('PASS rendering, debounced zoom, page cancellation, point alignment, parallel data, reuse and logout');
}
async function boundsAndCache(){
  const e=environment(),p=e.ctx.siteLedgerDrawingPerformance;
  for(const mobile of [true,false])for(const base of [{width:1000,height:600},{width:600,height:1000},{width:12000,height:400},{width:400,height:12000}])for(const zoom of [.5,1,3,6]){
    const v=p.viewport(base,1,zoom,3,mobile);assert(v.width*v.height<=(mobile?8000000:16000000));assert(Math.max(v.width,v.height)<=(mobile?8192:12000));
  }
  let loads=0;const d={id:'A',storage_path:'v1',file_size_bytes:1000};
  const pdf=await p.load(d,()=>{loads++;return 'url'});assert.equal(await p.load(d,()=>{loads++;return 'url'}),pdf);assert.equal(loads,1);
  await p.load({...d,storage_path:'v2'},()=>{loads++;return 'url'});assert.equal(loads,2,'new revision bypasses prior document');
  e.ctx.me={id:'other',organization_id:'org'};await p.load(d,()=>{loads++;return 'url'});assert.equal(loads,3,'other accounts never reuse prior cache');
  p.clear();await flush();
  console.log('PASS landscape/portrait/extreme-page raster bounds, revision invalidation and account isolation');
}
async function libraries(){
  const scripts=[],timers=new Map();let timer=0;
  const c={console,Map,Promise,Error,setTimeout(f){timers.set(++timer,f);return timer},clearTimeout(id){timers.delete(id)},document:{createElement(){return {remove(){}}},head:{appendChild(s){scripts.push(s)}}}};c.window=c;vm.createContext(c);vm.runInContext(source('lazy-libraries.js'),c);
  const a=c.ensureSiteLedgerLibrary('pdf'),b=c.ensureSiteLedgerLibrary('pdf');assert.equal(a,b);assert.equal(scripts.length,1);
  c.pdfjsLib={GlobalWorkerOptions:{}};scripts[0].onload();await a;assert(c.pdfjsLib.GlobalWorkerOptions.workerSrc.includes('3.11.174'));
  const failed=c.ensureSiteLedgerLibrary('zip').catch(e=>e);scripts[1].onerror();assert((await failed).message.includes('try again'));
  const retry=c.ensureSiteLedgerLibrary('zip');assert.equal(scripts.length,3);c.JSZip={};scripts[2].onload();await retry;
  console.log('PASS lazy-library deduplication, pinned worker setup and retry after failure');
}
async function serviceWorker(){
  const listeners={},cache=new Map();let fetches=0,offline=false;
  const c={console,URL,Promise,Map,self:{location:{origin:'https://app.test'},addEventListener(n,f){listeners[n]=f},clients:{claim:async()=>{}},skipWaiting:async()=>{}},caches:{open:async()=>({match:async req=>cache.get(req.url||req),put:async(req,res)=>cache.set(req.url||req,res),add:async()=>{}}),keys:async()=>[],delete:async()=>{}},fetch:async req=>{fetches++;if(offline)throw Error('offline');return {ok:true,type:'basic',url:req.url,clone(){return this}}}};
  vm.createContext(c);vm.runInContext(source('sw.js'),c);
  async function request(url,mode='cors'){let result;const waits=[];listeners.fetch({request:{url,method:'GET',mode},waitUntil(p){waits.push(p)},respondWith(p){result=p}});const value=await result;await Promise.all(waits);return value}
  await request('https://app.test/drawings.js?v=12');await request('https://app.test/drawings.js?v=12');assert.equal(fetches,1,'versioned assets use cache first');
  await request('https://app.test/index.html','navigate');await request('https://app.test/index.html','navigate');assert.equal(fetches,3,'HTML checks for fresh updates');
  assert.equal(await request('https://private.supabase.co/storage/file.pdf'),undefined,'private storage bypasses app cache');
  await request('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');await request('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');assert.equal(fetches,4,'loaded libraries can be reused');
  offline=true;assert((await request('https://app.test/index.html','navigate')).url.endsWith('index.html'));
  await assert.rejects(()=>request('https://app.test/missing.js?v=1'),'scripts must never receive HTML as an offline fallback');
  console.log('PASS service-worker cache-first assets, fresh HTML, library caching and safe offline fallbacks');
}
function startup(){
  const html=source('index.html'),scripts=[...html.matchAll(/<script[^>]*src="([^"]+)"/g)];
  assert(!scripts.some(m=>m[1].startsWith('https://')),'heavy libraries are absent from startup');
  for(const match of scripts){assert(fs.existsSync(path.join(root,match[1].split('?')[0])));new vm.Script(source(match[1].split('?')[0]));if(!match[1].startsWith('lazy-libraries'))assert(match[0].includes('defer'))}
  const shell=JSON.parse(source('sw.js').match(/const SHELL=(.*);/)[1]);for(const match of scripts)assert(shell.includes('./'+match[1]),'shell matches every script version');
  assert(source('drawing-offline.js').includes('siteLedgerDrawingContext'));
  console.log('PASS syntax of every active app script, ordered deferred startup and matching offline shell versions');
}
(async()=>{startup();await libraries();await boundsAndCache();await rendering();await serviceWorker()})().catch(e=>{console.error(e);process.exitCode=1});
