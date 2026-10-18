import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {normalizeSubscriber} from './normalize.mjs';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:cors});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const key=Deno.env.get('REVENUECAT_SECRET_KEY'),hookSecret=Deno.env.get('REVENUECAT_WEBHOOK_AUTH');
  if(!key)return json({error:'Subscription verification is not configured. No access was granted.'},503);
  const auth=req.headers.get('Authorization')||'';
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  let customerId:string;
  if(hookSecret&&auth===hookSecret){
   const body=await req.json();customerId=String(body?.event?.app_user_id||'');
  }else{
   const {data,error}=await admin.auth.getUser(auth.replace(/^Bearer\s+/i,''));
   if(error||!data.user)return json({error:'Unauthorized'},401);
   const {data:p,error:pe}=await admin.from('profiles').select('organization_id,role,active').eq('id',data.user.id).single();
   if(pe||!p.active||p.role!=='owner')return json({error:'Only an active company owner may manage billing'},403);
   const {data:b,error:be}=await admin.from('company_billing').select('customer_id').eq('organization_id',p.organization_id).single();
   if(be)return json({error:'Initialize company billing first'},409);customerId=b.customer_id;
  }
  if(!/^[0-9a-f-]{36}$/i.test(customerId))return json({error:'Invalid billing identity'},400);
  const {data:company,error:ce}=await admin.from('company_billing').select('organization_id').eq('customer_id',customerId).maybeSingle();
  if(ce)throw ce;if(!company)return json({error:'Billing identity not found'},404);
  // Re-fetch authoritative state for every webhook: duplicates and late events cannot resurrect old purchases.
  const syncStarted=new Date().toISOString();
  const response=await fetch('https://api.revenuecat.com/v1/subscribers/'+encodeURIComponent(customerId),{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(10000)});
  if(!response.ok)return json({error:'Could not verify the store subscription'},502);
  const body=await response.json(),state=normalizeSubscriber(body.subscriber);
  const {error:update}=await admin.from('company_billing').update({...state,verified_at:syncStarted}).eq('organization_id',company.organization_id).or('verified_at.is.null,verified_at.lt.'+syncStarted);
  if(update)throw update;
  return json({ok:true,status:state.status});
 }catch{ return json({error:'Could not synchronize subscription status'},500) }
});
