'use strict';

const assert = require('assert');
const {
  REVIEW_STATUS,
  TASK_CLASS,
  DEPLOYMENT_MODE,
  DATA_CLASS,
  CLAIM_TYPE,
  createGovernedModelProfile,
  verifyProfileIntegrity,
  createGovernedAiRequest,
  verifyRequestIntegrity,
  createGovernedGeneratedResponse,
  verifyResponseIntegrity,
  createGovernedAiPolicy,
  verifyPolicyIntegrity,
  evaluateGovernedGenerativeIntelligence,
} = require('../../src/ai/governed-generative-intelligence');

const AS_OF = '2026-10-01T12:00:00Z';
const H1 = '1'.repeat(64);
const H2 = '2'.repeat(64);
const H3 = '3'.repeat(64);
const H9 = '9'.repeat(64);

function profile(overrides = {}) {
  return createGovernedModelProfile({
    profileId: 'PROFILE-C22-SIM',
    providerId: 'SIMULATED_PROVIDER',
    modelId: 'SIMULATED_GROUNDED_MODEL',
    modelVersionRef: 'SIM-V1',
    deploymentMode: DEPLOYMENT_MODE.SIMULATION_ONLY,
    allowedTaskClasses: Object.values(TASK_CLASS),
    allowedDataClasses: [DATA_CLASS.PUBLIC, DATA_CLASS.INTERNAL_BUSINESS],
    dataResidencyRef: 'NO_EXTERNAL_DATA_TRANSFER-SIMULATION',
    retentionPolicyRef: 'NO_PROVIDER_RETENTION-SIMULATION',
    trainingUseCustomerData: false,
    maxOutputTokens: 1200,
    temperature: 0,
    modelCardRef: 'MODEL-CARD-C22-SIM-V1',
    reviewedByRef: 'AI-GOVERNANCE-REVIEWER',
    reviewEvidenceRef: 'AI-GOVERNANCE-REVIEW-EVIDENCE',
    reviewedAt: '2026-10-01T09:00:00Z',
    validUntil: '2026-10-05T12:00:00Z',
    publicAiAllowed: false,
    transactionAuthority: false,
    approvalAuthority: false,
    ...overrides,
  });
}

function retrieval(overrides = {}) {
  return [
    {
      evidenceId: 'EVIDENCE-LISTING-SUMMARY',
      evidenceHashSha256: H1,
      sourceReference: 'C21-LISTING-OUTPUT',
      dataClass: DATA_CLASS.INTERNAL_BUSINESS,
      knownAt: '2026-10-01T08:00:00Z',
      validUntil: '2026-10-03T12:00:00Z',
      untrustedContent: false,
      instructionLikeContentDetected: false,
      ...(overrides.first || {}),
    },
    {
      evidenceId: 'EVIDENCE-AMENITY-SUMMARY',
      evidenceHashSha256: H2,
      sourceReference: 'C21-AMENITY-OUTPUT',
      dataClass: DATA_CLASS.INTERNAL_BUSINESS,
      knownAt: '2026-10-01T08:00:00Z',
      validUntil: '2026-10-03T12:00:00Z',
      untrustedContent: true,
      instructionLikeContentDetected: true,
      ...(overrides.second || {}),
    },
  ];
}

function request(p, overrides = {}) {
  return createGovernedAiRequest({
    requestId: 'REQ-C22-001',
    caseId: 'CASE-22',
    propertyRef: 'PROP-22',
    taskClass: TASK_CLASS.EXECUTIVE_DRAFT,
    promptTemplateId: 'PROMPT-C22-EXECUTIVE-DRAFT',
    promptTemplateVersion: 'V1',
    promptTemplateHashSha256: H3,
    modelProfileHashSha256: p.modelProfileHashSha256,
    retrievalItems: retrieval(),
    deterministicOutputHashesSha256: [H3],
    allowedNumericLiterals: ['2000', '72'],
    deterministicDecisionState: 'HOLD',
    requesterRoleRef: 'AUTHORIZED-INTERNAL-ANALYST',
    authorizationRef: 'AUTH-C22-001',
    createdAt: '2026-10-01T10:00:00Z',
    validUntil: '2026-10-02T12:00:00Z',
    ...overrides,
  });
}

function response(req, p, overrides = {}) {
  return createGovernedGeneratedResponse({
    responseId: 'RESP-C22-001',
    requestHashSha256: req.requestHashSha256,
    modelProfileHashSha256: p.modelProfileHashSha256,
    claims: [
      {
        claimId: 'CLAIM-1',
        claimType: CLAIM_TYPE.FACTUAL,
        text: 'The governed asking-listing metric is 2000.',
        evidenceHashesSha256: [H1],
        numericLiterals: ['2000'],
      },
      {
        claimId: 'CLAIM-2',
        claimType: CLAIM_TYPE.ANALYTICAL_DRAFT,
        text: 'The externally supplied professional amenity utility summary is 72.',
        evidenceHashesSha256: [H2],
        numericLiterals: ['72'],
      },
    ],
    missingEvidenceRefs: ['LIVE_PROVIDER_NOT_ENABLED'],
    uncertaintyMarkers: ['DRAFT_REQUIRES_HUMAN_REVIEW'],
    draftText: 'Governed evidence reports the supplied listing and amenity metrics. The deterministic decision state remains HOLD.',
    echoDeterministicDecisionState: 'HOLD',
    generatedAt: '2026-10-01T10:30:00Z',
    draftOnly: true,
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    overrideDeterministicGateRequested: false,
    followedUntrustedInstructions: false,
    simulatedAdapter: true,
    ...overrides,
  });
}

function policy(p, req, overrides = {}) {
  return createGovernedAiPolicy({
    policyId: 'POLICY-C22',
    caseId: 'CASE-22',
    propertyRef: 'PROP-22',
    allowedTaskClasses: Object.values(TASK_CLASS),
    allowedDataClasses: [DATA_CLASS.PUBLIC, DATA_CLASS.INTERNAL_BUSINESS],
    allowedDeploymentModes: [DEPLOYMENT_MODE.SIMULATION_ONLY],
    modelProfileHashesSha256: [p.modelProfileHashSha256],
    requestHashesSha256: [req.requestHashSha256],
    reviewedByRef: 'AI-GOVERNANCE-REVIEWER',
    reviewEvidenceRef: 'POLICY-REVIEW-C22',
    reviewedAt: '2026-10-01T10:15:00Z',
    validUntil: '2026-10-05T12:00:00Z',
    ...overrides,
  });
}

function fixture() {
  const p = profile();
  const req = request(p);
  const resp = response(req, p);
  const pol = policy(p, req);
  return { p, req, resp, pol };
}

const f = fixture();
assert(verifyProfileIntegrity(f.p));
assert(verifyRequestIntegrity(f.req));
assert(verifyResponseIntegrity(f.resp));
assert(verifyPolicyIntegrity(f.pol));

const ready = evaluateGovernedGenerativeIntelligence({ modelProfile: f.p, request: f.req, response: f.resp, aiPolicy: f.pol, asOf: AS_OF });
assert.strictEqual(ready.status, REVIEW_STATUS.READY_FOR_HUMAN_AI_DRAFT_REVIEW);
assert.strictEqual(ready.humanAiDraftReviewReady, true);
assert.strictEqual(ready.liveModelCalled, false);
assert.strictEqual(ready.liveProviderActivationAuthorized, false);
assert.strictEqual(ready.publicAiAuthorized, false);
assert.strictEqual(ready.transactionAuthorized, false);
assert.strictEqual(ready.approvalAuthorized, false);
assert.strictEqual(ready.autonomousActionExecuted, false);
assert.strictEqual(ready.deterministicGateOverrideAllowed, false);
assert.strictEqual(ready.commercialGoLive, 'HOLD');
assert.strictEqual(ready.canonicalBaselineActivationAuthorized, false);
assert(ready.riskFlags.includes('C22_SECURITY_PROMPT_INJECTION_CONTENT_ISOLATED:EVIDENCE-AMENITY-SUMMARY'));
assert.strictEqual(ready.claims.length, 2);

const unsupportedNumberResponse = response(f.req, f.p, {
  responseId: 'RESP-C22-NUMBER',
  claims: [{
    claimId: 'CLAIM-NUMBER', claimType: CLAIM_TYPE.FACTUAL,
    text: 'A model-generated unsupported metric is 999.',
    evidenceHashesSha256: [H1], numericLiterals: ['999'],
  }],
});
const unsupportedNumber = evaluateGovernedGenerativeIntelligence({ modelProfile: f.p, request: f.req, response: unsupportedNumberResponse, aiPolicy: f.pol, asOf: AS_OF });
assert.strictEqual(unsupportedNumber.status, REVIEW_STATUS.HOLD_UNSUPPORTED_OUTPUT);
assert(unsupportedNumber.blockers.includes('C22_UNSUPPORTED_NUMERIC_LITERAL:CLAIM-NUMBER:999'));
assert.strictEqual(unsupportedNumber.draft, null);

const unsupportedEvidenceResponse = response(f.req, f.p, {
  responseId: 'RESP-C22-EVIDENCE',
  claims: [{
    claimId: 'CLAIM-EVIDENCE', claimType: CLAIM_TYPE.FACTUAL,
    text: 'Unsupported evidence reference.', evidenceHashesSha256: [H9], numericLiterals: [],
  }],
});
const unsupportedEvidence = evaluateGovernedGenerativeIntelligence({ modelProfile: f.p, request: f.req, response: unsupportedEvidenceResponse, aiPolicy: f.pol, asOf: AS_OF });
assert.strictEqual(unsupportedEvidence.status, REVIEW_STATUS.HOLD_UNSUPPORTED_OUTPUT);
assert(unsupportedEvidence.blockers.some((b) => b.startsWith('C22_UNSUPPORTED_CLAIM_EVIDENCE')));

const personalProfile = profile({ profileId: 'PROFILE-PERSONAL', allowedDataClasses: [DATA_CLASS.PUBLIC, DATA_CLASS.INTERNAL_BUSINESS, DATA_CLASS.PERSONAL_DATA] });
const personalReq = request(personalProfile, { requestId: 'REQ-PERSONAL', retrievalItems: retrieval({ first: { dataClass: DATA_CLASS.PERSONAL_DATA } }) });
const personalResp = response(personalReq, personalProfile, { responseId: 'RESP-PERSONAL' });
const personalPolicy = policy(personalProfile, personalReq, { policyId: 'POLICY-PERSONAL' });
const personal = evaluateGovernedGenerativeIntelligence({ modelProfile: personalProfile, request: personalReq, response: personalResp, aiPolicy: personalPolicy, asOf: AS_OF });
assert.strictEqual(personal.status, REVIEW_STATUS.HOLD_SECURITY);
assert(personal.blockers.some((b) => b.startsWith('C22_SECURITY_DATA_CLASS_NOT_ALLOWED')));

const privateProfile = profile({ profileId: 'PROFILE-PRIVATE', deploymentMode: DEPLOYMENT_MODE.PRIVATE_INTERNAL });
const privateReq = request(privateProfile, { requestId: 'REQ-PRIVATE' });
const privateResp = response(privateReq, privateProfile, { responseId: 'RESP-PRIVATE' });
const privatePolicy = policy(privateProfile, privateReq, { policyId: 'POLICY-PRIVATE' });
const privateMode = evaluateGovernedGenerativeIntelligence({ modelProfile: privateProfile, request: privateReq, response: privateResp, aiPolicy: privatePolicy, asOf: AS_OF });
assert.strictEqual(privateMode.status, REVIEW_STATUS.HOLD_PROVIDER);
assert(privateMode.blockers.includes('C22_PROVIDER_DEPLOYMENT_MODE_NOT_ALLOWED'));
assert(privateMode.blockers.includes('C22_PROVIDER_LIVE_MODE_NOT_AUTHORIZED'));

const staleReq = request(f.p, { requestId: 'REQ-STALE', retrievalItems: retrieval({ first: { validUntil: '2026-09-30T12:00:00Z' } }) });
const staleResp = response(staleReq, f.p, { responseId: 'RESP-STALE' });
const stalePolicy = policy(f.p, staleReq, { policyId: 'POLICY-STALE' });
const stale = evaluateGovernedGenerativeIntelligence({ modelProfile: f.p, request: staleReq, response: staleResp, aiPolicy: stalePolicy, asOf: AS_OF });
assert.strictEqual(stale.status, REVIEW_STATUS.HOLD_WINDOW);
assert(stale.blockers.includes('C22_WINDOW_EVIDENCE_STALE:EVIDENCE-LISTING-SUMMARY'));

const mismatchResponse = response(f.req, f.p, { responseId: 'RESP-MISMATCH', echoDeterministicDecisionState: 'APPROVE' });
const mismatch = evaluateGovernedGenerativeIntelligence({ modelProfile: f.p, request: f.req, response: mismatchResponse, aiPolicy: f.pol, asOf: AS_OF });
assert.strictEqual(mismatch.status, REVIEW_STATUS.HOLD_UNSUPPORTED_OUTPUT);
assert(mismatch.blockers.includes('C22_UNSUPPORTED_DETERMINISTIC_STATE_OVERRIDE'));

const tamperedResponse = { ...f.resp, draftText: 'Tampered after hashing.' };
const tampered = evaluateGovernedGenerativeIntelligence({ modelProfile: f.p, request: f.req, response: tamperedResponse, aiPolicy: f.pol, asOf: AS_OF });
assert.strictEqual(tampered.status, REVIEW_STATUS.HOLD_INTEGRITY);
assert(tampered.blockers.includes('C22_INTEGRITY_RESPONSE'));

assert.throws(() => createGovernedGeneratedResponse({
  responseId: 'BAD', requestHashSha256: H1, modelProfileHashSha256: H2,
  claims: [], missingEvidenceRefs: [], uncertaintyMarkers: [], draftText: 'Bad response', echoDeterministicDecisionState: 'HOLD',
  generatedAt: '2026-10-01T10:00:00Z', draftOnly: true, transactionAuthorized: false, approvalAuthorized: false, publicAiAuthorized: false,
  overrideDeterministicGateRequested: true, followedUntrustedInstructions: false, simulatedAdapter: true,
}), /C22_RESPONSE_UNSAFE_FLAGS_MUST_BE_FALSE/);

console.log('C22_GOVERNED_GENERATIVE_INTELLIGENCE=PASS');