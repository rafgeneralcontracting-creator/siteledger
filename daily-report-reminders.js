(function () {
  const managers = ['owner', 'admin', 'pm', 'apm'];
  let generation = 0, busy = false;
  function clock(now = new Date()) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', hourCycle: 'h23'
    }).formatToParts(now).map(p => [p.type, p.value]));
    return { date: `${parts.year}-${parts.month}-${parts.day}`, afterThree: Number(parts.hour) >= 15 };
  }
  async function refresh() {
    const page = document.querySelector('.page');
    if (!page || !me || !token || !['home', 'logs', 'report', 'project'].includes(route.screen)) return;
    const version = ++generation, userId = me.id, time = clock();
    try {
      const rows = await rest('daily_report_reminders?select=*,daily_reports(id,log_date,submitted,projects(name))&order=created_at.desc');
      if (version !== generation || !page.isConnected || me?.id !== userId) return;
      page.querySelector('#sl-reminder-inbox')?.remove();
      const incoming = rows.filter(r => r.recipient_id === userId && r.daily_reports && !r.daily_reports.submitted);
      if (incoming.length && ['home', 'logs'].includes(route.screen)) {
        const inbox = document.createElement('section');
        inbox.id = 'sl-reminder-inbox';
        inbox.innerHTML = '<div class="section">Daily report reminders</div>' + incoming.map(r => `<div class="card"><div class="title">Please submit your daily report</div><p>${esc(r.daily_reports.projects?.name || 'Project')} · ${esc(fmt(r.daily_reports.log_date))}</p><button class="btn primary" data-report="${esc(r.report_id)}">Open Report</button></div>`).join('');
        inbox.querySelectorAll('button').forEach(b => b.onclick = () => go('report', b.dataset.report));
        page.prepend(inbox);
      }
      page.querySelectorAll('.sl-reminder-action').forEach(x => x.remove());
      if (!managers.includes(me.role) || !time.afterThree) return;
      const reportsToday = await rest(`daily_reports?select=id,project_id,log_date,submitted&log_date=eq.${time.date}&submitted=eq.false`);
      if (version !== generation || !page.isConnected || me?.id !== userId) return;
      for (const r of reportsToday) {
        let host;
        if (route.screen === 'report' && route.reportId === r.id) host = page.querySelector('.hero');
        else host = [...page.querySelectorAll('[onclick]')].find(x => x.getAttribute('onclick') === `go('report','${r.id}')`);
        if (!host) continue;
        if (host.tagName === 'BUTTON') host = host.parentElement;
        const wrap = document.createElement('div');
        wrap.className = 'sl-reminder-action actions';
        const b = document.createElement('button');
        b.className = 'btn secondary';
        b.textContent = rows.some(x => x.report_id === r.id) ? 'Reminder Sent · View' : 'Send Reminder';
        b.onclick = e => { e.stopPropagation(); openReminder(r.id); };
        wrap.append(b); host.append(wrap);
      }
    } catch (e) { console.warn('Could not load daily report reminders:', e.message); }
  }
  async function openReminder(reportId) {
    try {
      const r = (await rest(`daily_reports?select=*,projects(name)&id=eq.${reportId}`))[0];
      const time = clock();
      if (!r || r.submitted || r.log_date !== time.date || !time.afterThree) { await refresh(); return alert('Reminders are available after 3 p.m. Eastern for today’s unsubmitted reports.'); }
      const [assignments, people, sent] = await Promise.all([
        rest(`project_assignments?select=user_id&project_id=eq.${r.project_id}&active=eq.true`),
        rest('profiles?select=id,full_name,email,active&active=eq.true'),
        rest(`daily_report_reminders?select=recipient_id&report_id=eq.${reportId}`)
      ]);
      const targets = people.filter(p => p.id !== me.id && assignments.some(a => a.user_id === p.id));
      closeModal();
      modal(`<h2>Send Reminder</h2><p>${esc(r.projects?.name)} · ${esc(fmt(r.log_date))}</p><p>Choose who to remind. They will see a notification in SiteLedger when they open Home or Daily.</p><div id="sl-reminder-people"></div><div id="sl-reminder-error" role="alert"></div><div class="actions"><button class="btn secondary" onclick="closeModal()">Close</button></div>`);
      const list = document.getElementById('sl-reminder-people');
      if (!targets.length) list.textContent = 'No other active team members are assigned to this project. Add an assignment in Team & Permissions first.';
      targets.forEach(person => {
        const row = document.createElement('div'); row.className = 'card';
        const name = document.createElement('div'); name.className = 'title'; name.textContent = person.full_name || person.email || 'Team member';
        const b = document.createElement('button'); b.className = 'btn primary';
        b.disabled = sent.some(s => s.recipient_id === person.id);
        b.textContent = b.disabled ? 'Reminder Sent' : 'Remind';
        b.onclick = async () => {
          if (busy || !confirm(`Remind ${person.full_name || person.email} to submit the daily report for ${r.projects?.name}?`)) return;
          busy = true; b.disabled = true; b.textContent = 'Sending…';
          const error = document.getElementById('sl-reminder-error'); error.textContent = '';
          try {
            await rest('daily_report_reminders', { method: 'POST', body: JSON.stringify({ report_id: reportId, recipient_id: person.id }) });
            b.textContent = 'Reminder Sent'; await refresh();
          } catch (e) {
            if (/duplicate key/i.test(e.message)) b.textContent = 'Reminder Sent';
            else { b.disabled = false; b.textContent = 'Remind'; error.textContent = 'Reminder was not sent. The report may have been submitted or access changed. Please reopen it and try again.'; }
          } finally { busy = false; }
        };
        row.append(name, b); list.append(row);
      });
    } catch (e) { alert('Could not load the reminder: ' + e.message); }
  }
  const originalShell = shell;
  shell = function (...args) { generation++; const out = originalShell.apply(this, args); setTimeout(refresh, 0); return out; };
  setInterval(() => { if (!document.hidden && !busy) refresh(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
})();
