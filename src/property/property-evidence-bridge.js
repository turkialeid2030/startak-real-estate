'use strict';

const crypto = require('crypto');
const {
  ASSIGNMENT_STATUS,
  evaluateProfessionalAssignment,
} = require('../valuation/professional-assignment');
const {
  ADMISSIBILITY_TARGET,
  ADMISSIBILITY_STATUS,
  assessProfessionalEvidenceAdmissibility,
} = require('../document-intelligence/professional-evidence-chain');
const {
  PROPERTY_DATA_GATE_STATUS,
  evaluateMaterialPropertyDataConflicts,
} = require('../document-intelligence/property-data-conflict-gate');
const {
  INSPECTION_STATE,
  REQUIRED_OBSERVATION_CATEGORIES,
  MEDIA_MANIPULATION_STATUS,
} = require('../inspection/inspection-lifecycle');
const {
  MEASUREMENT_RECONCILIATION_STATUS,
  reconcileMeasurementRecords,
} = require('../inspection/measurement-governance');

const PROPERTY_EVIDENCE_PACKET_STATUS = Object.freeze({
  READY_FOR_PROFESSIONAL_VALUATION_WORKFLOW: 'READY_FOR_PROFESSIONAL_VALUATION_WORKFLOW',
  HOLD_ASSIGNMENT: 'HOLD_ASSIGNMENT',
  HOLD_INSPECTION: 'HOLD_INSPECTION',
  HOLD_MEASUREMENT: 'HOLD_MEASUREMENT',
  HOLD_EVIDENCE: 'HOLD_EVIDENCE',
  MATERIAL_PROPERTY_DATA_CONFLICT: 'MATERIAL_PROPERTY_DATA_CONFLICT',
});

const PROPERTY_FACT_CLASS = Object.freeze({
  VERIFIED_FACT: 'VERIFIED_FACT',
  PROFESSIONAL_MEASUREMENT: 'PROFESSIONAL_MEASUREMENT',
});

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertNonEmpty(value, field) {
  if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`);
}

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = stableClone(value[key]);
    return out;
  }, {});
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function hold(status, reasons, context = {}) {
  return deepFreeze({
    schemaVersion: 1,
    status,
    reasons,
    caseId: context.caseId || null,
    propertyRef: context.propertyRef || null,
    professionalValuationWorkflowReady: false,
    automaticUnderwritingAdoption: false,
    financialEngineInputsWritten: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function completedInspectionIntegrityReasons(inspection) {
  const reasons = [];
  if (inspection?.state !== INSPECTION_STATE.COMPLETED) reasons.push('PROFESSIONAL_INSPECTION_NOT_COMPLETED');
  if (!nonEmpty(inspection?.completedAt)) reasons.push('INSPECTION_COMPLETION_TIMESTAMP_MISSING');
  if (inspection?.postInspectionReview?.readyToComplete !== true) reasons.push('POST_INSPECTION_REVIEW_NOT_CLEARED');
  if (!Array.isArray(inspection?.postInspectionReview?.blockers) || inspection.postInspectionReview.blockers.length !== 0) {
    reasons.push('POST_INSPECTION_BLOCKERS_PRESENT');
  }
  const categories = new Set((Array.isArray(inspection?.observations) ? inspection.observations : []).map((item) => item?.category));
  const missing = REQUIRED_OBSERVATION_CATEGORIES.filter((category) => !categories.has(category));
  if (missing.length) reasons.push(`INSPECTION_OBSERVATIONS_INCOMPLETE:${missing.join(',')}`);
  const media = Array.isArray(inspection?.media) ? inspection.media : [];
  if (!media.length) reasons.push('INSPECTION_MEDIA_REQUIRED');
  if (media.some((item) => item?.manipulationStatus !== MEDIA_MANIPULATION_STATUS.PASS)) reasons.push('INSPECTION_MEDIA_INTEGRITY_NOT_CLEARED');
  return reasons;
}

function projectVerifiedEvidenceFact(record) {
  const fact = record.fact;
  return {
    class: PROPERTY_FACT_CLASS.VERIFIED_FACT,
    factId: fact.factId,
    key: fact.key,
    normalizedValue: fact.normalizedValue,
    valueType: fact.valueType,
    unit: fact.unit ?? null,
    sourceRole: record.sourceRole,
    documentId: fact.documentId,
    documentHashSha256: fact.documentHashSha256,
    sourceLocator: fact.sourceLocator,
    extractionMethod: fact.extraction?.method || null,
    extractionConfidence: fact.extraction?.confidence ?? null,
    verificationReference: fact.verification?.reference || null,
    verifiedAt: fact.verification?.verifiedAt || null,
    authorityClass: fact.authorityClass || null,
    authorityVerified: Boolean(fact.authorityVerified),
    evidenceLink: record.evidenceLink,
    chainHashSha256: record.chainHashSha256,
    professionalReviewRef: record.professionalReview?.reviewEvidenceRef || null,
  };
}

function projectMeasurement(record) {
  return {
    class: PROPERTY_FACT_CLASS.PROFESSIONAL_MEASUREMENT,
    measurementId: record.measurementId,
    type: record.type,
    value: record.value,
    unit: record.unit,
    source: record.source,
    sourceEvidenceRef: record.sourceEvidenceRef,
    measurementStandardRef: record.measurementStandardRef,
    measurementMethod: record.measurementMethod,
    measuredByRef: record.measuredByRef,
    measuredAt: record.measuredAt,
    measurementHashSha256: record.measurementHashSha256,
  };
}

function buildPropertyEvidencePacket({
  caseId,
  propertyRef,
  assignmentRef,
  assignment,
  inspection,
  evidenceRecords,
  measurementRecords,
  materialPropertyKeys,
  materialMeasurementTypes,
  evidenceToleranceByKey = {},
  measurementToleranceByType = {},
  minimumPropertySourceRoles = 1,
  minimumMeasurementSourcesByType = {},
} = {}) {
  assertNonEmpty(caseId, 'caseId');
  assertNonEmpty(propertyRef, 'propertyRef');
  assertNonEmpty(assignmentRef, 'assignmentRef');
  if (!assignment || typeof assignment !== 'object') throw new TypeError('assignment is required');
  if (!inspection || typeof inspection !== 'object') throw new TypeError('inspection is required');
  if (!Array.isArray(evidenceRecords)) throw new TypeError('evidenceRecords must be an array');
  if (!Array.isArray(measurementRecords)) throw new TypeError('measurementRecords must be an array');
  if (!Array.isArray(materialPropertyKeys) || materialPropertyKeys.length === 0) throw new TypeError('materialPropertyKeys must be a non-empty array');
  if (!Array.isArray(materialMeasurementTypes) || materialMeasurementTypes.length === 0) throw new TypeError('materialMeasurementTypes must be a non-empty array');

  if (inspection.caseId !== caseId || inspection.propertyRef !== propertyRef) {
    throw new TypeError('PROPERTY_CASE_ISOLATION_VIOLATION: inspection does not match packet case/property');
  }
  for (const record of evidenceRecords) {
    if (!record || record.caseId !== caseId || record.fact?.caseId !== caseId) {
      throw new TypeError('PROPERTY_CASE_ISOLATION_VIOLATION: evidence record does not match packet case');
    }
  }
  for (const record of measurementRecords) {
    if (!record || record.caseId !== caseId) {
      throw new TypeError('PROPERTY_CASE_ISOLATION_VIOLATION: measurement record does not match packet case');
    }
  }

  const assignmentEvaluation = evaluateProfessionalAssignment(assignment);
  const assignmentAllowed = assignmentEvaluation.status === ASSIGNMENT_STATUS.READY_FOR_STANDARDS_ROUTING;
  if (!assignmentAllowed) {
    return hold(PROPERTY_EVIDENCE_PACKET_STATUS.HOLD_ASSIGNMENT, [assignmentEvaluation.status], { caseId, propertyRef });
  }

  const inspectionReasons = completedInspectionIntegrityReasons(inspection);
  if (inspectionReasons.length) {
    return hold(PROPERTY_EVIDENCE_PACKET_STATUS.HOLD_INSPECTION, inspectionReasons, { caseId, propertyRef });
  }

  const measurementGate = reconcileMeasurementRecords({
    caseId,
    records: measurementRecords,
    materialTypes: materialMeasurementTypes,
    toleranceByType: measurementToleranceByType,
    minimumIndependentSourcesByType: minimumMeasurementSourcesByType,
  });
  if (measurementGate.status !== MEASUREMENT_RECONCILIATION_STATUS.CLEAR) {
    return hold(PROPERTY_EVIDENCE_PACKET_STATUS.HOLD_MEASUREMENT, [measurementGate.status], { caseId, propertyRef });
  }

  const inadmissibleEvidence = [];
  const verifiedEvidenceRecords = [];
  for (const record of evidenceRecords) {
    const result = assessProfessionalEvidenceAdmissibility({
      record,
      target: ADMISSIBILITY_TARGET.PROFESSIONAL_REPORT,
    });
    if (result.status !== ADMISSIBILITY_STATUS.READY) {
      inadmissibleEvidence.push({ recordId: record.recordId || null, status: result.status, reasons: result.reasons || [] });
    } else {
      verifiedEvidenceRecords.push(record);
    }
  }
  if (inadmissibleEvidence.length) {
    return hold(PROPERTY_EVIDENCE_PACKET_STATUS.HOLD_EVIDENCE, inadmissibleEvidence.map((item) => `EVIDENCE_NOT_ADMISSIBLE:${item.recordId || 'UNKNOWN'}:${item.status}`), { caseId, propertyRef });
  }

  const propertyDataGate = evaluateMaterialPropertyDataConflicts({
    caseId,
    evidenceRecords: verifiedEvidenceRecords,
    materialKeys: materialPropertyKeys,
    numericToleranceByKey: evidenceToleranceByKey,
    minimumIndependentSourceRoles: minimumPropertySourceRoles,
  });
  if (propertyDataGate.status === PROPERTY_DATA_GATE_STATUS.MATERIAL_PROPERTY_DATA_CONFLICT) {
    return hold(PROPERTY_EVIDENCE_PACKET_STATUS.MATERIAL_PROPERTY_DATA_CONFLICT, propertyDataGate.conflicts.map((item) => `${item.code}:${item.key}`), { caseId, propertyRef });
  }
  if (propertyDataGate.status !== PROPERTY_DATA_GATE_STATUS.CLEAR) {
    return hold(PROPERTY_EVIDENCE_PACKET_STATUS.HOLD_EVIDENCE, [propertyDataGate.status], { caseId, propertyRef });
  }

  const evidenceFacts = verifiedEvidenceRecords.map(projectVerifiedEvidenceFact);
  const measurements = measurementRecords.map(projectMeasurement);
  const assignmentHashSha256 = hash(assignment);
  const inspectionHashSha256 = hash({
    inspectionId: inspection.inspectionId,
    caseId: inspection.caseId,
    propertyRef: inspection.propertyRef,
    valuationDate: inspection.valuationDate,
    completedAt: inspection.completedAt,
    observations: inspection.observations,
    media: inspection.media,
    postInspectionReview: inspection.postInspectionReview,
  });

  const packetCore = {
    schemaVersion: 1,
    caseId,
    propertyRef,
    assignmentRef,
    assignmentHashSha256,
    inspectionId: inspection.inspectionId,
    inspectionHashSha256,
    valuationDate: assignment.valuation_date,
    reportDate: assignment.report_date,
    jurisdiction: assignment.asset.jurisdiction,
    assetType: assignment.asset.type,
    assetLocation: assignment.asset.location,
    valuedRights: assignment.rights,
    basisOfValue: assignment.basis,
    purpose: assignment.purpose,
    evidenceFacts,
    measurements,
    propertyDataGateStatus: propertyDataGate.status,
    measurementGateStatus: measurementGate.status,
  };

  return deepFreeze({
    ...packetCore,
    packetHashSha256: hash(packetCore),
    status: PROPERTY_EVIDENCE_PACKET_STATUS.READY_FOR_PROFESSIONAL_VALUATION_WORKFLOW,
    reasons: [],
    professionalValuationWorkflowReady: true,
    automaticUnderwritingAdoption: false,
    financialEngineInputsWritten: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'This packet is an immutable, evidence-linked property-workflow handoff. It binds assignment, completed inspection, verified professional evidence and reconciled measurements. It does not write financial-engine inputs, establish legal title validity, certify a valuation, or authorize a transaction.',
  });
}

module.exports = {
  PROPERTY_EVIDENCE_PACKET_STATUS,
  PROPERTY_FACT_CLASS,
  completedInspectionIntegrityReasons,
  buildPropertyEvidencePacket,
};
