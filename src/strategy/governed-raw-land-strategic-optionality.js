'use strict';

const crypto = require('crypto');

const CAPABILITY = 'C17_GOVERNED_RAW_LAND_STRATEGIC_OPTIONALITY_V1';
const POLICY_VERSION = 'C17_RAW_LAND_STRATEGY_REVIEW_POLICY_V1';

const RAW_LAND_REVIEW_STATUS = Object.freeze({
  READY_FOR_PROFESSIONAL_STRATEGY_REVIEW: 'READY_FOR_PROFESSIONAL_STRATEGY_REVIEW',
  HOLD_EVIDENCE: 'HOLD_EVIDENCE',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
  HOLD_POLICY: 'HOLD_POLICY',
  HOLD_CONTEXT: 'HOLD_CONTEXT',
  HOLD_WINDOW: 'HOLD_WINDOW',
});

const RAW_LAND_OPTION_TYPE = Object.freeze({
  HOLD_AS_IS: 'HOLD_AS_IS',
  PREPARE_FOR_SALE: 'PREPARE_FOR_SALE',
  SEEK_PLANNING_OR_ZONING_CLARIFICATION: 'SEEK_PLANNING_OR_ZONING_CLARIFICATION',
  ENABLE_SERVICES_OR_INFRASTRUCTURE_EVIDENCE: 'ENABLE_SERVICES_OR_INFRASTRUCTURE_EVIDENCE',
  PREPARE_SUBDIVISION_OR_MERGE_REVIEW: 'PREPARE_SUBDIVISION_OR_MERGE_REVIEW',
  PREPARE_DEVELOPMENT_CONCEPT_REVIEW: 'PREPARE_DEVELOPMENT_CONCEPT_REVIEW',
});

const RAW_LAND_EVIDENCE_CLASS = Object.freeze({
  TITLE_AND_PARCEL_IDENTITY: 'TITLE_AND_PARCEL_IDENTITY',
  SURVEY_AND_AREA: 'SURVEY_AND_AREA',
  URBAN_CODE_AND_PLOT_FEASIBILITY: 'URBAN_CODE_AND_PLOT_FEASIBILITY',
  MARKET_AND_LIQUIDITY: 'MARKET_AND_LIQUIDITY',
  REGULATORY_CARRY_COST: 'REGULATORY_CARRY_COST',
  ACCESS_AND_SERVICES: 'ACCESS_AND_SERVICES',
  EXTERNAL_STRATEGY_INSTRUCTION: 'EXTERNAL_STRATEGY_INSTRUCTION',
});

const EVIDENCE_STATE = Object.freeze({
  SATISFIED: 'SATISFIED',
  UNRESOLVED: 'UNRESOLVED',
  NOT_REQUIRED: 'NOT_REQUIRED',
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
  if (out.some((v) => !v)) throw new TypeError(`${field} contains an invalid value`);
  if (new Set(out).size !== out.length) throw new TypeError(`${field} contains duplicate values`);
  return [...out].sort();
}
function exactSet(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((v, i) => v === right[i]);
}
function blockerStatus(blockers) {
  if (blockers.some((b) => b.startsWith('C17_INTEGRITY_') || b.startsWith('C17_AUTHORITY_INJECTION'))) return RAW_LAND_REVIEW_STATUS.HOLD_INTEGRITY;
  if (blockers.some((b) => b.startsWith('C17_POLICY_'))) return RAW_LAND_REVIEW_STATUS.HOLD_POLICY;
  if (blockers.some((b) => b.startsWith('C17_CONTEXT_'))) return RAW_LAND_REVIEW_STATUS.HOLD_CONTEXT;
  if (blockers.some((b) => b.startsWith('C17_WINDOW_'))) return RAW_LAND_REVIEW_STATUS.HOLD_WINDOW;
  return RAW_LAND_REVIEW_STATUS.HOLD_EVIDENCE;
}

function computeRawLandEvidenceReferenceHash(r) {
  return r && typeof r === 'object' && !Array.isArray(r) ? sha256(without(r, ['evidenceReferenceHashSha256'])) : null;
}
function verifyRawLandEvidenceReferenceIntegrity(r) {
  return !!r && HASH_RE.test(clean(r.evidenceReferenceHashSha256)) && computeRawLandEvidenceReferenceHash(r) === clean(r.evidenceReferenceHashSha256).toLowerCase();
}
function createGovernedRawLandEvidenceReference(x = {}) {
  ['evidenceReferenceId','caseId','propertyRef','sourceCapability','sourceRecordId','sourceStatus','sourceReference','reviewedByRef','reviewEvidenceRef'].forEach((f) => {
    if (!nonEmpty(x[f])) throw new TypeError(`${f} must be a non-empty string`);
  });
  if (!Object.values(RAW_LAND_EVIDENCE_CLASS).includes(x.evidenceClass)) throw new TypeError('C17_EVIDENCE_CLASS_UNSUPPORTED');
  if (!Object.values(EVIDENCE_STATE).includes(x.evidenceState)) throw new TypeError('C17_EVIDENCE_STATE_UNSUPPORTED');
  if (!HASH_RE.test(clean(x.sourceRecordHashSha256))) throw new TypeError('C17_SOURCE_RECORD_HASH_REQUIRED');
  if (x.evidenceState === EVIDENCE_STATE.UNRESOLVED && !nonEmpty(x.unresolvedReasonRef)) throw new TypeError('C17_UNRESOLVED_REASON_REQUIRED');
  if (x.evidenceState === EVIDENCE_STATE.NOT_REQUIRED && !nonEmpty(x.notRequiredRationaleRef)) throw new TypeError('C17_NOT_REQUIRED_RATIONALE_REQUIRED');
  const reviewedAt = iso(x.reviewedAt, 'reviewedAt');
  const validUntil = iso(x.validUntil, 'validUntil');
  if (Date.parse(validUntil) < Date.parse(reviewedAt)) throw new TypeError('C17_EVIDENCE_VALIDITY_INVALID');
  const core = {
    schemaVersion: 1,
    evidenceReferenceId: x.evidenceReferenceId.trim(),
    caseId: x.caseId.trim(),
    propertyRef: x.propertyRef.trim(),
    evidenceClass: x.evidenceClass,
    evidenceState: x.evidenceState,
    sourceCapability: x.sourceCapability.trim(),
    sourceRecordId: x.sourceRecordId.trim(),
    sourceRecordHashSha256: x.sourceRecordHashSha256.trim().toLowerCase(),
    sourceStatus: x.sourceStatus.trim(),
    sourceReference: x.sourceReference.trim(),
    reviewedByRef: x.reviewedByRef.trim(),
    reviewEvidenceRef: x.reviewEvidenceRef.trim(),
    reviewedAt,
    validUntil,
    unresolvedReasonRef: x.evidenceState === EVIDENCE_STATE.UNRESOLVED ? x.unresolvedReasonRef.trim() : null,
    notRequiredRationaleRef: x.evidenceState === EVIDENCE_STATE.NOT_REQUIRED ? x.notRequiredRationaleRef.trim() : null,
    availabilityInferredBySoftware: false,
    regulatoryConclusionBySoftware: false,
    valuationPerformedBySoftware: false,
  };
  return freeze({ ...core, evidenceReferenceHashSha256: sha256(core) });
}

function computeRawLandOptionHash(r) {
  return r && typeof r === 'object' && !Array.isArray(r) ? sha256(without(r, ['optionHashSha256'])) : null;
}
function verifyRawLandOptionIntegrity(r) {
  return !!r && HASH_RE.test(clean(r.optionHashSha256)) && computeRawLandOptionHash(r) === clean(r.optionHashSha256).toLowerCase();
}
function createGovernedRawLandStrategicOption(x = {}) {
  ['optionId','caseId','propertyRef','rationaleRef','authoredByRef','reviewedByRef','reviewEvidenceRef'].forEach((f) => {
    if (!nonEmpty(x[f])) throw new TypeError(`${f} must be a non-empty string`);
  });
  if (!Object.values(RAW_LAND_OPTION_TYPE).includes(x.optionType)) throw new TypeError('C17_OPTION_TYPE_UNSUPPORTED');
  const evidenceReferenceHashesSha256 = uniqueStrings(x.evidenceReferenceHashesSha256 || [], 'evidenceReferenceHashesSha256');
  if (!evidenceReferenceHashesSha256.length || evidenceReferenceHashesSha256.some((h) => !HASH_RE.test(h))) throw new TypeError('C17_OPTION_EVIDENCE_HASHES_REQUIRED');
  const reviewedAt = iso(x.reviewedAt, 'reviewedAt');
  const validUntil = iso(x.validUntil, 'validUntil');
  if (Date.parse(validUntil) < Date.parse(reviewedAt)) throw new TypeError('C17_OPTION_VALIDITY_INVALID');
  const core = {
    schemaVersion: 1,
    optionId: x.optionId.trim(),
    caseId: x.caseId.trim(),
    propertyRef: x.propertyRef.trim(),
    optionType: x.optionType,
    rationaleRef: x.rationaleRef.trim(),
    evidenceReferenceHashesSha256,
    authoredByRef: x.authoredByRef.trim(),
    reviewedByRef: x.reviewedByRef.trim(),
    reviewEvidenceRef: x.reviewEvidenceRef.trim(),
    reviewedAt,
    validUntil,
    rank: null,
    score: null,
    recommendedBySoftware: false,
    buildRecommendationBySoftware: false,
    sellRecommendationBySoftware: false,
    holdRecommendationBySoftware: false,
  };
  return freeze({ ...core, optionHashSha256: sha256(core) });
}

function normalizeRequiredClassesMap(map, allowedOptionTypes, allowedEvidenceClasses) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) throw new TypeError('requiredEvidenceClassesByOptionType must be an object');
  const keys = Object.keys(map).sort();
  if (keys.some((k) => !Object.values(RAW_LAND_OPTION_TYPE).includes(k))) throw new TypeError('C17_POLICY_REQUIRED_MAP_OPTION_UNSUPPORTED');
  for (const optionType of allowedOptionTypes) {
    if (!Object.prototype.hasOwnProperty.call(map, optionType)) throw new TypeError(`C17_POLICY_REQUIRED_MAP_MISSING:${optionType}`);
  }
  const out = {};
  for (const optionType of keys) {
    const classes = uniqueStrings(map[optionType], `requiredEvidenceClassesByOptionType.${optionType}`);
    if (!classes.length) throw new TypeError(`C17_POLICY_REQUIRED_CLASSES_EMPTY:${optionType}`);
    if (classes.some((c) => !Object.values(RAW_LAND_EVIDENCE_CLASS).includes(c))) throw new TypeError(`C17_POLICY_REQUIRED_CLASS_UNSUPPORTED:${optionType}`);
    if (classes.some((c) => !allowedEvidenceClasses.includes(c))) throw new TypeError(`C17_POLICY_REQUIRED_CLASS_NOT_ALLOWED:${optionType}`);
    out[optionType] = classes;
  }
  return out;
}

function computeRawLandReviewPolicyHash(r) {
  return r && typeof r === 'object' && !Array.isArray(r) ? sha256(without(r, ['policyHashSha256'])) : null;
}
function verifyRawLandReviewPolicyIntegrity(r) {
  return !!r && HASH_RE.test(clean(r.policyHashSha256)) && computeRawLandReviewPolicyHash(r) === clean(r.policyHashSha256).toLowerCase();
}
function createGovernedRawLandReviewPolicy(x = {}) {
  ['policyId','caseId','propertyRef','reviewedByRef','reviewEvidenceRef'].forEach((f) => {
    if (!nonEmpty(x[f])) throw new TypeError(`${f} must be a non-empty string`);
  });
  const allowedOptionTypes = uniqueStrings(x.allowedOptionTypes || [], 'allowedOptionTypes');
  const allowedEvidenceClasses = uniqueStrings(x.allowedEvidenceClasses || [], 'allowedEvidenceClasses');
  if (!allowedOptionTypes.length || allowedOptionTypes.some((v) => !Object.values(RAW_LAND_OPTION_TYPE).includes(v))) throw new TypeError('C17_POLICY_ALLOWED_OPTIONS_INVALID');
  if (!allowedEvidenceClasses.length || allowedEvidenceClasses.some((v) => !Object.values(RAW_LAND_EVIDENCE_CLASS).includes(v))) throw new TypeError('C17_POLICY_ALLOWED_EVIDENCE_INVALID');
  const requiredEvidenceClassesByOptionType = normalizeRequiredClassesMap(x.requiredEvidenceClassesByOptionType, allowedOptionTypes, allowedEvidenceClasses);
  const evidenceReferenceHashesSha256 = uniqueStrings(x.evidenceReferenceHashesSha256 || [], 'evidenceReferenceHashesSha256');
  const optionHashesSha256 = uniqueStrings(x.optionHashesSha256 || [], 'optionHashesSha256');
  if (!evidenceReferenceHashesSha256.length || evidenceReferenceHashesSha256.some((h) => !HASH_RE.test(h))) throw new TypeError('C17_POLICY_EVIDENCE_BINDINGS_REQUIRED');
  if (!optionHashesSha256.length || optionHashesSha256.some((h) => !HASH_RE.test(h))) throw new TypeError('C17_POLICY_OPTION_BINDINGS_REQUIRED');
  const reviewedAt = iso(x.reviewedAt, 'reviewedAt');
  const validUntil = iso(x.validUntil, 'validUntil');
  if (Date.parse(validUntil) < Date.parse(reviewedAt)) throw new TypeError('C17_POLICY_VALIDITY_INVALID');
  const core = {
    version: POLICY_VERSION,
    policyId: x.policyId.trim(),
    caseId: x.caseId.trim(),
    propertyRef: x.propertyRef.trim(),
    allowedOptionTypes,
    allowedEvidenceClasses,
    requiredEvidenceClassesByOptionType,
    evidenceReferenceHashesSha256,
    optionHashesSha256,
    reviewedByRef: x.reviewedByRef.trim(),
    reviewEvidenceRef: x.reviewEvidenceRef.trim(),
    reviewedAt,
    validUntil,
    automaticRankingAuthorized: false,
    automaticRecommendationAuthorized: false,
  };
  return freeze({ ...core, policyHashSha256: sha256(core) });
}

const FORBIDDEN_TRUE_FIELDS = Object.freeze([
  'transactionAuthorized','approvalAuthorized','productionAuthorized','publicAiAuthorized','canonicalBaselineActivationAuthorized',
  'automaticStrategicRecommendation','automaticRecommendationAuthorized','automaticRankingAuthorized','recommendedBySoftware',
  'buildRecommendationBySoftware','sellRecommendationBySoftware','holdRecommendationBySoftware','zoningDeterminedBySoftware',
  'serviceAvailabilityDeterminedBySoftware','valuationCalculated','valuationPerformedBySoftware','residualLandValueCalculated',
  'npvCalculated','irrCalculated','legalConclusionBySoftware','subdivisionMergeFeasibilityDeterminedBySoftware',
]);
function authorityInjection(record) {
  return !!record && FORBIDDEN_TRUE_FIELDS.some((field) => record[field] === true);
}
function sortedById(records, field) { return [...records].sort((a, b) => clean(a[field]).localeCompare(clean(b[field]))); }

function evaluateGovernedRawLandStrategicOptionality(input = {}) {
  const evidenceReferences = Array.isArray(input.evidenceReferences) ? input.evidenceReferences : [];
  const options = Array.isArray(input.options) ? input.options : [];
  const policy = input.reviewPolicy;
  const asOf = iso(input.asOf, 'asOf');
  const blockers = [];
  const riskFlags = [];

  if (!policy || !verifyRawLandReviewPolicyIntegrity(policy)) blockers.push('C17_INTEGRITY_POLICY');
  if (policy && authorityInjection(policy)) blockers.push('C17_AUTHORITY_INJECTION:POLICY');

  const evidenceIds = new Set();
  const evidenceHashes = [];
  for (const evidence of evidenceReferences) {
    if (!verifyRawLandEvidenceReferenceIntegrity(evidence)) blockers.push(`C17_INTEGRITY_EVIDENCE:${clean(evidence && evidence.evidenceReferenceId) || 'UNKNOWN'}`);
    if (authorityInjection(evidence)) blockers.push(`C17_AUTHORITY_INJECTION:EVIDENCE:${clean(evidence && evidence.evidenceReferenceId) || 'UNKNOWN'}`);
    const id = clean(evidence && evidence.evidenceReferenceId);
    if (!id || evidenceIds.has(id)) blockers.push(`C17_INTEGRITY_DUPLICATE_EVIDENCE_ID:${id || 'UNKNOWN'}`); else evidenceIds.add(id);
    if (HASH_RE.test(clean(evidence && evidence.evidenceReferenceHashSha256))) evidenceHashes.push(clean(evidence.evidenceReferenceHashSha256).toLowerCase());
  }

  const optionIds = new Set();
  const optionHashes = [];
  for (const option of options) {
    if (!verifyRawLandOptionIntegrity(option)) blockers.push(`C17_INTEGRITY_OPTION:${clean(option && option.optionId) || 'UNKNOWN'}`);
    if (authorityInjection(option)) blockers.push(`C17_AUTHORITY_INJECTION:OPTION:${clean(option && option.optionId) || 'UNKNOWN'}`);
    const id = clean(option && option.optionId);
    if (!id || optionIds.has(id)) blockers.push(`C17_INTEGRITY_DUPLICATE_OPTION_ID:${id || 'UNKNOWN'}`); else optionIds.add(id);
    if (HASH_RE.test(clean(option && option.optionHashSha256))) optionHashes.push(clean(option.optionHashSha256).toLowerCase());
  }

  if (new Set(evidenceHashes).size !== evidenceHashes.length) blockers.push('C17_INTEGRITY_DUPLICATE_EVIDENCE_HASH');
  if (new Set(optionHashes).size !== optionHashes.length) blockers.push('C17_INTEGRITY_DUPLICATE_OPTION_HASH');

  if (policy && verifyRawLandReviewPolicyIntegrity(policy)) {
    const actualEvidenceHashes = [...evidenceHashes].sort();
    const actualOptionHashes = [...optionHashes].sort();
    if (!exactSet(policy.evidenceReferenceHashesSha256, actualEvidenceHashes)) blockers.push('C17_POLICY_EVIDENCE_BINDING_MISMATCH');
    if (!exactSet(policy.optionHashesSha256, actualOptionHashes)) blockers.push('C17_POLICY_OPTION_BINDING_MISMATCH');
    if (Date.parse(policy.reviewedAt) > Date.parse(asOf)) blockers.push('C17_POLICY_REVIEWED_IN_FUTURE');
    if (Date.parse(policy.validUntil) < Date.parse(asOf)) blockers.push('C17_POLICY_EXPIRED');

    for (const evidence of evidenceReferences) {
      if (!evidence || typeof evidence !== 'object') continue;
      if (evidence.caseId !== policy.caseId || evidence.propertyRef !== policy.propertyRef) blockers.push(`C17_CONTEXT_EVIDENCE:${clean(evidence.evidenceReferenceId) || 'UNKNOWN'}`);
      if (!policy.allowedEvidenceClasses.includes(evidence.evidenceClass)) blockers.push(`C17_POLICY_EVIDENCE_CLASS_NOT_ALLOWED:${clean(evidence.evidenceReferenceId) || 'UNKNOWN'}`);
      if (Date.parse(evidence.reviewedAt) > Date.parse(asOf)) blockers.push(`C17_WINDOW_EVIDENCE_FUTURE:${clean(evidence.evidenceReferenceId) || 'UNKNOWN'}`);
      if (Date.parse(evidence.validUntil) < Date.parse(asOf)) blockers.push(`C17_WINDOW_EVIDENCE_STALE:${clean(evidence.evidenceReferenceId) || 'UNKNOWN'}`);
    }

    const evidenceByHash = new Map(evidenceReferences.map((e) => [clean(e && e.evidenceReferenceHashSha256).toLowerCase(), e]));
    for (const option of options) {
      if (!option || typeof option !== 'object') continue;
      if (option.caseId !== policy.caseId || option.propertyRef !== policy.propertyRef) blockers.push(`C17_CONTEXT_OPTION:${clean(option.optionId) || 'UNKNOWN'}`);
      if (!policy.allowedOptionTypes.includes(option.optionType)) blockers.push(`C17_POLICY_OPTION_NOT_ALLOWED:${clean(option.optionId) || 'UNKNOWN'}`);
      if (Date.parse(option.reviewedAt) > Date.parse(asOf)) blockers.push(`C17_WINDOW_OPTION_FUTURE:${clean(option.optionId) || 'UNKNOWN'}`);
      if (Date.parse(option.validUntil) < Date.parse(asOf)) blockers.push(`C17_WINDOW_OPTION_STALE:${clean(option.optionId) || 'UNKNOWN'}`);
      const requiredClasses = policy.requiredEvidenceClassesByOptionType[option.optionType] || [];
      for (const requiredClass of requiredClasses) {
        if (!policy.allowedEvidenceClasses.includes(requiredClass)) blockers.push(`C17_POLICY_REQUIRED_CLASS_NOT_ALLOWED:${option.optionType}:${requiredClass}`);
      }
      const boundEvidence = [];
      for (const hash of option.evidenceReferenceHashesSha256 || []) {
        const evidence = evidenceByHash.get(clean(hash).toLowerCase());
        if (!evidence) blockers.push(`C17_EVIDENCE_OPTION_REFERENCE_MISSING:${clean(option.optionId) || 'UNKNOWN'}:${hash}`);
        else boundEvidence.push(evidence);
      }
      for (const evidence of boundEvidence) {
        if (evidence.evidenceState === EVIDENCE_STATE.UNRESOLVED) blockers.push(`C17_EVIDENCE_UNRESOLVED:${option.optionId}:${evidence.evidenceClass}`);
      }
      for (const requiredClass of requiredClasses) {
        const candidates = boundEvidence.filter((e) => e.evidenceClass === requiredClass);
        if (!candidates.length) blockers.push(`C17_EVIDENCE_REQUIRED_CLASS_MISSING:${option.optionId}:${requiredClass}`);
        else if (candidates.some((e) => e.evidenceState === EVIDENCE_STATE.UNRESOLVED)) blockers.push(`C17_EVIDENCE_REQUIRED_CLASS_UNRESOLVED:${option.optionId}:${requiredClass}`);
        else if (!candidates.some((e) => e.evidenceState === EVIDENCE_STATE.SATISFIED)) blockers.push(`C17_EVIDENCE_REQUIRED_CLASS_NOT_SATISFIED:${option.optionId}:${requiredClass}`);
      }
      if ((option.evidenceReferenceHashesSha256 || []).length > requiredClasses.length) riskFlags.push(`C17_OPTION_HAS_ADDITIONAL_BOUND_EVIDENCE:${option.optionId}`);
    }
  }

  const uniqueBlockers = [...new Set(blockers)].sort();
  const uniqueRiskFlags = [...new Set(riskFlags)].sort();
  const ready = uniqueBlockers.length === 0;
  const review = ready ? sortedById(options, 'optionId').map((option) => ({
    optionId: option.optionId,
    optionType: option.optionType,
    rationaleRef: option.rationaleRef,
    evidenceReferenceHashesSha256: [...option.evidenceReferenceHashesSha256],
    rank: null,
    score: null,
    recommendedBySoftware: false,
  })) : null;

  return freeze({
    capability: CAPABILITY,
    policyVersion: POLICY_VERSION,
    status: ready ? RAW_LAND_REVIEW_STATUS.READY_FOR_PROFESSIONAL_STRATEGY_REVIEW : blockerStatus(uniqueBlockers),
    professionalStrategyReviewReady: ready,
    asOf,
    blockers: uniqueBlockers,
    riskFlags: uniqueRiskFlags,
    review,
    recommendedOption: null,
    rankedOptions: null,
    transactionAuthorized: false,
    approvalAuthorized: false,
    productionAuthorized: false,
    publicAiAuthorized: false,
    commercialGoLive: 'HOLD',
    canonicalBaselineActivationAuthorized: false,
    automaticStrategicRecommendation: false,
    buildRecommendationBySoftware: false,
    sellRecommendationBySoftware: false,
    holdRecommendationBySoftware: false,
    zoningDeterminedBySoftware: false,
    serviceAvailabilityDeterminedBySoftware: false,
    subdivisionMergeFeasibilityDeterminedBySoftware: false,
    legalConclusionBySoftware: false,
    valuationCalculated: false,
    residualLandValueCalculated: false,
    npvCalculated: false,
    irrCalculated: false,
  });
}

module.exports = Object.freeze({
  CAPABILITY,
  POLICY_VERSION,
  RAW_LAND_REVIEW_STATUS,
  RAW_LAND_OPTION_TYPE,
  RAW_LAND_EVIDENCE_CLASS,
  EVIDENCE_STATE,
  createGovernedRawLandEvidenceReference,
  computeRawLandEvidenceReferenceHash,
  verifyRawLandEvidenceReferenceIntegrity,
  createGovernedRawLandStrategicOption,
  computeRawLandOptionHash,
  verifyRawLandOptionIntegrity,
  createGovernedRawLandReviewPolicy,
  computeRawLandReviewPolicyHash,
  verifyRawLandReviewPolicyIntegrity,
  evaluateGovernedRawLandStrategicOptionality,
});
