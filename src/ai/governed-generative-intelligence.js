'use strict';

const crypto = require('crypto');

const CAPABILITY = 'C22_GOVERNED_GENERATIVE_INTELLIGENCE_ORCHESTRATION_V1';
const POLICY_VERSION = 'C22_GOVERNED_GENERATIVE_INTELLIGENCE_POLICY_V1';

const REVIEW_STATUS = Object.freeze({
  READY_FOR_HUMAN_AI_DRAFT_REVIEW: 'READY_FOR_HUMAN_AI_DRAFT_REVIEW',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
  HOLD_POLICY: 'HOLD_POLICY',
  HOLD_CONTEXT: 'HOLD_CONTEXT',
  HOLD_WINDOW: 'HOLD_WINDOW',
  HOLD_EVIDENCE: 'HOLD_EVIDENCE',
  HOLD_SECURITY: 'HOLD_SECURITY',
  HOLD_PROVIDER: 'HOLD_PROVIDER',
  HOLD_UNSUPPORTED_OUTPUT: 'HOLD_UNSUPPORTED_OUTPUT',
});

const TASK_CLASS = Object.freeze({
  EVIDENCE_SUMMARY: 'EVIDENCE_SUMMARY',
  GAP_ANALYSIS: 'GAP_ANALYSIS',
  RISK_SYNTHESIS: 'RISK_SYNTHESIS',
  SCENARIO_NARRATIVE: 'SCENARIO_NARRATIVE',
  COMPARABLE_EXPLANATION: 'COMPARABLE_EXPLANATION',
  EXECUTIVE_DRAFT: 'EXECUTIVE_DRAFT',
});

const DEPLOYMENT_MODE = Object.freeze({
  SIMULATION_ONLY: 'SIMULATION_ONLY',
  PRIVATE_INTERNAL: 'PRIVATE_INTERNAL',
  EXTERNAL_PROVIDER_REVIEW_REQUIRED: 'EXTERNAL_PROVIDER_REVIEW_REQUIRED',
});

const DATA_CLASS = Object.freeze({
  PUBLIC: 'PUBLIC',
  INTERNAL_BUSINESS: 'INTERNAL_BUSINESS',
  CONFIDENTIAL_BUSINESS: 'CONFIDENTIAL_BUSINESS',
  PERSONAL_DATA: 'PERSONAL_DATA',
});

const CLAIM_TYPE = Object.freeze({
  FACTUAL: 'FACTUAL',
  ANALYTICAL_DRAFT: 'ANALYTICAL_DRAFT',
});

const HASH_RE = /^[a-f0-9]{64}$/i;
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const clean = (v) => nonEmpty(v) ? v.trim() : '';

function iso(value, field) {
  if (!nonEmpty(value) || !Number.isFinite(Date.parse(value))) throw new TypeError(`${field} must be a valid date/time`);
  return new Date(value).toISOString();
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = stable(value[key]); return out; }, {});
}
function sha256(value) {
  try { return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex'); }
  catch (_) { return null; }
}
function without(value, fields) { const out = { ...value }; fields.forEach((f) => delete out[f]); return out; }
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze); return Object.freeze(value);
}
function uniqueStrings(values, field) {
  if (!Array.isArray(values)) throw new TypeError(`${field} must be an array`);
  const out = values.map(clean);
  if (out.some((v) => !v)) throw new TypeError(`${field} contains invalid value`);
  if (new Set(out).size !== out.length) throw new TypeError(`${field} contains duplicate values`);
  return [...out].sort();
}
function exactSet(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((v, i) => v === right[i]);
}
function statusFor(blockers) {
  if (blockers.some((b) => b.startsWith('C22_INTEGRITY_') || b.startsWith('C22_AUTHORITY_INJECTION'))) return REVIEW_STATUS.HOLD_INTEGRITY;
  if (blockers.some((b) => b.startsWith('C22_SECURITY_'))) return REVIEW_STATUS.HOLD_SECURITY;
  if (blockers.some((b) => b.startsWith('C22_PROVIDER_'))) return REVIEW_STATUS.HOLD_PROVIDER;
  if (blockers.some((b) => b.startsWith('C22_POLICY_'))) return REVIEW_STATUS.HOLD_POLICY;
  if (blockers.some((b) => b.startsWith('C22_CONTEXT_'))) return REVIEW_STATUS.HOLD_CONTEXT;
  if (blockers.some((b) => b.startsWith('C22_WINDOW_'))) return REVIEW_STATUS.HOLD_WINDOW;
  if (blockers.some((b) => b.startsWith('C22_UNSUPPORTED_'))) return REVIEW_STATUS.HOLD_UNSUPPORTED_OUTPUT;
  return REVIEW_STATUS.HOLD_EVIDENCE;
}

function computeProfileHash(r) { return r && typeof r === 'object' && !Array.isArray(r) ? sha256(without(r, ['modelProfileHashSha256'])) : null; }
function verifyProfileIntegrity(r) { return !!r && HASH_RE.test(clean(r.modelProfileHashSha256)) && computeProfileHash(r) === clean(r.modelProfileHashSha256).toLowerCase(); }

function createGovernedModelProfile(x = {}) {
  ['profileId','providerId','modelId','modelVersionRef','dataResidencyRef','retentionPolicyRef','modelCardRef','reviewedByRef','reviewEvidenceRef'].forEach((f) => {
    if (!nonEmpty(x[f])) throw new TypeError(`${f} must be a non-empty string`);
  });
  if (!Object.values(DEPLOYMENT_MODE).includes(x.deploymentMode)) throw new TypeError('C22_DEPLOYMENT_MODE_UNSUPPORTED');
  const allowedTaskClasses = uniqueStrings(x.allowedTaskClasses || [], 'allowedTaskClasses');
  const allowedDataClasses = uniqueStrings(x.allowedDataClasses || [], 'allowedDataClasses');
  if (!allowedTaskClasses.length || allowedTaskClasses.some((v) => !Object.values(TASK_CLASS).includes(v))) throw new TypeError('C22_PROFILE_TASK_CLASSES_INVALID');
  if (!allowedDataClasses.length || allowedDataClasses.some((v) => !Object.values(DATA_CLASS).includes(v))) throw new TypeError('C22_PROFILE_DATA_CLASSES_INVALID');
  if (x.trainingUseCustomerData !== false) throw new TypeError('C22_PROFILE_TRAINING_USE_MUST_BE_FALSE');
  if (x.publicAiAllowed !== false || x.transactionAuthority !== false || x.approvalAuthority !== false) throw new TypeError('C22_PROFILE_AUTHORITY_MUST_BE_FALSE');
  if (typeof x.maxOutputTokens !== 'number' || !Number.isInteger(x.maxOutputTokens) || x.maxOutputTokens <= 0) throw new TypeError('C22_PROFILE_MAX_OUTPUT_TOKENS_INVALID');
  if (typeof x.temperature !== 'number' || !Number.isFinite(x.temperature) || x.temperature < 0 || x.temperature > 2) throw new TypeError('C22_PROFILE_TEMPERATURE_INVALID');
  const reviewedAt = iso(x.reviewedAt, 'reviewedAt');
  const validUntil = iso(x.validUntil, 'validUntil');
  if (Date.parse(validUntil) < Date.parse(reviewedAt)) throw new TypeError('C22_PROFILE_VALIDITY_INVALID');
  const core = {
    schemaVersion: 1,
    profileId: x.profileId.trim(),
    providerId: x.providerId.trim(),
    modelId: x.modelId.trim(),
    modelVersionRef: x.modelVersionRef.trim(),
    deploymentMode: x.deploymentMode,
    allowedTaskClasses,
    allowedDataClasses,
    dataResidencyRef: x.dataResidencyRef.trim(),
    retentionPolicyRef: x.retentionPolicyRef.trim(),
    trainingUseCustomerData: false,
    maxOutputTokens: x.maxOutputTokens,
    temperature: x.temperature,
    modelCardRef: x.modelCardRef.trim(),
    reviewedByRef: x.reviewedByRef.trim(),
    reviewEvidenceRef: x.reviewEvidenceRef.trim(),
    reviewedAt,
    validUntil,
    liveProviderEnabled: false,
    externalNetworkEnabled: false,
    publicAiAllowed: false,
    transactionAuthority: false,
    approvalAuthority: false,
  };
  return freeze({ ...core, modelProfileHashSha256: sha256(core) });
}

function normalizeRetrievalItems(items) {
  if (!Array.isArray(items) || !items.length) throw new TypeError('C22_RETRIEVAL_ITEMS_REQUIRED');
  const ids = new Set();
  const hashes = new Set();
  return items.map((r) => {
    if (!r || typeof r !== 'object' || Array.isArray(r)) throw new TypeError('C22_RETRIEVAL_ITEM_OBJECT_REQUIRED');
    ['evidenceId','sourceReference'].forEach((f) => { if (!nonEmpty(r[f])) throw new TypeError(`C22_RETRIEVAL_${f}_REQUIRED`); });
    if (!HASH_RE.test(clean(r.evidenceHashSha256))) throw new TypeError('C22_RETRIEVAL_EVIDENCE_HASH_REQUIRED');
    if (!Object.values(DATA_CLASS).includes(r.dataClass)) throw new TypeError('C22_RETRIEVAL_DATA_CLASS_INVALID');
    if (typeof r.untrustedContent !== 'boolean' || typeof r.instructionLikeContentDetected !== 'boolean') throw new TypeError('C22_RETRIEVAL_TRUST_FLAGS_REQUIRED');
    const evidenceId = r.evidenceId.trim();
    const hash = r.evidenceHashSha256.trim().toLowerCase();
    if (ids.has(evidenceId)) throw new TypeError(`C22_DUPLICATE_RETRIEVAL_EVIDENCE_ID:${evidenceId}`);
    if (hashes.has(hash)) throw new TypeError(`C22_DUPLICATE_RETRIEVAL_EVIDENCE_HASH:${hash}`);
    ids.add(evidenceId); hashes.add(hash);
    const knownAt = iso(r.knownAt, 'knownAt');
    const validUntil = iso(r.validUntil, 'validUntil');
    if (Date.parse(validUntil) < Date.parse(knownAt)) throw new TypeError('C22_RETRIEVAL_VALIDITY_INVALID');
    return freeze({
      evidenceId,
      evidenceHashSha256: hash,
      sourceReference: r.sourceReference.trim(),
      dataClass: r.dataClass,
      knownAt,
      validUntil,
      untrustedContent: r.untrustedContent,
      instructionLikeContentDetected: r.instructionLikeContentDetected,
    });
  }).sort((a, b) => a.evidenceId.localeCompare(b.evidenceId));
}

function computeRequestHash(r) { return r && typeof r === 'object' && !Array.isArray(r) ? sha256(without(r, ['requestHashSha256'])) : null; }
function verifyRequestIntegrity(r) { return !!r && HASH_RE.test(clean(r.requestHashSha256)) && computeRequestHash(r) === clean(r.requestHashSha256).toLowerCase(); }

function createGovernedAiRequest(x = {}) {
  ['requestId','caseId','propertyRef','promptTemplateId','promptTemplateVersion','requesterRoleRef','authorizationRef'].forEach((f) => {
    if (!nonEmpty(x[f])) throw new TypeError(`${f} must be a non-empty string`);
  });
  if (!Object.values(TASK_CLASS).includes(x.taskClass)) throw new TypeError('C22_TASK_CLASS_UNSUPPORTED');
  if (!HASH_RE.test(clean(x.promptTemplateHashSha256))) throw new TypeError('C22_PROMPT_TEMPLATE_HASH_REQUIRED');
  if (!HASH_RE.test(clean(x.modelProfileHashSha256))) throw new TypeError('C22_MODEL_PROFILE_HASH_REQUIRED');
  const retrievalItems = normalizeRetrievalItems(x.retrievalItems);
  const deterministicOutputHashesSha256 = uniqueStrings(x.deterministicOutputHashesSha256 || [], 'deterministicOutputHashesSha256');
  if (deterministicOutputHashesSha256.some((h) => !HASH_RE.test(h))) throw new TypeError('C22_DETERMINISTIC_OUTPUT_HASH_INVALID');
  const allowedNumericLiterals = uniqueStrings((x.allowedNumericLiterals || []).map(String), 'allowedNumericLiterals');
  if (!nonEmpty(x.deterministicDecisionState)) throw new TypeError('C22_DETERMINISTIC_DECISION_STATE_REQUIRED');
  const createdAt = iso(x.createdAt, 'createdAt');
  const validUntil = iso(x.validUntil, 'validUntil');
  if (Date.parse(validUntil) < Date.parse(createdAt)) throw new TypeError('C22_REQUEST_VALIDITY_INVALID');
  const core = {
    schemaVersion: 1,
    requestId: x.requestId.trim(),
    caseId: x.caseId.trim(),
    propertyRef: x.propertyRef.trim(),
    taskClass: x.taskClass,
    promptTemplateId: x.promptTemplateId.trim(),
    promptTemplateVersion: x.promptTemplateVersion.trim(),
    promptTemplateHashSha256: x.promptTemplateHashSha256.trim().toLowerCase(),
    modelProfileHashSha256: x.modelProfileHashSha256.trim().toLowerCase(),
    retrievalItems,
    deterministicOutputHashesSha256,
    allowedNumericLiterals,
    deterministicDecisionState: x.deterministicDecisionState.trim(),
    requesterRoleRef: x.requesterRoleRef.trim(),
    authorizationRef: x.authorizationRef.trim(),
    createdAt,
    validUntil,
    untrustedContentIsDataOnly: true,
    autonomousToolExecutionAllowed: false,
    deterministicGateOverrideAllowed: false,
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
  };
  return freeze({ ...core, requestHashSha256: sha256(core) });
}

function normalizeClaims(claims) {
  if (!Array.isArray(claims)) throw new TypeError('C22_CLAIMS_ARRAY_REQUIRED');
  const ids = new Set();
  return claims.map((c) => {
    if (!c || typeof c !== 'object' || Array.isArray(c)) throw new TypeError('C22_CLAIM_OBJECT_REQUIRED');
    if (!nonEmpty(c.claimId) || !nonEmpty(c.text)) throw new TypeError('C22_CLAIM_ID_TEXT_REQUIRED');
    if (!Object.values(CLAIM_TYPE).includes(c.claimType)) throw new TypeError('C22_CLAIM_TYPE_INVALID');
    if (ids.has(c.claimId.trim())) throw new TypeError(`C22_DUPLICATE_CLAIM_ID:${c.claimId.trim()}`);
    ids.add(c.claimId.trim());
    const evidenceHashesSha256 = uniqueStrings(c.evidenceHashesSha256 || [], `claim.${c.claimId}.evidenceHashesSha256`);
    if (!evidenceHashesSha256.length || evidenceHashesSha256.some((h) => !HASH_RE.test(h))) throw new TypeError('C22_CLAIM_EVIDENCE_HASH_REQUIRED');
    const numericLiterals = uniqueStrings((c.numericLiterals || []).map(String), `claim.${c.claimId}.numericLiterals`);
    return freeze({
      claimId: c.claimId.trim(),
      claimType: c.claimType,
      text: c.text.trim(),
      evidenceHashesSha256,
      numericLiterals,
    });
  });
}

function computeResponseHash(r) { return r && typeof r === 'object' && !Array.isArray(r) ? sha256(without(r, ['responseHashSha256'])) : null; }
function verifyResponseIntegrity(r) { return !!r && HASH_RE.test(clean(r.responseHashSha256)) && computeResponseHash(r) === clean(r.responseHashSha256).toLowerCase(); }

function createGovernedGeneratedResponse(x = {}) {
  ['responseId','requestHashSha256','modelProfileHashSha256','draftText','echoDeterministicDecisionState'].forEach((f) => {
    if (!nonEmpty(x[f])) throw new TypeError(`${f} must be a non-empty string`);
  });
  if (!HASH_RE.test(clean(x.requestHashSha256)) || !HASH_RE.test(clean(x.modelProfileHashSha256))) throw new TypeError('C22_RESPONSE_BINDING_HASH_REQUIRED');
  const claims = normalizeClaims(x.claims || []);
  const missingEvidenceRefs = uniqueStrings(x.missingEvidenceRefs || [], 'missingEvidenceRefs');
  const uncertaintyMarkers = uniqueStrings(x.uncertaintyMarkers || [], 'uncertaintyMarkers');
  const generatedAt = iso(x.generatedAt, 'generatedAt');
  if (x.draftOnly !== true) throw new TypeError('C22_RESPONSE_DRAFT_ONLY_REQUIRED');
  if (x.transactionAuthorized !== false || x.approvalAuthorized !== false || x.publicAiAuthorized !== false) throw new TypeError('C22_RESPONSE_AUTHORITY_MUST_BE_FALSE');
  if (x.overrideDeterministicGateRequested !== false || x.followedUntrustedInstructions !== false) throw new TypeError('C22_RESPONSE_UNSAFE_FLAGS_MUST_BE_FALSE');
  if (x.simulatedAdapter !== true) throw new TypeError('C22_SIMULATED_ADAPTER_REQUIRED');
  const core = {
    schemaVersion: 1,
    responseId: x.responseId.trim(),
    requestHashSha256: x.requestHashSha256.trim().toLowerCase(),
    modelProfileHashSha256: x.modelProfileHashSha256.trim().toLowerCase(),
    claims,
    missingEvidenceRefs,
    uncertaintyMarkers,
    draftText: x.draftText.trim(),
    echoDeterministicDecisionState: x.echoDeterministicDecisionState.trim(),
    generatedAt,
    draftOnly: true,
    simulatedAdapter: true,
    liveModelCalled: false,
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    overrideDeterministicGateRequested: false,
    followedUntrustedInstructions: false,
    legalOpinionProduced: false,
    certifiedValuationProduced: false,
    autonomousActionExecuted: false,
  };
  return freeze({ ...core, responseHashSha256: sha256(core) });
}

function computePolicyHash(r) { return r && typeof r === 'object' && !Array.isArray(r) ? sha256(without(r, ['policyHashSha256'])) : null; }
function verifyPolicyIntegrity(r) { return !!r && HASH_RE.test(clean(r.policyHashSha256)) && computePolicyHash(r) === clean(r.policyHashSha256).toLowerCase(); }

function createGovernedAiPolicy(x = {}) {
  ['policyId','caseId','propertyRef','reviewedByRef','reviewEvidenceRef'].forEach((f) => {
    if (!nonEmpty(x[f])) throw new TypeError(`${f} must be a non-empty string`);
  });
  const allowedTaskClasses = uniqueStrings(x.allowedTaskClasses || [], 'allowedTaskClasses');
  const allowedDataClasses = uniqueStrings(x.allowedDataClasses || [], 'allowedDataClasses');
  const allowedDeploymentModes = uniqueStrings(x.allowedDeploymentModes || [], 'allowedDeploymentModes');
  if (!allowedTaskClasses.length || allowedTaskClasses.some((v) => !Object.values(TASK_CLASS).includes(v))) throw new TypeError('C22_POLICY_TASK_CLASSES_INVALID');
  if (!allowedDataClasses.length || allowedDataClasses.some((v) => !Object.values(DATA_CLASS).includes(v))) throw new TypeError('C22_POLICY_DATA_CLASSES_INVALID');
  if (!allowedDeploymentModes.length || allowedDeploymentModes.some((v) => !Object.values(DEPLOYMENT_MODE).includes(v))) throw new TypeError('C22_POLICY_DEPLOYMENT_MODES_INVALID');
  const modelProfileHashesSha256 = uniqueStrings(x.modelProfileHashesSha256 || [], 'modelProfileHashesSha256');
  const requestHashesSha256 = uniqueStrings(x.requestHashesSha256 || [], 'requestHashesSha256');
  if (!modelProfileHashesSha256.length || modelProfileHashesSha256.some((h) => !HASH_RE.test(h))) throw new TypeError('C22_POLICY_PROFILE_BINDINGS_REQUIRED');
  if (!requestHashesSha256.length || requestHashesSha256.some((h) => !HASH_RE.test(h))) throw new TypeError('C22_POLICY_REQUEST_BINDINGS_REQUIRED');
  const reviewedAt = iso(x.reviewedAt, 'reviewedAt');
  const validUntil = iso(x.validUntil, 'validUntil');
  if (Date.parse(validUntil) < Date.parse(reviewedAt)) throw new TypeError('C22_POLICY_VALIDITY_INVALID');
  const core = {
    version: POLICY_VERSION,
    policyId: x.policyId.trim(),
    caseId: x.caseId.trim(),
    propertyRef: x.propertyRef.trim(),
    allowedTaskClasses,
    allowedDataClasses,
    allowedDeploymentModes,
    modelProfileHashesSha256,
    requestHashesSha256,
    reviewedByRef: x.reviewedByRef.trim(),
    reviewEvidenceRef: x.reviewEvidenceRef.trim(),
    reviewedAt,
    validUntil,
    requireEvidenceForEveryClaim: true,
    requireNumericLiteralAllowList: true,
    requireSimulationAdapter: true,
    liveProviderActivationAuthorized: false,
    deterministicGateOverrideAllowed: false,
    autonomousActionsAllowed: false,
    publicAiAllowed: false,
  };
  return freeze({ ...core, policyHashSha256: sha256(core) });
}

const FORBIDDEN_TRUE_FIELDS = Object.freeze([
  'transactionAuthorized','approvalAuthorized','publicAiAuthorized','liveProviderEnabled','externalNetworkEnabled',
  'liveProviderActivationAuthorized','deterministicGateOverrideAllowed','autonomousActionsAllowed','autonomousToolExecutionAllowed',
  'overrideDeterministicGateRequested','followedUntrustedInstructions','legalOpinionProduced','certifiedValuationProduced','autonomousActionExecuted',
]);
function authorityInjection(record) {
  return !!record && FORBIDDEN_TRUE_FIELDS.some((f) => record[f] === true);
}

function evaluateGovernedGenerativeIntelligence(input = {}) {
  const profile = input.modelProfile;
  const request = input.request;
  const response = input.response;
  const policy = input.aiPolicy;
  const asOf = iso(input.asOf, 'asOf');
  const blockers = [];
  const riskFlags = [];

  if (!profile || !verifyProfileIntegrity(profile)) blockers.push('C22_INTEGRITY_PROFILE');
  if (!request || !verifyRequestIntegrity(request)) blockers.push('C22_INTEGRITY_REQUEST');
  if (!response || !verifyResponseIntegrity(response)) blockers.push('C22_INTEGRITY_RESPONSE');
  if (!policy || !verifyPolicyIntegrity(policy)) blockers.push('C22_INTEGRITY_POLICY');
  [profile, request, response, policy].forEach((r, i) => { if (authorityInjection(r)) blockers.push(`C22_AUTHORITY_INJECTION:${i}`); });

  if (profile && verifyProfileIntegrity(profile) && request && verifyRequestIntegrity(request) && response && verifyResponseIntegrity(response) && policy && verifyPolicyIntegrity(policy)) {
    if (request.caseId !== policy.caseId || request.propertyRef !== policy.propertyRef) blockers.push('C22_CONTEXT_REQUEST_POLICY');
    if (response.requestHashSha256 !== request.requestHashSha256) blockers.push('C22_INTEGRITY_RESPONSE_REQUEST_BINDING');
    if (request.modelProfileHashSha256 !== profile.modelProfileHashSha256 || response.modelProfileHashSha256 !== profile.modelProfileHashSha256) blockers.push('C22_INTEGRITY_PROFILE_BINDING');
    if (!exactSet(policy.modelProfileHashesSha256, [profile.modelProfileHashSha256].sort())) blockers.push('C22_POLICY_PROFILE_BINDING_MISMATCH');
    if (!exactSet(policy.requestHashesSha256, [request.requestHashSha256].sort())) blockers.push('C22_POLICY_REQUEST_BINDING_MISMATCH');
    if (!policy.allowedTaskClasses.includes(request.taskClass) || !profile.allowedTaskClasses.includes(request.taskClass)) blockers.push('C22_POLICY_TASK_CLASS_NOT_ALLOWED');
    if (!policy.allowedDeploymentModes.includes(profile.deploymentMode)) blockers.push('C22_PROVIDER_DEPLOYMENT_MODE_NOT_ALLOWED');
    if (profile.deploymentMode !== DEPLOYMENT_MODE.SIMULATION_ONLY) blockers.push('C22_PROVIDER_LIVE_MODE_NOT_AUTHORIZED');
    if (profile.liveProviderEnabled !== false || profile.externalNetworkEnabled !== false || response.liveModelCalled !== false) blockers.push('C22_PROVIDER_LIVE_CALL_NOT_AUTHORIZED');

    if (Date.parse(profile.reviewedAt) > Date.parse(asOf) || Date.parse(policy.reviewedAt) > Date.parse(asOf) || Date.parse(request.createdAt) > Date.parse(asOf) || Date.parse(response.generatedAt) > Date.parse(asOf)) blockers.push('C22_WINDOW_FUTURE_RECORD');
    if (Date.parse(profile.validUntil) < Date.parse(asOf) || Date.parse(policy.validUntil) < Date.parse(asOf) || Date.parse(request.validUntil) < Date.parse(asOf)) blockers.push('C22_WINDOW_STALE_RECORD');

    const allowedEvidenceHashes = new Set();
    for (const item of request.retrievalItems) {
      allowedEvidenceHashes.add(item.evidenceHashSha256);
      if (!policy.allowedDataClasses.includes(item.dataClass) || !profile.allowedDataClasses.includes(item.dataClass)) blockers.push(`C22_SECURITY_DATA_CLASS_NOT_ALLOWED:${item.evidenceId}`);
      if (Date.parse(item.knownAt) > Date.parse(asOf)) blockers.push(`C22_WINDOW_EVIDENCE_FUTURE:${item.evidenceId}`);
      if (Date.parse(item.validUntil) < Date.parse(asOf)) blockers.push(`C22_WINDOW_EVIDENCE_STALE:${item.evidenceId}`);
      if (item.untrustedContent && item.instructionLikeContentDetected) riskFlags.push(`C22_SECURITY_PROMPT_INJECTION_CONTENT_ISOLATED:${item.evidenceId}`);
    }

    const allowedNumbers = new Set(request.allowedNumericLiterals);
    for (const claim of response.claims) {
      if (!claim.evidenceHashesSha256.length) blockers.push(`C22_UNSUPPORTED_CLAIM_NO_EVIDENCE:${claim.claimId}`);
      for (const h of claim.evidenceHashesSha256) if (!allowedEvidenceHashes.has(h)) blockers.push(`C22_UNSUPPORTED_CLAIM_EVIDENCE:${claim.claimId}:${h}`);
      for (const n of claim.numericLiterals) if (!allowedNumbers.has(n)) blockers.push(`C22_UNSUPPORTED_NUMERIC_LITERAL:${claim.claimId}:${n}`);
    }

    if (response.echoDeterministicDecisionState !== request.deterministicDecisionState) blockers.push('C22_UNSUPPORTED_DETERMINISTIC_STATE_OVERRIDE');
    if (response.draftOnly !== true || response.simulatedAdapter !== true) blockers.push('C22_POLICY_DRAFT_SIMULATION_REQUIRED');
    if (response.overrideDeterministicGateRequested !== false) blockers.push('C22_SECURITY_GATE_OVERRIDE_REQUESTED');
    if (response.followedUntrustedInstructions !== false) blockers.push('C22_SECURITY_UNTRUSTED_INSTRUCTIONS_FOLLOWED');
  }

  const uniqueBlockers = [...new Set(blockers)].sort();
  const uniqueRiskFlags = [...new Set(riskFlags)].sort();
  const ready = uniqueBlockers.length === 0;
  return freeze({
    capability: CAPABILITY,
    policyVersion: POLICY_VERSION,
    status: ready ? REVIEW_STATUS.READY_FOR_HUMAN_AI_DRAFT_REVIEW : statusFor(uniqueBlockers),
    humanAiDraftReviewReady: ready,
    asOf,
    blockers: uniqueBlockers,
    riskFlags: uniqueRiskFlags,
    draft: ready ? response.draftText : null,
    claims: ready ? response.claims : null,
    missingEvidenceRefs: ready ? response.missingEvidenceRefs : null,
    uncertaintyMarkers: ready ? response.uncertaintyMarkers : null,
    liveModelCalled: false,
    liveProviderActivationAuthorized: false,
    publicAiAuthorized: false,
    transactionAuthorized: false,
    approvalAuthorized: false,
    autonomousActionExecuted: false,
    deterministicGateOverrideAllowed: false,
    commercialGoLive: 'HOLD',
    canonicalBaselineActivationAuthorized: false,
  });
}

module.exports = Object.freeze({
  CAPABILITY,
  POLICY_VERSION,
  REVIEW_STATUS,
  TASK_CLASS,
  DEPLOYMENT_MODE,
  DATA_CLASS,
  CLAIM_TYPE,
  createGovernedModelProfile,
  computeProfileHash,
  verifyProfileIntegrity,
  createGovernedAiRequest,
  computeRequestHash,
  verifyRequestIntegrity,
  createGovernedGeneratedResponse,
  computeResponseHash,
  verifyResponseIntegrity,
  createGovernedAiPolicy,
  computePolicyHash,
  verifyPolicyIntegrity,
  evaluateGovernedGenerativeIntelligence,
});