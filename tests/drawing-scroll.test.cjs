const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const flush=async()=>{for(let i=0;i<100;i++)await Promise.resolve()};
function harness({pages=250,mobile=true,hold=false}={}){
  const events=new Map(),frames=new Map(),timers=new Map(),requests=[],rendered=[],previewed=[],selected=[],alerts=[],toolCalls=[];
  let id=0,running=0,peak=0;
  class Element{
    constructor(tag){this.tagName=tag;this.children=[];this.parentNode=null;this.style={};this.dataset={};this.attributes={};this.handlers=new Map();this.className='';this._text='';this.scrollTop=0;this.scrollLeft=0;this.width=0;this.height=0;this.value='';this._clientWidth=0;this._clientHeight=0;this.classList={add:(...names)=>{const all=new Set(this.className.split(' ').filter(Boolean));names.forEach(x=>all.add(x));this.className=[...all].join(' ')},remove:(...names)=>{this.className=this.className.split(' ').filter(x=>!names.includes(x)).join(' ')},contains:n=>this.className.split(' ').includes(n),toggle:(n,on)=>{if(on)this.classList.add(n);else this.classList.remove(n)}}}
    get textContent(){return this._text}set textContent(value){this._text=String(value);for(const c of this.children)c.parentNode=null;this.children=[]}
    get clientWidth(){return this._clientWidth||this.parentNode?.clientWidth||420}get clientHeight(){return this._clientHeight||600}
    get offsetHeight(){if(this.style.height)return parseFloat(this.style.height);if(this.className==='sl-scroll-sheet-head')return 40;return this.children.reduce((sum,c)=>sum+c.offsetHeight,0)}
    get offsetTop(){if(!this.parentNode)return 0;let top=0;for(const c of this.parentNode.children){if(c===this)break;top+=c.offsetHeight+(c.className==='sl-scroll-sheet'?18:0)}return top}
    appendChild(child){if(child.tagName==='fragment'){for(const item of [...child.children])this.appendChild(item);child.children=[];return child}child.remove();child.parentNode=this;this.children.push(child);return child}
    append(...children){children.forEach(c=>this.appendChild(c))}
    prepend(child){child.remove();child.parentNode=this;this.children.unshift(child)}
    insertBefore(child,before){child.remove();child.parentNode=this;this.children.splice(this.children.indexOf(before),0,child)}
    remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(c=>c!==this);this.parentNode=null}}
    setAttribute(n,v){this.attributes[n]=String(v)}
    addEventListener(name,callback){if(!this.handlers.has(name))this.handlers.set(name,[]);this.handlers.get(name).push(callback)}
    removeEventListener(name,callback){this.handlers.set(name,(this.handlers.get(name)||[]).filter(c=>c!==callback))}
    trigger(name,event={}){for(const fn of this.handlers.get(name)||[])fn(event)}
    matches(selector){return selector==='canvas'?this.tagName==='canvas':selector.startsWith('.')?this.classList.contains(selector.slice(1)):this.id===selector.slice(1)}
    querySelectorAll(selector){return this.children.flatMap(c=>[...(c.matches(selector)?[c]:[]),...c.querySelectorAll(selector)])}
    closest(selector){let n=this;while(n){if(n.matches(selector))return n;n=n.parentNode}return null}
    getBoundingClientRect(){return {left:0,top:0,width:this.clientWidth,height:this.clientHeight}}
    getContext(){return new Proxy({canvas:this,drawImage(){},clearRect(){}},{get:(obj,key)=>obj[key]||(()=>{})})}
  }
  const body=new Element('body'),bar=new Element('div');bar.className='sl-viewbar';
  const controls=new Element('div'),label=new Element('span');label.id='sl_page_label';label.textContent='1 / '+pages;controls.appendChild(label);bar.appendChild(controls);body.appendChild(bar);
  const wrap=new Element('div');wrap.id='sl_canvas_wrap';wrap._clientWidth=420;wrap._clientHeight=600;const stage=new Element('div');stage.id='sl_canvas_stage';wrap.appendChild(stage);body.appendChild(wrap);
  const context={drawing:{id:'drawing'},sheet:{id:'sheet1',drawing_id:'drawing',page_number:1,page_width_points:1000,page_height_points:700},page:1,viewport:{width:1000,height:700},measurements:[{id:'measure1'}],hasDraft:false,mode:null,zoom:1};
  const doc={body,querySelectorAll:selector=>body.querySelectorAll(selector),createElement:tag=>new Element(tag),createDocumentFragment:()=>new Element('fragment'),getElementById:id=>[body,...body.querySelectorAll('*')].find(x=>x.id===id)||find(body,id)};
  function find(node,id){if(node.id===id)return node;for(const c of node.children){const out=find(c,id);if(out)return out}return null}
  const pdf={numPages:pages,getPage:async n=>{
    const w=n%2===0?600:1000,h=n%2===0?1000:700;
    return {getViewport:({scale})=>({width:w*scale,height:h*scale}),render:({canvasContext})=>{
      let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});running++;peak=Math.max(peak,running);
      const entry={n,canvas:canvasContext.canvas,cancelled:false,resolve};rendered.push(entry);promise.then(()=>running--,()=>running--);
      const task={promise,cancel(){if(entry.cancelled)return;entry.cancelled=true;const e=Error('cancelled');e.name='RenderingCancelledException';reject(e)}};
      if(!hold)resolve();return task;
    }};
  }};
  const ctx={console,document:doc,Promise,Math,Number,Set,Map,Error,route:{screen:'drawing',drawingId:'drawing'},devicePixelRatio:4,matchMedia:()=>({matches:mobile}),
    requestAnimationFrame(callback){const key=++id;frames.set(key,callback);return key},cancelAnimationFrame(key){frames.delete(key)},setTimeout(callback){const key=++id;timers.set(key,callback);return key},clearTimeout(key){timers.delete(key)},
    addEventListener(name,callback){if(!events.has(name))events.set(name,[]);events.get(name).push(callback)},alert:text=>alerts.push(text),
    siteLedgerDrawingContext:()=>context,changeDrawingZoom(){},fitDrawing(){},setDrawingViewZoom:value=>{context.zoom=value},slFieldMeasureMenu:()=>toolCalls.push({tool:"measure",page:context.page}),slFieldMarkup:()=>{toolCalls.push({tool:"markup",page:context.page});return ctx.startDrawingMarkup?.()},slFieldRfi:()=>toolCalls.push({tool:"rfi",page:context.page}),cancelDrawingTool(){context.hasDraft=false},closeTakeoffDrawer(){},prevDrawingPage:()=>selected.push('previous'),nextDrawingPage:()=>selected.push('next'),
    selectDrawingPage:async(n,force)=>{selected.push({n,force});context.page=n;context.sheet={id:'sheet'+n,page_number:n};context.viewport=n%2===0?{width:600,height:1000}:{width:1000,height:700};for(const cb of events.get('sl:drawing-page')||[])cb()},
    siteLedgerRenderTakeoffs:(canvas,sheet,measurements)=>previewed.push({sheet:sheet.page_number,measurements}),siteLedgerRenderDrawingStroke:(canvas,mark)=>previewed.push({stroke:mark.id}),siteLedgerRenderRfiMarkup:(canvas,mark)=>previewed.push({rfi:mark.id}),
    rest:async query=>{
      requests.push(query);
      if(query.startsWith('drawing_sheets?')){const n=Number(query.match(/page_number=eq\.(\d+)/)[1]);return [{id:'sheet'+n,page_number:n,drawing_id:'drawing',page_width_points:1000,page_height_points:700}]}
      const n=Number(query.match(/drawing_sheet_id=eq\.sheet(\d+)/)?.[1]);
      if(query.startsWith('drawing_measurements?'))return [{id:'measure'+n}];
      return [{id:'note'+n,markup_type:'note',title:'Note on '+n,geometry:{x_ratio:.2,y_ratio:.3}},{id:'stroke'+n,markup_type:'freehand',geometry:{points:[]}},{id:'rfi'+n,markup_type:'cloud',geometry:{}}];
    }};
  ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../drawing-scroll.js'),'utf8'),ctx);
  async function settle(){for(let i=0;i<15;i++){await flush();const pending=[...frames.values()];frames.clear();for(const f of pending)f();if(!frames.size&&i>3){await flush();if(!frames.size)break}}}
  async function mount(){const p=ctx.siteLedgerDrawingScroll.mount(pdf,context.drawing);await settle();await p;await settle()}
  return {ctx,doc,body,wrap,stage,context,requests,rendered,previewed,selected,alerts,toolCalls,frames,timers,settle,mount,async runTimers(){const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn());await settle()},hold:v=>hold=v,peak:()=>peak,running:()=>running,sheets:()=>wrap.querySelectorAll('.sl-scroll-sheet'),canvases:()=>wrap.querySelectorAll('canvas')};
}
async function browsing(){
  const h=harness();await h.mount();
  assert(h.ctx.siteLedgerDrawingScroll.active,'multipage PDFs open in scrolling mode');assert(h.body.classList.contains('sl-scroll-active'));assert.equal(h.stage.style.display,'none');
  assert.equal(h.sheets().length,250,'all pages are reachable through light placeholders');
  assert(h.rendered.length<8,'opening does not render the whole PDF');assert(h.canvases().length<=7);assert.equal(h.peak(),1,'phone rendering is serialized');
  assert(h.previewed.some(p=>p.sheet===1&&p.measurements[0].id==='measure1'),'current sheet uses its own saved takeoffs');
  assert(h.previewed.some(p=>p.stroke==='stroke2'),'nearby sheet renders only its own saved strokes');
  assert.equal(h.sheets()[1].children[1].style.height,'667px','portrait pages use their actual proportions');
  const note=h.sheets()[1].querySelectorAll('.sl-scroll-pin')[0];assert.equal(note.textContent,'Note on 2');
  const select=h.doc.getElementById('sl_page_select');select.value='180';select.onchange();await h.settle();
  assert.equal(select.value,'180');assert(h.rendered.some(r=>r.n===180));assert(h.canvases().length<=7,'far jumps release old canvas buffers');assert(h.rendered.filter(r=>r.n>10&&r.n<170).length===0,'jumping skips intervening page rendering');
  assert(h.rendered.filter(r=>r.cancelled).every(r=>r.canvas.width===0));
  h.ctx.nextDrawingPage();await h.settle();assert.equal(h.doc.getElementById('sl_page_select').value,'181','next button scrolls to next page');
  assert.equal(h.sheets()[180].children[0].children.length,1,"no extra Open page button");
  await h.ctx.slFieldMeasureMenu();await h.settle();assert.equal(h.toolCalls.at(-1).page,181);
  assert(!h.ctx.siteLedgerDrawingScroll.active);assert.equal(h.stage.style.display,'');assert.equal(h.selected.at(-1).n,181);assert(h.selected.at(-1).force,'focused view refreshes the selected sheet');assert.equal(h.canvases().length,0);
  h.context.hasDraft=true;await h.doc.getElementById('sl_drawing_done').onclick();await h.settle();assert.equal(h.alerts.length,1,'unfinished points cannot be silently discarded');assert(!h.ctx.siteLedgerDrawingScroll.active);
  h.context.hasDraft=false;await h.doc.getElementById('sl_drawing_done').onclick();await h.settle();assert(h.ctx.siteLedgerDrawingScroll.active);assert.equal(h.doc.getElementById('sl_page_select').value,'181','returning to scrolling keeps the selected page');
  for(const cb of h.timers.values())cb();h.timers.clear();await h.settle();
  await h.ctx.siteLedgerDrawingScroll.destroy();await h.settle();assert(!h.ctx.siteLedgerDrawingScroll.active);assert.equal(h.canvases().length,0);assert.equal(h.wrap.handlers.get('scroll').length,0,'navigation removes scroll listeners');
  console.log('PASS default scroll, nearby rendering, page selector, focused editing, sheet-specific previews and draft protection');
}
async function cancellation(){
  const h=harness({hold:true});await h.mount();assert.equal(h.running(),1);
  const select=h.doc.getElementById('sl_page_select');select.value='200';select.onchange();await h.settle();
  assert(h.rendered[0].cancelled,'far jump cancels obsolete render');assert(h.rendered.some(r=>r.n===200));assert.equal(h.peak(),1);
  for(const r of h.rendered){assert(r.canvas.width*r.canvas.height<=1500000);assert(Math.max(r.canvas.width,r.canvas.height)<=4096)}
  await h.ctx.siteLedgerDrawingScroll.destroy();await h.settle();assert.equal(h.running(),0);assert.equal(h.canvases().length,0);
  const desktop=harness({mobile:false,hold:true});await desktop.mount();assert.equal(desktop.peak(),2,'desktop rendering has at most two concurrent jobs');await desktop.ctx.siteLedgerDrawingScroll.destroy();await desktop.settle();assert.equal(desktop.running(),0);
  const single=harness({pages:1});await single.mount();assert(single.ctx.siteLedgerDrawingScroll.active,'one-sheet PDFs use direct zoom too');assert.equal(single.sheets().length,1);assert(single.rendered.length>0);await single.ctx.siteLedgerDrawingScroll.destroy();
  console.log('PASS render cancellation, raster memory limits, cleanup and unified one-sheet flow');
}
async function zooming(){
  const h=harness();await h.mount();const paper=h.sheets()[0].children[1],old=h.canvases()[0],count=h.rendered.length;
  h.ctx.changeDrawingZoom(1);await h.settle();assert.equal(paper.style.height,'560px');assert.equal(h.sheets()[1].children[1].style.height,'1333px');assert.equal(h.rendered.length,count,'zoom uses CSS immediately and defers PDF rendering');assert(old.parentNode,'existing canvas remains visible while zooming');
  h.hold(true);await h.runTimers();assert(old.parentNode,'existing canvas stays visible during sharpening');assert.equal(h.running(),1);h.hold(false);for(const r of h.rendered)if(!r.cancelled)r.resolve();await h.settle();
  assert(!old.parentNode,'completed sharp buffer replaces old canvas');assert.equal(old.width,0);
  const touches=(a,b)=>[{clientX:a,clientY:300},{clientX:b,clientY:300}];let prevented=false;const before=h.rendered.length;
  h.wrap.trigger('touchstart',{touches:touches(110,310)});h.wrap.trigger('touchmove',{touches:touches(10,410),preventDefault(){prevented=true}});await h.settle();
  assert(prevented);assert.equal(paper.style.height,'1120px');assert.equal(h.wrap.scrollLeft,630,'pinch preserves the drawing point under the fingers');assert.equal(h.rendered.length,before,'no PDF rendering while fingers are moving');assert(h.ctx.siteLedgerDrawingScroll.active);assert.equal(h.selected.length,0,'pinching never requires page selection');
  h.wrap.trigger('touchend',{touches:[]});await h.runTimers();
  for(const r of h.rendered.filter(r=>r.canvas.width)){assert(r.canvas.width*r.canvas.height<=4000000);assert(Math.max(r.canvas.width,r.canvas.height)<=4096)}assert(h.canvases().length<=3,'zoomed pages use a smaller canvas cache');
  h.wrap.scrollTop=h.sheets()[19].offsetTop;h.wrap.trigger('scroll');await h.settle();assert.equal(h.doc.getElementById('sl_page_select').value,'20');
  await h.ctx.slFieldMarkup();await h.settle();assert.equal(h.toolCalls.at(-1).page,20);assert.equal(h.context.zoom,4,'tool receives the same zoom');
  h.ctx.siteLedgerDrawingMarkupPending=()=>true;await h.ctx.siteLedgerDrawingScroll.resume();assert(!h.ctx.siteLedgerDrawingScroll.active,'Done waits for markup saving');h.ctx.siteLedgerDrawingMarkupPending=()=>false;
  await h.ctx.siteLedgerDrawingScroll.resume();await h.settle();assert(h.ctx.siteLedgerDrawingScroll.active);assert.equal(h.doc.getElementById('sl_page_select').value,'20');assert.equal(h.sheets()[19].children[1].style.height,'2667px','Done preserves zoom');
  h.ctx.fitDrawing();await h.runTimers();assert.equal(h.sheets()[19].children[1].style.height,'667px');
  h.wrap.trigger('wheel',{ctrlKey:true,deltaY:-1,clientX:200,clientY:200,preventDefault(){}});await h.runTimers();assert.equal(h.sheets()[19].children[1].style.height,'747px','trackpad zoom works directly');
  await h.ctx.siteLedgerDrawingScroll.destroy();await h.settle();assert.equal(h.wrap.handlers.get('touchmove').length,0);
  console.log('PASS direct pinch and wheel zoom, deferred sharpening, anchor preservation, correct-sheet tools and return zoom');
}
async function markupTransition(){
  const h=harness();await h.mount();vm.runInContext(fs.readFileSync(path.join(__dirname,'../drawing-markup-tools.js'),'utf8'),h.ctx);await h.settle();
  const select=h.doc.getElementById('sl_page_select');select.value='20';select.onchange();await h.settle();
  await h.ctx.slFieldMarkup();await h.settle();assert(h.doc.getElementById('sl_markup_session_bar'),'automatic page events do not close the new markup session');assert(h.body.classList.contains('sl-drawing-markup-active'));
  await h.ctx.doneDrawingMarkup();await h.settle();assert(!h.doc.getElementById('sl_markup_session_bar'));assert(h.ctx.siteLedgerDrawingScroll.active,'markup Done returns directly to scrolling');assert.equal(select.value,'20');
  await h.ctx.siteLedgerDrawingScroll.destroy();await h.settle();
  console.log('PASS actual markup tool survives page transition and Done returns to browsing');
}
(async()=>{await browsing();await cancellation();await zooming();await markupTransition()})().catch(error=>{console.error(error);process.exitCode=1});
