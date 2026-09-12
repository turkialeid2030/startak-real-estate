'use strict';

const assert = require('assert');
const crypto = require('crypto');
const {
  SPECIALIZED_ASSET_CLASS,
  SPECIALIZED_OPERATING_STATE,
  SPECIALIZED_OPERATING_MODEL,
  SPECIALIZED_ANALYSIS_CONTEXT,
  SPECIALIZED_EVIDENCE_TOPIC,
  SPECIALIZED_EVIDENCE_EXPECTATION,
  SPECIALIZED_EVIDENCE_ITEM_STATUS,
  SPECIALIZED_ASSET_PACKET_STATUS,
  expectationMatrix,
  verifyPropertyEvidencePacketIntegrity,
  createSpecializedEvidenceItem,
  verifySpecializedEvidenceItemIntegrity,
  buildSpecializedAssetEvidencePacket,
  verifySpecializedAssetEvidencePacketIntegrity,
} = require('../../src/specialized-assets/specialized-asset-evidence');

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
    caseId: 'CASE-14A',
    propertyRef: 'PROP-14A',
    assignmentRef: 'ASSIGN-14A',
    assignmentHashSha256: 'a'.repeat(64),
    inspectionId: 'INSP-14A',
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

function item(topic, status = SPECIALIZED_EVIDENCE_ITEM_STATUS.VERIFIED, suffix = '') {
  return createSpecializedEvidenceItem({
    evidenceItemId: `SE-${topic}${suffix}`,
    caseId: 'CASE-14A',
    propertyRef: 'PROP-14A',
    topic,
    status,
    evidenceRefs: [SPECIALIZED_EVIDENCE_ITEM_STATUS.MISSING, SPECIALIZED_EVIDENCE_ITEM_STATUS.NOT_APPLICABLE].includes(status)
      ? []
      : [`REF-${topic}${suffix}`],
    asOfDate: '2026-01-01',
    rationale: `Evidence for ${topic}`,
    preparedByRef: 'ANALYST-14A',
    preparedAt: '2026-01-02',
    reviewedByRef: 'REVIEWER-14A',
    reviewedAt: '2026-01-03',
    reviewEvidenceRef: `REVIEW-${topic}${suffix}`,
  });
}

function inputsFor(assetClass, operatingState, operatingModel, overrides = {}) {
  const matrix = expectationMatrix(assetClass, operatingState, operatingModel);
  const evidenceItems = [];
  const conditionalApplicability = {};
  for (const [topic, expectation] of Object.entries(matrix)) {
    if (expectation === SPECIALIZED_EVIDENCE_EXPECTATION.REQUIRED) evidenceItems.push(item(topic));
    if (expectation === SPECIALIZED_EVIDENCE_EXPECTATION.CONDITIONAL) conditionalApplicability[topic] = false;
  }
  return {
    specializationId: `SPEC-${assetClass}-${operatingState}-${operatingModel}`,
    caseId: 'CASE-14A',
    propertyRef: 'PROP-14A',
    assetClass,
    operatingState,
    operatingModel,
    analysisContext: SPECIALIZED_ANALYSIS_CONTEXT.PROFESSIONAL_VALUATION,
    propertyEvidencePacket: propertyPacket(),
    evidenceItems,
    conditionalApplicability,
    preparedByRef: 'ANALYST-14A',
    preparedAt: '2026-01-03',
    reviewedByRef: 'REVIEWER-14A-2',
    reviewedAt: '2026-01-04',
    reviewEvidenceRef: 'REVIEW-SPECIALIZED-14A',
    ...overrides,
  };
}

const property = propertyPacket();
check(verifyPropertyEvidencePacketIntegrity(property), 'property evidence packet integrity verifies');

const hotelMatrix = expectationMatrix(
  SPECIALIZED_ASSET_CLASS.HOTEL_FULL_SERVICE,
  SPECIALIZED_OPERATING_STATE.OPERATING,
  SPECIALIZED_OPERATING_MODEL.MANAGEMENT_AGREEMENT,
);
eq(hotelMatrix[SPECIALIZED_EVIDENCE_TOPIC.ROOM_KEY_OR_UNIT_INVENTORY], SPECIALIZED_EVIDENCE_EXPECTATION.REQUIRED, 'hotel room inventory required');
eq(hotelMatrix[SPECIALIZED_EVIDENCE_TOPIC.OPERATING_STATEMENTS], SPECIALIZED_EVIDENCE_EXPECTATION.REQUIRED, 'hotel operating statements required');
eq(hotelMatrix[SPECIALIZED_EVIDENCE_TOPIC.OCCUPANCY_ADR_REVPAR], SPECIALIZED_EVIDENCE_EXPECTATION.REQUIRED, 'hotel occupancy ADR RevPAR required');
eq(hotelMatrix[SPECIALIZED_EVIDENCE_TOPIC.FOOD_BEVERAGE_AND_OTHER_REVENUE], SPECIALIZED_EVIDENCE_EXPECTATION.REQUIRED, 'full-service F&B evidence required');
eq(hotelMatrix[SPECIALIZED_EVIDENCE_TOPIC.MANAGEMENT_FRANCHISE_AND_OPERATOR_AGREEMENTS], SPECIALIZED_EVIDENCE_EXPECTATION.REQUIRED, 'management agreement evidence required');

const hotel = buildSpecializedAssetEvidencePacket(inputsFor(
  SPECIALIZED_ASSET_CLASS.HOTEL_FULL_SERVICE,
  SPECIALIZED_OPERATING_STATE.OPERATING,
  SPECIALIZED_OPERATING_MODEL.MANAGEMENT_AGREEMENT,
));
eq(hotel.status, SPECIALIZED_ASSET_PACKET_STATUS.READY_FOR_SPECIALIZED_ASSET_PROFESSIONAL_WORKFLOW, 'hotel packet ready');
check(hotel.readyForSpecializedAssetProfessionalWorkflow, 'specialized workflow handoff ready');
check(verifySpecializedAssetEvidencePacketIntegrity(hotel), 'hotel packet integrity verifies');
check(Object.isFrozen(hotel), 'hotel packet immutable');
eq(hotel.automaticMethodSelection, false, 'no automatic method selection');
eq(hotel.automaticValuationInputAdoption, false, 'no automatic valuation input adoption');
eq(hotel.valuationArithmeticPerformed, false, 'no valuation arithmetic');
eq(hotel.forecastOrGopCalculationPerformed, false, 'no GOP or forecast calculation');
eq(hotel.legalOrLicensingConclusionEstablished, false, 'no licensing/legal conclusion');
eq(hotel.brandOrOperatorAgreementInterpretationPerformed, false, 'no agreement interpretation');
eq(hotel.certifiedValuationEstablished, false, 'no certified valuation');
eq(hotel.transactionAuthorized, false, 'no transaction authority');

const tamperedHotel = { ...hotel, operatingState: SPECIALIZED_OPERATING_STATE.VACANT };
check(!verifySpecializedAssetEvidencePacketIntegrity(tamperedHotel), 'tampered packet fails integrity');

const franchiseMatrix = expectationMatrix(
  SPECIALIZED_ASSET_CLASS.HOTEL_LIMITED_SERVICE,
  SPECIALIZED_OPERATING_STATE.OPERATING,
  SPECIALIZED_OPERATING_MODEL.FRANCHISE,
);
eq(franchiseMatrix[SPECIALIZED_EVIDENCE_TOPIC.MANAGEMENT_FRANCHISE_AND_OPERATOR_AGREEMENTS], SPECIALIZED_EVIDENCE_EXPECTATION.REQUIRED, 'franchise agreement evidence required');
eq(franchiseMatrix[SPECIALIZED_EVIDENCE_TOPIC.BRAND_STANDARD_AND_PIP], SPECIALIZED_EVIDENCE_EXPECTATION.REQUIRED, 'franchise brand/PIP evidence required');

const developmentMatrix = expectationMatrix(
  SPECIALIZED_ASSET_CLASS.HOTEL_FULL_SERVICE,
  SPECIALIZED_OPERATING_STATE.DEVELOPMENT,
  SPECIALIZED_OPERATING_MODEL.NOT_APPLICABLE,
);
eq(developmentMatrix[SPECIALIZED_EVIDENCE_TOPIC.OPERATING_STATEMENTS], SPECIALIZED_EVIDENCE_EXPECTATION.NOT_APPLICABLE, 'development hotel does not require operating statements');
eq(developmentMatrix[SPECIALIZED_EVIDENCE_TOPIC.OCCUPANCY_ADR_REVPAR], SPECIALIZED_EVIDENCE_EXPECTATION.NOT_APPLICABLE, 'development hotel does not require historical ADR/RevPAR');
eq(developmentMatrix[SPECIALIZED_EVIDENCE_TOPIC.ROOM_KEY_OR_UNIT_INVENTORY], SPECIALIZED_EVIDENCE_EXPECTATION.REQUIRED, 'development hotel still requires key inventory/program evidence');

const leisureMatrix = expectationMatrix(
  SPECIALIZED_ASSET_CLASS.LEISURE_ATTRACTION,
  SPECIALIZED_OPERATING_STATE.OPERATING,
  SPECIALIZED_OPERATING_MODEL.OWNER_OPERATED,
);
eq(leisureMatrix[SPECIALIZED_EVIDENCE_TOPIC.LEISURE_ATTENDANCE_AND_SPEND], SPECIALIZED_EVIDENCE_EXPECTATION.REQUIRED, 'leisure attendance/spend required');
eq(leisureMatrix[SPECIALIZED_EVIDENCE_TOPIC.OCCUPANCY_ADR_REVPAR], SPECIALIZED_EVIDENCE_EXPECTATION.NOT_APPLICABLE, 'hotel ADR/RevPAR not imposed on leisure attraction');

const heritageMatrix = expectationMatrix(
  SPECIALIZED_ASSET_CLASS.HERITAGE_ASSET,
  SPECIALIZED_OPERATING_STATE.VACANT,
  SPECIALIZED_OPERATING_MODEL.NOT_APPLICABLE,
);
eq(heritageMatrix[SPECIALIZED_EVIDENCE_TOPIC.HERITAGE_DESIGNATION_AND_RESTRICTIONS], SPECIALIZED_EVIDENCE_EXPECTATION.REQUIRED, 'heritage designation/restrictions required');
eq(heritageMatrix[SPECIALIZED_EVIDENCE_TOPIC.CONSERVATION_AND_ADAPTIVE_REUSE_REQUIREMENTS], SPECIALIZED_EVIDENCE_EXPECTATION.REQUIRED, 'heritage conservation evidence required');
eq(heritageMatrix[SPECIALIZED_EVIDENCE_TOPIC.ROOM_KEY_OR_UNIT_INVENTORY], SPECIALIZED_EVIDENCE_EXPECTATION.NOT_APPLICABLE, 'heritage asset does not inherit hotel key inventory');

const unverifiedInputs = inputsFor(
  SPECIALIZED_ASSET_CLASS.RESORT,
  SPECIALIZED_OPERATING_STATE.OPERATING,
  SPECIALIZED_OPERATING_MODEL.OWNER_OPERATED,
);
const requiredTopic = SPECIALIZED_EVIDENCE_TOPIC.ROOM_KEY_OR_UNIT_INVENTORY;
unverifiedInputs.evidenceItems = unverifiedInputs.evidenceItems.map((entry) => entry.topic === requiredTopic
  ? item(requiredTopic, SPECIALIZED_EVIDENCE_ITEM_STATUS.ASSUMED, '-ASSUMED')
  : entry);
const unverified = buildSpecializedAssetEvidencePacket(unverifiedInputs);
eq(unverified.status, SPECIALIZED_ASSET_PACKET_STATUS.HOLD_SPECIALIZED_EVIDENCE, 'assumed mandatory evidence fails closed');
check(unverified.blockers.some((b) => b.includes(`REQUIRED_SPECIALIZED_EVIDENCE_NOT_VERIFIED:${requiredTopic}`)), 'assumed required evidence blocker explicit');

const missingInputs = inputsFor(
  SPECIALIZED_ASSET_CLASS.SERVICED_APARTMENTS,
  SPECIALIZED_OPERATING_STATE.OPERATING,
  SPECIALIZED_OPERATING_MODEL.INDEPENDENT_OPERATOR,
);
missingInputs.evidenceItems = missingInputs.evidenceItems.filter((entry) => entry.topic !== SPECIALIZED_EVIDENCE_TOPIC.OPERATING_STATEMENTS);
const missing = buildSpecializedAssetEvidencePacket(missingInputs);
eq(missing.status, SPECIALIZED_ASSET_PACKET_STATUS.HOLD_SPECIALIZED_EVIDENCE, 'missing operating statements fail closed');
check(missing.blockers.includes(`REQUIRED_SPECIALIZED_EVIDENCE_MISSING:${SPECIALIZED_EVIDENCE_TOPIC.OPERATING_STATEMENTS}`), 'missing evidence blocker explicit');

const conditionalInputs = inputsFor(
  SPECIALIZED_ASSET_CLASS.HOTEL_LIMITED_SERVICE,
  SPECIALIZED_OPERATING_STATE.DEVELOPMENT,
  SPECIALIZED_OPERATING_MODEL.NOT_APPLICABLE,
);
delete conditionalInputs.conditionalApplicability[SPECIALIZED_EVIDENCE_TOPIC.SEASONALITY_AND_EVENT_CALENDAR];
const conditionalMissing = buildSpecializedAssetEvidencePacket(conditionalInputs);
eq(conditionalMissing.status, SPECIALIZED_ASSET_PACKET_STATUS.HOLD_SPECIALIZED_EVIDENCE, 'conditional applicability decision cannot be omitted');
check(conditionalMissing.blockers.some((b) => b.includes('CONDITIONAL_SPECIALIZED_APPLICABILITY_DECISION_REQUIRED')), 'conditional applicability blocker explicit');

const integrityInputs = inputsFor(
  SPECIALIZED_ASSET_CLASS.HOTEL_FULL_SERVICE,
  SPECIALIZED_OPERATING_STATE.OPERATING,
  SPECIALIZED_OPERATING_MODEL.OWNER_OPERATED,
);
integrityInputs.evidenceItems[0] = { ...integrityInputs.evidenceItems[0], rationale: 'tampered' };
const integrityHold = buildSpecializedAssetEvidencePacket(integrityInputs);
eq(integrityHold.status, SPECIALIZED_ASSET_PACKET_STATUS.HOLD_INTEGRITY, 'tampered evidence fails integrity');

const propertyTamperInputs = inputsFor(
  SPECIALIZED_ASSET_CLASS.RESORT,
  SPECIALIZED_OPERATING_STATE.DEVELOPMENT,
  SPECIALIZED_OPERATING_MODEL.NOT_APPLICABLE,
);
propertyTamperInputs.propertyEvidencePacket = { ...propertyTamperInputs.propertyEvidencePacket, assetLocation: 'Jeddah' };
const propertyHold = buildSpecializedAssetEvidencePacket(propertyTamperInputs);
eq(propertyHold.status, SPECIALIZED_ASSET_PACKET_STATUS.HOLD_PROPERTY_EVIDENCE, 'tampered property packet fails closed');

const modelInputs = inputsFor(
  SPECIALIZED_ASSET_CLASS.HOTEL_FULL_SERVICE,
  SPECIALIZED_OPERATING_STATE.OPERATING,
  SPECIALIZED_OPERATING_MODEL.NOT_APPLICABLE,
);
const modelHold = buildSpecializedAssetEvidencePacket(modelInputs);
eq(modelHold.status, SPECIALIZED_ASSET_PACKET_STATUS.HOLD_SPECIALIZED_EVIDENCE, 'active asset requires operating model');
check(modelHold.blockers.includes('OPERATING_MODEL_REQUIRED_FOR_ACTIVE_SPECIALIZED_ASSET'), 'operating model blocker explicit');

const crossCase = inputsFor(
  SPECIALIZED_ASSET_CLASS.HERITAGE_ASSET,
  SPECIALIZED_OPERATING_STATE.VACANT,
  SPECIALIZED_OPERATING_MODEL.NOT_APPLICABLE,
);
crossCase.evidenceItems[0] = { ...crossCase.evidenceItems[0], caseId: 'OTHER-CASE' };
throws(() => buildSpecializedAssetEvidencePacket(crossCase), /CASE_OR_PROPERTY_ISOLATION_VIOLATION:specializedEvidenceItem/, 'cross-case specialized evidence rejected');

const sample = item(SPECIALIZED_EVIDENCE_TOPIC.SUPPLY_PIPELINE);
check(verifySpecializedEvidenceItemIntegrity(sample), 'specialized evidence item integrity verifies');
check(!verifySpecializedEvidenceItemIntegrity({ ...sample, rationale: 'changed' }), 'tampered evidence item integrity fails');

console.log(`WAVE_14A_SPECIALIZED_ASSET_FOUNDATION=PASS checks=${checks}`);
