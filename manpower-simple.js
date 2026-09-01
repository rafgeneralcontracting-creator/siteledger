// Simple manpower entry: manual typing or sign-in sheet photo only.
(() => {
  let patching = false;
  let timer = null;

  const monday = (s) => {
    const d = new Date(`${s}T12:00:00`);
    const k = d.getDay();
    d.setDate(d.getDate() + (k === 0 ? -6 : 1 - k));
    return d.toISOString().slice(0, 10);
  };

  async function currentState() {
    if (!route?.reportId) return null;
    const r = (await rest(`daily_reports?select=id,project_id,log_date,submitted&id=eq.${route.reportId}`))[0];
    if (!r) return null;
    const ws = monday(r.log_date);
    const weekly = (await rest(`weekly_reports?select=id,pdf_path&project_id=eq.${r.project_id}&week_start=eq.${ws}&limit=1`))[0];
    const mp = await child('manpower', r.id);
    const sheets = await rest(`manpower_signin_sheets?select=id,daily_report_id,storage_path,created_at,reader&daily_report_id=eq.${r.id}&order=created_at.desc`);
    return { r, mp, sheets, locked: !!weekly?.pdf_path };
  }

  function findWorkCard() {
    const sections = [...document.querySelectorAll('.section')];
    const sec = sections.find(el => /work.*manpower/i.test(el.textContent || ''));
    return sec?.nextElementSibling?.classList?.contains('card') ? sec.nextElementSibling : null;
  }

  function escAttr(v) {
    return esc(v == null ? '' : String(v)).replace(/`/g, '&#96;');
  }

  async function patchManpower() {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (patching) return;
      const brand = document.querySelector('.topbar .brand')?.textContent?.trim();
      if (brand !== 'Daily Report' || !route?.reportId) return;
      const card = findWorkCard();
      if (!card) return;
      patching = true;
      try {
        const state = await currentState();
        if (!state) return;

        card.querySelectorAll('.inline').forEach(el => el.remove());
        [...card.querySelectorAll('button')].forEach(btn => {
          const t = btn.textContent.trim();
          if (/add.*manpower/i.test(t) || /scan.*manpower/i.test(t)) btn.remove();
        });
        document.getElementById('sl-manpower-simple')?.remove();

        const wrap = document.createElement('div');
        wrap.id = 'sl-manpower-simple';
        wrap.style.marginTop = '14px';

        const entries = state.mp.map(m => `
          <div class="inline" style="margin-bottom:8px">
            <div class="inlinehead"><span>${esc(m.trade)}</span><span>${Number(m.worker_count || 0)} workers</span></div>
            <div class="small">${Number(m.regular_hours || 0)} regular hrs${Number(m.overtime_hours || 0) ? ` · ${Number(m.overtime_hours)} OT` : ''}</div>
            ${state.locked ? '' : `<div class="actions" style="margin-top:8px"><button class="btn secondary smallbtn" onclick="slEditManpower('${m.id}')">Edit</button><button class="btn secondary smallbtn" onclick="slDeleteManpower('${m.id}')">Remove</button></div>`}
          </div>`).join('');

        const sheets = state.sheets.map(s => `
          <div class="inline" style="margin-bottom:8px">
            <div class="inlinehead"><span>Sign-In Sheet Photo</span><span>${new Date(s.created_at).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}</span></div>
            <div class="actions" style="margin-top:8px"><button class="btn secondary smallbtn" onclick="slViewSigninSheet('${escAttr(s.storage_path)}')">View</button>${state.locked ? '' : `<button class="btn secondary smallbtn" onclick="slDeleteSigninSheet('${s.id}','${escAttr(s.storage_path)}')">Remove</button>`}</div>
          </div>`).join('');

        wrap.innerHTML = `
          <div class="title" style="font-size:14px;margin-bottom:8px">Manpower</div>
          ${entries || sheets ? `${entries}${sheets}` : '<div class="small" style="margin-bottom:10px">No manpower entered yet.</div>'}
          ${state.locked ? '<div class="notice success" style="margin-top:10px">This week is locked because the Weekly Report PDF has been generated.</div>' : `
            <div class="actions" style="margin-top:10px">
              <button class="btn secondary" onclick="slAddManpowerManual()">+ Type Manpower</button>
              <button class="btn secondary" onclick="slAddSigninPhoto()">+ Add Sign-In Sheet Photo</button>
            </div>`}`;
        card.appendChild(wrap);

        // A sign-in sheet photo is valid manpower documentation for submission.
        if (state.sheets.length && !state.mp.length && !state.r.submitted) {
          const reqs = [...document.querySelectorAll('.req')];
          const manpowerReq = reqs.find(x => x.querySelector('span')?.textContent?.trim() === 'Manpower');
          if (manpowerReq) {
            const status = manpowerReq.querySelector('span:last-child');
            if (status) { status.className = 'ok'; status.textContent = '✓ Complete'; }
          }
          const missing = reqs.some(x => x !== manpowerReq && x.querySelector('span:last-child')?.classList?.contains('miss'));
          const submit = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Submit Daily Report');
          if (submit && !missing) {
            submit.disabled = false;
            submit.setAttribute('onclick', 'submitReport()');
          }
        }
      } catch (e) {
        console.warn('Manpower UI:', e.message);
      } finally {
        patching = false;
      }
    }, 80);
  }

  window.slAddManpowerManual = function () {
    modal(`<h2>Add Manpower</h2>
      <div class="field"><label>Trade / Company</label><input id="sl_m_trade"></div>
      <div class="grid2"><div class="field"><label>Workers</label><input id="sl_m_workers" type="number" min="0" value="1"></div><div class="field"><label>Regular Hours</label><input id="sl_m_hours" type="number" min="0" step="0.5" value="8"></div></div>
      <div class="field"><label>Overtime Hours</label><input id="sl_m_ot" type="number" min="0" step="0.5" value="0"></div>
      <div class="actions"><button class="btn secondary" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="slSaveManualManpower()">Save</button></div>`);
  };

  window.slSaveManualManpower = async function () {
    try {
      const trade = document.getElementById('sl_m_trade')?.value.trim();
      if (!trade) return alert('Enter the trade or company.');
      await rest('manpower', { method: 'POST', body: JSON.stringify({
        daily_report_id: route.reportId,
        trade,
        worker_count: +(document.getElementById('sl_m_workers')?.value || 0),
        regular_hours: +(document.getElementById('sl_m_hours')?.value || 0),
        overtime_hours: +(document.getElementById('sl_m_ot')?.value || 0)
      })});
      closeModal();
      await reportPage();
    } catch (e) { alert(e.message); }
  };

  window.slEditManpower = async function (id) {
    try {
      const m = (await rest(`manpower?select=*&id=eq.${id}&limit=1`))[0];
      if (!m) return alert('Manpower entry not found.');
      modal(`<h2>Edit Manpower</h2>
        <div class="field"><label>Trade / Company</label><input id="sl_me_trade" value="${escAttr(m.trade)}"></div>
        <div class="grid2"><div class="field"><label>Workers</label><input id="sl_me_workers" type="number" min="0" value="${Number(m.worker_count || 0)}"></div><div class="field"><label>Regular Hours</label><input id="sl_me_hours" type="number" min="0" step="0.5" value="${Number(m.regular_hours || 0)}"></div></div>
        <div class="field"><label>Overtime Hours</label><input id="sl_me_ot" type="number" min="0" step="0.5" value="${Number(m.overtime_hours || 0)}"></div>
        <div class="actions"><button class="btn secondary" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="slSaveEditedManpower('${id}')">Save Changes</button></div>`);
    } catch (e) { alert(e.message); }
  };

  window.slSaveEditedManpower = async function (id) {
    try {
      const trade = document.getElementById('sl_me_trade')?.value.trim();
      if (!trade) return alert('Enter the trade or company.');
      await rest(`manpower?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({
        trade,
        worker_count: +(document.getElementById('sl_me_workers')?.value || 0),
        regular_hours: +(document.getElementById('sl_me_hours')?.value || 0),
        overtime_hours: +(document.getElementById('sl_me_ot')?.value || 0)
      })});
      closeModal();
      await reportPage();
    } catch (e) { alert(e.message); }
  };

  window.slDeleteManpower = async function (id) {
    if (!confirm('Remove this manpower entry?')) return;
    try {
      await rest(`manpower?id=eq.${id}`, { method: 'DELETE' });
      await reportPage();
    } catch (e) { alert(e.message); }
  };

  window.slAddSigninPhoto = function () {
    modal(`<h2>Add Sign-In Sheet Photo</h2>
      <div class="small" style="margin-bottom:14px">Take a photo or upload an existing image. SiteLedger will save the sheet as documentation; it will not try to read it.</div>
      <div class="field"><label>Sign-In Sheet</label><input id="sl_signin_photo" type="file" accept="image/*"></div>
      <div class="actions"><button class="btn secondary" onclick="closeModal()">Cancel</button><button id="sl_signin_save" class="btn primary" onclick="slSaveSigninPhoto()">Upload</button></div>`);
  };

  window.slSaveSigninPhoto = async function () {
    const file = document.getElementById('sl_signin_photo')?.files?.[0];
    if (!file) return alert('Choose a photo first.');
    const btn = document.getElementById('sl_signin_save');
    btn.disabled = true; btn.textContent = 'Uploading…';
    try {
      const safe = (file.name || 'signin.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${route.reportId}/${Date.now()}_${safe}`;
      const upload = await fetch(`${SB}/storage/v1/object/manpower-signin-sheets/${path}`, {
        method: 'POST',
        headers: { apikey: KEY, Authorization: 'Bearer ' + token, 'Content-Type': file.type || 'image/jpeg', 'x-upsert': 'false' },
        body: file
      });
      if (!upload.ok) {
        const d = await upload.json().catch(() => ({}));
        throw new Error(d.message || 'Upload failed.');
      }
      await rest('manpower_signin_sheets', { method: 'POST', body: JSON.stringify({
        daily_report_id: route.reportId,
        storage_path: path,
        uploaded_by: me.id,
        reader: 'photo',
        ocr_text: null,
        parsed_rows: null
      })});
      closeModal();
      await reportPage();
    } catch (e) {
      btn.disabled = false; btn.textContent = 'Upload'; alert(e.message);
    }
  };

  window.slViewSigninSheet = async function (path) {
    try { window.open(await signedUrl('manpower-signin-sheets', path), '_blank'); }
    catch (e) { alert(e.message); }
  };

  window.slDeleteSigninSheet = async function (id, path) {
    if (!confirm('Remove this sign-in sheet photo?')) return;
    try {
      const res = await fetch(`${SB}/storage/v1/object/manpower-signin-sheets/${path}`, {
        method: 'DELETE', headers: { apikey: KEY, Authorization: 'Bearer ' + token }
      });
      if (!res.ok && res.status !== 404) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || 'Could not remove the photo.');
      }
      await rest(`manpower_signin_sheets?id=eq.${id}`, { method: 'DELETE' });
      await reportPage();
    } catch (e) { alert(e.message); }
  };

  // Replace all older scan/read choices.
  window.manpowerForm = window.slAddManpowerManual;
  window.slScanSignInForm = window.slAddSigninPhoto;

  new MutationObserver(patchManpower).observe(document.documentElement, { childList: true, subtree: true });
  patchManpower();
})();
