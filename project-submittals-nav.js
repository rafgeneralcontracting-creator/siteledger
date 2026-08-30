(function(){
  function install(){
    if(typeof window.openProjectSubmittals!=='function') return;
    const sections=[...document.querySelectorAll('.section')];
    const pm=sections.find(x=>/project management/i.test((x.textContent||'').trim()));
    if(!pm) return;
    const existing=document.getElementById('sl-project-submittals-nav');
    if(existing) return;
    const rfi=[...document.querySelectorAll('button,.card,.btn')].find(x=>/^RFIs\s*→?$/i.test((x.textContent||'').trim()));
    if(!rfi) return;
    const pid=(window.route&&route.projectId)||null;
    if(!pid) return;
    const b=document.createElement('button');
    b.id='sl-project-submittals-nav';
    b.className=rfi.className||'btn secondary block';
    b.textContent='Submittals →';
    b.onclick=()=>window.openProjectSubmittals(pid);
    rfi.insertAdjacentElement('afterend',b);
    b.style.marginTop='10px';
  }
  new MutationObserver(()=>install()).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',install);
  setTimeout(install,250);
})();