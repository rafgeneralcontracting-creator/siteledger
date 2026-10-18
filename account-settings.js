(function(){
 const policyBase='https://rafgeneralcontracting-creator.github.io/siteledger/public/';
 window.openAccountSettings=async function(){
  try{
   const b=await rest('rpc/company_billing_context',{method:'POST',body:'{}'});
   const status=b.internal_access?'Internal company access':b.status==='unsubscribed'?'No active subscription':`${b.status}${b.expires_at?' through '+new Date(b.expires_at).toLocaleDateString():''}${b.will_renew?' · renews automatically':' · does not renew'}`;
   shell('Account & subscription',`<button class="btn secondary" onclick="go('home')">← Home</button><div class="hero"><h1>Account & subscription</h1><p>${esc(org?.name||'Your company')}</p></div><div class="card"><h2>Company plan</h2><p>${esc(status)}</p><p>Eligible new subscribers receive 3 days free, then the selected monthly subscription renews automatically unless cancelled.</p><button class="btn primary block" onclick="window.hamitBilling?hamitBilling.open():alert('Subscriptions are not available in this build yet.')">${b.owner?'View plans & manage subscription':'View subscription'}</button></div><div class="card"><h2>Privacy & support</h2><p><a href="${policyBase}privacy.html" target="_blank" rel="noopener">Privacy policy</a> · <a href="${policyBase}terms.html" target="_blank" rel="noopener">Terms</a> · <a href="${policyBase}support.html" target="_blank" rel="noopener">Support</a></p><button class="btn secondary block" onclick="openDeletionForm()">Delete account</button></div>`,'home');
  }catch(e){alert(e.message||'Could not load account settings.')}
 };
 window.openDeletionForm=function(){
  modal(`<h2>Request permanent deletion</h2><p>Your login, profile and connected mailbox credentials are included. Shared construction records may remain with your company. Owners can request company deletion. This is processed after verification; it does not cancel a store subscription.</p><div class="field"><label for="delete_scope">Delete</label><select id="delete_scope"><option value="account">My account</option>${me?.role==='owner'?'<option value="company">My account and company workspace</option>':''}</select></div><div class="field"><label for="delete_password">Confirm your password</label><input id="delete_password" type="password" autocomplete="current-password"></div><p id="delete_status" role="status"></p><button class="btn primary block" id="delete_submit" onclick="submitDeletionRequest()">Submit deletion request</button>`);
 };
 window.submitDeletionRequest=async function(){
  const button=$('delete_submit'),password=$('delete_password'),status=$('delete_status');button.disabled=true;
  try{
   const u=await api('/auth/v1/user',{headers:{Authorization:'Bearer '+token}});
   const session=await api('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email:u.email,password:password.value})});password.value='';
   if(session.user?.id!==me.id)throw Error('Account verification failed.');saveSession(session);
   const result=await rest('rpc/request_account_deletion',{method:'POST',body:JSON.stringify({p_scope:$('delete_scope').value})});
   closeModal();alert('Deletion request recorded. Reference: '+result.id+'. Your account is not deleted yet. Cancel any store subscription separately.');
  }catch(e){password.value='';status.textContent=e.message||'Could not record request.';button.disabled=false}
 };
 function decorate(){if(route?.screen!=='home'||!me||$('hamit_account_settings'))return;const signout=document.querySelector('[onclick="logout()"]');if(!signout)return;const b=document.createElement('button');b.id='hamit_account_settings';b.className='btn secondary block';b.style.marginBottom='10px';b.textContent='Account & subscription';b.onclick=openAccountSettings;signout.before(b)}
 window.addEventListener('sl:screen-mounted',decorate);
})();
