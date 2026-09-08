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
} = require('../../src/specialized-assets/specialized-forecast-assumptions');

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const eq = (actual, expected, message) => { assert.strictEqual(actual, expected, message); checks += 1; };
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
    caseId: 'CASE-14E',
    propertyRef: 'PROP-14E',
    assignmentRef: 'ASSIGN-14E',
    assignmentHashSha256: 'a'.repeat(64),
    inspectionId: 'INSP-14E',
    inspectionHashSha256: 'b'.repeat(64),
    valuationDate: '2026-01-01',
    reportDate: '2026-01-05',
    jurisdiction: 'SAUDI_ARABIA',
    assetType: 'SPECIALIZED_REAL_ESTATE',
    assetLocation: 'Riyadh',
    valuedRights: { interest: 'FREEHOLD' },
    basisOfValue: { basis: 'MARKET_VALUE' },
    purpose: 'PROFESSIONAL_VALUATION',
    evidenceFacts: [{ key: 'specialized_asset', normalizedValue: true }],
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

function evidenceItem(topic, suffix = '') {
  return createSpecializedEvidenceItem({
    evidenceItemId: `SE-${topic}${suffix}`,
    caseId: 'CASE-14E',
    propertyRef: 'PROP-14E',
    topic,
    status: SPECIALIZED_EVIDENCE_ITEM_STATUS.VERIFIED,
    evidenceRefs: [`REF-${topic}${suffix}`],
    asOfDate: '2026-01-01',
    rationale: `Verified ${topic}`,
    preparedByRef: 'ANALYST-14E',
    preparedAt: '2026-01-02',
    reviewedByRef: 'REVIEWER-14E',
    reviewedAt: '2026-01-03',
    reviewEvidenceRef: `REVIEW-${topic}${suffix}`,
  });
}

function specializedPacket(assetClass, operatingModel) {
  const matrix = expectationMatrix(assetClass, SPECIALIZED_OPERATING_STATE.OPERATING, operatingModel);
  const evidenceItems = [];
  const conditionalApplicability = {};
  for (const [topic, expectation] of Object.entries(matrix)) {
    if (expectation === SPECIALIZED_EVIDENCE_EXPECTATION.REQUIRED) evidenceItems.push(evidenceItem(topic));
    if (expectation === SPECIALIZED_EVIDENCE_EXPECTATION.CONDITIONAL) conditionalApplicability[topic] = false;
  }
  return buildSpecializedAssetEvidencePacket({
    specializationId: `SPEC-14E-${assetClass}-${operatingModel}`,
    caseId: 'CASE-14E',
    propertyRef: 'PROP-14E',
    assetClass,
    operatingState: SPECIALIZED_OPERATING_STATE.OPERATING,
    operatingModel,
    analysisContext: SPECIALIZED_ANALYSIS_CONTEXT.PROFESSIONAL_VALUATION,
    propertyEvidencePacket: propertyPacket(),
    evidenceItems,
    conditionalApplicability,
    preparedByRef: 'ANALYST-14E',
    preparedAt: '2026-01-03',
    reviewedByRef: 'REVIEWER-14E-2',
    reviewedAt: '2026-01-04',
    reviewEvidenceRef: 'REVIEW-SPECIALIZED-14E',
  });
}

const UNIT = Object.freeze({
  [SPECIALIZED_FORECAST_METRIC.AVAILABLE_ROOM_NIGHTS]: 'room_nights',
  [SPECIALIZED_FORECAST_METRIC.OCCUPANCY_RATE]: 'ratio',
  [SPECIALIZED_FORECAST_METRIC.ADR_SAR]: 'SAR_per_occupied_room_night',
  [SPECIALIZED_FORECAST_METRIC.FOOD_BEVERAGE_REVENUE_SAR]: 'SAR',
  [SPECIALIZED_FORECAST_METRIC.OTHER_REVENUE_SAR]: 'SAR',
  [SPECIALIZED_FORECAST_METRIC.DEPARTMENTAL_EXPENSES_SAR]: 'SAR',
  [SPECIALIZED_FORECAST_METRIC.UNDISTRIBUTED_EXPENSES_SAR]: 'SAR',
  [SPECIALIZED_FORECAST_METRIC.MANAGEMENT_FEES_SAR]: 'SAR',
  [SPECIALIZED_FORECAST_METRIC.FRANCHISE_FEES_SAR]: 'SAR',
  [SPECIALIZED_FORECAST_METRIC.FF_E_RESERVE_SAR]: 'SAR',
  [SPECIALIZED_FORECAST_METRIC.OPERATING_DAYS]: 'days',
  [SPECIALIZED_FORECAST_METRIC.ATTENDANCE]: 'visitors',
  [SPECIALIZED_FORECAST_METRIC.ADMISSIONS_REVENUE_PER_VISITOR_SAR]: 'SAR_per_visitor',
  [SPECIALIZED_FORECAST_METRIC.ANCILLARY_SPEND_PER_VISITOR_SAR]: 'SAR_per_visitor',
  [SPECIALIZED_FORECAST_METRIC.DIRECT_OPERATING_EXPENSES_SAR]: 'SAR',
  [SPECIALIZED_FORECAST_METRIC.CAPITAL_RESERVE_SAR]: 'SAR',
});

function sampleValue(metric) {
  if (metric === SPECIALIZED_FORECAST_METRIC.OCCUPANCY_RATE) return 0.7;
  if (metric === SPECIALIZED_FORECAST_METRIC.AVAILABLE_ROOM_NIGHTS) return 36500;
  if (metric === SPECIALIZED_FORECAST_METRIC.ADR_SAR) return 650;
  if (metric === SPECIALIZED_FORECAST_METRIC.OPERATING_DAYS) return 350;
  if (metric === SPECIALIZED_FORECAST_METRIC.ATTENDANCE) return 250000;
  if (metric.includes('PER_VISITOR')) return 75;
  return 1000000;
}

function line(metric, suffix = '') {
  return createSpecializedForecastLine({
    lineId: `FL-${metric}${suffix}`,
    metric,
    value: sampleValue(metric),
    unit: UNIT[metric] || 'SAR',
    origin: FORECAST_ASSUMPTION_ORIGIN.PROFESSIONAL_JUDGMENT,
    rationale: `Explicit reviewed assumption for ${metric}`,
    evidenceRefs: [`EV-${metric}${suffix}`],
    preparedByRef: 'FORECAST-ANALYST',
    preparedAt: '2026-01-05',
    reviewedByRef: 'FORECAST-REVIEWER',
    reviewedAt: '2026-01-06',
    reviewEvidenceRef: `REVIEW-${metric}${suffix}`,
  });
}

function periodFor(assetClass, operatingModel, periodId = 'P1', start = '2027-01-01', end = '2028-01-01') {
  const metrics = requiredMetrics(assetClass, operatingModel);
  return createSpecializedForecastPeriod({
    periodId,
    periodStart: start,
    periodEnd: end,
    lines: metrics.map((metric) => line(metric, `-${periodId}`)),
  });
}

function packetInput(assetClass, operatingModel, periods) {
  return {
    forecastPacketId: `FP-${assetClass}`,
    caseId: 'CASE-14E',
    propertyRef: 'PROP-14E',
    specializedAssetPacket: specializedPacket(assetClass, operatingModel),
    periods,
    preparedByRef: 'FORECAST-ANALYST',
    preparedAt: '2026-01-06',
    reviewedByRef: 'FORECAST-REVIEWER-2',
    reviewedAt: '2026-01-07',
    reviewEvidenceRef: 'FORECAST-PACKET-REVIEW',
  };
}

eq(familyForAssetClass(SPECIALIZED_ASSET_CLASS.HOTEL_FULL_SERVICE), SPECIALIZED_FORECAST_FAMILY.HOSPITALITY, 'hotel routes to hospitality family');
eq(familyForAssetClass(SPECIALIZED_ASSET_CLASS.LEISURE_ATTRACTION), SPECIALIZED_FORECAST_FAMILY.LEISURE, 'leisure routes to leisure family');
eq(familyForAssetClass(SPECIALIZED_ASSET_CLASS.HERITAGE_ASSET), null, 'heritage is not silently routed into hospitality/leisure forecast');

const hotelReq = requiredMetrics(SPECIALIZED_ASSET_CLASS.HOTEL_FULL_SERVICE, SPECIALIZED_OPERATING_MODEL.MANAGEMENT_AGREEMENT);
check(hotelReq.includes(SPECIALIZED_FORECAST_METRIC.AVAILABLE_ROOM_NIGHTS), 'hotel requires available room nights');
check(hotelReq.includes(SPECIALIZED_FORECAST_METRIC.OCCUPANCY_RATE), 'hotel requires occupancy');
check(hotelReq.includes(SPECIALIZED_FORECAST_METRIC.ADR_SAR), 'hotel requires ADR');
check(hotelReq.includes(SPECIALIZED_FORECAST_METRIC.FOOD_BEVERAGE_REVENUE_SAR), 'full-service hotel requires F&B forecast');
check(hotelReq.includes(SPECIALIZED_FORECAST_METRIC.MANAGEMENT_FEES_SAR), 'managed hotel requires management fee assumption');

const sampleLine = line(SPECIALIZED_FORECAST_METRIC.ADR_SAR);
check(verifySpecializedForecastLineIntegrity(sampleLine), 'forecast line integrity verifies');
eq(sampleLine.automaticallyDerivedFromHistoricalMetrics, false, 'line is not auto-derived from history');
eq(sampleLine.probabilityAssigned, false, 'line has no probability');
check(!verifySpecializedForecastLineIntegrity({ ...sampleLine, value: 999 }), 'tampered forecast line fails integrity');
throws(() => createSpecializedForecastLine({ ...sampleLine, lineId: 'BAD-OCC', metric: SPECIALIZED_FORECAST_METRIC.OCCUPANCY_RATE, value: 1.2, specializedForecastLineHashSha256: undefined }), /OCCUPANCY_RATE must be between 0 and 1/, 'occupancy over 100% rejected');

const hotelPeriod = periodFor(SPECIALIZED_ASSET_CLASS.HOTEL_FULL_SERVICE, SPECIALIZED_OPERATING_MODEL.MANAGEMENT_AGREEMENT);
check(verifySpecializedForecastPeriodIntegrity(hotelPeriod), 'forecast period integrity verifies');
const hotelPacket = buildSpecializedForecastAssumptionPacket(packetInput(
  SPECIALIZED_ASSET_CLASS.HOTEL_FULL_SERVICE,
  SPECIALIZED_OPERATING_MODEL.MANAGEMENT_AGREEMENT,
  [hotelPeriod],
));
eq(hotelPacket.status, SPECIALIZED_FORECAST_STATUS.READY_FOR_SPECIALIZED_FORECAST_CALCULATION, 'hotel assumption packet ready');
check(hotelPacket.readyForSpecializedForecastCalculation, 'hotel packet permits later calculation workflow');
check(verifySpecializedForecastAssumptionPacketIntegrity(hotelPacket), 'hotel forecast packet integrity verifies');
eq(hotelPacket.assumptionGovernanceOnly, true, 'packet is assumption governance only');
eq(hotelPacket.automaticallyDerivedFromHistoricalMetrics, false, 'packet does not auto-derive assumptions');
eq(hotelPacket.probabilitiesAssigned, false, 'packet does not assign probabilities');
eq(hotelPacket.forecastCalculationPerformed, false, 'no forecast calculation yet');
eq(hotelPacket.noiProduced, false, 'no NOI produced');
eq(hotelPacket.valuationInputsWritten, false, 'no valuation inputs written');
eq(hotelPacket.methodSelected, false, 'no method selected');
eq(hotelPacket.certifiedValuationEstablished, false, 'no certified valuation');
eq(hotelPacket.transactionAuthorized, false, 'no transaction authority');

const leisurePeriod = periodFor(SPECIALIZED_ASSET_CLASS.LEISURE_ATTRACTION, SPECIALIZED_OPERATING_MODEL.OWNER_OPERATED);
const leisurePacket = buildSpecializedForecastAssumptionPacket(packetInput(
  SPECIALIZED_ASSET_CLASS.LEISURE_ATTRACTION,
  SPECIALIZED_OPERATING_MODEL.OWNER_OPERATED,
  [leisurePeriod],
));
eq(leisurePacket.status, SPECIALIZED_FORECAST_STATUS.READY_FOR_SPECIALIZED_FORECAST_CALCULATION, 'leisure assumption packet ready');
eq(leisurePacket.forecastFamily, SPECIALIZED_FORECAST_FAMILY.LEISURE, 'leisure packet family explicit');
check(leisurePacket.requiredMetrics.includes(SPECIALIZED_FORECAST_METRIC.ATTENDANCE), 'leisure forecast requires attendance');
check(!leisurePacket.requiredMetrics.includes(SPECIALIZED_FORECAST_METRIC.ADR_SAR), 'leisure forecast does not inherit hotel ADR');

const missingLines = hotelPeriod.lines.filter((entry) => entry.metric !== SPECIALIZED_FORECAST_METRIC.ADR_SAR);
const missingPeriod = createSpecializedForecastPeriod({ periodId: 'MISSING', periodStart: '2027-01-01', periodEnd: '2028-01-01', lines: missingLines });
const missingHold = buildSpecializedForecastAssumptionPacket(packetInput(
  SPECIALIZED_ASSET_CLASS.HOTEL_FULL_SERVICE,
  SPECIALIZED_OPERATING_MODEL.MANAGEMENT_AGREEMENT,
  [missingPeriod],
));
eq(missingHold.status, SPECIALIZED_FORECAST_STATUS.HOLD_FORECAST_ASSUMPTIONS, 'missing required forecast metric fails closed');
check(missingHold.blockers.includes('REQUIRED_FORECAST_METRIC_MISSING:MISSING:ADR_SAR'), 'missing metric blocker explicit');

const wrongLine = line(SPECIALIZED_FORECAST_METRIC.ATTENDANCE, '-WRONG');
const wrongPeriod = createSpecializedForecastPeriod({
  periodId: 'WRONG', periodStart: '2027-01-01', periodEnd: '2028-01-01', lines: [...hotelPeriod.lines, wrongLine],
});
const wrongHold = buildSpecializedForecastAssumptionPacket(packetInput(
  SPECIALIZED_ASSET_CLASS.HOTEL_FULL_SERVICE,
  SPECIALIZED_OPERATING_MODEL.MANAGEMENT_AGREEMENT,
  [wrongPeriod],
));
eq(wrongHold.status, SPECIALIZED_FORECAST_STATUS.HOLD_FORECAST_ASSUMPTIONS, 'leisure metric cannot enter hospitality forecast');
check(wrongHold.blockers.some((b) => b.includes('FORECAST_METRIC_NOT_ALLOWED_FOR_HOSPITALITY')), 'wrong-family metric blocker explicit');

const overlap1 = periodFor(SPECIALIZED_ASSET_CLASS.LEISURE_ATTRACTION, SPECIALIZED_OPERATING_MODEL.OWNER_OPERATED, 'O1', '2027-01-01', '2028-01-01');
const overlap2 = periodFor(SPECIALIZED_ASSET_CLASS.LEISURE_ATTRACTION, SPECIALIZED_OPERATING_MODEL.OWNER_OPERATED, 'O2', '2027-06-01', '2028-06-01');
const overlapHold = buildSpecializedForecastAssumptionPacket(packetInput(
  SPECIALIZED_ASSET_CLASS.LEISURE_ATTRACTION,
  SPECIALIZED_OPERATING_MODEL.OWNER_OPERATED,
  [overlap1, overlap2],
));
eq(overlapHold.status, SPECIALIZED_FORECAST_STATUS.HOLD_FORECAST_ASSUMPTIONS, 'overlapping forecast periods fail closed');
check(overlapHold.blockers.includes('FORECAST_PERIOD_OVERLAP:O1:O2'), 'overlap blocker explicit');

const preValuationPeriod = periodFor(SPECIALIZED_ASSET_CLASS.LEISURE_ATTRACTION, SPECIALIZED_OPERATING_MODEL.OWNER_OPERATED, 'PRE', '2025-01-01', '2026-01-01');
const preHold = buildSpecializedForecastAssumptionPacket(packetInput(
  SPECIALIZED_ASSET_CLASS.LEISURE_ATTRACTION,
  SPECIALIZED_OPERATING_MODEL.OWNER_OPERATED,
  [preValuationPeriod],
));
eq(preHold.status, SPECIALIZED_FORECAST_STATUS.HOLD_FORECAST_ASSUMPTIONS, 'forecast period before valuation date fails closed');
check(preHold.blockers.includes('FORECAST_PERIOD_MUST_START_AFTER_VALUATION_DATE:PRE'), 'pre-valuation forecast blocker explicit');

const heritagePacket = buildSpecializedForecastAssumptionPacket(packetInput(
  SPECIALIZED_ASSET_CLASS.HERITAGE_ASSET,
  SPECIALIZED_OPERATING_MODEL.OWNER_OPERATED,
  [leisurePeriod],
));
eq(heritagePacket.status, SPECIALIZED_FORECAST_STATUS.NOT_APPLICABLE_ASSET_CLASS, 'heritage is not automatically forecast as leisure/hospitality');

const tamperedSpecialized = { ...specializedPacket(SPECIALIZED_ASSET_CLASS.LEISURE_ATTRACTION, SPECIALIZED_OPERATING_MODEL.OWNER_OPERATED), operatingModel: SPECIALIZED_OPERATING_MODEL.FRANCHISE };
const specializedHold = buildSpecializedForecastAssumptionPacket({
  ...packetInput(SPECIALIZED_ASSET_CLASS.LEISURE_ATTRACTION, SPECIALIZED_OPERATING_MODEL.OWNER_OPERATED, [leisurePeriod]),
  specializedAssetPacket: tamperedSpecialized,
});
eq(specializedHold.status, SPECIALIZED_FORECAST_STATUS.HOLD_SPECIALIZED_PACKET, 'tampered specialized packet fails closed');

const tamperedPeriod = { ...leisurePeriod, periodEnd: '2029-01-01' };
const integrityHold = buildSpecializedForecastAssumptionPacket(packetInput(
  SPECIALIZED_ASSET_CLASS.LEISURE_ATTRACTION,
  SPECIALIZED_OPERATING_MODEL.OWNER_OPERATED,
  [tamperedPeriod],
));
eq(integrityHold.status, SPECIALIZED_FORECAST_STATUS.HOLD_INTEGRITY, 'tampered forecast period fails integrity');

throws(() => createSpecializedForecastPeriod({ periodId: 'DUP', periodStart: '2027-01-01', periodEnd: '2028-01-01', lines: [sampleLine, sampleLine] }), /DUPLICATE_FORECAST_LINE_ID/, 'duplicate forecast lines rejected');
throws(() => createSpecializedForecastPeriod({ periodId: 'BAD-PERIOD', periodStart: '2028-01-01', periodEnd: '2027-01-01', lines: [sampleLine] }), /FORECAST_PERIOD_END_MUST_BE_AFTER_START/, 'invalid forecast period interval rejected');
check(!verifySpecializedForecastAssumptionPacketIntegrity({ ...hotelPacket, forecastFamily: SPECIALIZED_FORECAST_FAMILY.LEISURE }), 'tampered forecast packet fails integrity');

console.log(`WAVE_14E_SPECIALIZED_FORECAST_ASSUMPTIONS=PASS checks=${checks}`);
