'use strict';
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
module.exports={args,caseId,propertyRef,asOfDate,offer,a,b,S,computeFinancingOfferHash,evaluate};
