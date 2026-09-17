// Keep generated Daily Report PDFs in sync when manpower is edited after submission.
(() => {
  const wrapped = new Set();
  const generating = new Set();

  async function regenerate(reportId){
    if(!reportId || generating.has(reportId)) return;
    generating.add(reportId);
    try{
      const r=(await rest(`daily_reports?select=id,submitted,pdf_path&id=eq.${reportId}&limit=1`))[0];
      if(r?.submitted){
        await edge('generate-report-pdf',{report_id:reportId});
      }
    }catch(e){
      console.warn('Daily PDF refresh:',e?.message||e);
    }finally{
      generating.delete(reportId);
    }
  }

  function wrap(name){
    if(wrapped.has(name) || typeof window[name] !== 'function') return;
    const old=window[name];
    window[name]=async function(...args){
      const reportId=route?.reportId;
      const out=await old.apply(this,args);
      if(reportId) await regenerate(reportId);
      return out;
    };
    wrapped.add(name);
  }

  async function repairMissingCurrentPdf(){
    const brand=document.querySelector('.topbar .brand')?.textContent?.trim();
    const reportId=route?.reportId;
    if(brand!=='Daily Report' || !reportId || generating.has(reportId)) return;
    try{
      const r=(await rest(`daily_reports?select=id,submitted,pdf_path&id=eq.${reportId}&limit=1`))[0];
      if(r?.submitted && !r.pdf_path) await regenerate(reportId);
    }catch(e){}
  }

  let timer;
  function install(){
    wrap('slSaveManualManpower');
    wrap('slSaveEditedManpower');
    wrap('slDeleteManpower');
    clearTimeout(timer);
    timer=setTimeout(repairMissingCurrentPdf,150);
  }

  new MutationObserver(install).observe(document.documentElement,{childList:true,subtree:true});
  install();
})();