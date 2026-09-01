(function(){
let last='';
async function sync(){if(route?.screen!=='drawing'||!route?.drawingId)return;const label=document.getElementById('sl_page_label'),box=document.getElementById('sl_scale_status');if(!label||!box)return;const page=parseInt(label.textContent,10)||1,key=`${route.drawingId}:${page}`;if(key===last)return;last=key;try{const sh=(await rest(`drawing_sheets?select=id&drawing_id=eq.${route.drawingId}&page_number=eq.${page}&limit=1`))[0];if(!sh)return;const c=(await rest(`drawing_calibrations?select=*&drawing_sheet_id=eq.${sh.id}&active=eq.true&limit=1`))[0];if(c){box.dataset.sheetCalibration='yes';const existing=box.innerHTML;box.innerHTML=`<div style="font-weight:700">✓ Page ${page} calibrated</div><div class="small">Calibration is saved for this page only.</div>${existing}`;}else{box.dataset.sheetCalibration='no';box.innerHTML=`<div style="font-weight:700">Page ${page} is not calibrated</div><div class="small">Tap Scale and calibrate this sheet before using Distance, Area, or Perimeter.</div>`}}
catch(e){console.error(e)}}
function reset(){last='';setTimeout(sync,100)}
new MutationObserver(()=>{if(document.getElementById('sl_canvas_wrap'))reset();else last=''}).observe(document.getElementById('app'),{childList:true,subtree:true});
setInterval(sync,700);
})();