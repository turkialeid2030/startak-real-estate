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
  SPECIALIZED_FORECAST_METRIC,
  FORECAST_ASSUMPTION_ORIGIN,
  SPECIALIZED_FORECAST_STATUS,
  createSpecializedForecastLine,
  createSpecializedForecastPeriod,
  requiredMetrics,
  buildSpecializedForecastAssumptionPacket,
} = require('../../src/specialized-assets/specialized-forecast-assumptions');
const {
  FORECAST_ENGINE_FAMILY,
  calculateHospitalityOperatingForecast,
  calculateLeisureOperatingForecast,
  calculateSpecializedOperatingForecast,
} = require('../../src/engines/valuation/specialized-operating-forecast');
const {
  SPECIALIZED_OPERATING_FORECAST_STATUS,
  engineFamily,
  valuesFromPeriod,
  buildSpecializedOperatingForecastPacket,
  verifySpecializedOperatingForecastPacketIntegrity,
} = require('../../src/specialized-assets/specialized-operating-forecast');

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const eq = (actual, expected, message) => { assert.strictEqual(actual, expected, message); checks += 1; };
const approx = (actual, expected, tolerance, message) => { assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`); checks += 1; };
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
    caseId: 'CASE-14F',
    propertyRef: 'PROP-14F',
    assignmentRef: 'ASSIGN-14F',
    assignmentHashSha256: 'a'.repeat(64),
    inspectionId: 'INSP-14F',
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
  return Object.freeze({ ...core, packetHashSha256: sha256(core), status: 'READY_FOR_PROFESSIONAL_VALUATION_WORKFLOW', reasons: [], professionalValuationWorkflowReady: true, automaticUnderwritingAdoption: false, financialEngineInputsWritten: false, certifiedValuationEstablished: false, transactionAuthorized: false });
}

function evidenceItem(topic) {
  return createSpecializedEvidenceItem({
    evidenceItemId: `SE-${topic}`,
    caseId: 'CASE-14F',
    propertyRef: 'PROP-14F',
    topic,
    status: SPECIALIZED_EVIDENCE_ITEM_STATUS.VERIFIED,
    evidenceRefs: [`REF-${topic}`],
    asOfDate: '2026-01-01',
    rationale: `Verified ${topic}`,
    preparedByRef: 'ANALYST-14F',
    preparedAt: '2026-01-02',
    reviewedByRef: 'REVIEWER-14F',
    reviewedAt: '2026-01-03',
    reviewEvidenceRef: `REVIEW-${topic}`,
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
    specializationId: `SPEC-${assetClass}`,
    caseId: 'CASE-14F',
    propertyRef: 'PROP-14F',
    assetClass,
    operatingState: SPECIALIZED_OPERATING_STATE.OPERATING,
    operatingModel,
    analysisContext: SPECIALIZED_ANALYSIS_CONTEXT.PROFESSIONAL_VALUATION,
    propertyEvidencePacket: propertyPacket(),
    evidenceItems,
    conditionalApplicability,
    preparedByRef: 'ANALYST-14F',
    preparedAt: '2026-01-03',
    reviewedByRef: 'REVIEWER-14F-2',
    reviewedAt: '2026-01-04',
    reviewEvidenceRef: 'REVIEW-SPECIALIZED-14F',
  });
}

const VALUES = Object.freeze({
  [SPECIALIZED_FORECAST_METRIC.AVAILABLE_ROOM_NIGHTS]: 36500,
  [SPECIALIZED_FORECAST_METRIC.OCCUPANCY_RATE]: 0.70,
  [SPECIALIZED_FORECAST_METRIC.ADR_SAR]: 600,
  [SPECIALIZED_FORECAST_METRIC.FOOD_BEVERAGE_REVENUE_SAR]: 3500000,
  [SPECIALIZED_FORECAST_METRIC.OTHER_REVENUE_SAR]: 1000000,
  [SPECIALIZED_FORECAST_METRIC.DEPARTMENTAL_EXPENSES_SAR]: 5000000,
  [SPECIALIZED_FORECAST_METRIC.UNDISTRIBUTED_EXPENSES_SAR]: 4000000,
  [SPECIALIZED_FORECAST_METRIC.MANAGEMENT_FEES_SAR]: 900000,
  [SPECIALIZED_FORECAST_METRIC.FRANCHISE_FEES_SAR]: 0,
  [SPECIALIZED_FORECAST_METRIC.FF_E_RESERVE_SAR]: 700000,
  [SPECIALIZED_FORECAST_METRIC.OPERATING_DAYS]: 350,
  [SPECIALIZED_FORECAST_METRIC.ATTENDANCE]: 200000,
  [SPECIALIZED_FORECAST_METRIC.ADMISSIONS_REVENUE_PER_VISITOR_SAR]: 120,
  [SPECIALIZED_FORECAST_METRIC.ANCILLARY_SPEND_PER_VISITOR_SAR]: 45,
  [SPECIALIZED_FORECAST_METRIC.DIRECT_OPERATING_EXPENSES_SAR]: 11000000,
  [SPECIALIZED_FORECAST_METRIC.CAPITAL_RESERVE_SAR]: 800000,
});

function unit(metric) {
  if (metric === SPECIALIZED_FORECAST_METRIC.OCCUPANCY_RATE) return 'ratio';
  if (metric === SPECIALIZED_FORECAST_METRIC.AVAILABLE_ROOM_NIGHTS) return 'room_nights';
  if (metric === SPECIALIZED_FORECAST_METRIC.OPERATING_DAYS) return 'days';
  if (metric === SPECIALIZED_FORECAST_METRIC.ATTENDANCE) return 'visitors';
  if ([SPECIALIZED_FORECAST_METRIC.ADR_SAR, SPECIALIZED_FORECAST_METRIC.ADMISSIONS_REVENUE_PER_VISITOR_SAR, SPECIALIZED_FORECAST_METRIC.ANCILLARY_SPEND_PER_VISITOR_SAR].includes(metric)) return 'SAR_per_unit';
  return 'SAR';
}

function forecastLine(metric, suffix) {
  return createSpecializedForecastLine({
    lineId: `FL-${metric}-${suffix}`,
    metric,
    value: VALUES[metric],
    unit: unit(metric),
    origin: FORECAST_ASSUMPTION_ORIGIN.PROFESSIONAL_JUDGMENT,
    rationale: `Reviewed forecast assumption ${metric}`,
    evidenceRefs: [`EV-${metric}`],
    preparedByRef: 'FORECAST-ANALYST',
    preparedAt: '2026-01-05',
    reviewedByRef: 'FORECAST-REVIEWER',
    reviewedAt: '2026-01-06',
    reviewEvidenceRef: `REVIEW-${metric}`,
  });
}

function assumptionPacket(assetClass, operatingModel) {
  const required = requiredMetrics(assetClass, operatingModel);
  const period = createSpecializedForecastPeriod({
    periodId: 'Y1',
    periodStart: '2027-01-01',
    periodEnd: '2028-01-01',
    lines: required.map((metric) => forecastLine(metric, 'Y1')),
  });
  return buildSpecializedForecastAssumptionPacket({
    forecastPacketId: `FP-${assetClass}`,
    caseId: 'CASE-14F',
    propertyRef: 'PROP-14F',
    specializedAssetPacket: specializedPacket(assetClass, operatingModel),
    periods: [period],
    preparedByRef: 'FORECAST-ANALYST',
    preparedAt: '2026-01-06',
    reviewedByRef: 'FORECAST-REVIEWER-2',
    reviewedAt: '2026-01-07',
    reviewEvidenceRef: 'FORECAST-PACKET-REVIEW',
  });
}

const hotelValues = {
  AVAILABLE_ROOM_NIGHTS: 36500,
  OCCUPANCY_RATE: 0.7,
  ADR_SAR: 600,
  FOOD_BEVERAGE_REVENUE_SAR: 3500000,
  OTHER_REVENUE_SAR: 1000000,
  DEPARTMENTAL_EXPENSES_SAR: 5000000,
  UNDISTRIBUTED_EXPENSES_SAR: 4000000,
  MANAGEMENT_FEES_SAR: 900000,
  FF_E_RESERVE_SAR: 700000,
};
const hotelCalc = calculateHospitalityOperatingForecast(hotelValues);
eq(hotelCalc.family, FORECAST_ENGINE_FAMILY.HOSPITALITY, 'hospitality engine family explicit');
approx(hotelCalc.occupiedRoomNights, 25550, 1e-9, 'occupied room nights calculated');
approx(hotelCalc.roomsRevenueSar, 15330000, 1e-6, 'rooms revenue calculated');
approx(hotelCalc.revparSar, 420, 1e-9, 'RevPAR calculated from explicit assumptions');
approx(hotelCalc.totalOperatingRevenueSar, 19830000, 1e-6, 'hospitality total revenue calculated');
approx(hotelCalc.grossOperatingProfitBeforeOperatorFeesSar, 10830000, 1e-6, 'GOP before operator fees calculated');
approx(hotelCalc.operatingSurplusAfterReserveSar, 9230000, 1e-6, 'operating surplus after reserve calculated');

const leisureCalc = calculateLeisureOperatingForecast({
  OPERATING_DAYS: 350,
  ATTENDANCE: 200000,
  ADMISSIONS_REVENUE_PER_VISITOR_SAR: 120,
  ANCILLARY_SPEND_PER_VISITOR_SAR: 45,
  DIRECT_OPERATING_EXPENSES_SAR: 11000000,
  UNDISTRIBUTED_EXPENSES_SAR: 5000000,
  CAPITAL_RESERVE_SAR: 800000,
});
eq(leisureCalc.family, FORECAST_ENGINE_FAMILY.LEISURE, 'leisure engine family explicit');
approx(leisureCalc.admissionsRevenueSar, 24000000, 1e-6, 'admissions revenue calculated');
approx(leisureCalc.ancillaryRevenueSar, 9000000, 1e-6, 'ancillary revenue calculated');
approx(leisureCalc.totalOperatingRevenueSar, 33000000, 1e-6, 'leisure total revenue calculated');
approx(leisureCalc.operatingSurplusAfterReserveSar, 16200000, 1e-6, 'leisure operating surplus after reserve calculated');
approx(leisureCalc.totalRevenuePerVisitorSar, 165, 1e-9, 'total revenue per visitor calculated');

eq(engineFamily('HOSPITALITY'), FORECAST_ENGINE_FAMILY.HOSPITALITY, 'adapter maps hospitality family');
eq(engineFamily('LEISURE'), FORECAST_ENGINE_FAMILY.LEISURE, 'adapter maps leisure family');
throws(() => calculateSpecializedOperatingForecast('UNKNOWN', {}), /unsupported specialized forecast family/, 'unknown forecast family rejected');
throws(() => calculateHospitalityOperatingForecast({ ...hotelValues, OCCUPANCY_RATE: 1.2 }), /OCCUPANCY_RATE must be between 0 and 1/, 'engine rejects occupancy above 100%');

const hotelAssumptions = assumptionPacket(SPECIALIZED_ASSET_CLASS.HOTEL_FULL_SERVICE, SPECIALIZED_OPERATING_MODEL.MANAGEMENT_AGREEMENT);
eq(hotelAssumptions.status, SPECIALIZED_FORECAST_STATUS.READY_FOR_SPECIALIZED_FORECAST_CALCULATION, 'hotel assumptions qualified');
const hotelForecast = buildSpecializedOperatingForecastPacket({
  operatingForecastPacketId: 'OF-HOTEL',
  caseId: 'CASE-14F',
  propertyRef: 'PROP-14F',
  assumptionPacket: hotelAssumptions,
  preparedByRef: 'FORECAST-ANALYST',
  preparedAt: '2026-01-07',
  reviewedByRef: 'FORECAST-REVIEWER-3',
  reviewedAt: '2026-01-08',
  reviewEvidenceRef: 'OPERATING-FORECAST-REVIEW',
});
eq(hotelForecast.status, SPECIALIZED_OPERATING_FORECAST_STATUS.READY, 'hotel operating forecast packet ready');
check(hotelForecast.forecastProduced, 'forecast produced');
check(verifySpecializedOperatingForecastPacketIntegrity(hotelForecast), 'hotel operating forecast integrity verifies');
eq(hotelForecast.metricConvention, 'STARTAK_SPECIALIZED_OPERATING_FORECAST_V1', 'canonical forecast convention explicit');
eq(hotelForecast.noiProduced, false, 'operating surplus is not NOI');
eq(hotelForecast.valuationInputsWritten, false, 'forecast does not write valuation inputs');
eq(hotelForecast.discountingPerformed, false, 'no discounting');
eq(hotelForecast.terminalValueCalculated, false, 'no terminal value');
eq(hotelForecast.capitalizationPerformed, false, 'no capitalization');
eq(hotelForecast.valuationArithmeticPerformed, false, 'no property valuation arithmetic');
eq(hotelForecast.methodSelected, false, 'no valuation method selection');
eq(hotelForecast.investmentRecommendationProduced, false, 'no investment recommendation');
eq(hotelForecast.certifiedValuationEstablished, false, 'no certified valuation');
eq(hotelForecast.transactionAuthorized, false, 'no transaction authority');
check(hotelForecast.periodResults[0].sourceForecastPeriodHashSha256 === hotelAssumptions.periods[0].specializedForecastPeriodHashSha256, 'calculation bound to exact assumption-period hash');
check(hotelForecast.periodResults[0].assumptionLineHashes.length === hotelAssumptions.periods[0].lines.length, 'calculation traces all assumption line hashes');

const leisureAssumptions = assumptionPacket(SPECIALIZED_ASSET_CLASS.LEISURE_ATTRACTION, SPECIALIZED_OPERATING_MODEL.OWNER_OPERATED);
const leisureForecast = buildSpecializedOperatingForecastPacket({
  operatingForecastPacketId: 'OF-LEISURE',
  caseId: 'CASE-14F',
  propertyRef: 'PROP-14F',
  assumptionPacket: leisureAssumptions,
  preparedByRef: 'FORECAST-ANALYST',
  preparedAt: '2026-01-07',
  reviewedByRef: 'FORECAST-REVIEWER-3',
  reviewedAt: '2026-01-08',
  reviewEvidenceRef: 'LEISURE-FORECAST-REVIEW',
});
eq(leisureForecast.status, SPECIALIZED_OPERATING_FORECAST_STATUS.READY, 'leisure operating forecast ready');
eq(leisureForecast.forecastFamily, 'LEISURE', 'leisure family preserved');
check(leisureForecast.periodResults[0].metrics.attendance > 0, 'leisure attendance carried to canonical calculation');

const sourcePeriod = hotelAssumptions.periods[0];
const sourceValues = valuesFromPeriod(sourcePeriod);
eq(sourceValues.ADR_SAR, VALUES[SPECIALIZED_FORECAST_METRIC.ADR_SAR], 'adapter reads exact line values');

const tamperedAssumption = { ...hotelAssumptions, assetClass: SPECIALIZED_ASSET_CLASS.RESORT };
const assumptionHold = buildSpecializedOperatingForecastPacket({
  operatingForecastPacketId: 'OF-HOLD',
  caseId: 'CASE-14F',
  propertyRef: 'PROP-14F',
  assumptionPacket: tamperedAssumption,
  preparedByRef: 'A', preparedAt: '2026-01-07', reviewedByRef: 'R', reviewedAt: '2026-01-08', reviewEvidenceRef: 'REV',
});
eq(assumptionHold.status, SPECIALIZED_OPERATING_FORECAST_STATUS.HOLD_ASSUMPTION_PACKET, 'tampered assumption packet fails closed');

throws(() => buildSpecializedOperatingForecastPacket({
  operatingForecastPacketId: 'OF-CROSS', caseId: 'OTHER', propertyRef: 'PROP-14F', assumptionPacket: hotelAssumptions,
  preparedByRef: 'A', preparedAt: '2026-01-07', reviewedByRef: 'R', reviewedAt: '2026-01-08', reviewEvidenceRef: 'REV',
}), /CASE_OR_PROPERTY_ISOLATION_VIOLATION:assumptionPacket/, 'cross-case assumption packet rejected');

check(!verifySpecializedOperatingForecastPacketIntegrity({ ...hotelForecast, assetClass: SPECIALIZED_ASSET_CLASS.RESORT }), 'tampered operating forecast packet fails integrity');
check(Object.isFrozen(hotelForecast), 'operating forecast packet immutable');

console.log(`WAVE_14F_SPECIALIZED_OPERATING_FORECAST=PASS checks=${checks}`);
