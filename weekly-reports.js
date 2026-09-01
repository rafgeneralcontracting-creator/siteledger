// Automatic weekly report generation with a clean Daily / Weekly Reports switcher.
(() => {
  const dateOnly = d => d.toISOString().slice(0,10);
  function monday(s){const d=new Date((s||today)+'T12:00:00');const k=d.getDay();d.setDate(d.getDate()+(k===0?-6:1-k));return dateOnly(d)}
  function plus(s,n){const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return dateOnly(d)}
  async function weeklyRows(){return rest('weekly_reports?select=*&order=week_start.desc')}

  async function ensureWeeklyReports(){
    try{
      const all=await reports(), existing=await weeklyRows(), candidates=new Map();
      for(const r of all){
        if(!r.submitted) continue;
        const ws=monday(r.log_date), we=plus(ws,4);
        if(we>today) continue;
        candidates.set(`${r.project_id}:${ws}`,{project_id:r.project_id,week_start:ws});
      }
      for(const c of candidates.values()){
        if(existing.some(w=>w.project_id===c.project_id&&w.week_start===c.week_start&&w.pdf_path)) continue;
        try{await edge('generate-weekly-report-pdf',c)}catch(e){console.warn('Weekly report generation skipped:',e.message)}
      }
    }catch(e){console.warn('Weekly reports:',e.message)}
  }

  async function weeklySigned(path){return signedUrl('report-pdfs',path)}
  window.slOpenWeekly=async path=>{try{if(!path)return alert('Weekly PDF is not ready yet.');window.open(await weeklySigned(path),'_blank')}catch(e){alert(e.message)}};
  window.slDownloadWeekly=async(path,name)=>{try{if(!path)return alert('Weekly PDF is not ready yet.');const url=await weeklySigned(path),res=await fetch(url);if(!res.ok)throw new Error('Could not download Weekly PDF.');const blob=await res.blob(),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name||'SiteLedger-Weekly-Report.pdf';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}catch(e){alert(e.message)}};
  window.slShareWeekly=async(path,name)=>{try{if(!path)return alert('Weekly PDF is not ready yet.');const url=await weeklySigned(path),res=await fetch(url);if(!res.ok)throw new Error('Could not load Weekly PDF.');const blob=await res.blob(),file=new File([blob],name||'SiteLedger-Weekly-Report.pdf',{type:'application/pdf'});if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({title:'SiteLedger Weekly Report',files:[file]})}else{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name||'SiteLedger-Weekly-Report.pdf';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);alert('The Weekly PDF was downloaded. Attach it to your email from your mail app.')}}catch(e){alert(e.message)}};

  function setView(which){
    const daily=document.getElementById('sl-report-daily-list');
    const weekly=document.getElementById('sl-report-weekly-list');
    const dBtn=document.getElementById('sl-tab-daily');
    const wBtn=document.getElementById('sl-tab-weekly');
    if(!daily||!weekly)return;
    const showWeekly=which==='weekly';
    daily.style.display=showWeekly?'none':'';
    weekly.style.display=showWeekly?'':'none';
    dBtn?.classList.toggle('primary',!showWeekly); dBtn?.classList.toggle('secondary',showWeekly);
    wBtn?.classList.toggle('primary',showWeekly); wBtn?.classList.toggle('secondary',!showWeekly);
    sessionStorage.setItem('sl_reports_view',showWeekly?'weekly':'daily');
  }
  window.slShowDailyReports=()=>setView('daily');
  window.slShowWeeklyReports=()=>setView('weekly');

  async function renderReportsTabs(){
    const brand=document.querySelector('.topbar .brand');
    if(!brand||brand.textContent.trim()!=='Reports'||document.getElementById('sl-report-tabs'))return;
    await ensureWeeklyReports();
    const page=document.querySelector('.page'); if(!page)return;
    const hero=page.querySelector('.hero'); if(!hero)return;
    const dailyWrap=document.createElement('div');
    dailyWrap.id='sl-report-daily-list';
    let node=hero.nextSibling; const move=[];
    while(node){move.push(node);node=node.nextSibling}
    move.forEach(n=>dailyWrap.appendChild(n));
    const ps=await projects(), wr=await weeklyRows();
    const weeklyWrap=document.createElement('div'); weeklyWrap.id='sl-report-weekly-list';
    const cards=wr.map(w=>{
      const p=ps.find(x=>x.id===w.project_id);
      const name=`${(p?.name||'Project').replace(/[^a-z0-9]+/gi,'-')}-${w.week_start}-Weekly.pdf`;
      const path=JSON.stringify(String(w.pdf_path||''));
      const filename=JSON.stringify(name);
      return `<div class="card"><div class="row"><div><div class="title">${esc(p?.name||'Project')}</div><div class="small">${fmt(w.week_start,{month:'short',day:'numeric',year:'numeric'})} – ${fmt(w.week_end,{month:'short',day:'numeric',year:'numeric'})}</div></div><span class="badge ${w.pdf_path?'done':'up'}">${w.pdf_path?'Ready':'Generating'}</span></div>${w.pdf_path?`<div class="actions" style="margin-top:12px"><button class="btn primary smallbtn" data-weekly-action="view" data-path=${esc(path)}>View PDF</button><button class="btn secondary smallbtn" data-weekly-action="download" data-path=${esc(path)} data-name=${esc(filename)}>Download</button><button class="btn secondary smallbtn" data-weekly-action="share" data-path=${esc(path)} data-name=${esc(filename)}>Email / Share</button></div>`:'<div class="small" style="margin-top:10px">This report is being generated automatically.</div>'}</div>`
    }).join('');
    weeklyWrap.innerHTML=`<div class="section">Weekly Reports</div>${cards||'<div class="card empty">Weekly Reports will appear here automatically after each completed work week.</div>'}`;
    weeklyWrap.addEventListener('click',e=>{const b=e.target.closest('[data-weekly-action]');if(!b)return;const path=JSON.parse(b.dataset.path||'""'),name=b.dataset.name?JSON.parse(b.dataset.name):'';if(b.dataset.weeklyAction==='view')slOpenWeekly(path);else if(b.dataset.weeklyAction==='download')slDownloadWeekly(path,name);else slShareWeekly(path,name)});
    const tabs=document.createElement('div'); tabs.id='sl-report-tabs'; tabs.className='card'; tabs.style.padding='10px'; tabs.style.marginBottom='16px';
    tabs.innerHTML=`<div class="actions" style="margin:0"><button id="sl-tab-daily" class="btn primary" onclick="slShowDailyReports()">Daily Reports</button><button id="sl-tab-weekly" class="btn secondary" onclick="slShowWeeklyReports()">Weekly Reports</button></div>`;
    hero.insertAdjacentElement('afterend',tabs); tabs.insertAdjacentElement('afterend',dailyWrap); dailyWrap.insertAdjacentElement('afterend',weeklyWrap);
    setView(sessionStorage.getItem('sl_reports_view')==='weekly'?'weekly':'daily');
  }
  let t;function patch(){clearTimeout(t);t=setTimeout(renderReportsTabs,80)}
  new MutationObserver(patch).observe(document.documentElement,{childList:true,subtree:true}); patch();
  const originalSubmit=window.submitReport;
  if(originalSubmit) window.submitReport=async function(){await originalSubmit();try{const r=(await rest(`daily_reports?select=project_id,log_date,submitted&id=eq.${route.reportId}`))[0];if(r?.submitted&&plus(monday(r.log_date),4)<=today)await edge('generate-weekly-report-pdf',{project_id:r.project_id,week_start:monday(r.log_date)})}catch(e){console.warn(e.message)}};
})();
