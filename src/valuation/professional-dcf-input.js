'use strict';

const crypto = require('crypto');
const {
  RATE_INPUT_TYPE,
  verifyProfessionalRateInputIntegrity,
} = require('./professional-method-input-provenance');
const {
  verifyProfessionalNoiResultIntegrity,
} = require('./direct-capitalization-input');

const DCF_TIMING_CONVENTION = Object.freeze({
  END_OF_PERIOD: 'END_OF_PERIOD',
  MID_YEAR: 'MID_YEAR',
});

const TERMINAL_NOI_SOURCE = Object.freeze({
  EXPLICIT_FORECAST: 'EXPLICIT_FORECAST',
  VERIFIED_MARKET_EVIDENCE: 'VERIFIED_MARKET_EVIDENCE',
  EXTERNAL_PROFESSIONAL_REPORT: 'EXTERNAL_PROFESSIONAL_REPORT',
  PROFESSIONAL_JUDGMENT: 'PROFESSIONAL_JUDGMENT',
});

const DISPOSITION_COST_METHOD = Object.freeze({
  AMOUNT_SAR: 'AMOUNT_SAR',
  PERCENT_OF_GROSS_TERMINAL_VALUE: 'PERCENT_OF_GROSS_TERMINAL_VALUE',
});

const DCF_PERIOD_ADJUSTMENT_TYPE = Object.freeze({
  CAPITAL_EXPENDITURE: 'CAPITAL_EXPENDITURE',
  TENANT_IMPROVEMENTS: 'TENANT_IMPROVEMENTS',
  LEASING_COMMISSION: 'LEASING_COMMISSION',
  OTHER_PROPERTY_CASH_FLOW: 'OTHER_PROPERTY_CASH_FLOW',
});

const DCF_CASH_FLOW_DIRECTION = Object.freeze({
  INFLOW: 'INFLOW',
  OUTFLOW: 'OUTFLOW',
});

const DCF_ADJUSTMENT_SOURCE = Object.freeze({
  VERIFIED_LEASE_EVIDENCE: 'VERIFIED_LEASE_EVIDENCE',
  VERIFIED_MARKET_EVIDENCE: 'VERIFIED_MARKET_EVIDENCE',
  EXTERNAL_PROFESSIONAL_REPORT: 'EXTERNAL_PROFESSIONAL_REPORT',
  PROFESSIONAL_JUDGMENT: 'PROFESSIONAL_JUDGMENT',
  CLIENT_PROVIDED_VERIFIED: 'CLIENT_PROVIDED_VERIFIED',
});

const PROFESSIONAL_DCF_INPUT_STATUS = Object.freeze({
  READY_FOR_CANONICAL_DCF: 'READY_FOR_CANONICAL_DCF',
  HOLD_NOI_FORECAST: 'HOLD_NOI_FORECAST',
  HOLD_PERIOD_ADJUSTMENTS: 'HOLD_PERIOD_ADJUSTMENTS',
  HOLD_RATE_PROVENANCE: 'HOLD_RATE_PROVENANCE',
  HOLD_TERMINAL_ASSUMPTIONS: 'HOLD_TERMINAL_ASSUMPTIONS',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
});

function nonEmpty(value) { return typeof value === 'string' && value.trim().length > 0; }
function assertNonEmpty(value, field) { if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`); }
function assertEnum(value, enumeration, field) { if (!Object.values(enumeration).includes(value)) throw new TypeError(`${field} is invalid`); }
function iso(value, field) {
  assertNonEmpty(value, field);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return date.toISOString();
}
function finiteNonNegative(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new TypeError(`${field} must be finite and non-negative`);
}
function finitePositive(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new TypeError(`${field} must be finite and positive`);
}
function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = stableClone(value[key]); return out; }, {});
}
function sha256(value) { return crypto.createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex'); }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
function validSha(value) { return nonEmpty(value) && /^[a-f0-9]{64}$/i.test(value); }
function daysBetween(earlier, later) { return Math.floor((Date.parse(later) - Date.parse(earlier)) / 86400000); }
function normalizeEvidenceRefs(values) {
  if (!Array.isArray(values) || values.length === 0 || values.some((value) => !nonEmpty(value))) throw new TypeError('evidenceRefs must be a non-empty array');
  return [...new Set(values.map((value) => value.trim()))];
}

function createTerminalNoiInput({
  terminalNoiId,
  caseId,
  propertyRef,
  amountSar,
  source,
  rationale,
  evidenceRefs,
  asOfDate,
  preparedByRef,
  preparedAt,
  reviewedByRef,
  reviewedAt,
  reviewEvidenceRef,
} = {}) {
  for (const [field, value] of [['terminalNoiId', terminalNoiId], ['caseId', caseId], ['propertyRef', propertyRef], ['rationale', rationale], ['preparedByRef', preparedByRef], ['reviewedByRef', reviewedByRef], ['reviewEvidenceRef', reviewEvidenceRef]]) assertNonEmpty(value, field);
  finitePositive(amountSar, 'amountSar');
  assertEnum(source, TERMINAL_NOI_SOURCE, 'source');
  const asOfDateIso = iso(asOfDate, 'asOfDate');
  const preparedAtIso = iso(preparedAt, 'preparedAt');
  const reviewedAtIso = iso(reviewedAt, 'reviewedAt');
  if (Date.parse(preparedAtIso) < Date.parse(asOfDateIso)) throw new TypeError('TERMINAL_NOI_PREPARATION_BEFORE_AS_OF_DATE');
  if (Date.parse(reviewedAtIso) < Date.parse(preparedAtIso)) throw new TypeError('TERMINAL_NOI_REVIEW_BEFORE_PREPARATION');
  const core = {
    schemaVersion: 1,
    terminalNoiId: terminalNoiId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    amountSar,
    source,
    rationale: rationale.trim(),
    evidenceRefs: normalizeEvidenceRefs(evidenceRefs),
    asOfDate: asOfDateIso,
    preparedByRef: preparedByRef.trim(),
    preparedAt: preparedAtIso,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewedAtIso,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
    automaticallyDerived: false,
  };
  return deepFreeze({ ...core, terminalNoiInputHashSha256: sha256(core) });
}

function verifyTerminalNoiInputIntegrity(input) {
  if (!input || !validSha(input.terminalNoiInputHashSha256)) return false;
  const { terminalNoiInputHashSha256, ...core } = input;
  return sha256(core) === input.terminalNoiInputHashSha256.toLowerCase();
}

function createDispositionCostInput({
  dispositionCostId,
  caseId,
  propertyRef,
  method,
  value,
  rationale,
  evidenceRefs,
  preparedByRef,
  preparedAt,
  reviewedByRef,
  reviewedAt,
  reviewEvidenceRef,
} = {}) {
  for (const [field, item] of [['dispositionCostId', dispositionCostId], ['caseId', caseId], ['propertyRef', propertyRef], ['rationale', rationale], ['preparedByRef', preparedByRef], ['reviewedByRef', reviewedByRef], ['reviewEvidenceRef', reviewEvidenceRef]]) assertNonEmpty(item, field);
  assertEnum(method, DISPOSITION_COST_METHOD, 'method');
  finiteNonNegative(value, 'value');
  if (method === DISPOSITION_COST_METHOD.PERCENT_OF_GROSS_TERMINAL_VALUE && value > 1) throw new TypeError('disposition cost rate must be expressed as decimal <= 1');
  const preparedAtIso = iso(preparedAt, 'preparedAt');
  const reviewedAtIso = iso(reviewedAt, 'reviewedAt');
  if (Date.parse(reviewedAtIso) < Date.parse(preparedAtIso)) throw new TypeError('DISPOSITION_COST_REVIEW_BEFORE_PREPARATION');
  const core = {
    schemaVersion: 1,
    dispositionCostId: dispositionCostId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    method,
    value,
    rationale: rationale.trim(),
    evidenceRefs: normalizeEvidenceRefs(evidenceRefs),
    preparedByRef: preparedByRef.trim(),
    preparedAt: preparedAtIso,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewedAtIso,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
    implicitZeroUsed: false,
    automaticallyDerived: false,
  };
  return deepFreeze({ ...core, dispositionCostInputHashSha256: sha256(core) });
}

function verifyDispositionCostInputIntegrity(input) {
  if (!input || !validSha(input.dispositionCostInputHashSha256)) return false;
  const { dispositionCostInputHashSha256, ...core } = input;
  return sha256(core) === input.dispositionCostInputHashSha256.toLowerCase();
}

function createDcfPeriodAdjustment({
  adjustmentId,
  caseId,
  propertyRef,
  periodIndex,
  type,
  direction,
  amountSar,
  source,
  rationale,
  evidenceRefs,
  asOfDate,
  preparedByRef,
  preparedAt,
  reviewedByRef,
  reviewedAt,
  reviewEvidenceRef,
} = {}) {
  for (const [field, value] of [['adjustmentId', adjustmentId], ['caseId', caseId], ['propertyRef', propertyRef], ['rationale', rationale], ['preparedByRef', preparedByRef], ['reviewedByRef', reviewedByRef], ['reviewEvidenceRef', reviewEvidenceRef]]) assertNonEmpty(value, field);
  if (!Number.isInteger(periodIndex) || periodIndex < 1) throw new TypeError('periodIndex must be a positive integer');
  assertEnum(type, DCF_PERIOD_ADJUSTMENT_TYPE, 'type');
  assertEnum(direction, DCF_CASH_FLOW_DIRECTION, 'direction');
  assertEnum(source, DCF_ADJUSTMENT_SOURCE, 'source');
  finiteNonNegative(amountSar, 'amountSar');
  const asOfDateIso = iso(asOfDate, 'asOfDate');
  const preparedAtIso = iso(preparedAt, 'preparedAt');
  const reviewedAtIso = iso(reviewedAt, 'reviewedAt');
  if (Date.parse(preparedAtIso) < Date.parse(asOfDateIso)) throw new TypeError('DCF_ADJUSTMENT_PREPARATION_BEFORE_AS_OF_DATE');
  if (Date.parse(reviewedAtIso) < Date.parse(preparedAtIso)) throw new TypeError('DCF_ADJUSTMENT_REVIEW_BEFORE_PREPARATION');
  const core = {
    schemaVersion: 1,
    adjustmentId: adjustmentId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    periodIndex,
    type,
    direction,
    amountSar,
    source,
    rationale: rationale.trim(),
    evidenceRefs: normalizeEvidenceRefs(evidenceRefs),
    asOfDate: asOfDateIso,
    preparedByRef: preparedByRef.trim(),
    preparedAt: preparedAtIso,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewedAtIso,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
    includedInNoi: false,
    debtServiceIncluded: false,
    incomeTaxIncluded: false,
    zakatIncluded: false,
    automaticallyDerived: false,
  };
  return deepFreeze({ ...core, dcfPeriodAdjustmentHashSha256: sha256(core) });
}

function verifyDcfPeriodAdjustmentIntegrity(input) {
  if (!input || !validSha(input.dcfPeriodAdjustmentHashSha256)) return false;
  const { dcfPeriodAdjustmentHashSha256, ...core } = input;
  return sha256(core) === input.dcfPeriodAdjustmentHashSha256.toLowerCase();
}

function hold(status, blockers, context = {}) {
  return deepFreeze({
    schemaVersion: 1,
    caseId: context.caseId || null,
    propertyRef: context.propertyRef || null,
    valuationDate: context.valuationDate || null,
    status,
    blockers,
    readyForCanonicalDcf: false,
    professionalNoiCalculationHashSha256: context.professionalNoiCalculationHashSha256 || null,
    discountRateInputHashSha256: context.discountRateInputHashSha256 || null,
    exitCapRateInputHashSha256: context.exitCapRateInputHashSha256 || null,
    terminalNoiInputHashSha256: context.terminalNoiInputHashSha256 || null,
    dispositionCostInputHashSha256: context.dispositionCostInputHashSha256 || null,
    periodAdjustmentHashes: context.periodAdjustmentHashes || [],
    automaticRateDerivation: false,
    automaticTerminalNoiDerivation: false,
    financingIncluded: false,
    debtServiceIncluded: false,
    incomeTaxCalculated: false,
    zakatCalculated: false,
    equityReturnAnalysisPerformed: false,
    reconciliationPerformed: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function validateRate({ rate, requiredType, caseId, propertyRef, valuationDateIso, preparedAtIso, maximumAgeDays, label }) {
  const blockers = [];
  const integrityBlockers = [];
  if (!rate || rate.caseId !== caseId || rate.propertyRef !== propertyRef) throw new TypeError(`CASE_OR_PROPERTY_ISOLATION_VIOLATION:${label}`);
  if (rate.type !== requiredType) blockers.push(`${label}_TYPE_REQUIRED:${requiredType}:${rate.type || 'UNKNOWN'}`);
  if (!verifyProfessionalRateInputIntegrity(rate)) integrityBlockers.push(`${label}_INTEGRITY_FAILED`);
  if (integrityBlockers.length) return { blockers, integrityBlockers, ageDays: null };
  const asOfDateIso = iso(rate.asOfDate, `${label}.asOfDate`);
  const reviewedAtIso = iso(rate.reviewedAt, `${label}.reviewedAt`);
  if (Date.parse(asOfDateIso) > Date.parse(valuationDateIso)) blockers.push(`${label}_AS_OF_AFTER_VALUATION_DATE`);
  if (Date.parse(reviewedAtIso) > Date.parse(preparedAtIso)) blockers.push(`${label}_REVIEW_AFTER_DCF_PREPARATION`);
  const ageDays = daysBetween(asOfDateIso, valuationDateIso);
  if (ageDays < 0 || ageDays > maximumAgeDays) blockers.push(`${label}_STALE:${ageDays}/${maximumAgeDays}`);
  return { blockers, integrityBlockers, ageDays, asOfDateIso, reviewedAtIso };
}

function buildProfessionalDcfInputPacket({
  packetId,
  caseId,
  propertyRef,
  valuationDate,
  professionalNoiResult,
  periodAdjustments,
  discountRateInput,
  exitCapRateInput,
  maximumDiscountRateAgeDays,
  maximumExitCapRateAgeDays,
  terminalNoiInput,
  dispositionCostInput,
  timingConvention,
  preparedByRef,
  preparedAt,
  evidenceRef,
} = {}) {
  for (const [field, value] of [['packetId', packetId], ['caseId', caseId], ['propertyRef', propertyRef], ['preparedByRef', preparedByRef], ['evidenceRef', evidenceRef]]) assertNonEmpty(value, field);
  assertEnum(timingConvention, DCF_TIMING_CONVENTION, 'timingConvention');
  if (!Array.isArray(periodAdjustments)) throw new TypeError('periodAdjustments must be an explicit array; use [] when none apply');
  if (!Number.isInteger(maximumDiscountRateAgeDays) || maximumDiscountRateAgeDays < 0) throw new TypeError('maximumDiscountRateAgeDays must be a non-negative integer');
  if (!Number.isInteger(maximumExitCapRateAgeDays) || maximumExitCapRateAgeDays < 0) throw new TypeError('maximumExitCapRateAgeDays must be a non-negative integer');
  const valuationDateIso = iso(valuationDate, 'valuationDate');
  const preparedAtIso = iso(preparedAt, 'preparedAt');
  if (Date.parse(preparedAtIso) < Date.parse(valuationDateIso)) throw new TypeError('DCF_INPUT_PREPARED_BEFORE_VALUATION_DATE');

  if (!professionalNoiResult || professionalNoiResult.caseId !== caseId || professionalNoiResult.propertyRef !== propertyRef) throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:professionalNoiResult');
  const context = {
    caseId, propertyRef, valuationDate: valuationDateIso,
    professionalNoiCalculationHashSha256: professionalNoiResult.calculationHashSha256 || null,
    discountRateInputHashSha256: discountRateInput?.rateInputHashSha256 || null,
    exitCapRateInputHashSha256: exitCapRateInput?.rateInputHashSha256 || null,
    terminalNoiInputHashSha256: terminalNoiInput?.terminalNoiInputHashSha256 || null,
    dispositionCostInputHashSha256: dispositionCostInput?.dispositionCostInputHashSha256 || null,
    periodAdjustmentHashes: periodAdjustments.map((item) => item?.dcfPeriodAdjustmentHashSha256 || null),
  };
  if (!verifyProfessionalNoiResultIntegrity(professionalNoiResult)) return hold(PROFESSIONAL_DCF_INPUT_STATUS.HOLD_INTEGRITY, ['PROFESSIONAL_NOI_RESULT_INTEGRITY_FAILED'], context);
  if (iso(professionalNoiResult.valuationDate, 'professionalNoiResult.valuationDate') !== valuationDateIso) return hold(PROFESSIONAL_DCF_INPUT_STATUS.HOLD_NOI_FORECAST, ['PROFESSIONAL_NOI_VALUATION_DATE_MISMATCH'], context);
  if (!Array.isArray(professionalNoiResult.periodResults) || professionalNoiResult.periodResults.length === 0) return hold(PROFESSIONAL_DCF_INPUT_STATUS.HOLD_NOI_FORECAST, ['DCF_FORECAST_PERIODS_REQUIRED'], context);

  const operatingNoiPeriods = [];
  const forecastBlockers = [];
  const periodIndexSet = new Set();
  [...professionalNoiResult.periodResults].sort((a, b) => a.periodIndex - b.periodIndex).forEach((period, index) => {
    const expected = index + 1;
    if (!period || period.periodIndex !== expected) forecastBlockers.push(`DCF_PERIOD_INDEX_MUST_BE_CONTIGUOUS:${period?.periodIndex || 'UNKNOWN'}/${expected}`);
    if (typeof period?.selectedNoiSar !== 'number' || !Number.isFinite(period.selectedNoiSar)) forecastBlockers.push(`DCF_PERIOD_NOI_NON_FINITE:${period?.periodId || expected}`);
    if (period) {
      periodIndexSet.add(period.periodIndex);
      operatingNoiPeriods.push({
        periodId: period.periodId,
        periodIndex: period.periodIndex,
        label: period.label,
        startDate: period.startDate,
        endDate: period.endDate,
        selectedNoiSar: period.selectedNoiSar,
        selectedNoiConvention: period.selectedNoiConvention,
        isStabilized: period.isStabilized,
      });
    }
  });
  if (forecastBlockers.length) return hold(PROFESSIONAL_DCF_INPUT_STATUS.HOLD_NOI_FORECAST, forecastBlockers, context);

  const adjustmentBlockers = [];
  const adjustmentIntegrity = [];
  const adjustmentIds = new Set();
  const normalizedAdjustments = [...periodAdjustments].sort((a, b) => (a?.periodIndex || 0) - (b?.periodIndex || 0) || String(a?.adjustmentId || '').localeCompare(String(b?.adjustmentId || '')));
  for (const adjustment of normalizedAdjustments) {
    if (!adjustment || adjustment.caseId !== caseId || adjustment.propertyRef !== propertyRef) throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:periodAdjustment');
    if (adjustmentIds.has(adjustment.adjustmentId)) adjustmentBlockers.push(`DUPLICATE_DCF_PERIOD_ADJUSTMENT_ID:${adjustment.adjustmentId}`);
    adjustmentIds.add(adjustment.adjustmentId);
    if (!periodIndexSet.has(adjustment.periodIndex)) adjustmentBlockers.push(`DCF_ADJUSTMENT_PERIOD_NOT_IN_FORECAST:${adjustment.adjustmentId}:${adjustment.periodIndex}`);
    if (!verifyDcfPeriodAdjustmentIntegrity(adjustment)) adjustmentIntegrity.push(`DCF_PERIOD_ADJUSTMENT_INTEGRITY_FAILED:${adjustment.adjustmentId || 'UNKNOWN'}`);
    if (Date.parse(adjustment.asOfDate) > Date.parse(valuationDateIso)) adjustmentBlockers.push(`DCF_ADJUSTMENT_AS_OF_AFTER_VALUATION_DATE:${adjustment.adjustmentId}`);
    if (Date.parse(adjustment.reviewedAt) > Date.parse(preparedAtIso)) adjustmentBlockers.push(`DCF_ADJUSTMENT_REVIEW_AFTER_DCF_PREPARATION:${adjustment.adjustmentId}`);
  }
  if (adjustmentIntegrity.length) return hold(PROFESSIONAL_DCF_INPUT_STATUS.HOLD_INTEGRITY, adjustmentIntegrity, context);
  if (adjustmentBlockers.length) return hold(PROFESSIONAL_DCF_INPUT_STATUS.HOLD_PERIOD_ADJUSTMENTS, adjustmentBlockers, context);

  const discountCheck = validateRate({ rate: discountRateInput, requiredType: RATE_INPUT_TYPE.DISCOUNT_RATE, caseId, propertyRef, valuationDateIso, preparedAtIso, maximumAgeDays: maximumDiscountRateAgeDays, label: 'DISCOUNT_RATE' });
  const exitCheck = validateRate({ rate: exitCapRateInput, requiredType: RATE_INPUT_TYPE.EXIT_CAP_RATE, caseId, propertyRef, valuationDateIso, preparedAtIso, maximumAgeDays: maximumExitCapRateAgeDays, label: 'EXIT_CAP_RATE' });
  const integrityBlockers = [...discountCheck.integrityBlockers, ...exitCheck.integrityBlockers];
  if (integrityBlockers.length) return hold(PROFESSIONAL_DCF_INPUT_STATUS.HOLD_INTEGRITY, integrityBlockers, context);
  const rateBlockers = [...discountCheck.blockers, ...exitCheck.blockers];
  if (rateBlockers.length) return hold(PROFESSIONAL_DCF_INPUT_STATUS.HOLD_RATE_PROVENANCE, rateBlockers, context);

  if (!terminalNoiInput || terminalNoiInput.caseId !== caseId || terminalNoiInput.propertyRef !== propertyRef) throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:terminalNoiInput');
  if (!dispositionCostInput || dispositionCostInput.caseId !== caseId || dispositionCostInput.propertyRef !== propertyRef) throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:dispositionCostInput');
  const terminalBlockers = [];
  const terminalIntegrity = [];
  if (!verifyTerminalNoiInputIntegrity(terminalNoiInput)) terminalIntegrity.push('TERMINAL_NOI_INPUT_INTEGRITY_FAILED');
  if (!verifyDispositionCostInputIntegrity(dispositionCostInput)) terminalIntegrity.push('DISPOSITION_COST_INPUT_INTEGRITY_FAILED');
  if (terminalIntegrity.length) return hold(PROFESSIONAL_DCF_INPUT_STATUS.HOLD_INTEGRITY, terminalIntegrity, context);
  if (Date.parse(terminalNoiInput.asOfDate) > Date.parse(valuationDateIso)) terminalBlockers.push('TERMINAL_NOI_AS_OF_AFTER_VALUATION_DATE');
  if (Date.parse(terminalNoiInput.reviewedAt) > Date.parse(preparedAtIso)) terminalBlockers.push('TERMINAL_NOI_REVIEW_AFTER_DCF_PREPARATION');
  if (Date.parse(dispositionCostInput.reviewedAt) > Date.parse(preparedAtIso)) terminalBlockers.push('DISPOSITION_COST_REVIEW_AFTER_DCF_PREPARATION');
  if (!(terminalNoiInput.amountSar > 0)) terminalBlockers.push('POSITIVE_TERMINAL_NOI_REQUIRED');
  if (terminalBlockers.length) return hold(PROFESSIONAL_DCF_INPUT_STATUS.HOLD_TERMINAL_ASSUMPTIONS, terminalBlockers, context);

  const rateTrace = (rate, ageDays, maxAge) => ({
    rateId: rate.rateId,
    type: rate.type,
    value: rate.value,
    rateInputHashSha256: rate.rateInputHashSha256,
    source: rate.source,
    sourceLabel: rate.sourceLabel,
    rationale: rate.rationale,
    evidenceRefs: rate.evidenceRefs,
    asOfDate: rate.asOfDate,
    confidence: rate.confidence,
    reviewedByRef: rate.reviewedByRef,
    reviewedAt: rate.reviewedAt,
    reviewEvidenceRef: rate.reviewEvidenceRef,
    ageDays,
    maximumAgeDays: maxAge,
  });

  const core = {
    schemaVersion: 1,
    packetId: packetId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    valuationDate: valuationDateIso,
    timingConvention,
    terminalTimingConvention: 'END_OF_FINAL_PERIOD',
    professionalNoiCalculationHashSha256: professionalNoiResult.calculationHashSha256,
    professionalNoiInputPacketHashSha256: professionalNoiResult.inputPacketHashSha256,
    noiConvention: professionalNoiResult.noiConvention,
    operatingNoiPeriods,
    periodAdjustments: normalizedAdjustments,
    periodAdjustmentsExplicitlyReviewed: true,
    discountRate: discountRateInput.value,
    discountRateProvenance: rateTrace(discountRateInput, discountCheck.ageDays, maximumDiscountRateAgeDays),
    exitCapRate: exitCapRateInput.value,
    exitCapRateProvenance: rateTrace(exitCapRateInput, exitCheck.ageDays, maximumExitCapRateAgeDays),
    terminalNoiInput,
    dispositionCostInput,
    preparedByRef: preparedByRef.trim(),
    preparedAt: preparedAtIso,
    evidenceRef: evidenceRef.trim(),
  };
  return deepFreeze({
    ...core,
    professionalDcfInputHashSha256: sha256(core),
    status: PROFESSIONAL_DCF_INPUT_STATUS.READY_FOR_CANONICAL_DCF,
    blockers: [],
    readyForCanonicalDcf: true,
    automaticRateDerivation: false,
    automaticTerminalNoiDerivation: false,
    financingIncluded: false,
    debtServiceIncluded: false,
    incomeTaxCalculated: false,
    zakatCalculated: false,
    equityReturnAnalysisPerformed: false,
    reconciliationPerformed: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'This packet binds an integrity-verified professional NOI forecast to explicitly reviewed property cash-flow adjustments, discount-rate, exit-cap, terminal-NOI, disposition-cost and timing assumptions. It performs no DCF arithmetic, derives no rates or terminal NOI, includes no financing/debt service/income-tax/Zakat/equity-return analysis, does not reconcile methods, certify a valuation or authorize a transaction.',
  });
}

function verifyProfessionalDcfInputIntegrity(packet) {
  if (!packet || !validSha(packet.professionalDcfInputHashSha256)) return false;
  const core = { ...packet };
  [
    'professionalDcfInputHashSha256', 'status', 'blockers', 'readyForCanonicalDcf', 'automaticRateDerivation',
    'automaticTerminalNoiDerivation', 'financingIncluded', 'debtServiceIncluded', 'incomeTaxCalculated', 'zakatCalculated',
    'equityReturnAnalysisPerformed', 'reconciliationPerformed', 'finalValuationConclusionEstablished',
    'certifiedValuationEstablished', 'transactionAuthorized', 'semantics',
  ].forEach((key) => delete core[key]);
  return sha256(core) === packet.professionalDcfInputHashSha256.toLowerCase();
}

module.exports = {
  DCF_TIMING_CONVENTION,
  TERMINAL_NOI_SOURCE,
  DISPOSITION_COST_METHOD,
  DCF_PERIOD_ADJUSTMENT_TYPE,
  DCF_CASH_FLOW_DIRECTION,
  DCF_ADJUSTMENT_SOURCE,
  PROFESSIONAL_DCF_INPUT_STATUS,
  createTerminalNoiInput,
  verifyTerminalNoiInputIntegrity,
  createDispositionCostInput,
  verifyDispositionCostInputIntegrity,
  createDcfPeriodAdjustment,
  verifyDcfPeriodAdjustmentIntegrity,
  buildProfessionalDcfInputPacket,
  verifyProfessionalDcfInputIntegrity,
};
