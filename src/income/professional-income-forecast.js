'use strict';

const crypto = require('crypto');
const { LEASE_INCOME_GATE_STATUS } = require('../market/lease-income-evidence');

const INCOME_FORECAST_LINE_TYPE = Object.freeze({
  CONTRACTUAL_RENT: 'CONTRACTUAL_RENT',
  MARKET_RENT: 'MARKET_RENT',
  RECOVERIES: 'RECOVERIES',
  OTHER_PROPERTY_INCOME: 'OTHER_PROPERTY_INCOME',
});

const INCOME_FORECAST_SOURCE = Object.freeze({
  VERIFIED_LEASE_EVIDENCE: 'VERIFIED_LEASE_EVIDENCE',
  VERIFIED_MARKET_EVIDENCE: 'VERIFIED_MARKET_EVIDENCE',
  EXTERNAL_PROFESSIONAL_REPORT: 'EXTERNAL_PROFESSIONAL_REPORT',
  PROFESSIONAL_JUDGMENT: 'PROFESSIONAL_JUDGMENT',
});

const NOI_CALCULATION_METHOD = Object.freeze({
  AMOUNT_SAR: 'AMOUNT_SAR',
  PERCENT_OF_PGI: 'PERCENT_OF_PGI',
  PERCENT_OF_EGI: 'PERCENT_OF_EGI',
});

const NOI_EXPENSE_CATEGORY = Object.freeze({
  PROPERTY_MANAGEMENT: 'PROPERTY_MANAGEMENT',
  REPAIRS_MAINTENANCE: 'REPAIRS_MAINTENANCE',
  UTILITIES_COMMON_AREA: 'UTILITIES_COMMON_AREA',
  INSURANCE: 'INSURANCE',
  SECURITY_CLEANING: 'SECURITY_CLEANING',
  PROPERTY_OPERATING_FEES: 'PROPERTY_OPERATING_FEES',
  OTHER_OPERATING_EXPENSE: 'OTHER_OPERATING_EXPENSE',
  REPLACEMENT_RESERVE: 'REPLACEMENT_RESERVE',
});

const NOI_CONVENTION = Object.freeze({
  BEFORE_REPLACEMENT_RESERVE: 'BEFORE_REPLACEMENT_RESERVE',
  AFTER_REPLACEMENT_RESERVE: 'AFTER_REPLACEMENT_RESERVE',
});

const PROFESSIONAL_INCOME_FORECAST_STATUS = Object.freeze({
  READY_FOR_CANONICAL_NOI: 'READY_FOR_CANONICAL_NOI',
  HOLD_INCOME_EVIDENCE: 'HOLD_INCOME_EVIDENCE',
  HOLD_FORECAST_STRUCTURE: 'HOLD_FORECAST_STRUCTURE',
  HOLD_PROVENANCE: 'HOLD_PROVENANCE',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
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
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return date.toISOString();
}
function finiteNonNegative(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`${field} must be a finite non-negative number`);
  }
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
function verifyHash(record, hashField) {
  if (!record || typeof record !== 'object' || !/^[a-f0-9]{64}$/i.test(String(record[hashField] || ''))) return false;
  const payload = { ...record };
  delete payload[hashField];
  return sha256(payload) === record[hashField].toLowerCase();
}
function normalizeEvidenceRefs(evidenceRefs, field) {
  if (!Array.isArray(evidenceRefs) || evidenceRefs.length === 0 || evidenceRefs.some((ref) => !nonEmpty(ref))) {
    throw new TypeError(`${field} must contain at least one non-empty evidence reference`);
  }
  return [...new Set(evidenceRefs.map((ref) => ref.trim()))];
}
function normalizeProfessionalProvenance(input, { asOfField = 'asOfDate' } = {}) {
  assertEnum(input.source, INCOME_FORECAST_SOURCE, 'source');
  assertNonEmpty(input.rationale, 'rationale');
  assertNonEmpty(input.preparedByRef, 'preparedByRef');
  assertNonEmpty(input.reviewedByRef, 'reviewedByRef');
  assertNonEmpty(input.reviewEvidenceRef, 'reviewEvidenceRef');
  const asOfDate = iso(input[asOfField], asOfField);
  const preparedAt = iso(input.preparedAt, 'preparedAt');
  const reviewedAt = iso(input.reviewedAt, 'reviewedAt');
  if (Date.parse(preparedAt) < Date.parse(asOfDate)) throw new TypeError('FORECAST_PREPARATION_BEFORE_SOURCE_AS_OF_DATE');
  if (Date.parse(reviewedAt) < Date.parse(preparedAt)) throw new TypeError('FORECAST_REVIEW_BEFORE_PREPARATION');
  return {
    source: input.source,
    sourceRef: nonEmpty(input.sourceRef) ? input.sourceRef.trim() : null,
    rationale: input.rationale.trim(),
    evidenceRefs: normalizeEvidenceRefs(input.evidenceRefs, 'evidenceRefs'),
    asOfDate,
    preparedByRef: input.preparedByRef.trim(),
    preparedAt,
    reviewedByRef: input.reviewedByRef.trim(),
    reviewedAt,
    reviewEvidenceRef: input.reviewEvidenceRef.trim(),
    professionalReviewExplicit: true,
    automaticallyDerived: false,
  };
}

function createIncomeForecastLine({
  lineId,
  caseId,
  propertyRef,
  periodIndex,
  type,
  amountSar,
  ...provenance
} = {}) {
  for (const [field, value] of [['lineId', lineId], ['caseId', caseId], ['propertyRef', propertyRef]]) assertNonEmpty(value, field);
  if (!Number.isInteger(periodIndex) || periodIndex < 1) throw new TypeError('periodIndex must be a positive integer');
  assertEnum(type, INCOME_FORECAST_LINE_TYPE, 'type');
  finiteNonNegative(amountSar, 'amountSar');
  const normalizedProvenance = normalizeProfessionalProvenance(provenance);
  if (type === INCOME_FORECAST_LINE_TYPE.CONTRACTUAL_RENT
      && normalizedProvenance.source !== INCOME_FORECAST_SOURCE.VERIFIED_LEASE_EVIDENCE) {
    throw new TypeError('CONTRACTUAL_RENT_REQUIRES_VERIFIED_LEASE_EVIDENCE');
  }
  const record = {
    schemaVersion: 1,
    lineId: lineId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    periodIndex,
    type,
    amountSar,
    ...normalizedProvenance,
    taxCharacterizationPerformed: false,
    financialEngineInputsWritten: false,
  };
  record.incomeForecastLineHashSha256 = sha256(record);
  return deepFreeze(record);
}

function createVacancyCollectionLossAssumption({
  assumptionId,
  caseId,
  propertyRef,
  periodIndex,
  method,
  value,
  ...provenance
} = {}) {
  for (const [field, item] of [['assumptionId', assumptionId], ['caseId', caseId], ['propertyRef', propertyRef]]) assertNonEmpty(item, field);
  if (!Number.isInteger(periodIndex) || periodIndex < 1) throw new TypeError('periodIndex must be a positive integer');
  if (![NOI_CALCULATION_METHOD.AMOUNT_SAR, NOI_CALCULATION_METHOD.PERCENT_OF_PGI].includes(method)) {
    throw new TypeError('vacancy/collection loss method must be AMOUNT_SAR or PERCENT_OF_PGI');
  }
  finiteNonNegative(value, 'value');
  if (method === NOI_CALCULATION_METHOD.PERCENT_OF_PGI && value > 1) throw new TypeError('vacancy/collection rate must be expressed as decimal <= 1');
  const normalizedProvenance = normalizeProfessionalProvenance(provenance);
  const record = {
    schemaVersion: 1,
    assumptionId: assumptionId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    periodIndex,
    method,
    value,
    ...normalizedProvenance,
    implicitZeroAssumptionUsed: false,
    automaticallyDerived: false,
  };
  record.vacancyCollectionLossHashSha256 = sha256(record);
  return deepFreeze(record);
}

function createOperatingExpenseForecastLine({
  expenseId,
  caseId,
  propertyRef,
  periodIndex,
  category,
  method,
  value,
  ...provenance
} = {}) {
  for (const [field, item] of [['expenseId', expenseId], ['caseId', caseId], ['propertyRef', propertyRef]]) assertNonEmpty(item, field);
  if (!Number.isInteger(periodIndex) || periodIndex < 1) throw new TypeError('periodIndex must be a positive integer');
  assertEnum(category, NOI_EXPENSE_CATEGORY, 'category');
  if (![NOI_CALCULATION_METHOD.AMOUNT_SAR, NOI_CALCULATION_METHOD.PERCENT_OF_EGI].includes(method)) {
    throw new TypeError('operating expense method must be AMOUNT_SAR or PERCENT_OF_EGI');
  }
  finiteNonNegative(value, 'value');
  if (method === NOI_CALCULATION_METHOD.PERCENT_OF_EGI && value > 1) throw new TypeError('operating expense rate must be expressed as decimal <= 1');
  const normalizedProvenance = normalizeProfessionalProvenance(provenance);
  const record = {
    schemaVersion: 1,
    expenseId: expenseId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    periodIndex,
    category,
    method,
    value,
    ...normalizedProvenance,
    debtServiceIncluded: false,
    depreciationIncluded: false,
    capitalExpenditureIncluded: false,
    incomeTaxIncluded: false,
    automaticallyDerived: false,
  };
  record.operatingExpenseLineHashSha256 = sha256(record);
  return deepFreeze(record);
}

function createIncomeForecastPeriod({
  periodId,
  caseId,
  propertyRef,
  periodIndex,
  label,
  startDate,
  endDate,
  isStabilized = false,
  incomeLines,
  vacancyCollectionLoss,
  operatingExpenseLines,
  periodRationale,
  preparedByRef,
  preparedAt,
  reviewedByRef,
  reviewedAt,
  reviewEvidenceRef,
} = {}) {
  for (const [field, value] of [['periodId', periodId], ['caseId', caseId], ['propertyRef', propertyRef], ['label', label], ['periodRationale', periodRationale], ['preparedByRef', preparedByRef], ['reviewedByRef', reviewedByRef], ['reviewEvidenceRef', reviewEvidenceRef]]) assertNonEmpty(value, field);
  if (!Number.isInteger(periodIndex) || periodIndex < 1) throw new TypeError('periodIndex must be a positive integer');
  if (typeof isStabilized !== 'boolean') throw new TypeError('isStabilized must be boolean');
  const startDateIso = iso(startDate, 'startDate');
  const endDateIso = iso(endDate, 'endDate');
  if (Date.parse(endDateIso) <= Date.parse(startDateIso)) throw new TypeError('FORECAST_PERIOD_END_MUST_FOLLOW_START');
  const preparedAtIso = iso(preparedAt, 'preparedAt');
  const reviewedAtIso = iso(reviewedAt, 'reviewedAt');
  if (Date.parse(reviewedAtIso) < Date.parse(preparedAtIso)) throw new TypeError('FORECAST_PERIOD_REVIEW_BEFORE_PREPARATION');
  if (!Array.isArray(incomeLines) || incomeLines.length === 0) throw new TypeError('incomeLines must contain at least one explicit line');
  if (!Array.isArray(operatingExpenseLines) || operatingExpenseLines.length === 0) throw new TypeError('operatingExpenseLines must contain at least one explicit line or explicit zero line');
  if (!vacancyCollectionLoss || typeof vacancyCollectionLoss !== 'object') throw new TypeError('vacancyCollectionLoss is required; implicit zero is not allowed');

  const record = {
    schemaVersion: 1,
    periodId: periodId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    periodIndex,
    label: label.trim(),
    startDate: startDateIso,
    endDate: endDateIso,
    isStabilized,
    incomeLines,
    vacancyCollectionLoss,
    operatingExpenseLines,
    periodRationale: periodRationale.trim(),
    preparedByRef: preparedByRef.trim(),
    preparedAt: preparedAtIso,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewedAtIso,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
    annualizedAmounts: true,
    leaseOptionsAutomaticallyExercised: false,
    automaticMarketRentApplied: false,
    noiCalculated: false,
  };
  record.incomeForecastPeriodHashSha256 = sha256(record);
  return deepFreeze(record);
}

function verifyIncomeEvidencePacketIntegrity(packet) {
  return verifyHash(packet, 'incomeEvidencePacketHashSha256');
}
function verifyIncomeForecastLineIntegrity(line) {
  return verifyHash(line, 'incomeForecastLineHashSha256');
}
function verifyVacancyCollectionLossIntegrity(assumption) {
  return verifyHash(assumption, 'vacancyCollectionLossHashSha256');
}
function verifyOperatingExpenseLineIntegrity(line) {
  return verifyHash(line, 'operatingExpenseLineHashSha256');
}
function verifyIncomeForecastPeriodIntegrity(period) {
  return verifyHash(period, 'incomeForecastPeriodHashSha256');
}

function hold(status, blockers, context = {}) {
  return deepFreeze({
    schemaVersion: 1,
    caseId: context.caseId || null,
    propertyRef: context.propertyRef || null,
    valuationDate: context.valuationDate || null,
    status,
    blockers,
    readyForCanonicalNoi: false,
    incomeEvidencePacketHashSha256: context.incomeEvidencePacketHashSha256 || null,
    noiConvention: context.noiConvention || null,
    forecastPeriods: [],
    stabilizedPeriodIndex: null,
    implicitVacancyAssumptionUsed: false,
    automaticLeaseOptionExercise: false,
    capitalizationPerformed: false,
    dcfPerformed: false,
    financialAnalysisPerformed: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function buildProfessionalIncomeForecastInput({
  packetId,
  caseId,
  propertyRef,
  valuationDate,
  incomeEvidencePacket,
  forecastPeriods,
  noiConvention,
  preparedByRef,
  preparedAt,
  packetEvidenceRef,
} = {}) {
  for (const [field, value] of [['packetId', packetId], ['caseId', caseId], ['propertyRef', propertyRef], ['preparedByRef', preparedByRef], ['packetEvidenceRef', packetEvidenceRef]]) assertNonEmpty(value, field);
  assertEnum(noiConvention, NOI_CONVENTION, 'noiConvention');
  const valuationDateIso = iso(valuationDate, 'valuationDate');
  const preparedAtIso = iso(preparedAt, 'preparedAt');
  if (Date.parse(preparedAtIso) < Date.parse(valuationDateIso)) throw new TypeError('INCOME_FORECAST_PACKET_PREPARED_BEFORE_VALUATION_DATE');
  if (!incomeEvidencePacket || incomeEvidencePacket.caseId !== caseId || incomeEvidencePacket.propertyRef !== propertyRef) {
    throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:incomeEvidencePacket');
  }
  if (incomeEvidencePacket.status !== LEASE_INCOME_GATE_STATUS.READY_FOR_INCOME_ANALYSIS_HANDOFF
      || incomeEvidencePacket.readyForIncomeAnalysisHandoff !== true
      || !verifyIncomeEvidencePacketIntegrity(incomeEvidencePacket)) {
    return hold(PROFESSIONAL_INCOME_FORECAST_STATUS.HOLD_INCOME_EVIDENCE, ['INCOME_EVIDENCE_PACKET_NOT_READY_OR_INTEGRITY_FAILED'], {
      caseId, propertyRef, valuationDate: valuationDateIso, noiConvention,
      incomeEvidencePacketHashSha256: incomeEvidencePacket.incomeEvidencePacketHashSha256 || null,
    });
  }
  if (iso(incomeEvidencePacket.asOfDate, 'incomeEvidencePacket.asOfDate') !== valuationDateIso) {
    return hold(PROFESSIONAL_INCOME_FORECAST_STATUS.HOLD_INCOME_EVIDENCE, ['INCOME_EVIDENCE_AS_OF_DATE_MUST_EQUAL_VALUATION_DATE'], {
      caseId, propertyRef, valuationDate: valuationDateIso, noiConvention,
      incomeEvidencePacketHashSha256: incomeEvidencePacket.incomeEvidencePacketHashSha256,
    });
  }
  if (!Array.isArray(forecastPeriods) || forecastPeriods.length === 0) {
    return hold(PROFESSIONAL_INCOME_FORECAST_STATUS.HOLD_FORECAST_STRUCTURE, ['FORECAST_PERIODS_REQUIRED'], { caseId, propertyRef, valuationDate: valuationDateIso, noiConvention });
  }

  const blockers = [];
  const provenanceBlockers = [];
  const integrityBlockers = [];
  const sortedPeriods = [...forecastPeriods].sort((a, b) => a.periodIndex - b.periodIndex);
  const periodIds = new Set();
  const lineIds = new Set();
  const expenseIds = new Set();
  const assumptionIds = new Set();
  let stabilizedCount = 0;
  let previousEnd = null;

  sortedPeriods.forEach((period, index) => {
    const expectedIndex = index + 1;
    if (!period || period.caseId !== caseId || period.propertyRef !== propertyRef) throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:forecastPeriod');
    if (period.periodIndex !== expectedIndex) blockers.push(`FORECAST_PERIOD_INDEX_MUST_BE_CONTIGUOUS:${period.periodIndex}/${expectedIndex}`);
    if (periodIds.has(period.periodId)) blockers.push(`DUPLICATE_FORECAST_PERIOD_ID:${period.periodId}`);
    periodIds.add(period.periodId);
    if (!verifyIncomeForecastPeriodIntegrity(period)) integrityBlockers.push(`FORECAST_PERIOD_INTEGRITY_FAILED:${period.periodId}`);
    if (period.isStabilized) stabilizedCount += 1;
    if (previousEnd && Date.parse(period.startDate) < Date.parse(previousEnd)) blockers.push(`FORECAST_PERIOD_OVERLAP:${period.periodId}`);
    previousEnd = period.endDate;
    if (Date.parse(period.startDate) < Date.parse(valuationDateIso)) blockers.push(`FORECAST_PERIOD_STARTS_BEFORE_VALUATION_DATE:${period.periodId}`);
    if (Date.parse(period.reviewedAt) > Date.parse(preparedAtIso)) provenanceBlockers.push(`FORECAST_PERIOD_REVIEW_AFTER_PACKET_PREPARATION:${period.periodId}`);

    for (const line of period.incomeLines || []) {
      if (!line || line.caseId !== caseId || line.propertyRef !== propertyRef || line.periodIndex !== period.periodIndex) throw new TypeError('CASE_PROPERTY_OR_PERIOD_ISOLATION_VIOLATION:incomeLine');
      if (lineIds.has(line.lineId)) blockers.push(`DUPLICATE_INCOME_LINE_ID:${line.lineId}`);
      lineIds.add(line.lineId);
      if (!verifyIncomeForecastLineIntegrity(line)) integrityBlockers.push(`INCOME_LINE_INTEGRITY_FAILED:${line.lineId}`);
      if (Date.parse(line.asOfDate) > Date.parse(valuationDateIso)) provenanceBlockers.push(`INCOME_LINE_AS_OF_AFTER_VALUATION_DATE:${line.lineId}`);
      if (Date.parse(line.reviewedAt) > Date.parse(period.preparedAt)) provenanceBlockers.push(`INCOME_LINE_REVIEW_AFTER_PERIOD_PREPARATION:${line.lineId}`);
    }
    const loss = period.vacancyCollectionLoss;
    if (!loss || loss.caseId !== caseId || loss.propertyRef !== propertyRef || loss.periodIndex !== period.periodIndex) throw new TypeError('CASE_PROPERTY_OR_PERIOD_ISOLATION_VIOLATION:vacancyCollectionLoss');
    if (assumptionIds.has(loss.assumptionId)) blockers.push(`DUPLICATE_VACANCY_ASSUMPTION_ID:${loss.assumptionId}`);
    assumptionIds.add(loss.assumptionId);
    if (!verifyVacancyCollectionLossIntegrity(loss)) integrityBlockers.push(`VACANCY_ASSUMPTION_INTEGRITY_FAILED:${loss.assumptionId}`);
    if (Date.parse(loss.asOfDate) > Date.parse(valuationDateIso)) provenanceBlockers.push(`VACANCY_ASSUMPTION_AS_OF_AFTER_VALUATION_DATE:${loss.assumptionId}`);
    if (Date.parse(loss.reviewedAt) > Date.parse(period.preparedAt)) provenanceBlockers.push(`VACANCY_ASSUMPTION_REVIEW_AFTER_PERIOD_PREPARATION:${loss.assumptionId}`);

    for (const expense of period.operatingExpenseLines || []) {
      if (!expense || expense.caseId !== caseId || expense.propertyRef !== propertyRef || expense.periodIndex !== period.periodIndex) throw new TypeError('CASE_PROPERTY_OR_PERIOD_ISOLATION_VIOLATION:operatingExpenseLine');
      if (expenseIds.has(expense.expenseId)) blockers.push(`DUPLICATE_OPERATING_EXPENSE_ID:${expense.expenseId}`);
      expenseIds.add(expense.expenseId);
      if (!verifyOperatingExpenseLineIntegrity(expense)) integrityBlockers.push(`OPERATING_EXPENSE_INTEGRITY_FAILED:${expense.expenseId}`);
      if (Date.parse(expense.asOfDate) > Date.parse(valuationDateIso)) provenanceBlockers.push(`OPERATING_EXPENSE_AS_OF_AFTER_VALUATION_DATE:${expense.expenseId}`);
      if (Date.parse(expense.reviewedAt) > Date.parse(period.preparedAt)) provenanceBlockers.push(`OPERATING_EXPENSE_REVIEW_AFTER_PERIOD_PREPARATION:${expense.expenseId}`);
    }
  });

  if (stabilizedCount !== 1) blockers.push(`EXACTLY_ONE_STABILIZED_PERIOD_REQUIRED:${stabilizedCount}`);
  if (integrityBlockers.length) return hold(PROFESSIONAL_INCOME_FORECAST_STATUS.HOLD_INTEGRITY, integrityBlockers, { caseId, propertyRef, valuationDate: valuationDateIso, noiConvention, incomeEvidencePacketHashSha256: incomeEvidencePacket.incomeEvidencePacketHashSha256 });
  if (provenanceBlockers.length) return hold(PROFESSIONAL_INCOME_FORECAST_STATUS.HOLD_PROVENANCE, provenanceBlockers, { caseId, propertyRef, valuationDate: valuationDateIso, noiConvention, incomeEvidencePacketHashSha256: incomeEvidencePacket.incomeEvidencePacketHashSha256 });
  if (blockers.length) return hold(PROFESSIONAL_INCOME_FORECAST_STATUS.HOLD_FORECAST_STRUCTURE, blockers, { caseId, propertyRef, valuationDate: valuationDateIso, noiConvention, incomeEvidencePacketHashSha256: incomeEvidencePacket.incomeEvidencePacketHashSha256 });

  const stabilizedPeriodIndex = sortedPeriods.find((period) => period.isStabilized).periodIndex;
  const core = {
    schemaVersion: 1,
    packetId: packetId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    valuationDate: valuationDateIso,
    incomeEvidencePacketHashSha256: incomeEvidencePacket.incomeEvidencePacketHashSha256,
    baselineAnnualContractRentSar: incomeEvidencePacket.annualContractRentSar,
    baselineOccupiedAreaSqm: incomeEvidencePacket.occupiedAreaSqm,
    baselineActiveLeaseCount: incomeEvidencePacket.activeLeaseCount,
    noiConvention,
    forecastPeriods: sortedPeriods,
    stabilizedPeriodIndex,
    preparedByRef: preparedByRef.trim(),
    preparedAt: preparedAtIso,
    packetEvidenceRef: packetEvidenceRef.trim(),
  };
  return deepFreeze({
    ...core,
    professionalIncomeForecastInputHashSha256: sha256(core),
    status: PROFESSIONAL_INCOME_FORECAST_STATUS.READY_FOR_CANONICAL_NOI,
    blockers: [],
    readyForCanonicalNoi: true,
    implicitVacancyAssumptionUsed: false,
    automaticLeaseOptionExercise: false,
    automaticMarketRentApplied: false,
    canonicalCalculationEngineRequired: true,
    capitalizationPerformed: false,
    dcfPerformed: false,
    financialAnalysisPerformed: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'This packet binds a verified lease-income evidence snapshot to explicit professionally reviewed annualized income, vacancy/collection loss, operating expense and replacement-reserve assumptions. It performs no NOI arithmetic, capitalization, DCF, financing, tax calculation, final valuation, certification or transaction authorization.',
  });
}

function verifyProfessionalIncomeForecastInputIntegrity(packet) {
  return verifyHash(packet, 'professionalIncomeForecastInputHashSha256');
}

module.exports = {
  INCOME_FORECAST_LINE_TYPE,
  INCOME_FORECAST_SOURCE,
  NOI_CALCULATION_METHOD,
  NOI_EXPENSE_CATEGORY,
  NOI_CONVENTION,
  PROFESSIONAL_INCOME_FORECAST_STATUS,
  createIncomeForecastLine,
  createVacancyCollectionLossAssumption,
  createOperatingExpenseForecastLine,
  createIncomeForecastPeriod,
  verifyIncomeEvidencePacketIntegrity,
  verifyIncomeForecastLineIntegrity,
  verifyVacancyCollectionLossIntegrity,
  verifyOperatingExpenseLineIntegrity,
  verifyIncomeForecastPeriodIntegrity,
  buildProfessionalIncomeForecastInput,
  verifyProfessionalIncomeForecastInputIntegrity,
};
