(function(){
  const loads=new Map();
  const libs={
    pdf:{url:'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',ready:()=>window.pdfjsLib},
    export:{url:'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',ready:()=>window.jspdf?.jsPDF},
    zip:{url:'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',ready:()=>window.JSZip}
  };
  window.ensureSiteLedgerLibrary=function(name){
    const lib=libs[name];
    if(!lib)return Promise.reject(new Error('Unknown library: '+name));
    if(lib.ready())return Promise.resolve(lib.ready());
    if(loads.has(name))return loads.get(name);
    const job=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src=lib.url;script.async=true;
      const timer=setTimeout(()=>fail(),20000);
      function fail(){clearTimeout(timer);script.remove();reject(new Error('Could not load '+name+' tools. Check your connection and try again.'))}
      script.onerror=fail;
      script.onload=()=>{clearTimeout(timer);if(!lib.ready())return fail();if(name==='pdf')window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';resolve(lib.ready())};
      document.head.appendChild(script);
    }).catch(e=>{loads.delete(name);throw e});
    loads.set(name,job);return job;
  };
})();
