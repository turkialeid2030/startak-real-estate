'use strict';

const crypto = require('crypto');
const {isPlainJson}=require('../validation/plain-json-boundary');
const {strictCalendarDateMs}=require('../validation/strict-calendar-instant');
const {normalizeNumericText}=require('../validation/numeric-text');
const {
  verifyProfileIntegrity,
  verifyRequestIntegrity,
  createGovernedModelProfile,
  createGovernedAiRequest,
  DATA_CLASS,
  DEPLOYMENT_MODE,
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
const MAX_PROVIDER_TIMEOUT_MS = 30_000;
const MIN_PROVIDER_TIMEOUT_MS = 10;
const PROVIDER_DEADLINE = Symbol('provider-deadline');
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const clean = (v) => nonEmpty(v) ? v.trim() : '';

function iso(value, field) {
  if (!nonEmpty(value) || !Number.isFinite(strictCalendarDateMs(value))) throw new TypeError(`${field} must be a valid date/time`);
  return new Date(value).toISOString();
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
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
  if (!record || typeof record !== 'object' || Array.isArray(record)||!isPlainJson(record)) return false;
  const h = clean(record[hashField]).toLowerCase();
  try{return HASH_RE.test(h) && sha256(without(record, [hashField])) === h;}
  catch{return false;}
}
function canonicalRecord(record, field, constructor, additionalCheck=()=>true){
  try{return integrity(record,field)&&additionalCheck(record)&&constructor(record)[field]===record[field];}
  catch{return false;}
}

const ARABIC_DIGITS = Object.freeze({ '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9','۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9' });
function normalizeDigits(text) { return String(text).replace(/[٠-٩۰-۹]/g, (d) => ARABIC_DIGITS[d]); }
function canonicalLiteral(value) {
  if(typeof value!=='string'&&typeof value!=='number')throw new TypeError('C23_GROUNDING_CANONICAL_VALUE_REQUIRED');
  const v=normalizeDigits(String(value)).trim().replace(/[−﹣－]/g,'-').replace(/٪/g,'%');
  if(!v)throw new TypeError('C23_GROUNDING_CANONICAL_VALUE_REQUIRED');
  // An ISO calendar date is a distinct literal, not a signed number.
  if(/^\d{4}-\d{2}-\d{2}$/.test(v)){
    const ms=Date.parse(v+'T00:00:00Z');
    if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==v)throw new TypeError('C23_DATE_LITERAL_INVALID');
    return v;
  }
  // Keep numeric normalization lexical: Number conversion could merge distinct
  // high-precision source literals. Reject malformed numeric-only strings.
  if(/^[+\-0-9,.٬٫%\s]+$/.test(v)&&/\d/.test(v)){
    const percent=v.endsWith('%');
    const raw=(percent?v.slice(0,-1):v).trim().replace(/^\+/,'');
    const parsed=normalizeNumericText(raw);
    if(!parsed.ok)throw new TypeError('C23_NUMERIC_LITERAL_AMBIGUOUS');
    return parsed.normalized+(percent?'%':'');
  }
  return v;
}
function extractAssertedLiterals(text) {
  const normalized=normalizeDigits(String(text)).replace(/[−﹣－]/g,'-').replace(/٪/g,'%');
  const found=new Set();
  const dates=normalized.match(/\b\d{4}-\d{2}-\d{2}\b/g)||[];
  dates.forEach(d=>found.add(canonicalLiteral(d)));
  const scrubbed=normalized.replace(/\b\d{4}-\d{2}-\d{2}\b/g,' ');
  // Do not split malformed grouping, decimal marks, or exponent notation into
  // individually grounded numbers. Ordinary trailing sentence punctuation is
  // excluded; spaced digit groups are ambiguous in this restricted contract.
  if(/\d[ \t\u00a0\u202f]+\d/.test(scrubbed)||/\d[eE][+-]?\d/.test(scrubbed))
    throw new TypeError('C23_NUMERIC_LITERAL_AMBIGUOUS');
  const numbers=scrubbed.match(/[+-]?(?:\d(?:[\d,.٬٫]*\d)?|[.٫]\d+)(?:[ \t\u00a0\u202f]*%)?/g)||[];
  numbers.forEach(n=>found.add(canonicalLiteral(n)));
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
function verifyGroundingManifest(r) { return canonicalRecord(r,'manifestHashSha256',createGroundingManifest,v=>Array.isArray(v.items)&&v.items.every(i=>integrity(i,'recordHashSha256'))); }

function createProviderAuthorization(x = {}) {
  const required = [
    'authorizationId','providerId','modelId','modelVersionRef','securityReviewEvidenceRef','privacyDlpReviewEvidenceRef',
    'contractualApprovalEvidenceRef','dataResidencyRef','retentionPolicyRef','noTrainingEvidenceRef','promptRegistryRef',
    'roleAuthorizationRef','environmentAuthorizationRef','killSwitchRef','reviewedByRef',
  ];
  required.forEach((f) => { if (!nonEmpty(x[f])) throw new TypeError(`${f} must be a non-empty string`); });
  if (x.environment !== ENVIRONMENT.ISOLATED_NON_PRODUCTION) throw new TypeError('C23_PROVIDER_ENVIRONMENT_NOT_ALLOWED');
  const evidenceHashesSha256 = uniqueStrings((x.evidenceHashesSha256 || []).map(h=>requireHash(h,'authorization evidence hash')), 'evidenceHashesSha256');
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
function verifyProviderAuthorization(r) { return canonicalRecord(r,'authorizationHashSha256',createProviderAuthorization); }

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
function verifyProviderInvocationEnvelope(r) { return canonicalRecord(r,'invocationHashSha256',createProviderInvocationEnvelope); }

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
  if (['overrideDeterministicGateRequested','followedUntrustedInstructions','autonomousActionExecuted'].some(k=>x[k]!==false)) throw new TypeError('C23_PROVIDER_UNSAFE_RESPONSE_FLAGS');
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
function verifyProviderResponseEnvelope(r) {
  // A caller can recompute an ordinary hash; verify the canonical schema and
  // non-authority flags as well as integrity before accepting the envelope.
  try {
    return integrity(r, 'responseHashSha256') &&
      createProviderResponseEnvelope(r).responseHashSha256 === r.responseHashSha256;
  } catch (_) { return false; }
}

function baseBlockers({ modelProfile, request, groundingManifest, providerAuthorization, invocation, asOf }) {
  const blockers = [];
  if (!canonicalRecord(modelProfile,'modelProfileHashSha256',createGovernedModelProfile,verifyProfileIntegrity)) blockers.push('C23_INTEGRITY_MODEL_PROFILE');
  if (!canonicalRecord(request,'requestHashSha256',createGovernedAiRequest,verifyRequestIntegrity)) blockers.push('C23_INTEGRITY_C22_REQUEST');
  if (!verifyGroundingManifest(groundingManifest)) blockers.push('C23_INTEGRITY_GROUNDING_MANIFEST');
  if (!verifyProviderAuthorization(providerAuthorization)) blockers.push('C23_INTEGRITY_PROVIDER_AUTHORIZATION');
  if (!verifyProviderInvocationEnvelope(invocation)) blockers.push('C23_INTEGRITY_INVOCATION');
  if (blockers.length) return blockers;

  if (request.caseId !== groundingManifest.caseId || request.propertyRef !== groundingManifest.propertyRef || request.caseId !== invocation.caseId || request.propertyRef !== invocation.propertyRef) blockers.push('C23_CONTEXT_CASE_PROPERTY_MISMATCH');
  if (groundingManifest.requestHashSha256 !== request.requestHashSha256 || invocation.requestHashSha256 !== request.requestHashSha256) blockers.push('C23_INTEGRITY_REQUEST_BINDING');
  if (invocation.modelProfileHashSha256 !== modelProfile.modelProfileHashSha256 || request.modelProfileHashSha256 !== modelProfile.modelProfileHashSha256) blockers.push('C23_INTEGRITY_PROFILE_BINDING');
  if (invocation.groundingManifestHashSha256 !== groundingManifest.manifestHashSha256) blockers.push('C23_INTEGRITY_GROUNDING_BINDING');
  if (invocation.providerAuthorizationHashSha256 !== providerAuthorization.authorizationHashSha256) blockers.push('C23_INTEGRITY_PROVIDER_AUTH_BINDING');
  if (invocation.promptTemplateHashSha256 !== request.promptTemplateHashSha256) blockers.push('C23_INTEGRITY_PROMPT_BINDING');
  if (invocation.deterministicDecisionState !== request.deterministicDecisionState) blockers.push('C23_SECURITY_DETERMINISTIC_STATE_BINDING');
  if (providerAuthorization.providerId !== modelProfile.providerId || providerAuthorization.modelId !== modelProfile.modelId || providerAuthorization.modelVersionRef !== modelProfile.modelVersionRef) blockers.push('C23_PROVIDER_MODEL_BINDING_MISMATCH');
  if (Date.parse(providerAuthorization.validUntil) < Date.parse(asOf) || Date.parse(groundingManifest.validUntil) < Date.parse(asOf) || Date.parse(invocation.validUntil) < Date.parse(asOf)) blockers.push('C23_WINDOW_RECORD_STALE');
  if (Date.parse(providerAuthorization.reviewedAt) > Date.parse(asOf) || Date.parse(groundingManifest.reviewedAt) > Date.parse(asOf) || Date.parse(invocation.createdAt) > Date.parse(asOf)) blockers.push('C23_WINDOW_RECORD_FUTURE');
  // Direct gateway callers must meet the same input constraints as the C22
  // review layer. Validate all retrieval records, including unused sources.
  if (!Array.isArray(modelProfile.allowedTaskClasses) || !Array.isArray(modelProfile.allowedDataClasses) ||
      !Array.isArray(request.retrievalItems) || !Array.isArray(request.deterministicOutputHashesSha256)) {
    blockers.push('C23_INTEGRITY_REQUEST_PROFILE_SCHEMA');
    return blockers;
  }
  if (modelProfile.deploymentMode===DEPLOYMENT_MODE.SIMULATION_ONLY) blockers.push('C23_SECURITY_SIMULATION_ONLY_PROFILE');
  if (!modelProfile.allowedTaskClasses.includes(request.taskClass)) blockers.push('C23_SECURITY_TASK_CLASS_NOT_ALLOWED');
  const at = Date.parse(asOf);
  if(at>Date.now())blockers.push('C23_WINDOW_AS_OF_FUTURE');
  const invocationStart=Date.parse(invocation.createdAt);
  if([modelProfile.reviewedAt,request.createdAt,groundingManifest.reviewedAt,providerAuthorization.reviewedAt].some(v=>Date.parse(v)>invocationStart))blockers.push('C23_WINDOW_INVOCATION_PREDATES_PREREQUISITES');
  if(Date.parse(modelProfile.reviewedAt)>Date.parse(request.createdAt)||Date.parse(request.createdAt)>Date.parse(groundingManifest.reviewedAt))blockers.push('C23_WINDOW_REVIEW_SEQUENCE_INVALID');
  const startTimes = [modelProfile.reviewedAt,request.createdAt];
  const endTimes = [modelProfile.validUntil,request.validUntil];
  if (startTimes.some(value=>!Number.isFinite(Date.parse(value)) || Date.parse(value)>at))
    blockers.push('C23_WINDOW_PROFILE_REQUEST_FUTURE_OR_INVALID');
  if (endTimes.some(value=>!Number.isFinite(Date.parse(value)) || Date.parse(value)<at))
    blockers.push('C23_WINDOW_PROFILE_REQUEST_STALE_OR_INVALID');
  const retrievalByHash=new Map();
  for(const item of request.retrievalItems){
    if(!item || typeof item !== 'object' || !HASH_RE.test(item.evidenceHashSha256 || '')){
      blockers.push('C23_INTEGRITY_RETRIEVAL_SCHEMA');continue;
    }
    const digest=item.evidenceHashSha256.toLowerCase();
    if(retrievalByHash.has(digest))blockers.push('C23_INTEGRITY_RETRIEVAL_DIGEST_AMBIGUOUS');
    else retrievalByHash.set(digest,item);
    if(!modelProfile.allowedDataClasses.includes(item.dataClass)) blockers.push('C23_SECURITY_RETRIEVAL_DATA_CLASS_NOT_ALLOWED:'+item.evidenceId);
    if(!Number.isFinite(Date.parse(item.knownAt)) || Date.parse(item.knownAt)>at)
      blockers.push('C23_WINDOW_RETRIEVAL_FUTURE_OR_INVALID:'+item.evidenceId);
    if(!Number.isFinite(Date.parse(item.validUntil)) || Date.parse(item.validUntil)<at)
      blockers.push('C23_WINDOW_RETRIEVAL_STALE_OR_INVALID:'+item.evidenceId);
  }
  const deterministicHashes=new Set(request.deterministicOutputHashesSha256.map(h=>String(h).toLowerCase()));
  for (const item of groundingManifest.items) {
    // A matching digest alone does not bind provenance metadata. A derived
    // grounding entry may narrow its validity, but cannot extend the source
    // window, predate knowledge of that source, or relabel its classification.
    if(item.evidenceHashSha256){
      const source=retrievalByHash.get(item.evidenceHashSha256.toLowerCase());
      if(!source)blockers.push('C23_EVIDENCE_SOURCE_NOT_BOUND_TO_REQUEST:'+item.itemId);
      else{
        if(item.sourceReference!==source.sourceReference)
          blockers.push('C23_EVIDENCE_SOURCE_REFERENCE_MISMATCH:'+item.itemId);
        if(item.dataClass!==source.dataClass)
          blockers.push('C23_SECURITY_SOURCE_DATA_CLASS_MISMATCH:'+item.itemId);
        if(Date.parse(item.knownAt)<Date.parse(source.knownAt)||Date.parse(item.validUntil)>Date.parse(source.validUntil))
          blockers.push('C23_EVIDENCE_SOURCE_VALIDITY_WINDOW_MISMATCH:'+item.itemId);
      }
    }
    if(item.deterministicOutputHashSha256 && !deterministicHashes.has(item.deterministicOutputHashSha256.toLowerCase()))
      blockers.push('C23_EVIDENCE_DETERMINISTIC_SOURCE_NOT_BOUND_TO_REQUEST:'+item.itemId);
    if (item.caseId !== request.caseId || item.propertyRef !== request.propertyRef) blockers.push(`C23_CONTEXT_GROUNDING_ITEM:${item.itemId}`);
    if(Date.parse(item.knownAt)>Date.parse(groundingManifest.reviewedAt))blockers.push('C23_WINDOW_GROUNDING_POSTDATES_REVIEW:'+item.itemId);
    if (Date.parse(item.knownAt) > Date.parse(asOf)) blockers.push(`C23_WINDOW_GROUNDING_FUTURE:${item.itemId}`);
    if (Date.parse(item.validUntil) < Date.parse(asOf)) blockers.push(`C23_WINDOW_GROUNDING_STALE:${item.itemId}`);
    if (!modelProfile.allowedDataClasses.includes(item.dataClass)) blockers.push(`C23_SECURITY_DATA_CLASS_NOT_ALLOWED:${item.itemId}`);
  }
  // C48: do not mistake an internally signed no-training packet for lawful
  // authorization to transfer personal/deed/tenant evidence to an external
  // AI model. Check the complete C22 retrieval envelope, not merely selected
  // grounding items, so ungrounded personal source material also fails closed.
  if (request.retrievalItems.some(item => item?.dataClass === DATA_CLASS.PERSONAL_DATA)
      || groundingManifest.items.some(item => item.dataClass === DATA_CLASS.PERSONAL_DATA)) {
    blockers.push('C23_PRIVACY_PERSONAL_DATA_EXTERNAL_TRANSFER_NOT_AUTHORIZED');
  }
  if (providerAuthorization.networkInvocationAuthorized !== true) blockers.push('C23_PROVIDER_NETWORK_INVOCATION_NOT_AUTHORIZED');
  if (providerAuthorization.environment !== ENVIRONMENT.ISOLATED_NON_PRODUCTION) blockers.push('C23_PROVIDER_ENVIRONMENT_NOT_ALLOWED');
  if (providerAuthorization.trainingUseCustomerData !== false) blockers.push('C23_SECURITY_CUSTOMER_DATA_TRAINING');
  if (providerAuthorization.productionDeploymentAuthorized !== false || providerAuthorization.publicAiAuthorized !== false || providerAuthorization.transactionAuthorized !== false || providerAuthorization.approvalAuthorized !== false) blockers.push('C23_SECURITY_AUTHORITY_INJECTION');
  return blockers;
}

function classify(blockers) {
  if (blockers.some((b) => b.startsWith('C23_INTEGRITY_'))) return STATUS.HOLD_INTEGRITY;
  if (blockers.some((b) => b.startsWith('C23_CONTEXT_'))) return STATUS.HOLD_CONTEXT;
  if (blockers.some((b) => b.startsWith('C23_WINDOW_'))) return STATUS.HOLD_WINDOW;
  if (blockers.some((b) => b.startsWith('C23_SECURITY_') || b.startsWith('C23_PRIVACY_'))) return STATUS.HOLD_SECURITY;
  if (blockers.some((b) => b.startsWith('C23_PROVIDER_'))) return STATUS.HOLD_PROVIDER;
  if (blockers.some((b) => b.startsWith('C23_UNSUPPORTED_'))) return STATUS.HOLD_UNSUPPORTED_OUTPUT;
  return STATUS.HOLD_EVIDENCE;
}

function evaluateProviderReadiness(input = {}) {
  const asOf = iso(input.asOf, 'asOf');
  const blockers = baseBlockers({ ...input, asOf });
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
    if (Date.parse(response.generatedAt) < Date.parse(invocation.createdAt)) blockers.push('C23_WINDOW_RESPONSE_PREDATES_INVOCATION');
    const itemById = new Map(groundingManifest.items.map((i) => [i.itemId, i]));
    for (const claim of response.claims) {
      const boundValues = new Set();
      for (const itemId of claim.groundingItemIds) {
        const item = itemById.get(itemId);
        if (!item) blockers.push(`C23_UNSUPPORTED_GROUNDING_ITEM:${claim.claimId}:${itemId}`);
        else boundValues.add(item.canonicalValue);
      }
      const declared = new Set(claim.assertedLiterals.map(canonicalLiteral));
      let extracted;
      try{extracted=extractAssertedLiterals(claim.text);}
      catch{blockers.push(`C23_UNSUPPORTED_AMBIGUOUS_NUMERIC_LITERAL:${claim.claimId}`);continue;}
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
  // Capture the exact validated packet once. Neither the caller nor the
  // asynchronous adapter may replace records between readiness and review.
  let packet;
  try {
    const recordKeys=['modelProfile','request','groundingManifest','providerAuthorization','invocation'];
    const data=(key)=>{const descriptor=Object.getOwnPropertyDescriptor(input,key);return descriptor&&Object.hasOwn(descriptor,'value')?descriptor.value:null;};
    const captured=Object.fromEntries(recordKeys.map(key=>{const value=data(key);return [key,isPlainJson(value)?structuredClone(value):null];}));
    packet=freeze({...captured,asOf:data('asOf')});
  } catch {
    return freeze({capability:CAPABILITY,policyVersion:POLICY_VERSION,status:STATUS.HOLD_INTEGRITY,providerInvocationReady:false,groundedDraftReviewReady:false,blockers:['C23_INTEGRITY_INPUT_SNAPSHOT'],asOf:null,providerCalled:false,providerResponse:null,draft:null,claims:null,productionDeploymentAuthorized:false,publicAiAuthorized:false,transactionAuthorized:false,approvalAuthorized:false,commercialGoLive:'HOLD'});
  }
  let readiness;
  try{readiness=evaluateProviderReadiness(packet);}catch{return freeze({capability:CAPABILITY,policyVersion:POLICY_VERSION,status:STATUS.HOLD_INTEGRITY,providerInvocationReady:false,groundedDraftReviewReady:false,blockers:['C23_INTEGRITY_INVALID_EVALUATION_TIME'],providerCalled:false,providerResponse:null,draft:null,claims:null,productionDeploymentAuthorized:false,publicAiAuthorized:false,transactionAuthorized:false,approvalAuthorized:false,commercialGoLive:'HOLD'});}
  if (!readiness.providerInvocationReady) return freeze({ ...readiness, providerCalled: false, providerResponse: null });
  const adapterDescriptor=Object.getOwnPropertyDescriptor(input,'adapter');
  const adapter=adapterDescriptor&&Object.hasOwn(adapterDescriptor,'value')?adapterDescriptor.value:null;
  const invokeDescriptor=adapter&&typeof adapter==='object'?Object.getOwnPropertyDescriptor(adapter,'invoke'):null;
  const invoke=invokeDescriptor&&Object.hasOwn(invokeDescriptor,'value')?invokeDescriptor.value:null;
  if (typeof invoke !== 'function') return freeze({ ...readiness, status: STATUS.HOLD_PROVIDER, providerInvocationReady: false, blockers: ['C23_PROVIDER_ADAPTER_REQUIRED'], providerCalled: false, providerResponse: null });
  // Adapter configuration is trusted server configuration, not proof content.
  // A shorter timeout may be configured; it cannot extend the hard ceiling.
  const timeoutDescriptor=Object.getOwnPropertyDescriptor(adapter,'timeoutMs');
  const timeoutMs=timeoutDescriptor&&Object.hasOwn(timeoutDescriptor,'value')?timeoutDescriptor.value:MAX_PROVIDER_TIMEOUT_MS;
  if ((timeoutDescriptor&&!Object.hasOwn(timeoutDescriptor,'value'))||!Number.isInteger(timeoutMs)||timeoutMs<MIN_PROVIDER_TIMEOUT_MS||timeoutMs>MAX_PROVIDER_TIMEOUT_MS)
    return freeze({...readiness,status:STATUS.HOLD_PROVIDER,providerInvocationReady:false,groundedDraftReviewReady:false,blockers:['C23_PROVIDER_TIMEOUT_CONFIG_INVALID'],providerCalled:false,providerResponse:null,draft:null,claims:null});
  const controller=new AbortController();
  let timer;
  try {
    const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{reject(PROVIDER_DEADLINE);controller.abort();},timeoutMs);});
    const raw=await Promise.race([Promise.resolve().then(()=>invoke.call(adapter,freeze({ invocation: packet.invocation, request: packet.request, groundingManifest: packet.groundingManifest, modelProfile: packet.modelProfile }),{signal:controller.signal})),deadline]);
    if(!isPlainJson(raw))return freeze({...readiness,status:STATUS.HOLD_PROVIDER,providerInvocationReady:false,blockers:['C23_PROVIDER_SCHEMA_ERROR'],providerCalled:true,providerResponse:null});
    if (!raw || raw.providerResult !== PROVIDER_RESULT.SUCCESS) {
      const code = raw && Object.values(PROVIDER_RESULT).includes(raw.providerResult) ? raw.providerResult : PROVIDER_RESULT.SCHEMA_ERROR;
      return freeze({ ...readiness, status: STATUS.HOLD_PROVIDER, providerInvocationReady: false, blockers: [`C23_PROVIDER_${code}`], providerCalled: true, providerResponse: null });
    }
    // SUCCESS is only the transport outcome, not grounded-output acceptance.
    // Detach and canonicalize the response before exposing any model content.
    let snapshot;
    try { snapshot = structuredClone(raw); }
    catch (_) { return freeze({ ...readiness, status: STATUS.HOLD_PROVIDER, providerInvocationReady: false, blockers: ['C23_PROVIDER_SCHEMA_ERROR'], providerCalled: true, providerResponse: null }); }
    const checked = validateGroundedProviderResponse({ ...packet, providerResponse: snapshot });
    if (!checked.groundedDraftReviewReady) {
      return freeze({ ...readiness, ...checked, providerInvocationReady: false, providerCalled: true, providerResponse: null });
    }
    const canonical = createProviderResponseEnvelope(snapshot);
    return freeze({ ...readiness, ...checked, providerCalled: true, providerResponse: canonical });
  } catch (error) {
    return freeze({ ...readiness, status: STATUS.HOLD_PROVIDER, providerInvocationReady: false, groundedDraftReviewReady:false, blockers: [error===PROVIDER_DEADLINE?'C23_PROVIDER_TIMEOUT':'C23_PROVIDER_NETWORK_ERROR'], providerCalled: true, providerResponse: null,draft:null,claims:null });
  } finally { clearTimeout(timer); }
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
