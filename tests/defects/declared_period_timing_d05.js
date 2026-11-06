'use strict';
const assert=require('node:assert/strict');
const {reviewOwnerDatedScenario}=require('../../src/valuation-intelligence/dated-scenario-review');
const {reconcileDeclaredPeriodTiming}=require('../../src/valuation-intelligence/declared-period-timing');
const rows=[
 ['2026-01-01','-1000'],['2026-12-01','400'],['2027-09-15','400'],['2028-07-01','400']
].map(([date,amount],canonicalPeriod)=>({date,amount,canonicalPeriod:String(canonicalPeriod),sourceReference:'SYNTH/flow/'+canonicalPeriod}));
const ends=['2026-01-01','2027-01-01','2028-01-01','2028-07-01'];
const periods=ends.map((endDate,period)=>({period,startDate:ends[Math.max(0,period-1)],endDate,
 sourceReference:'SYNTH/period/'+period}));
const args={rows,annualDiscountRate:'0.10',rightsConfirmed:true,requireCanonicalReconciliation:true,
 canonicalCashflows:[-1000,400,400,400],requireDeclaredTiming:true,declaredPeriods:periods};
let n=0;const ok=(v,message)=>{assert.ok(v,message);n++};
const inputBefore=JSON.stringify(args),result=reviewOwnerDatedScenario(args);
ok(result.status==='UNVERIFIED_DATED_SCENARIO_CALCULATED','valid 2.5-year declared timeline calculates');
ok(result.declaredPeriodTimingMatched&&result.canonicalAmountReferenceMatched,'amounts and explicit user windows match');
ok(result.declaredTimingReview.periods[3].endDate==='2028-07-01','six-month final period is not rounded to a full year');
ok(!result.canonicalTimingReconciled&&!result.monthlyFinancingReconciled&&!result.boundToCanonicalFinancialStudy,
 'declared dates never claim canonical or monthly-financing reconciliation');
ok(!result.independentlyVerified&&!result.transactionAuthorized&&!result.professionalValuationAuthorized,
 'date agreement cannot certify sources or authorize a transaction');
ok(Object.isFrozen(result.declaredTimingReview.periods[0]),'returned period evidence immutable');
const patchPeriod=(i,changes)=>periods.map((p,j)=>i===j?{...p,...changes}:p);
for(const [changes,code] of [
 [{declaredPeriods:null},'ALL_DECLARED_PERIOD_WINDOWS_REQUIRED'],
 [{declaredPeriods:periods.slice(1)},'ALL_DECLARED_PERIOD_WINDOWS_REQUIRED'],
 [{declaredPeriods:patchPeriod(1,{period:2})},'DECLARED_PERIOD_ID_OR_ORDER_INVALID'],
 [{declaredPeriods:patchPeriod(0,{startDate:'2025-12-31'})},'DECLARED_PERIOD_WINDOWS_NOT_CONTIGUOUS_OR_ORDERED'],
 [{declaredPeriods:patchPeriod(2,{startDate:'2027-01-02'})},'DECLARED_PERIOD_WINDOWS_NOT_CONTIGUOUS_OR_ORDERED'],
 [{declaredPeriods:patchPeriod(2,{startDate:'2026-12-31'})},'DECLARED_PERIOD_WINDOWS_NOT_CONTIGUOUS_OR_ORDERED'],
 [{declaredPeriods:patchPeriod(1,{endDate:'2026-02-29'})},'DECLARED_PERIOD_DATE_INVALID'],
 [{declaredPeriods:patchPeriod(2,{sourceReference:''})},'DECLARED_PERIOD_SOURCE_REQUIRED'],
 [{rows:rows.map((r,i)=>i===3?{...r,date:'2028-07-02'}:r)},'CASHFLOW_DATE_OUTSIDE_DECLARED_PERIOD'],
 [{rows:rows.map((r,i)=>i===1?{...r,date:'2026-01-01'}:r)},'CASHFLOW_DATE_OUTSIDE_DECLARED_PERIOD'],
 [{requireCanonicalReconciliation:false},'DECLARED_TIMING_REQUIRES_AMOUNT_RECONCILIATION']
]){
 const held=reviewOwnerDatedScenario({...args,...changes});
 ok(held.status.startsWith('HOLD')&&held.xirr===null&&held.xnpvSar===null&&held.blockers.includes(code),code);
}
const boundary=reviewOwnerDatedScenario({...args,rows:rows.map((r,i)=>i===1?{...r,date:'2027-01-01'}:r)});
ok(boundary.declaredPeriodTimingMatched,'period end included');
const legacy=reviewOwnerDatedScenario({...args,requireDeclaredTiming:false,declaredPeriods:null});
ok(legacy.status==='UNVERIFIED_DATED_SCENARIO_CALCULATED'&&!legacy.declaredPeriodTimingMatched,
 'amount-only path unchanged and makes no timing claim');
ok(JSON.stringify(args)===inputBefore,'date checks never alter original rows or source references');
ok(reconcileDeclaredPeriodTiming(null,periods,4).ok===false,'malformed direct input held');
console.log('D05_DECLARED_PERIOD_TIMING=PASS checks='+n);
