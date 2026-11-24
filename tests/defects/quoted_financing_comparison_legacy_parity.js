'use strict';
const assert=require('node:assert/strict');
const {
 FINANCING_STATUS:S,PAYMENT_KIND:K,COMPARISON_METRIC:M,DIRECTION:D,DISCLOSURE_FIELD:F,POLICY_VERSION,
 createGovernedFinancingOffer:create,computeFinancingOfferHash,financingOfferBindings,computeFinancingComparisonPolicyHash,
 evaluateGovernedFinancingOptions:evaluate,
}=require('../../src/financing/quoted-financing-comparison');
const caseId='SYNTH-C14',propertyRef='SYNTH-PROPERTY',asOfDate='2026-10-28',targetFundingDate='2026-11-01';
const date=x=>new Date(x).toISOString();
const base={caseId,propertyRef,providerRef:'SYNTH-LENDER',structureLabel:'SYNTH-STRUCTURE',
 sourceAuthority:'SYNTH-SOURCE',sourceRef:'SYNTH-REF',sourceEvidenceRef:'SYNTH-EVIDENCE',
 professionalReviewerRef:'SYNTH-REVIEWER',reviewEvidenceRef:'SYNTH-REVIEW',
 currency:'SAR',comparisonPrincipalSar:1000000,upfrontFeesSar:10000,upfrontFeesOutsideRepaymentSchedule:true,
 repaymentScheduleComplete:true,sourceVersionHashSha256:'a'.repeat(64),reviewEvidenceHashSha256:'b'.repeat(64),
 sourceVerifiedAt:'2026-10-20',sourceReviewAfter:'2026-11-02',reviewedAt:'2026-10-25',validUntil:'2026-11-10',
 quotedFundingDate:targetFundingDate,quoteValidUntil:'2026-11-10',maturityDate:'2028-11-01',
 rateDisclosureRef:'SYNTH-RATE',covenantEvidenceRefs:['SYNTH-COVENANT'],securityEvidenceRefs:['SYNTH-SECURITY']};
const payment=(id,paymentDate,amountSar,paymentKind=K.DEBT_SERVICE)=>({paymentId:id,paymentDate,amountSar,paymentKind});
const offer=(id,patch={})=>create({...base,offerId:id,repaymentSchedule:[
 payment('p1','2027-11-01',550000),payment('p2','2028-11-01',550000,K.BALLOON)],...patch});
const a=offer('A'),b=offer('B',{upfrontFeesSar:20000,repaymentSchedule:[payment('p1','2027-11-01',600000),payment('p2','2028-11-01',600000,K.BALLOON)]});
function args(offers=[a,b],patch={}){
 const policy={version:POLICY_VERSION,policyId:'SYNTH-POLICY',caseId,propertyRef,asOfDate:date(asOfDate),targetFundingDate:date(targetFundingDate),
 offerBindings:financingOfferBindings(offers),allowedStructureLabels:[base.structureLabel],requireEqualComparisonPrincipal:true,
 rankingCriteria:[{metric:M.NOMINAL_FINANCING_COST_SAR,direction:D.MIN}],requiredDisclosureFields:[F.RATE,F.COVENANTS,F.SECURITY],
 reviewThresholds:[{metric:M.MAX_CALENDAR_YEAR_DEBT_SERVICE_SAR,operator:D.MAX,value:575000}],reviewedByRef:'SYNTH-REVIEWER',
 reviewEvidenceRef:'SYNTH-POLICY-REVIEW',reviewedAt:date('2026-10-27'),...patch};
 policy.policyHashSha256=computeFinancingComparisonPolicyHash(policy);
 return {caseId,propertyRef,asOfDate,targetFundingDate,financingOffers:offers,comparisonPolicyId:policy.policyId,governedComparisonPolicies:{[policy.policyId]:policy}};
}
const result=evaluate(args());
assert.equal(result.status,S.READY_FOR_PROFESSIONAL_FINANCING_REVIEW);
assert.equal(result.offers[0].metrics.nominalFinancingCostSar,110000);
assert.equal(result.offers[0].metrics.nominalFinancingCostRatio,0.11);
assert.equal(result.offers[1].metrics.nominalFinancingCostSar,220000);
assert.equal(result.offers[0].metrics.balloonTotalSar,550000);
assert.equal(result.offers[0].metrics.maxCalendarYearDebtServiceSar,550000);
assert.deepEqual(result.analyticalOrdering.map(x=>[x.offerId,x.rank]),[['A',1],['B',2]]);
assert.ok(result.riskFlags.some(x=>x.includes(':B:')));
for(const k of ['lenderSelected','creditApproved','transactionAuthorized','approvalAuthorized','nominalCostIsAnnualPercentageRate','sourceAuthenticityIndependentlyVerified','npvCalculated','irrCalculated'])assert.equal(result[k],false);
const tied=evaluate(args([a,offer('C')]));
assert.deepEqual(tied.analyticalOrdering.map(x=>x.rank),[1,1]);
const rehash=(x,patch)=>{const y={...x,...patch};y.financingOfferHashSha256=computeFinancingOfferHash(y);return y;};
const failures=[
 [args([a]),S.HOLD_EVIDENCE],
 [args([a,a]),S.HOLD_INTEGRITY],
 [args([a,{...b,upfrontFeesSar:1}]),S.HOLD_INTEGRITY],
 [args([a,offer('B',{propertyRef:'OTHER'})]),S.HOLD_INTEGRITY],
 [args([a,offer('B',{comparisonPrincipalSar:900000})]),S.HOLD_COMPARABILITY],
 [args([a,b],{requireEqualComparisonPrincipal:false}),S.HOLD_COMPARABILITY],
 [args([a,offer('B',{rateDisclosureRef:null})]),S.HOLD_COMPARABILITY],
 [args([a,offer('B',{quoteValidUntil:'2026-10-30'})]),S.HOLD_INTEGRITY],
 [args([a,offer('B',{reviewedAt:'2026-10-19'})]),S.HOLD_INTEGRITY],
 [args([a,rehash(b,{sourceVerifiedAt:'2026-02-30T00:00:00.000Z'})]),S.HOLD_INTEGRITY],
 [args([a,offer('B',{repaymentSchedule:[payment('p1','2029-11-01',1100000)]})]),S.HOLD_INTEGRITY],
 [{...args(),asOfDate:'2026-02-30'},S.HOLD_CONTEXT],
 [args([a,b],{offerBindings:[]}),S.HOLD_INTEGRITY],
];
for(const [input,status] of failures){const x=evaluate(input);assert.equal(x.status,status);assert.deepEqual(x.analyticalOrdering,[]);assert.equal(x.transactionAuthorized,false);}
assert.throws(()=>offer('BAD',{quotedFundingDate:'2026-02-30'}),/valid UTC/);
console.log('C14_QUOTED_FINANCING_COMPARISON=PASS synthetic_only=true independent_authority=false negative_cases='+failures.length);
