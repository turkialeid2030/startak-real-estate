'use strict';
// Explicit user-provided dated cash flows only. This is intentionally NOT a
// replacement for the canonical annual land development model or its IRR/NPV.
const {parseNumericText}=require('../validation/numeric-text');
const {normalizeCashflows,xnpv,solveDatedXirr,DATED_RETURNS_STATUS}=
 require('./dated-returns');
const REVIEW_VERSION='UNVERIFIED_OWNER_DATED_SCENARIO_V1';
const HOLD='HOLD_INSUFFICIENT_OR_INVALID_DATED_EVIDENCE';
function reviewOwnerDatedScenario({rows=[],annualDiscountRate='',rightsConfirmed=false}={}){
 const fail=(codes)=>Object.freeze({
  version:REVIEW_VERSION,status:HOLD,blockers:Object.freeze([...codes]),xirr:null,xnpvSar:null,
  annualDiscountRate:null,datedCashflowCount:0,independentlyVerified:false,
  boundToCanonicalFinancialStudy:false,canonicalReturnsChanged:false,
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
  professionalValuationAuthorized:false,transactionAuthorized:false,
  disclaimer:'Amounts, dates, completeness and source references are user supplied, not independently verified. This result does not reconcile or replace canonical periodic annual IRR/NPV or the monthly construction financing model.'
 });
}
module.exports={REVIEW_VERSION,reviewOwnerDatedScenario};
