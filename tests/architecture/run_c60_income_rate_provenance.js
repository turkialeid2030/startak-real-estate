'use strict';
const assert=require('node:assert/strict');
const {STATUS,assessMarketRateProvenance}=require('../../src/valuation-intelligence/market-rate-provenance');
function sale(id,priceSar,annualNetOperatingIncomeSar,override={}){
 return {
  transactionRef:id,transactionStatus:'EXECUTED_SALE',assetClass:'OFFICE',city:'Riyadh',
  transactionDate:'2026-06-01',sourceProviderRef:'TEST-OFFICIAL',
  sourceEvidenceRef:'SRC-'+id,sourceArtifactSha256:'c'.repeat(64),
  sourceRightsEvidenceRef:'RIGHTS-'+id,sourceVerificationReviewerRef:'TEST-INDEPENDENT',
  reviewedAt:'2026-08-20',incomeBasis:'NET_OPERATING_INCOME_ANNUAL_SAR',
  incomeTreatment:'LANDLORD_NET_OPERATING',noiNormalizationEvidenceRef:'NOI-'+id,
  leasingEvidenceRef:'RENT-ROLL-'+id,
  priceSar,grossAnnualRentalSar:annualNetOperatingIncomeSar+200000,
  vacancyLossSar:50000,landlordOperatingExpensesSar:150000,
  normalizedNetAdjustmentsSar:0,annualNetOperatingIncomeSar,...override,
 };
}
const policy={
 minExecutedTransactions:2,maxComparableAgeDays:365,
 maxEntryMedianDeviationBps:50,maxRateReconciliationErrorBps:1,
 stressNoiShockPercent:0.10,stressCapShockBps:100,
};
const rateMethodology={
 entryReviewMethodRef:'TEST-MEDIAN-RATE',entryReviewedByRef:'TEST-VALUER',entryEvidenceRef:'ENTRY-SALES',
 exitReviewMethodRef:'TEST-FORWARD-EXIT',exitReviewedByRef:'TEST-VALUER-2',exitEvidenceRef:'EXIT-SCENARIO',
 exitFutureRiskRationale:'Synthetic underwriting explicitly assumes modest higher future yields.',
 discountReviewMethodRef:'TEST-BUILDUP',discountReviewedByRef:'TEST-RATE-VALUER',discountEvidenceRef:'RISK-BUILDUP',
 reviewedAt:'2026-09-05',discountRateComponents:{
   referenceRate:0.04,propertyRiskPremium:0.06,liquidityRiskPremium:0.02,otherRiskPremium:0,
 },
 discountRateComponentEvidence:{
   referenceRate:'TEST-GOVT-YIELD',propertyRiskPremium:'TEST-RENT-RISK',
   liquidityRiskPremium:'TEST-LIQUIDITY',otherRiskPremium:'TEST-OTHER',
 },
};
const base={
 assetClass:'OFFICE',city:'Riyadh',valuationDate:'2026-09-01',asOf:'2026-10-08',
 comparables:[sale('T-1',10000000,700000),sale('T-2',15000000,1200000)],
 entryCapRate:0.075,exitCapRate:0.08,discountRate:0.12,
 terminalNoiSar:1200000,rateMethodology,policy,
};
const ready=assessMarketRateProvenance(base);
assert.equal(ready.status,STATUS.READY_FOR_EXTERNAL_AUTHENTICATION);
assert.equal(ready.medianObservedCapRate,0.075);
assert.equal(ready.entryVsMedianBps,0);
assert.equal(ready.comparablesCount,2);
assert.equal(ready.stressTerminalValuesSar[0].terminalValueSar,15000000);
assert(ready.stressTerminalValuesSar[1].terminalValueSar<ready.stressTerminalValuesSar[0].terminalValueSar);
assert(ready.stressTerminalValuesSar[2].terminalValueSar>ready.stressTerminalValuesSar[0].terminalValueSar);
assert.equal(ready.independentSaudiRateEvidenceVerified,false);
assert.equal(ready.productionDecisionAuthorized,false);
assert.equal(ready.professionalAppraisalEstablished,false);
assert.ok(Object.isFrozen(ready));
function held(change,code){
 const v=assessMarketRateProvenance({...base,...change});
 assert.equal(v.status,STATUS.HOLD);
 if(code) assert(v.blockers.some(x=>x.includes(code)),v.blockers.join(', '));
}
held({comparables:[]},'INSUFFICIENT_QUALIFIED_INCOME_COMPARABLES');
held({comparables:[base.comparables[0],{...base.comparables[1],transactionRef:'T-1'}]},'DUPLICATE');
held({comparables:[base.comparables[0],{...base.comparables[1],transactionStatus:'ASKING_SALE'}]},'ASKING_OFFER');
held({comparables:[base.comparables[0],{...base.comparables[1],city:'Jeddah'}]},'ASSET_MARKET_MISMATCH');
held({comparables:[base.comparables[0],{...base.comparables[1],sourceArtifactSha256:null}]},'PROVENANCE_REQUIRED');
held({comparables:[base.comparables[0],{...base.comparables[1],annualNetOperatingIncomeSar:700000}]},'NOI_BRIDGE');
held({comparables:[base.comparables[0],{...base.comparables[1],transactionDate:'2026-10-03'}]},'TIMING_STALE_OR_FUTURE');
held({comparables:[base.comparables[0],{...base.comparables[1],transactionDate:'2024-01-01'}]},'TIMING_STALE_OR_FUTURE');
held({entryCapRate:0.13},'ENTRY_CAP_RATE_OUTSIDE_PREDECLARED_EVIDENCE_BAND');
held({exitCapRate:0},'CAP_OR_DISCOUNT_RATE_INVALID');
held({discountRate:0},'CAP_OR_DISCOUNT_RATE_INVALID');
held({discountRate:0.13},'DISCOUNT_RATE_COMPONENTS_DO_NOT_RECONCILE');
held({rateMethodology:{...rateMethodology,exitEvidenceRef:rateMethodology.entryEvidenceRef}},'EXIT_RATE_DUPLICATES_ENTRY_SOURCE');
held({rateMethodology:{...rateMethodology,discountRateComponentEvidence:{...rateMethodology.discountRateComponentEvidence,referenceRate:null}}},'EXPLICIT_DISCOUNT_RATE_DECOMPOSITION_REQUIRED');
held({rateMethodology:{...rateMethodology,reviewedAt:'2027-01-01'}},'SEPARATE_ENTRY_EXIT_DISCOUNT_RATE_REVIEW_REQUIRED');
held({entryCapRate:0.075,exitCapRate:0.075},'SAME_ENTRY_EXIT_CAP_WITHOUT_INDEPENDENT_RATIONALE');
held({entryCapRate:0.075,exitCapRate:0.07},'EXIT_CAP_COMPRESSION_NEEDS_PROFESSIONAL_RATIONALE');
held({terminalNoiSar:0},'TERMINAL_NOI_REQUIRED');
held({policy:{...policy,stressCapShockBps:900}},'STRESS_RANGE_INVALID');
held({policy:null},'PREDECLARED_RATE_STRESS_AND_EVIDENCE_POLICY_REQUIRED');
console.log('C60_SAUDI_INCOME_RATE_PROVENANCE=PASS');
console.log('C60_REAL_MARKET_RATES_EXTERNALLY_AUTHENTICATED=FALSE');
console.log('C60_PUBLISHED_SAUDI_RATE_ACCURACY_ESTABLISHED=FALSE');
