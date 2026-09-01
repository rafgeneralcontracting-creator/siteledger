// Simplify Daily Log work entry to one Work Performed field.
(() => {
  let timer;
  function removeFieldByText(text){
    document.querySelectorAll('label,.label,.field-label,.section,.title,strong').forEach(el=>{
      if((el.textContent||'').trim()!==text) return;
      const field=el.closest('.field');
      if(field){field.remove();return;}
      const card=el.closest('.card');
      if(card && card.querySelector('textarea,input,select')){card.remove();return;}
      const parent=el.parentElement;
      if(parent && parent.querySelector('textarea,input,select')) parent.remove();
    });
  }
  function removeSiteConditionsSection(){
    [...document.querySelectorAll('.section')].forEach(section=>{
      if((section.textContent||'').trim()!=='Site Conditions') return;
      const next=section.nextElementSibling;
      if(next && next.classList.contains('card')) next.remove();
      section.remove();
    });
    const details=document.getElementById('sl-more-details');
    if(details){
      const summary=details.querySelector('summary');
      if(summary && /site conditions/i.test(summary.textContent||'')){
        const small=summary.querySelector('.small');
        if(small) small.textContent='Deliveries, delays, inspections & safety';
      }
    }
  }
  function simplify() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const brand = document.querySelector('.topbar .brand');
      if (!brand || brand.textContent.trim() !== 'Daily Report') return;
      removeFieldByText('Areas / Floors');
      removeFieldByText('General Conditions');
      removeSiteConditionsSection();
    }, 30);
  }
  new MutationObserver(simplify).observe(document.documentElement,{childList:true,subtree:true});
  simplify();
})();
