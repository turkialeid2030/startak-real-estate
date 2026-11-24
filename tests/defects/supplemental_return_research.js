'use strict';
const assert=require('node:assert/strict');
const {evaluateAnnualReturnResearch:annual,evaluateGrossRentResearch:gross}=require('../../src/engines/financial/supplemental-return-research');
const scope={caseId:'SYNTH-1',propertyRef:'SYNTH-PROPERTY',asOfDate:'2026-11-25'};
const context={...scope,scope:'PROPERTY',currency:'SAR'};
const evidence={caseId:scope.caseId,propertyRef:scope.propertyRef,sourceRef:'SYNTHETIC-SOURCE',sourceDate:'2026-11-01'};
const cf={...evidence,timing:'ANNUAL_END_OF_YEAR',basis:'OPERATING_ONLY',values:[-1000,600,600]};
const rate={...evidence,unit:'ANNUAL_RATIO',value:0.1};
const input={...context,cashflows:cf,discountRate:rate};
const value=(r,id)=>r.metrics.find(m=>m.id===id).value;
const near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<=t, a+' differs from '+b);
let r=annual(input,scope);
assert.equal(r.status,'ANALYTICAL_ONLY');
assert.equal(value(r,'DISCOUNTED_PAYBACK_PERIOD_END'),2);
const pv=600/1.1+600/1.21;
const npv=Math.round((pv-1000)*100)/100;
near(value(r,'PROFITABILITY_INDEX_CONVENTIONAL'),1+npv/1000);
near(value(r,'EQUIVALENT_ANNUAL_ANNUITY'),npv/(1/1.1+1/1.21));
assert.equal(r.investmentDecisionAuthorized,false);
assert.equal(r.valuationChanged,false);
assert.equal(r.cashflowBasis,'OPERATING_ONLY');
r=annual({...input,discountRate:{...rate,value:0}},scope);
assert.equal(value(r,'EQUIVALENT_ANNUAL_ANNUITY'),100);
assert.equal(value(r,'PROFITABILITY_INDEX_CONVENTIONAL'),1.2);
r=annual({...input,cashflows:{...cf,values:[-1000,100,100]}},scope);
assert.equal(value(r,'DISCOUNTED_PAYBACK_PERIOD_END'),null);
r=annual({...input,cashflows:{...cf,values:[-1000,-100,2000],basis:'INCLUDING_TERMINAL_PROCEEDS'}},scope);
assert.equal(value(r,'PROFITABILITY_INDEX_CONVENTIONAL'),null);
assert.equal(r.cashflowBasis,'INCLUDING_TERMINAL_PROCEEDS');
for(const patch of [{values:[0,100]},{values:[100,100]},{values:[-100,NaN]},{values:[-100,,100]},{values:[-100,'100']},{timing:'MONTHLY'},{sourceDate:'2026-02-30'},{sourceDate:'2026-12-01'},{propertyRef:'OTHER'},{basis:'UNKNOWN'}]){
 assert.equal(annual({...input,cashflows:{...cf,...patch}},scope).status,'HOLD');
}
for(const patch of [{value:undefined},{value:-0.01},{value:1.1},{value:'0.1'},{unit:'PERCENT'}]){
 assert.equal(annual({...input,discountRate:{...rate,...patch}},scope).status,'HOLD');
}
assert.equal(annual(input,{...scope,caseId:'OTHER'}).status,'HOLD');
const price={...evidence,unit:'SAR',basis:'PURCHASE_PRICE',value:2000000};
const rent={...evidence,unit:'SAR_PER_YEAR',basis:'CONTRACTUAL_GROSS_RENT',value:160000,periodStart:'2027-01-01',periodEndExclusive:'2028-01-01'};
const gi={...context,price,annualGrossRent:rent};
r=gross(gi,scope);
near(value(r,'GROSS_RENTAL_YIELD'),0.08);
near(value(r,'GROSS_RENT_MULTIPLIER'),12.5);
assert.equal(r.priceBasis,'PURCHASE_PRICE');
assert.equal(r.rentBasis,'CONTRACTUAL_GROSS_RENT');
assert.equal(r.transactionAuthorized,false);
r=gross({...gi,annualGrossRent:{...rent,value:0}},scope);
assert.equal(value(r,'GROSS_RENTAL_YIELD'),0);
assert.equal(value(r,'GROSS_RENT_MULTIPLIER'),null);
for(const patch of [{value:0},{value:-1},{basis:'UNDECLARED'},{unit:'USD'},{caseId:'OTHER'}]){
 assert.equal(gross({...gi,price:{...price,...patch}},scope).status,'HOLD');
}
for(const patch of [{value:-1},{basis:'NOI'},{periodEndExclusive:'2027-02-01'},{sourceRef:''},{sourceDate:'2026-02-30'}]){
 assert.equal(gross({...gi,annualGrossRent:{...rent,...patch}},scope).status,'HOLD');
}
assert.equal(gross({...gi,currency:'USD'},scope).status,'HOLD');
console.log('SUPPLEMENTAL_RETURN_RESEARCH=PASS');
