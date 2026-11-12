'use strict';

const assert = require('assert');
const {
  TASK_CLASS, DEPLOYMENT_MODE, DATA_CLASS,
  createGovernedModelProfile, createGovernedAiRequest,
} = require('../../src/ai/governed-generative-intelligence');
const {
  STATUS, ENVIRONMENT, GROUNDING_KIND, PROVIDER_RESULT,
  createGroundingManifest, createProviderAuthorization, createProviderInvocationEnvelope,
  createProviderResponseEnvelope, validateGroundedProviderResponse,
  evaluateProviderReadiness, executeGovernedProviderGateway,
} = require('../../src/ai/governed-live-provider-gateway');
const {
  groundingSourceBindingBlockers,
  evaluateProofGroundedProviderReadiness,
  validateProofGroundedProviderResponse,
  executeProofGroundedProviderGateway,
} = require('../../src/ai/proof-grounded-ai-runtime');

const AS_OF = '2026-10-01T13:10:00Z';
const H = (c) => c.repeat(64);
const H1=H('1'), H2=H('2'), H3=H('3'), H4=H('4'), H5=H('5'), H6=H('6'), H7=H('7'), H8=H('8'), H9=H('9'), HA=H('a');

function profile(overrides={}) {
  return createGovernedModelProfile({
    profileId:'PROFILE-C23-PRIVATE', providerId:'TEST-PROVIDER', modelId:'TEST-GROUNDED-MODEL', modelVersionRef:'V1-PINNED',
    deploymentMode:DEPLOYMENT_MODE.PRIVATE_INTERNAL,
    allowedTaskClasses:[TASK_CLASS.EXECUTIVE_DRAFT], allowedDataClasses:[DATA_CLASS.PUBLIC,DATA_CLASS.INTERNAL_BUSINESS],
    dataResidencyRef:'RESIDENCY-REVIEWED', retentionPolicyRef:'RETENTION-NO-PERSIST', trainingUseCustomerData:false,
    maxOutputTokens:1000, temperature:0, modelCardRef:'MODEL-CARD-C23', reviewedByRef:'AI-GOV-REVIEWER', reviewEvidenceRef:'MODEL-REVIEW-EVIDENCE',
    reviewedAt:'2026-10-01T08:00:00Z', validUntil:'2026-10-03T12:00:00Z', publicAiAllowed:false, transactionAuthority:false, approvalAuthority:false,
    ...overrides,
  });
}
function request(p, overrides={}) {
  return createGovernedAiRequest({
    requestId:'REQ-C23', caseId:'CASE-C23', propertyRef:'PROP-C23', taskClass:TASK_CLASS.EXECUTIVE_DRAFT,
    promptTemplateId:'PROMPT-C23', promptTemplateVersion:'V1', promptTemplateHashSha256:H3, modelProfileHashSha256:p.modelProfileHashSha256,
    retrievalItems:[
      { evidenceId:'EVIDENCE-PRICE', evidenceHashSha256:H1, sourceReference:'C21-GOVERNED-LISTING', dataClass:DATA_CLASS.INTERNAL_BUSINESS, knownAt:'2026-10-01T08:00:00Z', validUntil:'2026-10-03T12:00:00Z', untrustedContent:false, instructionLikeContentDetected:false },
      { evidenceId:'EVIDENCE-DOCUMENT', evidenceHashSha256:H4, sourceReference:'GOVERNED-DOCUMENT', dataClass:DATA_CLASS.INTERNAL_BUSINESS, knownAt:'2026-10-01T08:00:00Z', validUntil:'2026-10-03T12:00:00Z', untrustedContent:true, instructionLikeContentDetected:true },
    ],
    deterministicOutputHashesSha256:[H2], allowedNumericLiterals:['2000','72'], deterministicDecisionState:'HOLD',
    requesterRoleRef:'AUTHORIZED-INTERNAL-ANALYST', authorizationRef:'AUTH-ROLE-C23', createdAt:'2026-10-01T09:00:00Z', validUntil:'2026-10-02T12:00:00Z',
    ...overrides,
  });
}
function manifest(req, overrides={}) {
  return createGroundingManifest({
    manifestId:'GROUND-C23', caseId:'CASE-C23', propertyRef:'PROP-C23', requestHashSha256:req.requestHashSha256,
    items:[
      { itemId:'ASKING-METRIC', kind:GROUNDING_KIND.NUMERIC, canonicalValue:'2000', sourceReference:'C21-GOVERNED-LISTING', evidenceHashSha256:H1, dataClass:DATA_CLASS.INTERNAL_BUSINESS, knownAt:'2026-10-01T08:00:00Z', validUntil:'2026-10-03T12:00:00Z', humanVerified:true },
      { itemId:'UTILITY-METRIC', kind:GROUNDING_KIND.PERCENTAGE, canonicalValue:'72%', sourceReference:'DETERMINISTIC-C21-UTILITY', deterministicOutputHashSha256:H2, dataClass:DATA_CLASS.INTERNAL_BUSINESS, knownAt:'2026-10-01T08:30:00Z', validUntil:'2026-10-03T12:00:00Z', humanVerified:true },
    ],
    preparedByRef:'GROUNDING-PREPARER', reviewEvidenceRef:'GROUNDING-REVIEW-EVIDENCE', reviewedAt:'2026-10-01T09:15:00Z', validUntil:'2026-10-02T12:00:00Z',
    ...overrides,
  });
}
function authorization(overrides={}) {
  return createProviderAuthorization({
    authorizationId:'PROVIDER-AUTH-C23', providerId:'TEST-PROVIDER', modelId:'TEST-GROUNDED-MODEL', modelVersionRef:'V1-PINNED', environment:ENVIRONMENT.ISOLATED_NON_PRODUCTION,
    securityReviewEvidenceRef:'SECURITY-REVIEW', privacyDlpReviewEvidenceRef:'PRIVACY-DLP-REVIEW', contractualApprovalEvidenceRef:'CONTRACT-REVIEW',
    dataResidencyRef:'RESIDENCY-REVIEW', retentionPolicyRef:'RETENTION-REVIEW', noTrainingEvidenceRef:'NO-TRAINING-REVIEW', promptRegistryRef:'PROMPT-REGISTRY',
    roleAuthorizationRef:'ROLE-AUTH', environmentAuthorizationRef:'NONPROD-ENV-AUTH', killSwitchRef:'KILL-SWITCH-C23',
    evidenceHashesSha256:[H4,H5,H6,H7,H8,H9], trainingUseCustomerData:false, networkInvocationAuthorized:true, reviewedByRef:'AI-GOV-REVIEWER',
    reviewedAt:'2026-10-01T09:20:00Z', validUntil:'2026-10-02T12:00:00Z', ...overrides,
  });
}
function invocation(p,req,m,a,overrides={}) {
  return createProviderInvocationEnvelope({
    invocationId:'INV-C23', caseId:'CASE-C23', propertyRef:'PROP-C23', requestHashSha256:req.requestHashSha256,
    modelProfileHashSha256:p.modelProfileHashSha256, groundingManifestHashSha256:m.manifestHashSha256, providerAuthorizationHashSha256:a.authorizationHashSha256,
    promptTemplateHashSha256:req.promptTemplateHashSha256, deterministicDecisionState:req.deterministicDecisionState,
    createdAt:'2026-10-01T09:30:00Z', validUntil:'2026-10-01T14:00:00Z', ...overrides,
  });
}
function response(inv, overrides={}) {
  return createProviderResponseEnvelope({
    responseId:'RESP-C23', invocationHashSha256:inv.invocationHashSha256, providerId:'TEST-PROVIDER', modelId:'TEST-GROUNDED-MODEL', modelVersionRef:'V1-PINNED',
    providerResult:PROVIDER_RESULT.SUCCESS,
    claims:[{ claimId:'CLAIM-1', text:'The governed asking metric is 2000 and the reviewed utility metric is 72%.', groundingItemIds:['ASKING-METRIC','UTILITY-METRIC'], assertedLiterals:['2000','72%'] }],
    echoDeterministicDecisionState:'HOLD', generatedAt:'2026-10-01T10:00:00Z', overrideDeterministicGateRequested:false, followedUntrustedInstructions:false, autonomousActionExecuted:false,
    ...overrides,
  });
}
function fixture() {
  const p=profile(); const req=request(p); const m=manifest(req); const a=authorization(); const inv=invocation(p,req,m,a); const resp=response(inv);
  return {modelProfile:p,request:req,groundingManifest:m,providerAuthorization:a,invocation:inv,providerResponse:resp,asOf:AS_OF};
}

(async () => {
  const f=fixture();
  assert.deepStrictEqual(groundingSourceBindingBlockers(f.request,f.groundingManifest),[]);
  const ready=evaluateProofGroundedProviderReadiness(f);
  assert.strictEqual(ready.status,STATUS.READY_FOR_PROVIDER_INVOCATION);
  assert.strictEqual(ready.providerInvocationReady,true);
  assert.strictEqual(ready.publicAiAuthorized,false);
  assert.strictEqual(ready.transactionAuthorized,false);
  const grounded=validateProofGroundedProviderResponse(f);
  assert.strictEqual(grounded.status,STATUS.READY_FOR_HUMAN_GROUNDED_DRAFT_REVIEW);
  assert.strictEqual(grounded.groundedDraftReviewReady,true);
  assert(grounded.draft.includes('2000'));
  assert(grounded.draft.includes('72%'));
  assert.strictEqual(grounded.deterministicDecisionState,'HOLD');

  const unsupportedAmount=response(f.invocation,{responseId:'RESP-BAD-AMOUNT',claims:[{claimId:'BAD',text:'The price is 9999.',groundingItemIds:['ASKING-METRIC'],assertedLiterals:['9999']}]});
  const badAmount=validateProofGroundedProviderResponse({...f,providerResponse:unsupportedAmount});
  assert.strictEqual(badAmount.status,STATUS.HOLD_UNSUPPORTED_OUTPUT);
  assert(badAmount.blockers.includes('C23_UNSUPPORTED_LITERAL_NOT_GROUNDED:BAD:9999'));
  assert.strictEqual(badAmount.draft,null);

  const undeclared=response(f.invocation,{responseId:'RESP-UNDECLARED',claims:[{claimId:'BAD2',text:'The price is 2000 and model invented 81%.',groundingItemIds:['ASKING-METRIC'],assertedLiterals:['2000']}]});
  const badUndeclared=validateProofGroundedProviderResponse({...f,providerResponse:undeclared});
  assert.strictEqual(badUndeclared.status,STATUS.HOLD_UNSUPPORTED_OUTPUT);
  assert(badUndeclared.blockers.includes('C23_UNSUPPORTED_UNDECLARED_LITERAL:BAD2:81%'));

  const date=response(f.invocation,{responseId:'RESP-DATE',claims:[{claimId:'DATE',text:'The unsupported effective date is 2027-01-15.',groundingItemIds:['ASKING-METRIC'],assertedLiterals:[]}]});
  const badDate=validateProofGroundedProviderResponse({...f,providerResponse:date});
  assert.strictEqual(badDate.status,STATUS.HOLD_UNSUPPORTED_OUTPUT);
  assert(badDate.blockers.includes('C23_UNSUPPORTED_UNDECLARED_LITERAL:DATE:2027-01-15'));

  assert.throws(() => createProviderResponseEnvelope({
    responseId:'UNSAFE',invocationHashSha256:f.invocation.invocationHashSha256,providerId:'TEST-PROVIDER',modelId:'TEST-GROUNDED-MODEL',modelVersionRef:'V1-PINNED',providerResult:PROVIDER_RESULT.SUCCESS,
    claims:[{claimId:'X',text:'Metric 2000.',groundingItemIds:['ASKING-METRIC'],assertedLiterals:['2000']}],echoDeterministicDecisionState:'HOLD',generatedAt:'2026-10-01T10:00:00Z',
    overrideDeterministicGateRequested:true,followedUntrustedInstructions:false,autonomousActionExecuted:false,
  }),/C23_PROVIDER_UNSAFE_RESPONSE_FLAGS/);

  const wrongState=response(f.invocation,{responseId:'RESP-STATE',echoDeterministicDecisionState:'APPROVE'});
  const gateOverride=validateProofGroundedProviderResponse({...f,providerResponse:wrongState});
  assert.strictEqual(gateOverride.status,STATUS.HOLD_SECURITY);
  assert(gateOverride.blockers.includes('C23_SECURITY_DETERMINISTIC_GATE_OVERRIDE'));

  const p2=profile({profileId:'PROFILE-MISMATCH'}); const req2=request(p2,{requestId:'REQ-MISMATCH'}); const m2=manifest(req2,{manifestId:'M-MISMATCH'});
  const a2=authorization({authorizationId:'AUTH-MISMATCH',modelVersionRef:'V2-WRONG'}); const inv2=invocation(p2,req2,m2,a2,{invocationId:'INV-MISMATCH'});
  const mismatch=evaluateProofGroundedProviderReadiness({modelProfile:p2,request:req2,groundingManifest:m2,providerAuthorization:a2,invocation:inv2,asOf:AS_OF});
  assert.strictEqual(mismatch.status,STATUS.HOLD_PROVIDER);
  assert(mismatch.blockers.includes('C23_PROVIDER_MODEL_BINDING_MISMATCH'));

  const noNetwork=authorization({authorizationId:'AUTH-NONET',networkInvocationAuthorized:false});
  const invNo=invocation(f.modelProfile,f.request,f.groundingManifest,noNetwork,{invocationId:'INV-NONET'});
  let calls=0;
  const noCall=await executeProofGroundedProviderGateway({...f,providerAuthorization:noNetwork,invocation:invNo,adapter:{invoke:async()=>{calls++;return {providerResult:PROVIDER_RESULT.SUCCESS};}}});
  assert.strictEqual(noCall.status,STATUS.HOLD_PROVIDER); assert.strictEqual(noCall.providerCalled,false); assert.strictEqual(calls,0);

  const adapter={invoke:async()=>{calls++;return f.providerResponse;}};
  const executed=await executeProofGroundedProviderGateway({...f,adapter});
  assert.strictEqual(executed.providerCalled,true); assert.strictEqual(calls,1); assert.strictEqual(executed.providerResponse.responseHashSha256,f.providerResponse.responseHashSha256);

  const err=await executeGovernedProviderGateway({...f,adapter:{invoke:async()=>{throw new Error('network');}}});
  assert.strictEqual(err.status,STATUS.HOLD_PROVIDER); assert(err.blockers.includes('C23_PROVIDER_NETWORK_ERROR'));

  const badSource=createGroundingManifest({
    manifestId:'GROUND-BAD-SOURCE',caseId:'CASE-C23',propertyRef:'PROP-C23',requestHashSha256:f.request.requestHashSha256,
    items:[{itemId:'UNBOUND',kind:GROUNDING_KIND.NUMERIC,canonicalValue:'555',sourceReference:'UNBOUND',evidenceHashSha256:HA,dataClass:DATA_CLASS.INTERNAL_BUSINESS,knownAt:'2026-10-01T08:00:00Z',validUntil:'2026-10-03T12:00:00Z',humanVerified:true}],
    preparedByRef:'P',reviewEvidenceRef:'R',reviewedAt:'2026-10-01T09:00:00Z',validUntil:'2026-10-02T12:00:00Z'});
  const invBad=invocation(f.modelProfile,f.request,badSource,f.providerAuthorization,{invocationId:'INV-BAD-SOURCE'});
  const sourceHold=evaluateProofGroundedProviderReadiness({...f,groundingManifest:badSource,invocation:invBad});
  assert.strictEqual(sourceHold.status,STATUS.HOLD_EVIDENCE); assert(sourceHold.blockers.includes('C23_EVIDENCE_SOURCE_NOT_BOUND_TO_REQUEST:UNBOUND'));

  const stale=createGroundingManifest({
    manifestId:'GROUND-STALE',caseId:'CASE-C23',propertyRef:'PROP-C23',requestHashSha256:f.request.requestHashSha256,
    items:[{itemId:'STALE',kind:GROUNDING_KIND.NUMERIC,canonicalValue:'2000',sourceReference:'C21',evidenceHashSha256:H1,dataClass:DATA_CLASS.INTERNAL_BUSINESS,knownAt:'2026-09-29T08:00:00Z',validUntil:'2026-09-30T12:00:00Z',humanVerified:true}],
    preparedByRef:'P',reviewEvidenceRef:'R',reviewedAt:'2026-09-29T09:00:00Z',validUntil:'2026-10-02T12:00:00Z'});
  const invStale=invocation(f.modelProfile,f.request,stale,f.providerAuthorization,{invocationId:'INV-STALE'});
  const staleHold=evaluateProofGroundedProviderReadiness({...f,groundingManifest:stale,invocation:invStale});
  assert.strictEqual(staleHold.status,STATUS.HOLD_WINDOW); assert(staleHold.blockers.includes('C23_WINDOW_GROUNDING_STALE:STALE'));

  const tampered={...f.groundingManifest,preparedByRef:'TAMPERED'};
  const integrity=evaluateProviderReadiness({...f,groundingManifest:tampered});
  assert.strictEqual(integrity.status,STATUS.HOLD_INTEGRITY); assert(integrity.blockers.includes('C23_INTEGRITY_GROUNDING_MANIFEST'));

  console.log('C23_GOVERNED_LIVE_AI_PROVIDER_GATEWAY=PASS');
})().catch((err)=>{ console.error(err); process.exit(1); });
