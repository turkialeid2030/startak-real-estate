'use strict';

const TENANT_EVIDENCE_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  OBSERVED: 'OBSERVED',
  ASSUMED: 'ASSUMED',
  UNVERIFIED: 'UNVERIFIED',
  CONFLICT: 'CONFLICT',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
});

const TENANT_RESULT_STATUS = Object.freeze({
  TENANT_ANALYTICAL_FAVOURABLE: 'TENANT_ANALYTICAL_FAVOURABLE',
  TENANT_ANALYTICAL_CONDITIONAL: 'TENANT_ANALYTICAL_CONDITIONAL',
  TENANT_HIGH_RISK: 'TENANT_HIGH_RISK',
  HOLD_EVIDENCE: 'HOLD_EVIDENCE',
  HOLD_POLICY: 'HOLD_POLICY',
  LEGAL_REVIEW_REQUIRED: 'LEGAL_REVIEW_REQUIRED',
});

const AXIS = Object.freeze({
  FINANCIAL_CAPACITY: 'FINANCIAL_CAPACITY',
  LEGAL_CREDIT_RECORD: 'LEGAL_CREDIT_RECORD',
  BUSINESS_STABILITY: 'BUSINESS_STABILITY',
  GUARANTEES: 'GUARANTEES',
  SECTOR_RISK: 'SECTOR_RISK',
});

const TENANT_CLASS = Object.freeze({
  LARGE: 'LARGE',
  MEDIUM: 'MEDIUM',
  SMALL: 'SMALL',
});

const DEFAULT_REFERENCE_POLICY = Object.freeze({
  policyId: 'TENANT_POLICY_PROFILE_REFERENCE_V1',
  version: 1,
  sourceSemantics: 'Configurable reference profile derived from the supplied tenant-solvency qualification form. It is not a statute, credit rating methodology, or universal Saudi market rule.',
  applicability: Object.freeze({
    financialCapacityMinimumAnnualRent: 3000000,
    belowThresholdFinancialMode: 'NOT_APPLICABLE_COMMITTEE_DISCRETION',
  }),
  axes: Object.freeze({
    [AXIS.FINANCIAL_CAPACITY]: Object.freeze({
      weight: 40,
      items: Object.freeze([
        Object.freeze({ key: 'auditedFinancialStatements3Y', weight: 15, required: true }),
        Object.freeze({ key: 'liquidity', weight: 5, required: true }),
        Object.freeze({ key: 'operatingCashFlow', weight: 5, required: true }),
        Object.freeze({ key: 'leverageDebtRatio', weight: 10, required: true }),
        Object.freeze({ key: 'paidInCapital', weight: 5, required: true }),
      ]),
    }),
    [AXIS.LEGAL_CREDIT_RECORD]: Object.freeze({
      weight: 20,
      items: Object.freeze([
        Object.freeze({ key: 'creditReport', weight: 5, required: true }),
        Object.freeze({ key: 'enforcementCases', weight: 5, required: true, legalSensitive: true }),
        Object.freeze({ key: 'bankruptcyProceedings', weight: 5, required: true, legalSensitive: true }),
        Object.freeze({ key: 'priorContractualRentalBehaviour', weight: 5, required: true }),
      ]),
    }),
    [AXIS.BUSINESS_STABILITY]: Object.freeze({
      weight: 15,
      items: Object.freeze([
        Object.freeze({ key: 'businessAge', weight: 5, required: true }),
        Object.freeze({ key: 'sectorStability', weight: 5, required: true }),
        Object.freeze({ key: 'useCompatibility', weight: 5, required: true }),
      ]),
    }),
    [AXIS.GUARANTEES]: Object.freeze({
      weight: 15,
      items: Object.freeze([
        Object.freeze({ key: 'guaranteeStrength', weight: 15, required: true }),
      ]),
      sourceNote: 'The supplied form labels the axis as 15 points while its listed guarantee sub-items total 12 points and explicitly notes that weights may need redistribution. The engine therefore keeps this axis configurable and does not encode the form sub-items as universal fixed weights.',
    }),
    [AXIS.SECTOR_RISK]: Object.freeze({
      weight: 10,
      items: Object.freeze([
        Object.freeze({ key: 'sectorRisk', weight: 10, required: true }),
      ]),
    }),
  }),
  referenceDecisionBands: Object.freeze({
    financialCapacityExcluded60PointProfile: Object.freeze([
      Object.freeze({ min: 40, max: 60, analyticalStatus: 'TENANT_ANALYTICAL_FAVOURABLE', sourceLabel: 'قبول مباشر' }),
      Object.freeze({ min: 30, max: 39, analyticalStatus: 'TENANT_ANALYTICAL_CONDITIONAL', sourceLabel: 'قبول بضمان إضافي' }),
      Object.freeze({ min: 29, max: 29, analyticalStatus: 'TENANT_ANALYTICAL_CONDITIONAL', sourceLabel: 'قبول مشروط' }),
      Object.freeze({ min: 0, max: 28.999999, analyticalStatus: 'TENANT_HIGH_RISK', sourceLabel: 'رفض' }),
    ]),
    financialCapacityIncluded100PointProfile: null,
  }),
  rentAffordability: Object.freeze({
    classThresholds: Object.freeze({
      [TENANT_CLASS.LARGE]: 0.15,
      [TENANT_CLASS.MEDIUM]: 0.10,
      [TENANT_CLASS.SMALL]: 0.08,
    }),
  }),
  guaranteeRequirementBands: Object.freeze([
    Object.freeze({ minAnnualContractValue: 500000, maxAnnualContractValue: 2000000, requirement: 'AS_POLICY', sourceLabel: 'حسب اللائحة' }),
    Object.freeze({ minAnnualContractValueExclusive: 3000000, maxAnnualContractValue: 10000000, requirement: 'BANK_GUARANTEE', sourceLabel: 'ضمان بنكي' }),
    Object.freeze({ minAnnualContractValueExclusive: 10000000, maxAnnualContractValue: null, requirement: 'BANK_GUARANTEE_PLUS_PARENT_GUARANTEE', sourceLabel: 'ضمان بنكي + كفالة شركة أم' }),
  ]),
});

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function finiteNumber(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${field} must be a finite number`);
  return value;
}

function boundedScore(value, field) {
  finiteNumber(value, field);
  if (value < 0 || value > 1) throw new RangeError(`${field} must be between 0 and 1`);
  return value;
}

function createTenantEvidenceFact({ tenantId, key, value = null, score = null, status, sourceType, sourceRef = null, observedAt = null, note = null }) {
  requiredString(tenantId, 'tenantId');
  requiredString(key, 'key');
  if (!Object.values(TENANT_EVIDENCE_STATUS).includes(status)) throw new TypeError(`invalid tenant evidence status: ${status}`);
  requiredString(sourceType, 'sourceType');
  if (score !== null) boundedScore(score, 'score');
  if (sourceRef !== null) requiredString(sourceRef, 'sourceRef');
  if (observedAt !== null) requiredString(observedAt, 'observedAt');
  if (note !== null && typeof note !== 'string') throw new TypeError('note must be a string or null');
  return freeze({ schemaVersion: 1, tenantId: tenantId.trim(), key: key.trim(), value, score, status, sourceType: sourceType.trim(), sourceRef: sourceRef ? sourceRef.trim() : null, observedAt: observedAt ? observedAt.trim() : null, note: note ? note.trim() : null });
}

function validatePolicy(policy) {
  if (!policy || typeof policy !== 'object') throw new TypeError('tenant policy profile is required');
  requiredString(policy.policyId, 'policyId');
  if (!Number.isInteger(policy.version) || policy.version < 1) throw new TypeError('policy version must be integer >= 1');
  if (!policy.axes || typeof policy.axes !== 'object') throw new TypeError('policy.axes is required');
  let axisTotal = 0;
  for (const [axisName, axis] of Object.entries(policy.axes)) {
    if (!Object.values(AXIS).includes(axisName)) throw new TypeError(`unknown tenant axis: ${axisName}`);
    finiteNumber(axis.weight, `${axisName}.weight`);
    if (!Array.isArray(axis.items) || axis.items.length === 0) throw new TypeError(`${axisName}.items must be non-empty`);
    const itemTotal = axis.items.reduce((sum, item) => {
      requiredString(item.key, `${axisName}.item.key`);
      finiteNumber(item.weight, `${axisName}.${item.key}.weight`);
      if (item.weight < 0) throw new RangeError(`${axisName}.${item.key}.weight must be >= 0`);
      return sum + item.weight;
    }, 0);
    if (Math.abs(itemTotal - axis.weight) > 1e-9) throw new Error(`${axisName} item weights must sum to axis weight`);
    axisTotal += axis.weight;
  }
  if (Math.abs(axisTotal - 100) > 1e-9) throw new Error('tenant policy axis weights must sum to 100');
  finiteNumber(policy.applicability.financialCapacityMinimumAnnualRent, 'financialCapacityMinimumAnnualRent');
  return policy;
}

function createTenantPolicyProfile(overrides = {}) {
  const base = DEFAULT_REFERENCE_POLICY;
  const axes = {};
  for (const axisName of Object.values(AXIS)) {
    const source = (overrides.axes && overrides.axes[axisName]) || base.axes[axisName];
    axes[axisName] = { weight: source.weight, items: source.items.map((item) => ({ ...item })), sourceNote: source.sourceNote || null };
  }
  const profile = {
    policyId: overrides.policyId || base.policyId,
    version: overrides.version || base.version,
    sourceSemantics: overrides.sourceSemantics || base.sourceSemantics,
    applicability: { ...base.applicability, ...(overrides.applicability || {}) },
    axes,
    referenceDecisionBands: overrides.referenceDecisionBands || base.referenceDecisionBands,
    rentAffordability: { classThresholds: { ...base.rentAffordability.classThresholds, ...((overrides.rentAffordability && overrides.rentAffordability.classThresholds) || {}) } },
    guaranteeRequirementBands: overrides.guaranteeRequirementBands || base.guaranteeRequirementBands,
  };
  validatePolicy(profile);
  return freeze(profile);
}

function groupFactsByKey(facts, tenantId) {
  if (!Array.isArray(facts)) throw new TypeError('facts must be an array');
  const byKey = new Map();
  for (const fact of facts) {
    if (!fact || fact.tenantId !== tenantId) throw new TypeError('TENANT_ISOLATION_VIOLATION');
    const list = byKey.get(fact.key) || [];
    list.push(fact);
    byKey.set(fact.key, list);
  }
  return byKey;
}

function resolveFactForScoring(factsForKey) {
  if (!factsForKey || factsForKey.length === 0) return { state: 'MISSING', fact: null };
  if (factsForKey.some((fact) => fact.status === TENANT_EVIDENCE_STATUS.CONFLICT)) return { state: 'CONFLICT', fact: null };
  const active = factsForKey.filter((fact) => fact.status !== TENANT_EVIDENCE_STATUS.NOT_APPLICABLE);
  if (active.length === 0) return { state: 'NOT_APPLICABLE', fact: factsForKey[0] };
  const scored = active.filter((fact) => fact.score !== null);
  if (scored.length === 0) return { state: 'UNSCORED', fact: active[0] };
  const distinctScores = new Set(scored.map((fact) => fact.score));
  if (distinctScores.size > 1) return { state: 'CONFLICT', fact: null };
  return { state: 'READY', fact: scored[0] };
}

function assessRentAffordability({ tenantId, annualRent, annualRevenue, tenantClass, policy, revenueEvidence = null }) {
  requiredString(tenantId, 'tenantId');
  finiteNumber(annualRent, 'annualRent');
  finiteNumber(annualRevenue, 'annualRevenue');
  if (annualRent < 0) throw new RangeError('annualRent must be >= 0');
  if (annualRevenue <= 0) return freeze({ status: 'HOLD_EVIDENCE', ratio: null, threshold: null, reason: 'VALID_ANNUAL_REVENUE_REQUIRED' });
  if (!tenantClass || !Object.values(TENANT_CLASS).includes(tenantClass)) return freeze({ status: 'HOLD_POLICY', ratio: null, threshold: null, reason: 'SUPPORTED_TENANT_CLASS_REQUIRED' });
  if (!revenueEvidence || revenueEvidence.tenantId !== tenantId) return freeze({ status: 'HOLD_EVIDENCE', ratio: null, threshold: null, reason: 'REVENUE_EVIDENCE_REQUIRED' });
  if ([TENANT_EVIDENCE_STATUS.UNVERIFIED, TENANT_EVIDENCE_STATUS.ASSUMED, TENANT_EVIDENCE_STATUS.CONFLICT].includes(revenueEvidence.status)) return freeze({ status: 'HOLD_EVIDENCE', ratio: null, threshold: null, reason: 'QUALIFIED_REVENUE_EVIDENCE_REQUIRED' });
  const threshold = policy.rentAffordability.classThresholds[tenantClass];
  finiteNumber(threshold, 'rent affordability threshold');
  const ratio = annualRent / annualRevenue;
  return freeze({ status: ratio <= threshold ? 'PASS' : 'FAIL', ratio, threshold, tenantClass, sourceKey: revenueEvidence.key, semantics: 'Rent affordability is an internal analytical ratio based on the supplied reference policy, not a credit rating or legal conclusion.' });
}

function resolveGuaranteeRequirement(annualContractValue, policy) {
  if (annualContractValue === null || annualContractValue === undefined) return freeze({ status: 'NOT_EVALUATED', requirement: null, reason: 'ANNUAL_CONTRACT_VALUE_NOT_PROVIDED' });
  finiteNumber(annualContractValue, 'annualContractValue');
  for (const band of policy.guaranteeRequirementBands) {
    const minOk = band.minAnnualContractValueExclusive !== undefined ? annualContractValue > band.minAnnualContractValueExclusive : annualContractValue >= band.minAnnualContractValue;
    const maxOk = band.maxAnnualContractValue === null || annualContractValue <= band.maxAnnualContractValue;
    if (minOk && maxOk) return freeze({ status: 'MATCHED_REFERENCE_BAND', requirement: band.requirement, sourceLabel: band.sourceLabel });
  }
  return freeze({ status: 'HOLD_POLICY', requirement: null, reason: 'REFERENCE_FORM_DOES_NOT_DEFINE_THIS_VALUE_BAND' });
}

function decisionBandFor60PointReference(rawWeightedPoints, policy) {
  const bands = policy.referenceDecisionBands.financialCapacityExcluded60PointProfile;
  for (const band of bands) if (rawWeightedPoints >= band.min && rawWeightedPoints <= band.max) return band;
  return null;
}

function assessTenant({ tenantId, facts, policy = createTenantPolicyProfile(), annualRent = null, annualRevenue = null, tenantClass = null, annualContractValue = null, revenueEvidenceKey = 'annualRevenue' }) {
  requiredString(tenantId, 'tenantId');
  validatePolicy(policy);
  const byKey = groupFactsByKey(facts, tenantId);
  const evidenceGaps = [];
  const policyGaps = [];
  const conflicts = [];
  const legalReviewFlags = [];
  const axes = [];
  let weightedScore = 0;
  let assessedWeight = 0;

  const financialExcluded = annualRent !== null && annualRent < policy.applicability.financialCapacityMinimumAnnualRent;

  for (const [axisName, axisPolicy] of Object.entries(policy.axes)) {
    if (axisName === AXIS.FINANCIAL_CAPACITY && financialExcluded) {
      axes.push({ axis: axisName, policyWeight: axisPolicy.weight, assessedWeight: 0, weightedPoints: 0, status: 'NOT_APPLICABLE_BY_REFERENCE_POLICY', reason: policy.applicability.belowThresholdFinancialMode, items: [] });
      continue;
    }
    let axisPoints = 0;
    let axisAssessedWeight = 0;
    const itemResults = [];
    for (const item of axisPolicy.items) {
      const resolution = resolveFactForScoring(byKey.get(item.key));
      if (resolution.state === 'MISSING' || resolution.state === 'UNSCORED') {
        if (item.required) evidenceGaps.push({ key: item.key, code: resolution.state === 'MISSING' ? 'REQUIRED_EVIDENCE_MISSING' : 'SCORE_EVIDENCE_MISSING' });
        itemResults.push({ key: item.key, status: resolution.state, weightedPoints: null });
        continue;
      }
      if (resolution.state === 'CONFLICT') {
        conflicts.push({ key: item.key, code: 'UNRESOLVED_CONTRADICTION' });
        itemResults.push({ key: item.key, status: 'CONFLICT', weightedPoints: null });
        continue;
      }
      if (resolution.state === 'NOT_APPLICABLE') {
        itemResults.push({ key: item.key, status: 'NOT_APPLICABLE', weightedPoints: null });
        continue;
      }
      const fact = resolution.fact;
      const points = fact.score * item.weight;
      axisPoints += points;
      axisAssessedWeight += item.weight;
      if (item.legalSensitive && fact.value === true) legalReviewFlags.push({ key: item.key, code: 'LEGAL_INTERPRETATION_REQUIRED' });
      itemResults.push({ key: item.key, status: 'ASSESSED', score: fact.score, weightedPoints: points, sourceRef: fact.sourceRef, observedAt: fact.observedAt });
    }
    weightedScore += axisPoints;
    assessedWeight += axisAssessedWeight;
    axes.push({ axis: axisName, policyWeight: axisPolicy.weight, assessedWeight: axisAssessedWeight, weightedPoints: axisPoints, status: 'ASSESSED', items: itemResults });
  }

  let affordability = null;
  if (annualRent !== null || annualRevenue !== null) {
    if (annualRent === null || annualRevenue === null) {
      affordability = freeze({ status: 'HOLD_EVIDENCE', ratio: null, threshold: null, reason: 'ANNUAL_RENT_AND_REVENUE_REQUIRED_TOGETHER' });
      evidenceGaps.push({ key: 'rentAffordability', code: affordability.reason });
    } else {
      const revenueFacts = byKey.get(revenueEvidenceKey) || [];
      const resolution = resolveFactForScoring(revenueFacts);
      const revenueEvidence = resolution.state === 'READY' ? resolution.fact : revenueFacts[0] || null;
      affordability = assessRentAffordability({ tenantId, annualRent, annualRevenue, tenantClass, policy, revenueEvidence });
      if (affordability.status === 'HOLD_EVIDENCE') evidenceGaps.push({ key: 'rentAffordability', code: affordability.reason });
      if (affordability.status === 'HOLD_POLICY') policyGaps.push({ key: 'rentAffordability', code: affordability.reason });
    }
  }

  const guaranteeRequirement = resolveGuaranteeRequirement(annualContractValue, policy);
  if (guaranteeRequirement.status === 'HOLD_POLICY') policyGaps.push({ key: 'guaranteeRequirement', code: guaranteeRequirement.reason });

  const hasEvidenceHold = evidenceGaps.length > 0 || conflicts.length > 0;
  const normalizedScore = assessedWeight > 0 ? (weightedScore / assessedWeight) * 100 : null;
  let referenceDecisionBand = null;
  let status;

  if (legalReviewFlags.length > 0) status = TENANT_RESULT_STATUS.LEGAL_REVIEW_REQUIRED;
  else if (hasEvidenceHold) status = TENANT_RESULT_STATUS.HOLD_EVIDENCE;
  else if (policyGaps.length > 0) status = TENANT_RESULT_STATUS.HOLD_POLICY;
  else if (affordability && affordability.status === 'FAIL') status = TENANT_RESULT_STATUS.TENANT_HIGH_RISK;
  else if (financialExcluded && assessedWeight === 60) {
    referenceDecisionBand = decisionBandFor60PointReference(weightedScore, policy);
    status = referenceDecisionBand ? TENANT_RESULT_STATUS[referenceDecisionBand.analyticalStatus] : TENANT_RESULT_STATUS.HOLD_POLICY;
  } else {
    status = TENANT_RESULT_STATUS.HOLD_POLICY;
    policyGaps.push({ key: 'decisionBand', code: 'REFERENCE_FORM_DOES_NOT_DEFINE_DECISION_BANDS_FOR_100_POINT_PROFILE' });
  }

  return freeze({ schemaVersion: 1, tenantId: tenantId.trim(), policy: { policyId: policy.policyId, version: policy.version }, financialCapacityApplicability: financialExcluded ? 'EXCLUDED_BY_REFERENCE_POLICY' : 'IN_SCOPE_OR_UNDETERMINED', status, score: normalizedScore, rawWeightedPoints: weightedScore, assessedWeight, referenceDecisionBand: referenceDecisionBand ? { min: referenceDecisionBand.min, max: referenceDecisionBand.max, sourceLabel: referenceDecisionBand.sourceLabel } : null, axes, affordability, guaranteeRequirement, evidenceGaps, policyGaps, conflicts, legalReviewFlags, prohibitedClaims: ['CREDIT_RATING', 'LEGAL_CLEAR', 'APPROVE_TENANT', 'REJECT_TENANT'], semantics: 'Internal tenant-risk analytical indication only. Source decision labels are retained only as provenance metadata and are not emitted as regulated approval/rejection claims.' });
}

module.exports = { TENANT_EVIDENCE_STATUS, TENANT_RESULT_STATUS, AXIS, TENANT_CLASS, DEFAULT_REFERENCE_POLICY, createTenantEvidenceFact, createTenantPolicyProfile, validatePolicy, assessRentAffordability, resolveGuaranteeRequirement, assessTenant };
