'use strict';

const crypto = require('crypto');
const {
  WHOLE_PROPERTY_SALES_INPUT_STATUS,
  WHOLE_PROPERTY_SALES_RESULT_STATUS,
} = require('../../contracts/whole-property-sales-comparison');
const {
  verifyWholePropertySalesComparisonInputIntegrity,
} = require('../../valuation/whole-property-sales-comparison-input');

const WHOLE_PROPERTY_SALES_COMPARISON_MODEL_VERSION = 'WHOLE_PROPERTY_SALES_COMPARISON_1.0';

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = stableClone(value[key]);
    return out;
  }, Object.create(null));
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
    modelVersion: WHOLE_PROPERTY_SALES_COMPARISON_MODEL_VERSION,
    status,
    blockers,
    caseId: packet?.caseId || null,
    propertyRef: packet?.propertyRef || null,
    valuationDate: packet?.valuationDate || null,
    valueScope: 'WHOLE_PROPERTY',
    unitOfComparison: packet?.unitOfComparison || null,
    inputPacketHashSha256: packet?.wholePropertySalesComparisonInputHashSha256 || null,
    reconciledUnitValueSar: null,
    subjectBasisQuantity: null,
    valueIndicationSar: null,
    automaticComparableSelection: false,
    automaticAdjustmentEstimated: false,
    automaticComparableWeighting: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    publicAiAuthorized: false,
  });
}

function calculateWholePropertySalesComparisonIndication(packet) {
  if (!packet || typeof packet !== 'object'
      || packet.status !== WHOLE_PROPERTY_SALES_INPUT_STATUS.READY_FOR_CANONICAL_WHOLE_PROPERTY_SALES_CALCULATION
      || packet.readyForCanonicalWholePropertySalesCalculation !== true
      || !verifyWholePropertySalesComparisonInputIntegrity(packet)) {
    return fail(
      WHOLE_PROPERTY_SALES_RESULT_STATUS.INVALID_INPUT_PACKET,
      ['WHOLE_PROPERTY_SALES_COMPARISON_INPUT_NOT_READY_OR_INTEGRITY_FAILED'],
      packet,
    );
  }

  if (!Array.isArray(packet.indications) || packet.indications.length === 0) {
    return fail(WHOLE_PROPERTY_SALES_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['WHOLE_PROPERTY_COMPARABLE_INDICATIONS_REQUIRED'], packet);
  }

  const subjectBasisQuantity = packet.subjectMeasurement?.value;
  if (typeof subjectBasisQuantity !== 'number' || !Number.isFinite(subjectBasisQuantity) || subjectBasisQuantity <= 0) {
    return fail(WHOLE_PROPERTY_SALES_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['WHOLE_PROPERTY_SUBJECT_BASIS_QUANTITY_INVALID'], packet);
  }

  let reconciledUnitValueSar = 0;
  let weightSum = 0;
  const comparableTrace = [];
  for (const indication of packet.indications) {
    const adjusted = indication.adjustedUnitValueSar;
    const weight = indication.weight;
    if (typeof adjusted !== 'number' || !Number.isFinite(adjusted) || adjusted <= 0) {
      return fail(WHOLE_PROPERTY_SALES_RESULT_STATUS.INVALID_ECONOMIC_CASE, [`WHOLE_PROPERTY_ADJUSTED_UNIT_VALUE_INVALID:${indication.comparableId || 'UNKNOWN'}`], packet);
    }
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0 || weight > 1) {
      return fail(WHOLE_PROPERTY_SALES_RESULT_STATUS.INVALID_ECONOMIC_CASE, [`WHOLE_PROPERTY_WEIGHT_INVALID:${indication.comparableId || 'UNKNOWN'}`], packet);
    }
    const contributionSarPerBasisUnit = adjusted * weight;
    if (!Number.isFinite(contributionSarPerBasisUnit)) {
      return fail(WHOLE_PROPERTY_SALES_RESULT_STATUS.INVALID_ECONOMIC_CASE, [`WHOLE_PROPERTY_WEIGHTED_UNIT_CONTRIBUTION_INVALID:${indication.comparableId || 'UNKNOWN'}`], packet);
    }
    reconciledUnitValueSar += contributionSarPerBasisUnit;
    weightSum += weight;
    comparableTrace.push({
      comparableId: indication.comparableId,
      transactionKey: indication.transactionKey,
      sourcePropertyRef: indication.sourcePropertyRef,
      c2EvidenceId: indication.c2EvidenceId,
      c2NormalizedValueHash: indication.c2NormalizedValueHash,
      measurementEvidenceHashSha256: indication.measurementEvidenceHashSha256,
      saleAmountSar: indication.saleAmountSar,
      basisQuantity: indication.basisQuantity,
      baseUnitValueSar: indication.baseUnitValueSar,
      netAdjustmentPercent: indication.netAdjustmentPercent,
      grossAdjustmentPercent: indication.grossAdjustmentPercent,
      adjustedUnitValueSar: adjusted,
      weight,
      contributionSarPerBasisUnit,
      weightRationale: indication.weightRationale,
    });
  }

  if (Math.abs(weightSum - 1) > 1e-9) {
    return fail(WHOLE_PROPERTY_SALES_RESULT_STATUS.INVALID_ECONOMIC_CASE, [`WHOLE_PROPERTY_WEIGHTS_SUM_INVALID:${weightSum}`], packet);
  }
  if (!Number.isFinite(reconciledUnitValueSar) || reconciledUnitValueSar <= 0) {
    return fail(WHOLE_PROPERTY_SALES_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['WHOLE_PROPERTY_RECONCILED_UNIT_VALUE_INVALID'], packet);
  }

  const valueIndicationSar = reconciledUnitValueSar * subjectBasisQuantity;
  if (!Number.isFinite(valueIndicationSar) || valueIndicationSar <= 0) {
    return fail(WHOLE_PROPERTY_SALES_RESULT_STATUS.INVALID_ECONOMIC_CASE, ['WHOLE_PROPERTY_VALUE_INDICATION_INVALID'], packet);
  }

  const values = packet.indications.map((item) => item.adjustedUnitValueSar);
  const adjustedUnitRangeLowSar = Math.min(...values);
  const adjustedUnitRangeHighSar = Math.max(...values);
  const adjustedUnitSpreadRatio = (adjustedUnitRangeHighSar - adjustedUnitRangeLowSar) / reconciledUnitValueSar;

  const core = {
    schemaVersion: 1,
    modelVersion: WHOLE_PROPERTY_SALES_COMPARISON_MODEL_VERSION,
    caseId: packet.caseId,
    propertyRef: packet.propertyRef,
    valuationDate: packet.valuationDate,
    valueScope: 'WHOLE_PROPERTY',
    approachFamily: 'MARKET',
    inputPacketHashSha256: packet.wholePropertySalesComparisonInputHashSha256,
    propertyEvidencePacketHashSha256: packet.propertyEvidencePacketHashSha256,
    marketEvidenceEvaluationHashSha256: packet.marketEvidenceEvaluationHashSha256,
    marketContextBinding: packet.marketContextBinding,
    unitOfComparison: packet.unitOfComparison,
    assetType: packet.assetType,
    subjectMeasurement: packet.subjectMeasurement,
    subjectBasisQuantity,
    comparableTrace,
    adjustedUnitRangeLowSar,
    adjustedUnitRangeHighSar,
    adjustedUnitSpreadRatio,
    reconciledUnitValueSar,
    valueIndicationSar,
    reconciliationPolicyId: packet.reconciliationPolicyId,
    reconciledBy: packet.reconciledBy,
    reconciliationReference: packet.reconciliationReference,
    reconciledAt: packet.reconciledAt,
  };

  return deepFreeze({
    ...core,
    calculationHashSha256: sha256(core),
    status: WHOLE_PROPERTY_SALES_RESULT_STATUS.WHOLE_PROPERTY_MARKET_VALUE_INDICATION_READY,
    blockers: [],
    indicationType: 'WHOLE_PROPERTY_SALES_COMPARISON_VALUE_INDICATION',
    canonicalCalculationEngine: true,
    professionalComparableSelectionUsed: true,
    professionalAdjustmentDispositionUsed: true,
    professionalWeightsUsed: true,
    automaticComparableSelection: false,
    automaticAdjustmentEstimated: false,
    automaticComparableWeighting: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    publicAiAuthorized: false,
    semantics: 'The canonical C3M engine performs deterministic whole-property sales-comparison arithmetic only after a governed input packet has bound C2-qualified closed-sale transactions to separately verified comparable property denominators, one explicit common unit of comparison, professional comparable selection, reviewed adjustments and explicit professional weights. The result is a WHOLE_PROPERTY MARKET method indication only; it is not a certified appraisal, final valuation or transaction authorization.',
  });
}

module.exports = {
  WHOLE_PROPERTY_SALES_COMPARISON_MODEL_VERSION,
  WHOLE_PROPERTY_SALES_RESULT_STATUS,
  calculateWholePropertySalesComparisonIndication,
};
