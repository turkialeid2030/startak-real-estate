'use strict';

const assert = require('assert');
const {
  CONFLICT_INDEPENDENCE_STATUS,
  COMPETENCE_STATUS,
  RIGHT_TYPE,
  RIGHT_SOURCE_CLASS,
} = require('../../src/valuation/professional-assignment');
const {
  TRUTH_STATUS,
  VERIFICATION_STATUS,
} = require('../../src/document-intelligence/contracts');
const {
  EVIDENCE_SOURCE_ROLE,
  EVIDENCE_SENSITIVITY_CLASS,
  EXTRACTOR_TYPE,
  PROFESSIONAL_REVIEW_OUTCOME,
  createProfessionalEvidenceChainRecord,
  recordProfessionalEvidenceReview,
} = require('../../src/document-intelligence/professional-evidence-chain');
const {
  createInspectionCase,
  qualifyPreInspection,
  startInspection,
  addInspectionObservation,
  createInspectionMediaRecord,
  addInspectionMedia,
  submitPostInspectionReview,
  completeInspection,
  OBSERVATION_CATEGORY,
  MEDIA_MANIPULATION_STATUS,
} = require('../../src/inspection/inspection-lifecycle');
const {
  MEASUREMENT_TYPE,
  MEASUREMENT_SOURCE,
  createMeasurementRecord,
  reconcileMeasurementRecords,
} = require('../../src/inspection/measurement-governance');
const {
  PROPERTY_EVIDENCE_PACKET_STATUS,
  buildPropertyEvidencePacket,
} = require('../../src/property/property-evidence-bridge');

let checks = 0;
function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
}
function throwsWith(fn, fragment, message) {
  let ok = false;
  try { fn(); } catch (error) { ok = String(error.message).includes(fragment); }
  check(ok, message);
}

const CASE_ID = 'CASE-8C-001';
const PROPERTY_REF = 'PROPERTY-8C-001';
const INSPECTION_ID = 'INSP-8C-001';
const GPS = { lat: 24.7136, long: 46.6753, accuracyMeters: 5 };

function assignment(overrides = {}) {
  return {
    client: 'SYNTHETIC CLIENT',
    intended_user: 'INVESTMENT_COMMITTEE',
    intended_use: 'INTERNAL_INVESTMENT_DECISION_SUPPORT',
    purpose: 'ACQUISITION_ANALYSIS',
    asset: { type: 'OFFICE', jurisdiction: 'SAUDI_ARABIA', location: 'SYNTHETIC_RIYADH_LOCATION' },
    rights: [{ type: RIGHT_TYPE.OWNERSHIP, source_class: RIGHT_SOURCE_CLASS.VERIFIED, description: 'Synthetic verified ownership interest', source_reference: 'DOC-TITLE' }],
    basis: 'SYNTHETIC_MARKET_VALUE_BASIS',
    valuation_date: '2026-09-07',
    report_date: '2026-09-07',
    scope: 'Synthetic professional valuation scope',
    assumptions: [],
    special_assumptions: [],
    information_reliance: ['DOC-TITLE'],
    limitations: [],
    conflicts: { status: CONFLICT_INDEPENDENCE_STATUS.CLEAR, notes: null },
    independence: { status: CONFLICT_INDEPENDENCE_STATUS.CLEAR, notes: null },
    competence: { status: COMPETENCE_STATUS.CLEAR, location: 'RIYADH', complexity: 'STANDARD', specialization_required: false, specialist_reviewer: null },
    reviewer: 'SYNTHETIC_REVIEWER',
    transaction_context: 'ACQUISITION',
    ...overrides,
  };
}

function fact({ id, sourceKey, value = 1000, hashChar = 'a', verified = true }) {
  return {
    schemaVersion: 1,
    factId: id,
    caseId: CASE_ID,
    documentId: `DOC-${id}`,
    documentHashSha256: hashChar.repeat(64),
    documentType: sourceKey,
    authorityClass: 'OFFICIAL_OR_FIELD_EVIDENCE',
    authorityVerified: true,
    key: 'property.land_area',
    rawValue: String(value),
    normalizedValue: value,
    valueType: 'NUMBER',
    unit: 'sqm',
    sourceLocator: { kind: 'PAGE_OR_FIELD', reference: `${sourceKey}:1` },
    extraction: { method: 'STRUCTURED_CAPTURE', confidence: 0.99 },
    materiality: 'MATERIAL',
    truthStatus: verified ? TRUTH_STATUS.VERIFIED_FACT : TRUTH_STATUS.EXTRACTED_EVIDENCE,
    verification: verified
      ? { status: VERIFICATION_STATUS.VERIFIED, method: 'HUMAN_SOURCE_CHECK', verifierType: 'VALUATION_ANALYST', reference: `VERIFY-${id}`, verifiedAt: '2026-09-07T08:30:00Z' }
      : { status: VERIFICATION_STATUS.NOT_VERIFIED, method: null, verifierType: null, reference: null, verifiedAt: null },
    capturedAt: '2026-09-07T08:20:00Z',
  };
}

function reviewedEvidence({ id, sourceRole, value = 1000, hashChar = 'a', verified = true }) {
  const chain = createProfessionalEvidenceChainRecord({
    recordId: `CHAIN-${id}`,
    fact: fact({ id, sourceKey: sourceRole, value, hashChar, verified }),
    sourceRole,
    sourceReference: `SOURCE-${id}`,
    evidenceLink: `evidence://${id}`,
    extractor: { type: EXTRACTOR_TYPE.SYSTEM, name: 'STARTAK_DOCUMENT_PIPELINE', version: '8C.1' },
    capturedByRef: 'SYSTEM:document-intelligence',
    sensitivityClass: EVIDENCE_SENSITIVITY_CLASS.MATERIAL,
    createdAt: '2026-09-07T08:20:00Z',
  });
  if (!verified) return chain;
  return recordProfessionalEvidenceReview({
    record: chain,
    review: {
      reviewId: `REVIEW-${id}`,
      outcome: PROFESSIONAL_REVIEW_OUTCOME.APPROVED,
      reviewedByRef: 'USER:VALUATION-REVIEWER',
      reviewEvidenceRef: `review://${id}`,
      reviewedAt: '2026-09-07T08:35:00Z',
      acknowledgements: {
        sourceViewed: true,
        locatorChecked: true,
        semanticMappingChecked: true,
        documentHashChecked: true,
        accountabilityAccepted: true,
      },
    },
  });
}

function measurements({ conflict = false } = {}) {
  return [
    createMeasurementRecord({
      measurementId: 'M-TITLE', caseId: CASE_ID, type: MEASUREMENT_TYPE.LAND_AREA, valueSqm: 1000,
      source: MEASUREMENT_SOURCE.TITLE_DEED, sourceEvidenceRef: 'evidence://title/area', measurementStandardRef: 'SYNTHETIC-MEASUREMENT-STANDARD',
      measurementMethod: 'DOCUMENT_REPORTED_AREA', measuredByRef: 'USER:ANALYST', measuredAt: '2026-09-07T07:00:00Z',
    }),
    createMeasurementRecord({
      measurementId: 'M-INSP', caseId: CASE_ID, inspectionId: INSPECTION_ID, type: MEASUREMENT_TYPE.LAND_AREA, valueSqm: conflict ? 1100 : 1001,
      source: MEASUREMENT_SOURCE.INSPECTION, sourceEvidenceRef: 'evidence://inspection/area', measurementStandardRef: 'SYNTHETIC-MEASUREMENT-STANDARD',
      measurementMethod: 'SITE_MEASUREMENT', measuredByRef: 'USER:INSPECTOR', measuredAt: '2026-09-07T08:15:00Z',
    }),
  ];
}

function completedInspection(measurementRecords) {
  const measurementInputs={
    caseId: CASE_ID,
    records: measurementRecords,
    materialTypes: [MEASUREMENT_TYPE.LAND_AREA],
    toleranceByType: { LAND_AREA: { absoluteSqm: 2 } },
    minimumIndependentSourcesByType: { LAND_AREA: 2 },
  };
  const gate=reconcileMeasurementRecords(measurementInputs);
  let record = createInspectionCase({
    inspectionId: INSPECTION_ID, caseId: CASE_ID, propertyRef: PROPERTY_REF,
    valuationDate: '2026-09-07T00:00:00Z', plannedAt: '2026-09-07T08:00:00Z', leadInspectorRef: 'USER:INSPECTOR', scope: 'Synthetic inspection scope',
  });
  record = qualifyPreInspection(record, {
    checklist: { accessAuthorized: true, titleEvidencePrepared: true, planEvidencePrepared: true, safetyPlanPrepared: true, equipmentPrepared: true, conflictsReviewed: true, locationVerified: true },
    evidenceRefs: ['evidence://title', 'evidence://plan'], preparedByRef: 'USER:INSPECTOR', preparedAt: '2026-09-07T07:30:00Z',
  });
  record = startInspection(record, { startedAt: '2026-09-07T08:00:00Z', siteAnchorGps: GPS, deviceRef: 'DEVICE-1' });
  let minute = 1;
  for (const category of [OBSERVATION_CATEGORY.CONDITION, OBSERVATION_CATEGORY.OCCUPANCY, OBSERVATION_CATEGORY.CONSTRUCTION, OBSERVATION_CATEGORY.MEP, OBSERVATION_CATEGORY.SURROUNDINGS, OBSERVATION_CATEGORY.DEFECT]) {
    record = addInspectionObservation(record, {
      observationId: `OBS-${category}`, category, note: `${category} reviewed`, observedAt: `2026-09-07T08:0${minute}:00Z`, gps: GPS, evidenceRef: `evidence://inspection/${category}`,
    });
    minute += 1;
  }
  record = addInspectionMedia(record, createInspectionMediaRecord({
    mediaId: 'MEDIA-1', caseId: CASE_ID, inspectionId: INSPECTION_ID, fileRef: 'storage://photo.jpg', contentHashSha256: 'f'.repeat(64),
    capturedAt: '2026-09-07T08:10:00Z', gps: GPS, deviceRef: 'DEVICE-1', manipulationStatus: MEDIA_MANIPULATION_STATUS.PASS,
    manipulationEvidenceRef: 'evidence://media/pass',
  }));
  record = submitPostInspectionReview(record, {
    endedAt: '2026-09-07T09:00:00Z', reviewedByRef: 'USER:REVIEWER', reviewEvidenceRef: 'review://inspection',
    acknowledgements: { observationsReviewed: true, mediaReviewed: true, measurementsReviewed: true, materialConflictsReviewed: true, accountabilityAccepted: true },
    measurementGate: gate,measurementInputs,
  });
  if (!gate.readyForInspectionCompletion) return record;
  return completeInspection(record, { completedAt: '2026-09-07T09:05:00Z' });
}

const goodMeasurements = measurements();
const goodInspection = completedInspection(goodMeasurements);
const goodEvidence = [
  reviewedEvidence({ id: 'DEED', sourceRole: EVIDENCE_SOURCE_ROLE.TITLE_DEED, value: 1000, hashChar: 'a' }),
  reviewedEvidence({ id: 'INSP', sourceRole: EVIDENCE_SOURCE_ROLE.INSPECTION, value: 1000, hashChar: 'b' }),
];

const property = {
  caseId: CASE_ID, propertyRef: PROPERTY_REF, assignmentRef: 'ASSIGNMENT-001', assignment: assignment(), inspection: goodInspection,
  evidenceRecords: goodEvidence, measurementRecords: goodMeasurements, materialPropertyKeys: ['property.land_area'], materialMeasurementTypes: [MEASUREMENT_TYPE.LAND_AREA],
  evidenceToleranceByKey: { 'property.land_area': { absolute: 2 } }, measurementToleranceByType: { LAND_AREA: { absoluteSqm: 2 } },
  minimumPropertySourceRoles: 2, minimumMeasurementSourcesByType: { LAND_AREA: 2 },
};

const AS_OF='2026-09-07T00:00:00Z';
const {
  MARKET_EVIDENCE_LEVEL,
  MARKET_TRANSACTION_TYPE,
  MARKET_VERIFICATION_STATUS,
  evaluateComparableSetQuality,
  createComparableEvidenceRecord,
  COMPARABLE_SELECTION_STATUS,
  ADJUSTMENT_FACTOR,
  ADJUSTMENT_DIRECTION,
  ADJUSTMENT_METHOD,
  ADJUSTMENT_CONFIDENCE,
  ADJUSTMENT_ANALYSIS_STATUS,
  CALCULATION_CONVENTION,
  recordProfessionalComparableSelection,
  createComparableAdjustmentRecord,
  buildComparableAdjustmentAnalysis,
} = require('../../src/market');


const {
  LEASE_EVIDENCE_SOURCE,
  LEASE_VERIFICATION_STATUS,
  ESCALATION_TYPE,
  INCENTIVE_TYPE,
  RECOVERY_TYPE,
  LEASE_INCOME_GATE_STATUS,
  createLeaseEvidenceRecord,
  createVerifiedRentRollSnapshot,
  reconcileLeaseIncomeEvidence,
} = require('../../src/market');


function comparable(id, amountSar, propertyRef = id) {
  return createComparableEvidenceRecord({
    comparableId: id,
    caseId: CASE_ID,
    sourcePropertyRef: propertyRef,
    assetType: 'OFFICE',
    transactionType: MARKET_TRANSACTION_TYPE.SALE,
    evidenceLevel: MARKET_EVIDENCE_LEVEL.VERIFIED_TRANSACTION,
    sourceName: 'SYNTHETIC VERIFIED SOURCE',
    sourceRef: `SOURCE-${id}`,
    sourceDate: '2026-07-02T00:00:00Z',
    transactionDate: '2026-07-01T00:00:00Z',
    location: { city: 'RIYADH', district: 'SYNTHETIC_DISTRICT' },
    areaSqm: 1000,
    amountSar,
    verification: {
      status: MARKET_VERIFICATION_STATUS.VERIFIED,
      verifiedByRef: 'USER:MARKET-ANALYST',
      verifiedAt: '2026-07-03T00:00:00Z',
      evidenceRef: `evidence://${id}`,
    },
    capturedAt: '2026-07-04T00:00:00Z',
  });
}

const c1 = comparable('C1', 10000000, 'P1');
const c2 = comparable('C2', 10500000, 'P2');
const c3 = comparable('C3', 9500000, 'P3');
const records = [c1, c2, c3];

function adjustment(overrides = {}) {
  return createComparableAdjustmentRecord({
    adjustmentId: 'A1',
    caseId: CASE_ID,
    comparableId: 'C1',
    factor: ADJUSTMENT_FACTOR.TIME_MARKET_CONDITIONS,
    factorLabel: null,
    direction: ADJUSTMENT_DIRECTION.INCREASE,
    method: ADJUSTMENT_METHOD.PERCENT_OF_BASE,
    magnitude: 0.05,
    rationale: 'Explicit synthetic time adjustment supplied by professional user.',
    evidenceRefs: ['evidence://market-time-series'],
    confidence: ADJUSTMENT_CONFIDENCE.HIGH,
    preparedByRef: 'USER:VALUER',
    preparedAt: '2026-09-07T09:05:00Z',
    reviewedByRef: 'USER:REVIEWER',
    reviewedAt: '2026-09-07T09:10:00Z',
    reviewEvidenceRef: 'review://A1',
    ...overrides,
  });
}

const a1 = adjustment();
const a2 = adjustment({
  adjustmentId: 'A2',
  factor: ADJUSTMENT_FACTOR.SIZE,
  direction: ADJUSTMENT_DIRECTION.DECREASE,
  method: ADJUSTMENT_METHOD.AMOUNT_SAR_PER_SQM,
  magnitude: 200,
  rationale: 'Explicit synthetic size adjustment.',
  evidenceRefs: ['evidence://size-analysis'],
  confidence: ADJUSTMENT_CONFIDENCE.MODERATE,
  reviewEvidenceRef: 'review://A2',
});
const a3 = adjustment({
  adjustmentId: 'A3',
  comparableId: 'C2',
  factor: ADJUSTMENT_FACTOR.LOCATION,
  direction: ADJUSTMENT_DIRECTION.DECREASE,
  magnitude: 0.02,
  rationale: 'Explicit synthetic location adjustment.',
  evidenceRefs: ['evidence://location-analysis'],
  reviewEvidenceRef: 'review://A3',
});
const a4 = adjustment({
  adjustmentId: 'A4',
  comparableId: 'C2',
  factor: ADJUSTMENT_FACTOR.PARKING,
  direction: ADJUSTMENT_DIRECTION.NONE,
  method: ADJUSTMENT_METHOD.AMOUNT_SAR_PER_SQM,
  magnitude: 0,
  rationale: 'Parking considered comparable; no adjustment.',
  evidenceRefs: ['evidence://parking-comparison'],
  reviewEvidenceRef: 'review://A4',
});

function verification(status = LEASE_VERIFICATION_STATUS.VERIFIED, id = 'V1') {
  return status === LEASE_VERIFICATION_STATUS.VERIFIED
    ? { status, verifiedByRef: 'USER:LEASE-REVIEWER', verifiedAt: '2026-09-06T10:00:00Z', evidenceRef: `verify://${id}` }
    : { status };
}

function lease(overrides = {}) {
  const id = overrides.leaseId || 'L1';
  return createLeaseEvidenceRecord({
    leaseId: id,
    caseId: CASE_ID,
    propertyRef: PROPERTY_REF,
    unitRef: 'UNIT-1',
    tenantRef: 'TENANT-1',
    leaseInterestRef: 'LEASEHOLD-OCCUPANCY',
    areaSqm: 600,
    baseAnnualRentSar: 580000,
    contractedAnnualRentSarAsOfDate: 600000,
    startDate: '2025-01-01T00:00:00Z',
    expiryDate: '2030-12-31T23:59:59Z',
    escalation: { type: ESCALATION_TYPE.PERCENT, rate: 0.05, intervalMonths: 12, evidenceRef: `evidence://${id}/escalation` },
    breakOptions: [{ optionDate: '2028-01-01T00:00:00Z', noticeDays: 180, description: 'Synthetic tenant break option', evidenceRef: `evidence://${id}/break` }],
    renewalOptions: [{ optionDate: '2030-12-01T00:00:00Z', noticeDays: 90, description: 'Synthetic renewal option', evidenceRef: `evidence://${id}/renewal` }],
    incentives: [{ type: INCENTIVE_TYPE.RENT_FREE, amountSar: 0, months: 2, evidenceRef: `evidence://${id}/incentive` }],
    recoveries: { type: RECOVERY_TYPE.FIXED, annualAmountSar: 30000, evidenceRef: `evidence://${id}/recoveries` },
    sourceClass: LEASE_EVIDENCE_SOURCE.VERIFIED_EXECUTED_LEASE,
    sourceRef: `SOURCE-${id}`,
    sourceDocumentHashSha256: 'a'.repeat(64),
    verification: verification(LEASE_VERIFICATION_STATUS.VERIFIED, id),
    capturedAt: '2026-09-06T09:00:00Z',
    ...overrides,
  });
}

const l1 = lease();
const l2 = lease({
  leaseId: 'L2',
  unitRef: 'UNIT-2',
  tenantRef: 'TENANT-2',
  areaSqm: 400,
  baseAnnualRentSar: 430000,
  contractedAnnualRentSarAsOfDate: 450000,
  escalation: { type: ESCALATION_TYPE.FIXED_AMOUNT, amountSar: 20000, intervalMonths: 12, evidenceRef: 'evidence://L2/escalation' },
  breakOptions: [],
  renewalOptions: [],
  incentives: [],
  recoveries: { type: RECOVERY_TYPE.NONE },
  sourceRef: 'SOURCE-L2',
  sourceDocumentHashSha256: 'b'.repeat(64),
  verification: verification(LEASE_VERIFICATION_STATUS.VERIFIED, 'L2'),
});
const inactive = lease({
  leaseId: 'OLD',
  unitRef: 'UNIT-OLD',
  tenantRef: 'TENANT-OLD',
  areaSqm: 100,
  baseAnnualRentSar: 100000,
  contractedAnnualRentSarAsOfDate: 100000,
  startDate: '2020-01-01T00:00:00Z',
  expiryDate: '2022-12-31T23:59:59Z',
  escalation: { type: ESCALATION_TYPE.NONE },
  breakOptions: [],
  renewalOptions: [],
  incentives: [],
  recoveries: { type: RECOVERY_TYPE.NONE },
  sourceClass: LEASE_EVIDENCE_SOURCE.CLIENT_PROVIDED,
  sourceRef: 'SOURCE-OLD',
  sourceDocumentHashSha256: 'c'.repeat(64),
  verification: verification(LEASE_VERIFICATION_STATUS.NOT_VERIFIED, 'OLD'),
});


function rentRoll(overrides = {}) {
  return createVerifiedRentRollSnapshot({
    snapshotId: 'RR-1',
    caseId: CASE_ID,
    propertyRef: PROPERTY_REF,
    asOfDate: AS_OF,
    totalLettableAreaSqm: 1200,
    occupiedAreaSqm: 1000,
    annualContractRentSar: 1050000,
    activeLeaseCount: 2,
    sourceRef: 'SOURCE-RENT-ROLL',
    sourceDocumentHashSha256: 'd'.repeat(64),
    verification: verification(LEASE_VERIFICATION_STATUS.VERIFIED, 'RR'),
    capturedAt: '2026-09-06T09:00:00Z',
    ...overrides,
  });
}

const rr = rentRoll();

const qualityPolicy={asOfDate:AS_OF,maxAgeDays:365,minimumComparableCount:3,minimumEvidenceLevel:MARKET_EVIDENCE_LEVEL.VERIFIED_TRANSACTION,targetAssetType:'OFFICE',targetTransactionType:'SALE',targetCity:'RIYADH'};
const selectionInput={selectedComparableIds:['C1','C2'],selectionRationales:{C1:'Synthetic comparable one',C2:'Synthetic comparable two'},selectedByRef:'USER:VALUER',selectionEvidenceRef:'review://selection',selectedAt:'2026-09-07T09:00:00Z',minimumSelectedCount:2};
const adjustmentPolicy={calculationConvention:CALCULATION_CONVENTION.ADDITIVE_TO_BASE_UNIT_VALUE,materialNetAdjustmentThreshold:.25,materialGrossAdjustmentThreshold:.4,materialSinglePercentAdjustmentThreshold:.2};
const market={records,adjustmentRecords:[a1,a2,a3,a4],qualityPolicy,selectionInput,adjustmentPolicy};
const quality=evaluateComparableSetQuality({...qualityPolicy,caseId:CASE_ID,records});
const selection=recordProfessionalComparableSelection({...selectionInput,caseId:CASE_ID,records,qualityGate:quality});
const marketAdjustmentAnalysis=buildComparableAdjustmentAnalysis({...adjustmentPolicy,caseId:CASE_ID,selection,records,adjustmentRecords:market.adjustmentRecords});
const income={leaseRecords:[l1,l2,inactive],rentRollSnapshot:rr,policy:{asOfDate:AS_OF,annualRentToleranceSar:0,occupiedAreaToleranceSqm:0,requireVerifiedActiveLeases:true}};
const incomeEvidencePacket=reconcileLeaseIncomeEvidence({...income.policy,caseId:CASE_ID,propertyRef:PROPERTY_REF,leaseRecords:income.leaseRecords,rentRollSnapshot:rr});
const propertyEvidencePacket=buildPropertyEvidencePacket(property);
module.exports={caseId:CASE_ID,propertyRef:PROPERTY_REF,property,market,income,propertyEvidencePacket,marketAdjustmentAnalysis,incomeEvidencePacket};
