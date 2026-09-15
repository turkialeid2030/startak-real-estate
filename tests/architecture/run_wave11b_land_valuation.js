'use strict';

const assert = require('assert');
const {
  MARKET_EVIDENCE_LEVEL,
  MARKET_TRANSACTION_TYPE,
  MARKET_VERIFICATION_STATUS,
  COMPARABLE_QUALITY_STATUS,
  ADJUSTMENT_FACTOR,
  ADJUSTMENT_DIRECTION,
  ADJUSTMENT_METHOD,
  ADJUSTMENT_CONFIDENCE,
  ADJUSTMENT_ANALYSIS_STATUS,
  createComparableEvidenceRecord,
  evaluateComparableSetQuality,
  recordProfessionalComparableSelection,
  createComparableAdjustmentRecord,
  buildComparableAdjustmentAnalysis,
} = require('../../src/market');
const {
  LAND_VALUATION_INPUT_STATUS,
  buildLandSalesComparisonInputPacket,
  verifyLandSalesComparisonInputIntegrity,
  verifyAdjustmentAnalysisIntegrity,
} = require('../../src/land');
const {
  LAND_SALES_COMPARISON_MODEL_VERSION,
  LAND_VALUATION_RESULT_STATUS,
  calculateLandSalesComparisonIndication,
} = require('../../src/engines/valuation/land-sales-comparison');
const { PROPERTY_EVIDENCE_PACKET_STATUS } = require('../../src/property/property-evidence-bridge');

let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks += 1; }

const CASE_ID = 'CASE-11B-001';
const PROPERTY_REF = 'PROPERTY-11B-001';
const VALUATION_DATE = '2026-09-07T00:00:00Z';

function comparable(id, valuePerSqm, overrides = {}) {
  const areaSqm = 1000;
  return createComparableEvidenceRecord({
    comparableId: id, caseId: CASE_ID, sourcePropertyRef: `LAND-${id}`,
    assetType: overrides.assetType || 'LAND',
    transactionType: overrides.transactionType || MARKET_TRANSACTION_TYPE.SALE,
    evidenceLevel: MARKET_EVIDENCE_LEVEL.VERIFIED_TRANSACTION,
    sourceName: 'SYNTHETIC LAND TRANSACTION SOURCE', sourceRef: `source://${id}`,
    sourceDate: '2026-07-02T00:00:00Z', transactionDate: '2026-07-01T00:00:00Z',
    location: { city: 'RIYADH', district: 'SYNTHETIC_DISTRICT' },
    areaSqm, amountSar: areaSqm * valuePerSqm,
    verification: { status: MARKET_VERIFICATION_STATUS.VERIFIED, verifiedByRef: 'USER:MARKET-REVIEWER', verifiedAt: '2026-07-03T00:00:00Z', evidenceRef: `evidence://${id}` },
    capturedAt: '2026-07-04T00:00:00Z',
  });
}
function adjustment(id, comparableId, factor, direction, method, magnitude) {
  return createComparableAdjustmentRecord({
    adjustmentId: id, caseId: CASE_ID, comparableId, factor, direction, method, magnitude,
    rationale: `Synthetic professional adjustment ${id}`, evidenceRefs: [`evidence://${id}`], confidence: ADJUSTMENT_CONFIDENCE.HIGH,
    preparedByRef: 'USER:LAND-ANALYST', preparedAt: '2026-09-07T08:00:00Z',
    reviewedByRef: 'USER:LAND-REVIEWER', reviewedAt: '2026-09-07T09:00:00Z', reviewEvidenceRef: `review://${id}`,
  });
}

const records = [comparable('C1', 10000), comparable('C2', 11000), comparable('C3', 9000)];
const quality = evaluateComparableSetQuality({
  caseId: CASE_ID, records, asOfDate: VALUATION_DATE, maxAgeDays: 365, minimumComparableCount: 3,
  minimumEvidenceLevel: MARKET_EVIDENCE_LEVEL.VERIFIED_OFFER,
});
check(quality.status === COMPARABLE_QUALITY_STATUS.QUALIFIED_FOR_PROFESSIONAL_SELECTION, 'land comparable evidence qualifies for professional selection');
const selection = recordProfessionalComparableSelection({
  caseId: CASE_ID, qualityGate: quality, records, selectedComparableIds: ['C1', 'C2', 'C3'],
  selectionRationales: { C1: 'Similar location and entitlement profile', C2: 'Recent verified land sale', C3: 'Brackets subject development potential' },
  selectedByRef: 'USER:LAND-VALUER', selectionEvidenceRef: 'selection://land', selectedAt: '2026-09-07T09:15:00Z', minimumSelectedCount: 3,
});
const analysis = buildComparableAdjustmentAnalysis({
  caseId: CASE_ID, selection, records,
  adjustmentRecords: [
    adjustment('A1', 'C1', ADJUSTMENT_FACTOR.LOCATION, ADJUSTMENT_DIRECTION.INCREASE, ADJUSTMENT_METHOD.PERCENT_OF_BASE, 0.05),
    adjustment('A2', 'C2', ADJUSTMENT_FACTOR.DEVELOPMENT_POTENTIAL, ADJUSTMENT_DIRECTION.DECREASE, ADJUSTMENT_METHOD.PERCENT_OF_BASE, 0.05),
    adjustment('A3', 'C3', ADJUSTMENT_FACTOR.FRONTAGE_ACCESS, ADJUSTMENT_DIRECTION.INCREASE, ADJUSTMENT_METHOD.AMOUNT_SAR_PER_SQM, 1000),
  ],
});
check(analysis.status === ADJUSTMENT_ANALYSIS_STATUS.READY_FOR_RECONCILIATION && analysis.reconciliationReady === true, 'adjusted land indications are ready for professional reconciliation');
check(verifyAdjustmentAnalysisIntegrity(analysis), 'market adjustment analysis integrity verifies');

const propertyPacket = Object.freeze({
  caseId: CASE_ID, propertyRef: PROPERTY_REF, valuationDate: VALUATION_DATE,
  status: PROPERTY_EVIDENCE_PACKET_STATUS.READY_FOR_PROFESSIONAL_VALUATION_WORKFLOW,
  professionalValuationWorkflowReady: true, packetHashSha256: 'a'.repeat(64),
  measurements: [{
    measurementId: 'M-LAND', type: 'LAND_AREA', value: 1000, unit: 'sqm', source: 'TITLE_DEED',
    sourceEvidenceRef: 'evidence://title-area', measurementStandardRef: 'SYNTHETIC-MEASUREMENT-STANDARD',
    measurementMethod: 'DOCUMENT_REPORTED_AREA', measurementHashSha256: 'b'.repeat(64),
  }],
});

function inputPacket(overrides = {}) {
  return buildLandSalesComparisonInputPacket({
    packetId: overrides.packetId || 'LAND-PACKET-001', caseId: CASE_ID, propertyRef: PROPERTY_REF, valuationDate: VALUATION_DATE,
    propertyEvidencePacket: overrides.propertyEvidencePacket || propertyPacket,
    adjustmentAnalysis: overrides.adjustmentAnalysis || analysis,
    comparableRecords: overrides.comparableRecords || records,
    subjectLandAreaMeasurementId: overrides.subjectLandAreaMeasurementId || 'M-LAND',
    weights: overrides.weights || { C1: 0.5, C2: 0.3, C3: 0.2 },
    weightRationales: overrides.weightRationales || { C1: 'Highest relevance', C2: 'Strong supporting evidence', C3: 'Secondary bracket evidence' },
    overallReconciliationRationale: 'Synthetic professional reconciliation emphasizing verified relevance and comparability; no automatic averaging.',
    reconciledByRef: 'USER:LAND-VALUER', reconciledAt: '2026-09-07T10:00:00Z', reconciliationEvidenceRef: 'reconciliation://land-001',
    minimumIndicationCount: 3,
  });
}

const ready = inputPacket();
check(ready.status === LAND_VALUATION_INPUT_STATUS.READY_FOR_CANONICAL_LAND_CALCULATION, 'land sales comparison input packet is canonical-calculation ready');
check(ready.professionalWeightsExplicit === true && ready.automaticComparableWeighting === false, 'professional weights are explicit and never auto-assigned');
check(ready.automaticAveragingPerformed === false && ready.landValueIndicationProduced === false, 'input packet performs no averaging or land-value calculation');
check(verifyLandSalesComparisonInputIntegrity(ready), 'land input packet hash verifies');
check(ready.subjectLandAreaMeasurement.measurementId === 'M-LAND' && ready.subjectLandAreaMeasurement.valueSqm === 1000, 'professional subject land-area measurement selection is preserved');

const result = calculateLandSalesComparisonIndication(ready);
check(result.modelVersion === LAND_SALES_COMPARISON_MODEL_VERSION, 'canonical land model version is explicit');
check(result.status === LAND_VALUATION_RESULT_STATUS.LAND_VALUE_INDICATION_READY, 'canonical land engine produces a land value indication');
check(Math.abs(result.reconciledUnitValueSarPerSqm - 10385) < 1e-9, 'explicit professional weights reconcile adjusted unit indications correctly');
check(result.landValueIndicationSar === 10385000, 'canonical land engine applies reconciled unit value to selected subject land area');
check(result.reconciliationTrace.length === 3, 'land calculation preserves weighted comparable trace');
check(/^[a-f0-9]{64}$/.test(result.calculationHashSha256), 'land calculation has deterministic SHA-256');
check(result.professionalComparableWeightsUsed === true && result.automaticComparableWeighting === false && result.automaticAveragingPerformed === false, 'land calculation uses professional weights without automatic averaging');
check(result.finalValuationConclusionEstablished === false && result.certifiedValuationEstablished === false && result.transactionAuthorized === false, 'land indication creates no final property value, certification, or transaction authority');

const missingArea = inputPacket({ packetId: 'AREA-HOLD', subjectLandAreaMeasurementId: 'MISSING' });
check(missingArea.status === LAND_VALUATION_INPUT_STATUS.HOLD_SUBJECT_AREA, 'missing subject land-area measurement fails closed');

const wrongAreaPacket = { ...propertyPacket, measurements: [{ ...propertyPacket.measurements[0], type: 'GFA' }] };
const wrongArea = inputPacket({ packetId: 'AREA-TYPE-HOLD', propertyEvidencePacket: wrongAreaPacket });
check(wrongArea.status === LAND_VALUATION_INPUT_STATUS.HOLD_SUBJECT_AREA, 'non-land-area measurement cannot drive land valuation');

const badWeightSum = inputPacket({ packetId: 'WEIGHT-HOLD', weights: { C1: 0.5, C2: 0.3, C3: 0.3 } });
check(badWeightSum.status === LAND_VALUATION_INPUT_STATUS.HOLD_RECONCILIATION, 'professional weights must sum exactly to one');
check(badWeightSum.blockers.some((item) => item.startsWith('PROFESSIONAL_WEIGHTS_MUST_SUM_TO_1:')), 'weight-sum blocker is explicit');

const missingRationale = inputPacket({ packetId: 'RATIONALE-HOLD', weightRationales: { C1: 'Relevant', C2: 'Relevant', C3: '' } });
check(missingRationale.status === LAND_VALUATION_INPUT_STATUS.HOLD_RECONCILIATION, 'each professional weight requires rationale');

const buildingRecord = comparable('C1', 10000, { assetType: 'OFFICE' });
const buildingBinding = inputPacket({ packetId: 'ASSET-HOLD', comparableRecords: [buildingRecord, records[1], records[2]] });
check(buildingBinding.status === LAND_VALUATION_INPUT_STATUS.HOLD_COMPARABLE_BINDING, 'non-land comparable cannot enter land valuation');
check(buildingBinding.blockers.some((item) => item.startsWith('LAND_COMPARABLE_ASSET_TYPE_REQUIRED:C1:')), 'land asset-type blocker is explicit');

const rentalRecord = comparable('C1', 10000, { transactionType: MARKET_TRANSACTION_TYPE.RENT });
const rentalBinding = inputPacket({ packetId: 'SALE-HOLD', comparableRecords: [rentalRecord, records[1], records[2]] });
check(rentalBinding.status === LAND_VALUATION_INPUT_STATUS.HOLD_COMPARABLE_BINDING, 'rental comparable cannot enter land sales comparison');
check(rentalBinding.blockers.some((item) => item.startsWith('LAND_COMPARABLE_SALE_REQUIRED:C1:')), 'land sale requirement blocker is explicit');

const tamperedAnalysis = { ...analysis, indications: analysis.indications.map((item, index) => index === 0 ? { ...item, adjustedUnitValueSarPerSqm: 999999 } : item) };
const analysisHold = inputPacket({ packetId: 'ANALYSIS-HOLD', adjustmentAnalysis: tamperedAnalysis });
check(analysisHold.status === LAND_VALUATION_INPUT_STATUS.HOLD_MARKET_ANALYSIS, 'tampered market analysis fails integrity gate');

const tamperedPacket = { ...ready, indications: ready.indications.map((item, index) => index === 0 ? { ...item, weight: 0.9 } : item) };
check(calculateLandSalesComparisonIndication(tamperedPacket).status === LAND_VALUATION_RESULT_STATUS.INVALID_INPUT_PACKET, 'tampered land input packet is rejected by canonical engine');

const unreadyProperty = inputPacket({ packetId: 'PROPERTY-HOLD', propertyEvidencePacket: { ...propertyPacket, professionalValuationWorkflowReady: false } });
check(unreadyProperty.status === LAND_VALUATION_INPUT_STATUS.HOLD_PROPERTY_EVIDENCE, 'unready property evidence fails closed');

let crossCaseRejected = false;
try {
  const crossCase = { ...records[0], caseId: 'CASE-OTHER' };
  inputPacket({ packetId: 'CROSS-CASE', comparableRecords: [crossCase, records[1], records[2]] });
} catch (error) {
  crossCaseRejected = String(error.message).includes('CASE_ISOLATION_VIOLATION:landComparableRecord');
}
check(crossCaseRejected, 'cross-case land comparable evidence is rejected');

console.log(`WAVE_11B_LAND_VALUATION=PASS checks=${checks}`);
