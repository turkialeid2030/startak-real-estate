'use strict';

const PROFESSIONAL_TYPE = Object.freeze({
  LEGAL: 'LEGAL',
  LICENSED_APPRAISER: 'LICENSED_APPRAISER',
  STRUCTURAL_ENGINEER: 'STRUCTURAL_ENGINEER',
  GEOTECHNICAL_ENGINEER: 'GEOTECHNICAL_ENGINEER',
  ENVIRONMENTAL_SPECIALIST: 'ENVIRONMENTAL_SPECIALIST',
  TAX_SPECIALIST: 'TAX_SPECIALIST',
  ACCOUNTANT: 'ACCOUNTANT',
  FIRE_LIFE_SAFETY: 'FIRE_LIFE_SAFETY',
  SURVEYOR: 'SURVEYOR',
});

const REVIEW_MATRIX_STATUS = Object.freeze({
  CLEAR_ANALYTICAL: 'CLEAR_ANALYTICAL',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  HOLD_EVIDENCE: 'HOLD_EVIDENCE',
});

function assertNonEmpty(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`);
}

function normalizeEvidenceRefs(refs) {
  if (refs == null) return Object.freeze([]);
  if (!Array.isArray(refs)) throw new TypeError('evidenceRefs must be an array');
  return Object.freeze(refs.map((x) => String(x)));
}

function createProfessionalReviewRule({
  ruleId,
  signalKey,
  triggerValues,
  professionalType,
  rationale,
  requiredSignal = true,
  evidenceRefs = [],
  sourceRef = null,
}) {
  assertNonEmpty(ruleId, 'ruleId');
  assertNonEmpty(signalKey, 'signalKey');
  assertNonEmpty(rationale, 'rationale');
  if (!Object.values(PROFESSIONAL_TYPE).includes(professionalType)) {
    throw new TypeError(`Unsupported professionalType: ${professionalType}`);
  }
  if (!Array.isArray(triggerValues) || triggerValues.length === 0) {
    throw new TypeError('triggerValues must be a non-empty array');
  }
  return Object.freeze({
    ruleId,
    signalKey,
    triggerValues: Object.freeze(triggerValues.map((x) => String(x))),
    professionalType,
    rationale,
    requiredSignal: Boolean(requiredSignal),
    evidenceRefs: normalizeEvidenceRefs(evidenceRefs),
    sourceRef: sourceRef == null ? null : String(sourceRef),
  });
}

function evaluateProfessionalReviewNeeds({ caseId, projectId, signals = {}, rules = [] }) {
  assertNonEmpty(caseId, 'caseId');
  assertNonEmpty(projectId, 'projectId');
  if (!signals || typeof signals !== 'object' || Array.isArray(signals)) throw new TypeError('signals must be an object');
  if (!Array.isArray(rules)) throw new TypeError('rules must be an array');

  const missingSignals = [];
  const triggered = [];

  for (const rule of rules) {
    const normalizedRule = Object.isFrozen(rule) ? rule : createProfessionalReviewRule(rule);
    const hasSignal = Object.prototype.hasOwnProperty.call(signals, normalizedRule.signalKey);
    if (!hasSignal) {
      if (normalizedRule.requiredSignal) missingSignals.push(normalizedRule.signalKey);
      continue;
    }
    const value = String(signals[normalizedRule.signalKey]);
    if (normalizedRule.triggerValues.includes(value)) {
      triggered.push(Object.freeze({
        ruleId: normalizedRule.ruleId,
        professionalType: normalizedRule.professionalType,
        signalKey: normalizedRule.signalKey,
        signalValue: value,
        rationale: normalizedRule.rationale,
        evidenceRefs: normalizedRule.evidenceRefs,
        sourceRef: normalizedRule.sourceRef,
      }));
    }
  }

  const uniqueMissing = Object.freeze([...new Set(missingSignals)].sort());
  const professionals = Object.freeze([...new Set(triggered.map((x) => x.professionalType))].sort());
  let status = REVIEW_MATRIX_STATUS.CLEAR_ANALYTICAL;
  if (uniqueMissing.length) status = REVIEW_MATRIX_STATUS.HOLD_EVIDENCE;
  else if (triggered.length) status = REVIEW_MATRIX_STATUS.REVIEW_REQUIRED;

  return Object.freeze({
    schemaVersion: 1,
    caseId,
    projectId,
    status,
    missingSignals: uniqueMissing,
    triggeredReviews: Object.freeze(triggered),
    requiredProfessionalTypes: professionals,
    canIssueProfessionalOpinion: false,
    transactionAuthorized: false,
    semantics: 'This matrix only routes identified analytical triggers to appropriate professional review. It does not provide legal, valuation, engineering, tax, accounting, environmental, fire-safety, surveying, or other licensed professional opinions.',
  });
}

module.exports = {
  PROFESSIONAL_TYPE,
  REVIEW_MATRIX_STATUS,
  createProfessionalReviewRule,
  evaluateProfessionalReviewNeeds,
};
