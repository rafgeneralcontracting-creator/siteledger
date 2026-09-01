(function(){
let cloning=false;
const baseRest=window.rest||rest;
async function cloneScale(calibration){
  if(!route?.drawingId||!calibration)return;
  const sheets=await baseRest(`drawing_sheets?select=*&drawing_id=eq.${route.drawingId}&order=page_number.asc`);
  if(!sheets.length)return;
  const current=sheets.find(s=>s.id===calibration.drawing_sheet_id);
  const currentPage=current?.page_number||1;
  modal(`<h2>Apply Scale</h2><div class="small" style="margin-bottom:14px">This page is calibrated. Apply the same scale to other pages in this PDF?</div><div class="actions" style="display:grid;gap:8px"><button class="btn secondary" onclick="closeModal()">This Page Only</button><button class="btn primary" onclick="applyDrawingScaleAll('${calibration.id}')">All Pages</button><button class="btn secondary" onclick="showDrawingScaleRange('${calibration.id}',${currentPage},${sheets.length})">Page Range…</button></div>`);
}
async function getCalibration(id){return (await baseRest(`drawing_calibrations?select=*&id=eq.${id}&limit=1`))[0]||null}
async function applyToPages(calibration,pages){
  const sheets=await baseRest(`drawing_sheets?select=*&drawing_id=eq.${route.drawingId}&order=page_number.asc`);
  const targets=sheets.filter(s=>pages.includes(Number(s.page_number))&&s.id!==calibration.drawing_sheet_id);
  cloning=true;
  try{
    for(const s of targets){
      const old=await baseRest(`drawing_calibrations?select=id&drawing_sheet_id=eq.${s.id}&active=eq.true`);
      for(const x of old)await baseRest(`drawing_calibrations?id=eq.${x.id}`,{method:'PATCH',body:JSON.stringify({active:false})});
      await baseRest('drawing_calibrations',{method:'POST',body:JSON.stringify({drawing_sheet_id:s.id,p1_x:calibration.p1_x,p1_y:calibration.p1_y,p2_x:calibration.p2_x,p2_y:calibration.p2_y,known_distance:calibration.known_distance,unit:calibration.unit,label:'Applied from another sheet',active:true,created_by:me.id})});
    }
  }finally{cloning=false}
  closeModal();
  alert(`Scale applied to ${targets.length+1} page${targets.length?'s':''}. You can recalibrate any individual page if it uses a different scale.`);
}
window.applyDrawingScaleAll=async function(id){try{const c=await getCalibration(id);if(!c)return alert('Calibration not found.');const sheets=await baseRest(`drawing_sheets?select=page_number&drawing_id=eq.${route.drawingId}`);await applyToPages(c,sheets.map(s=>Number(s.page_number)))}catch(e){alert(e.message||'Could not apply scale.')}};
window.showDrawingScaleRange=function(id,current,total){modal(`<h2>Apply Scale to Page Range</h2><div class="grid2"><div class="field"><label>From Page</label><input id="sl_scale_from" type="number" min="1" max="${total}" value="1"></div><div class="field"><label>To Page</label><input id="sl_scale_to" type="number" min="1" max="${total}" value="${total}"></div></div><div class="small">Current calibrated page: ${current}. Pages with an existing calibration in this range will be replaced.</div><div class="actions"><button class="btn secondary" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="applyDrawingScaleRange('${id}',${total})">Apply Scale</button></div>`)};
window.applyDrawingScaleRange=async function(id,total){try{let a=parseInt(document.getElementById('sl_scale_from').value,10),b=parseInt(document.getElementById('sl_scale_to').value,10);if(!Number.isFinite(a)||!Number.isFinite(b)||a<1||b<1||a>total||b>total)return alert(`Enter pages between 1 and ${total}.`);if(a>b)[a,b]=[b,a];const c=await getCalibration(id);if(!c)return alert('Calibration not found.');const pages=[];for(let n=a;n<=b;n++)pages.push(n);await applyToPages(c,pages)}catch(e){alert(e.message||'Could not apply scale.')}};
window.rest=async function(path,opt={}){
  const out=await baseRest(path,opt);
  if(!cloning&&path==='drawing_calibrations'&&String(opt?.method||'GET').toUpperCase()==='POST'&&Array.isArray(out)&&out[0])setTimeout(()=>cloneScale(out[0]).catch(console.error),80);
  return out;
};
})();