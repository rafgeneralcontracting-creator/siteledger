(function(){
  const q=id=>document.getElementById(id);
  let sheet=null, marks=[], active=false, tool='pen', color='#dc2626', stroke=null, loadingKey='', saving=false, shapeTimer=null, eraserPath=null;
  const palette=['#dc2626','#2563eb','#16a34a','#f59e0b','#111827'];

  function canvas(){
    const stage=q('sl_canvas_stage'); if(!stage)return null;
    let c=q('sl_markup_layer');
    if(!c){ c=document.createElement('canvas'); c.id='sl_markup_layer'; c.className='sl-drawing-markup-layer'; stage.appendChild(c); }
    const pdf=q('sl_pdf_canvas');
    if(pdf && (c.width!==pdf.width || c.height!==pdf.height)){
      c.width=pdf.width; c.height=pdf.height; c.style.width=pdf.style.width; c.style.height=pdf.style.height;
    } else if(pdf){ c.style.width=pdf.style.width; c.style.height=pdf.style.height; }
    return c;
  }
  function point(e){const c=canvas(),r=c.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(e.clientX-r.left)/Math.max(1,r.width))),y:Math.max(0,Math.min(1,(e.clientY-r.top)/Math.max(1,r.height)))}}
  function drawStroke(ctx,m,w,h){
    const pts=m.geometry?.points||[]; if(pts.length<2)return;
    ctx.save(); ctx.strokeStyle=m.color||'#dc2626'; ctx.lineCap='round'; ctx.lineJoin='round';
    const hi=m.markup_type==='highlight'||m.is_highlighter===true;
    ctx.globalAlpha=Number(m.opacity??(hi?.28:1)); ctx.lineWidth=Math.max(2,Number(m.stroke_width|| (hi?18:3))*Math.max(.7,w/1200));
    ctx.beginPath(); ctx.moveTo(pts[0].x*w,pts[0].y*h); for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x*w,pts[i].y*h); ctx.stroke(); ctx.restore();
  }
  function drawEraserPreview(ctx,w,h){
    if(!eraserPath||eraserPath.length<2)return;
    ctx.save(); ctx.globalCompositeOperation='destination-out'; ctx.globalAlpha=1; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.lineWidth=Math.max(18,Math.min(42,w/45));
    ctx.beginPath();ctx.moveTo(eraserPath[0].x*w,eraserPath[0].y*h);for(let i=1;i<eraserPath.length;i++)ctx.lineTo(eraserPath[i].x*w,eraserPath[i].y*h);ctx.stroke();ctx.restore();
    ctx.save();ctx.strokeStyle='rgba(71,84,103,.5)';ctx.setLineDash([4,4]);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(eraserPath[0].x*w,eraserPath[0].y*h);for(let i=1;i<eraserPath.length;i++)ctx.lineTo(eraserPath[i].x*w,eraserPath[i].y*h);ctx.stroke();ctx.restore();
  }
  function render(){
    const c=canvas(); if(!c)return; const ctx=c.getContext('2d'); ctx.clearRect(0,0,c.width,c.height);
    marks.forEach(m=>drawStroke(ctx,m,c.width,c.height)); if(stroke)drawStroke(ctx,stroke,c.width,c.height); drawEraserPreview(ctx,c.width,c.height);
    c.style.pointerEvents=active?'auto':'none'; c.style.touchAction=active?'none':'pan-x pan-y';
  }
  async function currentSheet(){
    if(!route?.drawingId)return null;
    const page=parseInt(q('sl_page_label')?.textContent||'1',10)||1;
    return (await rest(`drawing_sheets?select=*&drawing_id=eq.${route.drawingId}&page_number=eq.${page}&limit=1`))[0]||null;
  }
  async function load(){
    const s=await currentSheet(); if(!s)return;
    sheet=s; marks=await rest(`drawing_markups?select=*&drawing_sheet_id=eq.${s.id}&markup_type=in.(freehand,highlight)&order=created_at.asc`);
    render();
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
    try{
      window.cancelRfiMarkup?.(); window.cancelDrawingTool?.();
      if(!sheet)await load(); if(!sheet)return alert('Drawing sheet is still loading.');
      active=true; tool=which; stroke=null; toolbar(); render(); document.body.classList.add('sl-drawing-markup-active');
    }catch(e){alert(e?.message||'Could not start markup.')}
  };
  window.setDrawingMarkupTool=function(t){tool=t;stroke=null;eraserPath=null;clearTimeout(shapeTimer);toolbar();render()};
  window.setDrawingMarkupColor=function(c){color=c;toolbar();render()};
  window.drawingMarkupNote=function(){window.finishDrawingMarkup();window.startDrawingAnnotation?.('note')};
  window.finishDrawingMarkup=function(){active=false;stroke=null;eraserPath=null;clearTimeout(shapeTimer);q('sl_markup_session_bar')?.remove();document.body.classList.remove('sl-drawing-markup-active');render();document.getElementById('sl_field_pan')?.click()};
  window.cancelDrawingMarkup=window.finishDrawingMarkup;
  window.undoDrawingMarkup=async function(){
    const m=marks[marks.length-1]; if(!m)return;
    if(!confirm('Remove the last drawing markup?'))return;
    await rest(`drawing_markups?id=eq.${m.id}`,{method:'DELETE'}); marks.pop(); toolbar(); render();
  };
  async function saveCurrent(){
    if(!stroke||!sheet||saving)return; const pts=stroke.geometry.points; if(pts.length<2){stroke=null;render();return}
    saving=true;
    try{
      const body={drawing_sheet_id:sheet.id,markup_type:stroke.markup_type,geometry:{points:pts},color:stroke.color,stroke_width:stroke.stroke_width,opacity:stroke.opacity,is_highlighter:stroke.markup_type==='highlight',status:'open',created_by:me.id};
      const rows=await rest('drawing_markups',{method:'POST',body:JSON.stringify(body)}); if(rows?.[0])marks.push(rows[0]);
    }catch(e){alert(e?.message||'Could not save markup.')}finally{stroke=null;saving=false;toolbar();render()}
  }
  function pxPoints(pts){
    const c=canvas(),r=c?.getBoundingClientRect();const w=Math.max(1,r?.width||1),h=Math.max(1,r?.height||1);
    return pts.map(p=>({x:p.x*w,y:p.y*h}));
  }
  function distPointSeg(p,a,b){
    const vx=b.x-a.x,vy=b.y-a.y,wx=p.x-a.x,wy=p.y-a.y,den=vx*vx+vy*vy||1,t=Math.max(0,Math.min(1,(wx*vx+wy*vy)/den));
    return Math.hypot(p.x-(a.x+t*vx),p.y-(a.y+t*vy));
  }
  function shapeFromStroke(pts){
    if(!pts||pts.length<6)return null;
    const p=pxPoints(pts),first=p[0],last=p[p.length-1],xs=p.map(x=>x.x),ys=p.map(x=>x.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),bw=maxX-minX,bh=maxY-minY,diag=Math.hypot(bw,bh);
    if(diag<24)return null;
    const chord=Math.hypot(last.x-first.x,last.y-first.y);
    let maxLineErr=0;for(const x of p)maxLineErr=Math.max(maxLineErr,distPointSeg(x,first,last));
    if(chord>28&&maxLineErr/chord<.055){
      return [pts[0],pts[pts.length-1]];
    }
    const closed=Math.hypot(last.x-first.x,last.y-first.y)<Math.max(24,diag*.22);
    if(!closed||bw<18||bh<18)return null;
    const cx=(minX+maxX)/2,cy=(minY+maxY)/2,rs=p.map(x=>Math.hypot(x.x-cx,x.y-cy)),avg=rs.reduce((a,b)=>a+b,0)/rs.length,rv=Math.sqrt(rs.reduce((a,b)=>a+(b-avg)*(b-avg),0)/rs.length)/Math.max(1,avg);
    let edgeErr=0;for(const x of p)edgeErr+=Math.min(Math.abs(x.x-minX),Math.abs(x.x-maxX),Math.abs(x.y-minY),Math.abs(x.y-maxY));edgeErr/=p.length*Math.max(1,Math.min(bw,bh));
    const c=canvas(),r=c.getBoundingClientRect(),W=r.width,H=r.height;
    if(rv<.16&&Math.max(bw,bh)/Math.max(1,Math.min(bw,bh))<1.35){
      const out=[];for(let i=0;i<=48;i++){const a=i/48*Math.PI*2;out.push({x:(cx+Math.cos(a)*bw/2)/W,y:(cy+Math.sin(a)*bh/2)/H})}return out;
    }
    if(edgeErr<.11){
      return [{x:minX/W,y:minY/H},{x:maxX/W,y:minY/H},{x:maxX/W,y:maxY/H},{x:minX/W,y:maxY/H},{x:minX/W,y:minY/H}];
    }
    return null;
  }
  function scheduleShapeSnap(){
    clearTimeout(shapeTimer);
    if(tool!=='pen'||!stroke||stroke.snapped)return;
    shapeTimer=setTimeout(()=>{if(!stroke||tool!=='pen'||stroke.snapped)return;const snap=shapeFromStroke(stroke.geometry.points);if(snap){stroke.geometry.points=snap;stroke.snapped=true;try{navigator.vibrate?.(18)}catch(_){}render()}},520);
  }
  function nearEraser(p,pathPx,radius){
    const c=canvas(),box=c.getBoundingClientRect(),pp={x:p.x*box.width,y:p.y*box.height};
    for(let i=1;i<pathPx.length;i++)if(distPointSeg(pp,pathPx[i-1],pathPx[i])<=radius)return true;
    return false;
  }
  async function commitEraser(){
    if(!eraserPath||eraserPath.length<2){eraserPath=null;render();return}
    const c=canvas(),box=c.getBoundingClientRect(),ep=eraserPath.map(p=>({x:p.x*box.width,y:p.y*box.height})),radius=Math.max(10,Math.min(24,box.width/90));
    const next=[];
    try{
      for(const m of marks){
        const pts=m.geometry?.points||[];if(pts.length<2){next.push(m);continue}
        const pieces=[];let cur=[];
        for(const p of pts){
          if(nearEraser(p,ep,radius)){if(cur.length>=2)pieces.push(cur);cur=[]}
          else cur.push(p);
        }
        if(cur.length>=2)pieces.push(cur);
        if(pieces.length===1&&pieces[0].length===pts.length){next.push(m);continue}
        await rest(`drawing_markups?id=eq.${m.id}`,{method:'DELETE'});
        for(const seg of pieces){
          const body={drawing_sheet_id:sheet.id,markup_type:m.markup_type,geometry:{points:seg},color:m.color,stroke_width:m.stroke_width,opacity:m.opacity,is_highlighter:m.is_highlighter,status:m.status||'open',created_by:me.id};
          const rows=await rest('drawing_markups',{method:'POST',body:JSON.stringify(body)});if(rows?.[0])next.push(rows[0]);
        }
      }
      marks=next;
    }catch(e){alert(e?.message||'Could not erase markup.');await load()}
    eraserPath=null;toolbar();render();
  }
  function down(e){
    if(!active)return;const p=point(e);clearTimeout(shapeTimer);
    if(tool==='eraser'){eraserPath=[p];try{e.target.setPointerCapture(e.pointerId)}catch(_){}render();e.preventDefault();return}
    const hi=tool==='highlight'; stroke={markup_type:hi?'highlight':'freehand',geometry:{points:[p]},color:hi?(color==='#111827'?'#f59e0b':color):color,stroke_width:hi?20:3,opacity:hi?.28:1,is_highlighter:hi,snapped:false};
    try{e.target.setPointerCapture(e.pointerId)}catch(_){}scheduleShapeSnap();e.preventDefault()
  }
  function move(e){
    if(!active)return;const p=point(e);
    if(tool==='eraser'&&eraserPath){const last=eraserPath[eraserPath.length-1];if(!last||Math.hypot(p.x-last.x,p.y-last.y)>.001){eraserPath.push(p);render()}e.preventDefault();return}
    if(!stroke)return;
    if(stroke.snapped){e.preventDefault();return}
    const pts=stroke.geometry.points,last=pts[pts.length-1]; if(!last||Math.hypot(p.x-last.x,p.y-last.y)>.0015){pts.push(p);render();scheduleShapeSnap()}e.preventDefault()
  }
  function up(e){
    clearTimeout(shapeTimer);
    if(tool==='eraser'&&eraserPath){const p=point(e);eraserPath.push(p);commitEraser();e.preventDefault();return}
    if(!active||!stroke)return; const p=point(e),pts=stroke.geometry.points;if(!stroke.snapped)pts.push(p);saveCurrent();e.preventDefault()
  }
  function bind(){const c=canvas();if(!c||c.dataset.markupBound)return;c.dataset.markupBound='1';c.onpointerdown=down;c.onpointermove=move;c.onpointerup=up;c.onpointercancel=()=>{clearTimeout(shapeTimer);stroke=null;eraserPath=null;render()}}
  async function sync(){
    if(route?.screen!=='drawing'||!q('sl_canvas_wrap')){sheet=null;marks=[];loadingKey='';return}
    bind(); const key=`${route.drawingId}:${q('sl_page_label')?.textContent||''}`;
    if(key!==loadingKey){loadingKey=key;active=false;q('sl_markup_session_bar')?.remove();document.body.classList.remove('sl-drawing-markup-active');await load().catch(console.error)}
    else render();
  }
  new MutationObserver(()=>requestAnimationFrame(()=>sync())).observe(document.getElementById('app'),{childList:true,subtree:true,attributes:true,attributeFilter:['style']});
  window.addEventListener('resize',()=>requestAnimationFrame(render));
  sync();
})();