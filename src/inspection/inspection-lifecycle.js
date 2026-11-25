'use strict';

const crypto = require('node:crypto');
const {strictCalendarDateMs}=require('../validation/strict-calendar-instant');
const {verifyMeasurementGate,reconcileMeasurementRecords}=require('./measurement-governance');

const INSPECTION_STATE = Object.freeze({
  DRAFT: 'DRAFT',
  PRE_INSPECTION_READY: 'PRE_INSPECTION_READY',
  IN_PROGRESS: 'IN_PROGRESS',
  POST_INSPECTION_REVIEW: 'POST_INSPECTION_REVIEW',
  COMPLETED: 'COMPLETED',
  RETURNED: 'RETURNED',
  CANCELLED: 'CANCELLED',
});

const OBSERVATION_CATEGORY = Object.freeze({
  CONDITION: 'CONDITION',
  OCCUPANCY: 'OCCUPANCY',
  CONSTRUCTION: 'CONSTRUCTION',
  MEP: 'MEP',
  SURROUNDINGS: 'SURROUNDINGS',
  DEFECT: 'DEFECT',
  MEASUREMENT: 'MEASUREMENT',
  OTHER: 'OTHER',
});

const MEDIA_MANIPULATION_STATUS = Object.freeze({
  NOT_RUN: 'NOT_RUN',
  PASS: 'PASS',
  FLAGGED: 'FLAGGED',
});

const REQUIRED_OBSERVATION_CATEGORIES = Object.freeze([
  OBSERVATION_CATEGORY.CONDITION,
  OBSERVATION_CATEGORY.OCCUPANCY,
  OBSERVATION_CATEGORY.CONSTRUCTION,
  OBSERVATION_CATEGORY.MEP,
  OBSERVATION_CATEGORY.SURROUNDINGS,
  OBSERVATION_CATEGORY.DEFECT,
]);

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertNonEmpty(value, field) {
  if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`);
}

function iso(value, field) {
  if (!nonEmpty(value)) throw new TypeError(`${field} is required`);
  const date = new Date(strictCalendarDateMs(value));
  if (Number.isNaN(date.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return date.toISOString();
}

function assertEnum(value, enumeration, field) {
  if (!Object.values(enumeration).includes(value)) throw new TypeError(`${field} is invalid`);
}

function validateGps(gps, field = 'gps') {
  if (!gps || typeof gps !== 'object') throw new TypeError(`${field} is required`);
  if (typeof gps.lat !== 'number' || !Number.isFinite(gps.lat) || gps.lat < -90 || gps.lat > 90) throw new TypeError(`${field}.lat is invalid`);
  if (typeof gps.long !== 'number' || !Number.isFinite(gps.long) || gps.long < -180 || gps.long > 180) throw new TypeError(`${field}.long is invalid`);
  if (gps.accuracyMeters != null && (!Number.isFinite(gps.accuracyMeters) || gps.accuracyMeters < 0)) throw new TypeError(`${field}.accuracyMeters is invalid`);
  return Object.freeze({ lat: gps.lat, long: gps.long, accuracyMeters: gps.accuracyMeters ?? null });
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function canonical(v){
 if(Array.isArray(v))return v.map(canonical);
 if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>{
  if(['__proto__','constructor','prototype'].includes(k))throw TypeError('INSPECTION_UNSAFE_KEY');
  return [k,canonical(v[k])];
 }));
 return v;
}
const digest=v=>hash(canonical(v));
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function createInspectionCase({ inspectionId, caseId, propertyRef, valuationDate, plannedAt, leadInspectorRef, scope }) {
  [
    ['inspectionId', inspectionId],
    ['caseId', caseId],
    ['propertyRef', propertyRef],
    ['leadInspectorRef', leadInspectorRef],
    ['scope', scope],
  ].forEach(([field, value]) => assertNonEmpty(value, field));
  const record = {
    schemaVersion: 1,
    inspectionId: inspectionId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    valuationDate: iso(valuationDate, 'valuationDate'),
    plannedAt: iso(plannedAt, 'plannedAt'),
    leadInspectorRef: leadInspectorRef.trim(),
    scope: scope.trim(),
    state: INSPECTION_STATE.DRAFT,
    preInspection: null,
    startedAt: null,
    siteAnchorGps: null,
    deviceRef: null,
    observations: [],
    media: [],
    postInspectionReview: null,
    completedAt: null,
    transactionAuthorized: false,
    certifiedValuationEstablished: false,
  };
  return freeze(record);
}

function qualifyPreInspection(inspection, { checklist, evidenceRefs, preparedByRef, preparedAt }) {
  if (inspection?.state !== INSPECTION_STATE.DRAFT && inspection?.state !== INSPECTION_STATE.RETURNED) throw new TypeError('INSPECTION_STATE_INVALID_FOR_PREPARATION');
  const required = ['accessAuthorized', 'titleEvidencePrepared', 'planEvidencePrepared', 'safetyPlanPrepared', 'equipmentPrepared', 'conflictsReviewed', 'locationVerified'];
  if (!checklist || !required.every((key) => checklist[key] === true)) throw new TypeError('PRE_INSPECTION_CHECKLIST_INCOMPLETE');
  if (!Array.isArray(evidenceRefs) || evidenceRefs.length === 0 || evidenceRefs.some((ref) => !nonEmpty(ref))) throw new TypeError('PRE_INSPECTION_EVIDENCE_REQUIRED');
  assertNonEmpty(preparedByRef, 'preparedByRef');
  const at = iso(preparedAt, 'preparedAt');
  return freeze({
    ...inspection,
    state: INSPECTION_STATE.PRE_INSPECTION_READY,
    preInspection: {
      checklist: Object.freeze(Object.fromEntries(required.map((key) => [key, true]))),
      evidenceRefs: Object.freeze([...new Set(evidenceRefs.map((ref) => ref.trim()))]),
      preparedByRef: preparedByRef.trim(),
      preparedAt: at,
    },
  });
}

function startInspection(inspection, { startedAt, siteAnchorGps, deviceRef }) {
  if (inspection?.state !== INSPECTION_STATE.PRE_INSPECTION_READY) throw new TypeError('INSPECTION_NOT_PREPARED');
  const at = iso(startedAt, 'startedAt');
  if (Date.parse(at) < Date.parse(inspection.preInspection.preparedAt)) throw new TypeError('INSPECTION_TIMELINE_INVALID');
  assertNonEmpty(deviceRef, 'deviceRef');
  return freeze({
    ...inspection,
    state: INSPECTION_STATE.IN_PROGRESS,
    startedAt: at,
    siteAnchorGps: validateGps(siteAnchorGps, 'siteAnchorGps'),
    deviceRef: deviceRef.trim(),
  });
}

function addInspectionObservation(inspection, { observationId, category, note, observedAt, gps, evidenceRef, applicable = true }) {
  if (inspection?.state !== INSPECTION_STATE.IN_PROGRESS) throw new TypeError('INSPECTION_NOT_IN_PROGRESS');
  assertNonEmpty(observationId, 'observationId');
  assertEnum(category, OBSERVATION_CATEGORY, 'category');
  assertNonEmpty(note, 'note');
  assertNonEmpty(evidenceRef, 'evidenceRef');
  const at = iso(observedAt, 'observedAt');
  if (Date.parse(at) < Date.parse(inspection.startedAt)) throw new TypeError('OBSERVATION_PREDATES_INSPECTION');
  if (inspection.observations.some((item) => item.observationId === observationId.trim())) throw new TypeError('DUPLICATE_OBSERVATION_ID');
  const observation = freeze({
    observationId: observationId.trim(),
    category,
    note: note.trim(),
    observedAt: at,
    gps: validateGps(gps, 'observation.gps'),
    evidenceRef: evidenceRef.trim(),
    applicable: typeof applicable==='boolean'?applicable:(()=>{throw TypeError('OBSERVATION_APPLICABILITY_INVALID');})(),
  });
  return freeze({ ...inspection, observations: [...inspection.observations, observation] });
}

function createInspectionMediaRecord({ mediaId, caseId, inspectionId, fileRef, contentHashSha256, capturedAt, gps, deviceRef, manipulationStatus, manipulationEvidenceRef }) {
  [
    ['mediaId', mediaId], ['caseId', caseId], ['inspectionId', inspectionId], ['fileRef', fileRef], ['deviceRef', deviceRef],
  ].forEach(([field, value]) => assertNonEmpty(value, field));
  if (!/^[a-f0-9]{64}$/i.test(contentHashSha256 || '')) throw new TypeError('contentHashSha256 must be SHA-256');
  assertEnum(manipulationStatus, MEDIA_MANIPULATION_STATUS, 'manipulationStatus');
  if (manipulationStatus !== MEDIA_MANIPULATION_STATUS.NOT_RUN) assertNonEmpty(manipulationEvidenceRef, 'manipulationEvidenceRef');
  const record = {
    schemaVersion: 1,
    mediaId: mediaId.trim(),
    caseId: caseId.trim(),
    inspectionId: inspectionId.trim(),
    fileRef: fileRef.trim(),
    contentHashSha256: contentHashSha256.toLowerCase(),
    capturedAt: iso(capturedAt, 'capturedAt'),
    gps: validateGps(gps, 'media.gps'),
    deviceRef: deviceRef.trim(),
    manipulationStatus,
    manipulationEvidenceRef: manipulationEvidenceRef ? manipulationEvidenceRef.trim() : null,
  };
  record.integrityHashSha256 = hash(record);
  return freeze(record);
}

function addInspectionMedia(inspection, media) {
  if (inspection?.state !== INSPECTION_STATE.IN_PROGRESS) throw new TypeError('INSPECTION_NOT_IN_PROGRESS');
  if (!media || media.caseId !== inspection.caseId || media.inspectionId !== inspection.inspectionId) throw new TypeError('INSPECTION_MEDIA_CASE_OR_ID_MISMATCH');
  if(digest(media)!==digest(createInspectionMediaRecord(media)))throw TypeError('INSPECTION_MEDIA_INTEGRITY_INVALID');
  if (Date.parse(media.capturedAt) < Date.parse(inspection.startedAt)) throw new TypeError('MEDIA_PREDATES_INSPECTION');
  if (inspection.media.some((item) => item.mediaId === media.mediaId)) throw new TypeError('DUPLICATE_MEDIA_ID');
  return freeze({ ...inspection, media: [...inspection.media, media] });
}

function submitPostInspectionReview(inspection, { endedAt, reviewedByRef, reviewEvidenceRef, acknowledgements, measurementGate, measurementInputs }) {
  if (inspection?.state !== INSPECTION_STATE.IN_PROGRESS) throw new TypeError('INSPECTION_NOT_IN_PROGRESS');
  const at = iso(endedAt, 'endedAt');
  if (Date.parse(at) < Date.parse(inspection.startedAt)) throw new TypeError('INSPECTION_END_PREDATES_START');
  assertNonEmpty(reviewedByRef, 'reviewedByRef');
  assertNonEmpty(reviewEvidenceRef, 'reviewEvidenceRef');
  const requiredAck = ['observationsReviewed', 'mediaReviewed', 'measurementsReviewed', 'materialConflictsReviewed', 'accountabilityAccepted'];
  if (!acknowledgements || !requiredAck.every((key) => acknowledgements[key] === true)) throw new TypeError('POST_INSPECTION_ACKNOWLEDGEMENTS_INCOMPLETE');

  const categories = new Set(inspection.observations.map((item) => item.category));
  const missingCategories = REQUIRED_OBSERVATION_CATEGORIES.filter((category) => !categories.has(category));
  const mediaFailures = inspection.media.filter((item) => item.manipulationStatus !== MEDIA_MANIPULATION_STATUS.PASS);
  const blockers = [];
  if (missingCategories.length) blockers.push(`MISSING_OBSERVATION_CATEGORIES:${missingCategories.join(',')}`);
  if (inspection.media.length === 0) blockers.push('INSPECTION_MEDIA_REQUIRED');
  if (mediaFailures.length) blockers.push('INSPECTION_MEDIA_INTEGRITY_NOT_CLEARED');
  if (!measurementGate || measurementGate.caseId !== inspection.caseId||!verifyMeasurementGate(measurementGate,measurementInputs)) blockers.push('MEASUREMENT_GATE_NOT_CLEAR');
  if(inspection.observations.some(o=>Date.parse(o.observedAt)>Date.parse(at))||inspection.media.some(m=>Date.parse(m.capturedAt)>Date.parse(at)))blockers.push('FIELD_EVIDENCE_AFTER_REVIEW');
  if(measurementInputs?.records?.some(m=>Date.parse(m.measuredAt)>Date.parse(at)||(m.inspectionId!==null&&m.inspectionId!==inspection.inspectionId)||(m.source==='INSPECTION'&&m.inspectionId!==inspection.inspectionId)))blockers.push('MEASUREMENT_NOT_BOUND_TO_REVIEW');

  const reviewed={
    ...inspection,
    state: INSPECTION_STATE.POST_INSPECTION_REVIEW,
    postInspectionReview: {
      endedAt: at,
      reviewedByRef: reviewedByRef.trim(),
      reviewEvidenceRef: reviewEvidenceRef.trim(),
      acknowledgements: Object.freeze(Object.fromEntries(requiredAck.map((key) => [key, true]))),
      missingObservationCategories: Object.freeze(missingCategories),
      mediaIntegrityFailures: Object.freeze(mediaFailures.map((item) => item.mediaId)),
      measurementGateStatus: measurementGate?.status || null,
      measurementGateHashSha256:measurementGate?.measurementGateHashSha256??null,
      blockers: Object.freeze(blockers),
      readyToComplete: blockers.length === 0,
    },
  };
  return freeze({...reviewed,reviewBindingSha256:digest(reviewed)});
}

function completeInspection(inspection, { completedAt }) {
  if (inspection?.state !== INSPECTION_STATE.POST_INSPECTION_REVIEW || inspection.postInspectionReview?.readyToComplete !== true) {
    throw new TypeError('INSPECTION_COMPLETION_BLOCKED');
  }
  const {reviewBindingSha256,...reviewed}=inspection;
  if(reviewBindingSha256!==digest(reviewed))throw TypeError('INSPECTION_REVIEW_BINDING_INVALID');
  const at = iso(completedAt, 'completedAt');
  if (Date.parse(at) < Date.parse(inspection.postInspectionReview.endedAt)) throw new TypeError('INSPECTION_COMPLETION_TIMELINE_INVALID');
  return freeze({
    ...inspection,
    state: INSPECTION_STATE.COMPLETED,
    completedAt: at,
  });
}

function verifyCompletedInspection(inspection,measurementInputs){
 try{
  if(!inspection||inspection.state!==INSPECTION_STATE.COMPLETED||!Array.isArray(inspection.observations)||!Array.isArray(inspection.media)||inspection.observations.length>5000||inspection.media.length>5000)return false;
  let replay=createInspectionCase(inspection);
  replay=qualifyPreInspection(replay,inspection.preInspection);
  replay=startInspection(replay,inspection);
  for(const o of inspection.observations)replay=addInspectionObservation(replay,o);
  for(const m of inspection.media)replay=addInspectionMedia(replay,m);
  const measurementGate=reconcileMeasurementRecords(measurementInputs);
  replay=submitPostInspectionReview(replay,{...inspection.postInspectionReview,measurementGate,measurementInputs});
  replay=completeInspection(replay,inspection);
  return digest(replay)===digest(inspection);
 }catch{return false;}
}
module.exports = {
  INSPECTION_STATE,
  OBSERVATION_CATEGORY,
  MEDIA_MANIPULATION_STATUS,
  REQUIRED_OBSERVATION_CATEGORIES,
  createInspectionCase,
  qualifyPreInspection,
  startInspection,
  addInspectionObservation,
  createInspectionMediaRecord,
  addInspectionMedia,
  submitPostInspectionReview,
  completeInspection,
  verifyCompletedInspection,
};
