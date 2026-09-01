// Automatic weekly report generation with clearly separated Daily / Weekly report libraries.
(() => {
  const dateOnly=d=>d.toISOString().slice(0,10);
  function monday(s){const d=new Date((s||today)+'T12:00:00');const k=d.getDay();d.setDate(d.getDate()+(k===0?-6:1-k));return dateOnly(d)}
  function plus(s,n){const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return dateOnly(d)}
  async function weeklyRows(){return rest('weekly_reports?select=*&order=week_start.desc')}

  async function ensureWeeklyReports(){
    try{
      const all=await reports(),existing=await weeklyRows(),candidates=new Map();
      for(const r of all){if(!r.submitted)continue;const ws=monday(r.log_date),we=plus(ws,4);if(we>today)continue;candidates.set(`${r.project_id}:${ws}`,{project_id:r.project_id,week_start:ws})}
      for(const c of candidates.values()){if(existing.some(w=>w.project_id===c.project_id&&w.week_start===c.week_start&&w.pdf_path))continue;try{await edge('generate-weekly-report-pdf',c)}catch(e){console.warn('Weekly report generation skipped:',e.message)}}
    }catch(e){console.warn('Weekly reports:',e.message)}
  }

  async function weeklySigned(path){return signedUrl('report-pdfs',path)}
  window.slOpenWeekly=async path=>{try{if(!path)return alert('Weekly PDF is not ready yet.');const url=await weeklySigned(path);window.open(url,'_blank')}catch(e){alert(e.message)}};
  window.slDownloadWeekly=async(path,name)=>{try{const url=await weeklySigned(path),res=await fetch(url);if(!res.ok)throw new Error('Could not download Weekly PDF.');const blob=await res.blob(),href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=name||'SiteLedger-Weekly-Report.pdf';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1000)}catch(e){alert(e.message)}};
  window.slShareWeekly=async(path,name)=>{try{const url=await weeklySigned(path),res=await fetch(url);if(!res.ok)throw new Error('Could not load Weekly PDF.');const blob=await res.blob(),file=new File([blob],name||'SiteLedger-Weekly-Report.pdf',{type:'application/pdf'});if(navigator.share&&navigator.canShare?.({files:[file]}))await navigator.share({title:'SiteLedger Weekly Report',files:[file]});else{const href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=name||'SiteLedger-Weekly-Report.pdf';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1000);alert('The Weekly PDF was downloaded. Attach it to your email from your mail app.')}}catch(e){alert(e.message)}};

  function activate(which){
    document.getElementById('sl-daily-library')?.classList.toggle('hidden',which!=='daily');
    document.getElementById('sl-weekly-library')?.classList.toggle('hidden',which!=='weekly');
    const d=document.getElementById('sl-tab-daily'),w=document.getElementById('sl-tab-weekly');
    d?.classList.toggle('primary',which==='daily');d?.classList.toggle('secondary',which!=='daily');
    w?.classList.toggle('primary',which==='weekly');w?.classList.toggle('secondary',which!=='weekly');
    sessionStorage.setItem('sl_reports_view',which);
  }
  window.slShowDailyReports=()=>activate('daily');
  window.slShowWeeklyReports=()=>activate('weekly');

  async function render(){
    const brand=document.querySelector('.topbar .brand');
    if(!brand||brand.textContent.trim()!=='Reports'||document.getElementById('sl-report-library'))return;
    await ensureWeeklyReports();
    const page=document.querySelector('.page');if(!page)return;
    const [ps,dailies,weeklies]=await Promise.all([projects(),reports(),weeklyRows()]);
    const submitted=dailies.filter(r=>r.submitted).sort((a,b)=>b.log_date.localeCompare(a.log_date));
    const dailyCards=submitted.map(r=>{const p=ps.find(x=>x.id===r.project_id);return `<div class="card"><div class="row"><div><div style="margin-bottom:6px"><span class="badge info">DAILY REPORT</span></div><div class="title">${fmt(r.log_date,{weekday:'long',month:'short',day:'numeric',year:'numeric'})}</div><div class="small">${esc(p?.name||'Project')}</div></div><span class="badge done">Submitted</span></div><div class="actions" style="margin-top:12px"><button class="btn secondary smallbtn" onclick="go('report','${r.id}')">View Report</button>${r.pdf_path?`<button class="btn primary smallbtn" onclick="openPdf('${r.id}','${esc(r.pdf_path)}')">View PDF</button><button class="btn secondary smallbtn" onclick="sharePdf('${r.id}','${esc(r.pdf_path)}')">Share PDF</button>`:`<button class="btn primary smallbtn" onclick="generatePdf('${r.id}')">Generate PDF</button>`}</div></div>`}).join('');
    const weeklyCards=weeklies.map(w=>{const p=ps.find(x=>x.id===w.project_id);const name=`${(p?.name||'Project').replace(/[^a-z0-9]+/gi,'-')}-${w.week_start}-Weekly.pdf`;return `<div class="card"><div class="row"><div><div style="margin-bottom:6px"><span class="badge done">WEEKLY REPORT</span></div><div class="title">${esc(p?.name||'Project')}</div><div class="small">Week of ${fmt(w.week_start,{month:'short',day:'numeric',year:'numeric'})} – ${fmt(w.week_end,{month:'short',day:'numeric',year:'numeric'})}</div></div><span class="badge ${w.pdf_path?'done':'up'}">${w.pdf_path?'Ready':'Generating'}</span></div>${w.pdf_path?`<div class="actions" style="margin-top:12px"><button class="btn primary smallbtn" data-weekly-action="view" data-path="${esc(w.pdf_path)}">View Weekly PDF</button><button class="btn secondary smallbtn" data-weekly-action="download" data-path="${esc(w.pdf_path)}" data-name="${esc(name)}">Download</button><button class="btn secondary smallbtn" data-weekly-action="share" data-path="${esc(w.pdf_path)}" data-name="${esc(name)}">Email / Share</button></div>`:'<div class="small" style="margin-top:10px">This Weekly Report is being generated automatically.</div>'}</div>`}).join('');
    page.innerHTML=`<div id="sl-report-library"><div class="hero"><div class="eyebrow">Report Library</div><h1>Reports</h1><p>Daily Reports document one workday. Weekly Reports summarize the full work week.</p></div><div class="card" style="padding:10px;margin-bottom:16px"><div class="actions" style="margin:0"><button id="sl-tab-daily" class="btn primary" onclick="slShowDailyReports()">Daily Reports (${submitted.length})</button><button id="sl-tab-weekly" class="btn secondary" onclick="slShowWeeklyReports()">Weekly Reports (${weeklies.length})</button></div></div><div id="sl-daily-library"><div class="section">Daily Reports</div>${dailyCards||'<div class="card empty">No submitted Daily Reports yet.</div>'}</div><div id="sl-weekly-library" class="hidden"><div class="section">Weekly Reports</div>${weeklyCards||'<div class="card empty">No Weekly Reports yet.</div>'}</div></div>`;
    page.querySelector('#sl-weekly-library')?.addEventListener('click',e=>{const b=e.target.closest('[data-weekly-action]');if(!b)return;const path=b.dataset.path||'',name=b.dataset.name||'';if(b.dataset.weeklyAction==='view')slOpenWeekly(path);else if(b.dataset.weeklyAction==='download')slDownloadWeekly(path,name);else slShareWeekly(path,name)});
    activate(sessionStorage.getItem('sl_reports_view')==='weekly'?'weekly':'daily');
  }
  let t;function patch(){clearTimeout(t);t=setTimeout(render,80)}
  new MutationObserver(patch).observe(document.documentElement,{childList:true,subtree:true});patch();
})();
