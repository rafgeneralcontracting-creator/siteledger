// SiteLedger drawing UX + calibration helper
// Keeps the existing measurement engine, but makes precise calibration the default field workflow.
(function(){
  let patched=false, originalStart=null, zoomedForCalibration=false;

  function patchToolbar(){
    if(route?.screen!=='drawing') { patched=false; return; }
    const bar=document.querySelector('.sl-takeoffbar');
    if(!bar)return;

    const pan=document.getElementById('tool_pan');
    const scale=document.getElementById('tool_calibrate');
    const verify=document.getElementById('tool_verify');
    const distance=document.getElementById('tool_distance');
    const area=document.getElementById('tool_area');
    const perimeter=document.getElementById('tool_perimeter');
    const count=document.getElementById('tool_count');

    if(pan){pan.textContent='✋ Pan';pan.classList.add('sl-secondary-tool')}
    if(scale){scale.textContent='⌖ Set Scale';scale.title='Calibrate this sheet using a known dimension'}
    if(verify){verify.textContent='✓ Check Scale';verify.title='Verify the scale against a second known dimension'}
    if(distance)distance.textContent='↔ Measure';
    if(area)area.textContent='▱ Area';
    if(perimeter){perimeter.textContent='⌁ Perimeter';perimeter.classList.add('sl-secondary-tool')}
    if(count)count.textContent='● Count';

    const status=document.getElementById('sl_scale_status');
    if(status){
      status.title='Tap to set or reset the scale for this sheet';
      status.setAttribute('role','button');
      status.tabIndex=0;
      if(!status.dataset.slScaleClick){
        status.dataset.slScaleClick='1';
        status.addEventListener('click',()=>window.startDrawingTool?.('calibrate'));
        status.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();window.startDrawingTool?.('calibrate')}});
      }
    }

    if(!document.getElementById('sl_precision_tip')){
      const tip=document.createElement('div');
      tip.id='sl_precision_tip';
      tip.className='sl-precision-tip';
      tip.innerHTML='<b>For accurate takeoffs:</b> calibrate from the longest printed dimension you can find, then use <b>Check Scale</b> on a second dimension.';
      bar.insertAdjacentElement('afterend',tip);
    }

    if(!patched && typeof window.startDrawingTool==='function'){
      originalStart=window.startDrawingTool;
      window.startDrawingTool=function(mode){
        const result=originalStart(mode);
        if(mode==='calibrate'){
          // More screen pixels between calibration endpoints = less tap error.
          // Start calibration at a useful precision zoom, while still allowing normal pan/pinch.
          if(!zoomedForCalibration){
            zoomedForCalibration=true;
            try{ for(let i=0;i<4;i++) window.changeDrawingZoom?.(.25); }catch(e){}
          }
          const tip=document.getElementById('sl_precision_tip');
          if(tip)tip.innerHTML='<b>Precision mode:</b> zoom/pan to the exact ends of a long known dimension. Tap Point 1, then Point 2. You can pinch-zoom between points.';
        } else if(mode==='verify'){
          const tip=document.getElementById('sl_precision_tip');
          if(tip)tip.innerHTML='<b>Scale check:</b> choose a different printed dimension. Under 1% error is the target.';
        }
        return result;
      };
      patched=true;
    }
  }

  function resetPrecisionWhenLeaving(){
    if(route?.screen!=='drawing') zoomedForCalibration=false;
  }

  const app=document.getElementById('app');
  if(app)new MutationObserver(()=>requestAnimationFrame(()=>{patchToolbar();resetPrecisionWhenLeaving()})).observe(app,{childList:true,subtree:true});
  setInterval(patchToolbar,800);
  patchToolbar();
})();
