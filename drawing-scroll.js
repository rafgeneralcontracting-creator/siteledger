(function(){
  let controller=null;
  const q=id=>document.getElementById(id);
  const isMobile=()=>matchMedia('(pointer:coarse)').matches;
  function canSwitch(){
    if(window.siteLedgerDrawingContext?.().pageLoading)return false;
    if(window.siteLedgerDrawingContext?.().hasDraft||q('sl_markup_session_bar')||q('sl_rfi_session_bar')){
      alert('Finish or cancel your measurement or markup before switching views.');return false;
    }
    return true;
  }
  function preview(ctx,data,width,height,paper){
    if(!data?.sheet)return;
    window.siteLedgerRenderTakeoffs?.(ctx,data.sheet,data.measurements,width,height);
    for(const mark of data.markups){
      if(['freehand','highlight'].includes(mark.markup_type))window.siteLedgerRenderDrawingStroke?.(ctx,mark,width,height);
      else if(['cloud','arrow','text'].includes(mark.markup_type))window.siteLedgerRenderRfiMarkup?.(ctx,mark,width,height);
      else if(['note','rfi'].includes(mark.markup_type)){
        const g=mark.geometry||{},pin=document.createElement('div');pin.className='sl-scroll-pin';
        pin.style.left=(Math.max(0,Math.min(1,Number(g.x_ratio)||0))*100)+'%';pin.style.top=(Math.max(0,Math.min(1,Number(g.y_ratio)||0))*100)+'%';
        pin.textContent=mark.markup_type==='rfi'?(mark.reference_no||'RFI'):[mark.title||'Note',mark.content||''].filter(Boolean).join(': ');
        paper.appendChild(pin);
      }
    }
  }
  async function pageData(drawing,n){
    const current=window.siteLedgerDrawingContext?.();
    const sheet=current?.drawing?.id===drawing.id&&current.page===n&&current.sheet?current.sheet:(await rest(`drawing_sheets?select=*&drawing_id=eq.${drawing.id}&page_number=eq.${n}&limit=1`))[0];
    if(!sheet)return {sheet:null,measurements:[],markups:[]};
    const [measurements,markups]=await Promise.all([
      current?.sheet?.id===sheet.id?Promise.resolve(current.measurements):rest(`drawing_measurements?select=*&drawing_sheet_id=eq.${sheet.id}&order=created_at.asc`),
      rest(`drawing_markups?select=*&drawing_sheet_id=eq.${sheet.id}&order=created_at.asc`)
    ]);
    return {sheet,measurements,markups};
  }
  function create(pdf,drawing){
    const wrap=q('sl_canvas_wrap'),stage=q('sl_canvas_stage');
    const state={pdf,drawing,wrap,stage,rows:[],active:false,current:1,wanted:new Set(),generation:0,running:0,frame:null,switching:false,transition:0,select:null,button:null};
    function valid(row,generation){return controller===state&&state.active&&state.generation===generation&&state.wanted.has(row.n)}
    function label(){if(state.select)state.select.value=String(state.current)}
    function release(row){
      row.cancelRender?.();row.task?.cancel();
      if(row.canvas){row.canvas.width=row.canvas.height=0;row.canvas.remove();row.canvas=null}
      row.paper.querySelectorAll('.sl-scroll-pin').forEach(p=>p.remove());row.rendered=false;
      if(!row.error)row.status.textContent='';
    }
    function raster(width,ratio){
      const maxPixels=isMobile()?1500000:2500000,scale=Math.min(2,window.devicePixelRatio||1,Math.sqrt(maxPixels/Math.max(1,width*width*ratio)),4096/Math.max(width,width*ratio));
      return {width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(width*ratio*scale))};
    }
    function size(row,ratio){
      const anchor=state.rows[state.current-1],anchorTop=anchor?.card.offsetTop||0;
      row.ratio=ratio;row.paper.style.height=Math.max(40,Math.round(row.width*ratio))+'px';
      // Preserve the sheet under the user's eyes when an earlier mixed-size page is measured.
      if(anchor&&row.n<state.current)wrap.scrollTop+=anchor.card.offsetTop-anchorTop;
      schedule();
    }
    async function render(row,seed=null){
      row.loading=true;state.running++;const generation=state.generation;let cancel;const cancelled=new Promise(resolve=>{cancel=()=>resolve(null)});row.cancelRender=cancel;
      const metadata=pageData(drawing,row.n).then(value=>({value}),error=>({error}));
      row.status.textContent='Loading page…';
      try{
        const page=await Promise.race([pdf.getPage(row.n),cancelled]);if(!page||!valid(row,generation))return;
        const base=page.getViewport({scale:1});size(row,base.height/base.width);
        const pixels=raster(row.width,row.ratio),canvas=document.createElement('canvas');canvas.className='sl-scroll-canvas';canvas.setAttribute('aria-label','Drawing page '+row.n);
        canvas.width=pixels.width;canvas.height=pixels.height;row.canvas=canvas;row.paper.prepend(canvas);
        const ctx=canvas.getContext('2d',{alpha:false});
        if(seed&&seed.width)ctx.drawImage(seed,0,0,canvas.width,canvas.height);
        else{
          const task=page.render({canvasContext:ctx,viewport:page.getViewport({scale:pixels.width/base.width})});row.task=task;
          try{await task.promise}finally{if(row.task===task)row.task=null}
        }
        if(!valid(row,generation))return;
        const result=await Promise.race([metadata,cancelled]);if(!result||!valid(row,generation))return;
        if(result.value){preview(ctx,result.value,canvas.width,canvas.height,row.paper);row.status.textContent=''}
        else row.status.textContent='Markup preview unavailable. Open this page to review.';
        row.rendered=true;row.error=false;
      }catch(error){
        if(valid(row,generation)&&error?.name!=='RenderingCancelledException'){
          row.error=true;release(row);row.status.textContent='Could not load this page. ';const retry=document.createElement('button');retry.className='sl-scroll-retry';retry.textContent='Retry';retry.onclick=e=>{e.stopPropagation();row.error=false;pump()};row.status.appendChild(retry);
        }
      }finally{
        if(!valid(row,generation))release(row);
        row.cancelRender=null;row.loading=false;state.running--;pump();
      }
    }
    function pump(){
      if(!state.active||state.switching)return;
      const limit=isMobile()?1:2;
      const pending=state.rows.filter(row=>state.wanted.has(row.n)&&!row.loading&&!row.rendered&&!row.error).sort((a,b)=>Math.abs(a.n-state.current)-Math.abs(b.n-state.current));
      for(const row of pending){if(state.running>=limit)break;const current=window.siteLedgerDrawingContext?.(),seed=current?.drawing?.id===drawing.id&&current.page===row.n&&current.sheet?q('sl_pdf_canvas'):null;render(row,seed).catch(console.error)}
    }
    function find(y){
      let lo=0,hi=state.rows.length-1;
      while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(state.rows[mid].card.offsetTop<=y)lo=mid;else hi=mid-1}return lo;
    }
    function update(){
      if(!state.active||!state.rows.length)return;
      const first=find(wrap.scrollTop),last=find(wrap.scrollTop+wrap.clientHeight),current=find(wrap.scrollTop+wrap.clientHeight*.4);
      state.current=current+1;label();
      const nearby=[];for(let n=Math.max(1,first);n<=Math.min(pdf.numPages,last+2);n++)nearby.push(n);
      state.wanted=new Set(nearby.sort((a,b)=>Math.abs(a-state.current)-Math.abs(b-state.current)).slice(0,isMobile()?7:9));
      for(const row of state.rows)if(!state.wanted.has(row.n)&&(row.canvas||row.task))release(row);
      pump();
    }
    function schedule(){if(state.frame!==null)return;state.frame=requestAnimationFrame(()=>{state.frame=null;update()})}
    async function stop(){
      state.active=false;state.generation++;
      if(state.frame!==null)cancelAnimationFrame(state.frame);state.frame=null;
      const pending=[];for(const row of state.rows){row.cancelRender?.();if(row.task){row.task.cancel();pending.push(row.task.promise.catch(()=>{}))}}
      await Promise.all(pending);
      for(const row of state.rows)release(row);
      state.list?.remove();state.rows=[];state.wanted.clear();state.list=null;
      document.body.classList.remove('sl-scroll-active');stage.style.display='';
    }
    async function start(n=1){
      if(!canSwitch())return false;
      const transition=++state.transition;await stop();if(controller!==state||transition!==state.transition||!q('sl_canvas_wrap'))return false;
      state.active=true;state.current=n;state.generation++;window.cancelDrawingTool?.();window.closeTakeoffDrawer?.();
      stage.style.display='none';document.body.classList.add('sl-scroll-active');
      const list=document.createElement('div');list.className='sl-scroll-list';state.list=list;wrap.appendChild(list);
      const width=Math.max(80,Math.min(1400,wrap.clientWidth-20)),context=window.siteLedgerDrawingContext?.(),ratio=context?.viewport?context.viewport.height/context.viewport.width:.7;
      list.style.width=width+'px';const fragment=document.createDocumentFragment();
      for(let page=1;page<=pdf.numPages;page++){
        const card=document.createElement('article');card.className='sl-scroll-sheet';card.dataset.page=String(page);
        const header=document.createElement('div');header.className='sl-scroll-sheet-head';
        const number=document.createElement('b');number.textContent='Page '+page;
        const button=document.createElement('button');button.className='sl-scroll-open';button.textContent='Open page';button.setAttribute('aria-label','Open page '+page+' to zoom, measure or mark up');button.onclick=()=>state.single(page);
        header.append(number,button);
        const paper=document.createElement('div');paper.className='sl-scroll-paper';paper.setAttribute('role','button');paper.setAttribute('aria-label','Open drawing page '+page);paper.tabIndex=0;paper.onclick=()=>state.single(page);paper.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();state.single(page)}};
        const status=document.createElement('span');status.className='sl-scroll-page-status';paper.appendChild(status);card.append(header,paper);fragment.appendChild(card);
        const row={n:page,card,paper,status,width,ratio,loading:false,rendered:false,error:false,task:null,canvas:null};paper.style.height=Math.max(40,Math.round(width*ratio))+'px';state.rows.push(row);
      }
      list.appendChild(fragment);wrap.scrollTop=Math.max(0,state.rows[n-1].card.offsetTop);wrap.scrollLeft=0;state.button.textContent='Single page';label();
      update();return true;
    }
    state.single=async n=>{
      if(state.switching||!canSwitch())return;
      state.switching=true;state.transition++;n=Math.max(1,Math.min(pdf.numPages,Number(n)||state.current));
      try{
        await stop();if(controller!==state)return;
        wrap.scrollTop=wrap.scrollLeft=0;state.current=n;state.button.textContent='Scroll pages';label();
        await window.selectDrawingPage(n,true);
      }finally{state.switching=false}
    };
    state.jump=n=>{
      n=Math.max(1,Math.min(pdf.numPages,Number(n)||1));
      if(state.active){state.current=n;wrap.scrollTop=state.rows[n-1].card.offsetTop;label();update()}
      else if(canSwitch())window.selectDrawingPage(n).catch(console.error);
    };
    state.install=()=>{
      const label=q('sl_page_label'),parent=label?.parentNode;if(!parent)return;
      label.style.display='none';const select=document.createElement('select');select.id='sl_page_select';select.className='sl-page-select';select.setAttribute('aria-label','Jump to drawing page');
      for(let n=1;n<=pdf.numPages;n++){const option=document.createElement('option');option.value=String(n);option.textContent=`Page ${n} of ${pdf.numPages}`;select.appendChild(option)}
      select.onchange=()=>state.jump(select.value);parent.insertBefore(select,label);state.select=select;
      if(pdf.numPages>1){const button=document.createElement('button');button.id='sl_drawing_view_mode';button.className='sl-view-mode';button.textContent='Scroll pages';button.onclick=()=>{if(state.active)state.single(state.current);else if(!state.switching)start(window.siteLedgerDrawingContext?.().page||1).catch(console.error)};q('sl_page_label').closest('.sl-viewbar')?.appendChild(button);state.button=button}
      wrap.addEventListener('scroll',schedule,{passive:true});
    };
    state.start=start;state.stop=stop;state.resize=()=>{if(state.active&&!state.switching)start(state.current).catch(console.error)};
    state.destroy=async()=>{state.transition++;wrap.removeEventListener('scroll',schedule);await stop()};
    return state;
  }
  const previous=window.prevDrawingPage,next=window.nextDrawingPage;
  window.prevDrawingPage=()=>controller?.active?controller.jump(controller.current-1):previous();
  window.nextDrawingPage=()=>controller?.active?controller.jump(controller.current+1):next();
  window.siteLedgerDrawingScroll={
    get active(){return !!controller?.active},
    async mount(pdf,drawing){
      if(controller)await controller.destroy();const state=create(pdf,drawing);controller=state;state.install();
      // Workspace sizing and existing tool initialization run before the browsing view.
      await new Promise(resolve=>requestAnimationFrame(resolve));if(controller!==state||route?.screen!=='drawing'||route.drawingId!==drawing.id)return;
      if(pdf.numPages>1)await state.start(1);
    },
    async destroy(){const state=controller;controller=null;if(state)await state.destroy()}
  };
  window.addEventListener('sl:drawing-page',()=>{if(controller&&!controller.active){controller.current=window.siteLedgerDrawingContext?.().page||1;if(controller.select)controller.select.value=String(controller.current)}});
  let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>controller?.resize(),180)});
})();
