import * as pdf from 'pdfjs-dist/legacy/build/pdf.mjs';
export function getDocument(input){
  const options=typeof input==='string'?{url:input}:input instanceof Uint8Array||input instanceof ArrayBuffer?{data:input}:input;
  const task=pdf.getDocument({cMapUrl:'vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'vendor/standard_fonts/',wasmUrl:'vendor/wasm/',...options,isEvalSupported:false});
  const promise=task.promise.then(document=>{
    // Preserve the existing viewer cleanup contract after PDF.js 6 removed proxy.destroy().
    document.destroy=()=>task.destroy();return document;
  });
  return {promise,destroy:()=>task.destroy(),get onProgress(){return task.onProgress},set onProgress(value){task.onProgress=value}};
}
if(typeof window!=='undefined')window.pdfjsLib={...pdf,getDocument};
