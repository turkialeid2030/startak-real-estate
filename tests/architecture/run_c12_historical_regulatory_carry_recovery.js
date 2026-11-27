'use strict';
const assert=require('node:assert/strict');
const c=require('../../src/cost/governed-regulatory-carry-cost');
const S=c.REGULATORY_CARRY_STATUS,B=c.COST_BASIS,A=c.ANNUAL_ACCRUAL_CONVENTION;
const H='a'.repeat(64),scope={caseId:'SYNTH-CASE',propertyRef:'SYNTH-PROPERTY'},asOfDate='2026-09-10T12:00:00Z',horizonStart='2027-01-01T00:00:00.000Z',horizonEnd='2028-12-31T23:59:59.999Z',past='2026-09-09T09:00:00Z',reviewedAt='2026-09-10T09:00:00Z',future='2029-01-01T00:00:00Z';
function evidence(patch={}){return c.createGovernedRegulatoryCarryCostEvidence({...scope,itemId:'C1',category:'SYNTH-FEE',basis:B.FIXED_ANNUAL_SAR,amountSar:3650,annualAccrualConvention:A.ACTUAL_DAYS_365,effectiveFrom:horizonStart,effectiveTo:horizonEnd,sourceAuthority:'SYNTH-AUTHORITY',sourceRef:'SOURCE',sourceEvidenceRef:'DOC-1',applicabilityDeterminedByRef:'PROF',reviewEvidenceRef:'REVIEW',sourceVersionHashSha256:H,reviewEvidenceHashSha256:H,sourceVerifiedAt:past,sourceReviewAfter:future,reviewedAt,validUntil:future,...patch});}
function fixture(items=[evidence()],patch={}){const p={version:c.POLICY_VERSION,policyId:'POL',...scope,asOfDate,horizonStart,horizonEnd,costItemBindings:c.regulatoryCostBindings(items),allowedCategories:['SYNTH-FEE'],requiredCategories:['SYNTH-FEE'],allowedBases:Object.values(B),allowedAccrualConventions:Object.values(A),reviewedByRef:'PROF',reviewEvidenceRef:'POLICY-EVIDENCE',reviewedAt:'2026-09-10T11:00:00Z',...patch};p.policyHashSha256=c.computeRegulatoryCarryCostReviewPolicyHash(p);return {...scope,asOfDate,horizonStart,horizonEnd,reviewPolicyId:'POL',regulatoryCostEvidence:items,governedReviewPolicies:{POL:p}};}
const READY=S.READY_FOR_PROFESSIONAL_REGULATORY_CARRY_COST_REVIEW;
let checks=0;function run(input,status){const o=c.evaluateGovernedRegulatoryCarryCost(input);assert.equal(o.status,status,JSON.stringify(o.blockers));for(const k of ['statutoryRateInferredBySoftware','legalApplicabilityInferredBySoftware','taxOrZakatOpinionEstablished','automaticUnderwritingAdoption','transactionAuthorized','approvalAuthorized','productionAuthorityGranted','publicAiAuthorized'])assert.equal(o[k],false);if(status!==READY)assert.equal(o.totalCarryCostSar,null);checks++;return o;}
const valid=fixture(),ok=run(valid,READY);assert.deepEqual(ok.schedule.map(p=>p.totalCarryCostSar),[3650,3660]);assert.equal(ok.totalCarryCostSar,7310);
assert.deepEqual(run(JSON.parse(JSON.stringify(valid)),READY),ok);
const once=evidence({itemId:'C2',sourceEvidenceRef:'DOC-2',basis:B.FIXED_ONE_TIME_SAR,amountSar:0.1,annualAccrualConvention:null,chargeDate:horizonStart});
assert.equal(run(fixture([once,evidence({itemId:'C3',sourceEvidenceRef:'DOC-3',basis:B.FIXED_ONE_TIME_SAR,amountSar:0.2,annualAccrualConvention:null,chargeDate:horizonStart})]),READY).totalCarryCostSar,0.3);
assert.equal(run(fixture([evidence({basis:B.PERCENT_OF_EXPLICIT_BASE_ANNUAL,rate:0.025,explicitBaseAmountSar:100000,annualAccrualConvention:A.FULL_CALENDAR_YEAR_IF_ACTIVE})]),READY).totalCarryCostSar,5000);
assert.equal(run(fixture([evidence({basis:B.PER_SQM_ANNUAL_SAR,ratePerSqmSar:0.005,explicitAreaSqm:1,annualAccrualConvention:A.FULL_CALENDAR_YEAR_IF_ACTIVE})]),READY).totalCarryCostSar,0.02);
assert.equal(run(fixture([evidence({effectiveTo:'2027-01-01T23:59:59.999Z'})]),READY).totalCarryCostSar,10);
assert.equal(run(fixture([evidence()],{maximumAnnualCarryCostSar:3600}),READY).riskFlags.length,2);
for(const [input,status] of [
 [fixture([evidence({propertyRef:'OTHER'})]),S.HOLD_INTEGRITY],
 [fixture([evidence({sourceReviewAfter:'2027-01-02T00:00:00Z'})]),S.HOLD_INTEGRITY],
 [fixture([evidence(),evidence({itemId:'C2'})]),S.HOLD_INTEGRITY],
 [fixture([evidence(),evidence()]),S.HOLD_INTEGRITY],
 [fixture([evidence()],{reviewedAt:past}),S.HOLD_POLICY],
 [fixture([evidence()],{requiredCategories:'SYNTH-FEE'}),S.HOLD_POLICY],
 [fixture([evidence()],{allowedAccrualConventions:{}}),S.HOLD_POLICY],
 [fixture([evidence()],{requiredCategories:['OTHER']}),S.HOLD_POLICY],
 [{...valid,reviewPolicyId:'MISSING'},S.HOLD_POLICY],
 [{...valid,regulatoryCostEvidence:[]},S.HOLD_EVIDENCE],
 [{...valid,horizonEnd:'2200-01-01T00:00:00Z'},S.HOLD_CONTEXT],
 [{...valid,asOfDate:'2099-01-01T00:00:00Z',horizonStart:'2099-01-01T00:00:00Z',horizonEnd:'2099-12-31T23:59:59.999Z'},S.HOLD_CONTEXT],
 [null,S.HOLD_INTEGRITY],
 [fixture([evidence({amountSar:50000000000000,annualAccrualConvention:A.FULL_CALENDAR_YEAR_IF_ACTIVE})]),S.HOLD_CALCULATION]
])run(input,status);
for(const patch of [{legalApplicabilityInferredBySoftware:true},{rate:0.2},{amountSar:0.001},{reviewedAt:past,sourceVerifiedAt:reviewedAt}]){
 const changed={...evidence(),...patch};changed.costEvidenceHashSha256=c.computeRegulatoryCarryCostEvidenceHash(changed);run(fixture([changed]),S.HOLD_INTEGRITY);
}
let reads=0;run(Object.defineProperty({...valid},'hidden',{enumerable:true,get(){reads++;return true;}}),S.HOLD_INTEGRITY);assert.equal(reads,0);
assert.throws(()=>evidence({amountSar:0.001}),/C12_ANNUAL_AMOUNT_SAR_INVALID/);
assert.throws(()=>evidence({reviewedAt:'2026-09-08T00:00:00Z'}),/C12_REVIEW_BEFORE_SOURCE_VERIFICATION/);
assert.throws(()=>c.createGovernedRegulatoryCarryCostEvidence(Object.defineProperty({},'caseId',{enumerable:true,get(){reads++;return 'X';}})),/C12_INPUT_JSON_INVALID/);assert.equal(reads,0);
console.log('C12_HISTORICAL_REGULATORY_CARRY_RECOVERY=PASS cases='+checks+' synthetic=true regulatoryAuthority=false');
