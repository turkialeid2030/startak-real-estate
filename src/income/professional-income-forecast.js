'use strict';

const crypto = require('crypto');
const { LEASE_INCOME_GATE_STATUS } = require('../market/lease-income-evidence');

const INCOME_FORECAST_LINE_TYPE = Object.freeze({
  CONTRACTUAL_RENT: 'CONTRACTUAL_RENT', MARKET_RENT: 'MARKET_RENT', RECOVERIES: 'RECOVERIES', OTHER_PROPERTY_INCOME: 'OTHER_PROPERTY_INCOME',
});
const INCOME_FORECAST_SOURCE = Object.freeze({
  VERIFIED_LEASE_EVIDENCE: 'VERIFIED_LEASE_EVIDENCE', VERIFIED_MARKET_EVIDENCE: 'VERIFIED_MARKET_EVIDENCE', EXTERNAL_PROFESSIONAL_REPORT: 'EXTERNAL_PROFESSIONAL_REPORT', PROFESSIONAL_JUDGMENT: 'PROFESSIONAL_JUDGMENT',
});
const NOI_CALCULATION_METHOD = Object.freeze({ AMOUNT_SAR: 'AMOUNT_SAR', PERCENT_OF_PGI: 'PERCENT_OF_PGI', PERCENT_OF_EGI: 'PERCENT_OF_EGI' });
const NOI_EXPENSE_CATEGORY = Object.freeze({
  PROPERTY_MANAGEMENT: 'PROPERTY_MANAGEMENT', REPAIRS_MAINTENANCE: 'REPAIRS_MAINTENANCE', UTILITIES_COMMON_AREA: 'UTILITIES_COMMON_AREA', INSURANCE: 'INSURANCE', SECURITY_CLEANING: 'SECURITY_CLEANING', PROPERTY_OPERATING_FEES: 'PROPERTY_OPERATING_FEES', OTHER_OPERATING_EXPENSE: 'OTHER_OPERATING_EXPENSE', REPLACEMENT_RESERVE: 'REPLACEMENT_RESERVE',
});
const NOI_CONVENTION = Object.freeze({ BEFORE_REPLACEMENT_RESERVE: 'BEFORE_REPLACEMENT_RESERVE', AFTER_REPLACEMENT_RESERVE: 'AFTER_REPLACEMENT_RESERVE' });
const PROFESSIONAL_INCOME_FORECAST_STATUS = Object.freeze({
  READY_FOR_CANONICAL_NOI: 'READY_FOR_CANONICAL_NOI', HOLD_INCOME_EVIDENCE: 'HOLD_INCOME_EVIDENCE', HOLD_FORECAST_STRUCTURE: 'HOLD_FORECAST_STRUCTURE', HOLD_PROVENANCE: 'HOLD_PROVENANCE', HOLD_INTEGRITY: 'HOLD_INTEGRITY',
});

function nonEmpty(v) { return typeof v === 'string' && v.trim().length > 0; }
function assertNonEmpty(v, f) { if (!nonEmpty(v)) throw new TypeError(`${f} must be a non-empty string`); }
function assertEnum(v, e, f) { if (!Object.values(e).includes(v)) throw new TypeError(`${f} is invalid`); }
function iso(v, f) { assertNonEmpty(v, f); const d = new Date(v); if (Number.isNaN(d.getTime())) throw new TypeError(`${f} must be a valid date/time`); return d.toISOString(); }
function finiteNonNegative(v, f) { if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new TypeError(`${f} must be a finite non-negative number`); }
function stableClone(v) { if (Array.isArray(v)) return v.map(stableClone); if (!v || typeof v !== 'object') return v; return Object.keys(v).sort().reduce((o, k) => { o[k] = stableClone(v[k]); return o; }, {}); }
function sha256(v) { return crypto.createHash('sha256').update(JSON.stringify(stableClone(v))).digest('hex'); }
function deepFreeze(v) { if (!v || typeof v !== 'object' || Object.isFrozen(v)) return v; Object.values(v).forEach(deepFreeze); return Object.freeze(v); }
function verifyHash(record, field) { if (!record || !/^[a-f0-9]{64}$/i.test(String(record[field] || ''))) return false; const p = { ...record }; delete p[field]; return sha256(p) === record[field].toLowerCase(); }
function evidenceRefs(values) { if (!Array.isArray(values) || values.length === 0 || values.some((v) => !nonEmpty(v))) throw new TypeError('evidenceRefs must contain at least one non-empty evidence reference'); return [...new Set(values.map((v) => v.trim()))]; }

function provenance(p) {
  assertEnum(p.source, INCOME_FORECAST_SOURCE, 'source');
  ['rationale', 'preparedByRef', 'reviewedByRef', 'reviewEvidenceRef'].forEach((f) => assertNonEmpty(p[f], f));
  const asOfDate = iso(p.asOfDate, 'asOfDate'); const preparedAt = iso(p.preparedAt, 'preparedAt'); const reviewedAt = iso(p.reviewedAt, 'reviewedAt');
  if (Date.parse(preparedAt) < Date.parse(asOfDate)) throw new TypeError('FORECAST_PREPARATION_BEFORE_SOURCE_AS_OF_DATE');
  if (Date.parse(reviewedAt) < Date.parse(preparedAt)) throw new TypeError('FORECAST_REVIEW_BEFORE_PREPARATION');
  return { source: p.source, sourceRef: nonEmpty(p.sourceRef) ? p.sourceRef.trim() : null, rationale: p.rationale.trim(), evidenceRefs: evidenceRefs(p.evidenceRefs), asOfDate, preparedByRef: p.preparedByRef.trim(), preparedAt, reviewedByRef: p.reviewedByRef.trim(), reviewedAt, reviewEvidenceRef: p.reviewEvidenceRef.trim(), professionalReviewExplicit: true, automaticallyDerived: false };
}

function createIncomeForecastLine({ lineId, caseId, propertyRef, periodIndex, type, amountSar, ...p } = {}) {
  [['lineId', lineId], ['caseId', caseId], ['propertyRef', propertyRef]].forEach(([f, v]) => assertNonEmpty(v, f));
  if (!Number.isInteger(periodIndex) || periodIndex < 1) throw new TypeError('periodIndex must be a positive integer');
  assertEnum(type, INCOME_FORECAST_LINE_TYPE, 'type'); finiteNonNegative(amountSar, 'amountSar');
  const prov = provenance(p);
  if (type === INCOME_FORECAST_LINE_TYPE.CONTRACTUAL_RENT && prov.source !== INCOME_FORECAST_SOURCE.VERIFIED_LEASE_EVIDENCE) throw new TypeError('CONTRACTUAL_RENT_REQUIRES_VERIFIED_LEASE_EVIDENCE');
  const r = { schemaVersion: 1, lineId: lineId.trim(), caseId: caseId.trim(), propertyRef: propertyRef.trim(), periodIndex, type, amountSar, ...prov, taxCharacterizationPerformed: false, financialEngineInputsWritten: false };
  r.incomeForecastLineHashSha256 = sha256(r); return deepFreeze(r);
}
function createVacancyCollectionLossAssumption({ assumptionId, caseId, propertyRef, periodIndex, method, value, ...p } = {}) {
  [['assumptionId', assumptionId], ['caseId', caseId], ['propertyRef', propertyRef]].forEach(([f, v]) => assertNonEmpty(v, f));
  if (!Number.isInteger(periodIndex) || periodIndex < 1) throw new TypeError('periodIndex must be a positive integer');
  if (![NOI_CALCULATION_METHOD.AMOUNT_SAR, NOI_CALCULATION_METHOD.PERCENT_OF_PGI].includes(method)) throw new TypeError('vacancy/collection loss method must be AMOUNT_SAR or PERCENT_OF_PGI');
  finiteNonNegative(value, 'value'); if (method === NOI_CALCULATION_METHOD.PERCENT_OF_PGI && value > 1) throw new TypeError('vacancy/collection rate must be expressed as decimal <= 1');
  const r = { schemaVersion: 1, assumptionId: assumptionId.trim(), caseId: caseId.trim(), propertyRef: propertyRef.trim(), periodIndex, method, value, ...provenance(p), implicitZeroAssumptionUsed: false, automaticallyDerived: false };
  r.vacancyCollectionLossHashSha256 = sha256(r); return deepFreeze(r);
}
function createOperatingExpenseForecastLine({ expenseId, caseId, propertyRef, periodIndex, category, method, value, ...p } = {}) {
  [['expenseId', expenseId], ['caseId', caseId], ['propertyRef', propertyRef]].forEach(([f, v]) => assertNonEmpty(v, f));
  if (!Number.isInteger(periodIndex) || periodIndex < 1) throw new TypeError('periodIndex must be a positive integer');
  assertEnum(category, NOI_EXPENSE_CATEGORY, 'category');
  if (![NOI_CALCULATION_METHOD.AMOUNT_SAR, NOI_CALCULATION_METHOD.PERCENT_OF_EGI].includes(method)) throw new TypeError('operating expense method must be AMOUNT_SAR or PERCENT_OF_EGI');
  finiteNonNegative(value, 'value'); if (method === NOI_CALCULATION_METHOD.PERCENT_OF_EGI && value > 1) throw new TypeError('operating expense rate must be expressed as decimal <= 1');
  const r = { schemaVersion: 1, expenseId: expenseId.trim(), caseId: caseId.trim(), propertyRef: propertyRef.trim(), periodIndex, category, method, value, ...provenance(p), debtServiceIncluded: false, depreciationIncluded: false, capitalExpenditureIncluded: false, incomeTaxIncluded: false, automaticallyDerived: false };
  r.operatingExpenseLineHashSha256 = sha256(r); return deepFreeze(r);
}
function createIncomeForecastPeriod({ periodId, caseId, propertyRef, periodIndex, label, startDate, endDate, isStabilized = false, incomeLines, vacancyCollectionLoss, operatingExpenseLines, periodRationale, preparedByRef, preparedAt, reviewedByRef, reviewedAt, reviewEvidenceRef } = {}) {
  [['periodId', periodId], ['caseId', caseId], ['propertyRef', propertyRef], ['label', label], ['periodRationale', periodRationale], ['preparedByRef', preparedByRef], ['reviewedByRef', reviewedByRef], ['reviewEvidenceRef', reviewEvidenceRef]].forEach(([f, v]) => assertNonEmpty(v, f));
  if (!Number.isInteger(periodIndex) || periodIndex < 1) throw new TypeError('periodIndex must be a positive integer'); if (typeof isStabilized !== 'boolean') throw new TypeError('isStabilized must be boolean');
  const s = iso(startDate, 'startDate'); const e = iso(endDate, 'endDate'); if (Date.parse(e) <= Date.parse(s)) throw new TypeError('FORECAST_PERIOD_END_MUST_FOLLOW_START');
  const pa = iso(preparedAt, 'preparedAt'); const ra = iso(reviewedAt, 'reviewedAt'); if (Date.parse(ra) < Date.parse(pa)) throw new TypeError('FORECAST_PERIOD_REVIEW_BEFORE_PREPARATION');
  if (!Array.isArray(incomeLines) || incomeLines.length === 0) throw new TypeError('incomeLines must contain at least one explicit line');
  if (!Array.isArray(operatingExpenseLines) || operatingExpenseLines.length === 0) throw new TypeError('operatingExpenseLines must contain at least one explicit line or explicit zero line');
  if (!vacancyCollectionLoss || typeof vacancyCollectionLoss !== 'object') throw new TypeError('vacancyCollectionLoss is required; implicit zero is not allowed');
  const r = { schemaVersion: 1, periodId: periodId.trim(), caseId: caseId.trim(), propertyRef: propertyRef.trim(), periodIndex, label: label.trim(), startDate: s, endDate: e, isStabilized, incomeLines, vacancyCollectionLoss, operatingExpenseLines, periodRationale: periodRationale.trim(), preparedByRef: preparedByRef.trim(), preparedAt: pa, reviewedByRef: reviewedByRef.trim(), reviewedAt: ra, reviewEvidenceRef: reviewEvidenceRef.trim(), annualizedAmounts: true, leaseOptionsAutomaticallyExercised: false, automaticMarketRentApplied: false, noiCalculated: false };
  r.incomeForecastPeriodHashSha256 = sha256(r); return deepFreeze(r);
}

const verifyIncomeEvidencePacketIntegrity = (p) => verifyHash(p, 'incomeEvidencePacketHashSha256');
const verifyIncomeForecastLineIntegrity = (p) => verifyHash(p, 'incomeForecastLineHashSha256');
const verifyVacancyCollectionLossIntegrity = (p) => verifyHash(p, 'vacancyCollectionLossHashSha256');
const verifyOperatingExpenseLineIntegrity = (p) => verifyHash(p, 'operatingExpenseLineHashSha256');
const verifyIncomeForecastPeriodIntegrity = (p) => verifyHash(p, 'incomeForecastPeriodHashSha256');

function hold(status, blockers, c = {}) { return deepFreeze({ schemaVersion: 1, caseId: c.caseId || null, propertyRef: c.propertyRef || null, valuationDate: c.valuationDate || null, status, blockers, readyForCanonicalNoi: false, incomeEvidencePacketHashSha256: c.incomeEvidencePacketHashSha256 || null, noiConvention: c.noiConvention || null, forecastPeriods: [], stabilizedPeriodIndex: null, implicitVacancyAssumptionUsed: false, automaticLeaseOptionExercise: false, capitalizationPerformed: false, dcfPerformed: false, financialAnalysisPerformed: false, certifiedValuationEstablished: false, transactionAuthorized: false }); }

function buildProfessionalIncomeForecastInput({ packetId, caseId, propertyRef, valuationDate, incomeEvidencePacket, forecastPeriods, noiConvention, preparedByRef, preparedAt, packetEvidenceRef } = {}) {
  [['packetId', packetId], ['caseId', caseId], ['propertyRef', propertyRef], ['preparedByRef', preparedByRef], ['packetEvidenceRef', packetEvidenceRef]].forEach(([f, v]) => assertNonEmpty(v, f)); assertEnum(noiConvention, NOI_CONVENTION, 'noiConvention');
  const vd = iso(valuationDate, 'valuationDate'); const pa = iso(preparedAt, 'preparedAt'); if (Date.parse(pa) < Date.parse(vd)) throw new TypeError('INCOME_FORECAST_PACKET_PREPARED_BEFORE_VALUATION_DATE');
  if (!incomeEvidencePacket || incomeEvidencePacket.caseId !== caseId || incomeEvidencePacket.propertyRef !== propertyRef) throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:incomeEvidencePacket');
  const ctx = { caseId, propertyRef, valuationDate: vd, noiConvention, incomeEvidencePacketHashSha256: incomeEvidencePacket.incomeEvidencePacketHashSha256 || null };
  if (incomeEvidencePacket.status !== LEASE_INCOME_GATE_STATUS.READY_FOR_INCOME_ANALYSIS_HANDOFF || incomeEvidencePacket.readyForIncomeAnalysisHandoff !== true || !verifyIncomeEvidencePacketIntegrity(incomeEvidencePacket)) return hold(PROFESSIONAL_INCOME_FORECAST_STATUS.HOLD_INCOME_EVIDENCE, ['INCOME_EVIDENCE_PACKET_NOT_READY_OR_INTEGRITY_FAILED'], ctx);
  if (iso(incomeEvidencePacket.asOfDate, 'incomeEvidencePacket.asOfDate') !== vd) return hold(PROFESSIONAL_INCOME_FORECAST_STATUS.HOLD_INCOME_EVIDENCE, ['INCOME_EVIDENCE_AS_OF_DATE_MUST_EQUAL_VALUATION_DATE'], ctx);
  if (!Array.isArray(forecastPeriods) || forecastPeriods.length === 0) return hold(PROFESSIONAL_INCOME_FORECAST_STATUS.HOLD_FORECAST_STRUCTURE, ['FORECAST_PERIODS_REQUIRED'], ctx);

  const structure = [], prov = [], integrity = []; const sorted = [...forecastPeriods].sort((a, b) => a.periodIndex - b.periodIndex); const pids = new Set(), lids = new Set(), eids = new Set(), aids = new Set(); let stabilized = 0, previousEnd = null;
  sorted.forEach((p, i) => {
    if (!p || p.caseId !== caseId || p.propertyRef !== propertyRef) throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:forecastPeriod');
    if (p.periodIndex !== i + 1) structure.push(`FORECAST_PERIOD_INDEX_MUST_BE_CONTIGUOUS:${p.periodIndex}/${i + 1}`); if (pids.has(p.periodId)) structure.push(`DUPLICATE_FORECAST_PERIOD_ID:${p.periodId}`); pids.add(p.periodId);
    if (!verifyIncomeForecastPeriodIntegrity(p)) integrity.push(`FORECAST_PERIOD_INTEGRITY_FAILED:${p.periodId}`); if (p.isStabilized) stabilized += 1;
    if (previousEnd && Date.parse(p.startDate) < Date.parse(previousEnd)) structure.push(`FORECAST_PERIOD_OVERLAP:${p.periodId}`); previousEnd = p.endDate;
    if (Date.parse(p.startDate) < Date.parse(vd)) structure.push(`FORECAST_PERIOD_STARTS_BEFORE_VALUATION_DATE:${p.periodId}`); if (Date.parse(p.reviewedAt) > Date.parse(pa)) prov.push(`FORECAST_PERIOD_REVIEW_AFTER_PACKET_PREPARATION:${p.periodId}`);
    (p.incomeLines || []).forEach((l) => { if (!l || l.caseId !== caseId || l.propertyRef !== propertyRef || l.periodIndex !== p.periodIndex) throw new TypeError('CASE_PROPERTY_OR_PERIOD_ISOLATION_VIOLATION:incomeLine'); if (lids.has(l.lineId)) structure.push(`DUPLICATE_INCOME_LINE_ID:${l.lineId}`); lids.add(l.lineId); if (!verifyIncomeForecastLineIntegrity(l)) integrity.push(`INCOME_LINE_INTEGRITY_FAILED:${l.lineId}`); if (Date.parse(l.asOfDate) > Date.parse(vd)) prov.push(`INCOME_LINE_AS_OF_AFTER_VALUATION_DATE:${l.lineId}`); if (Date.parse(l.reviewedAt) > Date.parse(p.preparedAt)) prov.push(`INCOME_LINE_REVIEW_AFTER_PERIOD_PREPARATION:${l.lineId}`); });
    const l = p.vacancyCollectionLoss; if (!l || l.caseId !== caseId || l.propertyRef !== propertyRef || l.periodIndex !== p.periodIndex) throw new TypeError('CASE_PROPERTY_OR_PERIOD_ISOLATION_VIOLATION:vacancyCollectionLoss'); if (aids.has(l.assumptionId)) structure.push(`DUPLICATE_VACANCY_ASSUMPTION_ID:${l.assumptionId}`); aids.add(l.assumptionId); if (!verifyVacancyCollectionLossIntegrity(l)) integrity.push(`VACANCY_ASSUMPTION_INTEGRITY_FAILED:${l.assumptionId}`); if (Date.parse(l.asOfDate) > Date.parse(vd)) prov.push(`VACANCY_ASSUMPTION_AS_OF_AFTER_VALUATION_DATE:${l.assumptionId}`); if (Date.parse(l.reviewedAt) > Date.parse(p.preparedAt)) prov.push(`VACANCY_ASSUMPTION_REVIEW_AFTER_PERIOD_PREPARATION:${l.assumptionId}`);
    (p.operatingExpenseLines || []).forEach((e) => { if (!e || e.caseId !== caseId || e.propertyRef !== propertyRef || e.periodIndex !== p.periodIndex) throw new TypeError('CASE_PROPERTY_OR_PERIOD_ISOLATION_VIOLATION:operatingExpenseLine'); if (eids.has(e.expenseId)) structure.push(`DUPLICATE_OPERATING_EXPENSE_ID:${e.expenseId}`); eids.add(e.expenseId); if (!verifyOperatingExpenseLineIntegrity(e)) integrity.push(`OPERATING_EXPENSE_INTEGRITY_FAILED:${e.expenseId}`); if (Date.parse(e.asOfDate) > Date.parse(vd)) prov.push(`OPERATING_EXPENSE_AS_OF_AFTER_VALUATION_DATE:${e.expenseId}`); if (Date.parse(e.reviewedAt) > Date.parse(p.preparedAt)) prov.push(`OPERATING_EXPENSE_REVIEW_AFTER_PERIOD_PREPARATION:${e.expenseId}`); });
  });
  if (stabilized !== 1) structure.push(`EXACTLY_ONE_STABILIZED_PERIOD_REQUIRED:${stabilized}`); if (integrity.length) return hold(PROFESSIONAL_INCOME_FORECAST_STATUS.HOLD_INTEGRITY, integrity, ctx); if (prov.length) return hold(PROFESSIONAL_INCOME_FORECAST_STATUS.HOLD_PROVENANCE, prov, ctx); if (structure.length) return hold(PROFESSIONAL_INCOME_FORECAST_STATUS.HOLD_FORECAST_STRUCTURE, structure, ctx);
  const core = { schemaVersion: 1, packetId: packetId.trim(), caseId: caseId.trim(), propertyRef: propertyRef.trim(), valuationDate: vd, incomeEvidencePacketHashSha256: incomeEvidencePacket.incomeEvidencePacketHashSha256, baselineAnnualContractRentSar: incomeEvidencePacket.annualContractRentSar, baselineOccupiedAreaSqm: incomeEvidencePacket.occupiedAreaSqm, baselineActiveLeaseCount: incomeEvidencePacket.activeLeaseCount, noiConvention, forecastPeriods: sorted, stabilizedPeriodIndex: sorted.find((p) => p.isStabilized).periodIndex, preparedByRef: preparedByRef.trim(), preparedAt: pa, packetEvidenceRef: packetEvidenceRef.trim() };
  return deepFreeze({ ...core, professionalIncomeForecastInputHashSha256: sha256(core), status: PROFESSIONAL_INCOME_FORECAST_STATUS.READY_FOR_CANONICAL_NOI, blockers: [], readyForCanonicalNoi: true, implicitVacancyAssumptionUsed: false, automaticLeaseOptionExercise: false, automaticMarketRentApplied: false, canonicalCalculationEngineRequired: true, capitalizationPerformed: false, dcfPerformed: false, financialAnalysisPerformed: false, certifiedValuationEstablished: false, transactionAuthorized: false, semantics: 'This packet binds a verified lease-income evidence snapshot to explicit professionally reviewed annualized income, vacancy/collection loss, operating expense and replacement-reserve assumptions. It performs no NOI arithmetic, capitalization, DCF, financing, tax calculation, final valuation, certification or transaction authorization.' });
}

function verifyProfessionalIncomeForecastInputIntegrity(packet) {
  if (!packet || !/^[a-f0-9]{64}$/i.test(String(packet.professionalIncomeForecastInputHashSha256 || ''))) return false;
  const core = { ...packet };
  ['professionalIncomeForecastInputHashSha256', 'status', 'blockers', 'readyForCanonicalNoi', 'implicitVacancyAssumptionUsed', 'automaticLeaseOptionExercise', 'automaticMarketRentApplied', 'canonicalCalculationEngineRequired', 'capitalizationPerformed', 'dcfPerformed', 'financialAnalysisPerformed', 'certifiedValuationEstablished', 'transactionAuthorized', 'semantics'].forEach((k) => delete core[k]);
  return sha256(core) === packet.professionalIncomeForecastInputHashSha256.toLowerCase();
}

module.exports = { INCOME_FORECAST_LINE_TYPE, INCOME_FORECAST_SOURCE, NOI_CALCULATION_METHOD, NOI_EXPENSE_CATEGORY, NOI_CONVENTION, PROFESSIONAL_INCOME_FORECAST_STATUS, createIncomeForecastLine, createVacancyCollectionLossAssumption, createOperatingExpenseForecastLine, createIncomeForecastPeriod, verifyIncomeEvidencePacketIntegrity, verifyIncomeForecastLineIntegrity, verifyVacancyCollectionLossIntegrity, verifyOperatingExpenseLineIntegrity, verifyIncomeForecastPeriodIntegrity, buildProfessionalIncomeForecastInput, verifyProfessionalIncomeForecastInputIntegrity };
