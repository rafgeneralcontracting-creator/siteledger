(function(){
async function addHistory(){
 if(route?.screen!=='project'||!route.projectId)return;
 const page=document.querySelector('.page');if(!page||page.querySelector('#sl-report-history'))return;
 const rs=(await reports(route.projectId)).sort((a,b)=>b.log_date.localeCompare(a.log_date));
 const weekSet=new Set(week||[]);
 const older=rs.filter(r=>!weekSet.has(r.log_date));
 if(!older.length)return;
 const section=document.createElement('div');section.id='sl-report-history';
 section.innerHTML=`<div class="section">Earlier Daily Reports</div>${older.map(r=>{const s=status(r);return `<div class="card click" onclick="go('report','${r.id}')"><div class="row"><div><div class="title">${fmt(r.log_date,{weekday:'short',month:'short',day:'numeric',year:'numeric'})}</div><div class="small">Daily field report</div></div><span class="badge ${s[1]}">${s[0]}</span></div></div>`}).join('')}`;
 const submitted=[...page.querySelectorAll('.section')].find(x=>x.textContent.trim()==='Submitted Reports');
 if(submitted)submitted.insertAdjacentElement('beforebegin',section);else page.appendChild(section);
}
let t;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(()=>addHistory().catch(console.error),80)}).observe(document.getElementById('app'),{childList:true,subtree:true});})();