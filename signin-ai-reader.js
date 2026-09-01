// AI vision sign-in sheet reader. Replaces browser OCR for handwritten construction sign-in sheets.
(() => {
  const fileToBase64 = file => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || '').split(',')[1] || '');
    r.onerror = () => reject(new Error('Could not read the selected image.'));
    r.readAsDataURL(file);
  });

  async function saveOriginalSheet(file, result) {
    const safe = (file.name || 'signin.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${route.reportId}/${Date.now()}_${safe}`;
    const upload = await fetch(`${SB}/storage/v1/object/manpower-signin-sheets/${path}`, {
      method: 'POST',
      headers: {
        apikey: KEY,
        Authorization: 'Bearer ' + token,
        'Content-Type': file.type || 'image/jpeg',
        'x-upsert': 'false'
      },
      body: file
    });
    if (!upload.ok) {
      const d = await upload.json().catch(() => ({}));
      throw new Error(d.message || 'Could not save the sign-in sheet image.');
    }
    const summary = (result.rows || []).map(r => `${r.name} | ${r.company || ''} | ${r.date || ''}`).join('\n');
    await rest('manpower_signin_sheets', {
      method: 'POST',
      body: JSON.stringify({
        daily_report_id: route.reportId,
        storage_path: path,
        ocr_text: summary || null,
        uploaded_by: me.id,
        reader: result.reader || 'openai-vision',
        parsed_rows: result.rows || []
      })
    });
    return path;
  }

  window.slReadSignInSheet = async function () {
    const file = document.getElementById('sl_scan_file')?.files?.[0];
    if (!file) return alert('Take a photo or choose an image of the sign-in sheet first.');
    if (!String(file.type || '').startsWith('image/')) return alert('Please choose an image file.');

    const btn = document.getElementById('sl_scan_btn');
    const status = document.getElementById('sl_scan_status');
    btn.disabled = true;
    btn.textContent = 'Reading handwriting…';
    if (status) status.textContent = 'AI is straightening the page and reading the handwritten rows…';

    try {
      const imageBase64 = await fileToBase64(file);
      const result = await edge('read-signin-sheet', {
        image_base64: imageBase64,
        mime_type: file.type || 'image/jpeg'
      });
      if (!Array.isArray(result.rows) || !result.rows.length) {
        throw new Error('No worker rows were confidently detected. Try a clearer photo or enter the manpower manually.');
      }
      await saveOriginalSheet(file, result);
      closeModal();
      slReviewAiManpower(result);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = 'Read Sheet';
      if (status) status.textContent = '';
      const msg = e?.message || 'Could not read this sign-in sheet.';
      alert(msg === 'The AI sign-in sheet reader is not configured yet.'
        ? 'The improved AI reader is installed, but its API connection still needs to be activated.'
        : msg);
    }
  };

  window.slReviewAiManpower = function (result) {
    const rows = result.rows || [];
    const sheetMeta = [result.sheet_date && `Sheet date: ${result.sheet_date}`, result.sheet_time && `Time: ${result.sheet_time}`].filter(Boolean).join(' · ');
    modal(`<h2>Review Sign-In Sheet</h2>
      <div class="small" style="margin-bottom:8px">AI read ${rows.length} worker${rows.length === 1 ? '' : 's'}. Review anything uncertain before adding it.</div>
      ${sheetMeta ? `<div class="small" style="margin-bottom:14px"><b>${esc(sheetMeta)}</b></div>` : ''}
      <div id="sl_ai_rows">${rows.map((r, i) => {
        const c = Number(r.confidence ?? .5);
        const label = c >= .8 ? 'High confidence' : c >= .55 ? 'Check' : 'Low confidence';
        return `<div class="sl-scan-row" data-i="${i}" style="grid-template-columns:auto 1.4fr 1fr .85fr .65fr;align-items:center">
          <label class="sl-worker-check"><input type="checkbox" class="sl_include" checked> Include</label>
          <input class="sl_name" value="${esc(r.name || '')}" placeholder="Worker name">
          <input class="sl_company" value="${esc(r.company || '')}" placeholder="Company / trade">
          <input class="sl_date" value="${esc(r.date || result.sheet_date || '')}" placeholder="Date">
          <input class="sl_hours" type="number" min="0" max="24" step="0.5" value="8" title="Hours per worker">
          <div class="small" style="grid-column:2 / -1;margin-top:-4px">${esc(label)}${r.company ? ` · ${esc(r.company)}` : ''} · Hours default to 8 because this sign-in sheet does not show total hours.</div>
        </div>`;
      }).join('')}</div>
      <div class="small" style="margin-top:12px">Signatures are intentionally ignored. Change hours if the crew did not work 8 hours.</div>
      <div class="actions"><button class="btn secondary" onclick="closeModal()">Cancel</button><button id="sl_ai_confirm" class="btn primary" onclick="slConfirmAiManpower()">Add to Daily Log</button></div>`);
  };

  window.slConfirmAiManpower = async function () {
    const btn = document.getElementById('sl_ai_confirm');
    const rows = [...document.querySelectorAll('#sl_ai_rows .sl-scan-row')]
      .filter(r => r.querySelector('.sl_include')?.checked)
      .map(r => ({
        name: r.querySelector('.sl_name')?.value.trim() || 'Worker',
        company: r.querySelector('.sl_company')?.value.trim() || 'Field Crew',
        date: r.querySelector('.sl_date')?.value.trim() || '',
        hours: Math.max(0, Math.min(24, +(r.querySelector('.sl_hours')?.value || 0)))
      }));
    if (!rows.length) return alert('Select at least one worker.');
    btn.disabled = true;
    btn.textContent = 'Adding…';

    try {
      const groups = new Map();
      for (const row of rows) {
        const key = row.company.toLowerCase();
        if (!groups.has(key)) groups.set(key, { company: row.company, names: [], hours: [], dates: [] });
        const g = groups.get(key);
        g.names.push(row.name);
        g.hours.push(row.hours);
        if (row.date) g.dates.push(row.date);
      }

      for (const g of groups.values()) {
        const avgHours = g.hours.length ? g.hours.reduce((a, b) => a + b, 0) / g.hours.length : 0;
        const uniqueDates = [...new Set(g.dates)];
        await rest('manpower', {
          method: 'POST',
          body: JSON.stringify({
            daily_report_id: route.reportId,
            trade: g.company,
            worker_count: g.names.length,
            regular_hours: Math.round(avgHours * 100) / 100,
            overtime_hours: 0,
            notes: `Imported from sign-in sheet. Workers: ${g.names.join(', ')}${uniqueDates.length ? `. Date: ${uniqueDates.join(', ')}` : ''}`
          })
        });
      }
      closeModal();
      await reportPage();
    } catch (e) {
      btn.disabled = false;
      btn.textContent = 'Add to Daily Log';
      alert(e?.message || 'Could not add the scanned manpower.');
    }
  };
})();
