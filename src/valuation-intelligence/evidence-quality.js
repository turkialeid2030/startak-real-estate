'use strict';

const {
  EVIDENCE_GRADE,
  EVIDENCE_GRADE_ORDER,
  INPUT_STATUS,
  weakestEvidenceGrade,
} = require('./contracts');

const QUALITY_STATUS = Object.freeze({
  UNRATED_POLICY_REQUIRED: 'UNRATED_POLICY_REQUIRED',
  QUALIFIED: 'QUALIFIED',
  HOLD_CONFLICT: 'HOLD_CONFLICT',
  HOLD_CRITICAL_FACT: 'HOLD_CRITICAL_FACT',
  HOLD_MIN_EVIDENCE: 'HOLD_MIN_EVIDENCE',
  HOLD_ASSUMPTION_BURDEN: 'HOLD_ASSUMPTION_BURDEN',
  HOLD_LOW_GRADE_BURDEN: 'HOLD_LOW_GRADE_BURDEN',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function validateEvidence(evidence) {
  if (!Array.isArray(evidence)) throw new TypeError('evidence must be an array');
  for (const [index, item] of evidence.entries()) {
    if (!item || typeof item !== 'object') throw new TypeError(`evidence[${index}] must be an object`);
    if (typeof item.field !== 'string' || item.field.trim() === '') throw new TypeError(`evidence[${index}].field is required`);
    if (!Object.values(EVIDENCE_GRADE).includes(item.grade)) throw new TypeError(`evidence[${index}].grade is invalid`);
    if (!Object.values(INPUT_STATUS).includes(item.status)) throw new TypeError(`evidence[${index}].status is invalid`);
  }
}

function profileEvidence(evidence) {
  validateEvidence(evidence);
  const total = evidence.length;
  const byGrade = Object.fromEntries(Object.values(EVIDENCE_GRADE).map((grade) => [grade, 0]));
  const byStatus = Object.fromEntries(Object.values(INPUT_STATUS).map((status) => [status, 0]));
  for (const item of evidence) {
    byGrade[item.grade] += 1;
    byStatus[item.status] += 1;
  }

  const assumptionCount = byStatus[INPUT_STATUS.ASSUMED] + byStatus[INPUT_STATUS.UNVERIFIED];
  const lowGradeCount = byGrade[EVIDENCE_GRADE.G_EXPERT_ASSUMPTION] + byGrade[EVIDENCE_GRADE.H_CLIENT_SUPPLIED_UNVERIFIED];
  const conflictFields = [...new Set(evidence.filter((item) => item.status === INPUT_STATUS.CONFLICT).map((item) => item.field))];
  const assumptionFields = [...new Set(evidence.filter((item) => [INPUT_STATUS.ASSUMED, INPUT_STATUS.UNVERIFIED].includes(item.status)).map((item) => item.field))];

  return deepFreeze({
    total,
    byGrade,
    byStatus,
    assumptionCount,
    assumptionBurdenRatio: total === 0 ? 0 : assumptionCount / total,
    lowGradeCount,
    lowGradeRatio: total === 0 ? 0 : lowGradeCount / total,
    conflictFields,
    assumptionFields,
    weakestEvidenceGrade: weakestEvidenceGrade(evidence),
    semantics: 'Ratios are descriptive evidence-burden measures, not statistical confidence probabilities.',
  });
}

function validateRatio(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new TypeError(`${field} must be in [0,1]`);
  }
}

function validatePolicy(policy) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) throw new TypeError('policy must be an object');
  if (!Number.isInteger(policy.minEvidenceCount) || policy.minEvidenceCount < 1) throw new TypeError('policy.minEvidenceCount must be an integer >= 1');
  validateRatio(policy.maxAssumptionBurdenRatio, 'policy.maxAssumptionBurdenRatio');
  validateRatio(policy.maxLowGradeRatio, 'policy.maxLowGradeRatio');
}

function validateCriticalRequirements(requirements) {
  if (!Array.isArray(requirements)) throw new TypeError('criticalRequirements must be an array');
  return requirements.map((item, index) => {
    if (!item || typeof item !== 'object') throw new TypeError(`criticalRequirements[${index}] must be an object`);
    const field = String(item.field || '').trim();
    if (!field) throw new TypeError(`criticalRequirements[${index}].field is required`);
    if (!Array.isArray(item.allowedGrades) || item.allowedGrades.length === 0 || item.allowedGrades.some((grade) => !Object.values(EVIDENCE_GRADE).includes(grade))) {
      throw new TypeError(`criticalRequirements[${index}].allowedGrades must contain valid evidence grades`);
    }
    if (!Array.isArray(item.allowedStatuses) || item.allowedStatuses.length === 0 || item.allowedStatuses.some((status) => !Object.values(INPUT_STATUS).includes(status))) {
      throw new TypeError(`criticalRequirements[${index}].allowedStatuses must contain valid input statuses`);
    }
    return { field, allowedGrades: [...item.allowedGrades], allowedStatuses: [...item.allowedStatuses] };
  });
}

function criticalRequirementFailures(evidence, requirements) {
  const failures = [];
  for (const requirement of requirements) {
    const candidates = evidence.filter((item) => item.field === requirement.field);
    if (candidates.length === 0) {
      failures.push({ field: requirement.field, reason: 'MISSING' });
      continue;
    }
    const passes = candidates.some((item) => requirement.allowedGrades.includes(item.grade) && requirement.allowedStatuses.includes(item.status));
    if (!passes) {
      failures.push({
        field: requirement.field,
        reason: 'INSUFFICIENT_EVIDENCE_QUALITY',
        observed: candidates.map((item) => ({ grade: item.grade, status: item.status })),
      });
    }
  }
  return failures;
}

function assessEvidenceQuality({ evidence, policy = null, criticalRequirements = [] }) {
  validateEvidence(evidence);
  const profile = profileEvidence(evidence);
  const normalizedCritical = validateCriticalRequirements(criticalRequirements);

  if (profile.conflictFields.length > 0) {
    return deepFreeze({ schemaVersion: 1, status: QUALITY_STATUS.HOLD_CONFLICT, profile, failures: profile.conflictFields.map((field) => ({ field, reason: 'CONFLICT' })) });
  }

  const criticalFailures = criticalRequirementFailures(evidence, normalizedCritical);
  if (criticalFailures.length > 0) {
    return deepFreeze({ schemaVersion: 1, status: QUALITY_STATUS.HOLD_CRITICAL_FACT, profile, failures: criticalFailures });
  }

  if (policy === null) {
    return deepFreeze({
      schemaVersion: 1,
      status: QUALITY_STATUS.UNRATED_POLICY_REQUIRED,
      profile,
      failures: [],
      requiredPolicy: ['minEvidenceCount', 'maxAssumptionBurdenRatio', 'maxLowGradeRatio'],
      semantics: 'STARTAK does not invent a confidence threshold. Qualification requires an explicit governance policy.',
    });
  }

  validatePolicy(policy);
  if (profile.total < policy.minEvidenceCount) {
    return deepFreeze({ schemaVersion: 1, status: QUALITY_STATUS.HOLD_MIN_EVIDENCE, profile, failures: [{ reason: 'MIN_EVIDENCE_COUNT', required: policy.minEvidenceCount, actual: profile.total }] });
  }
  if (profile.assumptionBurdenRatio > policy.maxAssumptionBurdenRatio) {
    return deepFreeze({ schemaVersion: 1, status: QUALITY_STATUS.HOLD_ASSUMPTION_BURDEN, profile, failures: [{ reason: 'ASSUMPTION_BURDEN', threshold: policy.maxAssumptionBurdenRatio, actual: profile.assumptionBurdenRatio }] });
  }
  if (profile.lowGradeRatio > policy.maxLowGradeRatio) {
    return deepFreeze({ schemaVersion: 1, status: QUALITY_STATUS.HOLD_LOW_GRADE_BURDEN, profile, failures: [{ reason: 'LOW_GRADE_BURDEN', threshold: policy.maxLowGradeRatio, actual: profile.lowGradeRatio }] });
  }

  return deepFreeze({
    schemaVersion: 1,
    status: QUALITY_STATUS.QUALIFIED,
    profile,
    failures: [],
    appliedPolicy: { ...policy },
    semantics: 'QUALIFIED means the supplied evidence satisfies the explicit governance policy; it is not a probability of correctness.',
  });
}

module.exports = {
  QUALITY_STATUS,
  profileEvidence,
  assessEvidenceQuality,
};
