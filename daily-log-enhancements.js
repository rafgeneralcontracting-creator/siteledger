// SiteLedger daily log speed improvements + sign-in sheet OCR
(() => {
  const originalManpowerForm = window.manpowerForm;
  let patchTimer = null;

  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-siteledger-tesseract]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.Tesseract));
        existing.addEventListener('error', () => reject(new Error('Could not load the sign-in sheet reader.')));
        return;
      }
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      s.async = true;
      s.dataset.siteledgerTesseract = '1';
      s.onload = () => resolve(window.Tesseract);
      s.onerror = () => reject(new Error('Could not load the sign-in sheet reader. Check your internet connection and try again.'));
      document.head.appendChild(s);
    });
  }

  function sectionByName(name) {
    return [...document.querySelectorAll('.section')].find(el => el.textContent.trim() === name);
  }

  function isEditableDailyLog() {
    const brand = document.querySelector('.topbar .brand');
    return brand && brand.textContent.trim() === 'Daily Report' && !document.body.textContent.includes('This report is submitted and locked.');
  }

  function addQuickActions() {
    if (!isEditableDailyLog() || document.getElementById('sl-daily-quick')) return;
    const workSection = sectionByName('Work & Manpower');
    if (!workSection) return;
    workSection.textContent = "Today's Work & Manpower";
    const quick = document.createElement('div');
    quick.id = 'sl-daily-quick';
    quick.className = 'card sl-quick-card';
    quick.innerHTML = `
      <div class="sl-quick-title">Quick Fill</div>
      <div class="small">Reuse recurring details instead of typing them again.</div>
      <div class="sl-quick-grid">
        <button class="btn secondary" onclick="slSmartAutofill()">⚡ Smart Autofill</button>
        <button class="btn secondary" onclick="slCopyYesterdayManpower()">↻ Copy Manpower</button>
      </div>
      <div class="small sl-save-note">Project, date, user and weather are already filled automatically. Text fields autosave while you type.</div>`;
    workSection.parentNode.insertBefore(quick, workSection);
  }

  function collapseMoreDetails() {
    if (!isEditableDailyLog() || document.getElementById('sl-more-details')) return;
    const siteSection = sectionByName('Site Conditions');
    const deliveriesSection = sectionByName('Deliveries & Issues');
    if (!siteSection || !deliveriesSection) return;
    const siteCard = siteSection.nextElementSibling;
    const deliveriesCard = deliveriesSection.nextElementSibling;
    if (!siteCard || !deliveriesCard) return;

    const details = document.createElement('details');
    details.id = 'sl-more-details';
    details.className = 'sl-more-details';
    details.innerHTML = '<summary><span>More Details</span><span class="small">Site conditions, deliveries, delays, inspections & safety</span></summary><div class="sl-more-body"></div>';
    siteSection.parentNode.insertBefore(details, siteSection);
    const body = details.querySelector('.sl-more-body');
    body.appendChild(siteSection);
    body.appendChild(siteCard);
    body.appendChild(deliveriesSection);
    body.appendChild(deliveriesCard);
  }

  function enableFastAutosave() {
    if (!isEditableDailyLog()) return;
    document.querySelectorAll('textarea[onchange*="saveField"],input[onchange*="saveField"]').forEach(el => {
      if (el.dataset.fastAutosave) return;
      el.dataset.fastAutosave = '1';
      const attr = el.getAttribute('onchange') || '';
      const m = attr.match(/saveField\('([^']+)'/);
      if (!m) return;
      const key = m[1];
      let timer;
      el.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => window.saveField(key, el.value).catch(() => {}), 700);
      });
    });
  }

  function relabelManpowerButton() {
    if (!isEditableDailyLog()) return;
    [...document.querySelectorAll('button')].forEach(btn => {
      if (btn.textContent.trim() === '+ Add Manpower') btn.textContent = '+ Add / Scan Manpower';
    });
  }

  function patchDailyLog() {
    clearTimeout(patchTimer);
    patchTimer = setTimeout(() => {
      addQuickActions();
      collapseMoreDetails();
      enableFastAutosave();
      relabelManpowerButton();
    }, 60);
  }

  const observer = new MutationObserver(patchDailyLog);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  patchDailyLog();

  window.manpowerForm = function enhancedManpowerForm() {
    modal(`<h2>Add Manpower</h2>
      <div class="sl-manpower-choice">
        <button class="sl-choice" onclick="slScanSignInForm()"><span class="sl-choice-icon">📸</span><span><b>Scan Sign-In Sheet</b><small>Take a photo and turn it into manpower entries</small></span></button>
        <button class="sl-choice" onclick="slManualManpower()"><span class="sl-choice-icon">＋</span><span><b>Add Manually</b><small>Enter a trade, workers and hours</small></span></button>
      </div>
      <div class="actions"><button class="btn secondary" onclick="closeModal()">Cancel</button></div>`);
  };

  window.slManualManpower = function () {
    closeModal();
    originalManpowerForm();
  };

  window.slSmartAutofill = async function () {
    try {
      const current = (await rest(`daily_reports?select=*&id=eq.${route.reportId}`))[0];
      if (!current) throw new Error('Daily report not found.');
      const prev = (await rest(`daily_reports?select=*&project_id=eq.${current.project_id}&log_date=lt.${current.log_date}&order=log_date.desc&limit=1`))[0];
      if (!prev) return alert('There is no earlier Daily Log for this project to reuse yet.');
      const patch = { updated_at: new Date().toISOString() };
      if (!String(current.general_conditions || '').trim() && String(prev.general_conditions || '').trim()) patch.general_conditions = prev.general_conditions;
      if (!String(current.areas_floors || '').trim() && String(prev.areas_floors || '').trim()) patch.areas_floors = prev.areas_floors;
      if (Object.keys(patch).length === 1) return alert('The recurring fields are already filled in.');
      await rest(`daily_reports?id=eq.${route.reportId}`, { method: 'PATCH', body: JSON.stringify(patch) });
      await reportPage();
    } catch (e) { alert(e.message); }
  };

  window.slCopyYesterdayManpower = async function () {
    try {
      const current = (await rest(`daily_reports?select=id,project_id,log_date&id=eq.${route.reportId}`))[0];
      const existing = await child('manpower', route.reportId);
      if (existing.length) return alert('Manpower is already entered for this Daily Log.');
      const prev = (await rest(`daily_reports?select=id&project_id=eq.${current.project_id}&log_date=lt.${current.log_date}&order=log_date.desc&limit=1`))[0];
      if (!prev) return alert('There is no earlier Daily Log to copy manpower from.');
      const rows = await child('manpower', prev.id);
      if (!rows.length) return alert('The previous Daily Log has no manpower to copy.');
      if (!confirm(`Copy ${rows.length} manpower entr${rows.length === 1 ? 'y' : 'ies'} from the previous Daily Log?`)) return;
      for (const r of rows) {
        await rest('manpower', { method: 'POST', body: JSON.stringify({
          daily_report_id: route.reportId,
          trade: r.trade,
          worker_count: r.worker_count,
          regular_hours: r.regular_hours,
          overtime_hours: r.overtime_hours || 0
        }) });
      }
      await reportPage();
    } catch (e) { alert(e.message); }
  };

  window.slScanSignInForm = function () {
    closeModal();
    modal(`<h2>Scan Sign-In Sheet</h2>
      <div class="small" style="margin-bottom:14px">Take a clear, straight photo of the full sheet. SiteLedger will read it, then you review everything before it is added.</div>
      <div class="field"><label>Sign-In Sheet Photo</label><input id="sl_scan_file" type="file" accept="image/*" capture="environment"></div>
      <div id="sl_scan_status" class="small"></div>
      <div class="actions"><button class="btn secondary" onclick="closeModal()">Cancel</button><button id="sl_scan_btn" class="btn primary" onclick="slReadSignInSheet()">Read Sheet</button></div>`);
  };

  function parseSheetText(text) {
    const headerWords = /^(name|employee|worker|signature|sign\s*in|date|project|time\s*in|time\s*out|hours|company|trade|foreman|total)\b/i;
    const lines = String(text || '').split(/\r?\n/).map(x => x.replace(/[|_]+/g, ' ').trim()).filter(Boolean);
    const rows = [];
    for (const line of lines) {
      if (headerWords.test(line) || line.length < 3 || !/[A-Za-z]{2}/.test(line)) continue;
      let parts = line.split(/\s{2,}|\t|,|\|/).map(x => x.trim()).filter(Boolean);
      if (parts.length === 1) {
        const hourMatch = line.match(/(?:^|\s)(\d{1,2}(?:\.\d+)?)\s*$/);
        const hours = hourMatch && +hourMatch[1] <= 24 ? +hourMatch[1] : 8;
        const name = hourMatch ? line.slice(0, hourMatch.index).trim() : line;
        if (name.length >= 3) rows.push({ name, trade: 'Field Crew', hours });
        continue;
      }
      let hours = 8;
      const numericIndex = [...parts].reverse().findIndex(x => /^\d{1,2}(?:\.\d+)?$/.test(x) && +x <= 24);
      if (numericIndex >= 0) {
        const idx = parts.length - 1 - numericIndex;
        hours = +parts[idx];
        parts.splice(idx, 1);
      }
      const name = parts[0] || 'Worker';
      const trade = parts.slice(1).join(' ') || 'Field Crew';
      if (name.length >= 2) rows.push({ name, trade, hours });
    }
    return rows.slice(0, 60);
  }

  async function saveSignInSheetFile(file, text) {
    const safe = (file.name || 'signin.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${route.reportId}/${Date.now()}_${safe}`;
    const upload = await fetch(`${SB}/storage/v1/object/manpower-signin-sheets/${path}`, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: 'Bearer ' + token, 'Content-Type': file.type || 'image/jpeg', 'x-upsert': 'false' },
      body: file
    });
    if (!upload.ok) {
      const d = await upload.json().catch(() => ({}));
      throw new Error(d.message || 'Could not save the sign-in sheet photo.');
    }
    await rest('manpower_signin_sheets', { method: 'POST', body: JSON.stringify({
      daily_report_id: route.reportId,
      storage_path: path,
      ocr_text: text || null,
      uploaded_by: me.id
    }) });
  }

  window.slReadSignInSheet = async function () {
    const file = document.getElementById('sl_scan_file')?.files?.[0];
    if (!file) return alert('Take or choose a photo of the sign-in sheet first.');
    const btn = document.getElementById('sl_scan_btn');
    const status = document.getElementById('sl_scan_status');
    btn.disabled = true;
    btn.textContent = 'Reading…';
    try {
      const Tesseract = await loadTesseract();
      const result = await Tesseract.recognize(file, 'eng', {
        logger: m => {
          if (!status || !m.status) return;
          const pct = m.progress != null ? ` ${Math.round(m.progress * 100)}%` : '';
          status.textContent = `${m.status}${pct}`;
        }
      });
      const text = result?.data?.text || '';
      const rows = parseSheetText(text);
      await saveSignInSheetFile(file, text);
      closeModal();
      slReviewScannedManpower(rows, text);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = 'Read Sheet';
      if (status) status.textContent = '';
      alert(e.message || 'Could not read this sheet. Try a clearer photo or add manpower manually.');
    }
  };

  window.slReviewScannedManpower = function (rows, rawText) {
    const safeRows = (rows && rows.length ? rows : [{ name: '', trade: 'Field Crew', hours: 8 }]);
    modal(`<h2>Review Manpower</h2>
      <div class="small" style="margin-bottom:12px">Nothing is added until you confirm. Correct anything the reader got wrong.</div>
      <div class="sl-apply-trade"><input id="sl_default_trade" placeholder="Trade / company for all"><button class="btn secondary smallbtn" onclick="slApplyTradeAll()">Apply to all</button></div>
      <div id="sl_scan_rows">${safeRows.map((r, i) => `<div class="sl-scan-row" data-i="${i}">
        <label class="sl-worker-check"><input type="checkbox" class="sl_include" checked> Include</label>
        <input class="sl_name" value="${esc(r.name || '')}" placeholder="Worker name">
        <input class="sl_trade" value="${esc(r.trade || 'Field Crew')}" placeholder="Trade / company">
        <input class="sl_hours" type="number" min="0" max="24" step="0.5" value="${Number(r.hours || 8)}" aria-label="Hours">
      </div>`).join('')}</div>
      <details class="sl-ocr-raw"><summary>View text read from sheet</summary><pre>${esc(rawText || 'No readable text detected.')}</pre></details>
      <div class="actions"><button class="btn secondary" onclick="closeModal()">Cancel</button><button id="sl_confirm_scan" class="btn primary" onclick="slConfirmScannedManpower()">Add to Daily Log</button></div>`);
  };

  window.slApplyTradeAll = function () {
    const value = document.getElementById('sl_default_trade')?.value.trim();
    if (!value) return;
    document.querySelectorAll('#sl_scan_rows .sl_trade').forEach(el => el.value = value);
  };

  window.slConfirmScannedManpower = async function () {
    const btn = document.getElementById('sl_confirm_scan');
    const rows = [...document.querySelectorAll('#sl_scan_rows .sl-scan-row')].filter(r => r.querySelector('.sl_include')?.checked).map(r => ({
      name: r.querySelector('.sl_name')?.value.trim() || 'Worker',
      trade: r.querySelector('.sl_trade')?.value.trim() || 'Field Crew',
      hours: Math.max(0, Math.min(24, +(r.querySelector('.sl_hours')?.value || 8)))
    }));
    if (!rows.length) return alert('Select at least one worker.');
    btn.disabled = true;
    btn.textContent = 'Adding…';
    try {
      const groups = new Map();
      for (const r of rows) {
        const key = r.trade.toLowerCase();
        if (!groups.has(key)) groups.set(key, { trade: r.trade, workers: 0, hours: [] });
        const g = groups.get(key);
        g.workers += 1;
        g.hours.push(r.hours);
      }
      for (const g of groups.values()) {
        const avg = g.hours.reduce((a, b) => a + b, 0) / g.hours.length;
        await rest('manpower', { method: 'POST', body: JSON.stringify({
          daily_report_id: route.reportId,
          trade: g.trade,
          worker_count: g.workers,
          regular_hours: Math.round(avg * 100) / 100,
          overtime_hours: 0
        }) });
      }
      closeModal();
      await reportPage();
    } catch (e) {
      btn.disabled = false;
      btn.textContent = 'Add to Daily Log';
      alert(e.message);
    }
  };
})();
