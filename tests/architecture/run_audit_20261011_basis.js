'use strict';
const assert=require('node:assert/strict');
const {calculateUiInvestmentState}=require('../../src/assumptions/ui-integration-controller');
const {buildPersonalFinancialStudy,htmlFinancialStudy,verifyPersonalFinancialStudy}=require('../../src/app/personal-financial-study');
const {geometryReview}=require('../../src/app/capitalization-basis');
const {validateSavedDealRecord}=require('../../src/validation/saved-deal-schema');
const {projectDealRecord}=require('../../src/storage/saved-deals-backup');
const {simulateConstructionFacility}=require('../../src/engines/financial');
const gold=require('../reference/RE-GOLD-baseline.json');
let checks=0;
function check(fn){fn();checks++;}
for(const [mode,key,metric] of [['building','RE-GOLD-002_existing_building','marketValueByIncomeCap'],['land','RE-GOLD-001_land_development','marketValueAfterCompletion']]){
 const inputs={...gold[key].inputs,replacementReservePerSqm:20};
 const run=extra=>calculateUiInvestmentState({mode,inputs:{...inputs,...extra},assumptionModelVersion:'LEGACY'}).results;
 const legacy=run({}),after=run({marketCapNoiBasis:'AFTER_RESERVE'}),before=run({marketCapNoiBasis:'BEFORE_RESERVE'});
 check(()=>assert.equal(legacy[metric],after[metric]));
 check(()=>assert.equal(legacy.incomeCapBasis.explicitlySelected,false));
 check(()=>assert.equal(before[metric],before.noiBeforeReserve/inputs.marketCapRate));
 check(()=>assert.ok(Math.abs((before[metric]-after[metric])-before.replacementReserveAmount/inputs.marketCapRate)<1e-6));
 check(()=>assert.deepEqual(before.cashflows,after.cashflows));
 check(()=>assert.equal(before.irr,after.irr));
 check(()=>assert.equal(before.incomeCapBasis.professionalReleaseAuthorized,false));
 for(const invalid of [null,'',true,{},'INVALID'])check(()=>assert.throws(()=>run({marketCapNoiBasis:invalid})));
 const deal={id:'basis-test',name:'حالة اختبار',mode,inputs:{...inputs,marketCapNoiBasis:'BEFORE_RESERVE'}};
 check(()=>assert.equal(validateSavedDealRecord(deal),deal));
 check(()=>assert.equal(projectDealRecord(deal).inputs.marketCapNoiBasis,'BEFORE_RESERVE'));
 check(()=>assert.throws(()=>validateSavedDealRecord({...deal,inputs:{...inputs,marketCapNoiBasis:'INVALID'}})));
 const report=buildPersonalFinancialStudy({mode,inputs:deal.inputs,assumptionModelVersion:'LEGACY'});
 check(()=>assert.ok(verifyPersonalFinancialStudy(report)));
 check(()=>assert.ok(htmlFinancialStudy(report).includes('اختيار مستخدم؛ غير متحقق منه مستقلاً')));
 check(()=>assert.equal(report.financial.results.incomeCapBasis.basis,'BEFORE_RESERVE'));
}
check(()=>assert.equal(geometryReview('building',{landLength:10,landWidth:20,basementCount:1,basementAreaEach:201}),'BASEMENT_FOOTPRINT_REQUIRES_RIGHTS_AND_PERMIT_REVIEW'));
check(()=>assert.equal(geometryReview('building',{landLength:10,landWidth:20,basementCount:0,basementAreaEach:201}),'NO_BASEMENT_FOOTPRINT_EXCEPTION_DETECTED'));
// Separate floating-point reconstruction; never calls production precision helpers.
// Matches the declared beginning-of-month draw and monthly rounding convention.
for(const years of [1,1.25,2,2.5])for(const fraction of [0,0.3,0.6,1])for(const rate of [0,0.06,0.12]){
 const data={landCost:20000000,constructionCost:40000000,debtFraction:fraction,annualRate:rate,constructionYears:years};
 const actual=simulateConstructionFacility(data),months=Math.round(years*12);
 const cents=x=>Math.round(x*100)/100;
 let balance=cents(data.landCost*fraction),interestTotal=0;
 const principal=cents(data.constructionCost*fraction);
 const low=Math.floor(Math.round(principal*100)/months),remainder=Math.round(principal*100)-low*months;
 for(let i=0;i<months;i++){
   const draw=(low+(i<remainder?1:0))/100;
   const interest=cents((balance+draw)*rate/12);
   balance=cents(balance+draw+interest);interestTotal=cents(interestTotal+interest);
   check(()=>assert.ok(Math.abs(actual.schedule[i].balance-balance)<0.02));
 }
 check(()=>assert.ok(Math.abs(actual.completionBalance-balance)<0.02));
 check(()=>assert.ok(Math.abs(actual.capitalizedInterest-interestTotal)<0.02));
}
console.log(`AUDIT_20261011_BASIS=PASS checks=${checks}`);
