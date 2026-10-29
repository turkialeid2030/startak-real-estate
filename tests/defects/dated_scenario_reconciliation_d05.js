'use strict';
const assert=require('node:assert/strict');
const {reviewOwnerDatedScenario,reconcileCanonicalPeriodAmounts}=
 require('../../src/valuation-intelligence/dated-scenario-review');
const rows=[
 {date:'2026-01-01',amount:'-1,000.01',sourceReference:'synthetic/acquisition',canonicalPeriod:'0'},
 {date:'2027-01-01',amount:'١٬١٠٠٫٠١',sourceReference:'synthetic/receipt',canonicalPeriod:'1'}
];
const canonical=[-1000.01,1100.01],original=JSON.stringify({rows,canonical});
const evaluate=(r=rows,c=canonical)=>reviewOwnerDatedScenario({rows:r,annualDiscountRate:'0.1',
 rightsConfirmed:true,requireCanonicalReconciliation:true,canonicalCashflows:c});
let checks=0;
const ok=(v,m)=>{assert.ok(v,m);checks++};
const result=evaluate();
ok(result.status==='UNVERIFIED_DATED_SCENARIO_CALCULATED','matched sourced amounts calculate');
ok(result.boundToCanonicalFinancialStudy===true,'explicitly matched reference is identified');
ok(result.amountReconciliation.periods.every(x=>x.differenceSar===0),'each period reconciles to halalas');
ok(result.canonicalTimingReconciled===false&&result.monthlyFinancingReconciled===false,
 'amounts cannot establish construction timing or monthly financing reconciliation');
ok(result.canonicalReturnsChanged===false&&!result.transactionAuthorized&&!result.professionalValuationAuthorized,
 'no change to canonical economics or authority');
ok(result.dayCount==='ACT/365.2425','day-count convention stays explicit');
ok(Object.isFrozen(result.amountReconciliation.periods[0]),'reconciliation evidence is immutable');
for(const [r,c,code] of [
 [rows,null,'CANONICAL_CASHFLOWS_UNAVAILABLE'],
 [rows,[NaN,1100.01],'CANONICAL_CASHFLOWS_UNAVAILABLE'],
 [rows,[-1000.01,1100.01,0],'ALL_CANONICAL_PERIODS_MUST_BE_MAPPED'],
 [[{...rows[0],canonicalPeriod:''},rows[1]],canonical,'CANONICAL_PERIOD_MAPPING_REQUIRED'],
 [[{...rows[0],canonicalPeriod:'00'},rows[1]],canonical,'CANONICAL_PERIOD_MAPPING_REQUIRED'],
 [[{...rows[0],canonicalPeriod:'-1'},rows[1]],canonical,'CANONICAL_PERIOD_MAPPING_REQUIRED'],
 [[{...rows[0],canonicalPeriod:'2'},rows[1]],canonical,'CANONICAL_PERIOD_MAPPING_INVALID'],
 [[rows[0],{...rows[1],canonicalPeriod:'0'}],canonical,'ALL_CANONICAL_PERIODS_MUST_BE_MAPPED'],
 [[rows[0],{...rows[1],amount:'1100.02'}],canonical,'CANONICAL_PERIOD_AMOUNTS_DO_NOT_RECONCILE'],
 [[rows[0],{...rows[1],amount:'1100.014'}],canonical,'CANONICAL_RECONCILIATION_REQUIRES_HALALA_AMOUNTS']
]){
 const held=evaluate(r,c);
 ok(held.status.startsWith('HOLD')&&held.xirr===null&&held.xnpvSar===null&&held.blockers.includes(code),code);
}
const split=[{...rows[0],amount:'-500'}, {...rows[0],date:'2026-02-01',amount:'-500.01'},rows[1]];
ok(evaluate(split).amountReconciliation.periods[0].suppliedAmountSar===-1000.01,
 'multiple explicitly dated payments may map to one annual reference period');
ok(reconcileCanonicalPeriodAmounts(null,canonical).ok===false,'malformed row list fails closed');
ok(JSON.stringify({rows,canonical})===original,'reconciliation never mutates sources');
ok(evaluate(rows,[-999.01,1100.01]).status.startsWith('HOLD'),
 'changed canonical reference cannot reuse a previously matched result');
console.log('D05_CANONICAL_AMOUNT_RECONCILIATION=PASS checks='+checks);
