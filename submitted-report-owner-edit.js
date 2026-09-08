(function(){
function canEditSubmitted(){return ['owner','admin'].includes(String(me?.role||'').toLowerCase())}
function sectionCard(title){
  const sec=[...document.querySelectorAll('.section')].find(x=>x.textContent.trim()===title);
  if(!sec)return null;
  let n=sec.nextElementSibling;
  while(n&& !n.classList?.contains('card'))n=n.nextElementSibling;
  return n;
}
async function patch(){
  if(route?.screen!=='report'||!route.reportId||!canEditSubmitted())return;
  let r=null;try{r=(await rest(`daily_reports?select=id,submitted,log_date&id=eq.${route.reportId}&limit=1`))[0]}catch(e){}
  if(!r?.submitted||r.log_date>today)return;
  const page=document.querySelector('.page');if(!page)return;

  page.querySelectorAll('input[disabled],textarea[disabled],select[disabled]').forEach(el=>el.removeAttribute('disabled'));
  page.querySelectorAll('input,textarea,select').forEach(el=>{
    if(!el.getAttribute('onchange')&&el.closest('.field')){
      const label=el.closest('.field')?.querySelector('label')?.textContent?.trim();
      const map={
        'General Conditions':'general_conditions',
        'Work Performed':'work_performed',
        'Areas / Floors':'areas_floors',
        'Delays / Impacts':'delays_impacts',
        'Visitors / Inspections':'visitors_inspections',
        'Safety Notes':'safety_notes',
        "Tomorrow's Plan":'tomorrow_plan'
      };
      if(map[label])el.onchange=()=>saveField(map[label],el.value);
    }
  });

  const locked=[...page.querySelectorAll('.notice')].find(x=>/submitted and locked/i.test(x.textContent||''));
  if(locked)locked.textContent='This report is submitted. You can still edit it.';

  const noWork=[...page.querySelectorAll('.title')].find(x=>x.textContent.trim()==='No Work Today')?.closest('.toggle')?.querySelector('.switch');
  if(noWork)noWork.onclick=()=>toggleNoWork();

  const mp=sectionCard('Work & Manpower');
  if(mp&&!mp.querySelector('.sl-owner-add-manpower')){
    const b=document.createElement('button');b.className='btn secondary block sl-owner-add-manpower';b.textContent='+ Add Manpower';b.onclick=()=>manpowerForm();mp.appendChild(b);
  }
  const ph=sectionCard('Progress Photos');
  if(ph&&!ph.querySelector('.sl-owner-add-photo')){
    const b=document.createElement('button');b.className='btn secondary block sl-owner-add-photo';b.style.marginTop='12px';b.textContent='+ Add Progress Photos';b.onclick=()=>photoForm();ph.appendChild(b);
  }
  const di=sectionCard('Deliveries & Issues');
  if(di&&!di.querySelector('.sl-owner-add-delivery')){
    const b1=document.createElement('button');b1.className='btn secondary block sl-owner-add-delivery';b1.textContent='+ Add Delivery';b1.onclick=()=>deliveryForm();di.appendChild(b1);
    const b2=document.createElement('button');b2.className='btn secondary block sl-owner-add-issue';b2.textContent='+ Report Issue';b2.onclick=()=>issueForm();di.appendChild(b2);
  }
}
let t;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(()=>patch().catch(console.error),80)}).observe(document.getElementById('app'),{childList:true,subtree:true});patch();
})();