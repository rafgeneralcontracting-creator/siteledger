const CACHE='siteledger-v117';
const SHELL=["./", "./index.html", "./manifest.webmanifest", "./icon.svg", "./styles.css?v=12", "./drawings.css?v=4", "./drawing-workspace.css?v=3", "./drawing-scroll.css?v=5", "./drawing-annotations.css?v=2", "./drawing-ux-v1.css?v=1", "./drawing-field-v2.css?v=3", "./drawing-markup-tools.css?v=3", "./rfi-markup.css?v=1", "./rfi-navigation.css?v=1", "./daily-log-enhancements.css?v=1", "./lazy-libraries.js?v=1", "./app.js?v=17", "./profile-session-fix.js?v=1", "./photo-picker-fix.js?v=1", "./project-controls.js?v=1", "./drawing-coordinate-fix.js?v=2", "./drawing-scale-apply.js?v=1", "./drawing-offline.js?v=3", "./drawing-performance.js?v=1", "./drawings.js?v=14", "./drawing-folder-enhancements.js?v=3", "./drawing-zip-upload.js?v=4", "./drawing-delete.js?v=1", "./drawing-move.js?v=1", "./drawing-workspace.js?v=2", "./drawing-calibration-status.js?v=3", "./drawing-ux-v1.js?v=4", "./rfi.js?v=3", "./rfi-export.js?v=7", "./rfi-response-pdf-audit.js?v=3", "./rfi-photos.js?v=3", "./email-settings.js?v=3", "./rfi-email.js?v=3", "./submittals-v2.js?v=3", "./submittal-distribution.js?v=4", "./submittals-nav-fix.js?v=3", "./drawing-annotations.js?v=7", "./rfi-markup-v4.js?v=10", "./rfi-hires-attach-fix.js?v=3", "./rfi-navigation.js?v=2", "./drawing-field-v2.js?v=3", "./drawing-markup-tools.js?v=9", "./drawing-scroll.js?v=5", "./rfi-modal-fix.js?v=1", "./rfi-response-display.js?v=1", "./submittal-review-ack.js?v=1", "./team-invite-direct.js?v=1", "./team-management.js?v=4", "./team-invite-cancel.js?v=1", "./rfi-public-response.js?v=2", "./daily-log-enhancements.js?v=1", "./daily-autofill-cleanup.js?v=1", "./daily-work-simplify.js?v=3", "./weekly-reports.js?v=8", "./manpower-simple.js?v=8", "./manpower-delete-fix.js?v=1", "./daily-report-reminders.js?v=1", "./daily-photo-batch.js?v=1", "./daily-report-move.js?v=2", "./project-report-history.js?v=1", "./submitted-report-owner-edit.js?v=3"];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(async cache=>{
    // Parallel batches avoid serial network round trips on every update.
    for(let i=0;i<SHELL.length;i+=8)await Promise.all(SHELL.slice(i,i+8).map(url=>cache.add(url).catch(()=>{})));
  }).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('siteledger-v')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',e=>{
  const request=e.request,u=new URL(request.url);
  if(request.method!=='GET'||u.hostname.includes('supabase.co'))return;
  const local=u.origin===self.location.origin;
  const versioned=local&&u.searchParams.has('v')&&/\.(js|css)$/.test(u.pathname);
  const library=u.origin==='https://cdnjs.cloudflare.com'&&/\/(pdf\.js|jspdf|jszip)\//.test(u.pathname);
  if(!local&&!library)return;
  async function network(cache){
    const response=await fetch(request);
    if(response.ok||response.type==='opaque')e.waitUntil(cache.put(request,response.clone()).catch(()=>{}));
    return response;
  }
  e.respondWith(caches.open(CACHE).then(async cache=>{
    if(versioned||library){const hit=await cache.match(request);if(hit)return hit;return network(cache)}
    try{return await network(cache)}catch(error){
      const hit=await cache.match(request);if(hit)return hit;
      if(request.mode==='navigate'){const shell=await cache.match('./index.html');if(shell)return shell}
      throw error;
    }
  }));
});
