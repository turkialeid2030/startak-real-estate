'use strict';

const {
  EVIDENCE_GRADE,
  INPUT_STATUS,
  createEvidenceRecord,
} = require('./contracts');

const CAP_RATE_GOVERNANCE_VERSION = 'CAP_RATE_GOVERNANCE_V1';
const CAP_RATE_GOVERNANCE_STATUS = Object.freeze({
  PASS: 'PASS',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  HOLD: 'HOLD',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function validCapRate(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 1;
}

function validateEvidenceDescriptor(field, descriptor) {
  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) {
    return { evidence: null, blocker: `${field.toUpperCase()}_EVIDENCE_REQUIRED` };
  }
  if (!Object.values(EVIDENCE_GRADE).includes(descriptor.grade)) {
    return { evidence: null, blocker: `${field.toUpperCase()}_EVIDENCE_GRADE_INVALID` };
  }
  const status = descriptor.status || INPUT_STATUS.OBSERVED;
  if (!Object.values(INPUT_STATUS).includes(status)) {
    return { evidence: null, blocker: `${field.toUpperCase()}_EVIDENCE_STATUS_INVALID` };
  }
  if (!nonEmptyString(descriptor.sourceType) || !nonEmptyString(descriptor.sourceRef)) {
    return { evidence: null, blocker: `${field.toUpperCase()}_PROVENANCE_REQUIRED` };
  }

  try {
    return {
      evidence: createEvidenceRecord({
        field,
        grade: descriptor.grade,
        status,
        sourceType: descriptor.sourceType,
        sourceRef: descriptor.sourceRef,
        observedAt: descriptor.observedAt || null,
        note: descriptor.note || null,
      }),
      blocker: null,
    };
  } catch (error) {
    return { evidence: null, blocker: `${field.toUpperCase()}_EVIDENCE_INVALID:${error.message}` };
  }
}

function evaluateEntryExitCapRateGovernance({
  entryCapRate,
  entryEvidence,
  exitCapRate = null,
  exitEvidence = null,
  requireExit = false,
  sameRateRationale = null,
  capCompressionRationale = null,
  maxAbsoluteSpreadBps = null,
} = {}) {
  const blockers = [];
  const warnings = [];
  const assumptions = [];

  if (!validCapRate(entryCapRate)) blockers.push('ENTRY_CAP_RATE_INVALID');
  if (exitCapRate !== null && !validCapRate(exitCapRate)) blockers.push('EXIT_CAP_RATE_INVALID');
  if (requireExit && exitCapRate === null) blockers.push('EXIT_CAP_RATE_REQUIRED');
  if (exitCapRate === null && exitEvidence !== null) blockers.push('EXIT_CAP_EVIDENCE_WITHOUT_RATE');

  const entryResult = validateEvidenceDescriptor('entryCapRate', entryEvidence);
  if (entryResult.blocker) blockers.push(entryResult.blocker);

  let exitResult = { evidence: null, blocker: null };
  if (exitCapRate !== null) {
    exitResult = validateEvidenceDescriptor('exitCapRate', exitEvidence);
    if (exitResult.blocker) blockers.push(exitResult.blocker);
  }

  const evidence = [entryResult.evidence, exitResult.evidence].filter(Boolean);
  if (evidence.some((item) => item.status === INPUT_STATUS.CONFLICT)) blockers.push('CAP_RATE_EVIDENCE_CONFLICT');
  if (evidence.some((item) => [INPUT_STATUS.ASSUMED, INPUT_STATUS.UNVERIFIED].includes(item.status))) {
    warnings.push('CAP_RATE_EVIDENCE_REQUIRES_REVIEW');
  }

  let spreadBps = null;
  if (validCapRate(entryCapRate) && validCapRate(exitCapRate)) {
    spreadBps = (exitCapRate - entryCapRate) * 10000;

    const sameRate = Math.abs(spreadBps) < 1e-9;
    const sameSource = entryResult.evidence && exitResult.evidence
      && entryResult.evidence.sourceRef === exitResult.evidence.sourceRef;
    if (sameRate && sameSource && !nonEmptyString(sameRateRationale)) {
      warnings.push('EXIT_CAP_EQUALS_ENTRY_CAP_SAME_SOURCE_WITHOUT_RATIONALE');
    }
    if (sameRate && nonEmptyString(sameRateRationale)) assumptions.push('SAME_ENTRY_EXIT_CAP_RATE_EXPLICITLY_RATIONALED');

    if (spreadBps < 0 && !nonEmptyString(capCompressionRationale)) {
      warnings.push('EXIT_CAP_COMPRESSION_WITHOUT_RATIONALE');
    }
    if (spreadBps < 0 && nonEmptyString(capCompressionRationale)) assumptions.push('EXIT_CAP_COMPRESSION_EXPLICITLY_RATIONALED');

    if (maxAbsoluteSpreadBps !== null) {
      if (typeof maxAbsoluteSpreadBps !== 'number' || !Number.isFinite(maxAbsoluteSpreadBps) || maxAbsoluteSpreadBps <= 0) {
        blockers.push('MAX_ABSOLUTE_SPREAD_BPS_INVALID');
      } else if (Math.abs(spreadBps) > maxAbsoluteSpreadBps) {
        warnings.push('ENTRY_EXIT_CAP_SPREAD_EXCEEDS_POLICY_THRESHOLD');
      }
    }
  }

  const status = blockers.length
    ? CAP_RATE_GOVERNANCE_STATUS.HOLD
    : warnings.length
      ? CAP_RATE_GOVERNANCE_STATUS.REVIEW_REQUIRED
      : CAP_RATE_GOVERNANCE_STATUS.PASS;

  return deepFreeze({
    version: CAP_RATE_GOVERNANCE_VERSION,
    status,
    entryCapRate: validCapRate(entryCapRate) ? entryCapRate : null,
    exitCapRate: validCapRate(exitCapRate) ? exitCapRate : null,
    spreadBps,
    evidence,
    blockers,
    warnings,
    assumptions,
    sameRateRationale: nonEmptyString(sameRateRationale) ? sameRateRationale.trim() : null,
    capCompressionRationale: nonEmptyString(capCompressionRationale) ? capCompressionRationale.trim() : null,
    semantics: 'Entry and exit capitalization rates are separate governed assumptions. Equality is not prohibited, cap-rate compression is not prohibited, and neither is accepted silently without its own provenance and review signals.',
  });
}

module.exports = {
  CAP_RATE_GOVERNANCE_VERSION,
  CAP_RATE_GOVERNANCE_STATUS,
  evaluateEntryExitCapRateGovernance,
};
