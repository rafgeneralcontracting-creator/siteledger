const products={hamit_starter_monthly:'starter',hamit_team_monthly:'team',hamit_business_monthly:'business'};
export function normalizeSubscriber(subscriber,now=Date.now()){
 const e=subscriber?.entitlements?.company_access;
 if(!e)return {plan:null,status:'expired',expires_at:null,will_renew:false,store:null};
 const s=subscriber.subscriptions?.[e.product_identifier];
 const product=String(e.product_identifier||'').split(':')[0],plan=products[product];
 const expires=Date.parse(e.expires_date),subscriptionExpires=Date.parse(s?.expires_date);
 // Only store-verified subscriptions qualify; sandbox purchases never unlock production.
 if(!s||s.is_sandbox!==false||!plan||!Number.isFinite(expires)||!Number.isFinite(subscriptionExpires)||!['app_store','play_store'].includes(s.store))return {plan:null,status:'expired',expires_at:null,will_renew:false,store:null};
 const until=Math.min(expires,subscriptionExpires);
 return {plan,status:until>now?(s.period_type==='trial'?'trialing':'active'):'expired',expires_at:new Date(until).toISOString(),will_renew:!s.unsubscribe_detected_at&&!s.billing_issues_detected_at,store:s.store};
}
