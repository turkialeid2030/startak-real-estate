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


const {
  STATUS,assessCostDepreciationAttribution,
}=require('../../src/cost/depreciation-attribution-gate');
const basePacket=packet();
const amountBase=calculateCostApproachIndication(basePacket);
assert.strictEqual(amountBase.accruedDepreciationSar,425000);
const actualRows=[
  {depreciationId:'DEP-PHYSICAL',depreciationType:DEPRECIATION_TYPE.PHYSICAL_INCURABLE,
    componentId:'STRUCTURE',causeId:'PHYSICAL-FOUNDATION',amountSar:250000,
    evidenceRef:'EVID-PHYS',reviewedByRef:'INSPECTOR',reviewEvidenceRef:'REVIEW-PHYS',
    reviewedAt:'2026-09-09',curabilityBasisRef:'FUNCTIONAL/PHYSICAL-LIFE'},
  {depreciationId:'DEP-PHYSICAL',depreciationType:DEPRECIATION_TYPE.PHYSICAL_INCURABLE,
    componentId:'MEP',causeId:'PHYSICAL-MEP',amountSar:75000,
    evidenceRef:'EVID-MEP',reviewedByRef:'INSPECTOR',reviewEvidenceRef:'REVIEW-MEP',
    reviewedAt:'2026-09-09',curabilityBasisRef:'REMAINING-LIFE'},
  {depreciationId:'DEP-EXTERNAL',depreciationType:DEPRECIATION_TYPE.EXTERNAL_OBSOLESCENCE,
    componentId:'SITE',causeId:'EXTERNAL-MARKET',amountSar:100000,
    evidenceRef:'EVID-EXTERNAL',reviewedByRef:'VALUER',reviewEvidenceRef:'REVIEW-EXT',
    reviewedAt:'2026-09-09',externalMarketImpactRef:'MARKET-DATA-REVIEW'},
];
const omitted=[DEPRECIATION_TYPE.PHYSICAL_CURABLE,DEPRECIATION_TYPE.FUNCTIONAL_CURABLE,
  DEPRECIATION_TYPE.FUNCTIONAL_INCURABLE].map(type=>({
    type,rationale:'Engineer has explicitly determined this loss class not applicable to this exercise',
    evidenceRef:'EVIDENCE-'+type,reviewedByRef:'INDEPENDENT-REVIEWER',
    reviewEvidenceRef:'REVIEW-'+type,reviewedAt:'2026-09-09',
  }));
const asOf='2026-10-08';
function assess(change={}){
 return assessCostDepreciationAttribution({packet:basePacket,allocations:actualRows,
   omissionReviews:omitted,asOf,...change});
}
function has(blocker,result){
 assert.strictEqual(result.status,STATUS.HOLD);
 assert.ok(result.blockers.some(x=>x.includes(blocker)),result.blockers.join('; '));
}
const good=assess();
assert.strictEqual(good.status,STATUS.READY_FOR_INDEPENDENT_PROFESSIONAL_REVIEW);
assert.strictEqual(good.improvementCostNewSar,6500000);
assert.strictEqual(good.accruedDepreciationSar,425000);
assert.strictEqual(good.costApproachValueIndicationSar,16075000);
assert.strictEqual(good.componentDepreciationTrace.length,3);
assert.strictEqual(good.componentDepreciationTrace.reduce((s,c)=>s+c.residualImprovementValueSar,0),6075000);
assert.strictEqual(good.professionalDepreciationCauseAuthenticityEstablished,false);
assert.strictEqual(good.productionDecisionAuthorized,false);
assert.strictEqual(good.certifiedValuationEstablished,false);
assert.ok(Object.isFrozen(good));
has('ALLOCATION_NOT_RECONCILED_TO_CANONICAL_DEPRECIATION',assess({allocations:actualRows.slice(0,2)}));
has('DUPLICATED_CAUSE_ON_SAME_COMPONENT',assess({allocations:[actualRows[0],actualRows[0],...actualRows.slice(1)]}));
has('DOUBLE_COUNT_CAUSE_BETWEEN_DEPRECIATION_TYPES',assess({
 allocations:[...actualRows.slice(0,2),{...actualRows[2],causeId:actualRows[0].causeId}],
}));
has('MISSING_CAUSAL_PROFESSIONAL_EVIDENCE',assess({
 allocations:[{...actualRows[0],reviewEvidenceRef:null},...actualRows.slice(1)],
}));
has('PHYSICAL_FUNCTIONAL_CURABILITY_EVIDENCE_REQUIRED',assess({
 allocations:[{...actualRows[0],curabilityBasisRef:null},...actualRows.slice(1)],
}));
has('EXTERNAL_MARKET_IMPACT_EVIDENCE_REQUIRED',assess({
 allocations:[...actualRows.slice(0,2),{...actualRows[2],externalMarketImpactRef:null}],
}));
has('LOSS_CLASS_UNREVIEWED',assess({omissionReviews:omitted.slice(0,2)}));
has('INVALID_OR_DUPLICATED_OMISSION_REVIEW',assess({omissionReviews:[...omitted,omitted[0]]}));
has('AGE_LIFE_EVIDENCE_OR_RANGE_INVALID',assess({ageLifeChecks:[{
 componentId:'STRUCTURE',effectiveAgeYears:101,totalEconomicLifeYears:100,
 inspectorEvidenceRef:'INSPECTION',reviewerRef:'REVIEWER',
}]}));
const withAge=assess({ageLifeChecks:[{
 componentId:'STRUCTURE',effectiveAgeYears:5,totalEconomicLifeYears:100,
 inspectorEvidenceRef:'INSPECTION',reviewerRef:'REVIEWER',
}]});
assert.strictEqual(withAge.status,STATUS.READY_FOR_INDEPENDENT_PROFESSIONAL_REVIEW);
assert.strictEqual(withAge.ageLifeDiagnosticOnly[0].estimatedPhysicalLossForDiagnosisOnlySar,250000);
const noDepPacket=packet({packetId:'C59-NEW',depreciationRecords:[]});
const noDepReview=[...Object.values(DEPRECIATION_TYPE)].map(type=>({
 type,rationale:'Explicit nil depreciation professional assessment',
 evidenceRef:'EVIDENCE-'+type,reviewedByRef:'ENGINEER',reviewEvidenceRef:'REVIEW-'+type,reviewedAt:'2026-09-09',
}));
const cleanNew=assessCostDepreciationAttribution({
 packet:noDepPacket,allocations:[],omissionReviews:noDepReview,asOf,
});
assert.strictEqual(cleanNew.status,STATUS.READY_FOR_INDEPENDENT_PROFESSIONAL_REVIEW);
assert.strictEqual(cleanNew.accruedDepreciationSar,0);
has('LOSS_CLASS_UNREVIEWED',assessCostDepreciationAttribution({
 packet:noDepPacket,allocations:[],omissionReviews:[],asOf,
}));
has('INVALID_CANONICAL_COST_INPUT_PACKET',assess({packet:{...basePacket,valuationDate:'2024-01-01'}}));
console.log('C59_COMPONENTIZED_COST_OBSOLESCENCE=PASS');
console.log('C59_SAUDI_COST_EVIDENCE_EXTERNALLY_AUTHENTICATED=FALSE');
console.log('C59_INDEPENDENT_COST_VALUATION_CERTIFIED=FALSE');
