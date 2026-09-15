'use strict';

const assert = require('assert');
const {
  COST_BASIS, COST_COMPONENT_CLASS, COST_SOURCE_CLASS, COST_VERIFICATION_STATUS,
  LAND_VALUE_METHOD_REFERENCE, DEPRECIATION_TYPE, DEPRECIATION_METHOD,
  COST_APPROACH_INPUT_STATUS, createCostComponentRecord, verifyCostComponentIntegrity,
  createProfessionalLandValueInput, verifyLandValueInputIntegrity,
  createDepreciationRecord, verifyDepreciationIntegrity,
  buildCostApproachInputPacket, verifyCostApproachInputPacketIntegrity,
} = require('../../src/cost');
const {
  COST_APPROACH_MODEL_VERSION, COST_APPROACH_RESULT_STATUS, calculateCostApproachIndication,
} = require('../../src/engines/valuation/cost-approach');
const { PROPERTY_EVIDENCE_PACKET_STATUS } = require('../../src/property/property-evidence-bridge');

let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks += 1; }

const CASE_ID = 'CASE-11A-001';
const PROPERTY_REF = 'PROPERTY-11A-001';
const VALUATION_DATE = '2026-09-07T00:00:00Z';
const propertyPacket = Object.freeze({
  caseId: CASE_ID, propertyRef: PROPERTY_REF,
  status: PROPERTY_EVIDENCE_PACKET_STATUS.READY_FOR_PROFESSIONAL_VALUATION_WORKFLOW,
  professionalValuationWorkflowReady: true, packetHashSha256: 'a'.repeat(64),
});

function component(id, componentClass, quantity, unit, unitCostSar, overrides = {}) {
  return createCostComponentRecord({
    componentId: id, caseId: overrides.caseId || CASE_ID, propertyRef: PROPERTY_REF,
    componentClass, description: `Synthetic ${id}`, quantity, unit, unitCostSar,
    costBasis: overrides.costBasis || COST_BASIS.REPLACEMENT_COST_NEW,
    sourceClass: overrides.sourceClass || COST_SOURCE_CLASS.VERIFIED_QUANTITY_SURVEY,
    sourceName: 'SYNTHETIC COST SOURCE', sourceRef: `source://${id}`,
    sourceDate: overrides.sourceDate || '2026-08-01T00:00:00Z',
    verification: overrides.verified === false
      ? { status: COST_VERIFICATION_STATUS.NOT_VERIFIED }
      : { status: COST_VERIFICATION_STATUS.VERIFIED, verifiedByRef: 'USER:COST-REVIEWER', verifiedAt: '2026-08-03T10:00:00Z', verificationEvidenceRef: `review://${id}` },
    capturedAt: '2026-08-03T09:00:00Z',
  });
}
function land(overrides = {}) {
  return createProfessionalLandValueInput({
    landValueId: overrides.landValueId || 'LAND-001', caseId: CASE_ID, propertyRef: PROPERTY_REF,
    valueSar: overrides.valueSar || 10000000, methodReference: LAND_VALUE_METHOD_REFERENCE.SALES_COMPARISON,
    rationale: 'Synthetic reviewed land-value indication.', evidenceRefs: ['market://land-analysis'],
    valuationDate: overrides.valuationDate || VALUATION_DATE,
    preparedByRef: 'USER:LAND-ANALYST', preparedAt: '2026-09-07T09:00:00Z',
    reviewedByRef: 'USER:LAND-REVIEWER', reviewedAt: '2026-09-07T10:00:00Z', reviewEvidenceRef: 'review://land',
  });
}
function dep(id, type, method, magnitude) {
  return createDepreciationRecord({
    depreciationId: id, caseId: CASE_ID, propertyRef: PROPERTY_REF, type, method, magnitude,
    rationale: `Synthetic ${type} judgment`, evidenceRefs: [`evidence://${id}`],
    preparedByRef: 'USER:COST-ANALYST', preparedAt: '2026-09-07T09:00:00Z',
    reviewedByRef: 'USER:COST-REVIEWER', reviewedAt: '2026-09-07T10:00:00Z', reviewEvidenceRef: `review://${id}`,
  });
}
function packet(overrides = {}) {
  return buildCostApproachInputPacket({
    packetId: overrides.packetId || 'PACKET-001', caseId: CASE_ID, propertyRef: PROPERTY_REF, valuationDate: VALUATION_DATE,
    propertyEvidencePacket: overrides.propertyEvidencePacket || propertyPacket,
    costComponents: overrides.costComponents || components,
    landValueInput: overrides.landValueInput || landValue,
    depreciationRecords: overrides.depreciationRecords === undefined ? depreciationRecords : overrides.depreciationRecords,
    allowedCostSourceClasses: overrides.allowedCostSourceClasses || [COST_SOURCE_CLASS.OFFICIAL_COST_INDEX, COST_SOURCE_CLASS.VERIFIED_QUANTITY_SURVEY, COST_SOURCE_CLASS.VERIFIED_CONTRACTOR_QUOTE],
    maxCostSourceAgeDays: overrides.maxCostSourceAgeDays === undefined ? 365 : overrides.maxCostSourceAgeDays,
    preparedByRef: 'USER:COST-VALUER', preparedAt: '2026-09-07T11:00:00Z', packetEvidenceRef: `packet://${overrides.packetId || '001'}`,
  });
}

const components = [
  component('STRUCTURE', COST_COMPONENT_CLASS.STRUCTURE, 1000, 'sqm', 5000),
  component('MEP', COST_COMPONENT_CLASS.MEP, 1000, 'sqm', 1000),
  component('SITE', COST_COMPONENT_CLASS.SITE_IMPROVEMENT, 1, 'lump_sum', 500000),
];
const landValue = land();
const depreciationRecords = [
  dep('DEP-PHYSICAL', DEPRECIATION_TYPE.PHYSICAL_INCURABLE, DEPRECIATION_METHOD.PERCENT_OF_IMPROVEMENT_COST_NEW, 0.05),
  dep('DEP-EXTERNAL', DEPRECIATION_TYPE.EXTERNAL_OBSOLESCENCE, DEPRECIATION_METHOD.AMOUNT_SAR, 100000),
];

check(components.every(verifyCostComponentIntegrity), 'cost components have valid hashes');
check(verifyLandValueInputIntegrity(landValue), 'land-value input has valid hash');
check(depreciationRecords.every(verifyDepreciationIntegrity), 'depreciation records have valid hashes');
check(components.every((x) => x.extendedCostCalculatedOutsideCanonicalEngine === false), 'no extended cost outside canonical engine');
check(landValue.landValueCalculatedByThisModule === false && landValue.professionalJudgmentExplicit === true, 'land value remains explicit professional input');
check(depreciationRecords.every((x) => x.depreciationCalculatedOutsideCanonicalEngine === false), 'depreciation amount remains uncalculated in input layer');

const ready = packet();
check(ready.status === COST_APPROACH_INPUT_STATUS.READY_FOR_CANONICAL_COST_CALCULATION, 'governed cost packet is calculation-ready');
check(ready.readyForCanonicalCostCalculation === true && ready.costApproachValueIndicationProduced === false, 'packet hands off without calculating value');
check(verifyCostApproachInputPacketIntegrity(ready), 'input packet hash verifies');

const result = calculateCostApproachIndication(ready);
check(result.modelVersion === COST_APPROACH_MODEL_VERSION, 'model version is explicit');
check(result.status === COST_APPROACH_RESULT_STATUS.VALUE_INDICATION_READY_FOR_RECONCILIATION, 'cost indication is ready for later reconciliation');
check(result.improvementCostNewSar === 6500000, 'improvement cost new is canonical sum of extended components');
check(result.accruedDepreciationSar === 425000, 'accrued depreciation is canonical calculation');
check(result.depreciatedImprovementValueSar === 6075000, 'depreciated improvement value is correct');
check(result.landValueSar === 10000000 && result.costApproachValueIndicationSar === 16075000, 'cost approach formula is correct');
check(result.componentTrace.length === 3 && result.depreciationTrace.length === 2, 'calculation trace preserves provenance');
check(/^[a-f0-9]{64}$/.test(result.calculationHashSha256), 'calculation hash is deterministic SHA-256');
check(result.canonicalCalculationEngine === true && result.automaticLandValuationPerformed === false, 'canonical boundary and land-value boundary are explicit');
check(result.automaticDepreciationEstimated === false && result.automaticReconciliationPerformed === false, 'no hidden depreciation estimate or reconciliation');
check(result.finalValuationConclusionEstablished === false && result.certifiedValuationEstablished === false && result.transactionAuthorized === false, 'method indication creates no final/certified value or transaction authority');

const propertyHold = packet({ packetId: 'PROPERTY-HOLD', propertyEvidencePacket: { ...propertyPacket, professionalValuationWorkflowReady: false } });
check(propertyHold.status === COST_APPROACH_INPUT_STATUS.HOLD_PROPERTY_EVIDENCE, 'unready property evidence fails closed');

const unverified = component('UNVERIFIED', COST_COMPONENT_CLASS.STRUCTURE, 1000, 'sqm', 5000, { verified: false });
const unverifiedHold = packet({ packetId: 'UNVERIFIED-HOLD', costComponents: [unverified], depreciationRecords: [] });
check(unverifiedHold.status === COST_APPROACH_INPUT_STATUS.HOLD_COST_EVIDENCE, 'unverified cost evidence fails closed');
check(unverifiedHold.blockers.includes('COST_COMPONENT_NOT_VERIFIED:UNVERIFIED'), 'unverified blocker is explicit');

const stale = component('STALE', COST_COMPONENT_CLASS.STRUCTURE, 1000, 'sqm', 4500, { sourceDate: '2024-01-01T00:00:00Z' });
const staleHold = packet({ packetId: 'STALE-HOLD', costComponents: [stale], depreciationRecords: [] });
check(staleHold.status === COST_APPROACH_INPUT_STATUS.HOLD_COST_EVIDENCE && staleHold.blockers.includes('COST_SOURCE_STALE:STALE'), 'stale cost evidence fails freshness policy');

const client = component('CLIENT', COST_COMPONENT_CLASS.STRUCTURE, 1000, 'sqm', 4800, { sourceClass: COST_SOURCE_CLASS.CLIENT_PROVIDED });
const sourceHold = packet({ packetId: 'SOURCE-HOLD', costComponents: [client], depreciationRecords: [], allowedCostSourceClasses: [COST_SOURCE_CLASS.VERIFIED_QUANTITY_SURVEY] });
check(sourceHold.status === COST_APPROACH_INPUT_STATUS.HOLD_COST_EVIDENCE, 'disallowed cost source class is held');

const duplicateHold = packet({ packetId: 'DUP-HOLD', costComponents: [components[0], components[0]], depreciationRecords: [] });
check(duplicateHold.status === COST_APPROACH_INPUT_STATUS.HOLD_COST_EVIDENCE, 'duplicate cost component IDs fail closed');

const tamperedLand = { ...landValue, valueSar: 99999999 };
const landHold = packet({ packetId: 'LAND-HOLD', landValueInput: tamperedLand, depreciationRecords: [] });
check(landHold.status === COST_APPROACH_INPUT_STATUS.HOLD_LAND_VALUE_INPUT && landHold.blockers.includes('LAND_VALUE_INPUT_INTEGRITY_FAILED'), 'tampered land-value input fails integrity');

const wrongDateLand = land({ landValueId: 'LAND-WRONG-DATE', valuationDate: '2026-09-06T00:00:00Z' });
const dateHold = packet({ packetId: 'DATE-HOLD', landValueInput: wrongDateLand, depreciationRecords: [] });
check(dateHold.status === COST_APPROACH_INPUT_STATUS.HOLD_LAND_VALUE_INPUT && dateHold.blockers.includes('LAND_VALUE_DATE_MISMATCH'), 'land-value indication must bind to valuation date');

const tamperedDep = { ...depreciationRecords[0], magnitude: 0.9 };
const depHold = packet({ packetId: 'DEP-HOLD', depreciationRecords: [tamperedDep] });
check(depHold.status === COST_APPROACH_INPUT_STATUS.HOLD_DEPRECIATION, 'tampered depreciation record fails integrity');

const duplicateDep = dep('DEP-PHYSICAL-2', DEPRECIATION_TYPE.PHYSICAL_INCURABLE, DEPRECIATION_METHOD.AMOUNT_SAR, 10000);
const duplicateDepHold = packet({ packetId: 'DEP-DUP-HOLD', depreciationRecords: [depreciationRecords[0], duplicateDep] });
check(duplicateDepHold.status === COST_APPROACH_INPUT_STATUS.HOLD_DEPRECIATION, 'one aggregate reviewed depreciation record per taxonomy type is enforced');

const highDepPacket = packet({
  packetId: 'HIGH-DEP',
  depreciationRecords: [
    dep('DEP-HIGH-PHYS', DEPRECIATION_TYPE.PHYSICAL_INCURABLE, DEPRECIATION_METHOD.PERCENT_OF_IMPROVEMENT_COST_NEW, 0.8),
    dep('DEP-HIGH-EXT', DEPRECIATION_TYPE.EXTERNAL_OBSOLESCENCE, DEPRECIATION_METHOD.PERCENT_OF_IMPROVEMENT_COST_NEW, 0.4),
  ],
});
check(highDepPacket.status === COST_APPROACH_INPUT_STATUS.READY_FOR_CANONICAL_COST_CALCULATION, 'valid judgments reach canonical economic validation');
const highDepResult = calculateCostApproachIndication(highDepPacket);
check(highDepResult.status === COST_APPROACH_RESULT_STATUS.INVALID_ECONOMIC_CASE && highDepResult.blockers.includes('ACCRUED_DEPRECIATION_EXCEEDS_IMPROVEMENT_COST_NEW'), 'depreciation above improvement cost fails canonical economic gate');

const tamperedPacket = { ...ready, costComponents: ready.costComponents.map((x, i) => i === 0 ? { ...x, unitCostSar: 999999 } : x) };
check(calculateCostApproachIndication(tamperedPacket).status === COST_APPROACH_RESULT_STATUS.INVALID_INPUT_PACKET, 'tampered input packet is rejected by canonical engine');

let crossCaseRejected = false;
try {
  packet({ packetId: 'CROSS-CASE', costComponents: [component('CROSS', COST_COMPONENT_CLASS.STRUCTURE, 1, 'sqm', 1, { caseId: 'CASE-OTHER' })], depreciationRecords: [] });
} catch (error) {
  crossCaseRejected = String(error.message).includes('CASE_OR_PROPERTY_ISOLATION_VIOLATION:costComponent');
}
check(crossCaseRejected, 'cross-case cost evidence is rejected at packet boundary');

console.log(`WAVE_11A_COST_APPROACH=PASS checks=${checks}`);
