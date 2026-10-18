const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {File} = require('node:buffer');
async function run() {
  const alerts = [], downloads = [], shares = [];
  let online = true, fetched = 0, mode = 'ok', markup = '', saved = null;
  const d = {id:'d',storage_path:'p/d.pdf',original_filename:'A-101 Rev 2.pdf'};
  const ctx = {File, Blob, console, navigator:{get onLine(){return online;},canShare:()=>true,share:async data=>{shares.push(data);if(mode==='cancel')throw Object.assign(new Error(),{name:'AbortError'});}},
    URL:{createObjectURL:()=> 'blob:file',revokeObjectURL(){}},setTimeout(){},route:{screen:'home'},
    document:{createElement:()=>({click(){downloads.push(this.download);},remove(){}}),body:{appendChild(){}},querySelectorAll:()=>[]},
    rest:async()=>{if(!online)throw new Error('offline');return [d];}, signedUrl:async()=> 'signed',
    fetch:async()=>{fetched++;return {ok:mode!=='fail',blob:async()=>new Blob(['pdf'],{type:'application/pdf'})};},
    siteLedgerOfflineDrawing:{record:async()=>saved},esc:s=>s,modal:s=>{markup=s;},closeModal(){},alert:s=>alerts.push(s),addEventListener(){}};
  ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('drawing-file-actions.js','utf8'),ctx);
  const b={textContent:'Download',disabled:false};
  await ctx.downloadProjectDrawing('d',b);assert.deepEqual(downloads,['A-101 Rev 2.pdf']);assert.equal(b.disabled,false);
  await ctx.prepareProjectDrawingShare('d',b);assert.match(markup,/Share File/);assert.equal(shares.length,0);
  await ctx.sharePreparedProjectDrawing(b);assert.equal(shares[0].files[0].name,'A-101 Rev 2.pdf');
  mode='cancel';await ctx.sharePreparedProjectDrawing(b);assert.equal(alerts.length,0);
  saved={...d,blob:new Blob(['cached'])};online=false;const before=fetched;
  await ctx.downloadProjectDrawing('d',b);assert.equal(fetched,before);
  online=true;saved=null;mode='fail';await ctx.downloadProjectDrawing('d',b);assert.equal(alerts.length,1);assert.equal(b.disabled,false);
  console.log('PASS named file downloads, prepared native sharing, cancellation, offline export and error recovery');
}
run().catch(e=>{console.error(e);process.exit(1);});
