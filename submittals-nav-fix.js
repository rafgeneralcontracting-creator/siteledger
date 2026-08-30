(function(){
function install(){
  try{
    if(!window.route||route.screen!=='project'||!route.projectId)return;
    const page=document.querySelector('.page');
    if(!page||document.getElementById('sl_submittals_button'))return;
    const rfi=[...page.querySelectorAll('button')].find(b=>/RFIs\s*→?/i.test((b.textContent||'').trim()));
    if(!rfi)return;
    const b=document.createElement('button');
    b.id='sl_submittals_button';
    b.className='btn secondary block';
    b.textContent='Submittals →';
    b.onclick=function(){
      if(typeof window.openProjectSubmittals==='function') window.openProjectSubmittals(route.projectId);
      else alert('Submittals are still loading. Please reopen the project and try again.');
    };
    rfi.insertAdjacentElement('afterend',b);
  }catch(e){console.error('Submittals nav install failed',e)}
}
new MutationObserver(()=>requestAnimationFrame(install)).observe(document.getElementById('app'),{childList:true,subtree:true});
window.addEventListener('pageshow',()=>requestAnimationFrame(install));
setTimeout(install,0);
setTimeout(install,500);
})();
