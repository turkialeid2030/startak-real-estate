'use strict';

const crypto = require('crypto');
const {
  LAND_VALUATION_INPUT_STATUS,
  verifyLandSalesComparisonInputIntegrity,
} = require('../../land/land-valuation-inputs');

const LAND_SALES_COMPARISON_MODEL_VERSION = 'LAND_SALES_COMPARISON_1.0';
const LAND_VALUATION_RESULT_STATUS = Object.freeze({
  LAND_VALUE_INDICATION_READY: 'LAND_VALUE_INDICATION_READY',
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
    modelVersion: LAND_SALES_COMPARISON_MODEL_VERSION,
    status,
    blockers,
    caseId: packet?.caseId || null,
    propertyRef: packet?.propertyRef || null,
    valuationDate: packet?.valuationDate || null,
    inputPacketHashSha256: packet?.landSalesComparisonInputHashSha256 || null,
    subjectLandAreaSqm: null,
    reconciledUnitValueSarPerSqm: null,
    landValueIndicationSar: null,
    automaticComparableWeighting: false,
    automaticAveragingPerformed: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function calculateLandSalesComparisonIndication(packet) {
  if (!packet || typeof packet !== 'object'
      || packet.status !== LAND_VALUATION_INPUT_STATUS.READY_FOR_CANONICAL_LAND_CALCULATION
      || packet.readyForCanonicalLandCalculation !== true
      || !verifyLandSalesComparisonInputIntegrity(packet)) {
    return fail(LAND_VALUATION_RESULT_STATUS.INVALID_INPUT_PACKET, ['LAND_SALES_COMPARISON_INPUT_NOT_READY_OR_INTEGRITY_FAILED'], packet);
  }

  const subjectLandAreaSqm = packet.subjectLandAreaMeasurement.valueSqm;
  if (!Number.isFinite(subjectLandAreaSqm) || subjectLandAreaSqm <= 0) {
    return fail(LAND_VALUATION_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['SUBJECT_LAND_AREA_INVALID'], packet);
  }

  let reconciledUnitValueSarPerSqm = 0;
  const reconciliationTrace = [];
  let weightSum = 0;
  for (const indication of packet.indications) {
    const unitValue = indication.adjustedUnitValueSarPerSqm;
    const weight = indication.weight;
    if (!Number.isFinite(unitValue) || unitValue <= 0 || !Number.isFinite(weight) || weight <= 0) {
      return fail(LAND_VALUATION_RESULT_STATUS.INVALID_ECONOMIC_CASE, [`LAND_INDICATION_OR_WEIGHT_INVALID:${indication.comparableId}`], packet);
    }
    const contributionSarPerSqm = unitValue * weight;
    if (!Number.isFinite(contributionSarPerSqm) || contributionSarPerSqm <= 0) {
      return fail(LAND_VALUATION_RESULT_STATUS.INVALID_ECONOMIC_CASE, [`LAND_WEIGHTED_CONTRIBUTION_INVALID:${indication.comparableId}`], packet);
    }
    reconciledUnitValueSarPerSqm += contributionSarPerSqm;
    weightSum += weight;
    reconciliationTrace.push({
      comparableId: indication.comparableId,
      comparableHashSha256: indication.comparableHashSha256,
      adjustedUnitValueSarPerSqm: unitValue,
      weight,
      weightRationale: indication.weightRationale,
      contributionSarPerSqm,
    });
  }

  if (Math.abs(weightSum - 1) > 1e-9) {
    return fail(LAND_VALUATION_RESULT_STATUS.INVALID_ECONOMIC_CASE, [`PROFESSIONAL_WEIGHTS_SUM_INVALID:${weightSum}`], packet);
  }
  const landValueIndicationSar = subjectLandAreaSqm * reconciledUnitValueSarPerSqm;
  if (!Number.isFinite(reconciledUnitValueSarPerSqm) || reconciledUnitValueSarPerSqm <= 0
      || !Number.isFinite(landValueIndicationSar) || landValueIndicationSar <= 0) {
    return fail(LAND_VALUATION_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['LAND_VALUE_INDICATION_INVALID'], packet);
  }

  const core = {
    schemaVersion: 1,
    modelVersion: LAND_SALES_COMPARISON_MODEL_VERSION,
    caseId: packet.caseId,
    propertyRef: packet.propertyRef,
    valuationDate: packet.valuationDate,
    inputPacketHashSha256: packet.landSalesComparisonInputHashSha256,
    propertyEvidencePacketHashSha256: packet.propertyEvidencePacketHashSha256,
    adjustmentAnalysisHashSha256: packet.adjustmentAnalysisHashSha256,
    subjectLandAreaMeasurement: packet.subjectLandAreaMeasurement,
    subjectLandAreaSqm,
    reconciledUnitValueSarPerSqm,
    landValueIndicationSar,
    reconciliationTrace,
    overallReconciliationRationale: packet.overallReconciliationRationale,
    reconciledByRef: packet.reconciledByRef,
    reconciledAt: packet.reconciledAt,
    reconciliationEvidenceRef: packet.reconciliationEvidenceRef,
  };

  return deepFreeze({
    ...core,
    calculationHashSha256: sha256(core),
    status: LAND_VALUATION_RESULT_STATUS.LAND_VALUE_INDICATION_READY,
    blockers: [],
    indicationType: 'LAND_SALES_COMPARISON_VALUE_INDICATION',
    canonicalCalculationEngine: true,
    professionalComparableWeightsUsed: true,
    automaticComparableWeighting: false,
    automaticAveragingPerformed: false,
    automaticLandValueSelection: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'The canonical land engine performs deterministic arithmetic over explicitly weighted, qualified adjusted LAND SALE indications and the explicitly selected subject land-area measurement. It does not assign weights, average comparables automatically, establish a final property valuation, certify an appraisal, or authorize a transaction.',
  });
}

module.exports = {
  LAND_SALES_COMPARISON_MODEL_VERSION,
  LAND_VALUATION_RESULT_STATUS,
  calculateLandSalesComparisonIndication,
};
