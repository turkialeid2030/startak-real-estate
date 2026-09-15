'use strict';

const assert = require('assert');
const crypto = require('crypto');
const {
  COMMERCIAL_ASSET_CLASS,
  OCCUPANCY_STRUCTURE,
  COMMERCIAL_ANALYSIS_CONTEXT,
  COMMERCIAL_EVIDENCE_TOPIC,
  EVIDENCE_EXPECTATION,
  EVIDENCE_ITEM_STATUS,
  COMMERCIAL_SPECIALIZATION_STATUS,
  expectationMatrix,
  verifyPropertyEvidencePacketIntegrity,
  createCommercialEvidenceItem,
  verifyCommercialEvidenceItemIntegrity,
  buildCommercialSpecializationPacket,
  verifyCommercialSpecializationPacketIntegrity,
} = require('../../src/commercial/commercial-specialization');

let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks += 1; }
function eq(actual, expected, message) { assert.strictEqual(actual, expected, message); checks += 1; }
function throws(fn, pattern, message) { assert.throws(fn, pattern, message); checks += 1; }

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = stableClone(value[key]); return out; }, {});
}
function sha256(value) { return crypto.createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex'); }

function readyPropertyEvidencePacket(overrides = {}) {
  const core = {
    schemaVersion: 1,
    caseId: 'CASE-13A-001',
    propertyRef: 'PROP-13A-001',
    assignmentRef: 'ASSIGN-001',
    assignmentHashSha256: 'a'.repeat(64),
    inspectionId: 'INSP-001',
    inspectionHashSha256: 'b'.repeat(64),
    valuationDate: '2026-01-01',
    reportDate: '2026-01-05',
    jurisdiction: 'SAUDI_ARABIA',
    assetType: 'COMMERCIAL',
    assetLocation: 'Riyadh',
    valuedRights: { interest: 'FREEHOLD' },
    basisOfValue: { basis: 'MARKET_VALUE' },
    purpose: 'PROFESSIONAL_VALUATION',
    evidenceFacts: [],
    measurements: [],
    propertyDataGateStatus: 'CLEAR',
    measurementGateStatus: 'CLEAR',
    ...overrides,
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

function evidenceItem(topic, status = EVIDENCE_ITEM_STATUS.VERIFIED, suffix = topic) {
  return createCommercialEvidenceItem({
    evidenceItemId: `E-${suffix}`,
    caseId: 'CASE-13A-001',
    propertyRef: 'PROP-13A-001',
    topic,
    status,
    evidenceRefs: [status === EVIDENCE_ITEM_STATUS.MISSING || status === EVIDENCE_ITEM_STATUS.NOT_APPLICABLE ? undefined : `REF-${suffix}`].filter(Boolean),
    asOfDate: '2026-01-01',
    rationale: `Professional evidence for ${topic}`,
    preparedByRef: 'ANALYST-1',
    preparedAt: '2026-01-02',
    reviewedByRef: 'REVIEWER-1',
    reviewedAt: '2026-01-03',
    reviewEvidenceRef: `REVIEW-${suffix}`,
  });
}

const officeMulti = expectationMatrix(COMMERCIAL_ASSET_CLASS.OFFICE, OCCUPANCY_STRUCTURE.MULTI_TENANT);
eq(officeMulti[COMMERCIAL_EVIDENCE_TOPIC.PROPERTY_RIGHTS_AND_PHYSICAL_FACTS], EVIDENCE_EXPECTATION.REQUIRED, 'property facts required');
eq(officeMulti[COMMERCIAL_EVIDENCE_TOPIC.MEASUREMENTS], EVIDENCE_EXPECTATION.REQUIRED, 'measurements required');
eq(officeMulti[COMMERCIAL_EVIDENCE_TOPIC.LEASE_AND_RENT_ROLL], EVIDENCE_EXPECTATION.REQUIRED, 'multi-tenant lease/rent roll required');
eq(officeMulti[COMMERCIAL_EVIDENCE_TOPIC.SERVICE_CHARGE_AND_RECOVERIES], EVIDENCE_EXPECTATION.REQUIRED, 'multi-tenant recoveries required');
eq(officeMulti[COMMERCIAL_EVIDENCE_TOPIC.TENANT_COVENANT_AND_CONCENTRATION], EVIDENCE_EXPECTATION.REQUIRED, 'tenant covenant required');
eq(officeMulti[COMMERCIAL_EVIDENCE_TOPIC.MARKET_RENT], EVIDENCE_EXPECTATION.REQUIRED, 'market rent required');
eq(officeMulti[COMMERCIAL_EVIDENCE_TOPIC.PARKING_ACCESS_AND_AMENITIES], EVIDENCE_EXPECTATION.REQUIRED, 'parking/access required');
eq(officeMulti[COMMERCIAL_EVIDENCE_TOPIC.SALE_COMPARABLES], EVIDENCE_EXPECTATION.CONDITIONAL, 'sale comparables conditional');

const logisticsVacant = expectationMatrix(COMMERCIAL_ASSET_CLASS.INDUSTRIAL_LOGISTICS, OCCUPANCY_STRUCTURE.VACANT);
eq(logisticsVacant[COMMERCIAL_EVIDENCE_TOPIC.LOGISTICS_TECHNICAL_SPECIFICATION], EVIDENCE_EXPECTATION.REQUIRED, 'logistics specs required');
eq(logisticsVacant[COMMERCIAL_EVIDENCE_TOPIC.LEASE_AND_RENT_ROLL], EVIDENCE_EXPECTATION.NOT_APPLICABLE, 'vacant lease roll not required');
eq(logisticsVacant[COMMERCIAL_EVIDENCE_TOPIC.TENANT_COVENANT_AND_CONCENTRATION], EVIDENCE_EXPECTATION.NOT_APPLICABLE, 'vacant tenant covenant not required');

const shopping = expectationMatrix(COMMERCIAL_ASSET_CLASS.SHOPPING_CENTRE, OCCUPANCY_STRUCTURE.MULTI_TENANT);
eq(shopping[COMMERCIAL_EVIDENCE_TOPIC.RETAIL_TRADING_PERFORMANCE], EVIDENCE_EXPECTATION.CONDITIONAL, 'retail trading is conditional');
eq(shopping[COMMERCIAL_EVIDENCE_TOPIC.LEASE_AND_RENT_ROLL], EVIDENCE_EXPECTATION.REQUIRED, 'shopping centre rent roll required');

const propertyPacket = readyPropertyEvidencePacket();
check(verifyPropertyEvidencePacketIntegrity(propertyPacket), 'property packet integrity must verify');
const tamperedPropertyPacket = { ...propertyPacket, assetLocation: 'Jeddah' };
check(!verifyPropertyEvidencePacketIntegrity(tamperedPropertyPacket), 'tampered property packet must fail integrity');

const requiredTopics = Object.entries(officeMulti)
  .filter(([, expectation]) => expectation === EVIDENCE_EXPECTATION.REQUIRED)
  .map(([topic]) => topic);
const verifiedItems = requiredTopics.map((topic) => evidenceItem(topic));
check(verifiedItems.every(verifyCommercialEvidenceItemIntegrity), 'all evidence items should verify');
check(Object.isFrozen(verifiedItems[0]), 'evidence item must be immutable');

const ready = buildCommercialSpecializationPacket({
  specializationId: 'COMM-13A-001',
  caseId: 'CASE-13A-001',
  propertyRef: 'PROP-13A-001',
  commercialAssetClass: COMMERCIAL_ASSET_CLASS.OFFICE,
  occupancyStructure: OCCUPANCY_STRUCTURE.MULTI_TENANT,
  analysisContext: COMMERCIAL_ANALYSIS_CONTEXT.PROFESSIONAL_VALUATION,
  propertyEvidencePacket: propertyPacket,
  evidenceItems: verifiedItems,
  conditionalApplicability: { [COMMERCIAL_EVIDENCE_TOPIC.SALE_COMPARABLES]: false },
  preparedByRef: 'ANALYST-1',
  preparedAt: '2026-01-03',
  reviewedByRef: 'REVIEWER-2',
  reviewedAt: '2026-01-04',
  reviewEvidenceRef: 'REVIEW-COMM-001',
});
eq(ready.status, COMMERCIAL_SPECIALIZATION_STATUS.READY_FOR_PROFESSIONAL_METHOD_WORKFLOW, 'ready status');
eq(ready.readyForProfessionalMethodWorkflow, true, 'method workflow ready');
eq(ready.automaticMethodSelection, false, 'no automatic method selection');
eq(ready.automaticValuationInputAdoption, false, 'no automatic input adoption');
eq(ready.valuationArithmeticPerformed, false, 'no valuation arithmetic');
eq(ready.certifiedValuationEstablished, false, 'no certified valuation');
eq(ready.transactionAuthorized, false, 'no transaction authority');
check(verifyCommercialSpecializationPacketIntegrity(ready), 'ready packet integrity verifies');
check(Object.isFrozen(ready), 'ready packet immutable');

const tamperedReady = { ...ready, commercialAssetClass: COMMERCIAL_ASSET_CLASS.SHOPPING_CENTRE };
check(!verifyCommercialSpecializationPacketIntegrity(tamperedReady), 'tampered specialization packet fails integrity');

const missingConditionalDecision = buildCommercialSpecializationPacket({
  specializationId: 'COMM-13A-002', caseId: 'CASE-13A-001', propertyRef: 'PROP-13A-001',
  commercialAssetClass: COMMERCIAL_ASSET_CLASS.OFFICE,
  occupancyStructure: OCCUPANCY_STRUCTURE.MULTI_TENANT,
  analysisContext: COMMERCIAL_ANALYSIS_CONTEXT.PROFESSIONAL_VALUATION,
  propertyEvidencePacket: propertyPacket,
  evidenceItems: verifiedItems,
  conditionalApplicability: {},
  preparedByRef: 'ANALYST-1', preparedAt: '2026-01-03', reviewedByRef: 'REVIEWER-2', reviewedAt: '2026-01-04', reviewEvidenceRef: 'REVIEW-COMM-002',
});
eq(missingConditionalDecision.status, COMMERCIAL_SPECIALIZATION_STATUS.HOLD_COMMERCIAL_EVIDENCE, 'missing conditional decision holds');
check(missingConditionalDecision.blockers.some((x) => x.includes('CONDITIONAL_APPLICABILITY_DECISION_REQUIRED:SALE_COMPARABLES')), 'conditional applicability blocker surfaced');

const assumedMarketRentItems = verifiedItems.map((item) => item.topic === COMMERCIAL_EVIDENCE_TOPIC.MARKET_RENT
  ? evidenceItem(COMMERCIAL_EVIDENCE_TOPIC.MARKET_RENT, EVIDENCE_ITEM_STATUS.ASSUMED, 'MARKET_RENT-ASSUMED')
  : item);
const assumedMarketRent = buildCommercialSpecializationPacket({
  specializationId: 'COMM-13A-003', caseId: 'CASE-13A-001', propertyRef: 'PROP-13A-001',
  commercialAssetClass: COMMERCIAL_ASSET_CLASS.OFFICE,
  occupancyStructure: OCCUPANCY_STRUCTURE.MULTI_TENANT,
  analysisContext: COMMERCIAL_ANALYSIS_CONTEXT.PROFESSIONAL_VALUATION,
  propertyEvidencePacket: propertyPacket,
  evidenceItems: assumedMarketRentItems,
  conditionalApplicability: { [COMMERCIAL_EVIDENCE_TOPIC.SALE_COMPARABLES]: false },
  preparedByRef: 'ANALYST-1', preparedAt: '2026-01-03', reviewedByRef: 'REVIEWER-2', reviewedAt: '2026-01-04', reviewEvidenceRef: 'REVIEW-COMM-003',
});
eq(assumedMarketRent.status, COMMERCIAL_SPECIALIZATION_STATUS.HOLD_COMMERCIAL_EVIDENCE, 'assumed required evidence holds');
check(assumedMarketRent.blockers.some((x) => x.includes('REQUIRED_COMMERCIAL_EVIDENCE_NOT_VERIFIED:MARKET_RENT:ASSUMED')), 'assumed required evidence blocker surfaced');

const clientProvidedItems = verifiedItems.map((item) => item.topic === COMMERCIAL_EVIDENCE_TOPIC.OPERATING_EXPENSES
  ? evidenceItem(COMMERCIAL_EVIDENCE_TOPIC.OPERATING_EXPENSES, EVIDENCE_ITEM_STATUS.CLIENT_PROVIDED_UNVERIFIED, 'OPEX-CLIENT')
  : item);
const clientProvided = buildCommercialSpecializationPacket({
  specializationId: 'COMM-13A-004', caseId: 'CASE-13A-001', propertyRef: 'PROP-13A-001',
  commercialAssetClass: COMMERCIAL_ASSET_CLASS.OFFICE,
  occupancyStructure: OCCUPANCY_STRUCTURE.MULTI_TENANT,
  analysisContext: COMMERCIAL_ANALYSIS_CONTEXT.PROFESSIONAL_VALUATION,
  propertyEvidencePacket: propertyPacket,
  evidenceItems: clientProvidedItems,
  conditionalApplicability: { [COMMERCIAL_EVIDENCE_TOPIC.SALE_COMPARABLES]: false },
  preparedByRef: 'ANALYST-1', preparedAt: '2026-01-03', reviewedByRef: 'REVIEWER-2', reviewedAt: '2026-01-04', reviewEvidenceRef: 'REVIEW-COMM-004',
});
eq(clientProvided.status, COMMERCIAL_SPECIALIZATION_STATUS.HOLD_COMMERCIAL_EVIDENCE, 'unverified client evidence holds');

const tamperedItem = { ...verifiedItems[0], rationale: 'tampered' };
const integrityHold = buildCommercialSpecializationPacket({
  specializationId: 'COMM-13A-005', caseId: 'CASE-13A-001', propertyRef: 'PROP-13A-001',
  commercialAssetClass: COMMERCIAL_ASSET_CLASS.OFFICE,
  occupancyStructure: OCCUPANCY_STRUCTURE.MULTI_TENANT,
  analysisContext: COMMERCIAL_ANALYSIS_CONTEXT.PROFESSIONAL_VALUATION,
  propertyEvidencePacket: propertyPacket,
  evidenceItems: [tamperedItem, ...verifiedItems.slice(1)],
  conditionalApplicability: { [COMMERCIAL_EVIDENCE_TOPIC.SALE_COMPARABLES]: false },
  preparedByRef: 'ANALYST-1', preparedAt: '2026-01-03', reviewedByRef: 'REVIEWER-2', reviewedAt: '2026-01-04', reviewEvidenceRef: 'REVIEW-COMM-005',
});
eq(integrityHold.status, COMMERCIAL_SPECIALIZATION_STATUS.HOLD_INTEGRITY, 'tampered evidence holds integrity');

const propertyHold = buildCommercialSpecializationPacket({
  specializationId: 'COMM-13A-006', caseId: 'CASE-13A-001', propertyRef: 'PROP-13A-001',
  commercialAssetClass: COMMERCIAL_ASSET_CLASS.OFFICE,
  occupancyStructure: OCCUPANCY_STRUCTURE.MULTI_TENANT,
  analysisContext: COMMERCIAL_ANALYSIS_CONTEXT.PROFESSIONAL_VALUATION,
  propertyEvidencePacket: tamperedPropertyPacket,
  evidenceItems: verifiedItems,
  conditionalApplicability: { [COMMERCIAL_EVIDENCE_TOPIC.SALE_COMPARABLES]: false },
  preparedByRef: 'ANALYST-1', preparedAt: '2026-01-03', reviewedByRef: 'REVIEWER-2', reviewedAt: '2026-01-04', reviewEvidenceRef: 'REVIEW-COMM-006',
});
eq(propertyHold.status, COMMERCIAL_SPECIALIZATION_STATUS.HOLD_PROPERTY_EVIDENCE, 'tampered property packet holds');

throws(() => expectationMatrix('HOTEL', OCCUPANCY_STRUCTURE.MULTI_TENANT), /unsupported commercial asset class/, 'unsupported asset class rejected');
throws(() => createCommercialEvidenceItem({
  evidenceItemId: 'BAD', caseId: 'CASE-13A-001', propertyRef: 'PROP-13A-001', topic: COMMERCIAL_EVIDENCE_TOPIC.MARKET_RENT,
  status: EVIDENCE_ITEM_STATUS.NOT_APPLICABLE, evidenceRefs: ['SHOULD-NOT-EXIST'], asOfDate: '2026-01-01', rationale: 'n/a',
  preparedByRef: 'A', preparedAt: '2026-01-02', reviewedByRef: 'R', reviewedAt: '2026-01-03', reviewEvidenceRef: 'REVIEW',
}), /MISSING_OR_NOT_APPLICABLE_EVIDENCE_CANNOT_CARRY_EVIDENCE_REFS/, 'not-applicable evidence cannot carry evidence refs');
throws(() => createCommercialEvidenceItem({
  evidenceItemId: 'BAD-DATE', caseId: 'CASE-13A-001', propertyRef: 'PROP-13A-001', topic: COMMERCIAL_EVIDENCE_TOPIC.MARKET_RENT,
  status: EVIDENCE_ITEM_STATUS.VERIFIED, evidenceRefs: ['REF'], asOfDate: '2026-01-03', rationale: 'bad date',
  preparedByRef: 'A', preparedAt: '2026-01-02', reviewedByRef: 'R', reviewedAt: '2026-01-04', reviewEvidenceRef: 'REVIEW',
}), /COMMERCIAL_EVIDENCE_PREPARED_BEFORE_AS_OF_DATE/, 'preparation before as-of date rejected');

console.log(`WAVE_13A_COMMERCIAL_SPECIALIZATION=PASS checks=${checks}`);
