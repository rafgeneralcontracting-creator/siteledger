(function(){
  const documents=new Map();
  let owner='';
  const coarse=()=>matchMedia('(pointer:coarse)').matches;
  const identity=()=>typeof me!=='undefined'&&me?String(me.id)+':'+String(me.organization_id||''):'';
  function destroy(entry){entry.promise.then(pdf=>pdf.destroy()).catch(()=>{})}
  function clear(){for(const entry of documents.values())destroy(entry);documents.clear();owner=''}
  function checkOwner(){const next=identity();if(owner!==next){clear();owner=next}}
  function key(d){return [d.id,d.storage_path||'',d.file_size_bytes||0,d.uploaded_at||''].join('|')}
  function trim(active){
    const maxDocs=coarse()?1:2,maxBytes=coarse()?48000000:96000000;
    let total=[...documents.values()].reduce((sum,x)=>sum+x.size,0);
    for(const [id,entry] of documents){if(id===active)continue;if(documents.size<=maxDocs&&total<=maxBytes)break;documents.delete(id);total-=entry.size;destroy(entry)}
  }
  function viewport(base,fit,zoom,dpr,mobile=coarse()){
    const maxPixels=mobile?8000000:16000000,maxEdge=mobile?8192:12000;
    let scale=fit*zoom*Math.max(1,Math.min(2,dpr||1));
    scale=Math.min(scale,Math.sqrt(maxPixels/(base.width*base.height)),maxEdge/Math.max(base.width,base.height));
    // floor keeps rounded canvas dimensions inside the pixel budget.
    return {scale,width:Math.max(1,Math.floor(base.width*scale)),height:Math.max(1,Math.floor(base.height*scale))};
  }
  window.siteLedgerDrawingPerformance={
    viewport,clear,
    has(d){checkOwner();return documents.has(key(d))},
    async load(d,source){
      checkOwner();const id=key(d);
      if(documents.has(id)){const entry=documents.get(id);documents.delete(id);documents.set(id,entry);return entry.promise}
      const entry={size:Number(d.file_size_bytes)||24000000,promise:null};
      entry.promise=(async()=>{await ensureSiteLedgerLibrary('pdf');const src=await source();return pdfjsLib.getDocument(typeof src==='string'?{url:src,rangeChunkSize:262144}:src).promise})().catch(e=>{if(documents.get(id)===entry)documents.delete(id);throw e});
      documents.set(id,entry);trim(id);return entry.promise;
    },
    release(d){const id=key(d),entry=documents.get(id);if(entry&&entry.size>(coarse()?48000000:96000000)){documents.delete(id);destroy(entry)}}
  };
  const oldLogout=window.logout;
  if(oldLogout)window.logout=function(){clear();return oldLogout.apply(this,arguments)};
  window.addEventListener('storage',()=>{if(owner&&owner!==identity())clear()});
})();
