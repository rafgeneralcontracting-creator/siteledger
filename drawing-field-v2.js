(function(){
  const q=id=>document.getElementById(id);
  function hideLegacy(){
    const bar=document.querySelector('.sl-takeoffbar'); if(!bar||q('sl_field_toolbar')) return;
    [...bar.children].forEach(el=>el.style.display='none');
    const field=document.createElement('div'); field.id='sl_field_toolbar'; field.className='sl-field-toolbar';
    field.innerHTML=
      '<button id="sl_field_pan" class="sl-field-btn active" onclick="slFieldPan()">✋<span>Pan</span></button>'+
      '<button id="sl_field_markup" class="sl-field-btn" onclick="slFieldMarkup()">✎<span>Markup</span></button>'+
      '<button id="sl_field_rfi" class="sl-field-btn rfi" onclick="slFieldRfi()">☁<span>RFI</span></button>'+
      '<button id="sl_field_measure" class="sl-field-btn" onclick="slFieldMeasureMenu()">↔<span>Measure</span></button>';
    bar.appendChild(field);
  }
  function active(id){
    document.querySelectorAll('.sl-field-btn').forEach(b=>b.classList.remove('active'));
    q(id)?.classList.add('active');
  }
  window.slFieldPan=function(){ try{ window.cancelRfiMarkup?.(); window.cancelDrawingMarkup?.(); window.cancelDrawingTool?.(); active('sl_field_pan'); }catch(e){} };
  window.slFieldMarkup=function(){ active('sl_field_markup'); try{ window.startDrawingMarkup?.('pen'); }catch(e){ active('sl_field_pan'); alert(e?.message||'Could not start markup.'); } };
  window.slFieldRfi=async function(){
    active('sl_field_rfi');
    try{
      const ok=await window.startDrawingAnnotation?.('rfi');
      if(ok===false) active('sl_field_pan');
    }catch(e){ active('sl_field_pan'); alert(e?.message||'Could not start RFI markup.'); }
  };
  window.slFieldMeasureMenu=function(){
    active('sl_field_measure');
    modal('<h2>Measure Drawing</h2><div class="sl-measure-menu">'+
      '<button onclick="slChooseMeasure(\'distance\')"><b>↔ Distance</b><span>Measure a length</span></button>'+
      '<button onclick="slChooseMeasure(\'area\')"><b>▱ Area</b><span>Measure square footage</span></button>'+
      '<button onclick="slChooseMeasure(\'perimeter\')"><b>⌁ Perimeter</b><span>Measure around an area</span></button>'+
      '<button onclick="slChooseMeasure(\'count\')"><b>● Count</b><span>Count fixtures or items</span></button>'+
      '<button onclick="slChooseMeasure(\'calibrate\')"><b>⌖ Set Scale</b><span>Calibrate this sheet first</span></button>'+
      '<button onclick="slChooseMeasure(\'verify\')"><b>✓ Check Scale</b><span>Verify against another dimension</span></button>'+
      '</div><div class="actions"><button class="btn secondary" onclick="closeModal();slFieldPan()">Cancel</button></div>');
  };
  window.slChooseMeasure=function(mode){ closeModal(); window.startDrawingTool?.(mode); active('sl_field_measure'); };
  function sync(){
    if(route?.screen!=='drawing'||!q('sl_canvas_wrap')) return;
    hideLegacy();
    const rfiBar=q('sl_rfi_session_bar');
    if(rfiBar) active('sl_field_rfi');
  }
  new MutationObserver(()=>requestAnimationFrame(sync)).observe(document.getElementById('app'),{childList:true,subtree:true});
  sync();
})();