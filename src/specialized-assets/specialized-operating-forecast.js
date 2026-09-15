'use strict';

const crypto = require('crypto');
const {
  SPECIALIZED_FORECAST_FAMILY,
  SPECIALIZED_FORECAST_STATUS,
  verifySpecializedForecastAssumptionPacketIntegrity,
} = require('./specialized-forecast-assumptions');
const {
  FORECAST_ENGINE_FAMILY,
  calculateSpecializedOperatingForecast,
} = require('../engines/valuation/specialized-operating-forecast');

const SPECIALIZED_OPERATING_FORECAST_STATUS = Object.freeze({
  READY: 'READY',
  HOLD_ASSUMPTION_PACKET: 'HOLD_ASSUMPTION_PACKET',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
});

function nonEmpty(value) { return typeof value === 'string' && value.trim().length > 0; }
function assertNonEmpty(value, field) { if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`); }
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

function engineFamily(family) {
  if (family === SPECIALIZED_FORECAST_FAMILY.HOSPITALITY) return FORECAST_ENGINE_FAMILY.HOSPITALITY;
  if (family === SPECIALIZED_FORECAST_FAMILY.LEISURE) return FORECAST_ENGINE_FAMILY.LEISURE;
  throw new TypeError(`unsupported forecast family: ${family}`);
}

function valuesFromPeriod(period) {
  const values = {};
  for (const line of period.lines) values[line.metric] = line.value;
  return values;
}

function hold(status, blockers, context = {}) {
  return deepFreeze({
    schemaVersion: 1,
    operatingForecastPacketId: context.operatingForecastPacketId || null,
    caseId: context.caseId || null,
    propertyRef: context.propertyRef || null,
    status,
    blockers,
    forecastProduced: false,
    noiProduced: false,
    valuationInputsWritten: false,
    discountingPerformed: false,
    terminalValueCalculated: false,
    valuationArithmeticPerformed: false,
    methodSelected: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function buildSpecializedOperatingForecastPacket({
  operatingForecastPacketId,
  caseId,
  propertyRef,
  assumptionPacket,
  preparedByRef,
  preparedAt,
  reviewedByRef,
  reviewedAt,
  reviewEvidenceRef,
} = {}) {
  for (const [field, value] of [
    ['operatingForecastPacketId', operatingForecastPacketId], ['caseId', caseId], ['propertyRef', propertyRef],
    ['preparedByRef', preparedByRef], ['reviewedByRef', reviewedByRef], ['reviewEvidenceRef', reviewEvidenceRef],
  ]) assertNonEmpty(value, field);
  const prepared = iso(preparedAt, 'preparedAt');
  const reviewed = iso(reviewedAt, 'reviewedAt');
  if (Date.parse(reviewed) < Date.parse(prepared)) throw new TypeError('SPECIALIZED_OPERATING_FORECAST_REVIEW_BEFORE_PREPARATION');
  const context = { operatingForecastPacketId: operatingForecastPacketId.trim(), caseId: caseId.trim(), propertyRef: propertyRef.trim() };

  if (!assumptionPacket || assumptionPacket.caseId !== caseId || assumptionPacket.propertyRef !== propertyRef) {
    throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:assumptionPacket');
  }
  if (assumptionPacket.status !== SPECIALIZED_FORECAST_STATUS.READY_FOR_SPECIALIZED_FORECAST_CALCULATION
      || assumptionPacket.readyForSpecializedForecastCalculation !== true
      || !verifySpecializedForecastAssumptionPacketIntegrity(assumptionPacket)) {
    return hold(SPECIALIZED_OPERATING_FORECAST_STATUS.HOLD_ASSUMPTION_PACKET, ['SPECIALIZED_FORECAST_ASSUMPTION_PACKET_NOT_READY_OR_INTEGRITY_FAILED'], context);
  }

  const family = engineFamily(assumptionPacket.forecastFamily);
  const periodResults = assumptionPacket.periods.map((period) => {
    const values = valuesFromPeriod(period);
    const metrics = calculateSpecializedOperatingForecast(family, values);
    const core = {
      periodId: period.periodId,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      sourceForecastPeriodHashSha256: period.specializedForecastPeriodHashSha256,
      assumptionLineHashes: period.lines.map((line) => line.specializedForecastLineHashSha256),
      metrics,
    };
    return deepFreeze({
      ...core,
      specializedOperatingForecastPeriodHashSha256: sha256(core),
      reviewFlags: metrics.operatingSurplusAfterReserveSar < 0 ? ['NEGATIVE_OPERATING_SURPLUS_AFTER_RESERVE'] : [],
    });
  });

  const horizon = periodResults.reduce((out, period) => {
    out.totalOperatingRevenueSar += period.metrics.totalOperatingRevenueSar;
    out.operatingSurplusBeforeReserveSar += period.metrics.operatingSurplusBeforeReserveSar;
    out.operatingSurplusAfterReserveSar += period.metrics.operatingSurplusAfterReserveSar;
    return out;
  }, {
    totalOperatingRevenueSar: 0,
    operatingSurplusBeforeReserveSar: 0,
    operatingSurplusAfterReserveSar: 0,
  });

  const core = {
    schemaVersion: 1,
    operatingForecastPacketId: operatingForecastPacketId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    valuationDate: assumptionPacket.valuationDate,
    assetClass: assumptionPacket.assetClass,
    forecastFamily: assumptionPacket.forecastFamily,
    specializedForecastAssumptionHashSha256: assumptionPacket.specializedForecastAssumptionHashSha256,
    periodResults,
    horizonSummary: horizon,
    metricConvention: 'STARTAK_SPECIALIZED_OPERATING_FORECAST_V1',
    preparedByRef: preparedByRef.trim(),
    preparedAt: prepared,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewed,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
  };

  return deepFreeze({
    ...core,
    specializedOperatingForecastHashSha256: sha256(core),
    status: SPECIALIZED_OPERATING_FORECAST_STATUS.READY,
    blockers: [],
    forecastProduced: true,
    operatingForecastOnly: true,
    noiProduced: false,
    valuationInputsWritten: false,
    discountingPerformed: false,
    terminalValueCalculated: false,
    capitalizationPerformed: false,
    valuationArithmeticPerformed: false,
    methodSelected: false,
    investmentRecommendationProduced: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'This packet deterministically calculates hospitality or leisure operating forecasts only from explicit reviewed Wave 14E assumptions using the canonical specialized forecast engine. Operating surplus is not NOI, property value or investment return. No capitalization, discounting, terminal value, valuation-method selection, certified valuation or transaction authorization is performed.',
  });
}

function verifySpecializedOperatingForecastPacketIntegrity(packet) {
  if (!packet || !validSha(packet.specializedOperatingForecastHashSha256)) return false;
  const core = { ...packet };
  [
    'specializedOperatingForecastHashSha256', 'status', 'blockers', 'forecastProduced', 'operatingForecastOnly',
    'noiProduced', 'valuationInputsWritten', 'discountingPerformed', 'terminalValueCalculated', 'capitalizationPerformed',
    'valuationArithmeticPerformed', 'methodSelected', 'investmentRecommendationProduced', 'certifiedValuationEstablished',
    'transactionAuthorized', 'semantics',
  ].forEach((key) => delete core[key]);
  if (!Array.isArray(core.periodResults)) return false;
  for (const result of core.periodResults) {
    if (!validSha(result.specializedOperatingForecastPeriodHashSha256)) return false;
    const periodCore = { ...result };
    delete periodCore.specializedOperatingForecastPeriodHashSha256;
    delete periodCore.reviewFlags;
    if (sha256(periodCore) !== result.specializedOperatingForecastPeriodHashSha256.toLowerCase()) return false;
  }
  return sha256(core) === packet.specializedOperatingForecastHashSha256.toLowerCase();
}

module.exports = {
  SPECIALIZED_OPERATING_FORECAST_STATUS,
  engineFamily,
  valuesFromPeriod,
  buildSpecializedOperatingForecastPacket,
  verifySpecializedOperatingForecastPacketIntegrity,
};
