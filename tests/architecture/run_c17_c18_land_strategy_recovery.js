'use strict';
const assert=require('node:assert/strict');
const a=require('../../src/strategy/governed-raw-land-strategic-optionality');
const b=require('../../src/strategy/governed-subdivision-merge-review');
const scope={caseId:'SYNTH-C',propertyRef:'SYNTH-P'},asOf='2026-09-10T12:00:00Z',before='2026-09-08T00:00:00Z',after='2026-09-09T00:00:00Z',validUntil='2027-01-01T00:00:00Z',H='a'.repeat(64);
const meta={...scope,reviewedByRef:'R',reviewEvidenceRef:'RE',reviewedAt:before,validUntil};
const src={sourceCapability:'SYNTH',sourceRecordId:'R1',sourceRecordHashSha256:H,sourceStatus:'PROFESSIONAL_LABEL',sourceReference:'DOC'};
const A=a.RAW_LAND_EVIDENCE_CLASS,B=b.EVIDENCE_CLASS;
const aclasses=[A.TITLE_AND_PARCEL_IDENTITY,A.SURVEY_AND_AREA],bclasses=[B.TITLE_AND_PARCEL_IDENTITY,B.SURVEY_AND_AREA];
const type=a.RAW_LAND_OPTION_TYPE.HOLD_AS_IS, op=b.OPERATION_TYPE.MERGE_REVIEW;
function ae(id,cls,patch={}){return a.createGovernedRawLandEvidenceReference({...meta,...src,evidenceReferenceId:id,evidenceClass:cls,evidenceState:'SATISFIED',...patch});}
function af(evidenceReferences=[ae('T',aclasses[0]),ae('S',aclasses[1])],optionPatch={},policyPatch={}){
 const hashes=evidenceReferences.map(e=>e.evidenceReferenceHashSha256);
 const o=a.createGovernedRawLandStrategicOption({...meta,reviewedAt:after,optionId:'O',optionType:type,rationaleRef:'R',authoredByRef:'AUTHOR',evidenceReferenceHashesSha256:hashes,...optionPatch});
 const p=a.createGovernedRawLandReviewPolicy({...meta,reviewedAt:after,policyId:'P',allowedOptionTypes:[type],allowedEvidenceClasses:aclasses,requiredEvidenceClassesByOptionType:{[type]:aclasses},evidenceReferenceHashesSha256:hashes,optionHashesSha256:[o.optionHashSha256],...policyPatch});
 return {...scope,asOf,evidenceReferences,options:[o],reviewPolicy:p};
}
function be(id,parcel,cls,patch={}){return b.createGovernedParcelOperationEvidence({...meta,...src,evidenceId:id,parcelRef:parcel,evidenceClass:cls,evidenceState:'SATISFIED',...(cls===bclasses[1]?{surveyedAreaSqm:parcel==='P1'?0.1:0.2}:{}),...patch});}
const defaultEvidence=()=>['P1','P2'].flatMap(p=>[be(p+'T',p,bclasses[0]),be(p+'S',p,bclasses[1])]);
function bf(evidence=defaultEvidence(),proposalPatch={},policyPatch={}){
 const hashes=evidence.map(e=>e.evidenceHashSha256);
 const parcelBindings=['P1','P2'].map(p=>({parcelRef:p,titleEvidenceHashSha256:evidence.find(e=>e.parcelRef===p&&e.evidenceClass===bclasses[0]).evidenceHashSha256,surveyEvidenceHashSha256:evidence.find(e=>e.parcelRef===p&&e.evidenceClass===bclasses[1]).evidenceHashSha256,surveyedAreaSqm:p==='P1'?0.1:0.2}));
 const o=b.createGovernedSubdivisionMergeProposal({...meta,reviewedAt:after,proposalId:'O',operationType:op,rationaleRef:'R',authoredByRef:'AUTHOR',evidenceHashesSha256:hashes,parcelBindings,proposedOutputParcelCount:1,proposedTotalAreaSqm:0.3,areaToleranceSqm:0,...proposalPatch});
 const p=b.createGovernedSubdivisionMergeReviewPolicy({...meta,reviewedAt:after,policyId:'P',allowedOperationTypes:[op],allowedEvidenceClasses:bclasses,requiredEvidenceClassesByOperation:{[op]:bclasses},evidenceHashesSha256:hashes,proposalHashesSha256:[o.proposalHashSha256],...policyPatch});
 return {...scope,asOf,evidence,proposals:[o],reviewPolicy:p};
}
let checks=0;function run(fn,input,expected){const o=fn(input);assert.equal(o.status,expected,JSON.stringify(o.blockers));for(const k of ['sourceAuthenticityIndependentlyVerified','transactionAuthorized','approvalAuthorized','productionAuthorized','legalConclusionBySoftware','valuationCalculated'])assert.equal(o[k],false);checks++;return o;}
const ar=a.RAW_LAND_REVIEW_STATUS,br=b.REVIEW_STATUS,ra=ar.READY_FOR_PROFESSIONAL_STRATEGY_REVIEW,rb=br.READY_FOR_PROFESSIONAL_SUBDIVISION_MERGE_REVIEW,fa=a.evaluateGovernedRawLandStrategicOptionality,fb=b.evaluateGovernedSubdivisionMergeReview;
const av=af(),bv=bf();
assert.equal(run(fa,av,ra).review[0].rank,null);
assert.equal(run(fb,bv,rb).review[0].inputSurveyedAreaSqm,0.3);
assert.equal(run(fb,bv,rb).review[0].absoluteAreaDeltaSqm,0);
for(const [fn,input,status] of [[fa,null,ar.HOLD_INTEGRITY],[fb,null,br.HOLD_INTEGRITY],[fa,{...av,propertyRef:'OTHER'},ar.HOLD_CONTEXT],[fb,{...bv,propertyRef:'OTHER'},br.HOLD_CONTEXT],[fa,{...av,asOf:'2026-02-30'},ar.HOLD_CONTEXT],[fb,{...bv,asOf:'2099-01-01'},br.HOLD_CONTEXT],[fa,{...av,evidenceReferences:[]},ar.HOLD_EVIDENCE],[fb,{...bv,proposals:[]},br.HOLD_EVIDENCE],[fa,af([ae('T',aclasses[0]),ae('S',aclasses[1],{evidenceState:'UNRESOLVED',unresolvedReasonRef:'MISSING'})]),ar.HOLD_EVIDENCE],[fa,af(undefined,{}, {reviewedAt:before}),ar.HOLD_POLICY],[fb,bf(undefined,{proposedTotalAreaSqm:0.31}),br.HOLD_AREA_RECONCILIATION],[fb,bf(undefined,{proposedTotalAreaSqm:0.31,areaToleranceSqm:0.01}),rb],[fb,bf(undefined,{}, {reviewedAt:before}),br.HOLD_POLICY]])run(fn,input,status);
const changed={...av.evidenceReferences[0],availabilityInferredBySoftware:true};changed.evidenceReferenceHashSha256=a.computeRawLandEvidenceReferenceHash(changed);run(fa,{...av,evidenceReferences:[changed,av.evidenceReferences[1]]},ar.HOLD_INTEGRITY);
const forged={...bv.proposals[0],proposedOutputParcelCount:3};forged.proposalHashSha256=b.computeProposalHash(forged);run(fb,{...bv,proposals:[forged]},br.HOLD_INTEGRITY);
let reads=0;const obj=Object.defineProperty({},'reviewPolicy',{enumerable:true,get(){reads++;return av.reviewPolicy;}});run(fa,obj,ar.HOLD_INTEGRITY);run(fb,obj,br.HOLD_INTEGRITY);assert.equal(reads,0);
assert.throws(()=>af(undefined,{}, {requiredEvidenceClassesByOptionType:{[type]:[aclasses[0]]}}),/C17_POLICY_TITLE_SURVEY_HARD_GATES_REQUIRED/);
assert.throws(()=>bf(undefined,{proposedOutputParcelCount:2}),/C18_OPERATION_PARCEL_COUNT_MISMATCH/);
assert.throws(()=>bf(undefined,{proposedTotalAreaSqm:0.3001}),/C18_AREA_RECONCILIATION_PAIR_REQUIRED/);
assert.throws(()=>bf(undefined,{proposedTotalAreaSqm:null,areaToleranceSqm:null}),/C18_AREA_RECONCILIATION_PAIR_REQUIRED/);
console.log('C17_C18_LAND_STRATEGY_RECOVERY=PASS cases='+checks+' synthetic=true legalAuthority=false');
