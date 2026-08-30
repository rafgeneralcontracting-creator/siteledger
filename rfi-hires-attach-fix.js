(function(){
const oldComplete=window.completeRfiPage;
if(typeof oldComplete!=='function')return;
const enc=p=>p.split('/').map(encodeURIComponent).join('/');
async function signDrawing(path){
  const r=await fetch(`${SB}/storage/v1/object/sign/project-drawings/${enc(path)}`,{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({expiresIn:600})});
  const d=await r.json();
  if(!r.ok)throw new Error(d.message||d.error||'Could not open original drawing');
  const u=d.signedURL||d.signedUrl;
  return /^https?:/.test(u)?u:`${SB}/storage/v1${u}`;
}
function safeViewport(page){
  const base=page.getViewport({scale:1});
  // iOS/Safari can silently degrade very large canvases. Keep the render below
  // a safe pixel area while still giving construction drawings enough detail.
  const maxEdge=3600,maxPixels=12000000;
  let scale=Math.min(3,maxEdge/Math.max(base.width,base.height));
  const area=base.width*base.height*scale*scale;
  if(area>maxPixels)scale*=Math.sqrt(maxPixels/area);
  scale=Math.max(1,scale);
  return page.getViewport({scale});
}
window.completeRfiPage=async function(){
  const canvas=document.getElementById('sl_pdf_canvas');
  if(!canvas||!route?.drawingId||!window.pdfjsLib)return oldComplete();
  let backup=null,oldW=canvas.width,oldH=canvas.height,oldStyleW=canvas.style.width,oldStyleH=canvas.style.height;
  try{
    backup=document.createElement('canvas');backup.width=oldW;backup.height=oldH;backup.getContext('2d').drawImage(canvas,0,0);
    const row=(await rest(`drawings?select=storage_path&id=eq.${route.drawingId}&limit=1`))[0];
    if(!row?.storage_path)return oldComplete();
    const pageNo=parseInt(document.getElementById('sl_page_label')?.textContent||'1',10)||1;
    const pdf=await pdfjsLib.getDocument(await signDrawing(row.storage_path)).promise;
    const page=await pdf.getPage(pageNo),vp=safeViewport(page);
    const hi=document.createElement('canvas');hi.width=Math.max(1,Math.ceil(vp.width));hi.height=Math.max(1,Math.ceil(vp.height));
    const hctx=hi.getContext('2d',{alpha:false});hctx.fillStyle='#fff';hctx.fillRect(0,0,hi.width,hi.height);
    await page.render({canvasContext:hctx,viewport:vp}).promise;
    canvas.width=hi.width;canvas.height=hi.height;canvas.style.width=oldStyleW;canvas.style.height=oldStyleH;canvas.getContext('2d').drawImage(hi,0,0);
    return await oldComplete();
  }catch(e){
    console.error('High-resolution RFI attachment fallback:',e);
    return await oldComplete();
  }finally{
    if(backup){canvas.width=oldW;canvas.height=oldH;canvas.style.width=oldStyleW;canvas.style.height=oldStyleH;canvas.getContext('2d').drawImage(backup,0,0)}
  }
};
})();
