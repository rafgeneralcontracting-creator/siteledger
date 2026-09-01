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
  function simplify() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const brand = document.querySelector('.topbar .brand');
      if (!brand || brand.textContent.trim() !== 'Daily Report') return;
      removeFieldByText('Areas / Floors');
      removeFieldByText('General Conditions');
    }, 30);
  }
  new MutationObserver(simplify).observe(document.documentElement,{childList:true,subtree:true});
  simplify();
})();
