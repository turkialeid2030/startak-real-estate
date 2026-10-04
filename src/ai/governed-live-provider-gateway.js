'use strict';

const crypto = require('crypto');
const {
  verifyProfileIntegrity,
  verifyRequestIntegrity,
  DATA_CLASS,
} = require('./governed-generative-intelligence');

const CAPABILITY = 'C23_GOVERNED_LIVE_AI_PROVIDER_GATEWAY_V1';
const POLICY_VERSION = 'C23_PROOF_GROUNDED_PROVIDER_POLICY_V1';

const STATUS = Object.freeze({
  READY_FOR_PROVIDER_INVOCATION: 'READY_FOR_PROVIDER_INVOCATION',
  READY_FOR_HUMAN_GROUNDED_DRAFT_REVIEW: 'READY_FOR_HUMAN_GROUNDED_DRAFT_REVIEW',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
  HOLD_CONTEXT: 'HOLD_CONTEXT',
  HOLD_WINDOW: 'HOLD_WINDOW',
  HOLD_EVIDENCE: 'HOLD_EVIDENCE',
  HOLD_SECURITY: 'HOLD_SECURITY',
  HOLD_PROVIDER: 'HOLD_PROVIDER',
  HOLD_UNSUPPORTED_OUTPUT: 'HOLD_UNSUPPORTED_OUTPUT',
});

const ENVIRONMENT = Object.freeze({
  ISOLATED_NON_PRODUCTION: 'ISOLATED_NON_PRODUCTION',
});

const GROUNDING_KIND = Object.freeze({
  FACT: 'FACT',
  NUMERIC: 'NUMERIC',
  PERCENTAGE: 'PERCENTAGE',
  DATE: 'DATE',
  ENTITY: 'ENTITY',
  DETERMINISTIC_STATE: 'DETERMINISTIC_STATE',
});

const PROVIDER_RESULT = Object.freeze({
  SUCCESS: 'SUCCESS',
  TIMEOUT: 'TIMEOUT',
  RATE_LIMITED: 'RATE_LIMITED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  SCHEMA_ERROR: 'SCHEMA_ERROR',
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
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}
function without(value, fields) { const out = { ...value }; fields.forEach((f) => delete out[f]); return out; }
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}
function uniqueStrings(values, field) {
  if (!Array.isArray(values)) throw new TypeError(`${field} must be an array`);
  const out = values.map(clean);
  if (out.some((v) => !v)) throw new TypeError(`${field} contains invalid value`);
  if (new Set(out).size !== out.length) throw new TypeError(`${field} contains duplicate values`);
  return [...out].sort();
}
function requireHash(value, field) {
  const v = clean(value).toLowerCase();
  if (!HASH_RE.test(v)) throw new TypeError(`${field} must be SHA-256`);
  return v;
}
function integrity(record, hashField) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
  const h = clean(record[hashField]).toLowerCase();
  return HASH_RE.test(h) && sha256(without(record, [hashField])) === h;
}

const ARABIC_DIGITS = Object.freeze({ '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9','۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9' });
function normalizeDigits(text) { return String(text).replace(/[٠-٩۰-۹]/g, (d) => ARABIC_DIGITS[d]); }
function canonicalLiteral(value) {
  let v = normalizeDigits(String(value)).trim();
  if (!v) throw new TypeError('C23_GROUNDING_CANONICAL_VALUE_REQUIRED');
  if (/^[+-]?[0-9][0-9,]*(?:\.[0-9]+)?%$/.test(v)) return v.replace(/,/g, '');
  if (/^[+-]?[0-9][0-9,]*(?:\.[0-9]+)?$/.test(v)) return v.replace(/,/g, '');
  return v;
}
function extractAssertedLiterals(text) {
  const normalized = normalizeDigits(String(text));
  const found = new Set();
  const dates = normalized.match(/\b\d{4}-\d{2}-\d{2}\b/g) || [];
  dates.forEach((d) => found.add(d));
  const scrubbed = normalized.replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ');
  const numbers = scrubbed.match(/[+-]?\d[\d,]*(?:\.\d+)?%?/g) || [];
  numbers.forEach((n) => found.add(canonicalLiteral(n)));
  return [...found].sort();
}

function createGroundingManifest(x = {}) {
  ['manifestId','caseId','propertyRef','requestHashSha256','preparedByRef','reviewEvidenceRef'].forEach((f) => {
    if (!nonEmpty(x[f])) throw new TypeError(`${f} must be a non-empty string`);
  });
  const requestHashSha256 = requireHash(x.requestHashSha256, 'requestHashSha256');
  if (!Array.isArray(x.items) || !x.items.length) throw new TypeError('C23_GROUNDING_ITEMS_REQUIRED');
  const ids = new Set();
  const recordHashes = new Set();
  const items = x.items.map((r) => {
    if (!r || typeof r !== 'object' || Array.isArray(r)) throw new TypeError('C23_GROUNDING_ITEM_OBJECT_REQUIRED');
    ['itemId','sourceReference'].forEach((f) => { if (!nonEmpty(r[f])) throw new TypeError(`C23_GROUNDING_${f}_REQUIRED`); });
    if (!Object.values(GROUNDING_KIND).includes(r.kind)) throw new TypeError('C23_GROUNDING_KIND_INVALID');
    if (!Object.values(DATA_CLASS).includes(r.dataClass)) throw new TypeError('C23_GROUNDING_DATA_CLASS_INVALID');
    const itemId = r.itemId.trim();
    if (ids.has(itemId)) throw new TypeError(`C23_DUPLICATE_GROUNDING_ITEM:${itemId}`);
    ids.add(itemId);
    const evidenceHashSha256 = r.evidenceHashSha256 ? requireHash(r.evidenceHashSha256, 'evidenceHashSha256') : null;
    const deterministicOutputHashSha256 = r.deterministicOutputHashSha256 ? requireHash(r.deterministicOutputHashSha256, 'deterministicOutputHashSha256') : null;
    if ((evidenceHashSha256 ? 1 : 0) + (deterministicOutputHashSha256 ? 1 : 0) !== 1) throw new TypeError('C23_GROUNDING_EXACTLY_ONE_SOURCE_HASH_REQUIRED');
    const knownAt = iso(r.knownAt, 'knownAt');
    const validUntil = iso(r.validUntil, 'validUntil');
    if (Date.parse(validUntil) < Date.parse(knownAt)) throw new TypeError('C23_GROUNDING_VALIDITY_INVALID');
    const core = {
      itemId,
      kind: r.kind,
      canonicalValue: canonicalLiteral(r.canonicalValue),
      caseId: x.caseId.trim(),
      propertyRef: x.propertyRef.trim(),
      sourceReference: r.sourceReference.trim(),
      evidenceHashSha256,
      deterministicOutputHashSha256,
      dataClass: r.dataClass,
      knownAt,
      validUntil,
      humanVerified: r.humanVerified === true,
    };
    if (!core.humanVerified) throw new TypeError(`C23_GROUNDING_HUMAN_VERIFICATION_REQUIRED:${itemId}`);
    const recordHashSha256 = sha256(core);
    if (recordHashes.has(recordHashSha256)) throw new TypeError('C23_DUPLICATE_GROUNDING_RECORD_HASH');
    recordHashes.add(recordHashSha256);
    return freeze({ ...core, recordHashSha256 });
  }).sort((a,b) => a.itemId.localeCompare(b.itemId));
  const reviewedAt = iso(x.reviewedAt, 'reviewedAt');
  const validUntil = iso(x.validUntil, 'validUntil');
  if (Date.parse(validUntil) < Date.parse(reviewedAt)) throw new TypeError('C23_GROUNDING_MANIFEST_VALIDITY_INVALID');
  const core = {
    schemaVersion: 1,
    manifestId: x.manifestId.trim(),
    caseId: x.caseId.trim(),
    propertyRef: x.propertyRef.trim(),
    requestHashSha256,
    items,
    preparedByRef: x.preparedByRef.trim(),
    reviewEvidenceRef: x.reviewEvidenceRef.trim(),
    reviewedAt,
    validUntil,
  };
  return freeze({ ...core, manifestHashSha256: sha256(core) });
}
function verifyGroundingManifest(r) { return integrity(r, 'manifestHashSha256') && Array.isArray(r.items) && r.items.every((i) => integrity(i, 'recordHashSha256')); }

function createProviderAuthorization(x = {}) {
  const required = [
    'authorizationId','providerId','modelId','modelVersionRef','securityReviewEvidenceRef','privacyDlpReviewEvidenceRef',
    'contractualApprovalEvidenceRef','dataResidencyRef','retentionPolicyRef','noTrainingEvidenceRef','promptRegistryRef',
    'roleAuthorizationRef','environmentAuthorizationRef','killSwitchRef','reviewedByRef',
  ];
  required.forEach((f) => { if (!nonEmpty(x[f])) throw new TypeError(`${f} must be a non-empty string`); });
  if (x.environment !== ENVIRONMENT.ISOLATED_NON_PRODUCTION) throw new TypeError('C23_PROVIDER_ENVIRONMENT_NOT_ALLOWED');
  const evidenceHashesSha256 = uniqueStrings(x.evidenceHashesSha256 || [], 'evidenceHashesSha256');
  if (evidenceHashesSha256.length < 6 || evidenceHashesSha256.some((h) => !HASH_RE.test(h))) throw new TypeError('C23_PROVIDER_AUTH_EVIDENCE_HASHES_REQUIRED');
  if (x.trainingUseCustomerData !== false) throw new TypeError('C23_PROVIDER_CUSTOMER_TRAINING_MUST_BE_FALSE');
  const reviewedAt = iso(x.reviewedAt, 'reviewedAt');
  const validUntil = iso(x.validUntil, 'validUntil');
  if (Date.parse(validUntil) < Date.parse(reviewedAt)) throw new TypeError('C23_PROVIDER_AUTH_VALIDITY_INVALID');
  const core = {
    schemaVersion: 1,
    authorizationId: x.authorizationId.trim(),
    providerId: x.providerId.trim(),
    modelId: x.modelId.trim(),
    modelVersionRef: x.modelVersionRef.trim(),
    environment: x.environment,
    securityReviewEvidenceRef: x.securityReviewEvidenceRef.trim(),
    privacyDlpReviewEvidenceRef: x.privacyDlpReviewEvidenceRef.trim(),
    contractualApprovalEvidenceRef: x.contractualApprovalEvidenceRef.trim(),
    dataResidencyRef: x.dataResidencyRef.trim(),
    retentionPolicyRef: x.retentionPolicyRef.trim(),
    noTrainingEvidenceRef: x.noTrainingEvidenceRef.trim(),
    promptRegistryRef: x.promptRegistryRef.trim(),
    roleAuthorizationRef: x.roleAuthorizationRef.trim(),
    environmentAuthorizationRef: x.environmentAuthorizationRef.trim(),
    killSwitchRef: x.killSwitchRef.trim(),
    evidenceHashesSha256,
    trainingUseCustomerData: false,
    networkInvocationAuthorized: x.networkInvocationAuthorized === true,
    reviewedByRef: x.reviewedByRef.trim(),
    reviewedAt,
    validUntil,
    productionDeploymentAuthorized: false,
    publicAiAuthorized: false,
    transactionAuthorized: false,
    approvalAuthorized: false,
  };
  return freeze({ ...core, authorizationHashSha256: sha256(core) });
}
function verifyProviderAuthorization(r) { return integrity(r, 'authorizationHashSha256'); }

function createProviderInvocationEnvelope(x = {}) {
  ['invocationId','caseId','propertyRef','requestHashSha256','modelProfileHashSha256','groundingManifestHashSha256','providerAuthorizationHashSha256','promptTemplateHashSha256','deterministicDecisionState'].forEach((f) => {
    if (!nonEmpty(x[f])) throw new TypeError(`${f} must be a non-empty string`);
  });
  ['requestHashSha256','modelProfileHashSha256','groundingManifestHashSha256','providerAuthorizationHashSha256','promptTemplateHashSha256'].forEach((f) => requireHash(x[f], f));
  const createdAt = iso(x.createdAt, 'createdAt');
  const validUntil = iso(x.validUntil, 'validUntil');
  if (Date.parse(validUntil) < Date.parse(createdAt)) throw new TypeError('C23_INVOCATION_VALIDITY_INVALID');
  const core = {
    schemaVersion: 1,
    invocationId: x.invocationId.trim(),
    caseId: x.caseId.trim(),
    propertyRef: x.propertyRef.trim(),
    requestHashSha256: x.requestHashSha256.trim().toLowerCase(),
    modelProfileHashSha256: x.modelProfileHashSha256.trim().toLowerCase(),
    groundingManifestHashSha256: x.groundingManifestHashSha256.trim().toLowerCase(),
    providerAuthorizationHashSha256: x.providerAuthorizationHashSha256.trim().toLowerCase(),
    promptTemplateHashSha256: x.promptTemplateHashSha256.trim().toLowerCase(),
    deterministicDecisionState: x.deterministicDecisionState.trim(),
    createdAt,
    validUntil,
    structuredClaimsOnly: true,
    toolsEnabled: false,
    autonomousActionsAllowed: false,
  };
  return freeze({ ...core, invocationHashSha256: sha256(core) });
}
function verifyProviderInvocationEnvelope(r) { return integrity(r, 'invocationHashSha256'); }

function normalizeProviderClaims(claims) {
  if (!Array.isArray(claims) || !claims.length) throw new TypeError('C23_PROVIDER_CLAIMS_REQUIRED');
  const ids = new Set();
  return claims.map((c) => {
    if (!c || typeof c !== 'object' || Array.isArray(c)) throw new TypeError('C23_PROVIDER_CLAIM_OBJECT_REQUIRED');
    if (!nonEmpty(c.claimId) || !nonEmpty(c.text)) throw new TypeError('C23_PROVIDER_CLAIM_ID_TEXT_REQUIRED');
    const claimId = c.claimId.trim();
    if (ids.has(claimId)) throw new TypeError(`C23_DUPLICATE_PROVIDER_CLAIM:${claimId}`);
    ids.add(claimId);
    const groundingItemIds = uniqueStrings(c.groundingItemIds || [], `claim.${claimId}.groundingItemIds`);
    if (!groundingItemIds.length) throw new TypeError(`C23_PROVIDER_CLAIM_GROUNDING_REQUIRED:${claimId}`);
    const assertedLiterals = uniqueStrings((c.assertedLiterals || []).map(canonicalLiteral), `claim.${claimId}.assertedLiterals`);
    return freeze({ claimId, text: c.text.trim(), groundingItemIds, assertedLiterals });
  });
}

function createProviderResponseEnvelope(x = {}) {
  ['responseId','invocationHashSha256','providerId','modelId','modelVersionRef','echoDeterministicDecisionState'].forEach((f) => {
    if (!nonEmpty(x[f])) throw new TypeError(`${f} must be a non-empty string`);
  });
  requireHash(x.invocationHashSha256, 'invocationHashSha256');
  if (x.providerResult !== PROVIDER_RESULT.SUCCESS) throw new TypeError('C23_PROVIDER_RESPONSE_SUCCESS_REQUIRED');
  const claims = normalizeProviderClaims(x.claims);
  const generatedAt = iso(x.generatedAt, 'generatedAt');
  if (x.overrideDeterministicGateRequested === true || x.followedUntrustedInstructions === true || x.autonomousActionExecuted === true) throw new TypeError('C23_PROVIDER_UNSAFE_RESPONSE_FLAGS');
  const core = {
    schemaVersion: 1,
    responseId: x.responseId.trim(),
    invocationHashSha256: x.invocationHashSha256.trim().toLowerCase(),
    providerId: x.providerId.trim(),
    modelId: x.modelId.trim(),
    modelVersionRef: x.modelVersionRef.trim(),
    providerResult: x.providerResult,
    claims,
    echoDeterministicDecisionState: x.echoDeterministicDecisionState.trim(),
    generatedAt,
    overrideDeterministicGateRequested: false,
    followedUntrustedInstructions: false,
    autonomousActionExecuted: false,
    draftOnly: true,
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    certifiedValuationProduced: false,
    legalOpinionProduced: false,
  };
  return freeze({ ...core, responseHashSha256: sha256(core) });
}
function verifyProviderResponseEnvelope(r) { return integrity(r, 'responseHashSha256'); }

function baseBlockers({ modelProfile, request, groundingManifest, providerAuthorization, invocation, asOf }) {
  const blockers = [];
  if (!verifyProfileIntegrity(modelProfile)) blockers.push('C23_INTEGRITY_MODEL_PROFILE');
  if (!verifyRequestIntegrity(request)) blockers.push('C23_INTEGRITY_C22_REQUEST');
  if (!verifyGroundingManifest(groundingManifest)) blockers.push('C23_INTEGRITY_GROUNDING_MANIFEST');
  if (!verifyProviderAuthorization(providerAuthorization)) blockers.push('C23_INTEGRITY_PROVIDER_AUTHORIZATION');
  if (!verifyProviderInvocationEnvelope(invocation)) blockers.push('C23_INTEGRITY_INVOCATION');
  if (blockers.length) return blockers;

  if (request.caseId !== groundingManifest.caseId || request.propertyRef !== groundingManifest.propertyRef || request.caseId !== invocation.caseId || request.propertyRef !== invocation.propertyRef) blockers.push('C23_CONTEXT_CASE_PROPERTY_MISMATCH');
  if (groundingManifest.requestHashSha256 !== request.requestHashSha256 || invocation.requestHashSha256 !== request.requestHashSha256) blockers.push('C23_INTEGRITY_REQUEST_BINDING');
  if (invocation.modelProfileHashSha256 !== modelProfile.modelProfileHashSha256) blockers.push('C23_INTEGRITY_PROFILE_BINDING');
  if (invocation.groundingManifestHashSha256 !== groundingManifest.manifestHashSha256) blockers.push('C23_INTEGRITY_GROUNDING_BINDING');
  if (invocation.providerAuthorizationHashSha256 !== providerAuthorization.authorizationHashSha256) blockers.push('C23_INTEGRITY_PROVIDER_AUTH_BINDING');
  if (invocation.promptTemplateHashSha256 !== request.promptTemplateHashSha256) blockers.push('C23_INTEGRITY_PROMPT_BINDING');
  if (invocation.deterministicDecisionState !== request.deterministicDecisionState) blockers.push('C23_SECURITY_DETERMINISTIC_STATE_BINDING');
  if (providerAuthorization.providerId !== modelProfile.providerId || providerAuthorization.modelId !== modelProfile.modelId || providerAuthorization.modelVersionRef !== modelProfile.modelVersionRef) blockers.push('C23_PROVIDER_MODEL_BINDING_MISMATCH');
  if (Date.parse(providerAuthorization.validUntil) < Date.parse(asOf) || Date.parse(groundingManifest.validUntil) < Date.parse(asOf) || Date.parse(invocation.validUntil) < Date.parse(asOf)) blockers.push('C23_WINDOW_RECORD_STALE');
  if (Date.parse(providerAuthorization.reviewedAt) > Date.parse(asOf) || Date.parse(groundingManifest.reviewedAt) > Date.parse(asOf) || Date.parse(invocation.createdAt) > Date.parse(asOf)) blockers.push('C23_WINDOW_RECORD_FUTURE');
  for (const item of groundingManifest.items) {
    if (item.caseId !== request.caseId || item.propertyRef !== request.propertyRef) blockers.push(`C23_CONTEXT_GROUNDING_ITEM:${item.itemId}`);
    if (Date.parse(item.knownAt) > Date.parse(asOf)) blockers.push(`C23_WINDOW_GROUNDING_FUTURE:${item.itemId}`);
    if (Date.parse(item.validUntil) < Date.parse(asOf)) blockers.push(`C23_WINDOW_GROUNDING_STALE:${item.itemId}`);
    if (!modelProfile.allowedDataClasses.includes(item.dataClass)) blockers.push(`C23_SECURITY_DATA_CLASS_NOT_ALLOWED:${item.itemId}`);
    if (item.dataClass === DATA_CLASS.PERSONAL_DATA) blockers.push(`C23_PRIVACY_PERSONAL_DATA_EXTERNAL_TRANSFER_NOT_AUTHORIZED:${item.itemId}`);
  }
  if (providerAuthorization.environment !== ENVIRONMENT.ISOLATED_NON_PRODUCTION) blockers.push('C23_PROVIDER_ENVIRONMENT_NOT_ALLOWED');
  if (providerAuthorization.trainingUseCustomerData !== false) blockers.push('C23_SECURITY_CUSTOMER_DATA_TRAINING');
  if (providerAuthorization.productionDeploymentAuthorized !== false || providerAuthorization.publicAiAuthorized !== false || providerAuthorization.transactionAuthorized !== false || providerAuthorization.approvalAuthorized !== false) blockers.push('C23_SECURITY_AUTHORITY_INJECTION');
  return blockers;
}

function classify(blockers) {
  if (blockers.some((b) => b.startsWith('C23_INTEGRITY_'))) return STATUS.HOLD_INTEGRITY;
  if (blockers.some((b) => b.startsWith('C23_CONTEXT_'))) return STATUS.HOLD_CONTEXT;
  if (blockers.some((b) => b.startsWith('C23_WINDOW_'))) return STATUS.HOLD_WINDOW;
  if (blockers.some((b) => b.startsWith('C23_PRIVACY_'))) return STATUS.HOLD_SECURITY;
  if (blockers.some((b) => b.startsWith('C23_SECURITY_'))) return STATUS.HOLD_SECURITY;
  if (blockers.some((b) => b.startsWith('C23_PROVIDER_'))) return STATUS.HOLD_PROVIDER;
  if (blockers.some((b) => b.startsWith('C23_UNSUPPORTED_'))) return STATUS.HOLD_UNSUPPORTED_OUTPUT;
  return STATUS.HOLD_EVIDENCE;
}

function evaluateProviderReadiness(input = {}) {
  const asOf = iso(input.asOf, 'asOf');
  const blockers = baseBlockers({ ...input, asOf });
  if (input.providerAuthorization && input.providerAuthorization.networkInvocationAuthorized !== true) blockers.push('C23_PROVIDER_NETWORK_INVOCATION_NOT_AUTHORIZED');
  const unique = [...new Set(blockers)].sort();
  return freeze({
    capability: CAPABILITY,
    policyVersion: POLICY_VERSION,
    status: unique.length ? classify(unique) : STATUS.READY_FOR_PROVIDER_INVOCATION,
    providerInvocationReady: unique.length === 0,
    blockers: unique,
    asOf,
    productionDeploymentAuthorized: false,
    publicAiAuthorized: false,
    transactionAuthorized: false,
    approvalAuthorized: false,
    commercialGoLive: 'HOLD',
  });
}

function validateGroundedProviderResponse(input = {}) {
  const asOf = iso(input.asOf, 'asOf');
  const blockers = baseBlockers({ ...input, asOf });
  const response = input.providerResponse;
  if (!verifyProviderResponseEnvelope(response)) blockers.push('C23_INTEGRITY_PROVIDER_RESPONSE');
  if (!blockers.some((b) => b.startsWith('C23_INTEGRITY_')) && response) {
    const { providerAuthorization, invocation, request, groundingManifest } = input;
    if (response.invocationHashSha256 !== invocation.invocationHashSha256) blockers.push('C23_INTEGRITY_RESPONSE_INVOCATION_BINDING');
    if (response.providerId !== providerAuthorization.providerId || response.modelId !== providerAuthorization.modelId || response.modelVersionRef !== providerAuthorization.modelVersionRef) blockers.push('C23_PROVIDER_RESPONSE_MODEL_MISMATCH');
    if (response.echoDeterministicDecisionState !== request.deterministicDecisionState) blockers.push('C23_SECURITY_DETERMINISTIC_GATE_OVERRIDE');
    if (Date.parse(response.generatedAt) > Date.parse(asOf)) blockers.push('C23_WINDOW_RESPONSE_FUTURE');
    const itemById = new Map(groundingManifest.items.map((i) => [i.itemId, i]));
    for (const claim of response.claims) {
      const boundValues = new Set();
      for (const itemId of claim.groundingItemIds) {
        const item = itemById.get(itemId);
        if (!item) blockers.push(`C23_UNSUPPORTED_GROUNDING_ITEM:${claim.claimId}:${itemId}`);
        else boundValues.add(item.canonicalValue);
      }
      const declared = new Set(claim.assertedLiterals.map(canonicalLiteral));
      const extracted = extractAssertedLiterals(claim.text);
      for (const literal of extracted) if (!declared.has(literal)) blockers.push(`C23_UNSUPPORTED_UNDECLARED_LITERAL:${claim.claimId}:${literal}`);
      for (const literal of declared) if (!boundValues.has(literal)) blockers.push(`C23_UNSUPPORTED_LITERAL_NOT_GROUNDED:${claim.claimId}:${literal}`);
    }
  }
  const unique = [...new Set(blockers)].sort();
  const ready = unique.length === 0;
  return freeze({
    capability: CAPABILITY,
    policyVersion: POLICY_VERSION,
    status: ready ? STATUS.READY_FOR_HUMAN_GROUNDED_DRAFT_REVIEW : classify(unique),
    groundedDraftReviewReady: ready,
    blockers: unique,
    asOf,
    draft: ready ? response.claims.map((c) => c.text).join('\n') : null,
    claims: ready ? response.claims : null,
    deterministicDecisionState: ready ? response.echoDeterministicDecisionState : null,
    productionDeploymentAuthorized: false,
    publicAiAuthorized: false,
    transactionAuthorized: false,
    approvalAuthorized: false,
    autonomousActionExecuted: false,
    deterministicGateOverrideAllowed: false,
    commercialGoLive: 'HOLD',
  });
}

async function executeGovernedProviderGateway(input = {}) {
  const readiness = evaluateProviderReadiness(input);
  if (!readiness.providerInvocationReady) return freeze({ ...readiness, providerCalled: false, providerResponse: null });
  const adapter = input.adapter;
  if (!adapter || typeof adapter.invoke !== 'function') return freeze({ ...readiness, status: STATUS.HOLD_PROVIDER, providerInvocationReady: false, blockers: ['C23_PROVIDER_ADAPTER_REQUIRED'], providerCalled: false, providerResponse: null });
  try {
    const raw = await adapter.invoke(freeze({ invocation: input.invocation, request: input.request, groundingManifest: input.groundingManifest, modelProfile: input.modelProfile }));
    if (!raw || raw.providerResult !== PROVIDER_RESULT.SUCCESS) {
      const code = raw && Object.values(PROVIDER_RESULT).includes(raw.providerResult) ? raw.providerResult : PROVIDER_RESULT.SCHEMA_ERROR;
      return freeze({ ...readiness, status: STATUS.HOLD_PROVIDER, providerInvocationReady: false, blockers: [`C23_PROVIDER_${code}`], providerCalled: true, providerResponse: null });
    }
    return freeze({ ...readiness, providerCalled: true, providerResponse: raw });
  } catch (_) {
    return freeze({ ...readiness, status: STATUS.HOLD_PROVIDER, providerInvocationReady: false, blockers: ['C23_PROVIDER_NETWORK_ERROR'], providerCalled: true, providerResponse: null });
  }
}

module.exports = Object.freeze({
  CAPABILITY, POLICY_VERSION, STATUS, ENVIRONMENT, GROUNDING_KIND, PROVIDER_RESULT,
  canonicalLiteral, extractAssertedLiterals,
  createGroundingManifest, verifyGroundingManifest,
  createProviderAuthorization, verifyProviderAuthorization,
  createProviderInvocationEnvelope, verifyProviderInvocationEnvelope,
  createProviderResponseEnvelope, verifyProviderResponseEnvelope,
  evaluateProviderReadiness, validateGroundedProviderResponse, executeGovernedProviderGateway,
});
