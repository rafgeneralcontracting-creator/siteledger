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
      else if(paper&&['note','rfi'].includes(mark.markup_type)){
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
    const state={pdf,drawing,wrap,stage,rows:[],active:false,current:1,wanted:new Set(),generation:0,running:0,frame:null,switching:false,transition:0,select:null,button:null,zoom:1,baseWidth:400,zoomTimer:null,pinch:null,gesturing:false,editing:false,lastZoomPage:1,lastTap:0,lastTapPoint:null,fitMode:'width',zoomFrame:null,pendingZoom:null};
    function valid(row,generation,token){return controller===state&&state.active&&state.generation===generation&&state.wanted.has(row.n)&&(token===undefined||row.token===token)}
    function label(){if(state.select)state.select.value=String(state.current);if(state.active&&q('sl_zoom_label')){const button=q('sl_zoom_label');button.textContent=state.fitMode==='width'?'Width':state.fitMode==='page'?'Page':Math.round(state.zoom*100)+'%';button.setAttribute('aria-label','Drawing view: '+Math.round(state.zoom*100)+' percent. Open zoom and fit options');}}
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
      state.active=false;state.generation++;state.pinch=null;state.gesturing=false;wrap.classList.remove('sl-is-pinching');clearTimeout(state.zoomTimer);state.zoomTimer=null;cancelAnimationFrame(state.zoomFrame);state.zoomFrame=null;state.pendingZoom=null;
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
      const baseWidth=Math.max(80,Math.min(1400,wrap.clientWidth)),width=baseWidth*state.zoom,context=window.siteLedgerDrawingContext?.(),ratio=context?.viewport?context.viewport.height/context.viewport.width:.7;
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
      list.appendChild(fragment);wrap.scrollTop=Math.max(0,state.rows[n-1].card.offsetTop-48);wrap.scrollLeft=0;if(anchor)restorePoint(anchor);label();
      update();return true;
    }
    function pointAnchor(x=wrap.clientWidth/2,y=wrap.clientHeight/2){
      const docY=wrap.scrollTop+y,row=state.rows[find(docY)];if(!row)return null;
      const head=row.card.children[0]?.offsetHeight||0,pageTop=row.card.offsetTop+head;
      const localY=Math.max(0,Math.min(row.paper.offsetHeight,docY-pageTop));
      const localX=Math.max(0,Math.min(row.width,wrap.scrollLeft+x-(state.list?.offsetLeft||0)));
      return {n:row.n,x:localX/Math.max(1,row.width),y:localY/Math.max(1,row.paper.offsetHeight),px:x,py:y};
    }
    function restorePoint(anchor){
      const row=state.rows[anchor.n-1];if(!row)return;
      const head=row.card.children[0]?.offsetHeight||0,pageTop=row.card.offsetTop+head;
      const left=(state.list?.offsetLeft||0)+anchor.x*row.width-anchor.px,top=pageTop+anchor.y*row.paper.offsetHeight-anchor.py;
      const maxLeft=Math.max(0,wrap.scrollWidth-wrap.clientWidth),maxTop=Math.max(0,wrap.scrollHeight-wrap.clientHeight);
      wrap.scrollLeft=Math.max(0,Math.min(maxLeft,left));
      wrap.scrollTop=Math.max(0,Math.min(maxTop,top));
    }
    function cancelRenders(){for(const row of state.rows){if(row.loading){row.token=(row.token||0)+1;row.cancelRender?.();row.task?.cancel()}}}
    function sharp(){clearTimeout(state.zoomTimer);state.zoomTimer=setTimeout(()=>{state.zoomTimer=null;update()},160)}
    state.setZoom=(zoom,anchor=pointAnchor(),sharpen=true)=>{
      if(!state.active||!anchor)return;state.fitMode=null;state.lastZoomPage=anchor.n||state.current;state.zoom=Math.max(.25,Math.min(8,Math.round(zoom*1000)/1000));
      cancelRenders();state.list.style.width=state.baseWidth*state.zoom+'px';
      for(const row of state.rows){row.width=state.baseWidth*state.zoom;row.paper.style.height=Math.max(40,Math.round(row.width*row.ratio))+'px'}
      restorePoint(anchor);label();if(sharpen)sharp();schedule();
    };
    function flushZoom(){
      if(state.zoomFrame!==null)cancelAnimationFrame(state.zoomFrame);state.zoomFrame=null;
      const next=state.pendingZoom;state.pendingZoom=null;
      if(state.list){state.list.style.transform='';state.list.style.transformOrigin='';}
      if(next)state.setZoom(next.zoom,next.anchor,false);
    }
    function queueZoom(zoom,anchor){
      state.pendingZoom={zoom:Math.max(.25,Math.min(8,zoom)),anchor};
      if(state.zoomFrame!==null)return;
      state.zoomFrame=requestAnimationFrame(()=>{
        state.zoomFrame=null;const next=state.pendingZoom,pinch=state.pinch;if(!next||!pinch||!state.list)return;
        const row=state.rows[pinch.anchor.n-1];if(!row)return;
        // Keep canvas dimensions and native scroll geometry unchanged throughout a pinch.
        const originX=pinch.anchor.x*row.width,originY=row.card.offsetTop+(row.card.children[0]?.offsetHeight||0)+pinch.anchor.y*row.paper.offsetHeight;
        state.list.style.transformOrigin=originX+'px '+originY+'px';
        state.list.style.transform='translate('+(next.anchor.px-pinch.anchor.px)+'px,'+(next.anchor.py-pinch.anchor.py)+'px) scale('+(next.zoom/pinch.zoom)+')';
        const label=q('sl_zoom_label');if(label)label.textContent=Math.round(next.zoom*100)+'%';
      });
    }
    state.fit=async mode=>{
      if(!state.active)return;flushZoom();const row=state.rows[state.current-1];if(!row)return;
      const generation=state.generation;
      if(mode==='page'){const page=await pdf.getPage(row.n);if(!state.active||generation!==state.generation)return;const view=page.getViewport({scale:1});size(row,view.height/view.width);}
      const zoom=mode==='page'?Math.min(1,Math.max(.25,(wrap.clientHeight-116)/(state.baseWidth*row.ratio))):1;
      state.setZoom(zoom,{n:row.n,x:.5,y:mode==='page'?.5:0,px:wrap.clientWidth/2,py:mode==='page'?(wrap.clientHeight-12)/2:56});state.fitMode=mode;label();
    };
    state.single=async n=>{
      if(state.switching||!canSwitch())return false;flushZoom();
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
    function touchStart(event){if(!state.active||event.touches.length!==2)return;flushZoom();state.lastTap=0;const mid=localMid(event.touches);state.gesturing=true;wrap.classList.add('sl-is-pinching');clearTimeout(state.zoomTimer);state.zoomTimer=null;cancelRenders();const anchor=pointAnchor(mid.x,mid.y);state.lastZoomPage=anchor?.n||state.current;state.pinch={distance:distance(event.touches),zoom:state.zoom,anchor}}
    function touchMove(event){
      if(!state.active||!state.pinch||event.touches.length!==2)return;
      event.preventDefault();
      const mid=localMid(event.touches),scale=distance(event.touches)/Math.max(1,state.pinch.distance);
      const anchor={...state.pinch.anchor,px:mid.x,py:mid.y};
      queueZoom(state.pinch.zoom*scale,anchor);
    }
    function touchEnd(event){if(state.pinch&&event.touches.length<2){flushZoom();state.pinch=null;state.gesturing=false;wrap.classList.remove('sl-is-pinching');sharp()}}
    function wheel(event){if(!state.active||(!event.ctrlKey&&!event.metaKey))return;event.preventDefault();const rect=wrap.getBoundingClientRect(),delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?wrap.clientHeight:1);state.setZoom(state.zoom*Math.exp(-Math.max(-120,Math.min(120,delta))*.004),pointAnchor(event.clientX-rect.left,event.clientY-rect.top))}
    function doubleTap(event){
      if(!state.active||event.touches.length!==1)return;
      const now=Date.now(),t=event.touches[0],rect=wrap.getBoundingClientRect(),pt={x:t.clientX-rect.left,y:t.clientY-rect.top};
      if(now-state.lastTap<300&&state.lastTapPoint&&Math.hypot(pt.x-state.lastTapPoint.x,pt.y-state.lastTapPoint.y)<32){
        const anchor=pointAnchor(pt.x,pt.y);
        const target=state.zoom>1.6?1:Math.min(2.5,Math.max(1.8,state.zoom*1.8));
        state.setZoom(target,anchor,true);
        state.lastTap=0;state.lastTapPoint=null;
      }else{state.lastTap=now;state.lastTapPoint=pt}
    }
    let drag=null;
    function panStart(event){if(!state.active||event.pointerType!=='mouse'||event.button!==0||event.target?.closest('button,select,summary,a'))return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:wrap.scrollLeft,top:wrap.scrollTop};wrap.setPointerCapture?.(event.pointerId);wrap.classList.add('sl-is-panning');event.preventDefault();}
    function panMove(event){if(!drag||event.pointerId!==drag.id)return;wrap.scrollLeft=drag.left+drag.x-event.clientX;wrap.scrollTop=drag.top+drag.y-event.clientY;event.preventDefault();schedule();}
    function panEnd(event){if(!drag||event.pointerId!==drag.id)return;drag=null;wrap.classList.remove('sl-is-panning');}
    state.jump=n=>{
      flushZoom();
      n=Math.max(1,Math.min(pdf.numPages,Number(n)||1));
      if(state.active){state.current=n;wrap.scrollTop=Math.max(0,state.rows[n-1].card.offsetTop-48);label();update()}
      else if(canSwitch())window.selectDrawingPage(n).catch(console.error);
    };
    state.install=()=>{
      const label=q('sl_page_label'),parent=label?.parentNode;if(!parent)return;
      label.style.display='none';const select=document.createElement('select');select.id='sl_page_select';select.className='sl-page-select';select.setAttribute('aria-label','Jump to drawing page');
      for(let n=1;n<=pdf.numPages;n++){const option=document.createElement('option');option.value=String(n);option.textContent=`Page ${n} of ${pdf.numPages}`;select.appendChild(option)}
      select.onchange=()=>state.jump(select.value);parent.insertBefore(select,label);state.select=select;
      const button=document.createElement('button');button.id='sl_drawing_done';button.className='sl-drawing-done';button.textContent='Done';button.onclick=()=>state.done().catch(console.error);q('sl_page_label').closest('.sl-viewbar')?.appendChild(button);state.button=button;
      const zoom=q('sl_zoom_label');if(zoom){zoom.onclick=()=>window.openDrawingViewOptions();zoom.title='Zoom and fit options';}
      wrap.addEventListener('scroll',schedule,{passive:true});wrap.addEventListener('wheel',wheel,{passive:false});wrap.addEventListener('touchstart',doubleTap,{passive:true});wrap.addEventListener('touchstart',touchStart,{passive:true});wrap.addEventListener('touchmove',touchMove,{passive:false});wrap.addEventListener('touchend',touchEnd,{passive:true});wrap.addEventListener('touchcancel',touchEnd,{passive:true});
      wrap.addEventListener('pointerdown',panStart);wrap.addEventListener('pointermove',panMove);wrap.addEventListener('pointerup',panEnd);wrap.addEventListener('pointercancel',panEnd);
    };
    state.start=start;state.stop=stop;state.resize=async()=>{if(state.active&&!state.switching){const mode=state.fitMode;await start(state.current,pointAnchor());if(mode&&state.active)await state.fit(mode);}};
    state.destroy=async()=>{state.transition++;drag=null;wrap.classList.remove('sl-is-pinching','sl-is-panning');wrap.removeEventListener('scroll',schedule);wrap.removeEventListener('wheel',wheel);wrap.removeEventListener('touchstart',doubleTap);wrap.removeEventListener('touchstart',touchStart);wrap.removeEventListener('touchmove',touchMove);wrap.removeEventListener('touchend',touchEnd);wrap.removeEventListener('touchcancel',touchEnd);wrap.removeEventListener('pointerdown',panStart);wrap.removeEventListener('pointermove',panMove);wrap.removeEventListener('pointerup',panEnd);wrap.removeEventListener('pointercancel',panEnd);document.body.classList.remove('sl-editing-drawing');await stop()};
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
  window.fitDrawing=()=>controller?.active?controller.fit('width'):originalFit();
  window.fitDrawingPage=()=>controller?.active?controller.fit('page'):originalFit();
  window.setDrawingZoomPercent=percent=>{if(controller?.active)controller.setZoom(Number(percent)/100);};
  window.openDrawingViewOptions=()=>{
    if(!controller?.active){originalFit();return;}
    modal('<h2>Drawing view</h2><p class="small">Pinch to zoom. Drag to pan. Double-tap a detail to zoom in or back out.</p><div class="sl-fit-options"><button class="btn secondary" onclick="closeModal();fitDrawing()">Fit Width</button><button class="btn secondary" onclick="closeModal();fitDrawingPage()">Fit Page</button></div><div class="sl-zoom-presets">'+[50,100,150,200,400,800].map(n=>'<button class="btn secondary" onclick="closeModal();setDrawingZoomPercent('+n+')">'+n+'%</button>').join('')+'</div><button class="btn primary block" onclick="closeModal()">Done</button>');
  };
  for(const name of ['slFieldMarkup','slFieldRfi','slFieldMeasureMenu']){const action=window[name];if(action)window[name]=async function(){if(await window.siteLedgerDrawingScroll.edit())return action.apply(this,arguments)}}
  window.addEventListener('sl:drawing-page',()=>{if(controller&&!controller.active){controller.current=window.siteLedgerDrawingContext?.().page||1;if(controller.select)controller.select.value=String(controller.current)}});
  let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>controller?.resize(),180)});
})();
