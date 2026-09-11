'use strict';

const assert = require('assert');
const {
  INSPECTION_STATE,
  OBSERVATION_CATEGORY,
  MEDIA_MANIPULATION_STATUS,
  createInspectionCase,
  qualifyPreInspection,
  startInspection,
  addInspectionObservation,
  createInspectionMediaRecord,
  addInspectionMedia,
  submitPostInspectionReview,
  completeInspection,
  MEASUREMENT_TYPE,
  MEASUREMENT_SOURCE,
  MEASUREMENT_RECONCILIATION_STATUS,
  createMeasurementRecord,
  reconcileMeasurementRecords,
} = require('../../src/inspection');

let checks = 0;
function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
}

function throwsWith(fn, fragment, message) {
  let threw = false;
  try { fn(); } catch (error) { threw = String(error.message).includes(fragment); }
  check(threw, message);
}

const CASE_ID = 'CASE-8B-001';
const INSPECTION_ID = 'INSP-8B-001';
const GPS = { lat: 24.7136, long: 46.6753, accuracyMeters: 6 };

let inspection = createInspectionCase({
  inspectionId: INSPECTION_ID,
  caseId: CASE_ID,
  propertyRef: 'PROPERTY-001',
  valuationDate: '2026-09-07T00:00:00Z',
  plannedAt: '2026-09-07T08:00:00Z',
  leadInspectorRef: 'USER:INSPECTOR-01',
  scope: 'Professional valuation inspection scope',
});
check(inspection.state === INSPECTION_STATE.DRAFT, 'inspection starts as DRAFT');
check(inspection.transactionAuthorized === false, 'inspection never authorizes transaction');

throwsWith(() => qualifyPreInspection(inspection, {
  checklist: { accessAuthorized: true },
  evidenceRefs: ['E1'], preparedByRef: 'USER:INSPECTOR-01', preparedAt: '2026-09-07T07:30:00Z',
}), 'PRE_INSPECTION_CHECKLIST_INCOMPLETE', 'incomplete pre-inspection checklist fails closed');

inspection = qualifyPreInspection(inspection, {
  checklist: {
    accessAuthorized: true,
    titleEvidencePrepared: true,
    planEvidencePrepared: true,
    safetyPlanPrepared: true,
    equipmentPrepared: true,
    conflictsReviewed: true,
    locationVerified: true,
  },
  evidenceRefs: ['evidence://title', 'evidence://plan'],
  preparedByRef: 'USER:INSPECTOR-01',
  preparedAt: '2026-09-07T07:30:00Z',
});
check(inspection.state === INSPECTION_STATE.PRE_INSPECTION_READY, 'complete pre-inspection gate is ready');
check(inspection.preInspection.evidenceRefs.length === 2, 'pre-inspection retains evidence references');

throwsWith(() => startInspection(inspection, {
  startedAt: '2026-09-07T08:00:00Z', siteAnchorGps: { lat: 200, long: 46 }, deviceRef: 'DEVICE-1',
}), 'siteAnchorGps.lat is invalid', 'invalid GPS fails closed');

inspection = startInspection(inspection, {
  startedAt: '2026-09-07T08:00:00Z', siteAnchorGps: GPS, deviceRef: 'DEVICE-1',
});
check(inspection.state === INSPECTION_STATE.IN_PROGRESS, 'prepared inspection can start');
check(inspection.siteAnchorGps.lat === GPS.lat, 'site anchor GPS preserved');

let obsTime = 1;
for (const category of [
  OBSERVATION_CATEGORY.CONDITION,
  OBSERVATION_CATEGORY.OCCUPANCY,
  OBSERVATION_CATEGORY.CONSTRUCTION,
  OBSERVATION_CATEGORY.MEP,
  OBSERVATION_CATEGORY.SURROUNDINGS,
  OBSERVATION_CATEGORY.DEFECT,
]) {
  inspection = addInspectionObservation(inspection, {
    observationId: `OBS-${category}`,
    category,
    note: category === OBSERVATION_CATEGORY.DEFECT ? 'No material defect observed; category explicitly reviewed.' : `${category} observation recorded.`,
    observedAt: `2026-09-07T08:${String(obsTime).padStart(2, '0')}:00Z`,
    gps: GPS,
    evidenceRef: `evidence://inspection/${category}`,
    applicable: true,
  });
  obsTime += 1;
}
check(inspection.observations.length === 6, 'all required professional observation categories recorded');
check(new Set(inspection.observations.map((item) => item.category)).size === 6, 'required categories are distinct');

const titleArea = createMeasurementRecord({
  measurementId: 'M-LAND-TITLE', caseId: CASE_ID, type: MEASUREMENT_TYPE.LAND_AREA, valueSqm: 1000,
  source: MEASUREMENT_SOURCE.TITLE_DEED, sourceEvidenceRef: 'evidence://title/area',
  measurementStandardRef: 'ASSIGNMENT_MEASUREMENT_STANDARD_REF', measurementMethod: 'DOCUMENT_REPORTED_AREA',
  measuredByRef: 'USER:ANALYST-01', measuredAt: '2026-09-07T07:00:00Z',
});
const inspectionArea = createMeasurementRecord({
  measurementId: 'M-LAND-INSP', caseId: CASE_ID, inspectionId: INSPECTION_ID, type: MEASUREMENT_TYPE.LAND_AREA, valueSqm: 1002,
  source: MEASUREMENT_SOURCE.INSPECTION, sourceEvidenceRef: 'evidence://inspection/measurement',
  measurementStandardRef: 'ASSIGNMENT_MEASUREMENT_STANDARD_REF', measurementMethod: 'SITE_MEASUREMENT',
  measuredByRef: 'USER:INSPECTOR-01', measuredAt: '2026-09-07T08:10:00Z',
});
check(titleArea.unit === 'SQM', 'canonical measurement unit is SQM');
check(/^[a-f0-9]{64}$/.test(titleArea.measurementHashSha256), 'measurement record has deterministic SHA-256');
check(titleArea.measurementStandardRef === inspectionArea.measurementStandardRef, 'measurement standard provenance is explicit');

throwsWith(() => createMeasurementRecord({
  measurementId: 'BAD', caseId: CASE_ID, type: MEASUREMENT_TYPE.GFA, valueSqm: 1,
  source: MEASUREMENT_SOURCE.INSPECTION, sourceEvidenceRef: 'e', measurementStandardRef: '', measurementMethod: 'M', measuredByRef: 'U', measuredAt: '2026-09-07T08:00:00Z',
}), 'measurementStandardRef', 'measurement standard reference cannot be omitted');

const measurementGate = reconcileMeasurementRecords({
  caseId: CASE_ID,
  records: [titleArea, inspectionArea],
  materialTypes: [MEASUREMENT_TYPE.LAND_AREA],
  toleranceByType: { LAND_AREA: { absoluteSqm: 3 } },
  minimumIndependentSourcesByType: { LAND_AREA: 2 },
});
check(measurementGate.status === MEASUREMENT_RECONCILIATION_STATUS.CLEAR, 'measurements within tolerance reconcile CLEAR');
check(measurementGate.readyForInspectionCompletion === true, 'clear measurement gate can support inspection completion');
check(measurementGate.checks[0].sourceCount === 2, 'measurement gate recognizes independent source classes');

const conflictingArea = createMeasurementRecord({
  measurementId: 'M-LAND-CONFLICT', caseId: CASE_ID, inspectionId: INSPECTION_ID, type: MEASUREMENT_TYPE.LAND_AREA, valueSqm: 1100,
  source: MEASUREMENT_SOURCE.INSPECTION, sourceEvidenceRef: 'evidence://inspection/conflict',
  measurementStandardRef: 'ASSIGNMENT_MEASUREMENT_STANDARD_REF', measurementMethod: 'SITE_MEASUREMENT',
  measuredByRef: 'USER:INSPECTOR-01', measuredAt: '2026-09-07T08:10:00Z',
});
const measurementConflict = reconcileMeasurementRecords({
  caseId: CASE_ID,
  records: [titleArea, conflictingArea],
  materialTypes: [MEASUREMENT_TYPE.LAND_AREA],
  toleranceByType: { LAND_AREA: { absoluteSqm: 3 } },
});
check(measurementConflict.status === MEASUREMENT_RECONCILIATION_STATUS.MEASUREMENT_CONFLICT, 'material measurement disagreement is not averaged away');
check(measurementConflict.financialEngineAdoptionAllowed === false, 'measurement conflict blocks engine adoption');

const missingMeasurement = reconcileMeasurementRecords({
  caseId: CASE_ID, records: [], materialTypes: [MEASUREMENT_TYPE.GFA],
});
check(missingMeasurement.status === MEASUREMENT_RECONCILIATION_STATUS.HOLD_INSUFFICIENT_EVIDENCE, 'missing material measurement holds workflow');

throwsWith(() => reconcileMeasurementRecords({
  caseId: CASE_ID,
  records: [createMeasurementRecord({
    measurementId: 'M-FOREIGN', caseId: 'CASE-OTHER', type: MEASUREMENT_TYPE.LAND_AREA, valueSqm: 1000,
    source: MEASUREMENT_SOURCE.SURVEY, sourceEvidenceRef: 'e', measurementStandardRef: 'S', measurementMethod: 'M', measuredByRef: 'U', measuredAt: '2026-09-07T08:00:00Z',
  })],
  materialTypes: [MEASUREMENT_TYPE.LAND_AREA],
}), 'CASE_ISOLATION_VIOLATION', 'measurement reconciliation rejects cross-case records');

const passMedia = createInspectionMediaRecord({
  mediaId: 'MEDIA-PASS', caseId: CASE_ID, inspectionId: INSPECTION_ID, fileRef: 'storage://inspection/photo-1.jpg',
  contentHashSha256: 'a'.repeat(64), capturedAt: '2026-09-07T08:12:00Z', gps: GPS, deviceRef: 'DEVICE-1',
  manipulationStatus: MEDIA_MANIPULATION_STATUS.PASS, manipulationEvidenceRef: 'evidence://media-integrity/pass',
});
check(/^[a-f0-9]{64}$/.test(passMedia.integrityHashSha256), 'inspection media has integrity hash');
check(passMedia.manipulationStatus === MEDIA_MANIPULATION_STATUS.PASS, 'cleared media records manipulation check result');

const inspectionWithPassMedia = addInspectionMedia(inspection, passMedia);
check(inspectionWithPassMedia.media.length === 1, 'inspection media attached to matching case/inspection');

const flaggedMedia = createInspectionMediaRecord({
  mediaId: 'MEDIA-FLAG', caseId: CASE_ID, inspectionId: INSPECTION_ID, fileRef: 'storage://inspection/photo-flag.jpg',
  contentHashSha256: 'b'.repeat(64), capturedAt: '2026-09-07T08:13:00Z', gps: GPS, deviceRef: 'DEVICE-1',
  manipulationStatus: MEDIA_MANIPULATION_STATUS.FLAGGED, manipulationEvidenceRef: 'evidence://media-integrity/flag',
});
const inspectionWithFlag = addInspectionMedia(inspectionWithPassMedia, flaggedMedia);
const blockedReview = submitPostInspectionReview(inspectionWithFlag, {
  endedAt: '2026-09-07T09:00:00Z', reviewedByRef: 'USER:REVIEWER-01', reviewEvidenceRef: 'evidence://post-review/blocked',
  acknowledgements: { observationsReviewed: true, mediaReviewed: true, measurementsReviewed: true, materialConflictsReviewed: true, accountabilityAccepted: true },
  measurementGate,
});
check(blockedReview.postInspectionReview.readyToComplete === false, 'flagged media blocks inspection completion');
check(blockedReview.postInspectionReview.blockers.includes('INSPECTION_MEDIA_INTEGRITY_NOT_CLEARED'), 'media blocker is explicit');
throwsWith(() => completeInspection(blockedReview, { completedAt: '2026-09-07T09:05:00Z' }), 'INSPECTION_COMPLETION_BLOCKED', 'blocked review cannot be force-completed');

const readyReview = submitPostInspectionReview(inspectionWithPassMedia, {
  endedAt: '2026-09-07T09:00:00Z', reviewedByRef: 'USER:REVIEWER-01', reviewEvidenceRef: 'evidence://post-review/pass',
  acknowledgements: { observationsReviewed: true, mediaReviewed: true, measurementsReviewed: true, materialConflictsReviewed: true, accountabilityAccepted: true },
  measurementGate,
});
check(readyReview.state === INSPECTION_STATE.POST_INSPECTION_REVIEW, 'successful field work moves to post-inspection review');
check(readyReview.postInspectionReview.readyToComplete === true, 'complete observation/media/measurement packet is completion-ready');

const completed = completeInspection(readyReview, { completedAt: '2026-09-07T09:05:00Z' });
check(completed.state === INSPECTION_STATE.COMPLETED, 'governed inspection can complete after post-review');
check(completed.completedAt === '2026-09-07T09:05:00.000Z', 'completion timestamp is canonicalized');
check(completed.certifiedValuationEstablished === false, 'inspection completion does not certify valuation');
check(completed.transactionAuthorized === false, 'inspection completion does not authorize transaction');

console.log(`WAVE_8B_INSPECTION_MEASUREMENT=PASS checks=${checks}`);
