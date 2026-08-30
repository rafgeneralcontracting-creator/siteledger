(function(){
function findProjectId(){
  const page=document.querySelector('.page');
  if(!page)return null;
  const rfi=[...page.querySelectorAll('button')].find(b=>/^RFIs\s*→?$/i.test((b.textContent||'').trim()));
  if(!rfi)return null;
  const txt=(rfi.getAttribute('onclick')||'')+' '+String(rfi.onclick||'');
  const m=txt.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  return m?m[0]:null;
}
function install(){
  try{
    const page=document.querySelector('.page');
    if(!page||document.getElementById('sl_submittals_button'))return;
    const rfi=[...page.querySelectorAll('button')].find(b=>/^RFIs\s*→?$/i.test((b.textContent||'').trim()));
    if(!rfi)return;
    const pid=findProjectId();
    if(!pid)return;
    const b=document.createElement('button');
    b.id='sl_submittals_button';
    b.className=rfi.className||'btn secondary block';
    b.textContent='Submittals →';
    b.style.marginTop='10px';
    b.onclick=function(){
      if(typeof window.openProjectSubmittals==='function')window.openProjectSubmittals(pid);
      else alert('Submittals failed to load. Please refresh SiteLedger.');
    };
    rfi.insertAdjacentElement('afterend',b);
  }catch(e){console.error('Submittals nav install failed',e)}
}
const app=document.getElementById('app');
if(app)new MutationObserver(()=>requestAnimationFrame(install)).observe(app,{childList:true,subtree:true});
window.addEventListener('pageshow',()=>requestAnimationFrame(install));
window.addEventListener('load',()=>requestAnimationFrame(install));
setInterval(install,1000);
})();
