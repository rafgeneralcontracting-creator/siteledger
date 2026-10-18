import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSubscriber} from '../supabase/functions/billing-sync/normalize.mjs';
import {estimate} from '../scripts/cost-model.mjs';
import {readFileSync} from 'node:fs';
const now=Date.parse('2026-10-18T00:00:00Z');
const fixture=(changes={})=>({entitlements:{company_access:{product_identifier:'hamit_team_monthly',expires_date:'2026-11-18T00:00:00Z'}},subscriptions:{hamit_team_monthly:{expires_date:'2026-11-18T00:00:00Z',is_sandbox:false,store:'app_store',period_type:'normal',...changes}}});
test('authoritative trial and paid periods normalize without granting local trials',()=>{
 assert.equal(normalizeSubscriber(fixture(),now).status,'active');
 assert.equal(normalizeSubscriber(fixture({period_type:'trial'}),now).status,'trialing');
 assert.equal(normalizeSubscriber({},now).status,'expired');
});
test('cancellation keeps access until expiry, expiry revokes it',()=>{
 const r=normalizeSubscriber(fixture({unsubscribe_detected_at:'2026-10-18T00:00:00Z'}),now);
 assert.equal(r.status,'active');assert.equal(r.will_renew,false);
 assert.equal(normalizeSubscriber(fixture(),Date.parse('2026-12-01')).status,'expired');
});
test('sandbox, unsupported store, unknown products and malformed dates cannot unlock production',()=>{
 for(const c of [{is_sandbox:true},{is_sandbox:undefined},{store:'stripe'},{expires_date:null},{expires_date:'bad'}])assert.equal(normalizeSubscriber(fixture(c),now).status,'expired');
 const x=fixture();x.entitlements.company_access.product_identifier='made_up';assert.equal(normalizeSubscriber(x,now).status,'expired');
 const y=fixture();y.entitlements.company_access.expires_date='bad';assert.equal(normalizeSubscriber(y,now).status,'expired');
});
test('access uses shorter verified expiry instead of stretching entitlement duration',()=>{
 assert.equal(normalizeSubscriber(fixture({expires_date:'2026-10-17T00:00:00Z'}),now).status,'expired');
});
test('cost model covers fees and reserves, without claiming guaranteed profit',()=>{
 const config=JSON.parse(readFileSync(new URL('../release/billing-config.json',import.meta.url)));
 assert.equal(config.trialDays,3);
 for(const p of config.plans){const m=estimate(p);assert(m.contribution>0);assert(estimate(p,.15).contribution>m.contribution);assert.equal(m.costs.downloads,p.monthlyDownloadGB*.09)}
});
