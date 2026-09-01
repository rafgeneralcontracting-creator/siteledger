// Remove confusing Quick Fill actions. SiteLedger should autofill only fields it can know automatically.
(() => {
  function patch(){
    const brand=document.querySelector('.topbar .brand');
    if(!brand||brand.textContent.trim()!=='Daily Report')return;
    const quick=document.getElementById('sl-daily-quick');
    if(!quick)return;
    quick.innerHTML=`<div class="sl-quick-title">Automatically Filled</div><div class="small">Project, report date, prepared by, and weather are filled automatically when available. Enter only the field information SiteLedger cannot know on its own.</div>`;
  }
  let t;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(patch,50)}).observe(document.documentElement,{childList:true,subtree:true});
  patch();
})();
