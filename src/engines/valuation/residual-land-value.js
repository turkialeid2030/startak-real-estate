'use strict';

const crypto = require('crypto');
const {
  DEVELOPMENT_RESIDUAL_INPUT_STATUS,
  DEVELOPER_RETURN_METHOD,
  verifyDevelopmentResidualInputIntegrity,
} = require('../../development/development-property');

const DEVELOPMENT_RESIDUAL_MODEL_VERSION = 'DEVELOPMENT_RESIDUAL_1.0';
const DEVELOPMENT_RESIDUAL_RESULT_STATUS = Object.freeze({
  RESIDUAL_LAND_VALUE_INDICATION_READY: 'RESIDUAL_LAND_VALUE_INDICATION_READY',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  INVALID_INPUT_PACKET: 'INVALID_INPUT_PACKET',
  INVALID_ECONOMIC_CASE: 'INVALID_ECONOMIC_CASE',
});

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = stableClone(value[key]); return out; }, {});
}
function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex');
}
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
function fail(status, blockers, packet = null) {
  return deepFreeze({
    schemaVersion: 1,
    modelVersion: DEVELOPMENT_RESIDUAL_MODEL_VERSION,
    status,
    blockers,
    caseId: packet?.caseId || null,
    propertyRef: packet?.propertyRef || null,
    valuationDate: packet?.valuationDate || null,
    inputPacketHashSha256: packet?.developmentResidualInputHashSha256 || null,
    totalGdvSar: null,
    totalDevelopmentCostsSar: null,
    totalFinanceCostsSar: null,
    totalFeesSar: null,
    requiredDeveloperReturnSar: null,
    residualLandValueSar: null,
    residualLandValuePerSqm: null,
    automaticGdvEstimated: false,
    automaticCostEstimated: false,
    automaticFinanceCostEstimated: false,
    automaticDeveloperReturnEstimated: false,
    automaticLandValueSelection: false,
    automaticReconciliation: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}
function sumAmounts(components) {
  let total = 0;
  for (const item of components) {
    if (!item || typeof item.amountSar !== 'number' || !Number.isFinite(item.amountSar) || item.amountSar <= 0) return NaN;
    total += item.amountSar;
  }
  return total;
}
function scheduleRows(packet, requiredDeveloperReturnSar) {
  const byMonth = new Map();
  function row(month) {
    if (!byMonth.has(month)) byMonth.set(month, { month, gdvInflowsSar: 0, developmentCostsSar: 0, financeCostsSar: 0, feesSar: 0, developerReturnSar: 0, nominalNetSar: 0 });
    return byMonth.get(month);
  }
  for (const item of packet.gdvComponents) row(item.month).gdvInflowsSar += item.amountSar;
  for (const item of packet.developmentCostComponents) row(item.month).developmentCostsSar += item.amountSar;
  for (const item of packet.financeCostComponents) row(item.month).financeCostsSar += item.amountSar;
  for (const item of packet.feeComponents) row(item.month).feesSar += item.amountSar;
  row(packet.terminalMonth).developerReturnSar += requiredDeveloperReturnSar;
  return [...byMonth.values()].sort((a, b) => a.month - b.month).map((item) => ({
    ...item,
    nominalNetSar: item.gdvInflowsSar - item.developmentCostsSar - item.financeCostsSar - item.feesSar - item.developerReturnSar,
  }));
}

function calculateDevelopmentResidualLandValue(packet) {
  if (!packet || typeof packet !== 'object'
      || packet.status !== DEVELOPMENT_RESIDUAL_INPUT_STATUS.READY_FOR_CANONICAL_RESIDUAL_CALCULATION
      || packet.readyForCanonicalResidualCalculation !== true
      || !verifyDevelopmentResidualInputIntegrity(packet)) {
    return fail(DEVELOPMENT_RESIDUAL_RESULT_STATUS.INVALID_INPUT_PACKET, ['DEVELOPMENT_RESIDUAL_INPUT_NOT_READY_OR_INTEGRITY_FAILED'], packet);
  }

  const totalGdvSar = sumAmounts(packet.gdvComponents);
  const totalDevelopmentCostsSar = sumAmounts(packet.developmentCostComponents);
  const totalFinanceCostsSar = packet.financeCostComponents.length ? sumAmounts(packet.financeCostComponents) : 0;
  const totalFeesSar = packet.feeComponents.length ? sumAmounts(packet.feeComponents) : 0;
  const subjectLandAreaSqm = packet.subjectLandAreaMeasurement?.valueSqm;
  if (![totalGdvSar, totalDevelopmentCostsSar, totalFinanceCostsSar, totalFeesSar, subjectLandAreaSqm].every(Number.isFinite)
      || totalGdvSar <= 0 || totalDevelopmentCostsSar <= 0 || subjectLandAreaSqm <= 0 || totalFinanceCostsSar < 0 || totalFeesSar < 0) {
    return fail(DEVELOPMENT_RESIDUAL_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['DEVELOPMENT_RESIDUAL_ECONOMICS_INVALID'], packet);
  }

  let requiredDeveloperReturnSar;
  if (packet.requiredDeveloperReturn.method === DEVELOPER_RETURN_METHOD.AMOUNT_SAR) {
    requiredDeveloperReturnSar = packet.requiredDeveloperReturn.value;
  } else if (packet.requiredDeveloperReturn.method === DEVELOPER_RETURN_METHOD.PERCENT_OF_GDV) {
    requiredDeveloperReturnSar = totalGdvSar * packet.requiredDeveloperReturn.value;
  } else {
    return fail(DEVELOPMENT_RESIDUAL_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['DEVELOPER_RETURN_METHOD_INVALID'], packet);
  }
  if (!Number.isFinite(requiredDeveloperReturnSar) || requiredDeveloperReturnSar <= 0) {
    return fail(DEVELOPMENT_RESIDUAL_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['REQUIRED_DEVELOPER_RETURN_INVALID'], packet);
  }

  const residualLandValueSar = totalGdvSar - totalDevelopmentCostsSar - totalFinanceCostsSar - totalFeesSar - requiredDeveloperReturnSar;
  const residualLandValuePerSqm = residualLandValueSar / subjectLandAreaSqm;
  if (!Number.isFinite(residualLandValueSar) || !Number.isFinite(residualLandValuePerSqm)) {
    return fail(DEVELOPMENT_RESIDUAL_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['RESIDUAL_LAND_VALUE_NON_FINITE'], packet);
  }

  const reviewFlags = [];
  if (residualLandValueSar <= 0) reviewFlags.push('NON_POSITIVE_RESIDUAL_REVIEW_REQUIRED');
  const schedule = scheduleRows(packet, requiredDeveloperReturnSar);
  const core = {
    schemaVersion: 1,
    modelVersion: DEVELOPMENT_RESIDUAL_MODEL_VERSION,
    caseId: packet.caseId,
    propertyRef: packet.propertyRef,
    valuationDate: packet.valuationDate,
    inputPacketHashSha256: packet.developmentResidualInputHashSha256,
    propertyEvidencePacketHashSha256: packet.propertyEvidencePacketHashSha256,
    hbuDecisionHashSha256: packet.hbuDecisionHashSha256,
    developmentScenarioId: packet.developmentScenarioId,
    developmentUse: packet.developmentUse,
    developmentStartDate: packet.developmentStartDate,
    terminalMonth: packet.terminalMonth,
    subjectLandAreaMeasurement: packet.subjectLandAreaMeasurement,
    subjectLandAreaSqm,
    totalGdvSar,
    totalDevelopmentCostsSar,
    totalFinanceCostsSar,
    totalFeesSar,
    developerReturnMethod: packet.requiredDeveloperReturn.method,
    developerReturnInputValue: packet.requiredDeveloperReturn.value,
    requiredDeveloperReturnSar,
    residualLandValueSar,
    residualLandValuePerSqm,
    nominalSchedule: schedule,
    timingConvention: packet.timingConvention,
  };

  return deepFreeze({
    ...core,
    calculationHashSha256: sha256(core),
    status: reviewFlags.length ? DEVELOPMENT_RESIDUAL_RESULT_STATUS.REVIEW_REQUIRED : DEVELOPMENT_RESIDUAL_RESULT_STATUS.RESIDUAL_LAND_VALUE_INDICATION_READY,
    blockers: [],
    reviewFlags,
    indicationType: 'DEVELOPMENT_RESIDUAL_LAND_VALUE_INDICATION',
    canonicalCalculationEngine: true,
    discountingApplied: false,
    discountRateAssumed: false,
    timingArithmeticConvention: 'NOMINAL_UNDISCOUNTED_RESIDUAL',
    automaticGdvEstimated: false,
    automaticCostEstimated: false,
    automaticFinanceCostEstimated: false,
    automaticDeveloperReturnEstimated: false,
    automaticLandValueSelection: false,
    automaticReconciliation: false,
    sensitivityApplied: false,
    uncertaintyConclusionEstablished: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'The canonical Development Property engine calculates a nominal undiscounted residual land-value indication from explicitly reviewed GDV, development costs, finance costs, fees and required developer return. Timing is preserved as month-index provenance only in Wave 11C; no discount rate, hidden finance model, automatic land-value reconciliation, final valuation conclusion, certification, or transaction authority is introduced.',
  });
}

module.exports = {
  DEVELOPMENT_RESIDUAL_MODEL_VERSION,
  DEVELOPMENT_RESIDUAL_RESULT_STATUS,
  calculateDevelopmentResidualLandValue,
};
