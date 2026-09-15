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
  LEISURE_OPERATING_RECORD_STATUS,
  LEISURE_OPERATING_METRICS_STATUS,
  createLeisureOperatingPeriodRecord,
  verifyLeisureOperatingPeriodRecordIntegrity,
  buildLeisureOperatingMetricsPacket,
  verifyLeisureOperatingMetricsPacketIntegrity,
} = require('../../src/specialized-assets/leisure-operating-metrics');

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
    caseId: 'CASE-14C',
    propertyRef: 'PROP-14C',
    assignmentRef: 'ASSIGN-14C',
    assignmentHashSha256: 'a'.repeat(64),
    inspectionId: 'INSP-14C',
    inspectionHashSha256: 'b'.repeat(64),
    valuationDate: '2026-01-01',
    reportDate: '2026-01-05',
    jurisdiction: 'SAUDI_ARABIA',
    assetType: 'SPECIALIZED_REAL_ESTATE',
    assetLocation: 'Riyadh',
    valuedRights: { interest: 'FREEHOLD' },
    basisOfValue: { basis: 'MARKET_VALUE' },
    purpose: 'PROFESSIONAL_VALUATION',
    evidenceFacts: [{ key: 'leisure_asset', normalizedValue: true }],
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
    evidenceItemId: `SE-14C-${topic}`,
    caseId: 'CASE-14C',
    propertyRef: 'PROP-14C',
    topic,
    status: SPECIALIZED_EVIDENCE_ITEM_STATUS.VERIFIED,
    evidenceRefs: [`REF-${topic}`],
    asOfDate: '2026-01-01',
    rationale: `Verified ${topic}`,
    preparedByRef: 'ANALYST-14C',
    preparedAt: '2026-01-02',
    reviewedByRef: 'REVIEWER-14C',
    reviewedAt: '2026-01-03',
    reviewEvidenceRef: `REVIEW-${topic}`,
  });
}

function specializedPacket(assetClass = SPECIALIZED_ASSET_CLASS.LEISURE_ATTRACTION, operatingState = SPECIALIZED_OPERATING_STATE.OPERATING) {
  const operatingModel = [SPECIALIZED_OPERATING_STATE.DEVELOPMENT, SPECIALIZED_OPERATING_STATE.VACANT].includes(operatingState)
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
    specializationId: `SPEC-14C-${assetClass}-${operatingState}`,
    caseId: 'CASE-14C',
    propertyRef: 'PROP-14C',
    assetClass,
    operatingState,
    operatingModel,
    analysisContext: SPECIALIZED_ANALYSIS_CONTEXT.PROFESSIONAL_VALUATION,
    propertyEvidencePacket: propertyPacket(),
    evidenceItems,
    conditionalApplicability,
    preparedByRef: 'ANALYST-14C',
    preparedAt: '2026-01-03',
    reviewedByRef: 'REVIEWER-14C-2',
    reviewedAt: '2026-01-04',
    reviewEvidenceRef: 'REVIEW-SPECIALIZED-14C',
  });
}

function period(overrides = {}) {
  const base = {
    recordId: 'LEISURE-P1',
    caseId: 'CASE-14C',
    propertyRef: 'PROP-14C',
    periodStart: '2025-01-01',
    periodEnd: '2025-06-30',
    operatingDays: 181,
    attendanceCount: 500000,
    admissionsRevenueSar: 50000000,
    foodBeverageRevenueSar: 15000000,
    retailMerchandiseRevenueSar: 8000000,
    otherOperatingRevenueSar: 2000000,
    directOperatingExpensesSar: 35000000,
    undistributedOperatingExpensesSar: 12000000,
    managementFeesSar: 3000000,
    capitalReserveSar: 2000000,
    sourceRef: 'LEISURE-OPS-P1',
    sourceDocumentHashSha256: sha256('LEISURE-OPS-P1-DOC'),
    evidenceRefs: ['LEISURE-EVIDENCE-P1'],
    status: LEISURE_OPERATING_RECORD_STATUS.VERIFIED,
    preparedByRef: 'LEISURE-ANALYST',
    preparedAt: '2025-07-05',
    reviewedByRef: 'LEISURE-REVIEWER',
    reviewedAt: '2025-07-10',
    reviewEvidenceRef: 'LEISURE-REVIEW-P1',
  };
  return createLeisureOperatingPeriodRecord({ ...base, ...overrides });
}

const p1 = period();
const p2 = period({
  recordId: 'LEISURE-P2',
  periodStart: '2025-07-01',
  periodEnd: '2025-12-31',
  operatingDays: 184,
  attendanceCount: 600000,
  admissionsRevenueSar: 66000000,
  foodBeverageRevenueSar: 18000000,
  retailMerchandiseRevenueSar: 10000000,
  otherOperatingRevenueSar: 3000000,
  directOperatingExpensesSar: 42000000,
  undistributedOperatingExpensesSar: 14000000,
  managementFeesSar: 3500000,
  capitalReserveSar: 2500000,
  sourceRef: 'LEISURE-OPS-P2',
  sourceDocumentHashSha256: sha256('LEISURE-OPS-P2-DOC'),
  evidenceRefs: ['LEISURE-EVIDENCE-P2'],
  preparedAt: '2026-01-01T12:00:00Z',
  reviewedAt: '2026-01-02',
  reviewEvidenceRef: 'LEISURE-REVIEW-P2',
});

check(verifyLeisureOperatingPeriodRecordIntegrity(p1), 'period 1 integrity verifies');
check(verifyLeisureOperatingPeriodRecordIntegrity(p2), 'period 2 integrity verifies');
check(!verifyLeisureOperatingPeriodRecordIntegrity({ ...p1, attendanceCount: 1 }), 'tampered period fails integrity');

const leisure = specializedPacket();
const metrics = buildLeisureOperatingMetricsPacket({
  metricsPacketId: 'LEISURE-METRICS-14C',
  caseId: 'CASE-14C',
  propertyRef: 'PROP-14C',
  specializedAssetPacket: leisure,
  operatingPeriodRecords: [p1, p2],
  preparedByRef: 'ANALYST-14C',
  preparedAt: '2026-01-03',
  reviewedByRef: 'REVIEWER-14C-3',
  reviewedAt: '2026-01-04',
  reviewEvidenceRef: 'REVIEW-METRICS-14C',
});

eq(metrics.status, LEISURE_OPERATING_METRICS_STATUS.READY, 'leisure metrics ready');
eq(metrics.operatingRecordCount, 2, 'two leisure periods');
eq(metrics.aggregateMetrics.operatingDays, 365, 'operating days aggregate');
eq(metrics.aggregateMetrics.attendanceCount, 1100000, 'attendance aggregate');
eq(metrics.aggregateMetrics.admissionsRevenueSar, 116000000, 'admissions revenue aggregate');
eq(metrics.aggregateMetrics.foodBeverageRevenueSar, 33000000, 'F&B revenue aggregate');
eq(metrics.aggregateMetrics.retailMerchandiseRevenueSar, 18000000, 'retail revenue aggregate');
eq(metrics.aggregateMetrics.otherOperatingRevenueSar, 5000000, 'other revenue aggregate');
eq(metrics.aggregateMetrics.ancillaryRevenueSar, 56000000, 'ancillary revenue aggregate');
eq(metrics.aggregateMetrics.totalOperatingRevenueSar, 172000000, 'total operating revenue aggregate');
near(metrics.aggregateMetrics.attendancePerOperatingDay, 1100000 / 365, 1e-9, 'attendance per operating day');
near(metrics.aggregateMetrics.admissionsRevenuePerVisitorSar, 116000000 / 1100000, 1e-9, 'admissions revenue per visitor');
near(metrics.aggregateMetrics.ancillarySpendPerVisitorSar, 56000000 / 1100000, 1e-9, 'ancillary spend per visitor');
near(metrics.aggregateMetrics.totalRevenuePerVisitorSar, 172000000 / 1100000, 1e-9, 'total revenue per visitor');
eq(metrics.aggregateMetrics.operatingSurplusBeforeManagementAndReserveSar, 69000000, 'surplus before management/reserve');
eq(metrics.aggregateMetrics.operatingSurplusBeforeReserveSar, 62500000, 'surplus before reserve');
eq(metrics.aggregateMetrics.operatingSurplusAfterCapitalReserveSar, 58000000, 'surplus after reserve');
near(metrics.aggregateMetrics.operatingSurplusAfterReserveMargin, 58000000 / 172000000, 1e-12, 'surplus after reserve margin');
near(metrics.aggregateMetrics.operatingSurplusAfterReservePerVisitorSar, 58000000 / 1100000, 1e-9, 'surplus per visitor');
check(verifyLeisureOperatingMetricsPacketIntegrity(metrics), 'leisure metrics packet integrity verifies');
check(Object.isFrozen(metrics), 'leisure metrics packet immutable');
eq(metrics.metricConvention, 'STARTAK_LEISURE_OPERATING_ANALYTICS_V1', 'internal metric convention explicit');
eq(metrics.historicalOperatingAnalyticsOnly, true, 'historical analytics only');
eq(metrics.officialIndustryAccountingStandardClaimed, false, 'no external industry accounting standard claim');
eq(metrics.forecastProduced, false, 'no forecast');
eq(metrics.noiProduced, false, 'no NOI');
eq(metrics.valuationInputAdopted, false, 'no valuation input adoption');
eq(metrics.valuationArithmeticPerformed, false, 'no valuation arithmetic');
eq(metrics.methodSelected, false, 'no method selection');
eq(metrics.auditedFinancialStatementOpinionEstablished, false, 'no audit opinion');
eq(metrics.certifiedValuationEstablished, false, 'no certified valuation');
eq(metrics.transactionAuthorized, false, 'no transaction authority');

const tamperedSpecialized = { ...leisure, operatingState: SPECIALIZED_OPERATING_STATE.RAMP_UP };
eq(buildLeisureOperatingMetricsPacket({
  metricsPacketId: 'LEISURE-TAMPER-SP', caseId: 'CASE-14C', propertyRef: 'PROP-14C', specializedAssetPacket: tamperedSpecialized,
  operatingPeriodRecords: [p1], preparedByRef: 'A', preparedAt: '2026-01-03', reviewedByRef: 'R', reviewedAt: '2026-01-04', reviewEvidenceRef: 'REV',
}).status, LEISURE_OPERATING_METRICS_STATUS.HOLD_SPECIALIZED_PACKET, 'tampered specialized packet fails closed');

const unverified = period({
  recordId: 'LEISURE-UNVERIFIED',
  status: LEISURE_OPERATING_RECORD_STATUS.CLIENT_PROVIDED_UNVERIFIED,
  sourceRef: 'LEISURE-OPS-UNVERIFIED',
  sourceDocumentHashSha256: sha256('LEISURE-OPS-UNVERIFIED-DOC'),
  evidenceRefs: ['LEISURE-EVIDENCE-UNVERIFIED'],
  reviewEvidenceRef: 'LEISURE-REVIEW-UNVERIFIED',
});
eq(buildLeisureOperatingMetricsPacket({
  metricsPacketId: 'LEISURE-UNVERIFIED-METRICS', caseId: 'CASE-14C', propertyRef: 'PROP-14C', specializedAssetPacket: leisure,
  operatingPeriodRecords: [unverified], preparedByRef: 'A', preparedAt: '2026-01-03', reviewedByRef: 'R', reviewedAt: '2026-01-04', reviewEvidenceRef: 'REV',
}).status, LEISURE_OPERATING_METRICS_STATUS.HOLD_PERIOD_EVIDENCE, 'unverified period evidence fails closed');

const overlap = period({
  recordId: 'LEISURE-OVERLAP',
  periodStart: '2025-06-15',
  periodEnd: '2025-08-31',
  operatingDays: 78,
  attendanceCount: 100000,
  admissionsRevenueSar: 10000000,
  foodBeverageRevenueSar: 2000000,
  retailMerchandiseRevenueSar: 1000000,
  otherOperatingRevenueSar: 500000,
  directOperatingExpensesSar: 6000000,
  undistributedOperatingExpensesSar: 2000000,
  managementFeesSar: 500000,
  capitalReserveSar: 400000,
  sourceRef: 'LEISURE-OPS-OVERLAP',
  sourceDocumentHashSha256: sha256('LEISURE-OPS-OVERLAP-DOC'),
  evidenceRefs: ['LEISURE-EVIDENCE-OVERLAP'],
  preparedAt: '2025-09-05',
  reviewedAt: '2025-09-10',
  reviewEvidenceRef: 'LEISURE-REVIEW-OVERLAP',
});
const overlapResult = buildLeisureOperatingMetricsPacket({
  metricsPacketId: 'LEISURE-OVERLAP-METRICS', caseId: 'CASE-14C', propertyRef: 'PROP-14C', specializedAssetPacket: leisure,
  operatingPeriodRecords: [p1, overlap], preparedByRef: 'A', preparedAt: '2026-01-03', reviewedByRef: 'R', reviewedAt: '2026-01-04', reviewEvidenceRef: 'REV',
});
eq(overlapResult.status, LEISURE_OPERATING_METRICS_STATUS.HOLD_PERIOD_EVIDENCE, 'overlapping periods fail closed');
check(overlapResult.blockers.some((b) => b.startsWith('LEISURE_PERIOD_OVERLAP:')), 'overlap blocker explicit');

const future = period({
  recordId: 'LEISURE-FUTURE',
  periodStart: '2026-01-02',
  periodEnd: '2026-03-31',
  operatingDays: 89,
  attendanceCount: 100000,
  admissionsRevenueSar: 10000000,
  foodBeverageRevenueSar: 2000000,
  retailMerchandiseRevenueSar: 1000000,
  otherOperatingRevenueSar: 500000,
  directOperatingExpensesSar: 6000000,
  undistributedOperatingExpensesSar: 2000000,
  managementFeesSar: 500000,
  capitalReserveSar: 400000,
  sourceRef: 'LEISURE-OPS-FUTURE',
  sourceDocumentHashSha256: sha256('LEISURE-OPS-FUTURE-DOC'),
  evidenceRefs: ['LEISURE-EVIDENCE-FUTURE'],
  preparedAt: '2026-04-02',
  reviewedAt: '2026-04-03',
  reviewEvidenceRef: 'LEISURE-REVIEW-FUTURE',
});
const futureResult = buildLeisureOperatingMetricsPacket({
  metricsPacketId: 'LEISURE-FUTURE-METRICS', caseId: 'CASE-14C', propertyRef: 'PROP-14C', specializedAssetPacket: leisure,
  operatingPeriodRecords: [future], preparedByRef: 'A', preparedAt: '2026-04-04', reviewedByRef: 'R', reviewedAt: '2026-04-05', reviewEvidenceRef: 'REV',
});
eq(futureResult.status, LEISURE_OPERATING_METRICS_STATUS.HOLD_PERIOD_EVIDENCE, 'post-valuation leisure period fails closed');
check(futureResult.blockers.some((b) => b.startsWith('LEISURE_OPERATING_PERIOD_AFTER_VALUATION_DATE:')), 'future period blocker explicit');

const hotel = specializedPacket(SPECIALIZED_ASSET_CLASS.HOTEL_FULL_SERVICE, SPECIALIZED_OPERATING_STATE.OPERATING);
eq(buildLeisureOperatingMetricsPacket({
  metricsPacketId: 'HOTEL-LEISURE-METRICS', caseId: 'CASE-14C', propertyRef: 'PROP-14C', specializedAssetPacket: hotel,
  operatingPeriodRecords: [], preparedByRef: 'A', preparedAt: '2026-01-03', reviewedByRef: 'R', reviewedAt: '2026-01-04', reviewEvidenceRef: 'REV',
}).status, LEISURE_OPERATING_METRICS_STATUS.NOT_APPLICABLE_ASSET_CLASS, 'hotel asset does not use leisure attendance metrics');

const development = specializedPacket(SPECIALIZED_ASSET_CLASS.LEISURE_ATTRACTION, SPECIALIZED_OPERATING_STATE.DEVELOPMENT);
eq(buildLeisureOperatingMetricsPacket({
  metricsPacketId: 'DEV-LEISURE-METRICS', caseId: 'CASE-14C', propertyRef: 'PROP-14C', specializedAssetPacket: development,
  operatingPeriodRecords: [], preparedByRef: 'A', preparedAt: '2026-01-03', reviewedByRef: 'R', reviewedAt: '2026-01-04', reviewEvidenceRef: 'REV',
}).status, LEISURE_OPERATING_METRICS_STATUS.NOT_APPLICABLE_OPERATING_STATE, 'development leisure asset does not fabricate historical metrics');

eq(buildLeisureOperatingMetricsPacket({
  metricsPacketId: 'DEV-LEISURE-WITH-HISTORY', caseId: 'CASE-14C', propertyRef: 'PROP-14C', specializedAssetPacket: development,
  operatingPeriodRecords: [p1], preparedByRef: 'A', preparedAt: '2026-01-03', reviewedByRef: 'R', reviewedAt: '2026-01-04', reviewEvidenceRef: 'REV',
}).status, LEISURE_OPERATING_METRICS_STATUS.HOLD_PERIOD_EVIDENCE, 'development state cannot silently accept historical records');

const crossCase = { ...p1, caseId: 'OTHER-CASE' };
throws(() => buildLeisureOperatingMetricsPacket({
  metricsPacketId: 'CROSS-CASE', caseId: 'CASE-14C', propertyRef: 'PROP-14C', specializedAssetPacket: leisure,
  operatingPeriodRecords: [crossCase], preparedByRef: 'A', preparedAt: '2026-01-03', reviewedByRef: 'R', reviewedAt: '2026-01-04', reviewEvidenceRef: 'REV',
}), /CASE_OR_PROPERTY_ISOLATION_VIOLATION:leisureOperatingRecord/, 'cross-case leisure record rejected');

throws(() => period({ recordId: 'BAD-DAYS', operatingDays: 0 }), /operatingDays must be a positive integer/, 'operating days must be positive');
throws(() => period({ recordId: 'BAD-ATTENDANCE', attendanceCount: 0, admissionsRevenueSar: 1, foodBeverageRevenueSar: 0, retailMerchandiseRevenueSar: 0, otherOperatingRevenueSar: 0 }), /LEISURE_REVENUE_WITH_ZERO_ATTENDANCE/, 'revenue cannot exist with zero attendance');

console.log(`WAVE_14C_LEISURE_OPERATING_METRICS=PASS checks=${checks}`);
