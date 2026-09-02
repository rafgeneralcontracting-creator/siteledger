// SiteLedger drawing UI polish.
// Keeps the existing calibration and measurement behavior unchanged.
(function(){
  function patchToolbar(){
    if(route?.screen!=='drawing') return;
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
    if(scale){scale.textContent='⌖ Set Scale';scale.title='Set the scale for this sheet'}
    if(verify){verify.textContent='✓ Check Scale';verify.title='Check the scale against another known dimension'}
    if(distance)distance.textContent='↔ Measure';
    if(area)area.textContent='▱ Area';
    if(perimeter){perimeter.textContent='⌁ Perimeter';perimeter.classList.add('sl-secondary-tool')}
    if(count)count.textContent='● Count';

    const oldTip=document.getElementById('sl_precision_tip');
    if(oldTip)oldTip.remove();
  }

  const app=document.getElementById('app');
  if(app)new MutationObserver(()=>requestAnimationFrame(patchToolbar)).observe(app,{childList:true,subtree:true});
  setInterval(patchToolbar,800);
  patchToolbar();
})();
