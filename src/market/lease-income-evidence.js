'use strict';

const crypto = require('crypto');

const LEASE_EVIDENCE_SOURCE = Object.freeze({
  OFFICIAL_REGISTERED_LEASE: 'OFFICIAL_REGISTERED_LEASE',
  VERIFIED_EXECUTED_LEASE: 'VERIFIED_EXECUTED_LEASE',
  VERIFIED_RENT_ROLL: 'VERIFIED_RENT_ROLL',
  CLIENT_PROVIDED: 'CLIENT_PROVIDED',
  EXTRACTED: 'EXTRACTED',
  UNVERIFIED: 'UNVERIFIED',
});

const LEASE_VERIFICATION_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  NOT_VERIFIED: 'NOT_VERIFIED',
});

const ESCALATION_TYPE = Object.freeze({
  NONE: 'NONE',
  PERCENT: 'PERCENT',
  FIXED_AMOUNT: 'FIXED_AMOUNT',
  STEP_SCHEDULE: 'STEP_SCHEDULE',
  OTHER: 'OTHER',
});

const LEASE_OPTION_TYPE = Object.freeze({
  BREAK: 'BREAK',
  RENEWAL: 'RENEWAL',
});

const INCENTIVE_TYPE = Object.freeze({
  NONE: 'NONE',
  RENT_FREE: 'RENT_FREE',
  FIT_OUT_CONTRIBUTION: 'FIT_OUT_CONTRIBUTION',
  OTHER: 'OTHER',
});

const RECOVERY_TYPE = Object.freeze({
  NONE: 'NONE',
  FIXED: 'FIXED',
  PERCENT_OF_ACTUAL: 'PERCENT_OF_ACTUAL',
  ACTUAL_COST: 'ACTUAL_COST',
  OTHER: 'OTHER',
});

const LEASE_INCOME_GATE_STATUS = Object.freeze({
  READY_FOR_INCOME_ANALYSIS_HANDOFF: 'READY_FOR_INCOME_ANALYSIS_HANDOFF',
  HOLD_INSUFFICIENT_EVIDENCE: 'HOLD_INSUFFICIENT_EVIDENCE',
  HOLD_CONFLICT: 'HOLD_CONFLICT',
  HOLD_RECONCILIATION: 'HOLD_RECONCILIATION',
});

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertNonEmpty(value, field) {
  if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`);
}

function assertEnum(value, enumeration, field) {
  if (!Object.values(enumeration).includes(value)) throw new TypeError(`${field} is invalid`);
}

function iso(value, field) {
  assertNonEmpty(value, field);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return d.toISOString();
}

function finiteNonNegative(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new TypeError(`${field} must be a finite non-negative number`);
}

function finitePositive(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new TypeError(`${field} must be a finite positive number`);
}

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = stableClone(value[key]);
    return out;
  }, {});
}

function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function assertSha256(value, field) {
  if (!nonEmpty(value) || !/^[a-f0-9]{64}$/i.test(value)) throw new TypeError(`${field} must be a SHA-256 digest`);
}

function normalizeVerification(verification, capturedAtIso, field = 'verification') {
  if (!verification || typeof verification !== 'object') throw new TypeError(`${field} is required`);
  assertEnum(verification.status, LEASE_VERIFICATION_STATUS, `${field}.status`);
  if (verification.status === LEASE_VERIFICATION_STATUS.NOT_VERIFIED) {
    return { status: verification.status, verifiedByRef: null, verifiedAt: null, evidenceRef: null };
  }
  assertNonEmpty(verification.verifiedByRef, `${field}.verifiedByRef`);
  assertNonEmpty(verification.evidenceRef, `${field}.evidenceRef`);
  const verifiedAtIso = iso(verification.verifiedAt, `${field}.verifiedAt`);
  if (Date.parse(verifiedAtIso) < Date.parse(capturedAtIso)) throw new TypeError('LEASE_VERIFICATION_BEFORE_CAPTURE');
  return {
    status: verification.status,
    verifiedByRef: verification.verifiedByRef.trim(),
    verifiedAt: verifiedAtIso,
    evidenceRef: verification.evidenceRef.trim(),
  };
}

function normalizeEscalation(escalation) {
  if (!escalation || typeof escalation !== 'object') throw new TypeError('escalation is required');
  assertEnum(escalation.type, ESCALATION_TYPE, 'escalation.type');
  const result = { type: escalation.type, rate: null, amountSar: null, intervalMonths: null, schedule: [], description: null, evidenceRef: null };
  if (escalation.type === ESCALATION_TYPE.NONE) return result;
  assertNonEmpty(escalation.evidenceRef, 'escalation.evidenceRef');
  result.evidenceRef = escalation.evidenceRef.trim();
  if (escalation.type === ESCALATION_TYPE.PERCENT) {
    finiteNonNegative(escalation.rate, 'escalation.rate');
    if (escalation.rate > 1) throw new TypeError('escalation.rate must be expressed as decimal <= 1');
    if (!Number.isInteger(escalation.intervalMonths) || escalation.intervalMonths < 1) throw new TypeError('escalation.intervalMonths must be positive integer');
    result.rate = escalation.rate;
    result.intervalMonths = escalation.intervalMonths;
  } else if (escalation.type === ESCALATION_TYPE.FIXED_AMOUNT) {
    finiteNonNegative(escalation.amountSar, 'escalation.amountSar');
    if (!Number.isInteger(escalation.intervalMonths) || escalation.intervalMonths < 1) throw new TypeError('escalation.intervalMonths must be positive integer');
    result.amountSar = escalation.amountSar;
    result.intervalMonths = escalation.intervalMonths;
  } else if (escalation.type === ESCALATION_TYPE.STEP_SCHEDULE) {
    if (!Array.isArray(escalation.schedule) || escalation.schedule.length === 0) throw new TypeError('escalation.schedule is required');
    result.schedule = escalation.schedule.map((step, index) => {
      const effectiveAt = iso(step.effectiveAt, `escalation.schedule[${index}].effectiveAt`);
      finiteNonNegative(step.annualRentSar, `escalation.schedule[${index}].annualRentSar`);
      assertNonEmpty(step.evidenceRef, `escalation.schedule[${index}].evidenceRef`);
      return { effectiveAt, annualRentSar: step.annualRentSar, evidenceRef: step.evidenceRef.trim() };
    }).sort((a, b) => Date.parse(a.effectiveAt) - Date.parse(b.effectiveAt));
  } else if (escalation.type === ESCALATION_TYPE.OTHER) {
    assertNonEmpty(escalation.description, 'escalation.description');
    result.description = escalation.description.trim();
  }
  return result;
}

function normalizeOptions(options, type) {
  if (!Array.isArray(options)) throw new TypeError(`${type.toLowerCase()}Options must be an array`);
  return options.map((option, index) => {
    assertNonEmpty(option.evidenceRef, `${type}[${index}].evidenceRef`);
    const optionDate = iso(option.optionDate, `${type}[${index}].optionDate`);
    if (!Number.isInteger(option.noticeDays) || option.noticeDays < 0) throw new TypeError(`${type}[${index}].noticeDays must be non-negative integer`);
    return {
      type,
      optionDate,
      noticeDays: option.noticeDays,
      description: nonEmpty(option.description) ? option.description.trim() : null,
      evidenceRef: option.evidenceRef.trim(),
    };
  });
}

function normalizeIncentives(incentives) {
  if (!Array.isArray(incentives)) throw new TypeError('incentives must be an array');
  return incentives.map((item, index) => {
    assertEnum(item.type, INCENTIVE_TYPE, `incentives[${index}].type`);
    if (item.type === INCENTIVE_TYPE.NONE) return { type: item.type, amountSar: 0, months: 0, description: null, evidenceRef: null };
    assertNonEmpty(item.evidenceRef, `incentives[${index}].evidenceRef`);
    finiteNonNegative(item.amountSar ?? 0, `incentives[${index}].amountSar`);
    if (!Number.isInteger(item.months ?? 0) || (item.months ?? 0) < 0) throw new TypeError(`incentives[${index}].months must be non-negative integer`);
    if (item.type === INCENTIVE_TYPE.OTHER && !nonEmpty(item.description)) throw new TypeError(`incentives[${index}].description is required for OTHER`);
    return {
      type: item.type,
      amountSar: item.amountSar ?? 0,
      months: item.months ?? 0,
      description: nonEmpty(item.description) ? item.description.trim() : null,
      evidenceRef: item.evidenceRef.trim(),
    };
  });
}

function normalizeRecoveries(recoveries) {
  if (!recoveries || typeof recoveries !== 'object') throw new TypeError('recoveries is required');
  assertEnum(recoveries.type, RECOVERY_TYPE, 'recoveries.type');
  if (recoveries.type === RECOVERY_TYPE.NONE) return { type: recoveries.type, annualAmountSar: 0, rate: null, description: null, evidenceRef: null };
  assertNonEmpty(recoveries.evidenceRef, 'recoveries.evidenceRef');
  const result = { type: recoveries.type, annualAmountSar: null, rate: null, description: null, evidenceRef: recoveries.evidenceRef.trim() };
  if (recoveries.type === RECOVERY_TYPE.FIXED) {
    finiteNonNegative(recoveries.annualAmountSar, 'recoveries.annualAmountSar');
    result.annualAmountSar = recoveries.annualAmountSar;
  } else if (recoveries.type === RECOVERY_TYPE.PERCENT_OF_ACTUAL) {
    finiteNonNegative(recoveries.rate, 'recoveries.rate');
    if (recoveries.rate > 1) throw new TypeError('recoveries.rate must be expressed as decimal <= 1');
    result.rate = recoveries.rate;
  } else if (recoveries.type === RECOVERY_TYPE.OTHER) {
    assertNonEmpty(recoveries.description, 'recoveries.description');
    result.description = recoveries.description.trim();
  }
  return result;
}

function createLeaseEvidenceRecord({
  leaseId,
  caseId,
  propertyRef,
  unitRef,
  tenantRef,
  leaseInterestRef,
  areaSqm,
  baseAnnualRentSar,
  contractedAnnualRentSarAsOfDate,
  startDate,
  expiryDate,
  escalation,
  breakOptions = [],
  renewalOptions = [],
  incentives = [],
  recoveries = { type: RECOVERY_TYPE.NONE },
  sourceClass,
  sourceRef,
  sourceDocumentHashSha256,
  verification,
  capturedAt,
} = {}) {
  for (const [field, value] of [['leaseId', leaseId], ['caseId', caseId], ['propertyRef', propertyRef], ['unitRef', unitRef], ['tenantRef', tenantRef], ['leaseInterestRef', leaseInterestRef], ['sourceRef', sourceRef]]) assertNonEmpty(value, field);
  assertEnum(sourceClass, LEASE_EVIDENCE_SOURCE, 'sourceClass');
  assertSha256(sourceDocumentHashSha256, 'sourceDocumentHashSha256');
  finitePositive(areaSqm, 'areaSqm');
  finiteNonNegative(baseAnnualRentSar, 'baseAnnualRentSar');
  finiteNonNegative(contractedAnnualRentSarAsOfDate, 'contractedAnnualRentSarAsOfDate');
  const startDateIso = iso(startDate, 'startDate');
  const expiryDateIso = iso(expiryDate, 'expiryDate');
  if (Date.parse(expiryDateIso) <= Date.parse(startDateIso)) throw new TypeError('LEASE_EXPIRY_MUST_FOLLOW_START');
  const capturedAtIso = iso(capturedAt, 'capturedAt');
  const normalizedVerification = normalizeVerification(verification, capturedAtIso);
  if ([LEASE_EVIDENCE_SOURCE.OFFICIAL_REGISTERED_LEASE, LEASE_EVIDENCE_SOURCE.VERIFIED_EXECUTED_LEASE].includes(sourceClass)
      && normalizedVerification.status !== LEASE_VERIFICATION_STATUS.VERIFIED) {
    throw new TypeError(`LEASE_SOURCE_CLASS_REQUIRES_VERIFICATION:${sourceClass}`);
  }

  const record = {
    schemaVersion: 1,
    leaseId: leaseId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    unitRef: unitRef.trim(),
    tenantRef: tenantRef.trim(),
    leaseInterestRef: leaseInterestRef.trim(),
    areaSqm,
    baseAnnualRentSar,
    contractedAnnualRentSarAsOfDate,
    startDate: startDateIso,
    expiryDate: expiryDateIso,
    escalation: normalizeEscalation(escalation),
    breakOptions: normalizeOptions(breakOptions, LEASE_OPTION_TYPE.BREAK),
    renewalOptions: normalizeOptions(renewalOptions, LEASE_OPTION_TYPE.RENEWAL),
    incentives: normalizeIncentives(incentives),
    recoveries: normalizeRecoveries(recoveries),
    sourceClass,
    sourceRef: sourceRef.trim(),
    sourceDocumentHashSha256: sourceDocumentHashSha256.toLowerCase(),
    verification: normalizedVerification,
    capturedAt: capturedAtIso,
    contractualInterpretationPerformed: false,
    automaticDCFAdoption: false,
    financialEngineInputsWritten: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  };
  record.leaseEvidenceHashSha256 = sha256(record);
  return deepFreeze(record);
}

function createVerifiedRentRollSnapshot({
  snapshotId,
  caseId,
  propertyRef,
  asOfDate,
  totalLettableAreaSqm,
  occupiedAreaSqm,
  annualContractRentSar,
  activeLeaseCount,
  sourceRef,
  sourceDocumentHashSha256,
  verification,
  capturedAt,
} = {}) {
  for (const [field, value] of [['snapshotId', snapshotId], ['caseId', caseId], ['propertyRef', propertyRef], ['sourceRef', sourceRef]]) assertNonEmpty(value, field);
  const asOfDateIso = iso(asOfDate, 'asOfDate');
  finitePositive(totalLettableAreaSqm, 'totalLettableAreaSqm');
  finiteNonNegative(occupiedAreaSqm, 'occupiedAreaSqm');
  finiteNonNegative(annualContractRentSar, 'annualContractRentSar');
  if (occupiedAreaSqm > totalLettableAreaSqm) throw new TypeError('RENT_ROLL_OCCUPIED_AREA_EXCEEDS_TOTAL');
  if (!Number.isInteger(activeLeaseCount) || activeLeaseCount < 0) throw new TypeError('activeLeaseCount must be non-negative integer');
  assertSha256(sourceDocumentHashSha256, 'sourceDocumentHashSha256');
  const capturedAtIso = iso(capturedAt, 'capturedAt');
  const normalizedVerification = normalizeVerification(verification, capturedAtIso, 'verification');
  if (normalizedVerification.status !== LEASE_VERIFICATION_STATUS.VERIFIED) throw new TypeError('RENT_ROLL_SNAPSHOT_MUST_BE_VERIFIED');

  const snapshot = {
    schemaVersion: 1,
    snapshotId: snapshotId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    asOfDate: asOfDateIso,
    totalLettableAreaSqm,
    occupiedAreaSqm,
    annualContractRentSar,
    activeLeaseCount,
    sourceRef: sourceRef.trim(),
    sourceDocumentHashSha256: sourceDocumentHashSha256.toLowerCase(),
    verification: normalizedVerification,
    capturedAt: capturedAtIso,
    automaticDCFAdoption: false,
    financialEngineInputsWritten: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  };
  snapshot.rentRollHashSha256 = sha256(snapshot);
  return deepFreeze(snapshot);
}

function isLeaseActiveAt(record, asOfMs) {
  return Date.parse(record.startDate) <= asOfMs && Date.parse(record.expiryDate) >= asOfMs;
}

function reconcileLeaseIncomeEvidence({
  caseId,
  propertyRef,
  leaseRecords,
  rentRollSnapshot,
  asOfDate,
  annualRentToleranceSar = 0,
  occupiedAreaToleranceSqm = 0,
  requireVerifiedActiveLeases = true,
} = {}) {
  assertNonEmpty(caseId, 'caseId');
  assertNonEmpty(propertyRef, 'propertyRef');
  if (!Array.isArray(leaseRecords)) throw new TypeError('leaseRecords must be an array');
  if (!rentRollSnapshot || typeof rentRollSnapshot !== 'object') throw new TypeError('rentRollSnapshot is required');
  finiteNonNegative(annualRentToleranceSar, 'annualRentToleranceSar');
  finiteNonNegative(occupiedAreaToleranceSqm, 'occupiedAreaToleranceSqm');
  if (typeof requireVerifiedActiveLeases !== 'boolean') throw new TypeError('requireVerifiedActiveLeases must be boolean');
  const asOfDateIso = iso(asOfDate, 'asOfDate');
  const asOfMs = Date.parse(asOfDateIso);
  if (rentRollSnapshot.caseId !== caseId || rentRollSnapshot.propertyRef !== propertyRef) throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION: rent roll does not belong to requested case/property');
  if (Date.parse(rentRollSnapshot.asOfDate) !== asOfMs) throw new TypeError('RENT_ROLL_AS_OF_DATE_MISMATCH');

  const leaseIds = new Set();
  for (const record of leaseRecords) {
    if (!record || record.caseId !== caseId || record.propertyRef !== propertyRef) throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION: lease belongs to another case/property');
    if (leaseIds.has(record.leaseId)) throw new TypeError(`DUPLICATE_LEASE_ID:${record.leaseId}`);
    leaseIds.add(record.leaseId);
  }

  const active = leaseRecords.filter((record) => isLeaseActiveAt(record, asOfMs));
  const blockers = [];
  const warnings = [];
  const unitMap = new Map();
  for (const record of active) {
    const existing = unitMap.get(record.unitRef);
    if (existing) blockers.push(`ACTIVE_LEASE_UNIT_CONFLICT:${record.unitRef}:${existing},${record.leaseId}`);
    else unitMap.set(record.unitRef, record.leaseId);
    if (requireVerifiedActiveLeases && record.verification.status !== LEASE_VERIFICATION_STATUS.VERIFIED) blockers.push(`ACTIVE_LEASE_NOT_VERIFIED:${record.leaseId}`);
  }
  for (const record of leaseRecords.filter((record) => !active.includes(record))) {
    if (record.verification.status !== LEASE_VERIFICATION_STATUS.VERIFIED) warnings.push(`INACTIVE_LEASE_NOT_VERIFIED:${record.leaseId}`);
  }

  const occupiedAreaSqm = active.reduce((sum, record) => sum + record.areaSqm, 0);
  const annualContractRentSar = active.reduce((sum, record) => sum + record.contractedAnnualRentSarAsOfDate, 0);
  const rentDeltaSar = annualContractRentSar - rentRollSnapshot.annualContractRentSar;
  const occupiedAreaDeltaSqm = occupiedAreaSqm - rentRollSnapshot.occupiedAreaSqm;
  const leaseCountDelta = active.length - rentRollSnapshot.activeLeaseCount;

  if (Math.abs(rentDeltaSar) > annualRentToleranceSar) blockers.push(`RENT_ROLL_ANNUAL_RENT_MISMATCH:${rentDeltaSar}`);
  if (Math.abs(occupiedAreaDeltaSqm) > occupiedAreaToleranceSqm) blockers.push(`RENT_ROLL_OCCUPIED_AREA_MISMATCH:${occupiedAreaDeltaSqm}`);
  if (leaseCountDelta !== 0) blockers.push(`RENT_ROLL_ACTIVE_LEASE_COUNT_MISMATCH:${leaseCountDelta}`);
  if (occupiedAreaSqm > rentRollSnapshot.totalLettableAreaSqm + occupiedAreaToleranceSqm) blockers.push('ACTIVE_LEASE_AREA_EXCEEDS_TOTAL_LETTABLE_AREA');

  const insufficientEvidence = active.length === 0 || (requireVerifiedActiveLeases && active.every((record) => record.verification.status !== LEASE_VERIFICATION_STATUS.VERIFIED));
  let status = LEASE_INCOME_GATE_STATUS.READY_FOR_INCOME_ANALYSIS_HANDOFF;
  if (insufficientEvidence) status = LEASE_INCOME_GATE_STATUS.HOLD_INSUFFICIENT_EVIDENCE;
  else if (blockers.some((item) => item.startsWith('ACTIVE_LEASE_UNIT_CONFLICT:'))) status = LEASE_INCOME_GATE_STATUS.HOLD_CONFLICT;
  else if (blockers.length) status = LEASE_INCOME_GATE_STATUS.HOLD_RECONCILIATION;

  const leaseProjection = active.map((record) => ({
    leaseId: record.leaseId,
    leaseEvidenceHashSha256: record.leaseEvidenceHashSha256,
    unitRef: record.unitRef,
    tenantRef: record.tenantRef,
    leaseInterestRef: record.leaseInterestRef,
    areaSqm: record.areaSqm,
    baseAnnualRentSar: record.baseAnnualRentSar,
    contractedAnnualRentSarAsOfDate: record.contractedAnnualRentSarAsOfDate,
    startDate: record.startDate,
    expiryDate: record.expiryDate,
    escalation: record.escalation,
    breakOptions: record.breakOptions,
    renewalOptions: record.renewalOptions,
    incentives: record.incentives,
    recoveries: record.recoveries,
    sourceClass: record.sourceClass,
    sourceRef: record.sourceRef,
    sourceDocumentHashSha256: record.sourceDocumentHashSha256,
    verification: record.verification,
  }));

  const result = {
    schemaVersion: 1,
    caseId,
    propertyRef,
    asOfDate: asOfDateIso,
    status,
    blockers,
    warnings,
    rentRollHashSha256: rentRollSnapshot.rentRollHashSha256,
    activeLeaseCount: active.length,
    occupiedAreaSqm,
    annualContractRentSar,
    rentDeltaSar,
    occupiedAreaDeltaSqm,
    leaseCountDelta,
    activeLeases: leaseProjection,
    readyForIncomeAnalysisHandoff: status === LEASE_INCOME_GATE_STATUS.READY_FOR_INCOME_ANALYSIS_HANDOFF,
    contractualInterpretationPerformed: false,
    automaticDCFAdoption: false,
    financialEngineInputsWritten: false,
    noiCalculated: false,
    valuationConclusionProduced: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'This gate reconciles verified lease-level evidence to a verified rent-roll snapshot and preserves contractual clause provenance. Contract interpretation, rent forecasting, NOI, capitalization, DCF adoption, valuation conclusion and transaction authority remain separate professional decisions/workflows.',
  };
  result.incomeEvidencePacketHashSha256 = sha256(result);
  return deepFreeze(result);
}

module.exports = {
  LEASE_EVIDENCE_SOURCE,
  LEASE_VERIFICATION_STATUS,
  ESCALATION_TYPE,
  LEASE_OPTION_TYPE,
  INCENTIVE_TYPE,
  RECOVERY_TYPE,
  LEASE_INCOME_GATE_STATUS,
  createLeaseEvidenceRecord,
  createVerifiedRentRollSnapshot,
  reconcileLeaseIncomeEvidence,
};
