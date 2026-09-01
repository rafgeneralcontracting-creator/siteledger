// Automatic weekly report generation + PDF access.
(() => {
  const day = 86400000;
  const dateOnly = d => d.toISOString().slice(0,10);
  function monday(s){const d=new Date((s||today)+'T12:00:00');const k=d.getDay();d.setDate(d.getDate()+(k===0?-6:1-k));return dateOnly(d)}
  function plus(s,n){const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return dateOnly(d)}
  async function weeklyRows(){return rest('weekly_reports?select=*&order=week_start.desc')}
  async function ensureWeeklyReports(){
    try{
      const ps=await projects(), all=await reports(), existing=await weeklyRows();
      const candidates=new Map();
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
  window.slOpenWeekly=async path=>{try{window.open(await weeklySigned(path),'_blank')}catch(e){alert(e.message)}};
  window.slDownloadWeekly=async(path,name)=>{try{const url=await weeklySigned(path),a=document.createElement('a');a.href=url;a.download=name||'SiteLedger-Weekly-Report.pdf';document.body.appendChild(a);a.click();a.remove()}catch(e){alert(e.message)}};
  window.slShareWeekly=async(path,name)=>{try{const url=await weeklySigned(path),res=await fetch(url),blob=await res.blob(),file=new File([blob],name||'SiteLedger-Weekly-Report.pdf',{type:'application/pdf'});if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({title:'SiteLedger Weekly Report',files:[file]})}else{await slDownloadWeekly(path,name);alert('The PDF was downloaded. Attach it to your email from your mail app.')}}catch(e){alert(e.message)}};
  async function renderWeeklySection(){
    const brand=document.querySelector('.topbar .brand');
    if(!brand||brand.textContent.trim()!=='Reports'||document.getElementById('sl-weekly-reports'))return;
    await ensureWeeklyReports();
    const ps=await projects(),wr=await weeklyRows();
    const page=document.querySelector('.page');if(!page)return;
    const dailySection=[...page.querySelectorAll('.hero')][0];
    const block=document.createElement('div');block.id='sl-weekly-reports';
    const cards=wr.map(w=>{const p=ps.find(x=>x.id===w.project_id),name=`${(p?.name||'Project').replace(/[^a-z0-9]+/gi,'-')}-${w.week_start}-Weekly.pdf`;return `<div class="card"><div class="row"><div><div class="title">${esc(p?.name||'Project')}</div><div class="small">Week of ${fmt(w.week_start,{month:'short',day:'numeric',year:'numeric'})} – ${fmt(w.week_end,{month:'short',day:'numeric'})}</div></div><span class="badge done">Weekly PDF</span></div><div class="actions" style="margin-top:12px"><button class="btn primary smallbtn" onclick="slOpenWeekly('${esc(w.pdf_path||'')}')">View PDF</button><button class="btn secondary smallbtn" onclick="slDownloadWeekly('${esc(w.pdf_path||'')}','${esc(name)}')">Download</button><button class="btn secondary smallbtn" onclick="slShareWeekly('${esc(w.pdf_path||'')}','${esc(name)}')">Email / Share</button></div></div>`}).join('');
    block.innerHTML=`<div class="section">Weekly Reports</div>${cards||'<div class="card empty">Weekly PDFs will appear automatically after a work week has submitted Daily Logs.</div>'}`;
    dailySection?.insertAdjacentElement('afterend',block);
  }
  let t;function patch(){clearTimeout(t);t=setTimeout(renderWeeklySection,80)}
  new MutationObserver(patch).observe(document.documentElement,{childList:true,subtree:true});
  patch();
  const originalSubmit=window.submitReport;
  if(originalSubmit) window.submitReport=async function(){await originalSubmit();try{const r=(await rest(`daily_reports?select=project_id,log_date,submitted&id=eq.${route.reportId}`))[0];if(r?.submitted&&plus(monday(r.log_date),4)<=today)await edge('generate-weekly-report-pdf',{project_id:r.project_id,week_start:monday(r.log_date)})}catch(e){console.warn(e.message)}};
})();
