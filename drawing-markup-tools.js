(function(){
  const q=id=>document.getElementById(id);
  let sheet=null, marks=[], previewMarks=null, active=false, tool='pen', color='#dc2626';
  let stroke=null, rawStroke=null, eraserPath=null, shapeTimer=null, loadingKey='', saving=false;
  const palette=['#dc2626','#2563eb','#16a34a','#f59e0b','#111827'];

  function canvas(){
    const stage=q('sl_canvas_stage'); if(!stage)return null;
    let c=q('sl_markup_layer');
    if(!c){c=document.createElement('canvas');c.id='sl_markup_layer';c.className='sl-drawing-markup-layer';stage.appendChild(c)}
    const pdf=q('sl_pdf_canvas');
    if(pdf && (c.width!==pdf.width||c.height!==pdf.height)){
      c.width=pdf.width;c.height=pdf.height;c.style.width=pdf.style.width;c.style.height=pdf.style.height;
    }else if(pdf){c.style.width=pdf.style.width;c.style.height=pdf.style.height}
    return c;
  }
  function point(e){const c=canvas(),r=c.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(e.clientX-r.left)/Math.max(1,r.width))),y:Math.max(0,Math.min(1,(e.clientY-r.top)/Math.max(1,r.height)))}}
  function px(p,w,h){return{x:p.x*w,y:p.y*h}}
  function distPointSeg(p,a,b){const vx=b.x-a.x,vy=b.y-a.y,wx=p.x-a.x,wy=p.y-a.y,d=vx*vx+vy*vy||1,t=Math.max(0,Math.min(1,(wx*vx+wy*vy)/d));return Math.hypot(p.x-(a.x+t*vx),p.y-(a.y+t*vy))}

  function smoothPath(ctx,pts,w,h){
    if(pts.length<2)return;
    const p=pts.map(x=>px(x,w,h));
    ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);
    if(p.length===2){ctx.lineTo(p[1].x,p[1].y)}
    else{
      for(let i=1;i<p.length-1;i++){const m={x:(p[i].x+p[i+1].x)/2,y:(p[i].y+p[i+1].y)/2};ctx.quadraticCurveTo(p[i].x,p[i].y,m.x,m.y)}
      ctx.lineTo(p[p.length-1].x,p[p.length-1].y);
    }
  }
  function drawStroke(ctx,m,w,h){
    const pts=m.geometry?.points||[];if(pts.length<2)return;
    const hi=m.markup_type==='highlight'||m.is_highlighter===true;
    ctx.save();ctx.strokeStyle=m.color||'#dc2626';ctx.lineCap='round';ctx.lineJoin='round';
    ctx.globalAlpha=Number(m.opacity??(hi?.28:1));
    ctx.lineWidth=Math.max(2,Number(m.stroke_width||(hi?18:3))*Math.max(.7,w/1200));
    smoothPath(ctx,pts,w,h);ctx.stroke();ctx.restore();
  }
  function drawEraser(ctx,w,h){
    if(!eraserPath?.length)return;
    const p=eraserPath.map(x=>px(x,w,h)),radius=Math.max(10,Math.min(22,w/95));
    ctx.save();ctx.strokeStyle='rgba(52,64,84,.7)';ctx.fillStyle='rgba(255,255,255,.45)';ctx.lineWidth=1.5;ctx.setLineDash([4,4]);
    if(p.length>1){ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);for(let i=1;i<p.length;i++)ctx.lineTo(p[i].x,p[i].y);ctx.stroke()}
    const a=p[p.length-1];ctx.setLineDash([]);ctx.beginPath();ctx.arc(a.x,a.y,radius,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
  }
  function render(){
    const c=canvas();if(!c)return;const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);
    (previewMarks||marks).forEach(m=>drawStroke(ctx,m,c.width,c.height));
    if(stroke)drawStroke(ctx,stroke,c.width,c.height);
    drawEraser(ctx,c.width,c.height);
    c.style.pointerEvents=active?'auto':'none';c.style.touchAction=active?'none':'pan-x pan-y';
    c.style.cursor=active?(tool==='eraser'?'cell':'crosshair'):'default';
  }

  async function currentSheet(){
    if(!route?.drawingId)return null;
    const page=parseInt(q('sl_page_label')?.textContent||'1',10)||1;
    return (await rest(`drawing_sheets?select=*&drawing_id=eq.${route.drawingId}&page_number=eq.${page}&limit=1`))[0]||null;
  }
  async function load(){
    const s=await currentSheet();if(!s)return;
    sheet=s;marks=await rest(`drawing_markups?select=*&drawing_sheet_id=eq.${s.id}&markup_type=in.(freehand,highlight)&order=created_at.asc`);
    previewMarks=null;render();
  }

  function toolbar(){
    let b=q('sl_markup_session_bar');
    if(!b){b=document.createElement('div');b.id='sl_markup_session_bar';b.className='sl-markup-session-bar';q('sl_canvas_wrap')?.parentNode.insertBefore(b,q('sl_canvas_wrap'))}
    b.innerHTML='<strong>Markup</strong>'+
      `<button class="sl-markup-tool ${tool==='pen'?'active':''}" onclick="setDrawingMarkupTool('pen')">✎ Draw</button>`+
      `<button class="sl-markup-tool ${tool==='highlight'?'active':''}" onclick="setDrawingMarkupTool('highlight')">▰ Highlight</button>`+
      `<button class="sl-markup-tool ${tool==='eraser'?'active':''}" onclick="setDrawingMarkupTool('eraser')">⌫ Eraser</button>`+
      '<button class="sl-markup-tool" onclick="drawingMarkupNote()">T Note</button>'+
      '<span class="sl-markup-colors">'+palette.map(c=>`<button class="sl-markup-color ${c===color?'active':''}" style="--mc:${c}" onclick="setDrawingMarkupColor('${c}')" aria-label="Markup color"></button>`).join('')+'</span>'+
      `<button class="sl-markup-tool" onclick="undoDrawingMarkup()" ${!marks.length?'disabled':''}>Undo</button>`+
      '<button class="sl-markup-done" onclick="finishDrawingMarkup()">Done</button>';
  }

  window.startDrawingMarkup=async function(which='pen'){
    try{window.cancelRfiMarkup?.();window.cancelDrawingTool?.();if(!sheet)await load();if(!sheet)return alert('Drawing sheet is still loading.');
      active=true;tool=which;stroke=null;rawStroke=null;eraserPath=null;previewMarks=null;toolbar();render();document.body.classList.add('sl-drawing-markup-active');
    }catch(e){alert(e?.message||'Could not start markup.')}
  };
  window.setDrawingMarkupTool=function(t){tool=t;stroke=null;rawStroke=null;eraserPath=null;previewMarks=null;clearTimeout(shapeTimer);toolbar();render()};
  window.setDrawingMarkupColor=function(c){color=c;toolbar();render()};
  window.drawingMarkupNote=function(){window.finishDrawingMarkup();window.startDrawingAnnotation?.('note')};
  window.finishDrawingMarkup=function(){active=false;stroke=null;rawStroke=null;eraserPath=null;previewMarks=null;clearTimeout(shapeTimer);q('sl_markup_session_bar')?.remove();document.body.classList.remove('sl-drawing-markup-active');render();document.getElementById('sl_field_pan')?.click()};
  window.cancelDrawingMarkup=window.finishDrawingMarkup;
  window.undoDrawingMarkup=async function(){const m=marks[marks.length-1];if(!m)return;if(!confirm('Remove the last drawing markup?'))return;await rest(`drawing_markups?id=eq.${m.id}`,{method:'DELETE'});marks.pop();toolbar();render()};

  function recognizeShape(pts){
    if(!pts||pts.length<5)return null;
    const c=canvas(),r=c.getBoundingClientRect(),w=r.width,h=r.height,p=pts.map(x=>px(x,w,h));
    const first=p[0],last=p[p.length-1],xs=p.map(x=>x.x),ys=p.map(x=>x.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),bw=maxX-minX,bh=maxY-minY,diag=Math.hypot(bw,bh);
    if(diag<22)return null;
    const chord=Math.hypot(last.x-first.x,last.y-first.y);let sum=0,maxErr=0;
    for(const x of p){const d=distPointSeg(x,first,last);sum+=d;maxErr=Math.max(maxErr,d)}
    if(chord>26 && sum/p.length/Math.max(1,chord)<.035 && maxErr/Math.max(1,chord)<.09){
      return {type:'line',points:[pts[0],pts[pts.length-1]]};
    }
    const closed=Math.hypot(last.x-first.x,last.y-first.y)<Math.max(28,diag*.28);if(!closed||bw<20||bh<20)return null;
    const cx=(minX+maxX)/2,cy=(minY+maxY)/2,ratio=Math.max(bw,bh)/Math.max(1,Math.min(bw,bh));
    const rs=p.map(x=>Math.hypot(x.x-cx,x.y-cy)),avg=rs.reduce((a,b)=>a+b,0)/rs.length,rv=Math.sqrt(rs.reduce((a,b)=>a+(b-avg)*(b-avg),0)/rs.length)/Math.max(1,avg);
    let edge=0;for(const x of p)edge+=Math.min(Math.abs(x.x-minX),Math.abs(x.x-maxX),Math.abs(x.y-minY),Math.abs(x.y-maxY));edge/=p.length*Math.max(1,Math.min(bw,bh));
    if(rv<.19 && ratio<1.5){
      const out=[];for(let i=0;i<=56;i++){const a=i/56*Math.PI*2;out.push({x:(cx+Math.cos(a)*bw/2)/w,y:(cy+Math.sin(a)*bh/2)/h})}
      return {type:'ellipse',points:out,bounds:{minX:minX/w,maxX:maxX/w,minY:minY/h,maxY:maxY/h}};
    }
    if(edge<.14){
      return {type:'rect',points:[{x:minX/w,y:minY/h},{x:maxX/w,y:minY/h},{x:maxX/w,y:maxY/h},{x:minX/w,y:maxY/h},{x:minX/w,y:minY/h}],bounds:{minX:minX/w,maxX:maxX/w,minY:minY/h,maxY:maxY/h}};
    }
    return null;
  }
  function scheduleSnap(){
    clearTimeout(shapeTimer);if(tool!=='pen'||!stroke||stroke.snapped)return;
    shapeTimer=setTimeout(()=>{if(!stroke||tool!=='pen'||stroke.snapped)return;const found=recognizeShape(rawStroke||stroke.geometry.points);if(found){stroke.geometry.points=found.points;stroke.snapped=true;stroke.shapeType=found.type;stroke.shapeBounds=found.bounds||null;try{navigator.vibrate?.(15)}catch(_){}render()}},420);
  }
  function updateSnapped(end){
    if(!stroke?.snapped||!rawStroke?.length)return;
    if(stroke.shapeType==='line'){stroke.geometry.points=[rawStroke[0],end];return}
    if(!stroke.shapeBounds)return;
    const b=stroke.shapeBounds,w=Math.max(.005,Math.abs(end.x-b.minX)),h=Math.max(.005,Math.abs(end.y-b.minY)),minX=Math.min(b.minX,end.x),maxX=Math.max(b.minX,end.x),minY=Math.min(b.minY,end.y),maxY=Math.max(b.minY,end.y);
    if(stroke.shapeType==='rect')stroke.geometry.points=[{x:minX,y:minY},{x:maxX,y:minY},{x:maxX,y:maxY},{x:minX,y:maxY},{x:minX,y:minY}];
    if(stroke.shapeType==='ellipse'){const cx=(minX+maxX)/2,cy=(minY+maxY)/2,out=[];for(let i=0;i<=56;i++){const a=i/56*Math.PI*2;out.push({x:cx+Math.cos(a)*(maxX-minX)/2,y:cy+Math.sin(a)*(maxY-minY)/2})}stroke.geometry.points=out}
  }

  async function saveCurrent(){
    if(!stroke||!sheet||saving)return;const pts=stroke.geometry.points;if(pts.length<2){stroke=null;rawStroke=null;render();return}
    saving=true;
    try{const body={drawing_sheet_id:sheet.id,markup_type:stroke.markup_type,geometry:{points:pts},color:stroke.color,stroke_width:stroke.stroke_width,opacity:stroke.opacity,is_highlighter:stroke.markup_type==='highlight',status:'open',created_by:me.id};
      const rows=await rest('drawing_markups',{method:'POST',body:JSON.stringify(body)});if(rows?.[0])marks.push(rows[0]);
    }catch(e){alert(e?.message||'Could not save markup.')}finally{stroke=null;rawStroke=null;saving=false;toolbar();render()}
  }

  function sampleStroke(pts,stepPx=3){
    const c=canvas(),r=c.getBoundingClientRect(),w=r.width,h=r.height,out=[];
    for(let i=0;i<pts.length-1;i++){const a=px(pts[i],w,h),b=px(pts[i+1],w,h),d=Math.hypot(b.x-a.x,b.y-a.y),n=Math.max(1,Math.ceil(d/stepPx));for(let k=0;k<n;k++){const t=k/n;out.push({x:(a.x+(b.x-a.x)*t)/w,y:(a.y+(b.y-a.y)*t)/h})}}out.push(pts[pts.length-1]);return out;
  }
  function pathDistance(p,path,w,h){
    const pp=px(p,w,h);let d=Infinity;
    for(let i=1;i<path.length;i++)d=Math.min(d,distPointSeg(pp,px(path[i-1],w,h),px(path[i],w,h)));
    return d;
  }
  function erasePreview(){
    if(!eraserPath?.length){previewMarks=null;render();return}
    const c=canvas(),r=c.getBoundingClientRect(),w=r.width,h=r.height,radius=Math.max(8,Math.min(18,w/115)),out=[];
    for(const m of marks){
      const dense=sampleStroke(m.geometry?.points||[],2.5);if(dense.length<2){out.push(m);continue}
      let cur=[];for(const p of dense){if(pathDistance(p,eraserPath,w,h)<=radius){if(cur.length>=2)out.push({...m,id:m.id+'__preview_'+out.length,geometry:{points:cur}});cur=[]}else cur.push(p)}
      if(cur.length>=2)out.push({...m,id:m.id+'__preview_'+out.length,geometry:{points:cur}});
    }
    previewMarks=out;render();
  }
  async function commitEraser(){
    if(!eraserPath?.length){previewMarks=null;eraserPath=null;render();return}
    const c=canvas(),r=c.getBoundingClientRect(),w=r.width,h=r.height,radius=Math.max(8,Math.min(18,w/115)),next=[];
    try{
      for(const m of marks){
        const dense=sampleStroke(m.geometry?.points||[],2.5);if(dense.length<2){next.push(m);continue}
        const pieces=[];let cur=[],hit=false;
        for(const p of dense){if(pathDistance(p,eraserPath,w,h)<=radius){hit=true;if(cur.length>=2)pieces.push(cur);cur=[]}else cur.push(p)}
        if(cur.length>=2)pieces.push(cur);
        if(!hit){next.push(m);continue}
        await rest(`drawing_markups?id=eq.${m.id}`,{method:'DELETE'});
        for(const seg of pieces){
          const body={drawing_sheet_id:sheet.id,markup_type:m.markup_type,geometry:{points:seg},color:m.color,stroke_width:m.stroke_width,opacity:m.opacity,is_highlighter:m.is_highlighter,status:m.status||'open',created_by:me.id};
          const rows=await rest('drawing_markups',{method:'POST',body:JSON.stringify(body)});if(rows?.[0])next.push(rows[0]);
        }
      }
      marks=next;
    }catch(e){alert(e?.message||'Could not erase markup.');await load()}
    previewMarks=null;eraserPath=null;toolbar();render();
  }

  function down(e){
    if(!active)return;const p=point(e);clearTimeout(shapeTimer);
    if(tool==='eraser'){eraserPath=[p];previewMarks=marks;try{e.target.setPointerCapture(e.pointerId)}catch(_){}render();e.preventDefault();return}
    const hi=tool==='highlight';rawStroke=[p];stroke={markup_type:hi?'highlight':'freehand',geometry:{points:[p]},color:hi?(color==='#111827'?'#f59e0b':color):color,stroke_width:hi?20:3,opacity:hi?.28:1,is_highlighter:hi,snapped:false,shapeType:null,shapeBounds:null};
    try{e.target.setPointerCapture(e.pointerId)}catch(_){}scheduleSnap();e.preventDefault();
  }
  function move(e){
    if(!active)return;const p=point(e);
    if(tool==='eraser'&&eraserPath){const last=eraserPath[eraserPath.length-1];if(!last||Math.hypot(p.x-last.x,p.y-last.y)>.0007){eraserPath.push(p);erasePreview()}e.preventDefault();return}
    if(!stroke)return;
    if(stroke.snapped){updateSnapped(p);render();e.preventDefault();return}
    const last=rawStroke[rawStroke.length-1];if(!last||Math.hypot(p.x-last.x,p.y-last.y)>.0007){rawStroke.push(p);stroke.geometry.points=rawStroke.slice();render();scheduleSnap()}e.preventDefault();
  }
  function up(e){
    clearTimeout(shapeTimer);
    if(tool==='eraser'&&eraserPath){eraserPath.push(point(e));erasePreview();commitEraser();e.preventDefault();return}
    if(!active||!stroke)return;const p=point(e);if(stroke.snapped)updateSnapped(p);else{rawStroke.push(p);stroke.geometry.points=rawStroke.slice()}saveCurrent();e.preventDefault();
  }
  function bind(){const c=canvas();if(!c||c.dataset.markupBound)return;c.dataset.markupBound='1';c.onpointerdown=down;c.onpointermove=move;c.onpointerup=up;c.onpointercancel=()=>{clearTimeout(shapeTimer);stroke=null;rawStroke=null;eraserPath=null;previewMarks=null;render()}}

  async function sync(){
    if(route?.screen!=='drawing'||!q('sl_canvas_wrap')){sheet=null;marks=[];previewMarks=null;loadingKey='';return}
    bind();const key=`${route.drawingId}:${q('sl_page_label')?.textContent||''}`;
    if(key!==loadingKey){loadingKey=key;active=false;q('sl_markup_session_bar')?.remove();document.body.classList.remove('sl-drawing-markup-active');await load().catch(console.error)}else render();
  }
  new MutationObserver(()=>requestAnimationFrame(sync)).observe(document.getElementById('app'),{childList:true,subtree:true,attributes:true,attributeFilter:['style']});
  window.addEventListener('resize',()=>requestAnimationFrame(render));sync();
})();