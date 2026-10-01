'use strict';

const crypto = require('crypto');

const CAPABILITY = 'C19_GOVERNED_POLICY_SHOCK_COMPARABLE_IMPACT_INTELLIGENCE_V1';
const POLICY_VERSION = 'C19_POLICY_SHOCK_COMPARABLE_IMPACT_POLICY_V1';

const REVIEW_STATUS = Object.freeze({
  READY_FOR_PROFESSIONAL_POLICY_SHOCK_REVIEW: 'READY_FOR_PROFESSIONAL_POLICY_SHOCK_REVIEW',
  HOLD_EVIDENCE: 'HOLD_EVIDENCE',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
  HOLD_POLICY: 'HOLD_POLICY',
  HOLD_CONTEXT: 'HOLD_CONTEXT',
  HOLD_WINDOW: 'HOLD_WINDOW',
  HOLD_COVERAGE: 'HOLD_COVERAGE',
  HOLD_CALCULATION: 'HOLD_CALCULATION',
});

const SHOCK_CLASS = Object.freeze({
  TRANSFER_COST_TAX_OR_FEE: 'TRANSFER_COST_TAX_OR_FEE',
  RENTAL_REGULATION: 'RENTAL_REGULATION',
  ZONING_OR_LAND_USE: 'ZONING_OR_LAND_USE',
  FINANCING_OR_RATE_ENVIRONMENT: 'FINANCING_OR_RATE_ENVIRONMENT',
  MUNICIPAL_OR_INFRASTRUCTURE: 'MUNICIPAL_OR_INFRASTRUCTURE',
  MARKET_DISCLOSURE_OR_REGISTRY: 'MARKET_DISCLOSURE_OR_REGISTRY',
  OTHER: 'OTHER',
});

const EVIDENCE_STATE = Object.freeze({
  SATISFIED: 'SATISFIED',
  UNRESOLVED: 'UNRESOLVED',
  NOT_REQUIRED: 'NOT_REQUIRED',
});

const IMPACT_ACTION = Object.freeze({
  REVIEW_ONLY: 'REVIEW_ONLY',
  APPLY_SCENARIO_ADJUSTMENT: 'APPLY_SCENARIO_ADJUSTMENT',
  NO_SCENARIO_ADJUSTMENT: 'NO_SCENARIO_ADJUSTMENT',
  PROFESSIONAL_SCENARIO_EXCLUSION: 'PROFESSIONAL_SCENARIO_EXCLUSION',
});

const ADJUSTMENT_DIRECTION = Object.freeze({
  INCREASE: 'INCREASE',
  DECREASE: 'DECREASE',
});

const ADJUSTMENT_METHOD = Object.freeze({
  PERCENT_OF_BASE: 'PERCENT_OF_BASE',
  AMOUNT_SAR_PER_SQM: 'AMOUNT_SAR_PER_SQM',
});

const HASH_RE = /^[a-f0-9]{64}$/i;
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const clean = (v) => nonEmpty(v) ? v.trim() : '';
const finiteNN = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const finitePositive = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;

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
function statusFor(blockers) {
  if (blockers.some((b) => b.startsWith('C19_INTEGRITY_') || b.startsWith('C19_AUTHORITY_INJECTION'))) return REVIEW_STATUS.HOLD_INTEGRITY;
  if (blockers.some((b) => b.startsWith('C19_POLICY_'))) return REVIEW_STATUS.HOLD_POLICY;
  if (blockers.some((b) => b.startsWith('C19_CONTEXT_'))) return REVIEW_STATUS.HOLD_CONTEXT;
  if (blockers.some((b) => b.startsWith('C19_WINDOW_'))) return REVIEW_STATUS.HOLD_WINDOW;
  if (blockers.some((b) => b.startsWith('C19_COVERAGE_'))) return REVIEW_STATUS.HOLD_COVERAGE;
  if (blockers.some((b) => b.startsWith('C19_CALCULATION_'))) return REVIEW_STATUS.HOLD_CALCULATION;
  return REVIEW_STATUS.HOLD_EVIDENCE;
}

function computeShockHash(r) { return r && typeof r === 'object' && !Array.isArray(r) ? sha256(without(r, ['shockEvidenceHashSha256'])) : null; }
function verifyShockEvidenceIntegrity(r) {
  return !!r && HASH_RE.test(clean(r.shockEvidenceHashSha256)) && computeShockHash(r) === clean(r.shockEvidenceHashSha256).toLowerCase();
}
function createPolicyShockEvidence(x = {}) {
  ['shockEvidenceId','caseId','marketScopeRef','sourceCapability','sourceRecordId','sourceStatus','sourceReference','reviewedByRef','reviewEvidenceRef'].forEach((f) => {
    if (!nonEmpty(x[f])) throw new TypeError(`${f} must be a non-empty string`);
  });
  if (!Object.values(SHOCK_CLASS).includes(x.shockClass)) throw new TypeError('C19_SHOCK_CLASS_UNSUPPORTED');
  if (!Object.values(EVIDENCE_STATE).includes(x.evidenceState)) throw new TypeError('C19_EVIDENCE_STATE_UNSUPPORTED');
  if (!HASH_RE.test(clean(x.sourceRecordHashSha256))) throw new TypeError('C19_SOURCE_RECORD_HASH_REQUIRED');
  if (x.evidenceState === EVIDENCE_STATE.UNRESOLVED && !nonEmpty(x.unresolvedReasonRef)) throw new TypeError('C19_UNRESOLVED_REASON_REQUIRED');
  if (x.evidenceState === EVIDENCE_STATE.NOT_REQUIRED && !nonEmpty(x.notRequiredRationaleRef)) throw new TypeError('C19_NOT_REQUIRED_RATIONALE_REQUIRED');
  if (x.shockClass === SHOCK_CLASS.OTHER && !nonEmpty(x.shockLabel)) throw new TypeError('C19_OTHER_SHOCK_LABEL_REQUIRED');
  const knownAt = iso(x.knownAt, 'knownAt');
  const effectiveAt = iso(x.effectiveAt, 'effectiveAt');
  const reviewedAt = iso(x.reviewedAt, 'reviewedAt');
  const validUntil = iso(x.validUntil, 'validUntil');
  if (Date.parse(reviewedAt) < Date.parse(knownAt)) throw new TypeError('C19_REVIEW_BEFORE_KNOWN_AT');
  if (Date.parse(validUntil) < Date.parse(reviewedAt)) throw new TypeError('C19_EVIDENCE_VALIDITY_INVALID');
  const core = {
    schemaVersion: 1,
    shockEvidenceId: x.shockEvidenceId.trim(),
    caseId: x.caseId.trim(),
    marketScopeRef: x.marketScopeRef.trim(),
    shockClass: x.shockClass,
    shockLabel: x.shockClass === SHOCK_CLASS.OTHER ? x.shockLabel.trim() : null,
    evidenceState: x.evidenceState,
    sourceCapability: x.sourceCapability.trim(),
    sourceRecordId: x.sourceRecordId.trim(),
    sourceRecordHashSha256: x.sourceRecordHashSha256.trim().toLowerCase(),
    sourceStatus: x.sourceStatus.trim(),
    sourceReference: x.sourceReference.trim(),
    knownAt,
    effectiveAt,
    reviewedByRef: x.reviewedByRef.trim(),
    reviewEvidenceRef: x.reviewEvidenceRef.trim(),
    reviewedAt,
    validUntil,
    unresolvedReasonRef: x.evidenceState === EVIDENCE_STATE.UNRESOLVED ? x.unresolvedReasonRef.trim() : null,
    notRequiredRationaleRef: x.evidenceState === EVIDENCE_STATE.NOT_REQUIRED ? x.notRequiredRationaleRef.trim() : null,
    statutoryMeaningDeterminedBySoftware: false,
    legalApplicabilityDeterminedBySoftware: false,
    marketImpactEstimatedBySoftware: false,
  };
  return freeze({ ...core, shockEvidenceHashSha256: sha256(core) });
}

function computeImpactHash(r) { return r && typeof r === 'object' && !Array.isArray(r) ? sha256(without(r, ['impactHashSha256'])) : null; }
function verifyComparableImpactIntegrity(r) {
  return !!r && HASH_RE.test(clean(r.impactHashSha256)) && computeImpactHash(r) === clean(r.impactHashSha256).toLowerCase();
}
function createProfessionalComparableImpact(x = {}) {
  ['impactId','caseId','comparableId','preparedByRef','reviewedByRef','reviewEvidenceRef','rationaleRef'].forEach((f) => {
    if (!nonEmpty(x[f])) throw new TypeError(`${f} must be a non-empty string`);
  });
  if (!HASH_RE.test(clean(x.comparableHashSha256))) throw new TypeError('C19_COMPARABLE_HASH_REQUIRED');
  if (!HASH_RE.test(clean(x.shockEvidenceHashSha256))) throw new TypeError('C19_SHOCK_HASH_REQUIRED');
  if (!Object.values(IMPACT_ACTION).includes(x.action)) throw new TypeError('C19_IMPACT_ACTION_UNSUPPORTED');
  const needsAdjustment = x.action === IMPACT_ACTION.APPLY_SCENARIO_ADJUSTMENT;
  if (needsAdjustment) {
    if (!Object.values(ADJUSTMENT_DIRECTION).includes(x.adjustmentDirection)) throw new TypeError('C19_ADJUSTMENT_DIRECTION_REQUIRED');
    if (!Object.values(ADJUSTMENT_METHOD).includes(x.adjustmentMethod)) throw new TypeError('C19_ADJUSTMENT_METHOD_REQUIRED');
    if (!finitePositive(x.adjustmentMagnitude)) throw new TypeError('C19_ADJUSTMENT_MAGNITUDE_REQUIRED');
  } else if (x.adjustmentDirection != null || x.adjustmentMethod != null || x.adjustmentMagnitude != null) {
    throw new TypeError('C19_ADJUSTMENT_FIELDS_ONLY_FOR_APPLY_ACTION');
  }
  const preparedAt = iso(x.preparedAt, 'preparedAt');
  const reviewedAt = iso(x.reviewedAt, 'reviewedAt');
  const validUntil = iso(x.validUntil, 'validUntil');
  if (Date.parse(reviewedAt) < Date.parse(preparedAt)) throw new TypeError('C19_IMPACT_REVIEW_BEFORE_PREPARATION');
  if (Date.parse(validUntil) < Date.parse(reviewedAt)) throw new TypeError('C19_IMPACT_VALIDITY_INVALID');
  const core = {
    schemaVersion: 1,
    impactId: x.impactId.trim(),
    caseId: x.caseId.trim(),
    comparableId: x.comparableId.trim(),
    comparableHashSha256: x.comparableHashSha256.trim().toLowerCase(),
    shockEvidenceHashSha256: x.shockEvidenceHashSha256.trim().toLowerCase(),
    action: x.action,
    adjustmentDirection: needsAdjustment ? x.adjustmentDirection : null,
    adjustmentMethod: needsAdjustment ? x.adjustmentMethod : null,
    adjustmentMagnitude: needsAdjustment ? x.adjustmentMagnitude : null,
    rationaleRef: x.rationaleRef.trim(),
    preparedByRef: x.preparedByRef.trim(),
    preparedAt,
    reviewedByRef: x.reviewedByRef.trim(),
    reviewedAt,
    reviewEvidenceRef: x.reviewEvidenceRef.trim(),
    validUntil,
    professionalJudgmentSuppliedExternally: true,
    impactEstimatedBySoftware: false,
    comparableExcludedBySoftware: false,
    valuationWeightAssignedBySoftware: false,
    transactionAuthorized: false,
  };
  return freeze({ ...core, impactHashSha256: sha256(core) });
}

function computePolicyHash(r) { return r && typeof r === 'object' && !Array.isArray(r) ? sha256(without(r, ['policyHashSha256'])) : null; }
function verifyReviewPolicyIntegrity(r) {
  return !!r && HASH_RE.test(clean(r.policyHashSha256)) && computePolicyHash(r) === clean(r.policyHashSha256).toLowerCase();
}
function createPolicyShockReviewPolicy(x = {}) {
  ['policyId','caseId','marketScopeRef','reviewedByRef','reviewEvidenceRef'].forEach((f) => {
    if (!nonEmpty(x[f])) throw new TypeError(`${f} must be a non-empty string`);
  });
  const allowedShockClasses = uniqueStrings(x.allowedShockClasses || [], 'allowedShockClasses');
  const allowedImpactActions = uniqueStrings(x.allowedImpactActions || [], 'allowedImpactActions');
  if (!allowedShockClasses.length || allowedShockClasses.some((v) => !Object.values(SHOCK_CLASS).includes(v))) throw new TypeError('C19_POLICY_ALLOWED_SHOCK_CLASSES_INVALID');
  if (!allowedImpactActions.length || allowedImpactActions.some((v) => !Object.values(IMPACT_ACTION).includes(v))) throw new TypeError('C19_POLICY_ALLOWED_IMPACT_ACTIONS_INVALID');
  const shockEvidenceHashesSha256 = uniqueStrings(x.shockEvidenceHashesSha256 || [], 'shockEvidenceHashesSha256');
  const comparableHashesSha256 = uniqueStrings(x.comparableHashesSha256 || [], 'comparableHashesSha256');
  const impactHashesSha256 = uniqueStrings(x.impactHashesSha256 || [], 'impactHashesSha256');
  if (!shockEvidenceHashesSha256.length || shockEvidenceHashesSha256.some((h) => !HASH_RE.test(h))) throw new TypeError('C19_POLICY_SHOCK_BINDINGS_REQUIRED');
  if (!comparableHashesSha256.length || comparableHashesSha256.some((h) => !HASH_RE.test(h))) throw new TypeError('C19_POLICY_COMPARABLE_BINDINGS_REQUIRED');
  if (!impactHashesSha256.length || impactHashesSha256.some((h) => !HASH_RE.test(h))) throw new TypeError('C19_POLICY_IMPACT_BINDINGS_REQUIRED');
  if (typeof x.requireFullComparableShockMatrix !== 'boolean') throw new TypeError('C19_POLICY_FULL_MATRIX_BOOLEAN_REQUIRED');
  const reviewedAt = iso(x.reviewedAt, 'reviewedAt');
  const validUntil = iso(x.validUntil, 'validUntil');
  if (Date.parse(validUntil) < Date.parse(reviewedAt)) throw new TypeError('C19_POLICY_VALIDITY_INVALID');
  const core = {
    version: POLICY_VERSION,
    policyId: x.policyId.trim(),
    caseId: x.caseId.trim(),
    marketScopeRef: x.marketScopeRef.trim(),
    allowedShockClasses,
    allowedImpactActions,
    shockEvidenceHashesSha256,
    comparableHashesSha256,
    impactHashesSha256,
    requireFullComparableShockMatrix: x.requireFullComparableShockMatrix,
    reviewedByRef: x.reviewedByRef.trim(),
    reviewEvidenceRef: x.reviewEvidenceRef.trim(),
    reviewedAt,
    validUntil,
    automaticLegalInterpretation: false,
    automaticComparableExclusion: false,
    automaticValuationAdjustment: false,
    automaticValuationWeighting: false,
    automaticInvestmentRecommendation: false,
  };
  return freeze({ ...core, policyHashSha256: sha256(core) });
}

function verifyComparableIntegrity(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r) || !HASH_RE.test(clean(r.comparableHashSha256))) return false;
  return sha256(without(r, ['comparableHashSha256'])) === clean(r.comparableHashSha256).toLowerCase();
}

const FORBIDDEN_TRUE_FIELDS = Object.freeze([
  'transactionAuthorized','approvalAuthorized','productionAuthorized','publicAiAuthorized','canonicalBaselineActivationAuthorized',
  'automaticLegalInterpretation','legalApplicabilityDeterminedBySoftware','statutoryMeaningDeterminedBySoftware',
  'marketImpactEstimatedBySoftware','impactEstimatedBySoftware','automaticComparableExclusion','comparableExcludedBySoftware',
  'automaticValuationAdjustment','valuationWeightAssignedBySoftware','automaticValuationWeighting','valuationConclusionProduced',
  'certifiedValuationEstablished','automaticInvestmentRecommendation','recommendedBySoftware',
]);
function authorityInjection(record) {
  return !!record && FORBIDDEN_TRUE_FIELDS.some((field) => record[field] === true);
}

function signedScenarioDelta(impact, baseUnitValue) {
  const sign = impact.adjustmentDirection === ADJUSTMENT_DIRECTION.INCREASE ? 1 : -1;
  if (impact.adjustmentMethod === ADJUSTMENT_METHOD.PERCENT_OF_BASE) return sign * baseUnitValue * impact.adjustmentMagnitude;
  return sign * impact.adjustmentMagnitude;
}

function evaluateGovernedPolicyShockComparableImpact(input = {}) {
  const comparables = Array.isArray(input.comparables) ? input.comparables : [];
  const shockEvidence = Array.isArray(input.shockEvidence) ? input.shockEvidence : [];
  const impacts = Array.isArray(input.impacts) ? input.impacts : [];
  const policy = input.reviewPolicy;
  const asOf = iso(input.asOf, 'asOf');
  const blockers = [];
  const warnings = [];

  if (!policy || !verifyReviewPolicyIntegrity(policy)) blockers.push('C19_INTEGRITY_POLICY');
  if (policy && authorityInjection(policy)) blockers.push('C19_AUTHORITY_INJECTION:POLICY');

  const comparableByHash = new Map();
  const comparableIdSet = new Set();
  const comparableHashes = [];
  for (const comparable of comparables) {
    const id = clean(comparable && comparable.comparableId) || 'UNKNOWN';
    if (!verifyComparableIntegrity(comparable)) blockers.push(`C19_INTEGRITY_COMPARABLE:${id}`);
    if (authorityInjection(comparable)) blockers.push(`C19_AUTHORITY_INJECTION:COMPARABLE:${id}`);
    if (!clean(comparable && comparable.comparableId) || comparableIdSet.has(id)) blockers.push(`C19_INTEGRITY_DUPLICATE_COMPARABLE_ID:${id}`); else comparableIdSet.add(id);
    const h = clean(comparable && comparable.comparableHashSha256).toLowerCase();
    if (HASH_RE.test(h)) {
      if (comparableByHash.has(h)) blockers.push(`C19_INTEGRITY_DUPLICATE_COMPARABLE_HASH:${id}`);
      comparableByHash.set(h, comparable);
      comparableHashes.push(h);
    }
    if (comparable && Number.isFinite(Date.parse(comparable.transactionDate)) && Date.parse(comparable.transactionDate) > Date.parse(asOf)) blockers.push(`C19_WINDOW_COMPARABLE_FUTURE:${id}`);
  }

  const shockByHash = new Map();
  const shockIdSet = new Set();
  const shockHashes = [];
  for (const shock of shockEvidence) {
    const id = clean(shock && shock.shockEvidenceId) || 'UNKNOWN';
    if (!verifyShockEvidenceIntegrity(shock)) blockers.push(`C19_INTEGRITY_SHOCK:${id}`);
    if (authorityInjection(shock)) blockers.push(`C19_AUTHORITY_INJECTION:SHOCK:${id}`);
    if (!clean(shock && shock.shockEvidenceId) || shockIdSet.has(id)) blockers.push(`C19_INTEGRITY_DUPLICATE_SHOCK_ID:${id}`); else shockIdSet.add(id);
    const h = clean(shock && shock.shockEvidenceHashSha256).toLowerCase();
    if (HASH_RE.test(h)) {
      if (shockByHash.has(h)) blockers.push(`C19_INTEGRITY_DUPLICATE_SHOCK_HASH:${id}`);
      shockByHash.set(h, shock);
      shockHashes.push(h);
    }
    if (shock && Number.isFinite(Date.parse(shock.knownAt)) && Date.parse(shock.knownAt) > Date.parse(asOf)) blockers.push(`C19_WINDOW_SHOCK_NOT_KNOWN_AS_OF:${id}`);
    if (shock && Number.isFinite(Date.parse(shock.reviewedAt)) && Date.parse(shock.reviewedAt) > Date.parse(asOf)) blockers.push(`C19_WINDOW_SHOCK_REVIEW_FUTURE:${id}`);
    if (shock && Number.isFinite(Date.parse(shock.validUntil)) && Date.parse(shock.validUntil) < Date.parse(asOf)) blockers.push(`C19_WINDOW_SHOCK_STALE:${id}`);
    if (shock && shock.evidenceState !== EVIDENCE_STATE.SATISFIED) blockers.push(`C19_EVIDENCE_SHOCK_NOT_SATISFIED:${id}:${clean(shock.evidenceState) || 'UNKNOWN'}`);
  }

  const impactIdSet = new Set();
  const impactHashes = [];
  const pairSet = new Set();
  for (const impact of impacts) {
    const id = clean(impact && impact.impactId) || 'UNKNOWN';
    if (!verifyComparableImpactIntegrity(impact)) blockers.push(`C19_INTEGRITY_IMPACT:${id}`);
    if (authorityInjection(impact)) blockers.push(`C19_AUTHORITY_INJECTION:IMPACT:${id}`);
    if (!clean(impact && impact.impactId) || impactIdSet.has(id)) blockers.push(`C19_INTEGRITY_DUPLICATE_IMPACT_ID:${id}`); else impactIdSet.add(id);
    const h = clean(impact && impact.impactHashSha256).toLowerCase();
    if (HASH_RE.test(h)) impactHashes.push(h);
    const pair = `${clean(impact && impact.comparableHashSha256).toLowerCase()}|${clean(impact && impact.shockEvidenceHashSha256).toLowerCase()}`;
    if (pairSet.has(pair)) blockers.push(`C19_COVERAGE_DUPLICATE_PAIR:${id}`); else pairSet.add(pair);
    if (impact && Number.isFinite(Date.parse(impact.reviewedAt)) && Date.parse(impact.reviewedAt) > Date.parse(asOf)) blockers.push(`C19_WINDOW_IMPACT_REVIEW_FUTURE:${id}`);
    if (impact && Number.isFinite(Date.parse(impact.validUntil)) && Date.parse(impact.validUntil) < Date.parse(asOf)) blockers.push(`C19_WINDOW_IMPACT_STALE:${id}`);
  }

  const scenarioImpacts = [];
  if (policy && verifyReviewPolicyIntegrity(policy)) {
    const actualComparableHashes = [...comparableHashes].sort();
    const actualShockHashes = [...shockHashes].sort();
    const actualImpactHashes = [...impactHashes].sort();
    if (!exactSet(policy.comparableHashesSha256, actualComparableHashes)) blockers.push('C19_POLICY_COMPARABLE_BINDING_MISMATCH');
    if (!exactSet(policy.shockEvidenceHashesSha256, actualShockHashes)) blockers.push('C19_POLICY_SHOCK_BINDING_MISMATCH');
    if (!exactSet(policy.impactHashesSha256, actualImpactHashes)) blockers.push('C19_POLICY_IMPACT_BINDING_MISMATCH');
    if (Date.parse(policy.reviewedAt) > Date.parse(asOf)) blockers.push('C19_WINDOW_POLICY_REVIEW_FUTURE');
    if (Date.parse(policy.validUntil) < Date.parse(asOf)) blockers.push('C19_WINDOW_POLICY_STALE');

    for (const shock of shockEvidence) {
      if (!shock || typeof shock !== 'object') continue;
      if (shock.caseId !== policy.caseId || shock.marketScopeRef !== policy.marketScopeRef) blockers.push(`C19_CONTEXT_SHOCK:${clean(shock.shockEvidenceId) || 'UNKNOWN'}`);
      if (!policy.allowedShockClasses.includes(shock.shockClass)) blockers.push(`C19_POLICY_SHOCK_CLASS_NOT_ALLOWED:${clean(shock.shockEvidenceId) || 'UNKNOWN'}`);
    }
    for (const comparable of comparables) {
      if (!comparable || typeof comparable !== 'object') continue;
      if (comparable.caseId !== policy.caseId) blockers.push(`C19_CONTEXT_COMPARABLE:${clean(comparable.comparableId) || 'UNKNOWN'}`);
    }

    for (const impact of impacts) {
      if (!impact || typeof impact !== 'object') continue;
      const id = clean(impact.impactId) || 'UNKNOWN';
      if (impact.caseId !== policy.caseId) blockers.push(`C19_CONTEXT_IMPACT:${id}`);
      if (!policy.allowedImpactActions.includes(impact.action)) blockers.push(`C19_POLICY_IMPACT_ACTION_NOT_ALLOWED:${id}`);
      const comparable = comparableByHash.get(clean(impact.comparableHashSha256).toLowerCase());
      const shock = shockByHash.get(clean(impact.shockEvidenceHashSha256).toLowerCase());
      if (!comparable) blockers.push(`C19_EVIDENCE_IMPACT_COMPARABLE_MISSING:${id}`);
      if (!shock) blockers.push(`C19_EVIDENCE_IMPACT_SHOCK_MISSING:${id}`);
      if (comparable && impact.comparableId !== comparable.comparableId) blockers.push(`C19_CONTEXT_IMPACT_COMPARABLE_ID_MISMATCH:${id}`);
      if (!comparable || !shock) continue;

      let scenarioUnitValueSarPerSqm = comparable.unitValueSarPerSqm;
      let scenarioDeltaSarPerSqm = 0;
      let excludedFromScenarioByProfessional = false;
      if (impact.action === IMPACT_ACTION.APPLY_SCENARIO_ADJUSTMENT) {
        scenarioDeltaSarPerSqm = signedScenarioDelta(impact, comparable.unitValueSarPerSqm);
        scenarioUnitValueSarPerSqm = comparable.unitValueSarPerSqm + scenarioDeltaSarPerSqm;
        if (!Number.isFinite(scenarioUnitValueSarPerSqm) || scenarioUnitValueSarPerSqm <= 0) blockers.push(`C19_CALCULATION_NON_POSITIVE_SCENARIO_UNIT_VALUE:${id}`);
      } else if (impact.action === IMPACT_ACTION.PROFESSIONAL_SCENARIO_EXCLUSION) {
        excludedFromScenarioByProfessional = true;
        scenarioUnitValueSarPerSqm = null;
        scenarioDeltaSarPerSqm = null;
      } else if (impact.action === IMPACT_ACTION.REVIEW_ONLY) {
        warnings.push(`C19_REVIEW_ONLY_NO_NUMERIC_SCENARIO:${id}`);
      }
      scenarioImpacts.push({
        impactId: id,
        comparableId: comparable.comparableId,
        shockEvidenceId: shock.shockEvidenceId,
        shockClass: shock.shockClass,
        action: impact.action,
        baseUnitValueSarPerSqm: comparable.unitValueSarPerSqm,
        scenarioDeltaSarPerSqm,
        scenarioUnitValueSarPerSqm,
        shockEffectiveAt: shock.effectiveAt,
        excludedFromScenarioByProfessional,
        professionalRationaleRef: impact.rationaleRef,
      });
    }

    if (policy.requireFullComparableShockMatrix) {
      for (const comparableHash of policy.comparableHashesSha256) {
        for (const shockHash of policy.shockEvidenceHashesSha256) {
          if (!pairSet.has(`${comparableHash}|${shockHash}`)) blockers.push(`C19_COVERAGE_MISSING_PAIR:${comparableHash.slice(0,12)}:${shockHash.slice(0,12)}`);
        }
      }
    }
  }

  const status = blockers.length ? statusFor(blockers) : REVIEW_STATUS.READY_FOR_PROFESSIONAL_POLICY_SHOCK_REVIEW;
  const visibleScenarioImpacts = blockers.length ? [] : scenarioImpacts.sort((a, b) => `${a.comparableId}|${a.shockEvidenceId}|${a.impactId}`.localeCompare(`${b.comparableId}|${b.shockEvidenceId}|${b.impactId}`));
  const result = {
    schemaVersion: 1,
    capability: CAPABILITY,
    caseId: policy && policy.caseId ? policy.caseId : null,
    marketScopeRef: policy && policy.marketScopeRef ? policy.marketScopeRef : null,
    asOf,
    status,
    blockers: [...new Set(blockers)].sort(),
    warnings: [...new Set(warnings)].sort(),
    scenarioImpacts: visibleScenarioImpacts,
    professionalReviewRequired: true,
    sourceShockMeaningMustBeExternallyEstablished: true,
    statutoryMeaningDeterminedBySoftware: false,
    legalApplicabilityDeterminedBySoftware: false,
    marketImpactEstimatedBySoftware: false,
    automaticComparableExclusion: false,
    automaticValuationAdjustment: false,
    automaticValuationWeighting: false,
    valuationConclusionProduced: false,
    certifiedValuationEstablished: false,
    investmentRecommendationProduced: false,
    transactionAuthorized: false,
    approvalAuthorized: false,
    productionAuthorized: false,
    publicAiAuthorized: false,
    commercialGoLiveAuthorized: false,
    canonicalBaselineActivationAuthorized: false,
    semantics: 'C19 binds known-as-of policy-shock evidence to explicit comparable evidence and externally reviewed professional impact dispositions. Arithmetic scenario deltas are deterministic transformations of supplied adjustment parameters only; they are not statutory interpretation, market-impact estimation, comparable selection, valuation weighting, certified valuation, investment recommendation or transaction authority.',
  };
  return freeze(result);
}

module.exports = {
  CAPABILITY,
  POLICY_VERSION,
  REVIEW_STATUS,
  SHOCK_CLASS,
  EVIDENCE_STATE,
  IMPACT_ACTION,
  ADJUSTMENT_DIRECTION,
  ADJUSTMENT_METHOD,
  createPolicyShockEvidence,
  verifyShockEvidenceIntegrity,
  createProfessionalComparableImpact,
  verifyComparableImpactIntegrity,
  createPolicyShockReviewPolicy,
  verifyReviewPolicyIntegrity,
  evaluateGovernedPolicyShockComparableImpact,
};
