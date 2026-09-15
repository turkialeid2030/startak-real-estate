'use strict';

const crypto = require('crypto');
const {
  ADJUSTMENT_ANALYSIS_STATUS,
} = require('../market/comparable-adjustments');
const {
  MARKET_TRANSACTION_TYPE,
} = require('../market/comparable-evidence');
const {
  PROPERTY_EVIDENCE_PACKET_STATUS,
} = require('../property/property-evidence-bridge');

const LAND_VALUATION_INPUT_STATUS = Object.freeze({
  READY_FOR_CANONICAL_LAND_CALCULATION: 'READY_FOR_CANONICAL_LAND_CALCULATION',
  HOLD_PROPERTY_EVIDENCE: 'HOLD_PROPERTY_EVIDENCE',
  HOLD_MARKET_ANALYSIS: 'HOLD_MARKET_ANALYSIS',
  HOLD_SUBJECT_AREA: 'HOLD_SUBJECT_AREA',
  HOLD_COMPARABLE_BINDING: 'HOLD_COMPARABLE_BINDING',
  HOLD_RECONCILIATION: 'HOLD_RECONCILIATION',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
});

const LAND_ASSET_TYPE = 'LAND';
const LAND_AREA_MEASUREMENT_TYPE = 'LAND_AREA';
const SQM_UNIT = 'sqm';

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}
function assertNonEmpty(value, field) {
  if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`);
}
function iso(value, field) {
  assertNonEmpty(value, field);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return d.toISOString();
}
function positiveFinite(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new TypeError(`${field} must be a finite positive number`);
}
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

function verifyAdjustmentAnalysisIntegrity(analysis) {
  if (!analysis || !nonEmpty(analysis.analysisHashSha256) || !/^[a-f0-9]{64}$/i.test(analysis.analysisHashSha256)) return false;
  const payload = { ...analysis };
  delete payload.analysisHashSha256;
  return sha256(payload) === analysis.analysisHashSha256.toLowerCase();
}

function hold(status, blockers, context = {}) {
  return deepFreeze({
    schemaVersion: 1,
    caseId: context.caseId || null,
    propertyRef: context.propertyRef || null,
    status,
    blockers,
    readyForCanonicalLandCalculation: false,
    automaticComparableWeighting: false,
    automaticLandValueSelection: false,
    landValueIndicationProduced: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function buildLandSalesComparisonInputPacket({
  packetId,
  caseId,
  propertyRef,
  valuationDate,
  propertyEvidencePacket,
  adjustmentAnalysis,
  comparableRecords,
  subjectLandAreaMeasurementId,
  weights,
  weightRationales,
  overallReconciliationRationale,
  reconciledByRef,
  reconciledAt,
  reconciliationEvidenceRef,
  minimumIndicationCount = 1,
} = {}) {
  for (const [field, value] of [
    ['packetId', packetId], ['caseId', caseId], ['propertyRef', propertyRef],
    ['subjectLandAreaMeasurementId', subjectLandAreaMeasurementId],
    ['overallReconciliationRationale', overallReconciliationRationale],
    ['reconciledByRef', reconciledByRef], ['reconciliationEvidenceRef', reconciliationEvidenceRef],
  ]) assertNonEmpty(value, field);
  const valuationDateIso = iso(valuationDate, 'valuationDate');
  const reconciledAtIso = iso(reconciledAt, 'reconciledAt');
  if (!Number.isInteger(minimumIndicationCount) || minimumIndicationCount < 1) throw new TypeError('minimumIndicationCount must be a positive integer');
  if (!propertyEvidencePacket || propertyEvidencePacket.caseId !== caseId || propertyEvidencePacket.propertyRef !== propertyRef) throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:propertyEvidencePacket');
  if (!Array.isArray(comparableRecords)) throw new TypeError('comparableRecords must be an array');
  if (!weights || typeof weights !== 'object' || Array.isArray(weights)) throw new TypeError('weights must be an object');
  if (!weightRationales || typeof weightRationales !== 'object' || Array.isArray(weightRationales)) throw new TypeError('weightRationales must be an object');

  if (propertyEvidencePacket.status !== PROPERTY_EVIDENCE_PACKET_STATUS.READY_FOR_PROFESSIONAL_VALUATION_WORKFLOW
      || propertyEvidencePacket.professionalValuationWorkflowReady !== true
      || !/^[a-f0-9]{64}$/i.test(String(propertyEvidencePacket.packetHashSha256 || ''))) {
    return hold(LAND_VALUATION_INPUT_STATUS.HOLD_PROPERTY_EVIDENCE, ['PROPERTY_EVIDENCE_PACKET_NOT_READY'], { caseId, propertyRef });
  }

  const packetValuationDate = iso(propertyEvidencePacket.valuationDate, 'propertyEvidencePacket.valuationDate');
  if (packetValuationDate !== valuationDateIso) {
    return hold(LAND_VALUATION_INPUT_STATUS.HOLD_PROPERTY_EVIDENCE, ['PROPERTY_EVIDENCE_VALUATION_DATE_MISMATCH'], { caseId, propertyRef });
  }

  if (!adjustmentAnalysis || adjustmentAnalysis.caseId !== caseId
      || adjustmentAnalysis.status !== ADJUSTMENT_ANALYSIS_STATUS.READY_FOR_RECONCILIATION
      || adjustmentAnalysis.reconciliationReady !== true
      || !verifyAdjustmentAnalysisIntegrity(adjustmentAnalysis)) {
    return hold(LAND_VALUATION_INPUT_STATUS.HOLD_MARKET_ANALYSIS, ['LAND_COMPARABLE_ADJUSTMENT_ANALYSIS_NOT_READY_OR_INTEGRITY_FAILED'], { caseId, propertyRef });
  }

  const measurements = Array.isArray(propertyEvidencePacket.measurements) ? propertyEvidencePacket.measurements : [];
  const subjectMeasurement = measurements.find((item) => item.measurementId === subjectLandAreaMeasurementId);
  if (!subjectMeasurement) {
    return hold(LAND_VALUATION_INPUT_STATUS.HOLD_SUBJECT_AREA, ['SUBJECT_LAND_AREA_MEASUREMENT_NOT_FOUND'], { caseId, propertyRef });
  }
  if (subjectMeasurement.type !== LAND_AREA_MEASUREMENT_TYPE || subjectMeasurement.unit !== SQM_UNIT) {
    return hold(LAND_VALUATION_INPUT_STATUS.HOLD_SUBJECT_AREA, ['SUBJECT_LAND_AREA_MEASUREMENT_MUST_BE_LAND_AREA_SQM'], { caseId, propertyRef });
  }
  positiveFinite(subjectMeasurement.value, 'subjectMeasurement.value');
  if (!nonEmpty(subjectMeasurement.measurementHashSha256) || !/^[a-f0-9]{64}$/i.test(subjectMeasurement.measurementHashSha256)) {
    return hold(LAND_VALUATION_INPUT_STATUS.HOLD_SUBJECT_AREA, ['SUBJECT_LAND_AREA_MEASUREMENT_HASH_REQUIRED'], { caseId, propertyRef });
  }

  const recordById = new Map();
  const bindingBlockers = [];
  for (const record of comparableRecords) {
    if (!record || record.caseId !== caseId) throw new TypeError('CASE_ISOLATION_VIOLATION:landComparableRecord');
    if (recordById.has(record.comparableId)) bindingBlockers.push(`DUPLICATE_LAND_COMPARABLE_RECORD:${record.comparableId}`);
    recordById.set(record.comparableId, record);
  }

  const indications = adjustmentAnalysis.indications || [];
  if (indications.length < minimumIndicationCount) bindingBlockers.push(`INSUFFICIENT_LAND_INDICATIONS:${indications.length}/${minimumIndicationCount}`);
  for (const indication of indications) {
    const record = recordById.get(indication.comparableId);
    if (!record) {
      bindingBlockers.push(`LAND_COMPARABLE_RECORD_MISSING:${indication.comparableId}`);
      continue;
    }
    if (record.assetType !== LAND_ASSET_TYPE) bindingBlockers.push(`LAND_COMPARABLE_ASSET_TYPE_REQUIRED:${indication.comparableId}:${record.assetType}`);
    if (record.transactionType !== MARKET_TRANSACTION_TYPE.SALE) bindingBlockers.push(`LAND_COMPARABLE_SALE_REQUIRED:${indication.comparableId}:${record.transactionType}`);
    if (record.comparableHashSha256 !== indication.comparableHashSha256) bindingBlockers.push(`LAND_COMPARABLE_HASH_MISMATCH:${indication.comparableId}`);
  }
  if (bindingBlockers.length) return hold(LAND_VALUATION_INPUT_STATUS.HOLD_COMPARABLE_BINDING, bindingBlockers, { caseId, propertyRef });

  const reconciliationBlockers = [];
  const indicationIds = indications.map((item) => item.comparableId);
  const weightKeys = Object.keys(weights);
  for (const id of indicationIds) {
    const weight = weights[id];
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) reconciliationBlockers.push(`POSITIVE_PROFESSIONAL_WEIGHT_REQUIRED:${id}`);
    if (!nonEmpty(weightRationales[id])) reconciliationBlockers.push(`WEIGHT_RATIONALE_REQUIRED:${id}`);
  }
  for (const key of weightKeys) {
    if (!indicationIds.includes(key)) reconciliationBlockers.push(`WEIGHT_FOR_UNKNOWN_INDICATION:${key}`);
  }
  const weightSum = indicationIds.reduce((sum, id) => sum + (Number.isFinite(weights[id]) ? weights[id] : 0), 0);
  if (Math.abs(weightSum - 1) > 1e-9) reconciliationBlockers.push(`PROFESSIONAL_WEIGHTS_MUST_SUM_TO_1:${weightSum}`);
  if (reconciliationBlockers.length) return hold(LAND_VALUATION_INPUT_STATUS.HOLD_RECONCILIATION, reconciliationBlockers, { caseId, propertyRef });

  const core = {
    schemaVersion: 1,
    packetId: packetId.trim(),
    caseId,
    propertyRef,
    valuationDate: valuationDateIso,
    propertyEvidencePacketHashSha256: propertyEvidencePacket.packetHashSha256,
    subjectLandAreaMeasurement: {
      measurementId: subjectMeasurement.measurementId,
      valueSqm: subjectMeasurement.value,
      source: subjectMeasurement.source,
      sourceEvidenceRef: subjectMeasurement.sourceEvidenceRef,
      measurementStandardRef: subjectMeasurement.measurementStandardRef,
      measurementMethod: subjectMeasurement.measurementMethod,
      measurementHashSha256: subjectMeasurement.measurementHashSha256,
    },
    adjustmentAnalysisHashSha256: adjustmentAnalysis.analysisHashSha256,
    indications: indications.map((item) => ({
      comparableId: item.comparableId,
      comparableHashSha256: item.comparableHashSha256,
      baseUnitValueSarPerSqm: item.baseUnitValueSarPerSqm,
      adjustedUnitValueSarPerSqm: item.adjustedUnitValueSarPerSqm,
      netAdjustmentPercent: item.netAdjustmentPercent,
      grossAdjustmentPercent: item.grossAdjustmentPercent,
      weight: weights[item.comparableId],
      weightRationale: weightRationales[item.comparableId].trim(),
    })),
    minimumIndicationCount,
    overallReconciliationRationale: overallReconciliationRationale.trim(),
    reconciledByRef: reconciledByRef.trim(),
    reconciledAt: reconciledAtIso,
    reconciliationEvidenceRef: reconciliationEvidenceRef.trim(),
  };

  return deepFreeze({
    ...core,
    landSalesComparisonInputHashSha256: sha256(core),
    status: LAND_VALUATION_INPUT_STATUS.READY_FOR_CANONICAL_LAND_CALCULATION,
    blockers: [],
    readyForCanonicalLandCalculation: true,
    professionalWeightsExplicit: true,
    automaticComparableWeighting: false,
    automaticAveragingPerformed: false,
    automaticLandValueSelection: false,
    landValueIndicationProduced: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'This packet binds a professionally selected subject land-area measurement and explicit professional weights/rationales to qualified adjusted LAND SALE indications. The packet performs no averaging or land-value calculation; arithmetic is reserved for the canonical land valuation engine.',
  });
}

function verifyLandSalesComparisonInputIntegrity(packet) {
  if (!packet || packet.status !== LAND_VALUATION_INPUT_STATUS.READY_FOR_CANONICAL_LAND_CALCULATION) return false;
  const digest = packet.landSalesComparisonInputHashSha256;
  if (!nonEmpty(digest) || !/^[a-f0-9]{64}$/i.test(digest)) return false;
  const core = {
    schemaVersion: packet.schemaVersion,
    packetId: packet.packetId,
    caseId: packet.caseId,
    propertyRef: packet.propertyRef,
    valuationDate: packet.valuationDate,
    propertyEvidencePacketHashSha256: packet.propertyEvidencePacketHashSha256,
    subjectLandAreaMeasurement: packet.subjectLandAreaMeasurement,
    adjustmentAnalysisHashSha256: packet.adjustmentAnalysisHashSha256,
    indications: packet.indications,
    minimumIndicationCount: packet.minimumIndicationCount,
    overallReconciliationRationale: packet.overallReconciliationRationale,
    reconciledByRef: packet.reconciledByRef,
    reconciledAt: packet.reconciledAt,
    reconciliationEvidenceRef: packet.reconciliationEvidenceRef,
  };
  return sha256(core) === digest.toLowerCase();
}

module.exports = {
  LAND_VALUATION_INPUT_STATUS,
  LAND_ASSET_TYPE,
  LAND_AREA_MEASUREMENT_TYPE,
  buildLandSalesComparisonInputPacket,
  verifyLandSalesComparisonInputIntegrity,
  verifyAdjustmentAnalysisIntegrity,
};
