'use strict';

const assert = require('assert');
const crypto = require('crypto');
const {
  SPECIALIZED_ASSET_CLASS,
  SPECIALIZED_OPERATING_STATE,
  SPECIALIZED_OPERATING_MODEL,
  SPECIALIZED_ANALYSIS_CONTEXT,
  SPECIALIZED_EVIDENCE_EXPECTATION,
  SPECIALIZED_EVIDENCE_ITEM_STATUS,
  expectationMatrix,
  createSpecializedEvidenceItem,
  buildSpecializedAssetEvidencePacket,
} = require('../../src/specialized-assets/specialized-asset-evidence');
const {
  HOSPITALITY_OPERATING_RECORD_STATUS,
  HOSPITALITY_OPERATING_METRICS_STATUS,
  createHospitalityOperatingPeriodRecord,
  verifyHospitalityOperatingPeriodRecordIntegrity,
  buildHospitalityOperatingMetricsPacket,
  verifyHospitalityOperatingMetricsPacketIntegrity,
} = require('../../src/specialized-assets/hospitality-operating-metrics');

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const eq = (actual, expected, message) => { assert.strictEqual(actual, expected, message); checks += 1; };
const near = (actual, expected, tolerance, message) => { assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual}`); checks += 1; };
const throws = (fn, pattern, message) => { assert.throws(fn, pattern, message); checks += 1; };

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = stable(value[key]); return out; }, {});
}
const sha256 = (value) => crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');

function propertyPacket() {
  const core = {
    schemaVersion: 1,
    caseId: 'CASE-14B',
    propertyRef: 'PROP-14B',
    assignmentRef: 'ASSIGN-14B',
    assignmentHashSha256: 'a'.repeat(64),
    inspectionId: 'INSP-14B',
    inspectionHashSha256: 'b'.repeat(64),
    valuationDate: '2026-01-01',
    reportDate: '2026-01-05',
    jurisdiction: 'SAUDI_ARABIA',
    assetType: 'SPECIALIZED_REAL_ESTATE',
    assetLocation: 'Riyadh',
    valuedRights: { interest: 'FREEHOLD' },
    basisOfValue: { basis: 'MARKET_VALUE' },
    purpose: 'PROFESSIONAL_VALUATION',
    evidenceFacts: [{ key: 'hospitality_asset', normalizedValue: true }],
    measurements: [],
    propertyDataGateStatus: 'CLEAR',
    measurementGateStatus: 'CLEAR',
  };
  return Object.freeze({
    ...core,
    packetHashSha256: sha256(core),
    status: 'READY_FOR_PROFESSIONAL_VALUATION_WORKFLOW',
    reasons: [],
    professionalValuationWorkflowReady: true,
    automaticUnderwritingAdoption: false,
    financialEngineInputsWritten: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function evidenceItem(topic) {
  return createSpecializedEvidenceItem({
    evidenceItemId: `SE-14B-${topic}`,
    caseId: 'CASE-14B',
    propertyRef: 'PROP-14B',
    topic,
    status: SPECIALIZED_EVIDENCE_ITEM_STATUS.VERIFIED,
    evidenceRefs: [`REF-${topic}`],
    asOfDate: '2026-01-01',
    rationale: `Verified ${topic}`,
    preparedByRef: 'ANALYST-14B',
    preparedAt: '2026-01-02',
    reviewedByRef: 'REVIEWER-14B',
    reviewedAt: '2026-01-03',
    reviewEvidenceRef: `REVIEW-${topic}`,
  });
}

function specializedPacket(assetClass = SPECIALIZED_ASSET_CLASS.HOTEL_FULL_SERVICE, operatingState = SPECIALIZED_OPERATING_STATE.OPERATING) {
  const operatingModel = operatingState === SPECIALIZED_OPERATING_STATE.DEVELOPMENT || operatingState === SPECIALIZED_OPERATING_STATE.VACANT
    ? SPECIALIZED_OPERATING_MODEL.NOT_APPLICABLE
    : SPECIALIZED_OPERATING_MODEL.OWNER_OPERATED;
  const matrix = expectationMatrix(assetClass, operatingState, operatingModel);
  const evidenceItems = [];
  const conditionalApplicability = {};
  for (const [topic, expectation] of Object.entries(matrix)) {
    if (expectation === SPECIALIZED_EVIDENCE_EXPECTATION.REQUIRED) evidenceItems.push(evidenceItem(topic));
    if (expectation === SPECIALIZED_EVIDENCE_EXPECTATION.CONDITIONAL) conditionalApplicability[topic] = false;
  }
  return buildSpecializedAssetEvidencePacket({
    specializationId: `SPEC-14B-${assetClass}-${operatingState}`,
    caseId: 'CASE-14B',
    propertyRef: 'PROP-14B',
    assetClass,
    operatingState,
    operatingModel,
    analysisContext: SPECIALIZED_ANALYSIS_CONTEXT.PROFESSIONAL_VALUATION,
    propertyEvidencePacket: propertyPacket(),
    evidenceItems,
    conditionalApplicability,
    preparedByRef: 'ANALYST-14B',
    preparedAt: '2026-01-03',
    reviewedByRef: 'REVIEWER-14B-2',
    reviewedAt: '2026-01-04',
    reviewEvidenceRef: 'REVIEW-SPECIALIZED-14B',
  });
}

function period(overrides = {}) {
  const base = {
    recordId: 'HOSP-P1',
    caseId: 'CASE-14B',
    propertyRef: 'PROP-14B',
    periodStart: '2025-01-01',
    periodEnd: '2025-06-30',
    availableRoomNights: 18100,
    occupiedRoomNights: 13575,
    roomsRevenueSar: 13575000,
    foodBeverageRevenueSar: 4000000,
    otherOperatingRevenueSar: 1000000,
    departmentalExpensesSar: 10000000,
    undistributedOperatingExpensesSar: 5000000,
    managementAndFranchiseFeesSar: 1000000,
    ffeReserveSar: 800000,
    sourceRef: 'OPS-P1',
    sourceDocumentHashSha256: sha256('OPS-P1-DOC'),
    evidenceRefs: ['EVIDENCE-P1'],
    status: HOSPITALITY_OPERATING_RECORD_STATUS.VERIFIED,
    preparedByRef: 'OPS-ANALYST',
    preparedAt: '2025-07-05',
    reviewedByRef: 'OPS-REVIEWER',
    reviewedAt: '2025-07-10',
    reviewEvidenceRef: 'OPS-REVIEW-P1',
  };
  return createHospitalityOperatingPeriodRecord({ ...base, ...overrides });
}

const p1 = period();
const p2 = period({
  recordId: 'HOSP-P2',
  periodStart: '2025-07-01',
  periodEnd: '2025-12-31',
  availableRoomNights: 18400,
  occupiedRoomNights: 14720,
  roomsRevenueSar: 15456000,
  foodBeverageRevenueSar: 4500000,
  otherOperatingRevenueSar: 1200000,
  departmentalExpensesSar: 11000000,
  undistributedOperatingExpensesSar: 5500000,
  managementAndFranchiseFeesSar: 1100000,
  ffeReserveSar: 900000,
  sourceRef: 'OPS-P2',
  sourceDocumentHashSha256: sha256('OPS-P2-DOC'),
  evidenceRefs: ['EVIDENCE-P2'],
  preparedAt: '2026-01-01T12:00:00Z',
  reviewedAt: '2026-01-02',
  reviewEvidenceRef: 'OPS-REVIEW-P2',
});

check(verifyHospitalityOperatingPeriodRecordIntegrity(p1), 'period 1 integrity verifies');
check(verifyHospitalityOperatingPeriodRecordIntegrity(p2), 'period 2 integrity verifies');
check(!verifyHospitalityOperatingPeriodRecordIntegrity({ ...p1, roomsRevenueSar: 1 }), 'tampered period fails integrity');

const hotel = specializedPacket();
const metrics = buildHospitalityOperatingMetricsPacket({
  metricsPacketId: 'HOSP-METRICS-14B',
  caseId: 'CASE-14B',
  propertyRef: 'PROP-14B',
  specializedAssetPacket: hotel,
  operatingPeriodRecords: [p1, p2],
  preparedByRef: 'ANALYST-14B',
  preparedAt: '2026-01-03',
  reviewedByRef: 'REVIEWER-14B-3',
  reviewedAt: '2026-01-04',
  reviewEvidenceRef: 'REVIEW-METRICS-14B',
});

eq(metrics.status, HOSPITALITY_OPERATING_METRICS_STATUS.READY, 'hospitality metrics ready');
eq(metrics.operatingRecordCount, 2, 'two operating periods');
eq(metrics.aggregateMetrics.availableRoomNights, 36500, 'available room nights aggregate');
eq(metrics.aggregateMetrics.occupiedRoomNights, 28295, 'occupied room nights aggregate');
eq(metrics.aggregateMetrics.roomsRevenueSar, 29031000, 'rooms revenue aggregate');
eq(metrics.aggregateMetrics.foodBeverageRevenueSar, 8500000, 'F&B revenue aggregate');
eq(metrics.aggregateMetrics.otherOperatingRevenueSar, 2200000, 'other revenue aggregate');
eq(metrics.aggregateMetrics.totalOperatingRevenueSar, 39731000, 'total operating revenue');
near(metrics.aggregateMetrics.occupancyRate, 28295 / 36500, 1e-12, 'occupancy calculated');
near(metrics.aggregateMetrics.averageDailyRateSar, 29031000 / 28295, 1e-9, 'ADR calculated');
near(metrics.aggregateMetrics.revParSar, 29031000 / 36500, 1e-9, 'RevPAR calculated');
near(metrics.aggregateMetrics.totalRevenuePerAvailableRoomNightSar, 39731000 / 36500, 1e-9, 'TRevPAR-style metric calculated');
eq(metrics.aggregateMetrics.grossOperatingProfitBeforeOperatorFeesSar, 8231000, 'gross operating profit before operator fees');
eq(metrics.aggregateMetrics.operatingSurplusBeforeFfeAndFixedChargesSar, 6131000, 'operating surplus before FF&E/fixed charges');
eq(metrics.aggregateMetrics.operatingSurplusAfterFfeReserveSar, 4431000, 'operating surplus after FF&E reserve');
check(verifyHospitalityOperatingMetricsPacketIntegrity(metrics), 'metrics packet integrity verifies');
check(Object.isFrozen(metrics), 'metrics packet immutable');
eq(metrics.metricConvention, 'STARTAK_HOSPITALITY_OPERATING_ANALYTICS_V1', 'internal metric convention explicit');
eq(metrics.historicalOperatingAnalyticsOnly, true, 'historical analytics only');
eq(metrics.officialUsaliComplianceClaimed, false, 'no external accounting-standard claim');
eq(metrics.forecastProduced, false, 'no forecast');
eq(metrics.noiProduced, false, 'no NOI');
eq(metrics.valuationInputAdopted, false, 'no valuation input adoption');
eq(metrics.valuationArithmeticPerformed, false, 'no valuation arithmetic');
eq(metrics.methodSelected, false, 'no valuation method selection');
eq(metrics.auditedFinancialStatementOpinionEstablished, false, 'no audit opinion');
eq(metrics.certifiedValuationEstablished, false, 'no certified valuation');
eq(metrics.transactionAuthorized, false, 'no transaction authority');

const tamperedSpecialized = { ...hotel, operatingModel: SPECIALIZED_OPERATING_MODEL.FRANCHISE };
eq(buildHospitalityOperatingMetricsPacket({
  metricsPacketId: 'HOSP-TAMPER-SP', caseId: 'CASE-14B', propertyRef: 'PROP-14B', specializedAssetPacket: tamperedSpecialized,
  operatingPeriodRecords: [p1], preparedByRef: 'A', preparedAt: '2026-01-03', reviewedByRef: 'R', reviewedAt: '2026-01-04', reviewEvidenceRef: 'REV',
}).status, HOSPITALITY_OPERATING_METRICS_STATUS.HOLD_SPECIALIZED_PACKET, 'tampered specialized packet fails closed');

const unverified = period({
  recordId: 'HOSP-UNVERIFIED',
  status: HOSPITALITY_OPERATING_RECORD_STATUS.CLIENT_PROVIDED_UNVERIFIED,
  sourceRef: 'OPS-UNVERIFIED',
  sourceDocumentHashSha256: sha256('OPS-UNVERIFIED-DOC'),
  evidenceRefs: ['EVIDENCE-UNVERIFIED'],
  reviewEvidenceRef: 'OPS-REVIEW-UNVERIFIED',
});
eq(buildHospitalityOperatingMetricsPacket({
  metricsPacketId: 'HOSP-UNVERIFIED-METRICS', caseId: 'CASE-14B', propertyRef: 'PROP-14B', specializedAssetPacket: hotel,
  operatingPeriodRecords: [unverified], preparedByRef: 'A', preparedAt: '2026-01-03', reviewedByRef: 'R', reviewedAt: '2026-01-04', reviewEvidenceRef: 'REV',
}).status, HOSPITALITY_OPERATING_METRICS_STATUS.HOLD_PERIOD_EVIDENCE, 'unverified period evidence fails closed');

const overlap = period({
  recordId: 'HOSP-OVERLAP',
  periodStart: '2025-06-15',
  periodEnd: '2025-08-31',
  availableRoomNights: 7800,
  occupiedRoomNights: 5000,
  roomsRevenueSar: 5000000,
  foodBeverageRevenueSar: 1000000,
  otherOperatingRevenueSar: 200000,
  departmentalExpensesSar: 3000000,
  undistributedOperatingExpensesSar: 1000000,
  managementAndFranchiseFeesSar: 300000,
  ffeReserveSar: 200000,
  sourceRef: 'OPS-OVERLAP',
  sourceDocumentHashSha256: sha256('OPS-OVERLAP-DOC'),
  evidenceRefs: ['EVIDENCE-OVERLAP'],
  preparedAt: '2025-09-05',
  reviewedAt: '2025-09-10',
  reviewEvidenceRef: 'OPS-REVIEW-OVERLAP',
});
const overlapResult = buildHospitalityOperatingMetricsPacket({
  metricsPacketId: 'HOSP-OVERLAP-METRICS', caseId: 'CASE-14B', propertyRef: 'PROP-14B', specializedAssetPacket: hotel,
  operatingPeriodRecords: [p1, overlap], preparedByRef: 'A', preparedAt: '2026-01-03', reviewedByRef: 'R', reviewedAt: '2026-01-04', reviewEvidenceRef: 'REV',
});
eq(overlapResult.status, HOSPITALITY_OPERATING_METRICS_STATUS.HOLD_PERIOD_EVIDENCE, 'overlapping periods fail closed');
check(overlapResult.blockers.some((b) => b.startsWith('HOSPITALITY_PERIOD_OVERLAP:')), 'overlap blocker explicit');

const future = period({
  recordId: 'HOSP-FUTURE',
  periodStart: '2026-01-02',
  periodEnd: '2026-03-31',
  availableRoomNights: 9000,
  occupiedRoomNights: 6000,
  roomsRevenueSar: 6000000,
  foodBeverageRevenueSar: 1000000,
  otherOperatingRevenueSar: 200000,
  departmentalExpensesSar: 3000000,
  undistributedOperatingExpensesSar: 1000000,
  managementAndFranchiseFeesSar: 300000,
  ffeReserveSar: 200000,
  sourceRef: 'OPS-FUTURE',
  sourceDocumentHashSha256: sha256('OPS-FUTURE-DOC'),
  evidenceRefs: ['EVIDENCE-FUTURE'],
  preparedAt: '2026-04-02',
  reviewedAt: '2026-04-03',
  reviewEvidenceRef: 'OPS-REVIEW-FUTURE',
});
const futureResult = buildHospitalityOperatingMetricsPacket({
  metricsPacketId: 'HOSP-FUTURE-METRICS', caseId: 'CASE-14B', propertyRef: 'PROP-14B', specializedAssetPacket: hotel,
  operatingPeriodRecords: [future], preparedByRef: 'A', preparedAt: '2026-04-04', reviewedByRef: 'R', reviewedAt: '2026-04-05', reviewEvidenceRef: 'REV',
});
eq(futureResult.status, HOSPITALITY_OPERATING_METRICS_STATUS.HOLD_PERIOD_EVIDENCE, 'post-valuation operating period fails closed');
check(futureResult.blockers.some((b) => b.startsWith('HOSPITALITY_OPERATING_PERIOD_AFTER_VALUATION_DATE:')), 'future period blocker explicit');

const leisure = specializedPacket(SPECIALIZED_ASSET_CLASS.LEISURE_ATTRACTION, SPECIALIZED_OPERATING_STATE.OPERATING);
eq(buildHospitalityOperatingMetricsPacket({
  metricsPacketId: 'LEISURE-HOSP-METRICS', caseId: 'CASE-14B', propertyRef: 'PROP-14B', specializedAssetPacket: leisure,
  operatingPeriodRecords: [], preparedByRef: 'A', preparedAt: '2026-01-03', reviewedByRef: 'R', reviewedAt: '2026-01-04', reviewEvidenceRef: 'REV',
}).status, HOSPITALITY_OPERATING_METRICS_STATUS.NOT_APPLICABLE_ASSET_CLASS, 'leisure asset does not use hospitality room-night metrics');

const development = specializedPacket(SPECIALIZED_ASSET_CLASS.RESORT, SPECIALIZED_OPERATING_STATE.DEVELOPMENT);
eq(buildHospitalityOperatingMetricsPacket({
  metricsPacketId: 'DEV-HOSP-METRICS', caseId: 'CASE-14B', propertyRef: 'PROP-14B', specializedAssetPacket: development,
  operatingPeriodRecords: [], preparedByRef: 'A', preparedAt: '2026-01-03', reviewedByRef: 'R', reviewedAt: '2026-01-04', reviewEvidenceRef: 'REV',
}).status, HOSPITALITY_OPERATING_METRICS_STATUS.NOT_APPLICABLE_OPERATING_STATE, 'development asset does not fabricate historical hospitality metrics');

const crossCase = { ...p1, caseId: 'OTHER-CASE' };
throws(() => buildHospitalityOperatingMetricsPacket({
  metricsPacketId: 'CROSS-CASE', caseId: 'CASE-14B', propertyRef: 'PROP-14B', specializedAssetPacket: hotel,
  operatingPeriodRecords: [crossCase], preparedByRef: 'A', preparedAt: '2026-01-03', reviewedByRef: 'R', reviewedAt: '2026-01-04', reviewEvidenceRef: 'REV',
}), /CASE_OR_PROPERTY_ISOLATION_VIOLATION:hospitalityOperatingRecord/, 'cross-case operating record rejected');

throws(() => period({ recordId: 'BAD-OCC', occupiedRoomNights: 19000 }), /OCCUPIED_ROOM_NIGHTS_EXCEED_AVAILABLE/, 'occupied room nights cannot exceed available');
throws(() => period({ recordId: 'BAD-REV', occupiedRoomNights: 0, roomsRevenueSar: 1 }), /ROOMS_REVENUE_WITH_ZERO_OCCUPIED_ROOM_NIGHTS/, 'rooms revenue cannot exist with zero occupied room nights');

console.log(`WAVE_14B_HOSPITALITY_OPERATING_METRICS=PASS checks=${checks}`);
