(function(){
const oldSet=window.setRfiMarkupTool;
const oldStart=window.startDrawingAnnotation;
function syncNavClass(t){document.body.classList.toggle('sl-rfi-navigation',t==='navigate')}
window.setRfiMarkupTool=function(t){syncNavClass(t);return oldSet?oldSet(t):null};
window.startDrawingAnnotation=async function(m){const out=oldStart?await oldStart(m):null;if(m==='rfi'){window.setRfiMarkupTool('navigate');requestAnimationFrame(installNavigateButton)}return out};
function installNavigateButton(){const bar=document.getElementById('sl_rfi_session_bar');if(!bar)return;if(!document.getElementById('sl_rfi_nav_tool')){const strong=bar.querySelector('strong');const btn=document.createElement('button');btn.id='sl_rfi_nav_tool';btn.className='sl-rfi-tool';btn.textContent='✋ Navigate';btn.title='Pan, scroll and zoom without adding markup';btn.onclick=()=>window.setRfiMarkupTool('navigate');strong?.after(btn)}const nav=document.getElementById('sl_rfi_nav_tool');if(nav)nav.classList.toggle('active',document.body.classList.contains('sl-rfi-navigation'))}
const originalSet=window.setRfiMarkupTool;window.setRfiMarkupTool=function(t){const r=originalSet(t);requestAnimationFrame(()=>{syncNavClass(t);installNavigateButton();const nav=document.getElementById('sl_rfi_nav_tool');if(nav)nav.classList.toggle('active',t==='navigate')});return r};
new MutationObserver(()=>requestAnimationFrame(installNavigateButton)).observe(document.getElementById('app'),{childList:true,subtree:true});
document.addEventListener('click',e=>{if(e.target?.id==='sl_rfi_nav_tool')syncNavClass('navigate')});
})();