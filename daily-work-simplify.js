// Simplify Daily Log work entry to one Work Performed field.
(() => {
  let timer;
  function simplify() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const brand = document.querySelector('.topbar .brand');
      if (!brand || brand.textContent.trim() !== 'Daily Report') return;
      document.querySelectorAll('.field').forEach(field => {
        const label = field.querySelector('label');
        if (label && label.textContent.trim() === 'Areas / Floors') field.remove();
      });
    }, 50);
  }
  new MutationObserver(simplify).observe(document.documentElement,{childList:true,subtree:true});
  simplify();
})();
