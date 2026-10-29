'use strict';
// Explicit user-provided dated cash flows only. This is intentionally NOT a
// replacement for the canonical annual land development model or its IRR/NPV.
const {parseNumericText}=require('../validation/numeric-text');
const {normalizeCashflows,xnpv,solveDatedXirr,DATED_RETURNS_STATUS}=
 require('./dated-returns');
const REVIEW_VERSION='UNVERIFIED_OWNER_DATED_SCENARIO_V3';
const {reconcileDeclaredPeriodTiming}=require('./declared-period-timing');
const HOLD='HOLD_INSUFFICIENT_OR_INVALID_DATED_EVIDENCE';
const {toMoney,fromMoney}=require('../engines/financial/precision');
function reconcileCanonicalPeriodAmounts(rows,canonicalCashflows){
 if(!Array.isArray(rows)||rows.length<2||rows.length>36)return {ok:false,blocker:'DATED_ROWS_COUNT_INVALID'};
 if(!Array.isArray(canonicalCashflows)||canonicalCashflows.length<2||canonicalCashflows.length>36||
   !canonicalCashflows.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=1e12))
  return {ok:false,blocker:'CANONICAL_CASHFLOWS_UNAVAILABLE'};
 const totals=canonicalCashflows.map(()=>0n),counts=canonicalCashflows.map(()=>0);
 for(const row of rows){
  const raw=row?.canonicalPeriod;
  if(!/^(0|[1-9]\d*)$/.test(String(raw??'')))return {ok:false,blocker:'CANONICAL_PERIOD_MAPPING_REQUIRED'};
  const i=Number(raw),amount=parseNumericText(row.amount);
  if(i>=totals.length||!amount.ok||Math.abs(amount.value)>1e12)
   return {ok:false,blocker:'CANONICAL_PERIOD_MAPPING_INVALID'};
  if(Math.abs(amount.value-fromMoney(toMoney(amount.value)))>1e-8)
   return {ok:false,blocker:'CANONICAL_RECONCILIATION_REQUIRES_HALALA_AMOUNTS'};
  totals[i]+=toMoney(amount.value);counts[i]++;
 }
 if(counts.some(x=>x===0))return {ok:false,blocker:'ALL_CANONICAL_PERIODS_MUST_BE_MAPPED'};
 const periods=canonicalCashflows.map((amount,i)=>({period:i,canonicalAmountSar:fromMoney(toMoney(amount)),
  suppliedAmountSar:fromMoney(totals[i]),differenceSar:fromMoney(totals[i]-toMoney(amount))}));
 if(periods.some(x=>x.differenceSar!==0))return {ok:false,blocker:'CANONICAL_PERIOD_AMOUNTS_DO_NOT_RECONCILE'};
 return Object.freeze({ok:true,status:'MATCHED_CANONICAL_PERIOD_AMOUNTS_ONLY',
  periods:Object.freeze(periods.map(Object.freeze)),timingReconciled:false,monthlyFinancingReconciled:false});
}
function reviewOwnerDatedScenario({rows=[],annualDiscountRate='',rightsConfirmed=false,
 requireCanonicalReconciliation=false,canonicalCashflows=null,
 requireDeclaredTiming=false,declaredPeriods=null}={}){
 const fail=(codes)=>Object.freeze({
  version:REVIEW_VERSION,status:HOLD,blockers:Object.freeze([...codes]),xirr:null,xnpvSar:null,
  annualDiscountRate:null,datedCashflowCount:0,independentlyVerified:false,
  boundToCanonicalFinancialStudy:false,canonicalReturnsChanged:false,
  canonicalAmountReferenceMatched:false,declaredPeriodTimingMatched:false,
  canonicalTimingReconciled:false,monthlyFinancingReconciled:false,
  professionalValuationAuthorized:false,transactionAuthorized:false
 });
 if(rightsConfirmed!==true)return fail(['EXPLICIT_DATA_RIGHTS_AND_EVIDENCE_ATTESTATION_REQUIRED']);
 if(!Array.isArray(rows)||rows.length<2||rows.length>36)return fail(['DATED_ROWS_COUNT_INVALID']);
 const discount=parseNumericText(annualDiscountRate);
 if(!discount.ok||discount.value<0||discount.value>=1)return fail(['ANNUAL_DISCOUNT_RATE_INVALID_EXPECT_DECIMAL_0_TO_LESS_THAN_1']);
 const prepared=[];
 for(const r of rows){
  if(!r||typeof r.date!=='string'||typeof r.sourceReference!=='string'||
    !r.sourceReference.trim()||r.sourceReference.length>240)
    return fail(['SOURCE_REFERENCE_REQUIRED']);
  const amount=parseNumericText(r.amount);
  if(!amount.ok||Math.abs(amount.value)>1e12)return fail(['CASHFLOW_AMOUNT_INVALID']);
  prepared.push({date:r.date,amount:amount.value});
 }
 const reconciliation=requireCanonicalReconciliation===true?
  reconcileCanonicalPeriodAmounts(rows,canonicalCashflows):null;
 if(reconciliation&&!reconciliation.ok)return fail([reconciliation.blocker]);
 if(requireDeclaredTiming===true&&requireCanonicalReconciliation!==true)
  return fail(['DECLARED_TIMING_REQUIRES_AMOUNT_RECONCILIATION']);
 const timing=requireDeclaredTiming===true?
  reconcileDeclaredPeriodTiming(rows,declaredPeriods,canonicalCashflows.length):null;
 if(timing&&!timing.ok)return fail([timing.blocker]);
 const dated=normalizeCashflows(prepared);
 if(!dated||dated.length<2)return fail(['DATED_CASHFLOWS_INVALID_OR_NOT_DISTINCT']);
 // Avoid silently certifying unrelated or partially sourced flows.
 const solved=solveDatedXirr({cashflows:dated});
 if(solved.status!==DATED_RETURNS_STATUS.QUALIFIED)
  return fail(solved.blockers.map(x=>'SOLVER_'+x));
 const netPresent=xnpv(discount.value,dated);
 if(!Number.isFinite(netPresent))return fail(['DATED_XNPV_NOT_FINITE']);
 return Object.freeze({
  version:REVIEW_VERSION,status:'UNVERIFIED_DATED_SCENARIO_CALCULATED',
  blockers:Object.freeze([]),xirr:solved.xirr,xnpvSar:netPresent,
  annualDiscountRate:discount.value,datedCashflowCount:dated.length,
  residualNpvSar:solved.residualNpvSar,dayCount:solved.dayCount,
  sourceReferencesUserAttested:true,independentlyVerified:false,
  boundToCanonicalFinancialStudy:false,canonicalReturnsChanged:false,
  canonicalAmountReferenceMatched:requireCanonicalReconciliation===true,
  amountReconciliation:reconciliation,
  declaredPeriodTimingMatched:requireDeclaredTiming===true,
  declaredTimingReview:timing,
  canonicalTimingReconciled:false,monthlyFinancingReconciled:false,
  professionalValuationAuthorized:false,transactionAuthorized:false,
  disclaimer:'Amounts, dates, completeness and source references are user supplied, not independently verified. This result does not reconcile or replace canonical periodic annual IRR/NPV or the monthly construction financing model.'
 });
}
module.exports={REVIEW_VERSION,reviewOwnerDatedScenario,reconcileCanonicalPeriodAmounts};
