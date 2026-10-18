'use strict';
const deletionForm=document.getElementById('deletion-form');
deletionForm.addEventListener('submit',async event=>{
 event.preventDefault();const button=document.getElementById('submit'),status=document.getElementById('status');button.disabled=true;status.textContent='Verifying your account…';
 const email=document.getElementById('email').value.trim(),password=document.getElementById('password');
 let access='';
 try{
  const base='https://zgigfgtujebjvoehbrar.supabase.co',key='sb_publishable_kmK4_KhS2_erhEw9Sb07uA_N2mOFJKm';
  const auth=await fetch(base+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email,password:password.value})});
  password.value='';const session=await auth.json();if(!auth.ok)throw Error('Could not sign in. Check your email and password.');access=session.access_token;
  const response=await fetch(base+'/rest/v1/rpc/request_account_deletion',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+access,'Content-Type':'application/json'},body:JSON.stringify({p_scope:document.getElementById('scope').value})});
  const result=await response.json();if(!response.ok)throw Error(result.message||'Could not record the request.');
  status.textContent='Deletion request recorded. Reference: '+result.id+'. Your account has not been deleted yet. Support will contact you about processing. Cancel any store subscription separately.';deletionForm.hidden=true;
 }catch(error){password.value='';status.textContent=error.message;button.disabled=false}
 finally{if(access)await fetch('https://zgigfgtujebjvoehbrar.supabase.co/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:'sb_publishable_kmK4_KhS2_erhEw9Sb07uA_N2mOFJKm',Authorization:'Bearer '+access}}).catch(()=>{});access=''}
});
