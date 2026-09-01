// Reliable delegated click handling for manpower Edit/Remove controls.
(() => {
  if (window.__slManpowerDelegatedFix) return;
  window.__slManpowerDelegatedFix = true;

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-sl-manpower-action]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const id = button.dataset.manpowerId;
    if (!id) return;
    const action = button.dataset.slManpowerAction;
    if (action === 'edit') return window.slEditManpower?.(id);
    if (action === 'remove') return window.slDeleteManpower?.(id);
  }, true);

  function patchButtons() {
    document.querySelectorAll('#sl-manpower-simple .inline').forEach(row => {
      row.querySelectorAll('button').forEach(btn => {
        const text = btn.textContent.trim().toLowerCase();
        const onclick = btn.getAttribute('onclick') || '';
        const match = onclick.match(/sl(?:Edit|Delete)Manpower\('([^']+)'\)/);
        if (!match) return;
        const id = match[1];
        if (text === 'edit') {
          btn.dataset.slManpowerAction = 'edit';
          btn.dataset.manpowerId = id;
          btn.removeAttribute('onclick');
          btn.type = 'button';
        } else if (text === 'remove') {
          btn.dataset.slManpowerAction = 'remove';
          btn.dataset.manpowerId = id;
          btn.removeAttribute('onclick');
          btn.type = 'button';
        }
      });
    });
  }

  let timer;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(patchButtons, 20);
  }).observe(document.documentElement, { childList: true, subtree: true });
  patchButtons();
})();
