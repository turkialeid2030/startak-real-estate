'use strict';
const assert=require('node:assert/strict');
const c=require('../../src/closing/governed-encumbrance-mortgage-closing');
const S=c.CLOSING_STATUS,E=c.EVIDENCE_CLASS,P=c.PROFESSIONAL_STATUS;
const H='a'.repeat(64),scope={caseId:'SYNTH-CASE',propertyRef:'SYNTH-PROPERTY'},asOfDate='2026-09-10T12:00:00.000Z',targetClosingDate='2026-09-15T12:00:00.000Z',past='2026-09-09T09:00:00Z',future='2026-09-20T12:00:00Z';
function evidence(patch={}){return c.createGovernedClosingEvidence({...scope,recordId:'M1',evidenceClass:E.MORTGAGE_OR_SECURITY_INTEREST,professionalStatus:P.OPEN,sourceAuthority:'SYNTH-LENDER',sourceRef:'SOURCE',sourceEvidenceRef:'PAYOFF-1',professionalReviewerRef:'REVIEWER',reviewEvidenceRef:'REVIEW',sourceVersionHashSha256:H,reviewEvidenceHashSha256:H,sourceVerifiedAt:past,sourceReviewAfter:future,reviewedAt:'2026-09-10T09:00:00Z',validUntil:future,settlementAmountSar:300000,payoffValidUntil:future,...patch});}
function fixture(records=[evidence()],patch={}){
 const policy={version:c.POLICY_VERSION,policyId:'POL',...scope,asOfDate,targetClosingDate,evidenceBindings:c.closingEvidenceBindings(records),allowedEvidenceClasses:Object.values(E),requiredEvidenceClasses:[E.MORTGAGE_OR_SECURITY_INTEREST],unresolvedStatuses:[P.OPEN],allowUnknownSettlementAmounts:false,reviewedByRef:'POLICY-REVIEWER',reviewEvidenceRef:'POLICY-EVIDENCE',reviewedAt:'2026-09-10T11:00:00Z',...patch};
 policy.policyHashSha256=c.computeClosingReviewPolicyHash(policy);
 return {...scope,asOfDate,targetClosingDate,reviewPolicyId:'POL',closingEvidence:records,governedReviewPolicies:{POL:policy}};
}
let checks=0;
function run(input,status){const out=c.evaluateGovernedClosingIntelligence(input);assert.equal(out.status,status,JSON.stringify(out.blockers));for(const k of ['legalTitleOpinionEstablished','lienPriorityDetermined','mortgageReleaseLegallyConfirmed','lenderPayoffGenerated','automaticClosingRecommendation','transactionAuthorized','approvalAuthorized','productionAuthorityGranted'])assert.equal(out[k],false);checks++;return out;}
const valid=fixture(),ok=run(valid,S.READY_FOR_PROFESSIONAL_CLOSING_REVIEW);
assert.equal(ok.knownSettlementTotalSar,300000);assert.equal(ok.riskFlags.length,1);
assert.deepEqual(run(JSON.parse(JSON.stringify(valid)),S.READY_FOR_PROFESSIONAL_CLOSING_REVIEW),ok);
assert.equal(run(fixture([evidence(),evidence({recordId:'L1',evidenceClass:E.LIEN_OR_ENCUMBRANCE,sourceEvidenceRef:'PAYOFF-2',settlementAmountSar:20000})]),S.READY_FOR_PROFESSIONAL_CLOSING_REVIEW).knownSettlementTotalSar,320000);
const unknown=evidence({settlementAmountSar:null,payoffValidUntil:null});
assert.deepEqual(run(fixture([unknown],{allowUnknownSettlementAmounts:true}),S.READY_FOR_PROFESSIONAL_CLOSING_REVIEW).unknownSettlementRecordIds,['M1']);
for(const [input,status] of [
 [fixture([unknown]),S.HOLD_POLICY],[fixture([unknown],{unresolvedStatuses:[]}),S.HOLD_POLICY],
 [fixture([evidence({propertyRef:'OTHER'})]),S.HOLD_INTEGRITY],
 [fixture([evidence({sourceReviewAfter:'2026-09-10T10:00:00Z'})]),S.HOLD_INTEGRITY],
 [fixture([evidence({validUntil:'2026-09-14T12:00:00Z'})]),S.HOLD_INTEGRITY],
 [fixture([evidence({payoffValidUntil:'2026-09-14T12:00:00Z'})]),S.HOLD_INTEGRITY],
 [fixture([evidence({payoffValidUntil:null})]),S.HOLD_INTEGRITY],
 [fixture([evidence(),evidence({recordId:'M2'})]),S.HOLD_INTEGRITY],
 [fixture([evidence(),evidence()]),S.HOLD_INTEGRITY],
 [fixture([evidence()],{reviewedAt:past}),S.HOLD_POLICY],
 [fixture([evidence()],{requiredEvidenceClasses:[E.CLOSING_CONDITION]}),S.HOLD_POLICY],
 [{...valid,asOfDate:'2099-01-01T00:00:00Z',targetClosingDate:'2099-02-01T00:00:00Z'},S.HOLD_CONTEXT],
 [{...valid,reviewPolicyId:'MISSING'},S.HOLD_POLICY],
 [{...valid,closingEvidence:[]},S.HOLD_EVIDENCE]
])run(input,status);
for(const patch of [{legalInterpretationPerformedBySoftware:true},{settlementAmountSar:-1},{sourceVerifiedAt:'invalid'},{statusExternallyDetermined:false}]){
 const changed={...evidence(),...patch};changed.closingEvidenceHashSha256=c.computeClosingEvidenceHash(changed);run(fixture([changed]),S.HOLD_INTEGRITY);
}
let reads=0;run(Object.defineProperty({...valid},'hidden',{enumerable:true,get(){reads++;return true;}}),S.HOLD_INTEGRITY);assert.equal(reads,0);
console.log('C13_HISTORICAL_CLOSING_RECOVERY=PASS cases='+checks+' synthetic=true transactionAuthority=false');
