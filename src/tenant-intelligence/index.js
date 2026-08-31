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
  LEGAL_REVIEW_REQUIRED: 'LEGAL_REVIEW_REQUIRED',
});

const AXIS = Object.freeze({
  FINANCIAL_CAPACITY: 'FINANCIAL_CAPACITY',
  LEGAL_CREDIT_RECORD: 'LEGAL_CREDIT_RECORD',
  BUSINESS_STABILITY: 'BUSINESS_STABILITY',
  GUARANTEES: 'GUARANTEES',
  SECTOR_RISK: 'SECTOR_RISK',
});

const DEFAULT_REFERENCE_POLICY = Object.freeze({
  policyId: 'TENANT_POLICY_PROFILE_REFERENCE_V1',
  version: 1,
  sourceSemantics: 'Configurable reference profile derived from the supplied tenant-solvency qualification form. It is not a statute, credit rating methodology, or universal Saudi market rule.',
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
    }),
    [AXIS.SECTOR_RISK]: Object.freeze({
      weight: 10,
      items: Object.freeze([
        Object.freeze({ key: 'sectorRisk', weight: 10, required: true }),
      ]),
    }),
  }),
  thresholds: Object.freeze({ favourable: 80, conditional: 65 }),
  rentAffordability: Object.freeze({
    defaultMaxRentToRevenueRatio: 0.10,
    classThresholds: Object.freeze({}),
  }),
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

function createTenantEvidenceFact({
  tenantId,
  key,
  value = null,
  score = null,
  status,
  sourceType,
  sourceRef = null,
  observedAt = null,
  note = null,
}) {
  requiredString(tenantId, 'tenantId');
  requiredString(key, 'key');
  if (!Object.values(TENANT_EVIDENCE_STATUS).includes(status)) throw new TypeError(`invalid tenant evidence status: ${status}`);
  requiredString(sourceType, 'sourceType');
  if (score !== null) boundedScore(score, 'score');
  if (sourceRef !== null) requiredString(sourceRef, 'sourceRef');
  if (observedAt !== null) requiredString(observedAt, 'observedAt');
  if (note !== null && typeof note !== 'string') throw new TypeError('note must be a string or null');
  return freeze({
    schemaVersion: 1,
    tenantId: tenantId.trim(),
    key: key.trim(),
    value,
    score,
    status,
    sourceType: sourceType.trim(),
    sourceRef: sourceRef ? sourceRef.trim() : null,
    observedAt: observedAt ? observedAt.trim() : null,
    note: note ? note.trim() : null,
  });
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
  if (!policy.thresholds || typeof policy.thresholds !== 'object') throw new TypeError('policy.thresholds is required');
  finiteNumber(policy.thresholds.favourable, 'thresholds.favourable');
  finiteNumber(policy.thresholds.conditional, 'thresholds.conditional');
  if (policy.thresholds.favourable <= policy.thresholds.conditional) throw new Error('favourable threshold must exceed conditional threshold');
  return policy;
}

function createTenantPolicyProfile(overrides = {}) {
  const base = DEFAULT_REFERENCE_POLICY;
  const axes = {};
  for (const axisName of Object.values(AXIS)) {
    const source = (overrides.axes && overrides.axes[axisName]) || base.axes[axisName];
    axes[axisName] = {
      weight: source.weight,
      items: source.items.map((item) => ({ ...item })),
    };
  }
  const profile = {
    policyId: overrides.policyId || base.policyId,
    version: overrides.version || base.version,
    sourceSemantics: overrides.sourceSemantics || base.sourceSemantics,
    axes,
    thresholds: { ...base.thresholds, ...(overrides.thresholds || {}) },
    rentAffordability: {
      defaultMaxRentToRevenueRatio: base.rentAffordability.defaultMaxRentToRevenueRatio,
      classThresholds: { ...base.rentAffordability.classThresholds },
      ...(overrides.rentAffordability || {}),
      classThresholds: {
        ...base.rentAffordability.classThresholds,
        ...((overrides.rentAffordability && overrides.rentAffordability.classThresholds) || {}),
      },
    },
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

function resolveFactForScoring(key, factsForKey) {
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

function assessRentAffordability({ tenantId, annualRent, annualRevenue, tenantClass = null, policy, revenueEvidence = null }) {
  requiredString(tenantId, 'tenantId');
  finiteNumber(annualRent, 'annualRent');
  finiteNumber(annualRevenue, 'annualRevenue');
  if (annualRent < 0) throw new RangeError('annualRent must be >= 0');
  if (annualRevenue <= 0) return freeze({ status: 'HOLD_EVIDENCE', ratio: null, threshold: null, reason: 'VALID_ANNUAL_REVENUE_REQUIRED' });
  if (!revenueEvidence || revenueEvidence.tenantId !== tenantId) return freeze({ status: 'HOLD_EVIDENCE', ratio: null, threshold: null, reason: 'REVENUE_EVIDENCE_REQUIRED' });
  if ([TENANT_EVIDENCE_STATUS.UNVERIFIED, TENANT_EVIDENCE_STATUS.ASSUMED, TENANT_EVIDENCE_STATUS.CONFLICT].includes(revenueEvidence.status)) {
    return freeze({ status: 'HOLD_EVIDENCE', ratio: null, threshold: null, reason: 'QUALIFIED_REVENUE_EVIDENCE_REQUIRED' });
  }
  const classThreshold = tenantClass && policy.rentAffordability.classThresholds[tenantClass];
  const threshold = classThreshold === undefined ? policy.rentAffordability.defaultMaxRentToRevenueRatio : classThreshold;
  finiteNumber(threshold, 'rent affordability threshold');
  const ratio = annualRent / annualRevenue;
  return freeze({
    status: ratio <= threshold ? 'PASS' : 'FAIL',
    ratio,
    threshold,
    tenantClass,
    sourceKey: revenueEvidence.key,
    semantics: 'Rent affordability is an internal analytical ratio, not a credit rating or legal conclusion.',
  });
}

function assessTenant({
  tenantId,
  facts,
  policy = createTenantPolicyProfile(),
  annualRent = null,
  annualRevenue = null,
  tenantClass = null,
  revenueEvidenceKey = 'annualRevenue',
}) {
  requiredString(tenantId, 'tenantId');
  validatePolicy(policy);
  const byKey = groupFactsByKey(facts, tenantId);
  const evidenceGaps = [];
  const conflicts = [];
  const legalReviewFlags = [];
  const axes = [];
  let weightedScore = 0;
  let assessedWeight = 0;

  for (const [axisName, axisPolicy] of Object.entries(policy.axes)) {
    let axisPoints = 0;
    let axisAssessedWeight = 0;
    const itemResults = [];
    for (const item of axisPolicy.items) {
      const resolution = resolveFactForScoring(item.key, byKey.get(item.key));
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
    axes.push({ axis: axisName, policyWeight: axisPolicy.weight, assessedWeight: axisAssessedWeight, weightedPoints: axisPoints, items: itemResults });
  }

  let affordability = null;
  if (annualRent !== null || annualRevenue !== null) {
    if (annualRent === null || annualRevenue === null) {
      affordability = freeze({ status: 'HOLD_EVIDENCE', ratio: null, threshold: null, reason: 'ANNUAL_RENT_AND_REVENUE_REQUIRED_TOGETHER' });
      evidenceGaps.push({ key: 'rentAffordability', code: 'ANNUAL_RENT_AND_REVENUE_REQUIRED_TOGETHER' });
    } else {
      const revenueFactResolution = resolveFactForScoring(revenueEvidenceKey, byKey.get(revenueEvidenceKey));
      const revenueEvidence = revenueFactResolution.state === 'READY' ? revenueFactResolution.fact : (byKey.get(revenueEvidenceKey) || [])[0] || null;
      affordability = assessRentAffordability({ tenantId, annualRent, annualRevenue, tenantClass, policy, revenueEvidence });
      if (affordability.status === 'HOLD_EVIDENCE') evidenceGaps.push({ key: 'rentAffordability', code: affordability.reason });
    }
  }

  const hasHold = evidenceGaps.length > 0 || conflicts.length > 0;
  const normalizedScore = assessedWeight > 0 ? (weightedScore / assessedWeight) * 100 : null;
  let status;
  if (legalReviewFlags.length > 0) status = TENANT_RESULT_STATUS.LEGAL_REVIEW_REQUIRED;
  else if (hasHold) status = TENANT_RESULT_STATUS.HOLD_EVIDENCE;
  else if (affordability && affordability.status === 'FAIL') status = TENANT_RESULT_STATUS.TENANT_HIGH_RISK;
  else if (normalizedScore >= policy.thresholds.favourable) status = TENANT_RESULT_STATUS.TENANT_ANALYTICAL_FAVOURABLE;
  else if (normalizedScore >= policy.thresholds.conditional) status = TENANT_RESULT_STATUS.TENANT_ANALYTICAL_CONDITIONAL;
  else status = TENANT_RESULT_STATUS.TENANT_HIGH_RISK;

  return freeze({
    schemaVersion: 1,
    tenantId: tenantId.trim(),
    policy: { policyId: policy.policyId, version: policy.version },
    status,
    score: normalizedScore,
    rawWeightedPoints: weightedScore,
    assessedWeight,
    axes,
    affordability,
    evidenceGaps,
    conflicts,
    legalReviewFlags,
    prohibitedClaims: ['CREDIT_RATING', 'LEGAL_CLEAR', 'APPROVE_TENANT', 'REJECT_TENANT'],
    semantics: 'Internal tenant-risk analytical indication only. It is not a credit rating, legal opinion, or regulated tenant approval/rejection.',
  });
}

module.exports = {
  TENANT_EVIDENCE_STATUS,
  TENANT_RESULT_STATUS,
  AXIS,
  DEFAULT_REFERENCE_POLICY,
  createTenantEvidenceFact,
  createTenantPolicyProfile,
  validatePolicy,
  assessRentAffordability,
  assessTenant,
};
