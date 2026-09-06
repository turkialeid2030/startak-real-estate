'use strict';

const {
  DECISION_SUPPORT_OUTPUT_TYPE,
  EXTERNAL_DECISION_LABEL,
  createDecisionSupportEnvelope,
} = require('../compliance/decision-support');

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

const SCORING_ELIGIBLE_EVIDENCE_STATUSES = Object.freeze([
  TENANT_EVIDENCE_STATUS.VERIFIED,
  TENANT_EVIDENCE_STATUS.OBSERVED,
]);

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

function validEvidenceDate(value) {
  return typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Date.parse(value));
}

function stableValue(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableValue(value[key])}`).join(',')}}`;
}

function factOrderKey(fact) {
  return [
    fact.sourceType || '',
    fact.sourceRef || '',
    fact.observedAt || '',
    fact.status || '',
    fact.score === null || fact.score === undefined ? '' : String(fact.score),
    stableValue(fact.value),
  ].join('\u0000');
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
  provenance = [],
}) {
  requiredString(tenantId, 'tenantId');
  requiredString(key, 'key');
  if (!Object.values(TENANT_EVIDENCE_STATUS).includes(status)) throw new TypeError(`invalid tenant evidence status: ${status}`);
  requiredString(sourceType, 'sourceType');
  if (score !== null) boundedScore(score, 'score');
  if (sourceRef !== null) requiredString(sourceRef, 'sourceRef');
  if (observedAt !== null) requiredString(observedAt, 'observedAt');
  if (note !== null && typeof note !== 'string') throw new TypeError('note must be a string or null');
  if (!Array.isArray(provenance) || provenance.some((entry) => !entry || typeof entry !== 'object' || Array.isArray(entry))) {
    throw new TypeError('provenance must be an array of objects');
  }
  return freeze({
    schemaVersion: 2,
    tenantId: tenantId.trim(),
    key: key.trim(),
    value,
    score,
    status,
    sourceType: sourceType.trim(),
    sourceRef: sourceRef ? sourceRef.trim() : null,
    observedAt: observedAt ? observedAt.trim() : null,
    note: note ? note.trim() : null,
    provenance: provenance.map((entry) => ({ ...entry })),
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

function contradictionExists(facts) {
  if (facts.some((fact) => fact.status === TENANT_EVIDENCE_STATUS.CONFLICT)) return true;
  const active = facts.filter((fact) => fact.status !== TENANT_EVIDENCE_STATUS.NOT_APPLICABLE);
  if (active.length <= 1) return false;
  const distinctValues = new Set(active.map((fact) => stableValue(fact.value)));
  if (distinctValues.size > 1) return true;
  const scored = active.filter((fact) => fact.score !== null && fact.score !== undefined);
  return new Set(scored.map((fact) => fact.score)).size > 1;
}

function evidenceQualificationIssue(fact) {
  if (!SCORING_ELIGIBLE_EVIDENCE_STATUSES.includes(fact.status)) return 'EVIDENCE_STATUS_NOT_QUALIFIED';
  if (typeof fact.sourceRef !== 'string' || fact.sourceRef.trim() === '') return 'EVIDENCE_PROVENANCE_REQUIRED';
  if (!validEvidenceDate(fact.observedAt)) return 'EVIDENCE_DATE_REQUIRED';
  return null;
}

function resolveFactForEvidence(factsForKey) {
  if (!factsForKey || factsForKey.length === 0) return { state: 'MISSING', fact: null, candidates: [], reason: 'REQUIRED_EVIDENCE_MISSING' };
  if (contradictionExists(factsForKey)) return { state: 'CONFLICT', fact: null, candidates: [], reason: 'UNRESOLVED_CONTRADICTION' };
  const active = factsForKey.filter((fact) => fact.status !== TENANT_EVIDENCE_STATUS.NOT_APPLICABLE);
  if (active.length === 0) {
    return { state: 'POLICY_NA_REQUIRED', fact: null, candidates: [], reason: 'EXPLICIT_POLICY_RULE_REQUIRED_FOR_NOT_APPLICABLE' };
  }
  const ordered = [...active].sort((a, b) => factOrderKey(a).localeCompare(factOrderKey(b), 'en'));
  const eligible = ordered.filter((fact) => evidenceQualificationIssue(fact) === null);
  if (eligible.length === 0) {
    const reason = evidenceQualificationIssue(ordered[0]) || 'QUALIFIED_EVIDENCE_REQUIRED';
    return { state: 'UNQUALIFIED_EVIDENCE', fact: null, candidates: [], reason };
  }
  return { state: 'READY', fact: eligible[0], candidates: eligible, reason: null };
}

function resolveFactForScoring(factsForKey) {
  const evidence = resolveFactForEvidence(factsForKey);
  if (evidence.state !== 'READY') return evidence;
  const scored = evidence.candidates.filter((fact) => fact.score !== null && fact.score !== undefined);
  if (scored.length === 0) return { state: 'UNSCORED', fact: evidence.fact, candidates: evidence.candidates, reason: 'SCORE_EVIDENCE_MISSING' };
  const distinctScores = new Set(scored.map((fact) => fact.score));
  if (distinctScores.size > 1) return { state: 'CONFLICT', fact: null, candidates: scored, reason: 'UNRESOLVED_SCORE_CONTRADICTION' };
  return { state: 'READY', fact: scored[0], candidates: scored, reason: null };
}

function assessRentAffordability({ tenantId, annualRent, annualRevenue, tenantClass, policy, revenueEvidence = null }) {
  requiredString(tenantId, 'tenantId');
  finiteNumber(annualRent, 'annualRent');
  finiteNumber(annualRevenue, 'annualRevenue');
  if (annualRent < 0) throw new RangeError('annualRent must be >= 0');
  if (annualRevenue <= 0) return freeze({ status: 'HOLD_EVIDENCE', ratio: null, threshold: null, reason: 'VALID_ANNUAL_REVENUE_REQUIRED' });
  if (!tenantClass || !Object.values(TENANT_CLASS).includes(tenantClass)) return freeze({ status: 'HOLD_POLICY', ratio: null, threshold: null, reason: 'SUPPORTED_TENANT_CLASS_REQUIRED' });
  if (!revenueEvidence || revenueEvidence.tenantId !== tenantId) return freeze({ status: 'HOLD_EVIDENCE', ratio: null, threshold: null, reason: 'REVENUE_EVIDENCE_REQUIRED' });
  const evidenceIssue = evidenceQualificationIssue(revenueEvidence);
  if (evidenceIssue) return freeze({ status: 'HOLD_EVIDENCE', ratio: null, threshold: null, reason: evidenceIssue });
  const evidencedRevenue = typeof revenueEvidence.value === 'number' ? revenueEvidence.value : Number(revenueEvidence.value);
  if (!Number.isFinite(evidencedRevenue) || evidencedRevenue <= 0) {
    return freeze({ status: 'HOLD_EVIDENCE', ratio: null, threshold: null, reason: 'VALID_SOURCE_PROVEN_ANNUAL_REVENUE_REQUIRED' });
  }
  if (Math.abs(evidencedRevenue - annualRevenue) > Math.max(1e-9, Math.abs(annualRevenue) * 1e-12)) {
    return freeze({ status: 'HOLD_EVIDENCE', ratio: null, threshold: null, reason: 'ANNUAL_REVENUE_EVIDENCE_VALUE_MISMATCH' });
  }
  const threshold = policy.rentAffordability.classThresholds[tenantClass];
  finiteNumber(threshold, 'rent affordability threshold');
  const ratio = annualRent / annualRevenue;
  return freeze({
    status: ratio <= threshold ? 'PASS' : 'FAIL',
    ratio,
    threshold,
    tenantClass,
    sourceKey: revenueEvidence.key,
    sourceRef: revenueEvidence.sourceRef,
    observedAt: revenueEvidence.observedAt,
    semantics: 'Rent affordability is an internal analytical ratio based on source-proven revenue and the supplied reference policy, not a credit rating or legal conclusion.',
  });
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

function latestObservedAt(evidence) {
  const valid = evidence.map((item) => item && item.capturedAt).filter(validEvidenceDate).sort();
  return valid.length ? valid[valid.length - 1] : null;
}

function universalEvidenceProvenance(evidence) {
  return evidence.map((item) => ({
    caseId: item.caseId || null,
    factId: item.factId || null,
    documentId: item.documentId || null,
    documentHashSha256: item.documentHashSha256 || null,
    documentType: item.documentType || null,
    authorityClass: item.authorityClass || null,
    authorityVerified: Boolean(item.authorityVerified),
    verificationStatus: item.verificationStatus || null,
    verificationReference: item.verificationReference || null,
    verifiedAt: item.verifiedAt || null,
    capturedAt: item.capturedAt || null,
    sourceLocator: item.sourceLocator || null,
    normalizedValue: item.normalizedValue,
    unit: item.unit || null,
  }));
}

function createTenantFactsFromUniversalEvidence({ tenantId, orchestration, keyMap }) {
  requiredString(tenantId, 'tenantId');
  if (!orchestration || typeof orchestration !== 'object' || !Array.isArray(orchestration.reconciliations)) {
    throw new TypeError('qualified universal evidence orchestration result is required');
  }
  if (!keyMap || typeof keyMap !== 'object' || Array.isArray(keyMap) || Object.keys(keyMap).length === 0) {
    throw new TypeError('keyMap must explicitly map tenant policy keys to universal semantic keys');
  }

  const reconciliations = new Map(orchestration.reconciliations.map((item) => [item.key, item]));
  const facts = [];
  const gaps = [];
  const conflicts = [];

  for (const tenantKey of Object.keys(keyMap).sort()) {
    requiredString(tenantKey, 'tenant policy key');
    const semanticKey = requiredString(keyMap[tenantKey], `keyMap.${tenantKey}`);
    const reconciliation = reconciliations.get(semanticKey);
    if (!reconciliation || reconciliation.status === 'MISSING') {
      gaps.push({ tenantKey, semanticKey, code: 'UNIVERSAL_EVIDENCE_MISSING' });
      continue;
    }

    const evidence = Array.isArray(reconciliation.evidence) ? reconciliation.evidence : [];
    const provenance = universalEvidenceProvenance(evidence);
    const sourceIds = evidence
      .map((item) => item && (item.factId || item.documentId))
      .filter(Boolean)
      .sort();
    const sourceRef = sourceIds.length
      ? `UNIVERSAL:${orchestration.caseId || 'UNKNOWN'}:${semanticKey}:${sourceIds.join('|')}`
      : `UNIVERSAL:${orchestration.caseId || 'UNKNOWN'}:${semanticKey}`;

    const isConflict = ['CONFLICT', 'UNIT_MISMATCH'].includes(reconciliation.status);
    if (isConflict) conflicts.push({ tenantKey, semanticKey, code: `UNIVERSAL_${reconciliation.status}` });
    const allVerified = evidence.length > 0 && evidence.every((item) => item.verificationStatus === 'VERIFIED');

    facts.push(createTenantEvidenceFact({
      tenantId,
      key: tenantKey,
      value: isConflict ? null : reconciliation.consensusValue,
      score: null,
      status: isConflict
        ? TENANT_EVIDENCE_STATUS.CONFLICT
        : allVerified
          ? TENANT_EVIDENCE_STATUS.VERIFIED
          : TENANT_EVIDENCE_STATUS.UNVERIFIED,
      sourceType: 'UNIVERSAL_EVIDENCE_ORCHESTRATOR',
      sourceRef,
      observedAt: latestObservedAt(evidence),
      note: 'FACT extraction only. No tenant policy score was inferred from universal evidence.',
      provenance,
    }));
  }

  return freeze({
    schemaVersion: 1,
    tenantId: tenantId.trim(),
    caseId: orchestration.caseId || null,
    facts,
    gaps,
    conflicts,
    transactionAuthorized: false,
    semantics: 'Universal Evidence integration preserves source provenance and contradictions. It does not manufacture tenant policy scores or regulated credit conclusions.',
  });
}

function assessTenant({
  tenantId,
  facts,
  policy = createTenantPolicyProfile(),
  annualRent = null,
  annualRevenue = null,
  tenantClass = null,
  annualContractValue = null,
  revenueEvidenceKey = 'annualRevenue',
}) {
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
      axes.push({
        axis: axisName,
        policyWeight: axisPolicy.weight,
        assessedWeight: 0,
        weightedPoints: 0,
        status: 'NOT_APPLICABLE_BY_REFERENCE_POLICY',
        reason: policy.applicability.belowThresholdFinancialMode,
        items: [],
      });
      continue;
    }

    let axisPoints = 0;
    let axisAssessedWeight = 0;
    const itemResults = [];

    for (const item of axisPolicy.items) {
      const resolution = resolveFactForScoring(byKey.get(item.key));
      if (resolution.state === 'CONFLICT') {
        conflicts.push({ key: item.key, code: resolution.reason || 'UNRESOLVED_CONTRADICTION' });
        itemResults.push({ key: item.key, status: 'CONFLICT', weightedPoints: null });
        continue;
      }
      if (resolution.state === 'POLICY_NA_REQUIRED') {
        policyGaps.push({ key: item.key, code: resolution.reason });
        itemResults.push({ key: item.key, status: 'HOLD_POLICY', weightedPoints: null, reason: resolution.reason });
        continue;
      }
      if (resolution.state !== 'READY') {
        if (item.required) evidenceGaps.push({ key: item.key, code: resolution.reason || 'REQUIRED_EVIDENCE_MISSING' });
        itemResults.push({ key: item.key, status: resolution.state, weightedPoints: null, reason: resolution.reason || null });
        continue;
      }

      const fact = resolution.fact;
      const points = fact.score * item.weight;
      axisPoints += points;
      axisAssessedWeight += item.weight;
      if (item.legalSensitive && fact.value === true) legalReviewFlags.push({ key: item.key, code: 'LEGAL_INTERPRETATION_REQUIRED' });
      itemResults.push({
        key: item.key,
        status: 'ASSESSED',
        evidenceStatus: fact.status,
        score: fact.score,
        weightedPoints: points,
        sourceType: fact.sourceType,
        sourceRef: fact.sourceRef,
        observedAt: fact.observedAt,
        provenance: fact.provenance || [],
      });
    }

    weightedScore += axisPoints;
    assessedWeight += axisAssessedWeight;
    axes.push({
      axis: axisName,
      policyWeight: axisPolicy.weight,
      assessedWeight: axisAssessedWeight,
      weightedPoints: axisPoints,
      status: axisAssessedWeight === axisPolicy.weight ? 'ASSESSED' : 'PARTIAL_HOLD',
      items: itemResults,
    });
  }

  let affordability = null;
  if (annualRent !== null || annualRevenue !== null) {
    if (annualRent === null || annualRevenue === null) {
      affordability = freeze({ status: 'HOLD_EVIDENCE', ratio: null, threshold: null, reason: 'ANNUAL_RENT_AND_REVENUE_REQUIRED_TOGETHER' });
      evidenceGaps.push({ key: 'rentAffordability', code: affordability.reason });
    } else {
      const revenueFacts = byKey.get(revenueEvidenceKey) || [];
      const resolution = resolveFactForEvidence(revenueFacts);
      const revenueEvidence = resolution.state === 'READY' ? resolution.fact : null;
      if (resolution.state === 'CONFLICT') {
        conflicts.push({ key: revenueEvidenceKey, code: resolution.reason || 'UNRESOLVED_CONTRADICTION' });
      }
      if (resolution.state === 'POLICY_NA_REQUIRED') {
        policyGaps.push({ key: 'rentAffordability', code: resolution.reason });
        affordability = freeze({ status: 'HOLD_POLICY', ratio: null, threshold: null, reason: resolution.reason });
      } else if (resolution.state !== 'READY') {
        affordability = freeze({ status: 'HOLD_EVIDENCE', ratio: null, threshold: null, reason: resolution.reason || 'QUALIFIED_REVENUE_EVIDENCE_REQUIRED' });
        evidenceGaps.push({ key: 'rentAffordability', code: affordability.reason });
      } else {
        affordability = assessRentAffordability({ tenantId, annualRent, annualRevenue, tenantClass, policy, revenueEvidence });
        if (affordability.status === 'HOLD_EVIDENCE') evidenceGaps.push({ key: 'rentAffordability', code: affordability.reason });
        if (affordability.status === 'HOLD_POLICY') policyGaps.push({ key: 'rentAffordability', code: affordability.reason });
      }
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

  return freeze({
    schemaVersion: 2,
    tenantId: tenantId.trim(),
    outputType: 'TENANT_ANALYTICAL_SCREENING',
    policy: { policyId: policy.policyId, version: policy.version },
    financialCapacityApplicability: financialExcluded ? 'EXCLUDED_BY_REFERENCE_POLICY' : 'IN_SCOPE_OR_UNDETERMINED',
    status,
    score: normalizedScore,
    scoreBasis: 'NORMALIZED_ASSESSED_WEIGHT_INFORMATIONAL_ONLY',
    rawWeightedPoints: weightedScore,
    assessedWeight,
    policyDecisionBasis: 'RAW_WEIGHTED_POINTS_NO_RENORMALIZATION',
    referenceDecisionBand: referenceDecisionBand
      ? { min: referenceDecisionBand.min, max: referenceDecisionBand.max, sourceLabel: referenceDecisionBand.sourceLabel }
      : null,
    axes,
    affordability,
    guaranteeRequirement,
    evidenceGaps,
    policyGaps,
    conflicts,
    legalReviewFlags,
    prohibitedClaims: ['CREDIT_RATING', 'LEGAL_CLEAR', 'APPROVE_TENANT', 'REJECT_TENANT'],
    certifiedCreditRating: false,
    legalOpinionEstablished: false,
    transactionAuthorized: false,
    semantics: 'Internal tenant-risk analytical indication only. Source decision labels are retained only as provenance metadata and are not emitted as regulated approval/rejection claims.',
  });
}

function createTenantDecisionSupportEnvelope(result, { locale = 'ar' } = {}) {
  if (!result || typeof result !== 'object' || !Object.values(TENANT_RESULT_STATUS).includes(result.status)) {
    throw new TypeError('qualified tenant decision-support result is required');
  }
  const labelByStatus = {
    [TENANT_RESULT_STATUS.TENANT_ANALYTICAL_FAVOURABLE]: EXTERNAL_DECISION_LABEL.FAVOURABLE_ANALYTICAL_CASE,
    [TENANT_RESULT_STATUS.TENANT_ANALYTICAL_CONDITIONAL]: EXTERNAL_DECISION_LABEL.CONDITIONAL,
    [TENANT_RESULT_STATUS.TENANT_HIGH_RISK]: EXTERNAL_DECISION_LABEL.HIGH_RISK,
    [TENANT_RESULT_STATUS.HOLD_EVIDENCE]: EXTERNAL_DECISION_LABEL.HOLD_EVIDENCE,
    [TENANT_RESULT_STATUS.HOLD_POLICY]: EXTERNAL_DECISION_LABEL.INCOMPLETE_INPUTS,
    [TENANT_RESULT_STATUS.LEGAL_REVIEW_REQUIRED]: EXTERNAL_DECISION_LABEL.REQUIRES_LICENSED_REVIEW,
  };
  const evidenceProvenance = (result.axes || []).flatMap((axis) =>
    (axis.items || [])
      .filter((item) => item && item.sourceRef)
      .map((item) => ({
        source: item.sourceRef,
        sourceDate: item.observedAt,
        extractionMethod: item.sourceType,
        qualificationStatus: item.evidenceStatus || item.status,
        contradictionState: item.status === 'CONFLICT' ? 'CONFLICT' : null,
      }))
  );
  const gaps = [
    ...(result.evidenceGaps || []).map((item) => `${item.key}:${item.code}`),
    ...(result.policyGaps || []).map((item) => `${item.key}:${item.code}`),
    ...(result.conflicts || []).map((item) => `${item.key}:${item.code}`),
  ];
  const licensedReviewRequired = result.status === TENANT_RESULT_STATUS.LEGAL_REVIEW_REQUIRED;
  return createDecisionSupportEnvelope({
    analyticalLabel: labelByStatus[result.status],
    locale,
    assumptions: [`Tenant policy ${result.policy.policyId} v${result.policy.version}`],
    evidenceGaps: gaps,
    evidenceProvenance,
    licensedReviewRequired,
    outputType: licensedReviewRequired
      ? DECISION_SUPPORT_OUTPUT_TYPE.REQUIRES_LICENSED_REVIEW
      : DECISION_SUPPORT_OUTPUT_TYPE.SCREENING_RESULT,
  });
}

module.exports = {
  TENANT_EVIDENCE_STATUS,
  TENANT_RESULT_STATUS,
  AXIS,
  TENANT_CLASS,
  DEFAULT_REFERENCE_POLICY,
  createTenantEvidenceFact,
  createTenantPolicyProfile,
  validatePolicy,
  assessRentAffordability,
  resolveGuaranteeRequirement,
  createTenantFactsFromUniversalEvidence,
  assessTenant,
  createTenantDecisionSupportEnvelope,
};
