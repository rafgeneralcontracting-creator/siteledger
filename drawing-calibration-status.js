(function(){
let last='';
async function sync(force=false){
  if(route?.screen!=='drawing'||!route?.drawingId){last='';return}
  const label=document.getElementById('sl_page_label'),box=document.getElementById('sl_scale_status');
  if(!label||!box)return;
  const page=parseInt(label.textContent,10)||1,key=`${route.drawingId}:${page}`;
  if(!force&&key===last)return;
  last=key;
  try{
    const sh=(await rest(`drawing_sheets?select=id&drawing_id=eq.${route.drawingId}&page_number=eq.${page}&limit=1`))[0];
    if(!sh)return;
    const c=(await rest(`drawing_calibrations?select=*&drawing_sheet_id=eq.${sh.id}&active=eq.true&limit=1`))[0];
    if(c){
      box.dataset.sheetCalibration='yes';
      box.innerHTML=`<div style="font-weight:700">✓ Page ${page} calibrated</div><div class="small">Scale is saved for this page.</div>`;
      box.className='sl-scale-status ready';
    }else{
      box.dataset.sheetCalibration='no';
      box.innerHTML=`<div style="font-weight:700">Page ${page} not calibrated</div><div class="small">Tap Scale before measuring.</div>`;
      box.className='sl-scale-status';
    }
  }catch(e){console.error(e)}
}
window.addEventListener('sl:drawing-mounted',()=>sync(true));
window.addEventListener('sl:drawing-page',()=>sync(true));
window.addEventListener('sl:drawing-unmounted',()=>{last=''});
if(route?.screen==='drawing')sync(true);
})();