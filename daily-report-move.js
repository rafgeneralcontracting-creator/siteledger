(function(){
function canMove(){return ['owner','admin'].includes(String(me?.role||'').toLowerCase())}
window.openMoveDailyReport=async function(){
  if(!canMove())return alert('Only an Owner or Admin can move a Daily Report.');
  try{
    const r=(await rest(`daily_reports?select=id,project_id,log_date,submitted&id=eq.${route.reportId}&limit=1`))[0];
    if(!r)return alert('Daily Report not found.');
    const ps=await projects(),opts=ps.map(p=>`<option value="${p.id}" ${p.id===r.project_id?'selected':''}>${esc(p.name)}</option>`).join('');
    modal(`<h2>Move Daily Report</h2><div class="small" style="margin-bottom:14px">Move this ${r.log_date} report, including its photos, manpower, deliveries, issues and attachments, to the correct project.</div><div class="field"><label>Project</label><select id="sl_move_report_project">${opts}</select></div><div class="field"><label>Report Date</label><input id="sl_move_report_date" type="date" value="${r.log_date}"></div>${r.submitted?'<div class="notice warn">This report is already submitted. Its old PDF will be cleared and a new PDF will be generated for the correct project.</div>':''}<div class="actions"><button class="btn secondary" onclick="closeModal()">Cancel</button><button id="sl_move_report_go" class="btn primary" onclick="moveDailyReportNow()">Move Report</button></div>`);
  }catch(e){alert(e.message)}
};
window.moveDailyReportNow=async function(){
  const target=$('sl_move_report_project')?.value,date=$('sl_move_report_date')?.value,btn=$('sl_move_report_go');
  if(!target)return;
  if(!confirm('Move this Daily Report to the selected project?'))return;
  btn.disabled=true;btn.textContent='Moving…';
  try{
    const before=(await rest(`daily_reports?select=submitted&id=eq.${route.reportId}&limit=1`))[0];
    await rest('rpc/move_daily_report',{method:'POST',body:JSON.stringify({p_report_id:route.reportId,p_target_project_id:target,p_target_date:date})});
    closeModal();
    if(before?.submitted){
      try{await edge('generate-report-pdf',{report_id:route.reportId})}catch(e){console.warn('Moved report; PDF regeneration failed',e)}
    }
    await reportPage();
    alert('Daily Report moved to the correct project.');
  }catch(e){btn.disabled=false;btn.textContent='Move Report';alert(e.message)}
};
async function decorate(){
  if(route?.screen!=='report'||!route.reportId||!canMove())return;
  const page=document.querySelector('.page');if(!page||page.querySelector('#sl_move_report_btn'))return;
  const back=[...page.querySelectorAll('button')].find(b=>b.textContent.includes('Back'));
  if(!back)return;
  const b=document.createElement('button');b.id='sl_move_report_btn';b.className='btn secondary smallbtn';b.style.marginLeft='8px';b.textContent='Move Report';b.onclick=openMoveDailyReport;back.insertAdjacentElement('afterend',b);
}
let t;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(()=>decorate().catch(console.error),80)}).observe(document.getElementById('app'),{childList:true,subtree:true});
})();