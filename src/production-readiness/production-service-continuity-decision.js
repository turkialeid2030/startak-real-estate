'use strict';

const { explicitTimezoneTimestamp } = require('./controlled-production-activation');

const PRODUCTION_SERVICE_CONTINUITY_OUTCOME = Object.freeze({
  CONTINUE_SERVICE: 'CONTINUE_SERVICE',
  CONTINUE_WITH_ACTIONS: 'CONTINUE_WITH_ACTIONS',
  HOLD_SERVICE: 'HOLD_SERVICE',
  REQUIRE_ROLLBACK: 'REQUIRE_ROLLBACK',
});

const PRODUCTION_SERVICE_CONTINUITY_DECISION_STATUS = Object.freeze({
  DECISION_RECORDED: 'DECISION_RECORDED',
  HOLD_SCOPE: 'HOLD_SCOPE',
  HOLD_CONTINUITY_EVIDENCE: 'HOLD_CONTINUITY_EVIDENCE',
  HOLD_DECISION_METADATA: 'HOLD_DECISION_METADATA',
  HOLD_TIMELINE: 'HOLD_TIMELINE',
  HOLD_ACKNOWLEDGEMENTS: 'HOLD_ACKNOWLEDGEMENTS',
  HOLD_ACTIONS: 'HOLD_ACTIONS',
  HOLD_EVIDENCE_CHAIN: 'HOLD_EVIDENCE_CHAIN',
});

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function cleanRefs(refs) {
  return Array.isArray(refs) ? [...new Set(refs.filter(nonEmptyString).map((ref) => ref.trim()))] : [];
}

function hold(status, reasons, context = {}) {
  return Object.freeze({
    schemaVersion: 1,
    caseId: context.caseId || null,
    projectId: context.projectId || null,
    status,
    reasons: Object.freeze(reasons),
    humanContinuityDecisionRecorded: false,
    productionServiceContinuationApprovedByHuman: false,
    rollbackRequiredByHuman: false,
    continuedProductionUseAuthorizedByThisModule: false,
    rollbackExecuted: false,
    productionSecurityCertified: false,
    legalApprovalEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function normalizeActions(actions, decidedAt) {
  if (!Array.isArray(actions)) return null;
  const ids = new Set();
  const normalized = [];
  for (const action of actions) {
    if (!action || typeof action !== 'object' || Array.isArray(action)) return null;
    if (!nonEmptyString(action.actionId)
        || !nonEmptyString(action.description)
        || !nonEmptyString(action.ownerRef)
        || !nonEmptyString(action.actionEvidenceRef)) return null;
    const actionId = action.actionId.trim();
    if (ids.has(actionId)) return null;
    ids.add(actionId);
    const dueAt = explicitTimezoneTimestamp(action.dueAt);
    if (!dueAt || dueAt.epochMs < decidedAt.epochMs) return null;
    normalized.push(Object.freeze({
      actionId,
      description: action.description.trim(),
      ownerRef: action.ownerRef.trim(),
      dueAt: dueAt.canonical,
      actionEvidenceRef: action.actionEvidenceRef.trim(),
      requiresFollowUpEvidence: action.requiresFollowUpEvidence !== false,
    }));
  }
  return Object.freeze(normalized);
}

function recordProductionServiceContinuityDecision({
  caseId,
  projectId,
  continuityEvidence,
  decision,
  evidenceRefs = [],
} = {}) {
  const context = { caseId, projectId };
  if (!nonEmptyString(caseId) || !nonEmptyString(projectId)) {
    return hold(PRODUCTION_SERVICE_CONTINUITY_DECISION_STATUS.HOLD_SCOPE, ['caseId/projectId required'], context);
  }
  if (!continuityEvidence
      || continuityEvidence.caseId !== caseId
      || continuityEvidence.projectId !== projectId) {
    return hold(PRODUCTION_SERVICE_CONTINUITY_DECISION_STATUS.HOLD_SCOPE, ['continuity evidence scope mismatch'], context);
  }

  const continuityReady =
    continuityEvidence.status === 'READY_FOR_HUMAN_CONTINUITY_REVIEW' &&
    continuityEvidence.readyForHumanContinuityReview === true &&
    continuityEvidence.continuedProductionUseAuthorizedByThisModule === false &&
    continuityEvidence.rollbackAuthorizedByThisModule === false &&
    continuityEvidence.transactionAuthorized === false;
  if (!continuityReady) {
    return hold(PRODUCTION_SERVICE_CONTINUITY_DECISION_STATUS.HOLD_CONTINUITY_EVIDENCE, ['complete bounded continuity evidence is required before a human continuity decision'], context);
  }

  const decidedAt = explicitTimezoneTimestamp(decision?.decidedAt);
  const metadataValid =
    decision &&
    nonEmptyString(decision.decisionId) &&
    nonEmptyString(decision.decidedByRef) &&
    nonEmptyString(decision.decisionEvidenceRef) &&
    decidedAt &&
    Object.values(PRODUCTION_SERVICE_CONTINUITY_OUTCOME).includes(decision.outcome) &&
    decision.conflictDeclarationCompleted === true;
  if (!metadataValid) {
    return hold(PRODUCTION_SERVICE_CONTINUITY_DECISION_STATUS.HOLD_DECISION_METADATA, ['human continuity decision identity, outcome, timezone-explicit timestamp, conflict declaration, and evidence reference are required'], context);
  }

  const windowEndsAt = explicitTimezoneTimestamp(continuityEvidence.observationWindow?.endsAt);
  if (!windowEndsAt || decidedAt.epochMs < windowEndsAt.epochMs) {
    return hold(PRODUCTION_SERVICE_CONTINUITY_DECISION_STATUS.HOLD_TIMELINE, ['human continuity decision must occur at or after the continuity observation window ends'], context);
  }

  const acknowledgements = decision.acknowledgements || {};
  const acknowledgementKeys = [
    'monitoringPolicyReviewed',
    'requiredObservationsReviewed',
    'monitoringConditionsReviewed',
    'incidentSummaryReviewed',
    'rollbackReadinessReviewed',
    'humanAccountabilityAccepted',
  ];
  if (!acknowledgementKeys.every((key) => acknowledgements[key] === true)) {
    return hold(PRODUCTION_SERVICE_CONTINUITY_DECISION_STATUS.HOLD_ACKNOWLEDGEMENTS, ['all continuity-review acknowledgements are required'], context);
  }

  const normalizedActions = normalizeActions(decision.actions || [], decidedAt);
  if (normalizedActions === null) {
    return hold(PRODUCTION_SERVICE_CONTINUITY_DECISION_STATUS.HOLD_ACTIONS, ['continuity actions must be unique, human-owned, evidenced, and have timezone-explicit due dates at or after the decision time'], context);
  }
  if (decision.outcome === PRODUCTION_SERVICE_CONTINUITY_OUTCOME.CONTINUE_WITH_ACTIONS && normalizedActions.length === 0) {
    return hold(PRODUCTION_SERVICE_CONTINUITY_DECISION_STATUS.HOLD_ACTIONS, ['CONTINUE_WITH_ACTIONS requires at least one explicit follow-up action'], context);
  }
  if (decision.outcome === PRODUCTION_SERVICE_CONTINUITY_OUTCOME.CONTINUE_SERVICE && normalizedActions.length > 0) {
    return hold(PRODUCTION_SERVICE_CONTINUITY_DECISION_STATUS.HOLD_ACTIONS, ['unconditional CONTINUE_SERVICE cannot carry hidden follow-up actions'], context);
  }
  if ([PRODUCTION_SERVICE_CONTINUITY_OUTCOME.HOLD_SERVICE, PRODUCTION_SERVICE_CONTINUITY_OUTCOME.REQUIRE_ROLLBACK].includes(decision.outcome)
      && normalizedActions.length > 0) {
    return hold(PRODUCTION_SERVICE_CONTINUITY_DECISION_STATUS.HOLD_ACTIONS, ['hold/rollback outcomes cannot be represented as continuation-with-actions'], context);
  }

  const suppliedRefs = cleanRefs(evidenceRefs);
  const requiredRefs = cleanRefs([
    ...(continuityEvidence.evidenceRefs || []),
    decision.decidedByRef,
    decision.decisionEvidenceRef,
    ...normalizedActions.flatMap((action) => [action.ownerRef, action.actionEvidenceRef]),
  ]);
  const missingRefs = requiredRefs.filter((ref) => !suppliedRefs.includes(ref));
  if (!suppliedRefs.length || missingRefs.length) {
    return hold(PRODUCTION_SERVICE_CONTINUITY_DECISION_STATUS.HOLD_EVIDENCE_CHAIN, ['human continuity-decision evidence chain is incomplete'], context);
  }

  const continuationApproved = [
    PRODUCTION_SERVICE_CONTINUITY_OUTCOME.CONTINUE_SERVICE,
    PRODUCTION_SERVICE_CONTINUITY_OUTCOME.CONTINUE_WITH_ACTIONS,
  ].includes(decision.outcome);
  const rollbackRequired = decision.outcome === PRODUCTION_SERVICE_CONTINUITY_OUTCOME.REQUIRE_ROLLBACK;

  return Object.freeze({
    schemaVersion: 1,
    caseId,
    projectId,
    status: PRODUCTION_SERVICE_CONTINUITY_DECISION_STATUS.DECISION_RECORDED,
    reasons: Object.freeze([]),
    decision: Object.freeze({
      decisionId: decision.decisionId.trim(),
      outcome: decision.outcome,
      decidedByRef: decision.decidedByRef.trim(),
      decidedAt: decidedAt.canonical,
      decisionEvidenceRef: decision.decisionEvidenceRef.trim(),
      conflictDeclarationCompleted: true,
      acknowledgements: Object.freeze(Object.fromEntries(acknowledgementKeys.map((key) => [key, true]))),
      actions: normalizedActions,
    }),
    evidenceRefs: Object.freeze(suppliedRefs),
    humanContinuityDecisionRecorded: true,
    productionServiceContinuationApprovedByHuman: continuationApproved,
    continuationActionsRemain: decision.outcome === PRODUCTION_SERVICE_CONTINUITY_OUTCOME.CONTINUE_WITH_ACTIONS,
    serviceHoldRequiredByHuman: decision.outcome === PRODUCTION_SERVICE_CONTINUITY_OUTCOME.HOLD_SERVICE,
    rollbackRequiredByHuman: rollbackRequired,
    continuedProductionUseAuthorizedByThisModule: false,
    rollbackExecuted: false,
    productionSecurityCertified: false,
    legalApprovalEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'DECISION_RECORDED preserves an explicit human continuity outcome after bounded continuity evidence review. CONTINUE outcomes record human operational approval; the software itself does not independently authorize production use, execute rollback, certify security/legal/valuation status, or authorize an investment transaction. HOLD_SERVICE and REQUIRE_ROLLBACK remain explicit human operational outcomes requiring separate controlled execution where applicable.',
  });
}

module.exports = {
  PRODUCTION_SERVICE_CONTINUITY_OUTCOME,
  PRODUCTION_SERVICE_CONTINUITY_DECISION_STATUS,
  recordProductionServiceContinuityDecision,
};
