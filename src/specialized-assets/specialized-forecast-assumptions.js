'use strict';

const crypto = require('crypto');
const {
  SPECIALIZED_ASSET_CLASS,
  SPECIALIZED_OPERATING_MODEL,
  SPECIALIZED_ASSET_PACKET_STATUS,
  verifySpecializedAssetEvidencePacketIntegrity,
} = require('./specialized-asset-evidence');

const SPECIALIZED_FORECAST_FAMILY = Object.freeze({
  HOSPITALITY: 'HOSPITALITY',
  LEISURE: 'LEISURE',
});

const SPECIALIZED_FORECAST_METRIC = Object.freeze({
  AVAILABLE_ROOM_NIGHTS: 'AVAILABLE_ROOM_NIGHTS',
  OCCUPANCY_RATE: 'OCCUPANCY_RATE',
  ADR_SAR: 'ADR_SAR',
  FOOD_BEVERAGE_REVENUE_SAR: 'FOOD_BEVERAGE_REVENUE_SAR',
  OTHER_REVENUE_SAR: 'OTHER_REVENUE_SAR',
  DEPARTMENTAL_EXPENSES_SAR: 'DEPARTMENTAL_EXPENSES_SAR',
  UNDISTRIBUTED_EXPENSES_SAR: 'UNDISTRIBUTED_EXPENSES_SAR',
  MANAGEMENT_FEES_SAR: 'MANAGEMENT_FEES_SAR',
  FRANCHISE_FEES_SAR: 'FRANCHISE_FEES_SAR',
  FF_E_RESERVE_SAR: 'FF_E_RESERVE_SAR',
  OPERATING_DAYS: 'OPERATING_DAYS',
  ATTENDANCE: 'ATTENDANCE',
  ADMISSIONS_REVENUE_PER_VISITOR_SAR: 'ADMISSIONS_REVENUE_PER_VISITOR_SAR',
  ANCILLARY_SPEND_PER_VISITOR_SAR: 'ANCILLARY_SPEND_PER_VISITOR_SAR',
  DIRECT_OPERATING_EXPENSES_SAR: 'DIRECT_OPERATING_EXPENSES_SAR',
  CAPITAL_RESERVE_SAR: 'CAPITAL_RESERVE_SAR',
});

const FORECAST_ASSUMPTION_ORIGIN = Object.freeze({
  USER_ENTERED: 'USER_ENTERED',
  PROFESSIONAL_JUDGMENT: 'PROFESSIONAL_JUDGMENT',
});

const SPECIALIZED_FORECAST_STATUS = Object.freeze({
  READY_FOR_SPECIALIZED_FORECAST_CALCULATION: 'READY_FOR_SPECIALIZED_FORECAST_CALCULATION',
  NOT_APPLICABLE_ASSET_CLASS: 'NOT_APPLICABLE_ASSET_CLASS',
  HOLD_SPECIALIZED_PACKET: 'HOLD_SPECIALIZED_PACKET',
  HOLD_FORECAST_ASSUMPTIONS: 'HOLD_FORECAST_ASSUMPTIONS',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
});

const HOSPITALITY_CLASSES = Object.freeze([
  SPECIALIZED_ASSET_CLASS.HOTEL_FULL_SERVICE,
  SPECIALIZED_ASSET_CLASS.HOTEL_LIMITED_SERVICE,
  SPECIALIZED_ASSET_CLASS.SERVICED_APARTMENTS,
  SPECIALIZED_ASSET_CLASS.RESORT,
]);

const HOSPITALITY_ALLOWED = Object.freeze([
  SPECIALIZED_FORECAST_METRIC.AVAILABLE_ROOM_NIGHTS,
  SPECIALIZED_FORECAST_METRIC.OCCUPANCY_RATE,
  SPECIALIZED_FORECAST_METRIC.ADR_SAR,
  SPECIALIZED_FORECAST_METRIC.FOOD_BEVERAGE_REVENUE_SAR,
  SPECIALIZED_FORECAST_METRIC.OTHER_REVENUE_SAR,
  SPECIALIZED_FORECAST_METRIC.DEPARTMENTAL_EXPENSES_SAR,
  SPECIALIZED_FORECAST_METRIC.UNDISTRIBUTED_EXPENSES_SAR,
  SPECIALIZED_FORECAST_METRIC.MANAGEMENT_FEES_SAR,
  SPECIALIZED_FORECAST_METRIC.FRANCHISE_FEES_SAR,
  SPECIALIZED_FORECAST_METRIC.FF_E_RESERVE_SAR,
]);

const LEISURE_ALLOWED = Object.freeze([
  SPECIALIZED_FORECAST_METRIC.OPERATING_DAYS,
  SPECIALIZED_FORECAST_METRIC.ATTENDANCE,
  SPECIALIZED_FORECAST_METRIC.ADMISSIONS_REVENUE_PER_VISITOR_SAR,
  SPECIALIZED_FORECAST_METRIC.ANCILLARY_SPEND_PER_VISITOR_SAR,
  SPECIALIZED_FORECAST_METRIC.DIRECT_OPERATING_EXPENSES_SAR,
  SPECIALIZED_FORECAST_METRIC.UNDISTRIBUTED_EXPENSES_SAR,
  SPECIALIZED_FORECAST_METRIC.MANAGEMENT_FEES_SAR,
  SPECIALIZED_FORECAST_METRIC.CAPITAL_RESERVE_SAR,
]);

function nonEmpty(value) { return typeof value === 'string' && value.trim().length > 0; }
function assertNonEmpty(value, field) { if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`); }
function assertEnum(value, enumeration, field) { if (!Object.values(enumeration).includes(value)) throw new TypeError(`${field} is invalid`); }
function finiteNonNegative(value, field) { if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new TypeError(`${field} must be a finite non-negative number`); }
function iso(value, field) {
  assertNonEmpty(value, field);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return parsed.toISOString();
}
function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = stableClone(value[key]); return out; }, {});
}
function sha256(value) { return crypto.createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex'); }
function validSha(value) { return nonEmpty(value) && /^[a-f0-9]{64}$/i.test(value); }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
function normalizeRefs(values, field) {
  if (!Array.isArray(values) || values.length === 0 || values.some((v) => !nonEmpty(v))) throw new TypeError(`${field} must contain non-empty references`);
  return [...new Set(values.map((v) => v.trim()))].sort();
}

function familyForAssetClass(assetClass) {
  if (HOSPITALITY_CLASSES.includes(assetClass)) return SPECIALIZED_FORECAST_FAMILY.HOSPITALITY;
  if (assetClass === SPECIALIZED_ASSET_CLASS.LEISURE_ATTRACTION) return SPECIALIZED_FORECAST_FAMILY.LEISURE;
  return null;
}

function createSpecializedForecastLine({
  lineId,
  metric,
  value,
  unit,
  origin,
  rationale,
  evidenceRefs,
  preparedByRef,
  preparedAt,
  reviewedByRef,
  reviewedAt,
  reviewEvidenceRef,
} = {}) {
  for (const [field, v] of [
    ['lineId', lineId], ['unit', unit], ['rationale', rationale], ['preparedByRef', preparedByRef],
    ['reviewedByRef', reviewedByRef], ['reviewEvidenceRef', reviewEvidenceRef],
  ]) assertNonEmpty(v, field);
  assertEnum(metric, SPECIALIZED_FORECAST_METRIC, 'metric');
  assertEnum(origin, FORECAST_ASSUMPTION_ORIGIN, 'origin');
  finiteNonNegative(value, 'value');
  if (metric === SPECIALIZED_FORECAST_METRIC.OCCUPANCY_RATE && value > 1) throw new TypeError('OCCUPANCY_RATE must be between 0 and 1');
  const prepared = iso(preparedAt, 'preparedAt');
  const reviewed = iso(reviewedAt, 'reviewedAt');
  if (Date.parse(reviewed) < Date.parse(prepared)) throw new TypeError('FORECAST_LINE_REVIEW_BEFORE_PREPARATION');
  const core = {
    schemaVersion: 1,
    lineId: lineId.trim(),
    metric,
    value,
    unit: unit.trim(),
    origin,
    rationale: rationale.trim(),
    evidenceRefs: normalizeRefs(evidenceRefs, 'evidenceRefs'),
    preparedByRef: preparedByRef.trim(),
    preparedAt: prepared,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewed,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
  };
  return deepFreeze({
    ...core,
    specializedForecastLineHashSha256: sha256(core),
    automaticallyDerivedFromHistoricalMetrics: false,
    probabilityAssigned: false,
    valuationInputAdopted: false,
  });
}

function verifySpecializedForecastLineIntegrity(line) {
  if (!line || !validSha(line.specializedForecastLineHashSha256)) return false;
  const core = { ...line };
  ['specializedForecastLineHashSha256', 'automaticallyDerivedFromHistoricalMetrics', 'probabilityAssigned', 'valuationInputAdopted'].forEach((key) => delete core[key]);
  return sha256(core) === line.specializedForecastLineHashSha256.toLowerCase();
}

function createSpecializedForecastPeriod({ periodId, periodStart, periodEnd, lines } = {}) {
  assertNonEmpty(periodId, 'periodId');
  const start = iso(periodStart, 'periodStart');
  const end = iso(periodEnd, 'periodEnd');
  if (Date.parse(end) <= Date.parse(start)) throw new TypeError('FORECAST_PERIOD_END_MUST_BE_AFTER_START');
  if (!Array.isArray(lines) || lines.length === 0) throw new TypeError('lines must be a non-empty array');
  const metrics = new Set();
  const ids = new Set();
  for (const line of lines) {
    if (!verifySpecializedForecastLineIntegrity(line)) throw new TypeError(`FORECAST_LINE_INTEGRITY_FAILED:${line?.lineId || 'UNKNOWN'}`);
    if (ids.has(line.lineId)) throw new TypeError(`DUPLICATE_FORECAST_LINE_ID:${line.lineId}`);
    if (metrics.has(line.metric)) throw new TypeError(`DUPLICATE_FORECAST_METRIC:${line.metric}`);
    ids.add(line.lineId);
    metrics.add(line.metric);
  }
  const core = { schemaVersion: 1, periodId: periodId.trim(), periodStart: start, periodEnd: end, lines: [...lines] };
  return deepFreeze({ ...core, specializedForecastPeriodHashSha256: sha256(core) });
}

function verifySpecializedForecastPeriodIntegrity(period) {
  if (!period || !validSha(period.specializedForecastPeriodHashSha256)) return false;
  const { specializedForecastPeriodHashSha256, ...core } = period;
  if (!Array.isArray(core.lines) || core.lines.some((line) => !verifySpecializedForecastLineIntegrity(line))) return false;
  return sha256(core) === specializedForecastPeriodHashSha256.toLowerCase();
}

function requiredMetrics(assetClass, operatingModel) {
  const family = familyForAssetClass(assetClass);
  if (family === SPECIALIZED_FORECAST_FAMILY.HOSPITALITY) {
    const required = new Set([
      SPECIALIZED_FORECAST_METRIC.AVAILABLE_ROOM_NIGHTS,
      SPECIALIZED_FORECAST_METRIC.OCCUPANCY_RATE,
      SPECIALIZED_FORECAST_METRIC.ADR_SAR,
      SPECIALIZED_FORECAST_METRIC.DEPARTMENTAL_EXPENSES_SAR,
      SPECIALIZED_FORECAST_METRIC.UNDISTRIBUTED_EXPENSES_SAR,
      SPECIALIZED_FORECAST_METRIC.FF_E_RESERVE_SAR,
    ]);
    if ([SPECIALIZED_ASSET_CLASS.HOTEL_FULL_SERVICE, SPECIALIZED_ASSET_CLASS.RESORT].includes(assetClass)) required.add(SPECIALIZED_FORECAST_METRIC.FOOD_BEVERAGE_REVENUE_SAR);
    if (operatingModel === SPECIALIZED_OPERATING_MODEL.MANAGEMENT_AGREEMENT) required.add(SPECIALIZED_FORECAST_METRIC.MANAGEMENT_FEES_SAR);
    if (operatingModel === SPECIALIZED_OPERATING_MODEL.FRANCHISE) required.add(SPECIALIZED_FORECAST_METRIC.FRANCHISE_FEES_SAR);
    return [...required].sort();
  }
  if (family === SPECIALIZED_FORECAST_FAMILY.LEISURE) {
    const required = new Set([
      SPECIALIZED_FORECAST_METRIC.OPERATING_DAYS,
      SPECIALIZED_FORECAST_METRIC.ATTENDANCE,
      SPECIALIZED_FORECAST_METRIC.ADMISSIONS_REVENUE_PER_VISITOR_SAR,
      SPECIALIZED_FORECAST_METRIC.ANCILLARY_SPEND_PER_VISITOR_SAR,
      SPECIALIZED_FORECAST_METRIC.DIRECT_OPERATING_EXPENSES_SAR,
      SPECIALIZED_FORECAST_METRIC.UNDISTRIBUTED_EXPENSES_SAR,
      SPECIALIZED_FORECAST_METRIC.CAPITAL_RESERVE_SAR,
    ]);
    if (operatingModel === SPECIALIZED_OPERATING_MODEL.MANAGEMENT_AGREEMENT) required.add(SPECIALIZED_FORECAST_METRIC.MANAGEMENT_FEES_SAR);
    return [...required].sort();
  }
  return [];
}

function allowedMetricsForFamily(family) {
  if (family === SPECIALIZED_FORECAST_FAMILY.HOSPITALITY) return HOSPITALITY_ALLOWED;
  if (family === SPECIALIZED_FORECAST_FAMILY.LEISURE) return LEISURE_ALLOWED;
  return [];
}

function overlaps(a, b) {
  return Date.parse(a.periodStart) < Date.parse(b.periodEnd) && Date.parse(b.periodStart) < Date.parse(a.periodEnd);
}

function hold(status, blockers, context = {}) {
  return deepFreeze({
    schemaVersion: 1,
    forecastPacketId: context.forecastPacketId || null,
    caseId: context.caseId || null,
    propertyRef: context.propertyRef || null,
    status,
    blockers,
    readyForSpecializedForecastCalculation: false,
    forecastCalculationPerformed: false,
    noiProduced: false,
    valuationInputsWritten: false,
    valuationArithmeticPerformed: false,
    methodSelected: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function buildSpecializedForecastAssumptionPacket({
  forecastPacketId,
  caseId,
  propertyRef,
  specializedAssetPacket,
  periods,
  preparedByRef,
  preparedAt,
  reviewedByRef,
  reviewedAt,
  reviewEvidenceRef,
} = {}) {
  for (const [field, value] of [
    ['forecastPacketId', forecastPacketId], ['caseId', caseId], ['propertyRef', propertyRef],
    ['preparedByRef', preparedByRef], ['reviewedByRef', reviewedByRef], ['reviewEvidenceRef', reviewEvidenceRef],
  ]) assertNonEmpty(value, field);
  if (!Array.isArray(periods) || periods.length === 0) throw new TypeError('periods must be a non-empty array');
  const prepared = iso(preparedAt, 'preparedAt');
  const reviewed = iso(reviewedAt, 'reviewedAt');
  if (Date.parse(reviewed) < Date.parse(prepared)) throw new TypeError('FORECAST_PACKET_REVIEW_BEFORE_PREPARATION');
  const context = { forecastPacketId: forecastPacketId.trim(), caseId: caseId.trim(), propertyRef: propertyRef.trim() };

  if (!specializedAssetPacket || specializedAssetPacket.caseId !== caseId || specializedAssetPacket.propertyRef !== propertyRef) {
    throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:specializedAssetPacket');
  }
  const family = familyForAssetClass(specializedAssetPacket.assetClass);
  if (!family) return hold(SPECIALIZED_FORECAST_STATUS.NOT_APPLICABLE_ASSET_CLASS, ['HOSPITALITY_OR_LEISURE_ASSET_REQUIRED'], context);
  if (specializedAssetPacket.status !== SPECIALIZED_ASSET_PACKET_STATUS.READY_FOR_SPECIALIZED_ASSET_PROFESSIONAL_WORKFLOW
      || specializedAssetPacket.readyForSpecializedAssetProfessionalWorkflow !== true
      || !verifySpecializedAssetEvidencePacketIntegrity(specializedAssetPacket)) {
    return hold(SPECIALIZED_FORECAST_STATUS.HOLD_SPECIALIZED_PACKET, ['SPECIALIZED_ASSET_PACKET_NOT_READY_OR_INTEGRITY_FAILED'], context);
  }

  const blockers = [];
  const ids = new Set();
  const normalized = [];
  const allowed = new Set(allowedMetricsForFamily(family));
  const required = requiredMetrics(specializedAssetPacket.assetClass, specializedAssetPacket.operatingModel);
  for (const period of periods) {
    if (!verifySpecializedForecastPeriodIntegrity(period)) return hold(SPECIALIZED_FORECAST_STATUS.HOLD_INTEGRITY, [`FORECAST_PERIOD_INTEGRITY_FAILED:${period?.periodId || 'UNKNOWN'}`], context);
    if (ids.has(period.periodId)) blockers.push(`DUPLICATE_FORECAST_PERIOD_ID:${period.periodId}`);
    ids.add(period.periodId);
    if (Date.parse(period.periodStart) <= Date.parse(specializedAssetPacket.valuationDate)) blockers.push(`FORECAST_PERIOD_MUST_START_AFTER_VALUATION_DATE:${period.periodId}`);
    const metricSet = new Set(period.lines.map((line) => line.metric));
    for (const metric of metricSet) if (!allowed.has(metric)) blockers.push(`FORECAST_METRIC_NOT_ALLOWED_FOR_${family}:${period.periodId}:${metric}`);
    for (const metric of required) if (!metricSet.has(metric)) blockers.push(`REQUIRED_FORECAST_METRIC_MISSING:${period.periodId}:${metric}`);
    for (const line of period.lines) if (Date.parse(line.reviewedAt) > Date.parse(reviewed)) blockers.push(`FORECAST_LINE_REVIEW_AFTER_PACKET_REVIEW:${line.lineId}`);
    normalized.push(period);
  }
  const sorted = normalized.slice().sort((a, b) => Date.parse(a.periodStart) - Date.parse(b.periodStart));
  for (let i = 1; i < sorted.length; i += 1) if (overlaps(sorted[i - 1], sorted[i])) blockers.push(`FORECAST_PERIOD_OVERLAP:${sorted[i - 1].periodId}:${sorted[i].periodId}`);
  if (blockers.length) return hold(SPECIALIZED_FORECAST_STATUS.HOLD_FORECAST_ASSUMPTIONS, blockers, context);

  const core = {
    schemaVersion: 1,
    forecastPacketId: forecastPacketId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    valuationDate: specializedAssetPacket.valuationDate,
    assetClass: specializedAssetPacket.assetClass,
    operatingModel: specializedAssetPacket.operatingModel,
    forecastFamily: family,
    specializedAssetEvidenceHashSha256: specializedAssetPacket.specializedAssetEvidenceHashSha256,
    requiredMetrics: required,
    periods: sorted,
    preparedByRef: preparedByRef.trim(),
    preparedAt: prepared,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewed,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
  };
  return deepFreeze({
    ...core,
    specializedForecastAssumptionHashSha256: sha256(core),
    status: SPECIALIZED_FORECAST_STATUS.READY_FOR_SPECIALIZED_FORECAST_CALCULATION,
    blockers: [],
    readyForSpecializedForecastCalculation: true,
    assumptionGovernanceOnly: true,
    automaticallyDerivedFromHistoricalMetrics: false,
    probabilitiesAssigned: false,
    forecastCalculationPerformed: false,
    noiProduced: false,
    valuationInputsWritten: false,
    valuationArithmeticPerformed: false,
    methodSelected: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'This packet governs explicit reviewed hospitality or leisure forecast assumptions only. It does not derive assumptions automatically from historical metrics, assign probabilities, calculate a forecast or NOI, write valuation inputs, select a method, certify a valuation or authorize a transaction.',
  });
}

function verifySpecializedForecastAssumptionPacketIntegrity(packet) {
  if (!packet || !validSha(packet.specializedForecastAssumptionHashSha256)) return false;
  const core = { ...packet };
  [
    'specializedForecastAssumptionHashSha256', 'status', 'blockers', 'readyForSpecializedForecastCalculation',
    'assumptionGovernanceOnly', 'automaticallyDerivedFromHistoricalMetrics', 'probabilitiesAssigned',
    'forecastCalculationPerformed', 'noiProduced', 'valuationInputsWritten', 'valuationArithmeticPerformed',
    'methodSelected', 'certifiedValuationEstablished', 'transactionAuthorized', 'semantics',
  ].forEach((key) => delete core[key]);
  if (!Array.isArray(core.periods) || core.periods.some((period) => !verifySpecializedForecastPeriodIntegrity(period))) return false;
  return sha256(core) === packet.specializedForecastAssumptionHashSha256.toLowerCase();
}

module.exports = {
  SPECIALIZED_FORECAST_FAMILY,
  SPECIALIZED_FORECAST_METRIC,
  FORECAST_ASSUMPTION_ORIGIN,
  SPECIALIZED_FORECAST_STATUS,
  familyForAssetClass,
  createSpecializedForecastLine,
  verifySpecializedForecastLineIntegrity,
  createSpecializedForecastPeriod,
  verifySpecializedForecastPeriodIntegrity,
  requiredMetrics,
  buildSpecializedForecastAssumptionPacket,
  verifySpecializedForecastAssumptionPacketIntegrity,
};
