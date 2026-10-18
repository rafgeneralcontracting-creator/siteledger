import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { Purchases } from '@revenuecat/purchases-capacitor';
import config from '../release/billing-config.json';

let customer='',packages=[],busy=false;
const platform=Capacitor.getPlatform();
const configuredKey=platform==='ios'?config.revenueCatApplePublicKey:config.revenueCatGooglePublicKey;
async function ready(){
 if(!configuredKey)throw Error('Subscriptions are awaiting store setup. No trial or charge has started.');
 const id=await rest('rpc/company_billing_identity',{method:'POST',body:'{}'});
 if(customer===id)return;
 if((await Purchases.isConfigured()).isConfigured)await Purchases.logIn({appUserID:id});
 else await Purchases.configure({apiKey:configuredKey,appUserID:id});
 customer=id;
}
async function sync(){await edge('billing-sync',{});return rest('rpc/company_billing_context',{method:'POST',body:'{}'})}
async function manage(){
 const {customerInfo}=await Purchases.getCustomerInfo();
 const link=customerInfo.managementURL||(platform==='ios'?'https://apps.apple.com/account/subscriptions':'https://play.google.com/store/account/subscriptions');
 const u=new URL(link);if(u.protocol!=='https:'||!['apps.apple.com','play.google.com'].includes(u.hostname))throw Error('Invalid subscription management address.');
 await Browser.open({url:u.href});
}
window.hamitBilling={
 async open(){
  try{
   const context=await rest('rpc/company_billing_context',{method:'POST',body:'{}'});
   if(!context.owner){alert('Your company owner manages the subscription. You do not need a separate purchase.');return}
   await ready();const offerings=await Purchases.getOfferings();
   packages=(offerings.current?.availablePackages||[]).filter(x=>config.plans.some(p=>x.product.identifier.split(':')[0]===p.productId));
   if(!packages.length)throw Error('Company subscription plans are not available from the store yet.');
   let eligibility={};if(platform==='ios')eligibility=await Purchases.checkTrialOrIntroductoryPriceEligibility({productIdentifiers:packages.map(x=>x.product.identifier)});
   const cards=packages.map((pack,index)=>{
    const product=pack.product,plan=config.plans.find(p=>product.identifier.split(':')[0]===p.productId);
    const appleTrial=platform==='ios'&&eligibility[product.identifier]?.status===2&&product.introPrice?.price===0&&product.introPrice?.periodNumberOfUnits===3&&product.introPrice?.periodUnit==='DAY';
    const googleTrial=platform==='android'&&product.defaultOption?.freePhase?.billingPeriod?.iso8601==='P3D';
    const trial=appleTrial||googleTrial;
    if(product.subscriptionPeriod!=='P1M')return '';
    return `<div class="card"><h2>${esc(plan.name)}</h2><p>${esc(product.priceString)} / month · one company</p><p>${plan.members} members · ${plan.activeProjects} active projects · ${plan.storageGB} GB storage · ${plan.monthlyAIScans} AI scans/month</p><p>${trial?'3 days free, then '+esc(product.priceString)+' per month unless cancelled.':'Renews at '+esc(product.priceString)+' per month unless cancelled. No trial is confirmed for this account.'}</p><button class="btn primary block" onclick="hamitBilling.purchase(${index})">${trial?'Start 3-day free trial':'Subscribe monthly'}</button></div>`;
   }).join('');
   shell('Company subscription',`<button class="btn secondary" onclick="openAccountSettings()">← Account</button><div class="hero"><h1>Choose your company plan</h1><p>The store confirms eligibility, price and renewal date before you subscribe. Cancel in your store subscription settings before renewal; Apple recommends at least 24 hours before a trial ends.</p></div>${cards}<button class="btn secondary block" onclick="hamitBilling.restore()">Restore purchases</button><button class="btn secondary block" onclick="hamitBilling.manage()">Manage or cancel subscription</button><p><a target="_blank" rel="noopener" href="https://rafgeneralcontracting-creator.github.io/siteledger/public/privacy.html">Privacy policy</a> · <a target="_blank" rel="noopener" href="https://rafgeneralcontracting-creator.github.io/siteledger/public/terms.html">Terms of service</a></p>`,'home');
  }catch(e){alert(e.message||'Could not load plans.')}
 },
 async purchase(index){
  if(busy)return;busy=true;
  try{await ready();const pack=packages[index];if(!pack)throw Error('Select a current plan.');await Purchases.purchasePackage({aPackage:pack});const result=await sync();if(!result.access)throw Error('Purchase received. Subscription verification is pending; use Restore purchases to retry.');alert('Company subscription verified.');await openAccountSettings()}
  catch(e){if(!e.userCancelled)alert(e.message||'Could not complete subscription.')}
  finally{busy=false}
 },
 async restore(){if(busy)return;busy=true;try{await ready();await Purchases.restorePurchases();const b=await sync();alert(b.access?'Company subscription restored.':'No active company subscription was verified.');await openAccountSettings()}catch(e){alert(e.message||'Could not restore purchases.')}finally{busy=false}},
 async manage(){try{await ready();await manage()}catch(e){alert(e.message)}},
 reset(){customer='';packages=[]}
};
