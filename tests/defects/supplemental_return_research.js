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
// QA15: no false recovery when initial investment or discounted balance rounds to zero.
for(const values of [[-0.004,0],[-1000,600.001,600],[-0.005,0.01]]){
 const rejected=annual({...input,cashflows:{...cf,values}},scope);
 assert.equal(rejected.status,'HOLD');assert.ok(rejected.blockers.includes('RETURN_CASHFLOW_PRECISION_INVALID'));assert.equal(rejected.metrics.length,0);
}
for(const [values,discount,expected] of [[[-0.01,0],0,null],[[-0.01,0.01],0,1],[[-0.01,0.01],0.1,null],[[-1,0.5,0.5],0,2],[[-1000,1100],0.1,1],[[-1000,1099.99],0.1,null]]){
 const tested=annual({...input,cashflows:{...cf,values},discountRate:{...rate,value:discount}},scope);
 assert.equal(tested.status,'ANALYTICAL_ONLY');assert.equal(value(tested,'DISCOUNTED_PAYBACK_PERIOD_END'),expected);assert.equal(tested.transactionAuthorized,false);
}

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
const {evaluateWaccResearch:wacc,evaluateBreakEvenResearch:be,evaluateHoldingReturnResearch:holding,evaluatePortfolioReturnResearch:portfolio}=require('../../src/engines/financial/supplemental-return-research');
const capital={...evidence,basis:'MARKET_VALUE_CAPITAL_STRUCTURE',unit:'SAR_AND_ANNUAL_RATIOS',taxShieldBasis:'EXPLICIT_EFFECTIVE_TAX_SHIELD',debt:400,equity:600,costOfDebt:0.05,costOfEquity:0.12,effectiveTaxShieldRate:0.2};
const wi={...context,capital};
r=wacc(wi,scope);near(value(r,'WACC'),0.088);assert.equal(r.investmentDecisionAuthorized,false);
near(value(wacc({...wi,capital:{...capital,taxShieldBasis:'NO_TAX_SHIELD',effectiveTaxShieldRate:0}},scope),'WACC'),0.092);
for(const patch of [{debt:0,equity:0},{debt:-1},{costOfDebt:undefined},{costOfEquity:12},{taxShieldBasis:'NO_TAX_SHIELD'},{effectiveTaxShieldRate:-1},{basis:'BOOK_VALUE'},{sourceDate:'2026-11-26'}])assert.equal(wacc({...wi,capital:{...capital,...patch}},scope).status,'HOLD');
const activity={...evidence,basis:'SINGLE_ACTIVITY_LINEAR_COST',unit:'SAR_AND_UNITS',periodStart:'2026-01-01',periodEndExclusive:'2027-01-01',fixedCost:1000,unitPrice:100,variableCostPerUnit:60,units:40,unitName:'synthetic service'};
const bi={...context,activity};r=be(bi,scope);near(value(r,'PROJECT_BREAK_EVEN_UNITS'),25);near(value(r,'PROJECT_BREAK_EVEN_REVENUE'),2500);near(value(r,'MARGIN_OF_SAFETY'),0.375);
near(value(be({...bi,activity:{...activity,units:10}},scope),'MARGIN_OF_SAFETY'),-1.5);
assert.equal(value(be({...bi,activity:{...activity,variableCostPerUnit:100}},scope),'PROJECT_BREAK_EVEN_REVENUE'),null);
assert.equal(value(be({...bi,activity:{...activity,units:0}},scope),'MARGIN_OF_SAFETY'),null);
for(const patch of [{fixedCost:-1},{unitPrice:0},{units:-1},{variableCostPerUnit:'60'},{periodEndExclusive:'2026-01-01'},{sourceRef:''},{propertyRef:'OTHER'}])assert.equal(be({...bi,activity:{...activity,...patch}},scope).status,'HOLD');
const h={...evidence,sourceDate:'2026-11-24',periodStart:'2024-11-24',periodEnd:'2026-11-24',basis:'OPENING_CLOSING_VALUE_CASH_DISTRIBUTIONS_NO_EXTERNAL_CAPITAL',unit:'SAR',openingValue:1000,closingValue:1210,cashDistributions:100,externalCapitalFlows:false};
const inflation={...evidence,sourceDate:'2026-11-24',periodStart:h.periodStart,periodEnd:h.periodEnd,unit:'CUMULATIVE_PERIOD_RATIO',value:0.1};
const hi={...context,holding:h,inflation};r=holding(hi,scope);near(value(r,'HOLDING_PERIOD_RETURN'),0.31);near(value(r,'VALUE_ONLY_CAGR'),Math.pow(1.21,365.2425/730)-1);near(value(r,'REAL_HOLDING_PERIOD_RETURN'),1.31/1.1-1);
assert.equal(value(holding({...hi,inflation:null},scope),'REAL_HOLDING_PERIOD_RETURN'),null);
for(const patch of [{externalCapitalFlows:true},{externalCapitalFlows:undefined},{openingValue:0},{closingValue:-1},{cashDistributions:-1},{periodEnd:'2026-12-01'},{sourceDate:'2026-11-23'}])assert.equal(holding({...hi,holding:{...h,...patch}},scope).status,'HOLD');
for(const patch of [{value:-1},{periodStart:'2025-11-24'},{sourceDate:'2026-11-23'},{unit:'ANNUAL_RATIO'}])assert.equal(holding({...hi,inflation:{...inflation,...patch}},scope).status,'HOLD');
const ps={portfolioId:'SYNTH-PORTFOLIO',asOfDate:scope.asOfDate,assetIds:['A','B']};
const m={...h,portfolioId:ps.portfolioId,currency:'SAR'};
const pi={scope:'PORTFOLIO',currency:'SAR',portfolioId:ps.portfolioId,asOfDate:ps.asOfDate,periodStart:h.periodStart,periodEnd:h.periodEnd,members:[{...m,assetId:'A'},{...m,assetId:'B',openingValue:3000,closingValue:2700,cashDistributions:0}]};
r=portfolio(pi,ps);near(value(r,'PORTFOLIO_HOLDING_PERIOD_RETURN'),0.0025);near(r.members[0].openingWeight,0.25);near(r.members[1].openingWeight,0.75);assert.equal(r.transactionAuthorized,false);
for(const patch of [{assetId:'A'},{assetId:'C'},{currency:'USD'},{externalCapitalFlows:true},{periodStart:'2025-11-24'},{portfolioId:'OTHER'},{sourceDate:'2026-11-23'}])assert.equal(portfolio({...pi,members:[pi.members[0],{...pi.members[1],...patch}]},ps).status,'HOLD');
assert.equal(portfolio(pi,{...ps,assetIds:['A','C']}).status,'HOLD');
assert.equal(portfolio({...pi,members:[pi.members[0]]},ps).status,'HOLD');
const {reviewSupplementalText,blankSupplementalInput,MAX_BYTES}=require('../../src/engines/financial/supplemental-research-input');
assert.equal(reviewSupplementalText({method:'annual',text:JSON.stringify(input),expected:scope}).status,'ANALYTICAL_ONLY');
assert.equal(reviewSupplementalText({method:'annual',text:JSON.stringify(blankSupplementalInput('annual',scope)),expected:scope}).status,'HOLD');
assert.equal(reviewSupplementalText({method:'portfolio',text:JSON.stringify(blankSupplementalInput('portfolio',ps)),expected:ps}).status,'HOLD');
for(const [method,raw] of [['constructor','{}'],['annual','{"__proto__":{}}'],['annual','{broken'],['annual',' '.repeat(MAX_BYTES+1)]]){
 const rejected=reviewSupplementalText({method,text:raw,expected:scope});
 assert.equal(rejected.status,'HOLD');assert.equal(rejected.transactionAuthorized,false);assert.deepEqual(rejected.metrics,[]);
}
console.log('SUPPLEMENTAL_RETURN_RESEARCH=PASS');
