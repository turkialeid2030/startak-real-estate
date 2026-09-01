'use strict';

const { explicitTimezoneTimestamp } = require('./controlled-production-activation');

const PRODUCTION_FOLLOW_UP_ACTION_CLOSURE_STATUS = Object.freeze({
  READY_FOR_HUMAN_ACTION_CLOSURE_REVIEW: 'READY_FOR_HUMAN_ACTION_CLOSURE_REVIEW',
  HOLD_SCOPE: 'HOLD_SCOPE',
  HOLD_CONTINUITY_DECISION: 'HOLD_CONTINUITY_DECISION',
  HOLD_ACTION_COMPLETIONS: 'HOLD_ACTION_COMPLETIONS',
  HOLD_INCIDENTS: 'HOLD_INCIDENTS',
  HOLD_EVIDENCE_CHAIN: 'HOLD_EVIDENCE_CHAIN',
});

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function cleanRefs(refs) {
  return Array.isArray(refs) ? [...new Set(refs.filter(nonEmptyString).map((ref) => ref.trim()))] : [];
}

function hold(status, reasons, context = {}, diagnostics = {}) {
  return Object.freeze({
    schemaVersion: 1,
    caseId: context.caseId || null,
    projectId: context.projectId || null,
    status,
    reasons: Object.freeze(reasons),
    diagnostics: Object.freeze({ ...diagnostics }),
    allActionsCompleted: false,
    readyForHumanActionClosureReview: false,
    continuedProductionUseAuthorizedByThisModule: false,
    actionsClosedByThisModule: false,
    rollbackAuthorizedByThisModule: false,
    productionSecurityCertified: false,
    legalApprovalEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function summarizeIncidents(incidents) {
  if (!Array.isArray(incidents)) return null;
  let unresolvedBlocking = 0;
  let dataLeakage = 0;
  const normalized = [];
  for (const incident of incidents) {
    if (!incident || typeof incident !== 'object' || Array.isArray(incident)) return null;
    if (!nonEmptyString(incident.incidentId) || !nonEmptyString(incident.severity) || !nonEmptyString(incident.type)) return null;
    const severity = incident.severity.trim().toUpperCase();
    const type = incident.type.trim().toUpperCase();
    if (['HIGH', 'CRITICAL'].includes(severity) && incident.resolved !== true) unresolvedBlocking += 1;
    if (type === 'DATA_LEAKAGE') dataLeakage += 1;
    normalized.push(Object.freeze({
      incidentId: incident.incidentId.trim(),
      severity,
      type,
      resolved: incident.resolved === true,
      evidenceRef: nonEmptyString(incident.evidenceRef) ? incident.evidenceRef.trim() : null,
    }));
  }
  return Object.freeze({ total: normalized.length, unresolvedBlocking, dataLeakage, incidents: Object.freeze(normalized) });
}

function normalizeCompletions(actions, completions, decidedAt) {
  if (!Array.isArray(actions) || actions.length === 0 || !Array.isArray(completions)) return null;
  const actionById = new Map(actions.map((action) => [action.actionId, action]));
  if (actionById.size !== actions.length || completions.length !== actions.length) return null;

  const seen = new Set();
  const normalized = [];
  for (const completion of completions) {
    if (!completion || typeof completion !== 'object' || Array.isArray(completion)) return null;
    if (!nonEmptyString(completion.actionId)
        || !nonEmptyString(completion.ownerRef)
        || !nonEmptyString(completion.completedByRef)
        || !nonEmptyString(completion.completionEvidenceRef)
        || completion.completed !== true) return null;

    const actionId = completion.actionId.trim();
    if (seen.has(actionId) || !actionById.has(actionId)) return null;
    seen.add(actionId);

    const action = actionById.get(actionId);
    if (completion.ownerRef.trim() !== action.ownerRef) return null;

    const completedAt = explicitTimezoneTimestamp(completion.completedAt);
    const dueAt = explicitTimezoneTimestamp(action.dueAt);
    if (!completedAt || !dueAt || completedAt.epochMs < decidedAt.epochMs) return null;

    normalized.push(Object.freeze({
      actionId,
      ownerRef: action.ownerRef,
      completedByRef: completion.completedByRef.trim(),
      completedAt: completedAt.canonical,
      dueAt: dueAt.canonical,
      late: completedAt.epochMs > dueAt.epochMs,
      completionEvidenceRef: completion.completionEvidenceRef.trim(),
      originalActionEvidenceRef: action.actionEvidenceRef,
    }));
  }

  if (seen.size !== actionById.size) return null;
  return Object.freeze(normalized);
}

function buildProductionFollowUpActionClosureEvidence({
  caseId,
  projectId,
  continuityDecision,
  completions,
  incidents = [],
  evidenceRefs = [],
} = {}) {
  const context = { caseId, projectId };
  if (!nonEmptyString(caseId) || !nonEmptyString(projectId)) {
    return hold(PRODUCTION_FOLLOW_UP_ACTION_CLOSURE_STATUS.HOLD_SCOPE, ['caseId/projectId required'], context);
  }
  if (!continuityDecision
      || continuityDecision.caseId !== caseId
      || continuityDecision.projectId !== projectId) {
    return hold(PRODUCTION_FOLLOW_UP_ACTION_CLOSURE_STATUS.HOLD_SCOPE, ['continuity decision scope mismatch'], context);
  }

  const decisionReady =
    continuityDecision.status === 'DECISION_RECORDED' &&
    continuityDecision.humanContinuityDecisionRecorded === true &&
    continuityDecision.productionServiceContinuationApprovedByHuman === true &&
    continuityDecision.continuationActionsRemain === true &&
    continuityDecision.decision?.outcome === 'CONTINUE_WITH_ACTIONS' &&
    continuityDecision.continuedProductionUseAuthorizedByThisModule === false &&
    continuityDecision.rollbackExecuted === false &&
    continuityDecision.transactionAuthorized === false;
  if (!decisionReady) {
    return hold(PRODUCTION_FOLLOW_UP_ACTION_CLOSURE_STATUS.HOLD_CONTINUITY_DECISION, ['a bounded human CONTINUE_WITH_ACTIONS continuity decision is required'], context);
  }

  const decidedAt = explicitTimezoneTimestamp(continuityDecision.decision?.decidedAt);
  const actions = continuityDecision.decision?.actions || [];
  const normalizedCompletions = decidedAt ? normalizeCompletions(actions, completions, decidedAt) : null;
  if (!normalizedCompletions) {
    return hold(PRODUCTION_FOLLOW_UP_ACTION_CLOSURE_STATUS.HOLD_ACTION_COMPLETIONS, ['every declared follow-up action must have one matching human-attributed completion with explicit evidence and timestamp'], context);
  }

  const incidentSummary = summarizeIncidents(incidents);
  if (!incidentSummary || incidentSummary.unresolvedBlocking > 0 || incidentSummary.dataLeakage > 0) {
    return hold(PRODUCTION_FOLLOW_UP_ACTION_CLOSURE_STATUS.HOLD_INCIDENTS, ['unresolved HIGH/CRITICAL incidents or any recorded DATA_LEAKAGE incident require human intervention'], context, incidentSummary || {});
  }

  const suppliedRefs = cleanRefs(evidenceRefs);
  const requiredRefs = cleanRefs([
    ...(continuityDecision.evidenceRefs || []),
    continuityDecision.decision?.decidedByRef,
    continuityDecision.decision?.decisionEvidenceRef,
    ...actions.flatMap((action) => [action.ownerRef, action.actionEvidenceRef]),
    ...normalizedCompletions.flatMap((completion) => [completion.ownerRef, completion.completedByRef, completion.completionEvidenceRef]),
    ...incidentSummary.incidents.map((incident) => incident.evidenceRef),
  ]);
  const missingRefs = requiredRefs.filter((ref) => !suppliedRefs.includes(ref));
  if (!suppliedRefs.length || missingRefs.length) {
    return hold(PRODUCTION_FOLLOW_UP_ACTION_CLOSURE_STATUS.HOLD_EVIDENCE_CHAIN, ['follow-up action closure evidence chain is incomplete'], context, { missingRefCount: missingRefs.length });
  }

  const lateActionIds = normalizedCompletions.filter((completion) => completion.late).map((completion) => completion.actionId);

  return Object.freeze({
    schemaVersion: 1,
    caseId,
    projectId,
    status: PRODUCTION_FOLLOW_UP_ACTION_CLOSURE_STATUS.READY_FOR_HUMAN_ACTION_CLOSURE_REVIEW,
    reasons: Object.freeze([]),
    continuityDecision: Object.freeze({
      decisionId: continuityDecision.decision.decisionId,
      decidedAt: continuityDecision.decision.decidedAt,
      decidedByRef: continuityDecision.decision.decidedByRef,
    }),
    completions: normalizedCompletions,
    incidentSummary,
    diagnostics: Object.freeze({
      actionCount: actions.length,
      completedActionCount: normalizedCompletions.length,
      lateActionIds: Object.freeze(lateActionIds),
    }),
    evidenceRefs: Object.freeze(suppliedRefs),
    allActionsCompleted: true,
    readyForHumanActionClosureReview: true,
    continuedProductionUseAuthorizedByThisModule: false,
    actionsClosedByThisModule: false,
    rollbackAuthorizedByThisModule: false,
    productionSecurityCertified: false,
    legalApprovalEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'READY_FOR_HUMAN_ACTION_CLOSURE_REVIEW means all caller-supplied follow-up action completion, incident, timing, ownership, and evidence-chain checks are complete. Late completions are surfaced but no grace period or automatic closure is invented. A separate accountable human closure decision remains required; this module does not independently authorize continued production use, close actions, execute rollback, certify security/legal/valuation status, or authorize an investment transaction.',
  });
}

module.exports = {
  PRODUCTION_FOLLOW_UP_ACTION_CLOSURE_STATUS,
  buildProductionFollowUpActionClosureEvidence,
};
