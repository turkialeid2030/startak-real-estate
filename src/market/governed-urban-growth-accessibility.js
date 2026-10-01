'use strict';

const crypto = require('crypto');

const CAPABILITY = 'C20_GOVERNED_URBAN_GROWTH_ACCESSIBILITY_INTELLIGENCE_V1';
const POLICY_VERSION = 'C20_URBAN_GROWTH_ACCESSIBILITY_POLICY_V1';

const REVIEW_STATUS = Object.freeze({
  READY_FOR_PROFESSIONAL_URBAN_GROWTH_ACCESSIBILITY_REVIEW: 'READY_FOR_PROFESSIONAL_URBAN_GROWTH_ACCESSIBILITY_REVIEW',
  HOLD_EVIDENCE: 'HOLD_EVIDENCE',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
  HOLD_POLICY: 'HOLD_POLICY',
  HOLD_CONTEXT: 'HOLD_CONTEXT',
  HOLD_WINDOW: 'HOLD_WINDOW',
  HOLD_COVERAGE: 'HOLD_COVERAGE',
  HOLD_CALCULATION: 'HOLD_CALCULATION',
});

const SIGNAL_CLASS = Object.freeze({
  POPULATION_OR_HOUSEHOLD_GROWTH: 'POPULATION_OR_HOUSEHOLD_GROWTH',
  BUILDING_PERMIT_OR_CONSTRUCTION_ACTIVITY: 'BUILDING_PERMIT_OR_CONSTRUCTION_ACTIVITY',
  URBAN_FOOTPRINT_OR_DEVELOPED_AREA: 'URBAN_FOOTPRINT_OR_DEVELOPED_AREA',
  ROAD_OR_TRANSIT_ACCESSIBILITY: 'ROAD_OR_TRANSIT_ACCESSIBILITY',
  EMPLOYMENT_OR_ACTIVITY_CENTER_ACCESS: 'EMPLOYMENT_OR_ACTIVITY_CENTER_ACCESS',
  ESSENTIAL_SERVICES_ACCESS: 'ESSENTIAL_SERVICES_ACCESS',
  PLANNED_INFRASTRUCTURE_OR_CORRIDOR: 'PLANNED_INFRASTRUCTURE_OR_CORRIDOR',
  OTHER: 'OTHER',
});

const OBSERVATION_STATE = Object.freeze({
  OBSERVED_EXISTING: 'OBSERVED_EXISTING',
  PLANNED_COMMITTED_NOT_DELIVERED: 'PLANNED_COMMITTED_NOT_DELIVERED',
  PROPOSED_UNCERTAIN: 'PROPOSED_UNCERTAIN',
  UNRESOLVED: 'UNRESOLVED',
});

const METRIC_TYPE = Object.freeze({
  COUNT: 'COUNT',
  AREA_SQM: 'AREA_SQM',
  DISTANCE_METERS: 'DISTANCE_METERS',
  TRAVEL_TIME_MINUTES: 'TRAVEL_TIME_MINUTES',
  INDEX_VALUE: 'INDEX_VALUE',
  PERCENT: 'PERCENT',
});

const ANALYSIS_TYPE = Object.freeze({
  GROWTH_DELTA: 'GROWTH_DELTA',
  ACCESSIBILITY_DELTA: 'ACCESSIBILITY_DELTA',
});

const SOURCE_TIER = Object.freeze({
  A_OFFICIAL_AUTHORITATIVE: 'A_OFFICIAL_AUTHORITATIVE',
  B_COMMERCIAL_CORROBORATION: 'B_COMMERCIAL_CORROBORATION',
  C_INDICATIVE_AVM: 'C_INDICATIVE_AVM',
  D_LICENSED_PROFESSIONAL: 'D_LICENSED_PROFESSIONAL',
});

const HASH_RE = /^[a-f0-9]{64}$/i;
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const clean = (v) => nonEmpty(v) ? v.trim() : '';
const finiteNN = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;

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
function round12(value) { return Number(Number(value).toFixed(12)); }
function statusFor(blockers) {
  if (blockers.some((b) => b.startsWith('C20_INTEGRITY_') || b.startsWith('C20_AUTHORITY_INJECTION'))) return REVIEW_STATUS.HOLD_INTEGRITY;
  if (blockers.some((b) => b.startsWith('C20_POLICY_'))) return REVIEW_STATUS.HOLD_POLICY;
  if (blockers.some((b) => b.startsWith('C20_CONTEXT_'))) return REVIEW_STATUS.HOLD_CONTEXT;
  if (blockers.some((b) => b.startsWith('C20_WINDOW_'))) return REVIEW_STATUS.HOLD_WINDOW;
  if (blockers.some((b) => b.startsWith('C20_EVIDENCE_'))) return REVIEW_STATUS.HOLD_EVIDENCE;
  if (blockers.some((b) => b.startsWith('C20_COVERAGE_'))) return REVIEW_STATUS.HOLD_COVERAGE;
  if (blockers.some((b) => b.startsWith('C20_CALCULATION_'))) return REVIEW_STATUS.HOLD_CALCULATION;
  return REVIEW_STATUS.HOLD_EVIDENCE;
}

function computeEvidenceHash(r) {
  return r && typeof r === 'object' && !Array.isArray(r) ? sha256(without(r, ['evidenceHashSha256'])) : null;
}
function verifyEvidenceIntegrity(r) {
  return !!r && HASH_RE.test(clean(r.evidenceHashSha256)) && computeEvidenceHash(r) === clean(r.evidenceHashSha256).toLowerCase();
}
function createUrbanGrowthAccessibilityEvidence(x = {}) {
  [
    'evidenceId','caseId','propertyRef','marketScopeRef','signalKey','metricUnit','sourceCapability','sourceProvider',
    'sourceRecordId','sourceStatus','sourceReference','reviewedByRef','reviewEvidenceRef',
  ].forEach((f) => { if (!nonEmpty(x[f])) throw new TypeError(`${f} must be a non-empty string`); });
  if (!Object.values(SIGNAL_CLASS).includes(x.signalClass)) throw new TypeError('C20_SIGNAL_CLASS_UNSUPPORTED');
  if (x.signalClass === SIGNAL_CLASS.OTHER && !nonEmpty(x.signalLabel)) throw new TypeError('C20_OTHER_SIGNAL_LABEL_REQUIRED');
  if (!Object.values(OBSERVATION_STATE).includes(x.observationState)) throw new TypeError('C20_OBSERVATION_STATE_UNSUPPORTED');
  if (!Object.values(METRIC_TYPE).includes(x.metricType)) throw new TypeError('C20_METRIC_TYPE_UNSUPPORTED');
  if (!finiteNN(x.metricValue)) throw new TypeError('C20_METRIC_VALUE_INVALID');
  if (!Object.values(SOURCE_TIER).includes(x.sourceTier)) throw new TypeError('C20_SOURCE_TIER_UNSUPPORTED');
  if (x.sourceTier === SOURCE_TIER.C_INDICATIVE_AVM) throw new TypeError('C20_AVM_NOT_URBAN_GROWTH_ACCESSIBILITY_EVIDENCE');
  if (!HASH_RE.test(clean(x.sourceRecordHashSha256))) throw new TypeError('C20_SOURCE_RECORD_HASH_REQUIRED');
  if (x.provenanceVerified !== true) throw new TypeError('C20_PROVENANCE_VERIFICATION_REQUIRED');
  if (x.observationState === OBSERVATION_STATE.UNRESOLVED && !nonEmpty(x.unresolvedReasonRef)) throw new TypeError('C20_UNRESOLVED_REASON_REQUIRED');
  const nonExisting = x.observationState === OBSERVATION_STATE.PLANNED_COMMITTED_NOT_DELIVERED || x.observationState === OBSERVATION_STATE.PROPOSED_UNCERTAIN;
  if (nonExisting && !nonEmpty(x.nonExistingStateRationaleRef)) throw new TypeError('C20_NON_EXISTING_STATE_RATIONALE_REQUIRED');
  const knownAt = iso(x.knownAt, 'knownAt');
  const referenceAt = iso(x.referenceAt, 'referenceAt');
  const reviewedAt = iso(x.reviewedAt, 'reviewedAt');
  const validUntil = iso(x.validUntil, 'validUntil');
  if (Date.parse(reviewedAt) < Date.parse(knownAt)) throw new TypeError('C20_REVIEW_BEFORE_KNOWN_AT');
  if (Date.parse(validUntil) < Date.parse(reviewedAt)) throw new TypeError('C20_EVIDENCE_VALIDITY_INVALID');
  const core = {
    schemaVersion: 1,
    evidenceId: x.evidenceId.trim(),
    caseId: x.caseId.trim(),
    propertyRef: x.propertyRef.trim(),
    marketScopeRef: x.marketScopeRef.trim(),
    signalKey: x.signalKey.trim(),
    signalClass: x.signalClass,
    signalLabel: x.signalClass === SIGNAL_CLASS.OTHER ? x.signalLabel.trim() : null,
    observationState: x.observationState,
    metricType: x.metricType,
    metricUnit: x.metricUnit.trim(),
    metricValue: x.metricValue,
    sourceCapability: x.sourceCapability.trim(),
    sourceProvider: x.sourceProvider.trim(),
    sourceTier: x.sourceTier,
    sourceRecordId: x.sourceRecordId.trim(),
    sourceRecordHashSha256: x.sourceRecordHashSha256.trim().toLowerCase(),
    sourceStatus: x.sourceStatus.trim(),
    sourceReference: x.sourceReference.trim(),
    provenanceVerified: true,
    knownAt,
    referenceAt,
    reviewedByRef: x.reviewedByRef.trim(),
    reviewEvidenceRef: x.reviewEvidenceRef.trim(),
    reviewedAt,
    validUntil,
    unresolvedReasonRef: x.observationState === OBSERVATION_STATE.UNRESOLVED ? x.unresolvedReasonRef.trim() : null,
    nonExistingStateRationaleRef: nonExisting ? x.nonExistingStateRationaleRef.trim() : null,
    geospatialFactInferredBySoftware: false,
    routeCalculatedBySoftware: false,
    serviceAvailabilityDeterminedBySoftware: false,
    infrastructureDeliveredBySoftware: false,
    causalUpliftEstimatedBySoftware: false,
    valuationImpactEstimatedBySoftware: false,
  };
  return freeze({ ...core, evidenceHashSha256: sha256(core) });
}

function computePairHash(r) {
  return r && typeof r === 'object' && !Array.isArray(r) ? sha256(without(r, ['pairHashSha256'])) : null;
}
function verifyComparisonPairIntegrity(r) {
  return !!r && HASH_RE.test(clean(r.pairHashSha256)) && computePairHash(r) === clean(r.pairHashSha256).toLowerCase();
}
function createProfessionalUrbanGrowthAccessibilityPair(x = {}) {
  ['pairId','caseId','propertyRef','marketScopeRef','signalKey','rationaleRef','preparedByRef','reviewedByRef','reviewEvidenceRef'].forEach((f) => {
    if (!nonEmpty(x[f])) throw new TypeError(`${f} must be a non-empty string`);
  });
  if (!Object.values(ANALYSIS_TYPE).includes(x.analysisType)) throw new TypeError('C20_ANALYSIS_TYPE_UNSUPPORTED');
  if (!HASH_RE.test(clean(x.baselineEvidenceHashSha256)) || !HASH_RE.test(clean(x.currentEvidenceHashSha256))) throw new TypeError('C20_PAIR_EVIDENCE_HASH_REQUIRED');
  if (clean(x.baselineEvidenceHashSha256).toLowerCase() === clean(x.currentEvidenceHashSha256).toLowerCase()) throw new TypeError('C20_PAIR_BASELINE_CURRENT_MUST_DIFFER');
  const preparedAt = iso(x.preparedAt, 'preparedAt');
  const reviewedAt = iso(x.reviewedAt, 'reviewedAt');
  const validUntil = iso(x.validUntil, 'validUntil');
  if (Date.parse(reviewedAt) < Date.parse(preparedAt)) throw new TypeError('C20_PAIR_REVIEW_BEFORE_PREPARATION');
  if (Date.parse(validUntil) < Date.parse(reviewedAt)) throw new TypeError('C20_PAIR_VALIDITY_INVALID');
  const core = {
    schemaVersion: 1,
    pairId: x.pairId.trim(),
    caseId: x.caseId.trim(),
    propertyRef: x.propertyRef.trim(),
    marketScopeRef: x.marketScopeRef.trim(),
    signalKey: x.signalKey.trim(),
    analysisType: x.analysisType,
    baselineEvidenceHashSha256: x.baselineEvidenceHashSha256.trim().toLowerCase(),
    currentEvidenceHashSha256: x.currentEvidenceHashSha256.trim().toLowerCase(),
    rationaleRef: x.rationaleRef.trim(),
    preparedByRef: x.preparedByRef.trim(),
    preparedAt,
    reviewedByRef: x.reviewedByRef.trim(),
    reviewEvidenceRef: x.reviewEvidenceRef.trim(),
    reviewedAt,
    validUntil,
    professionalComparisonAuthoredExternally: true,
    benefitDeterminedBySoftware: false,
    adverseImpactDeterminedBySoftware: false,
    causalImpactDeterminedBySoftware: false,
    valuationImpactDeterminedBySoftware: false,
    recommendationGeneratedBySoftware: false,
  };
  return freeze({ ...core, pairHashSha256: sha256(core) });
}

function computePolicyHash(r) {
  return r && typeof r === 'object' && !Array.isArray(r) ? sha256(without(r, ['policyHashSha256'])) : null;
}
function verifyReviewPolicyIntegrity(r) {
  return !!r && HASH_RE.test(clean(r.policyHashSha256)) && computePolicyHash(r) === clean(r.policyHashSha256).toLowerCase();
}
function createUrbanGrowthAccessibilityReviewPolicy(x = {}) {
  ['policyId','caseId','propertyRef','marketScopeRef','reviewedByRef','reviewEvidenceRef'].forEach((f) => {
    if (!nonEmpty(x[f])) throw new TypeError(`${f} must be a non-empty string`);
  });
  const allowedSignalClasses = uniqueStrings(x.allowedSignalClasses || [], 'allowedSignalClasses');
  const requiredSignalClasses = uniqueStrings(x.requiredSignalClasses || [], 'requiredSignalClasses');
  const allowedAnalysisTypes = uniqueStrings(x.allowedAnalysisTypes || [], 'allowedAnalysisTypes');
  const allowedMetricTypes = uniqueStrings(x.allowedMetricTypes || [], 'allowedMetricTypes');
  const allowedSourceTiers = uniqueStrings(x.allowedSourceTiers || [], 'allowedSourceTiers');
  if (!allowedSignalClasses.length || allowedSignalClasses.some((v) => !Object.values(SIGNAL_CLASS).includes(v))) throw new TypeError('C20_POLICY_ALLOWED_SIGNAL_CLASSES_INVALID');
  if (!requiredSignalClasses.length || requiredSignalClasses.some((v) => !Object.values(SIGNAL_CLASS).includes(v))) throw new TypeError('C20_POLICY_REQUIRED_SIGNAL_CLASSES_INVALID');
  if (requiredSignalClasses.some((v) => !allowedSignalClasses.includes(v))) throw new TypeError('C20_POLICY_REQUIRED_SIGNAL_CLASS_NOT_ALLOWED');
  if (!allowedAnalysisTypes.length || allowedAnalysisTypes.some((v) => !Object.values(ANALYSIS_TYPE).includes(v))) throw new TypeError('C20_POLICY_ALLOWED_ANALYSIS_TYPES_INVALID');
  if (!allowedMetricTypes.length || allowedMetricTypes.some((v) => !Object.values(METRIC_TYPE).includes(v))) throw new TypeError('C20_POLICY_ALLOWED_METRIC_TYPES_INVALID');
  if (!allowedSourceTiers.length || allowedSourceTiers.some((v) => !Object.values(SOURCE_TIER).includes(v))) throw new TypeError('C20_POLICY_ALLOWED_SOURCE_TIERS_INVALID');
  if (allowedSourceTiers.includes(SOURCE_TIER.C_INDICATIVE_AVM)) throw new TypeError('C20_POLICY_AVM_TIER_NOT_ALLOWED');
  if (typeof x.allowNonObservedContextEvidence !== 'boolean') throw new TypeError('C20_POLICY_NON_OBSERVED_CONTEXT_BOOLEAN_REQUIRED');
  const evidenceHashesSha256 = uniqueStrings(x.evidenceHashesSha256 || [], 'evidenceHashesSha256');
  const pairHashesSha256 = uniqueStrings(x.pairHashesSha256 || [], 'pairHashesSha256');
  if (!evidenceHashesSha256.length || evidenceHashesSha256.some((h) => !HASH_RE.test(h))) throw new TypeError('C20_POLICY_EVIDENCE_BINDINGS_REQUIRED');
  if (!pairHashesSha256.length || pairHashesSha256.some((h) => !HASH_RE.test(h))) throw new TypeError('C20_POLICY_PAIR_BINDINGS_REQUIRED');
  const reviewedAt = iso(x.reviewedAt, 'reviewedAt');
  const validUntil = iso(x.validUntil, 'validUntil');
  if (Date.parse(validUntil) < Date.parse(reviewedAt)) throw new TypeError('C20_POLICY_VALIDITY_INVALID');
  const core = {
    version: POLICY_VERSION,
    policyId: x.policyId.trim(),
    caseId: x.caseId.trim(),
    propertyRef: x.propertyRef.trim(),
    marketScopeRef: x.marketScopeRef.trim(),
    allowedSignalClasses,
    requiredSignalClasses,
    allowedAnalysisTypes,
    allowedMetricTypes,
    allowedSourceTiers,
    allowNonObservedContextEvidence: x.allowNonObservedContextEvidence,
    evidenceHashesSha256,
    pairHashesSha256,
    reviewedByRef: x.reviewedByRef.trim(),
    reviewEvidenceRef: x.reviewEvidenceRef.trim(),
    reviewedAt,
    validUntil,
    geospatialInferenceAuthority: false,
    accessibilityScoringAuthority: false,
    growthScoringAuthority: false,
    causalImpactAuthority: false,
    valuationAuthority: false,
    recommendationAuthority: false,
  };
  return freeze({ ...core, policyHashSha256: sha256(core) });
}

const FALSE_ONLY_FIELDS = Object.freeze([
  'transactionAuthorized','approvalAuthorized','productionAuthorized','publicAiAuthorized','canonicalBaselineActivationAuthorized',
  'geospatialFactInferredBySoftware','routeCalculatedBySoftware','serviceAvailabilityDeterminedBySoftware',
  'infrastructureDeliveredBySoftware','causalUpliftEstimatedBySoftware','valuationImpactEstimatedBySoftware',
  'benefitDeterminedBySoftware','adverseImpactDeterminedBySoftware','causalImpactDeterminedBySoftware',
  'valuationImpactDeterminedBySoftware','recommendationGeneratedBySoftware','automaticAccessibilityScore',
  'automaticGrowthScore','automaticInvestmentRanking','zoningDeterminedBySoftware','buildabilityDeterminedBySoftware',
  'legalConclusionBySoftware','valuationCalculated','avmCalculated','residualLandValueCalculated','npvCalculated','irrCalculated',
  'geospatialInferenceAuthority','accessibilityScoringAuthority','growthScoringAuthority','causalImpactAuthority',
  'valuationAuthority','recommendationAuthority',
]);
function authorityInjection(record) {
  if (!record || typeof record !== 'object') return false;
  if (FALSE_ONLY_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(record, field) && record[field] !== false)) return true;
  if (Object.prototype.hasOwnProperty.call(record, 'commercialGoLive') && record.commercialGoLive !== 'HOLD') return true;
  if (Object.prototype.hasOwnProperty.call(record, 'recommendation') && record.recommendation != null) return true;
  return false;
}

const GROWTH_CLASSES = new Set([
  SIGNAL_CLASS.POPULATION_OR_HOUSEHOLD_GROWTH,
  SIGNAL_CLASS.BUILDING_PERMIT_OR_CONSTRUCTION_ACTIVITY,
  SIGNAL_CLASS.URBAN_FOOTPRINT_OR_DEVELOPED_AREA,
]);
const ACCESS_CLASSES = new Set([
  SIGNAL_CLASS.ROAD_OR_TRANSIT_ACCESSIBILITY,
  SIGNAL_CLASS.EMPLOYMENT_OR_ACTIVITY_CENTER_ACCESS,
  SIGNAL_CLASS.ESSENTIAL_SERVICES_ACCESS,
]);

function evaluateGovernedUrbanGrowthAccessibility(input = {}) {
  const evidence = Array.isArray(input.evidence) ? input.evidence : [];
  const pairs = Array.isArray(input.pairs) ? input.pairs : [];
  const policy = input.reviewPolicy;
  const asOf = iso(input.asOf, 'asOf');
  const blockers = [];
  const riskFlags = [];

  if (!policy || !verifyReviewPolicyIntegrity(policy)) blockers.push('C20_INTEGRITY_POLICY');
  if (authorityInjection(policy)) blockers.push('C20_AUTHORITY_INJECTION:POLICY');

  const evidenceIds = new Set();
  const evidenceHashes = [];
  for (const e of evidence) {
    const id = clean(e && e.evidenceId) || 'UNKNOWN';
    if (!verifyEvidenceIntegrity(e)) blockers.push(`C20_INTEGRITY_EVIDENCE:${id}`);
    if (authorityInjection(e)) blockers.push(`C20_AUTHORITY_INJECTION:EVIDENCE:${id}`);
    if (evidenceIds.has(id)) blockers.push(`C20_INTEGRITY_DUPLICATE_EVIDENCE_ID:${id}`); else evidenceIds.add(id);
    const hash = clean(e && e.evidenceHashSha256).toLowerCase();
    if (HASH_RE.test(hash)) evidenceHashes.push(hash);
  }
  if (new Set(evidenceHashes).size !== evidenceHashes.length) blockers.push('C20_INTEGRITY_DUPLICATE_EVIDENCE_HASH');

  const pairIds = new Set();
  const pairHashes = [];
  const roleBindings = new Set();
  for (const pair of pairs) {
    const id = clean(pair && pair.pairId) || 'UNKNOWN';
    if (!verifyComparisonPairIntegrity(pair)) blockers.push(`C20_INTEGRITY_PAIR:${id}`);
    if (authorityInjection(pair)) blockers.push(`C20_AUTHORITY_INJECTION:PAIR:${id}`);
    if (pairIds.has(id)) blockers.push(`C20_INTEGRITY_DUPLICATE_PAIR_ID:${id}`); else pairIds.add(id);
    const hash = clean(pair && pair.pairHashSha256).toLowerCase();
    if (HASH_RE.test(hash)) pairHashes.push(hash);
    if (pair && typeof pair === 'object') {
      const baselineRole = `${clean(pair.signalKey)}|BASELINE|${clean(pair.baselineEvidenceHashSha256).toLowerCase()}`;
      const currentRole = `${clean(pair.signalKey)}|CURRENT|${clean(pair.currentEvidenceHashSha256).toLowerCase()}`;
      for (const role of [baselineRole, currentRole]) {
        if (roleBindings.has(role)) blockers.push(`C20_INTEGRITY_DUPLICATE_SIGNAL_ROLE_BINDING:${role}`); else roleBindings.add(role);
      }
    }
  }
  if (new Set(pairHashes).size !== pairHashes.length) blockers.push('C20_INTEGRITY_DUPLICATE_PAIR_HASH');

  if (policy && verifyReviewPolicyIntegrity(policy)) {
    if (!exactSet(policy.evidenceHashesSha256, [...evidenceHashes].sort())) blockers.push('C20_POLICY_EVIDENCE_BINDING_MISMATCH');
    if (!exactSet(policy.pairHashesSha256, [...pairHashes].sort())) blockers.push('C20_POLICY_PAIR_BINDING_MISMATCH');
    if (Date.parse(policy.reviewedAt) > Date.parse(asOf)) blockers.push('C20_WINDOW_POLICY_REVIEWED_IN_FUTURE');
    if (Date.parse(policy.validUntil) < Date.parse(asOf)) blockers.push('C20_WINDOW_POLICY_EXPIRED');

    for (const e of evidence) {
      if (!e || typeof e !== 'object') continue;
      const id = clean(e.evidenceId) || 'UNKNOWN';
      if (e.caseId !== policy.caseId || e.propertyRef !== policy.propertyRef || e.marketScopeRef !== policy.marketScopeRef) blockers.push(`C20_CONTEXT_EVIDENCE:${id}`);
      if (!policy.allowedSignalClasses.includes(e.signalClass)) blockers.push(`C20_POLICY_SIGNAL_CLASS_NOT_ALLOWED:${id}`);
      if (!policy.allowedMetricTypes.includes(e.metricType)) blockers.push(`C20_POLICY_METRIC_TYPE_NOT_ALLOWED:${id}`);
      if (!policy.allowedSourceTiers.includes(e.sourceTier)) blockers.push(`C20_POLICY_SOURCE_TIER_NOT_ALLOWED:${id}`);
      if (e.sourceTier === SOURCE_TIER.C_INDICATIVE_AVM) blockers.push(`C20_POLICY_AVM_TIER_NOT_ALLOWED:${id}`);
      if (e.provenanceVerified !== true) blockers.push(`C20_EVIDENCE_PROVENANCE_NOT_VERIFIED:${id}`);
      if (Date.parse(e.knownAt) > Date.parse(asOf)) blockers.push(`C20_WINDOW_EVIDENCE_KNOWN_IN_FUTURE:${id}`);
      if (Date.parse(e.reviewedAt) > Date.parse(asOf)) blockers.push(`C20_WINDOW_EVIDENCE_REVIEWED_IN_FUTURE:${id}`);
      if (Date.parse(e.validUntil) < Date.parse(asOf)) blockers.push(`C20_WINDOW_EVIDENCE_STALE:${id}`);
      if (e.observationState === OBSERVATION_STATE.OBSERVED_EXISTING && Date.parse(e.referenceAt) > Date.parse(asOf)) blockers.push(`C20_WINDOW_OBSERVED_REFERENCE_IN_FUTURE:${id}`);
      if (e.observationState === OBSERVATION_STATE.UNRESOLVED) blockers.push(`C20_EVIDENCE_UNRESOLVED:${id}`);
      const nonObserved = e.observationState === OBSERVATION_STATE.PLANNED_COMMITTED_NOT_DELIVERED || e.observationState === OBSERVATION_STATE.PROPOSED_UNCERTAIN;
      if (nonObserved) {
        if (!policy.allowNonObservedContextEvidence) blockers.push(`C20_POLICY_NON_OBSERVED_CONTEXT_NOT_ALLOWED:${id}`);
        else riskFlags.push(`C20_REVIEW_ONLY_NON_EXISTING_CONTEXT:${id}:${e.observationState}`);
      }
    }

    const byHash = new Map(evidence.map((e) => [clean(e && e.evidenceHashSha256).toLowerCase(), e]));
    const validPairClasses = new Set();
    for (const pair of pairs) {
      if (!pair || typeof pair !== 'object') continue;
      const id = clean(pair.pairId) || 'UNKNOWN';
      if (pair.caseId !== policy.caseId || pair.propertyRef !== policy.propertyRef || pair.marketScopeRef !== policy.marketScopeRef) blockers.push(`C20_CONTEXT_PAIR:${id}`);
      if (!policy.allowedAnalysisTypes.includes(pair.analysisType)) blockers.push(`C20_POLICY_ANALYSIS_TYPE_NOT_ALLOWED:${id}`);
      if (Date.parse(pair.preparedAt) > Date.parse(asOf)) blockers.push(`C20_WINDOW_PAIR_PREPARED_IN_FUTURE:${id}`);
      if (Date.parse(pair.reviewedAt) > Date.parse(asOf)) blockers.push(`C20_WINDOW_PAIR_REVIEWED_IN_FUTURE:${id}`);
      if (Date.parse(pair.validUntil) < Date.parse(asOf)) blockers.push(`C20_WINDOW_PAIR_STALE:${id}`);

      const baseline = byHash.get(clean(pair.baselineEvidenceHashSha256).toLowerCase());
      const current = byHash.get(clean(pair.currentEvidenceHashSha256).toLowerCase());
      if (!baseline) blockers.push(`C20_EVIDENCE_PAIR_BASELINE_MISSING:${id}`);
      if (!current) blockers.push(`C20_EVIDENCE_PAIR_CURRENT_MISSING:${id}`);
      if (!baseline || !current) continue;

      if (baseline.signalKey !== pair.signalKey || current.signalKey !== pair.signalKey) blockers.push(`C20_CONTEXT_PAIR_SIGNAL_KEY_MISMATCH:${id}`);
      if (baseline.signalKey !== current.signalKey) blockers.push(`C20_CONTEXT_BASELINE_CURRENT_SIGNAL_KEY_MISMATCH:${id}`);
      if (baseline.signalClass !== current.signalClass) blockers.push(`C20_CONTEXT_PAIR_SIGNAL_CLASS_MISMATCH:${id}`);
      if (baseline.metricType !== current.metricType) blockers.push(`C20_CONTEXT_PAIR_METRIC_TYPE_MISMATCH:${id}`);
      if (baseline.metricUnit !== current.metricUnit) blockers.push(`C20_CONTEXT_PAIR_METRIC_UNIT_MISMATCH:${id}`);
      if (baseline.observationState !== OBSERVATION_STATE.OBSERVED_EXISTING || current.observationState !== OBSERVATION_STATE.OBSERVED_EXISTING) blockers.push(`C20_EVIDENCE_PAIR_REQUIRES_OBSERVED_EXISTING:${id}`);
      if (Date.parse(current.referenceAt) <= Date.parse(baseline.referenceAt)) blockers.push(`C20_WINDOW_PAIR_CURRENT_NOT_AFTER_BASELINE:${id}`);
      if (pair.analysisType === ANALYSIS_TYPE.GROWTH_DELTA && ACCESS_CLASSES.has(baseline.signalClass)) blockers.push(`C20_POLICY_GROWTH_ANALYSIS_SIGNAL_CLASS_MISMATCH:${id}`);
      if (pair.analysisType === ANALYSIS_TYPE.ACCESSIBILITY_DELTA && GROWTH_CLASSES.has(baseline.signalClass)) blockers.push(`C20_POLICY_ACCESS_ANALYSIS_SIGNAL_CLASS_MISMATCH:${id}`);

      const pairBlocked = blockers.some((b) => b.endsWith(`:${id}`) && (
        b.startsWith('C20_CONTEXT_PAIR') || b.startsWith('C20_CONTEXT_BASELINE') || b.startsWith('C20_EVIDENCE_PAIR') ||
        b.startsWith('C20_WINDOW_PAIR_CURRENT') || b.startsWith('C20_POLICY_GROWTH_ANALYSIS') || b.startsWith('C20_POLICY_ACCESS_ANALYSIS')
      ));
      if (!pairBlocked) validPairClasses.add(baseline.signalClass);
    }

    for (const requiredClass of policy.requiredSignalClasses) {
      if (requiredClass === SIGNAL_CLASS.PLANNED_INFRASTRUCTURE_OR_CORRIDOR) {
        const contextEvidence = evidence.filter((e) => e && e.signalClass === requiredClass && e.observationState !== OBSERVATION_STATE.UNRESOLVED);
        if (!contextEvidence.length) blockers.push(`C20_COVERAGE_REQUIRED_SIGNAL_CLASS_MISSING:${requiredClass}`);
      } else if (!validPairClasses.has(requiredClass)) {
        blockers.push(`C20_COVERAGE_REQUIRED_SIGNAL_CLASS_MISSING:${requiredClass}`);
      }
    }
  }

  const uniqueBlockers = [...new Set(blockers)].sort();
  const uniqueRiskFlags = [...new Set(riskFlags)].sort();
  const ready = uniqueBlockers.length === 0;
  let review = null;

  if (ready) {
    const byHash = new Map(evidence.map((e) => [e.evidenceHashSha256, e]));
    const comparisons = [];
    for (const pair of [...pairs].sort((a, b) => a.pairId.localeCompare(b.pairId))) {
      const baseline = byHash.get(pair.baselineEvidenceHashSha256);
      const current = byHash.get(pair.currentEvidenceHashSha256);
      const absoluteDelta = round12(current.metricValue - baseline.metricValue);
      const percentageDelta = baseline.metricValue === 0 ? null : round12((absoluteDelta / baseline.metricValue) * 100);
      if (!Number.isFinite(absoluteDelta) || (percentageDelta != null && !Number.isFinite(percentageDelta))) {
        uniqueBlockers.push(`C20_CALCULATION_NON_FINITE:${pair.pairId}`);
        continue;
      }
      if (baseline.metricValue === 0) uniqueRiskFlags.push(`C20_BASELINE_ZERO_PERCENT_DELTA_NOT_CALCULATED:${pair.pairId}`);
      comparisons.push(freeze({
        pairId: pair.pairId,
        signalKey: pair.signalKey,
        signalClass: baseline.signalClass,
        analysisType: pair.analysisType,
        metricType: baseline.metricType,
        metricUnit: baseline.metricUnit,
        baselineValue: baseline.metricValue,
        baselineReferenceAt: baseline.referenceAt,
        currentValue: current.metricValue,
        currentReferenceAt: current.referenceAt,
        absoluteDelta,
        percentageDelta,
        benefitDeterminedBySoftware: false,
        adverseImpactDeterminedBySoftware: false,
        causalImpactDeterminedBySoftware: false,
        valuationImpactDeterminedBySoftware: false,
        recommendation: null,
      }));
    }
    const context = evidence
      .filter((e) => e.observationState === OBSERVATION_STATE.PLANNED_COMMITTED_NOT_DELIVERED || e.observationState === OBSERVATION_STATE.PROPOSED_UNCERTAIN)
      .sort((a, b) => a.evidenceId.localeCompare(b.evidenceId))
      .map((e) => freeze({
        evidenceId: e.evidenceId,
        signalKey: e.signalKey,
        signalClass: e.signalClass,
        observationState: e.observationState,
        metricType: e.metricType,
        metricUnit: e.metricUnit,
        metricValue: e.metricValue,
        referenceAt: e.referenceAt,
        treatedAsExisting: false,
        serviceAvailabilityDeterminedBySoftware: false,
        infrastructureDeliveredBySoftware: false,
      }));
    review = freeze({ comparisons, reviewOnlyNonExistingContext: context });
  }

  const finalBlockers = [...new Set(uniqueBlockers)].sort();
  const finalRiskFlags = [...new Set(uniqueRiskFlags)].sort();
  const finalReady = finalBlockers.length === 0;
  if (!finalReady) review = null;

  return freeze({
    capability: CAPABILITY,
    policyVersion: POLICY_VERSION,
    status: finalReady ? REVIEW_STATUS.READY_FOR_PROFESSIONAL_URBAN_GROWTH_ACCESSIBILITY_REVIEW : statusFor(finalBlockers),
    professionalUrbanGrowthAccessibilityReviewReady: finalReady,
    asOf,
    blockers: finalBlockers,
    riskFlags: finalRiskFlags,
    review,
    recommendation: null,
    transactionAuthorized: false,
    approvalAuthorized: false,
    productionAuthorized: false,
    publicAiAuthorized: false,
    commercialGoLive: 'HOLD',
    canonicalBaselineActivationAuthorized: false,
    geospatialFactInferredBySoftware: false,
    routeCalculatedBySoftware: false,
    serviceAvailabilityDeterminedBySoftware: false,
    infrastructureDeliveredBySoftware: false,
    causalUpliftEstimatedBySoftware: false,
    valuationImpactEstimatedBySoftware: false,
    automaticAccessibilityScore: false,
    automaticGrowthScore: false,
    automaticInvestmentRanking: false,
    zoningDeterminedBySoftware: false,
    buildabilityDeterminedBySoftware: false,
    legalConclusionBySoftware: false,
    valuationCalculated: false,
    avmCalculated: false,
    residualLandValueCalculated: false,
    npvCalculated: false,
    irrCalculated: false,
  });
}

module.exports = Object.freeze({
  CAPABILITY,
  POLICY_VERSION,
  REVIEW_STATUS,
  SIGNAL_CLASS,
  OBSERVATION_STATE,
  METRIC_TYPE,
  ANALYSIS_TYPE,
  SOURCE_TIER,
  createUrbanGrowthAccessibilityEvidence,
  computeEvidenceHash,
  verifyEvidenceIntegrity,
  createProfessionalUrbanGrowthAccessibilityPair,
  computePairHash,
  verifyComparisonPairIntegrity,
  createUrbanGrowthAccessibilityReviewPolicy,
  computePolicyHash,
  verifyReviewPolicyIntegrity,
  evaluateGovernedUrbanGrowthAccessibility,
});
