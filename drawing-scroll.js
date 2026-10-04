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
    const state={pdf,drawing,wrap,stage,rows:[],active:false,current:1,wanted:new Set(),generation:0,running:0,frame:null,switching:false,transition:0,select:null,button:null,zoom:1,baseWidth:400,zoomTimer:null,pinch:null,gesturing:false,editing:false};
    function valid(row,generation,token){return controller===state&&state.active&&state.generation===generation&&state.wanted.has(row.n)&&(token===undefined||row.token===token)}
    function label(){if(state.select)state.select.value=String(state.current);if(state.active&&q('sl_zoom_label'))q('sl_zoom_label').textContent=state.zoom===1?'Fit':Math.round(state.zoom*100)+'%'}
    function release(row){
      row.cancelRender?.();row.task?.cancel();
      if(row.canvas){row.canvas.width=row.canvas.height=0;row.canvas.remove();row.canvas=null}
      row.paper.querySelectorAll('.sl-scroll-pin').forEach(p=>p.remove());row.rendered=false;
      if(!row.error)row.status.textContent='';
    }
    function raster(width,ratio){
      const maxPixels=state.zoom>1?(isMobile()?4000000:8000000):(isMobile()?1500000:2500000),scale=Math.min(2,window.devicePixelRatio||1,Math.sqrt(maxPixels/Math.max(1,width*width*ratio)),4096/Math.max(width,width*ratio));
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
      row.loading=true;state.running++;const generation=state.generation,token=row.token=(row.token||0)+1;let cancel,buffer=null;
      const cancelled=new Promise(resolve=>{cancel=()=>resolve(null)});row.cancelRender=cancel;
      const metadata=pageData(drawing,row.n).then(value=>({value}),error=>({error}));
      if(!row.canvas)row.status.textContent='Loading page…';
      try{
        const page=await Promise.race([pdf.getPage(row.n),cancelled]);if(!page||!valid(row,generation,token))return;
        const base=page.getViewport({scale:1});size(row,base.height/base.width);
        const width=row.width,pixels=raster(width,row.ratio),canvas=document.createElement('canvas');buffer=canvas;canvas.className='sl-scroll-canvas';canvas.setAttribute('aria-label','Drawing page '+row.n);
        canvas.width=pixels.width;canvas.height=pixels.height;
        const ctx=canvas.getContext('2d',{alpha:false});
        if(seed&&seed.width&&state.zoom===1)ctx.drawImage(seed,0,0,canvas.width,canvas.height);
        else{
          const task=page.render({canvasContext:ctx,viewport:page.getViewport({scale:pixels.width/base.width})});row.task=task;
          try{await task.promise}finally{if(row.task===task)row.task=null}
        }
        if(!valid(row,generation,token))return;
        const result=await Promise.race([metadata,cancelled]);if(!result||!valid(row,generation,token))return;
        row.paper.querySelectorAll('.sl-scroll-pin').forEach(pin=>pin.remove());
        if(result.value){preview(ctx,result.value,canvas.width,canvas.height,row.paper);row.status.textContent=''}
        else row.status.textContent='Markup preview unavailable. Try the Markup tool to review.';
        if(row.canvas){row.canvas.width=row.canvas.height=0;row.canvas.remove()}
        row.canvas=canvas;row.paper.prepend(canvas);buffer=null;row.rendered=true;row.renderWidth=width;row.error=false;
      }catch(error){
        if(valid(row,generation,token)&&error?.name!=='RenderingCancelledException'){
          row.error=true;row.status.textContent='Could not load this page. ';const retry=document.createElement('button');retry.className='sl-scroll-retry';retry.textContent='Retry';retry.onclick=e=>{e.stopPropagation();row.error=false;pump()};row.status.appendChild(retry);
        }
      }finally{
        if(buffer)buffer.width=buffer.height=0;
        if(!valid(row,generation))release(row);
        row.cancelRender=null;row.loading=false;state.running--;pump();
      }
    }
    function pump(){
      if(!state.active||state.switching||state.gesturing||state.zoomTimer!==null)return;
      const limit=isMobile()?1:2;
      const pending=state.rows.filter(row=>state.wanted.has(row.n)&&!row.loading&&(!row.rendered||row.renderWidth!==row.width)&&!row.error).sort((a,b)=>Math.abs(a.n-state.current)-Math.abs(b.n-state.current));
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
      state.wanted=new Set(nearby.sort((a,b)=>Math.abs(a-state.current)-Math.abs(b-state.current)).slice(0,state.zoom>1?(isMobile()?3:5):(isMobile()?7:9)));
      for(const row of state.rows)if(!state.wanted.has(row.n)&&(row.canvas||row.task))release(row);
      pump();
    }
    function schedule(){if(state.frame!==null)return;state.frame=requestAnimationFrame(()=>{state.frame=null;update()})}
    async function stop(){
      state.active=false;state.generation++;state.pinch=null;state.gesturing=false;clearTimeout(state.zoomTimer);state.zoomTimer=null;
      if(state.frame!==null)cancelAnimationFrame(state.frame);state.frame=null;
      const pending=[];for(const row of state.rows){row.cancelRender?.();if(row.task){row.task.cancel();pending.push(row.task.promise.catch(()=>{}))}}
      await Promise.all(pending);
      for(const row of state.rows)release(row);
      state.list?.remove();state.rows=[];state.wanted.clear();state.list=null;
      document.body.classList.remove('sl-scroll-active');stage.style.display='';
    }
    async function start(n=1,anchor=null){
      if(!canSwitch())return false;
      const transition=++state.transition;await stop();if(controller!==state||transition!==state.transition||!q('sl_canvas_wrap'))return false;
      state.active=true;state.editing=false;document.body.classList.remove('sl-editing-drawing');state.current=n;state.generation++;window.cancelDrawingTool?.();window.closeTakeoffDrawer?.();
      stage.style.display='none';document.body.classList.add('sl-scroll-active');
      const list=document.createElement('div');list.className='sl-scroll-list';state.list=list;wrap.appendChild(list);
      const baseWidth=Math.max(80,Math.min(1400,wrap.clientWidth-20)),width=baseWidth*state.zoom,context=window.siteLedgerDrawingContext?.(),ratio=context?.viewport?context.viewport.height/context.viewport.width:.7;
      state.baseWidth=baseWidth;list.style.width=width+'px';const fragment=document.createDocumentFragment();
      for(let page=1;page<=pdf.numPages;page++){
        const card=document.createElement('article');card.className='sl-scroll-sheet';card.dataset.page=String(page);
        const header=document.createElement('div');header.className='sl-scroll-sheet-head';
        const number=document.createElement('b');number.textContent='Page '+page;
        header.appendChild(number);
        const paper=document.createElement('div');paper.className='sl-scroll-paper';paper.setAttribute('aria-label','Drawing page '+page);paper.tabIndex=0;
        const status=document.createElement('span');status.className='sl-scroll-page-status';paper.appendChild(status);card.append(header,paper);fragment.appendChild(card);
        const row={n:page,card,paper,status,width,ratio,loading:false,rendered:false,error:false,task:null,canvas:null};paper.style.height=Math.max(40,Math.round(width*ratio))+'px';state.rows.push(row);
      }
      list.appendChild(fragment);wrap.scrollTop=Math.max(0,state.rows[n-1].card.offsetTop);wrap.scrollLeft=0;if(anchor)restorePoint(anchor);label();
      update();return true;
    }
    function pointAnchor(x=wrap.clientWidth/2,y=wrap.clientHeight/2){
      const row=state.rows[find(wrap.scrollTop+y)];if(!row)return null;
      return {n:row.n,x:(wrap.scrollLeft+x)/Math.max(1,row.width),y:(wrap.scrollTop+y-row.card.offsetTop-row.card.children[0].offsetHeight)/Math.max(1,row.paper.offsetHeight),px:x,py:y};
    }
    function restorePoint(anchor){const row=state.rows[anchor.n-1];if(!row)return;wrap.scrollLeft=Math.max(0,anchor.x*row.width-anchor.px);wrap.scrollTop=Math.max(0,row.card.offsetTop+row.card.children[0].offsetHeight+anchor.y*row.paper.offsetHeight-anchor.py)}
    function cancelRenders(){for(const row of state.rows){if(row.loading){row.token=(row.token||0)+1;row.cancelRender?.();row.task?.cancel()}}}
    function sharp(){clearTimeout(state.zoomTimer);state.zoomTimer=setTimeout(()=>{state.zoomTimer=null;if(state.active&&state.zoom>1.15){state.single(state.current).catch(console.error);return}update()},170)}
    state.setZoom=(zoom,anchor=pointAnchor(),sharpen=true)=>{
      if(!state.active||!anchor)return;state.zoom=Math.max(.5,Math.min(6,Math.round(zoom*1000)/1000));
      cancelRenders();state.list.style.width=state.baseWidth*state.zoom+'px';
      for(const row of state.rows){row.width=state.baseWidth*state.zoom;row.paper.style.height=Math.max(40,Math.round(row.width*row.ratio))+'px'}
      restorePoint(anchor);label();if(sharpen)sharp();schedule();
    };
    state.single=async n=>{
      if(state.switching||!canSwitch())return false;
      state.switching=true;state.transition++;n=Math.max(1,Math.min(pdf.numPages,Number(n)||state.current));
      const anchor=state.active?pointAnchor():null;
      try{
        await stop();if(controller!==state)return false;
        state.editing=true;document.body.classList.add('sl-editing-drawing');wrap.scrollTop=wrap.scrollLeft=0;state.current=n;label();
        const ready=await window.selectDrawingPage(n,true);if(ready===false)return false;
        window.setDrawingViewZoom?.(state.zoom);
        if(anchor&&anchor.n===n){const canvas=q('sl_pdf_canvas');if(canvas){wrap.scrollLeft=Math.max(0,anchor.x*parseFloat(canvas.style.width)-anchor.px);wrap.scrollTop=Math.max(0,anchor.y*parseFloat(canvas.style.height)-anchor.py)}}
        return true;
      }finally{state.switching=false}
    };
    state.done=async()=>{
      if(state.active||state.switching)return;
      let context=window.siteLedgerDrawingContext?.();
      if(context?.hasDraft){if(['area','perimeter','count'].includes(context.mode))await window.finishDrawingTakeoff?.();else{alert('Finish or cancel your measurement before pressing Done.');return}context=window.siteLedgerDrawingContext?.();if(context?.hasDraft)return}
      if(q('sl_rfi_session_bar')){alert('Complete or cancel the RFI markup before pressing Done.');return}
      if(window.siteLedgerDrawingMarkupPending?.()){alert('Wait for your markup to finish saving, then press Done.');return}
      const canvas=q('sl_pdf_canvas'),anchor=canvas?{n:context.page,x:(wrap.scrollLeft+wrap.clientWidth/2)/Math.max(1,parseFloat(canvas.style.width)),y:(wrap.scrollTop+wrap.clientHeight/2)/Math.max(1,parseFloat(canvas.style.height)),px:wrap.clientWidth/2,py:wrap.clientHeight/2}:null;
      state.zoom=context.zoom||state.zoom;window.finishDrawingMarkup?.();window.cancelDrawingTool?.();
      await start(context.page,anchor);
    };
    function localMid(touches){const rect=wrap.getBoundingClientRect();return {x:(touches[0].clientX+touches[1].clientX)/2-rect.left,y:(touches[0].clientY+touches[1].clientY)/2-rect.top}}
    const distance=t=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);
    function touchStart(event){if(!state.active||event.touches.length!==2)return;const mid=localMid(event.touches);state.gesturing=true;clearTimeout(state.zoomTimer);state.zoomTimer=null;cancelRenders();state.pinch={distance:distance(event.touches),zoom:state.zoom,anchor:pointAnchor(mid.x,mid.y)}}
    function touchMove(event){if(!state.active||!state.pinch||event.touches.length!==2)return;event.preventDefault();const mid=localMid(event.touches),anchor={...state.pinch.anchor,px:mid.x,py:mid.y};state.setZoom(state.pinch.zoom*distance(event.touches)/Math.max(1,state.pinch.distance),anchor,false)}
    function touchEnd(event){if(state.pinch&&event.touches.length<2){state.pinch=null;state.gesturing=false;sharp()}}
    function wheel(event){if(!state.active||(!event.ctrlKey&&!event.metaKey))return;event.preventDefault();const rect=wrap.getBoundingClientRect();state.setZoom(state.zoom*(event.deltaY<0?1.12:.89),pointAnchor(event.clientX-rect.left,event.clientY-rect.top))}
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
      const button=document.createElement('button');button.id='sl_drawing_done';button.className='sl-drawing-done';button.textContent='Sheets';button.title='Return to continuous sheet view';button.setAttribute('aria-label','Return to continuous sheet view');button.onclick=()=>state.done().catch(console.error);q('sl_page_label').closest('.sl-viewbar')?.appendChild(button);state.button=button;
      wrap.addEventListener('scroll',schedule,{passive:true});wrap.addEventListener('wheel',wheel,{passive:false});wrap.addEventListener('touchstart',touchStart,{passive:true});wrap.addEventListener('touchmove',touchMove,{passive:false});wrap.addEventListener('touchend',touchEnd,{passive:true});wrap.addEventListener('touchcancel',touchEnd,{passive:true});
    };
    state.start=start;state.stop=stop;state.resize=()=>{if(state.active&&!state.switching)start(state.current,pointAnchor()).catch(console.error)};
    state.destroy=async()=>{state.transition++;wrap.removeEventListener('scroll',schedule);wrap.removeEventListener('wheel',wheel);wrap.removeEventListener('touchstart',touchStart);wrap.removeEventListener('touchmove',touchMove);wrap.removeEventListener('touchend',touchEnd);wrap.removeEventListener('touchcancel',touchEnd);document.body.classList.remove('sl-editing-drawing');await stop()};
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
      await state.start(1);
    },
    async edit(){return controller?.active?controller.single(controller.current):true},
    async resume(){if(controller)await controller.done()},
    async destroy(){const state=controller;controller=null;if(state)await state.destroy()}
  };
  const originalZoom=window.changeDrawingZoom,originalFit=window.fitDrawing;
  window.changeDrawingZoom=delta=>controller?.active?controller.setZoom(controller.zoom+delta):originalZoom(delta);
  window.fitDrawing=()=>controller?.active?controller.setZoom(1):(controller?.editing?(controller.done().catch(console.error),undefined):originalFit());
  for(const name of ['slFieldMarkup','slFieldRfi','slFieldMeasureMenu']){const action=window[name];if(action)window[name]=async function(){if(await window.siteLedgerDrawingScroll.edit())return action.apply(this,arguments)}}
  window.addEventListener('sl:drawing-page',()=>{if(controller&&!controller.active){controller.current=window.siteLedgerDrawingContext?.().page||1;if(controller.select)controller.select.value=String(controller.current)}});
  let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>controller?.resize(),180)});
})();
