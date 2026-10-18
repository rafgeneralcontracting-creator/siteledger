import {readFile,writeFile} from 'node:fs/promises';
const config=JSON.parse(await readFile(new URL('../release/billing-config.json',import.meta.url)));
// Conservative marginal rates charge every included GB, without allocating shared free quotas.
// Egress is an explicit allowance/scenario, not measured historical usage.
export function estimate(plan,storeFee=.30){
 const costs={trialAcquisitionReserve:9,storage:plan.storageGB*.0213,downloads:plan.monthlyDownloadGB*.09,backupStorage:plan.storageGB*.03,ai:plan.monthlyAIScans*.10,support:({starter:10,team:20,business:40})[plan.id],compute:({starter:5,team:10,business:20})[plan.id],refundReserve:plan.monthlyPrice*.03,billingService:plan.monthlyPrice*.01,storeFee:plan.monthlyPrice*storeFee};
 const total=Object.values(costs).reduce((a,b)=>a+b,0);return {plan:plan.id,price:plan.monthlyPrice,costs,total,contribution:plan.monthlyPrice-total,contributionMargin:(plan.monthlyPrice-total)/plan.monthlyPrice};
}
if(process.argv.includes('--write')){
 const report={asOf:'2026-10-18',measurement:{organizations:2,activeUsers:4,projects:6,files:1111,storageBytes:5741008239,databaseBytes:21965971},assumptions:{storeFeeBase:.30,storeFeeReduced:.15,refundReserve:.03,revenueCat:.01,aiBudgetPerScan:.10,fixedMonthlyBudget:200,developmentMonthlyBudget:2000,trialConversion:.25},standard:config.plans.map(p=>estimate(p)),reduced:config.plans.map(p=>estimate(p,.15))};
 await writeFile(new URL('../release/cost-model.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}
