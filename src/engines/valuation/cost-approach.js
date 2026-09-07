'use strict';

const crypto = require('crypto');
const {
  COST_APPROACH_INPUT_STATUS,
  DEPRECIATION_METHOD,
  verifyCostApproachInputPacketIntegrity,
} = require('../../cost/cost-approach-inputs');

const COST_APPROACH_MODEL_VERSION = 'COST_APPROACH_1.0';
const COST_APPROACH_RESULT_STATUS = Object.freeze({
  VALUE_INDICATION_READY_FOR_RECONCILIATION: 'VALUE_INDICATION_READY_FOR_RECONCILIATION',
  INVALID_INPUT_PACKET: 'INVALID_INPUT_PACKET',
  INVALID_ECONOMIC_CASE: 'INVALID_ECONOMIC_CASE',
});

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

function fail(status, blockers, packet = null) {
  return deepFreeze({
    schemaVersion: 1,
    modelVersion: COST_APPROACH_MODEL_VERSION,
    status,
    blockers,
    caseId: packet?.caseId || null,
    propertyRef: packet?.propertyRef || null,
    valuationDate: packet?.valuationDate || null,
    inputPacketHashSha256: packet?.costApproachInputPacketHashSha256 || null,
    landValueSar: null,
    improvementCostNewSar: null,
    accruedDepreciationSar: null,
    depreciatedImprovementValueSar: null,
    costApproachValueIndicationSar: null,
    finalValuationConclusionEstablished: false,
    automaticReconciliationPerformed: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function calculateCostApproachIndication(packet) {
  if (!packet || typeof packet !== 'object'
      || packet.status !== COST_APPROACH_INPUT_STATUS.READY_FOR_CANONICAL_COST_CALCULATION
      || packet.readyForCanonicalCostCalculation !== true
      || !verifyCostApproachInputPacketIntegrity(packet)) {
    return fail(COST_APPROACH_RESULT_STATUS.INVALID_INPUT_PACKET, ['COST_APPROACH_INPUT_PACKET_NOT_READY_OR_INTEGRITY_FAILED'], packet);
  }

  let improvementCostNewSar = 0;
  const componentTrace = [];
  for (const component of packet.costComponents) {
    const extendedCostSar = component.quantity * component.unitCostSar;
    if (!Number.isFinite(extendedCostSar) || extendedCostSar <= 0) {
      return fail(COST_APPROACH_RESULT_STATUS.INVALID_ECONOMIC_CASE, [`NON_FINITE_OR_NON_POSITIVE_EXTENDED_COST:${component.componentId}`], packet);
    }
    improvementCostNewSar += extendedCostSar;
    componentTrace.push({
      componentId: component.componentId,
      componentClass: component.componentClass,
      costBasis: component.costBasis,
      quantity: component.quantity,
      unit: component.unit,
      unitCostSar: component.unitCostSar,
      extendedCostSar,
      sourceRef: component.sourceRef,
      sourceDate: component.sourceDate,
      costComponentHashSha256: component.costComponentHashSha256,
    });
  }
  if (!Number.isFinite(improvementCostNewSar) || improvementCostNewSar <= 0) {
    return fail(COST_APPROACH_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['IMPROVEMENT_COST_NEW_INVALID'], packet);
  }

  let accruedDepreciationSar = 0;
  const depreciationTrace = [];
  for (const record of packet.depreciationRecords) {
    const amountSar = record.method === DEPRECIATION_METHOD.AMOUNT_SAR
      ? record.magnitude
      : improvementCostNewSar * record.magnitude;
    if (!Number.isFinite(amountSar) || amountSar < 0) {
      return fail(COST_APPROACH_RESULT_STATUS.INVALID_ECONOMIC_CASE, [`DEPRECIATION_AMOUNT_INVALID:${record.depreciationId}`], packet);
    }
    accruedDepreciationSar += amountSar;
    depreciationTrace.push({
      depreciationId: record.depreciationId,
      type: record.type,
      method: record.method,
      magnitude: record.magnitude,
      amountSar,
      depreciationHashSha256: record.depreciationHashSha256,
      evidenceRefs: record.evidenceRefs,
    });
  }

  if (!Number.isFinite(accruedDepreciationSar) || accruedDepreciationSar > improvementCostNewSar) {
    return fail(COST_APPROACH_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['ACCRUED_DEPRECIATION_EXCEEDS_IMPROVEMENT_COST_NEW'], packet);
  }

  const landValueSar = packet.landValueInput.valueSar;
  const depreciatedImprovementValueSar = improvementCostNewSar - accruedDepreciationSar;
  const costApproachValueIndicationSar = landValueSar + depreciatedImprovementValueSar;
  if (![landValueSar, depreciatedImprovementValueSar, costApproachValueIndicationSar].every(Number.isFinite)
      || landValueSar <= 0 || depreciatedImprovementValueSar < 0 || costApproachValueIndicationSar <= 0) {
    return fail(COST_APPROACH_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['COST_APPROACH_VALUE_INDICATION_INVALID'], packet);
  }

  const calculationCore = {
    schemaVersion: 1,
    modelVersion: COST_APPROACH_MODEL_VERSION,
    caseId: packet.caseId,
    propertyRef: packet.propertyRef,
    valuationDate: packet.valuationDate,
    inputPacketHashSha256: packet.costApproachInputPacketHashSha256,
    propertyEvidencePacketHashSha256: packet.propertyEvidencePacketHashSha256,
    landValueInputHashSha256: packet.landValueInput.landValueInputHashSha256,
    landValueSar,
    improvementCostNewSar,
    accruedDepreciationSar,
    depreciatedImprovementValueSar,
    costApproachValueIndicationSar,
    componentTrace,
    depreciationTrace,
  };

  return deepFreeze({
    ...calculationCore,
    calculationHashSha256: sha256(calculationCore),
    status: COST_APPROACH_RESULT_STATUS.VALUE_INDICATION_READY_FOR_RECONCILIATION,
    blockers: [],
    valueIndicationType: 'COST_APPROACH_VALUE_INDICATION',
    canonicalCalculationEngine: true,
    professionalLandValueInputUsed: true,
    automaticLandValuationPerformed: false,
    automaticDepreciationEstimated: false,
    automaticReconciliationPerformed: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'The canonical valuation engine calculates only the Cost Approach indication from the governed packet: professional land-value input plus improvement cost new less explicit accrued depreciation. The indication remains subject to professional reconciliation and does not by itself establish a final or certified valuation.',
  });
}

module.exports = {
  COST_APPROACH_MODEL_VERSION,
  COST_APPROACH_RESULT_STATUS,
  calculateCostApproachIndication,
};
