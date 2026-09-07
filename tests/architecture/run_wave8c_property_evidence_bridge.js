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
  const gate = reconcileMeasurementRecords({
    caseId: CASE_ID,
    records: measurementRecords,
    materialTypes: [MEASUREMENT_TYPE.LAND_AREA],
    toleranceByType: { LAND_AREA: { absoluteSqm: 2 } },
    minimumIndependentSourcesByType: { LAND_AREA: 2 },
  });
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
    measurementGate: gate,
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

const ready = buildPropertyEvidencePacket({
  caseId: CASE_ID, propertyRef: PROPERTY_REF, assignmentRef: 'ASSIGNMENT-001', assignment: assignment(), inspection: goodInspection,
  evidenceRecords: goodEvidence, measurementRecords: goodMeasurements, materialPropertyKeys: ['property.land_area'], materialMeasurementTypes: [MEASUREMENT_TYPE.LAND_AREA],
  evidenceToleranceByKey: { 'property.land_area': { absolute: 2 } }, measurementToleranceByType: { LAND_AREA: { absoluteSqm: 2 } },
  minimumPropertySourceRoles: 2, minimumMeasurementSourcesByType: { LAND_AREA: 2 },
});
check(ready.status === PROPERTY_EVIDENCE_PACKET_STATUS.READY_FOR_PROFESSIONAL_VALUATION_WORKFLOW, 'complete packet is professional-workflow ready');
check(ready.professionalValuationWorkflowReady === true, 'ready packet signals professional workflow handoff only');
check(ready.evidenceFacts.length === 2, 'packet preserves verified evidence facts');
check(ready.measurements.length === 2, 'packet preserves measurement provenance');
check(ready.evidenceFacts.every((item) => item.verificationReference && item.chainHashSha256), 'evidence facts retain verification and chain provenance');
check(ready.measurements.every((item) => item.measurementStandardRef === 'SYNTHETIC-MEASUREMENT-STANDARD'), 'measurements retain applied-standard reference');
check(/^[a-f0-9]{64}$/.test(ready.packetHashSha256), 'packet has immutable content hash');
check(ready.automaticUnderwritingAdoption === false && ready.financialEngineInputsWritten === false, 'property packet never automatically writes underwriting inputs');
check(ready.certifiedValuationEstablished === false && ready.transactionAuthorized === false, 'property packet creates no certification or transaction authority');
check(Object.isFrozen(ready) === true && Object.isFrozen(ready.evidenceFacts) === true, 'property packet is immutable');

const badAssignment = buildPropertyEvidencePacket({
  caseId: CASE_ID, propertyRef: PROPERTY_REF, assignmentRef: 'A', assignment: assignment({ basis: '' }), inspection: goodInspection,
  evidenceRecords: goodEvidence, measurementRecords: goodMeasurements, materialPropertyKeys: ['property.land_area'], materialMeasurementTypes: [MEASUREMENT_TYPE.LAND_AREA],
});
check(badAssignment.status === PROPERTY_EVIDENCE_PACKET_STATUS.HOLD_ASSIGNMENT, 'incomplete valuation assignment holds property packet');

const forgedInspection = { ...goodInspection, observations: [] };
const heldInspection = buildPropertyEvidencePacket({
  caseId: CASE_ID, propertyRef: PROPERTY_REF, assignmentRef: 'A', assignment: assignment(), inspection: forgedInspection,
  evidenceRecords: goodEvidence, measurementRecords: goodMeasurements, materialPropertyKeys: ['property.land_area'], materialMeasurementTypes: [MEASUREMENT_TYPE.LAND_AREA],
});
check(heldInspection.status === PROPERTY_EVIDENCE_PACKET_STATUS.HOLD_INSPECTION, 'forged/incomplete completed inspection fails bridge integrity checks');
check(heldInspection.reasons.some((item) => item.startsWith('INSPECTION_OBSERVATIONS_INCOMPLETE:')), 'inspection hold identifies missing professional categories');

const badMeasurements = measurements({ conflict: true });
const heldMeasurement = buildPropertyEvidencePacket({
  caseId: CASE_ID, propertyRef: PROPERTY_REF, assignmentRef: 'A', assignment: assignment(), inspection: goodInspection,
  evidenceRecords: goodEvidence, measurementRecords: badMeasurements, materialPropertyKeys: ['property.land_area'], materialMeasurementTypes: [MEASUREMENT_TYPE.LAND_AREA],
  measurementToleranceByType: { LAND_AREA: { absoluteSqm: 2 } },
});
check(heldMeasurement.status === PROPERTY_EVIDENCE_PACKET_STATUS.HOLD_MEASUREMENT, 'measurement conflict blocks property packet');

const unverifiedEvidence = [goodEvidence[0], reviewedEvidence({ id: 'UNVER', sourceRole: EVIDENCE_SOURCE_ROLE.INSPECTION, value: 1000, hashChar: 'c', verified: false })];
const heldEvidence = buildPropertyEvidencePacket({
  caseId: CASE_ID, propertyRef: PROPERTY_REF, assignmentRef: 'A', assignment: assignment(), inspection: goodInspection,
  evidenceRecords: unverifiedEvidence, measurementRecords: goodMeasurements, materialPropertyKeys: ['property.land_area'], materialMeasurementTypes: [MEASUREMENT_TYPE.LAND_AREA],
});
check(heldEvidence.status === PROPERTY_EVIDENCE_PACKET_STATUS.HOLD_EVIDENCE, 'unverified evidence cannot enter professional property packet');

const conflictingEvidence = [goodEvidence[0], reviewedEvidence({ id: 'CONFLICT', sourceRole: EVIDENCE_SOURCE_ROLE.INSPECTION, value: 1200, hashChar: 'd' })];
const materialConflict = buildPropertyEvidencePacket({
  caseId: CASE_ID, propertyRef: PROPERTY_REF, assignmentRef: 'A', assignment: assignment(), inspection: goodInspection,
  evidenceRecords: conflictingEvidence, measurementRecords: goodMeasurements, materialPropertyKeys: ['property.land_area'], materialMeasurementTypes: [MEASUREMENT_TYPE.LAND_AREA],
  evidenceToleranceByKey: { 'property.land_area': { absolute: 2 } },
});
check(materialConflict.status === PROPERTY_EVIDENCE_PACKET_STATUS.MATERIAL_PROPERTY_DATA_CONFLICT, 'deed/inspection material disagreement emits canonical property conflict');
check(materialConflict.professionalValuationWorkflowReady === false, 'material property conflict blocks professional valuation workflow handoff');

throwsWith(() => buildPropertyEvidencePacket({
  caseId: 'CASE-OTHER', propertyRef: PROPERTY_REF, assignmentRef: 'A', assignment: assignment(), inspection: goodInspection,
  evidenceRecords: goodEvidence, measurementRecords: goodMeasurements, materialPropertyKeys: ['property.land_area'], materialMeasurementTypes: [MEASUREMENT_TYPE.LAND_AREA],
}), 'PROPERTY_CASE_ISOLATION_VIOLATION', 'cross-case inspection/evidence cannot be bridged');

console.log(`WAVE_8C_PROPERTY_EVIDENCE_BRIDGE=PASS checks=${checks}`);
