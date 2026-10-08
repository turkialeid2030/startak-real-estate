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


const {
 SPECIALIZED_VALUE_COMPONENT,SPECIALIZED_VALUATION_PREMISE,COMPONENT_TREATMENT,
 COMPONENT_EVIDENCE_STATUS,requiredComponents,createSpecializedComponentTreatment,
 buildSpecializedInterestSeparationPacket,
}=require('../../src/specialized-assets/specialized-interest-separation');
const {
 INDUSTRIAL_SUBTYPE,INTERNAL_INSPECTION_STATUS,BUILDING_PERMIT_STATUS,LEASE_STRUCTURE,
 createIndustrialLogisticsAssetSpec,
}=require('../../src/valuation-intelligence/adapters/industrial-logistics');
const {
 STATUS,CHECKS,evaluateSpecializedAssetEvidence,
}=require('../../src/specialized-assets/specialist-operational-gate');

const hotelPacket=specializedPacket();
const hotelMetrics=buildHospitalityOperatingMetricsPacket({
 metricsPacketId:'C61-METRICS',caseId:'CASE-14B',propertyRef:'PROP-14B',
 specializedAssetPacket:hotelPacket,operatingPeriodRecords:[period()],
 preparedByRef:'C61-PREPARED',preparedAt:'2026-01-03',
 reviewedByRef:'C61-REVIEWER',reviewedAt:'2026-01-05',reviewEvidenceRef:'C61-REVIEW',
});
assert.strictEqual(hotelMetrics.status,HOSPITALITY_OPERATING_METRICS_STATUS.READY);
const treatments=requiredComponents(hotelPacket.assetClass,hotelPacket.operatingModel).map(component=>
 createSpecializedComponentTreatment({
 treatmentId:'C61-'+component,caseId:'CASE-14B',propertyRef:'PROP-14B',component,
 treatment:component===SPECIALIZED_VALUE_COMPONENT.REAL_PROPERTY?
   COMPONENT_TREATMENT.INCLUDED_IN_PREMISE:COMPONENT_TREATMENT.EXCLUDED_FROM_PREMISE,
 evidenceStatus:COMPONENT_EVIDENCE_STATUS.VERIFIED,
 rationale:'Explicit internal fixture component treatment',
 evidenceRefs:['EVIDENCE-'+component],preparedByRef:'ENGINEER',preparedAt:'2026-01-04',
 reviewedByRef:'VALUER',reviewedAt:'2026-01-05',reviewEvidenceRef:'REVIEW-'+component,
 }));
const interest=buildSpecializedInterestSeparationPacket({
 separationPacketId:'C61-INTEREST',caseId:'CASE-14B',propertyRef:'PROP-14B',
 specializedAssetPacket:hotelPacket,valuationPremise:SPECIALIZED_VALUATION_PREMISE.REAL_PROPERTY_ONLY,
 componentTreatments:treatments,preparedByRef:'ANALYST',preparedAt:'2026-01-05',
 reviewedByRef:'REVIEWER',reviewedAt:'2026-01-07',reviewEvidenceRef:'SPECIALIST-REVIEW',
});
assert.strictEqual(interest.readyForSpecializedValuationPremiseReview,true);
function checks(){return CHECKS.map(type=>({
 type,status:'CONFIRMED',evidenceRef:'SYNTHETIC-'+type,artifactSha256:'c'.repeat(64),
 reviewedByRef:'TEST-REVIEWER',reviewedAt:'2026-01-08',
}));}
const hotelBridge={
 reportedRealPropertyNoiSar:hotelMetrics.aggregateMetrics.operatingSurplusAfterFfeReserveSar-100000,
 professionalOperatingBusinessAndIntangibleExclusionSar:100000,
 propertySpecificNormalizedAdjustmentsSar:0,
 ownerOperatorIncomeTreatmentRef:'TEST-OWNER-OPERATOR-CONTEXT',
 auditedStatementsRef:'TEST-NOT-TRULY-AUDITED',sourceArtifactSha256:'b'.repeat(64),
 reviewerRef:'TEST-SPECIALIST',provenanceRef:'TEST-RECONCILIATION',
};
const hotelParams={
 assetType:'HOTEL_FULL_SERVICE',caseId:'CASE-14B',propertyRef:'PROP-14B',
 valuationDate:'2026-01-01',asOf:'2026-01-09',
 hotelMetricsPacket:hotelMetrics,interestSeparationPacket:interest,
 hotelIncomeBridge:hotelBridge,specialistChecks:checks(),
};
function hold(p,reason){const x=evaluateSpecializedAssetEvidence(p);assert.equal(x.status,STATUS.HOLD);
 if(reason)assert(x.blockers.some(z=>z.includes(reason)),x.blockers.join('; '));}
const hotelResult=evaluateSpecializedAssetEvidence(hotelParams);
assert.equal(hotelResult.status,STATUS.READY_FOR_EXTERNAL_SPECIALIST_REVIEW);
assert.equal(hotelResult.professionalValuationApproved,false);
assert.equal(hotelResult.publicExportAuthorized,false);
hold({...hotelParams,hotelMetricsPacket:{...hotelMetrics,aggregateMetrics:{...hotelMetrics.aggregateMetrics,revParSar:1}}},
  'HOTEL_HISTORICAL_OPERATING_METRICS_NOT_READY');
hold({...hotelParams,interestSeparationPacket:null},'HOTEL_INTEREST_SEPARATION_NOT_READY');
hold({...hotelParams,hotelIncomeBridge:{...hotelBridge,reportedRealPropertyNoiSar:999999}},
  'BRIDGE_ARITHMETIC_INCONSISTENT');
hold({...hotelParams,hotelIncomeBridge:{...hotelBridge,auditedStatementsRef:null}},
  'HOTEL_REAL_PROPERTY_NOI_BRIDGE_INCOMPLETE');
hold({...hotelParams,specialistChecks:checks().slice(1)},'SPECIALIST_CONTROL_UNRESOLVED');
hold({...hotelParams,specialistChecks:[...checks().slice(0,4),{...checks()[4],status:'REVIEWED_NOT_APPLICABLE',notApplicableRationale:'bad'},...checks().slice(5)]},
  null);

const industrialSpec=createIndustrialLogisticsAssetSpec({
 assetId:'C61-INDUSTRIAL',subtype:INDUSTRIAL_SUBTYPE.WAREHOUSE,
 landAreaSqm:10000,builtAreaSqm:6000,netLeasableAreaSqm:5500,
 leaseStructure:LEASE_STRUCTURE.NET,internalInspectionStatus:INTERNAL_INSPECTION_STATUS.FULL_INTERNAL,
 buildingPermitStatus:BUILDING_PERMIT_STATUS.VERIFIED,clearHeightMeters:11,
 dockDoorCount:8,gradeLevelDoorCount:1,yardAreaSqm:3500,truckAccess:true,
 powerCapacityKva:400,fireLifeSafetyStatus:'VERIFIED_COMPLIANT',
 constructionType:'STEEL',physicalCondition:'INSPECTED',
 metadata:{designFloorLoadKnPerSqm:45,actualPermittedUseRef:'TEST-PERMITTED-USE'},
});
const industrialParams={
 assetType:INDUSTRIAL_SUBTYPE.WAREHOUSE,
 caseId:'IND-CASE',propertyRef:'IND-PROP',valuationDate:'2026-01-01',asOf:'2026-01-09',
 industrialSpec,specialistChecks:checks(),
};
const industry=evaluateSpecializedAssetEvidence(industrialParams);
assert.equal(industry.status,STATUS.READY_FOR_EXTERNAL_SPECIALIST_REVIEW);
assert.equal(industry.actualSpecialistEvidenceIndependentlyAuthenticated,false);
hold({...industrialParams,industrialSpec:{...industrialSpec,buildingPermitStatus:BUILDING_PERMIT_STATUS.MISSING}},
 'INDUSTRIAL_FULL_INSPECTION');
hold({...industrialParams,industrialSpec:{...industrialSpec,metadata:{designFloorLoadKnPerSqm:0}}},'INDUSTRIAL_FULL_INSPECTION');
hold({...industrialParams,industrialSpec:{...industrialSpec,leaseStructure:LEASE_STRUCTURE.UNKNOWN}},
 'INDUSTRIAL_LEASE_BURDEN_UNDEFINED');
hold({...industrialParams,specialistChecks:checks().map(x=>x.type==='environmentalContamination'?
 {...x,status:'REVIEWED_NOT_APPLICABLE',notApplicableRationale:'No supporting soil study'}:x)},
 'INDUSTRIAL_ENVIRONMENTAL_REVIEW_REQUIRED');
hold({...industrialParams,specialistChecks:checks().map(x=>x.type==='titleInterest'?
 {...x,status:'REVIEWED_NOT_APPLICABLE',notApplicableRationale:'missing'}:x)},
 'MANDATORY_SPECIALIST_CONTROL_CANNOT_BE_SKIPPED');
console.log('C61_SPECIALIZED_PROPERTY_OPERATIONAL_GATES=PASS');
console.log('C61_REAL_INDEPENDENT_SAUDI_SPECIALIST_EVIDENCE=FALSE');
