(function () {
  let prepared = null;
  const nameOf = d => (d.original_filename || `${d.drawing_number || d.title || 'Drawing'}.pdf`).replace(/[\\/\x00-\x1f]/g, '-');
  async function record(id) {
    const active = window.siteLedgerDrawingContext?.().drawing;
    if (!navigator.onLine) {
      const saved = await window.siteLedgerOfflineDrawing?.record(id);
      if (saved) return {...saved, original_filename: saved.original_filename || `${saved.title || 'Drawing'}.pdf`};
    }
    if (active?.id === id && active.storage_path) return active;
    const d = (await rest(`drawings?select=*&id=eq.${encodeURIComponent(id)}&limit=1`))[0];
    if (!d) throw new Error('Drawing not found or access is unavailable.');
    return d;
  }
  async function fileOf(d) {
    let blob;
    const cached = await window.siteLedgerOfflineDrawing?.record(d.id).catch(() => null);
    if (cached?.storage_path === d.storage_path) blob = cached.blob;
    if (!blob) {
      let url;
      try { url = await signedUrl('project-drawings', d.storage_path); }
      catch (error) {
        if (!window.refreshSiteLedgerSession) throw error;
        await window.refreshSiteLedgerSession();
        url = await signedUrl('project-drawings', d.storage_path);
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Could not download this file. Check your connection and try again.');
      blob = await res.blob();
    }
    return new File([blob], nameOf(d), {type: d.mime_type || blob.type || 'application/pdf'});
  }
  function download(file) {
    const url = URL.createObjectURL(file), a = document.createElement('a');
    a.href = url; a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  window.downloadProjectDrawing = async function (id, button) {
    const label = button?.textContent;
    try {
      if (button) {button.disabled = true; button.textContent = 'Downloading…';}
      download(await fileOf(await record(id)));
    } catch (error) {alert(error.message || 'Could not download drawing.');}
    finally {if (button) {button.disabled = false; button.textContent = label;}}
  };
  window.prepareProjectDrawingShare = async function (id, button) {
    const label = button?.textContent;
    try {
      if (button) {button.disabled = true; button.textContent = 'Preparing…';}
      const file = await fileOf(await record(id));
      prepared = file;
      const canShare = !!(navigator.share && navigator.canShare?.({files: [file]}));
      modal(`<h2>Share Drawing</h2><div class="small">${esc(file.name)}</div><p>Original PDF drawing set. App markups and takeoffs are not included.</p>${canShare ? '<p>Choose Share to send this file using your device’s apps.</p>' : '<p>Download this file, then attach it to your email or message.</p>'}<div class="actions">${canShare ? '<button class="btn primary" onclick="sharePreparedProjectDrawing(this)">Share File</button>' : ''}<button class="btn secondary" onclick="downloadPreparedProjectDrawing()">Download</button><button class="btn ghost" onclick="closeProjectDrawingShare()">Close</button></div>`);
    } catch (error) {alert(error.message || 'Could not prepare drawing.');}
    finally {if (button) {button.disabled = false; button.textContent = label;}}
  };
  window.sharePreparedProjectDrawing = async function (button) {
    if (!prepared) return;
    button.disabled = true;
    try {await navigator.share({title: prepared.name, files: [prepared]});}
    catch (error) {if (error.name !== 'AbortError') alert('Sharing is unavailable. Use Download to attach the file instead.');}
    finally {button.disabled = false;}
  };
  window.downloadPreparedProjectDrawing = () => {if (prepared) download(prepared);};
  window.closeProjectDrawingShare = () => {prepared = null; closeModal();};
  function actions(id) {
    const box = document.createElement('div'); box.className = 'actions sl-file-export';
    for (const [label, fn] of [['Download', downloadProjectDrawing], ['Share', prepareProjectDrawingShare]]) {
      const b = document.createElement('button'); b.className = 'btn secondary smallbtn'; b.textContent = label;
      b.onclick = e => {e.stopPropagation(); fn(id, b);}; box.appendChild(b);
    }
    return box;
  }
  function decorate() {
    if (route?.screen === 'drawings') document.querySelectorAll('.sl-file').forEach(card => {
      if (card.querySelector('.sl-file-export')) return;
      const id = card.querySelector('.sl-file-main')?.getAttribute('onclick')?.match(/drawing['"],['"]([^'"]+)/)?.[1];
      if (id) card.appendChild(actions(id));
    });
    if (route?.screen === 'drawing') {
      const head = document.querySelector('.sl-viewer-head');
      if (head && !head.querySelector('.sl-file-export')) head.appendChild(actions(route.drawingId));
    }
  }
  window.addEventListener('sl:drawings-mounted', decorate);
  window.addEventListener('sl:drawing-mounted', decorate);
  window.addEventListener('sl:drawing-unmounted', () => {prepared = null;});
})();
