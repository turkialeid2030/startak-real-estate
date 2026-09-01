'use strict';

const OUTCOME_FEEDBACK_STATUS = Object.freeze({
  READY_FOR_REVIEW: 'READY_FOR_REVIEW',
  HOLD_SCOPE_MISMATCH: 'HOLD_SCOPE_MISMATCH',
  HOLD_DECISION_RECORD: 'HOLD_DECISION_RECORD',
  HOLD_OUTCOME_EVIDENCE: 'HOLD_OUTCOME_EVIDENCE',
});

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function requiredObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}

function buildOutcomeFeedback({
  caseId,
  projectId,
  decisionRecord,
  outcomeSnapshot,
  comparisonItems = [],
} = {}) {
  const scopedCaseId = requiredString(caseId, 'caseId');
  const scopedProjectId = requiredString(projectId, 'projectId');
  requiredObject(decisionRecord, 'decisionRecord');
  requiredObject(outcomeSnapshot, 'outcomeSnapshot');
  if (!Array.isArray(comparisonItems)) throw new TypeError('comparisonItems must be an array');

  for (const [name, value] of Object.entries({ decisionRecord, outcomeSnapshot })) {
    if (value.caseId !== scopedCaseId || value.projectId !== scopedProjectId) {
      const error = new Error(`${name.toUpperCase()}_SCOPE_MISMATCH`);
      error.code = OUTCOME_FEEDBACK_STATUS.HOLD_SCOPE_MISMATCH;
      throw error;
    }
  }

  if (decisionRecord.humanDecisionConfirmed !== true) {
    return Object.freeze({
      schemaVersion: 1,
      caseId: scopedCaseId,
      projectId: scopedProjectId,
      status: OUTCOME_FEEDBACK_STATUS.HOLD_DECISION_RECORD,
      reasonCodes: Object.freeze(['HUMAN_DECISION_RECORD_REQUIRED']),
      reanalysisRequired: false,
      transactionAuthorized: false,
    });
  }

  if (outcomeSnapshot.verified !== true || !outcomeSnapshot.evidenceRef) {
    return Object.freeze({
      schemaVersion: 1,
      caseId: scopedCaseId,
      projectId: scopedProjectId,
      status: OUTCOME_FEEDBACK_STATUS.HOLD_OUTCOME_EVIDENCE,
      reasonCodes: Object.freeze(['VERIFIED_OUTCOME_EVIDENCE_REQUIRED']),
      reanalysisRequired: false,
      transactionAuthorized: false,
    });
  }

  const normalized = comparisonItems.map((item, index) => {
    requiredObject(item, `comparisonItems[${index}]`);
    return Object.freeze({
      id: requiredString(item.id, `comparisonItems[${index}].id`),
      label: requiredString(item.label, `comparisonItems[${index}].label`),
      plannedValue: item.plannedValue == null ? null : item.plannedValue,
      actualValue: item.actualValue == null ? null : item.actualValue,
      materialVariance: item.materialVariance === true,
      explanation: item.explanation == null ? null : String(item.explanation),
      evidenceRef: item.evidenceRef == null ? null : String(item.evidenceRef),
    });
  });

  const duplicateIds = normalized.map((item) => item.id).filter((id, index, ids) => ids.indexOf(id) !== index);
  if (duplicateIds.length) throw new Error(`DUPLICATE_OUTCOME_COMPARISON_ID: ${[...new Set(duplicateIds)].join(',')}`);

  const materialVariances = normalized.filter((item) => item.materialVariance);
  const reanalysisRequired = materialVariances.length > 0 || outcomeSnapshot.upstreamEvidenceChanged === true;

  return Object.freeze({
    schemaVersion: 1,
    caseId: scopedCaseId,
    projectId: scopedProjectId,
    status: OUTCOME_FEEDBACK_STATUS.READY_FOR_REVIEW,
    decisionRef: decisionRecord.dossierRef || null,
    decision: decisionRecord.decision || null,
    outcomeSnapshot: Object.freeze({
      observedAt: outcomeSnapshot.observedAt || null,
      evidenceRef: String(outcomeSnapshot.evidenceRef),
      upstreamEvidenceChanged: outcomeSnapshot.upstreamEvidenceChanged === true,
    }),
    comparisons: Object.freeze(normalized),
    materialVarianceCount: materialVariances.length,
    materialVarianceIds: Object.freeze(materialVariances.map((item) => item.id)),
    reanalysisRequired,
    requiredActions: Object.freeze({
      refreshEvidenceReconciliation: outcomeSnapshot.upstreamEvidenceChanged === true,
      refreshFinancialAnalysis: materialVariances.length > 0,
      refreshDecisionQuality: reanalysisRequired,
      refreshAiDossier: reanalysisRequired,
      humanReviewRequired: true,
    }),
    automatedDecisionReversal: false,
    humanReviewRequired: true,
    transactionAuthorized: false,
    semantics: 'Outcome feedback compares caller-supplied planned and verified actual observations. It does not infer causality, rewrite prior committee decisions, or authorize a transaction; material variance only triggers controlled reanalysis.',
  });
}

module.exports = {
  OUTCOME_FEEDBACK_STATUS,
  buildOutcomeFeedback,
};
