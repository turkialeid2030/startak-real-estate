'use strict';

const { explicitTimezoneTimestamp } = require('./controlled-production-activation');

const FOLLOW_UP_ACTION_CLOSURE_OUTCOME = Object.freeze({
  CLOSE_ACTIONS: 'CLOSE_ACTIONS',
  CLOSE_WITH_RESIDUAL_RISK: 'CLOSE_WITH_RESIDUAL_RISK',
  HOLD_SERVICE: 'HOLD_SERVICE',
  REQUIRE_ROLLBACK: 'REQUIRE_ROLLBACK',
});

const FOLLOW_UP_ACTION_CLOSURE_DECISION_STATUS = Object.freeze({
  DECISION_RECORDED: 'DECISION_RECORDED',
  HOLD_SCOPE: 'HOLD_SCOPE',
  HOLD_CLOSURE_EVIDENCE: 'HOLD_CLOSURE_EVIDENCE',
  HOLD_DECISION_METADATA: 'HOLD_DECISION_METADATA',
  HOLD_TIMELINE: 'HOLD_TIMELINE',
  HOLD_ACKNOWLEDGEMENTS: 'HOLD_ACKNOWLEDGEMENTS',
  HOLD_RESIDUAL_RISKS: 'HOLD_RESIDUAL_RISKS',
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
    humanActionClosureDecisionRecorded: false,
    actionsClosedByHuman: false,
    residualRiskAcceptedByHuman: false,
    serviceHoldRequiredByHuman: false,
    rollbackRequiredByHuman: false,
    continuedProductionUseAuthorizedByThisModule: false,
    rollbackExecuted: false,
    productionSecurityCertified: false,
    legalApprovalEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function normalizeResidualRisks(items) {
  if (!Array.isArray(items)) return null;
  const ids = new Set();
  const out = [];
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    if (!nonEmptyString(item.riskId)
        || !nonEmptyString(item.description)
        || !nonEmptyString(item.ownerRef)
        || !nonEmptyString(item.riskEvidenceRef)) return null;
    const riskId = item.riskId.trim();
    if (ids.has(riskId)) return null;
    ids.add(riskId);
    out.push(Object.freeze({
      riskId,
      description: item.description.trim(),
      ownerRef: item.ownerRef.trim(),
      riskEvidenceRef: item.riskEvidenceRef.trim(),
      monitoringRequired: item.monitoringRequired !== false,
    }));
  }
  return Object.freeze(out);
}

function recordProductionFollowUpActionClosureDecision({
  caseId,
  projectId,
  actionClosureEvidence,
  decision,
  evidenceRefs = [],
} = {}) {
  const context = { caseId, projectId };
  if (!nonEmptyString(caseId) || !nonEmptyString(projectId)) {
    return hold(FOLLOW_UP_ACTION_CLOSURE_DECISION_STATUS.HOLD_SCOPE, ['caseId/projectId required'], context);
  }
  if (!actionClosureEvidence
      || actionClosureEvidence.caseId !== caseId
      || actionClosureEvidence.projectId !== projectId) {
    return hold(FOLLOW_UP_ACTION_CLOSURE_DECISION_STATUS.HOLD_SCOPE, ['action-closure evidence scope mismatch'], context);
  }

  const closureReady =
    actionClosureEvidence.status === 'READY_FOR_HUMAN_ACTION_CLOSURE_REVIEW' &&
    actionClosureEvidence.allActionsCompleted === true &&
    actionClosureEvidence.readyForHumanActionClosureReview === true &&
    actionClosureEvidence.actionsClosedByThisModule === false &&
    actionClosureEvidence.continuedProductionUseAuthorizedByThisModule === false &&
    actionClosureEvidence.rollbackAuthorizedByThisModule === false &&
    actionClosureEvidence.transactionAuthorized === false;
  if (!closureReady) {
    return hold(FOLLOW_UP_ACTION_CLOSURE_DECISION_STATUS.HOLD_CLOSURE_EVIDENCE, ['complete bounded follow-up action closure evidence is required'], context);
  }

  const decidedAt = explicitTimezoneTimestamp(decision?.decidedAt);
  const metadataValid =
    decision &&
    nonEmptyString(decision.decisionId) &&
    nonEmptyString(decision.decidedByRef) &&
    nonEmptyString(decision.decisionEvidenceRef) &&
    decidedAt &&
    Object.values(FOLLOW_UP_ACTION_CLOSURE_OUTCOME).includes(decision.outcome) &&
    decision.conflictDeclarationCompleted === true;
  if (!metadataValid) {
    return hold(FOLLOW_UP_ACTION_CLOSURE_DECISION_STATUS.HOLD_DECISION_METADATA, ['human action-closure decision identity, outcome, timestamp, conflict declaration, and evidence reference are required'], context);
  }

  const completionTimes = (actionClosureEvidence.completions || [])
    .map((item) => explicitTimezoneTimestamp(item.completedAt))
    .filter(Boolean)
    .map((item) => item.epochMs);
  if (completionTimes.length !== actionClosureEvidence.completions.length
      || (completionTimes.length > 0 && decidedAt.epochMs < Math.max(...completionTimes))) {
    return hold(FOLLOW_UP_ACTION_CLOSURE_DECISION_STATUS.HOLD_TIMELINE, ['human action-closure decision must occur at or after all completion evidence timestamps'], context);
  }

  const acknowledgements = decision.acknowledgements || {};
  const acknowledgementKeys = [
    'actionCompletionEvidenceReviewed',
    'lateActionsReviewed',
    'incidentSummaryReviewed',
    'evidenceChainReviewed',
    'humanAccountabilityAccepted',
  ];
  if (!acknowledgementKeys.every((key) => acknowledgements[key] === true)) {
    return hold(FOLLOW_UP_ACTION_CLOSURE_DECISION_STATUS.HOLD_ACKNOWLEDGEMENTS, ['all human action-closure acknowledgements are required'], context);
  }

  const residualRisks = normalizeResidualRisks(decision.residualRisks || []);
  if (residualRisks === null) {
    return hold(FOLLOW_UP_ACTION_CLOSURE_DECISION_STATUS.HOLD_RESIDUAL_RISKS, ['residual risks must be unique, human-owned, described, and evidenced'], context);
  }
  if (decision.outcome === FOLLOW_UP_ACTION_CLOSURE_OUTCOME.CLOSE_WITH_RESIDUAL_RISK && residualRisks.length === 0) {
    return hold(FOLLOW_UP_ACTION_CLOSURE_DECISION_STATUS.HOLD_RESIDUAL_RISKS, ['CLOSE_WITH_RESIDUAL_RISK requires at least one explicit residual risk'], context);
  }
  if (decision.outcome === FOLLOW_UP_ACTION_CLOSURE_OUTCOME.CLOSE_ACTIONS && residualRisks.length > 0) {
    return hold(FOLLOW_UP_ACTION_CLOSURE_DECISION_STATUS.HOLD_RESIDUAL_RISKS, ['unconditional CLOSE_ACTIONS cannot carry hidden residual risks'], context);
  }
  if ([FOLLOW_UP_ACTION_CLOSURE_OUTCOME.HOLD_SERVICE, FOLLOW_UP_ACTION_CLOSURE_OUTCOME.REQUIRE_ROLLBACK].includes(decision.outcome)
      && residualRisks.length > 0) {
    return hold(FOLLOW_UP_ACTION_CLOSURE_DECISION_STATUS.HOLD_RESIDUAL_RISKS, ['hold/rollback outcomes cannot be represented as residual-risk closure'], context);
  }

  const suppliedRefs = cleanRefs(evidenceRefs);
  const requiredRefs = cleanRefs([
    ...(actionClosureEvidence.evidenceRefs || []),
    decision.decidedByRef,
    decision.decisionEvidenceRef,
    ...residualRisks.flatMap((risk) => [risk.ownerRef, risk.riskEvidenceRef]),
  ]);
  const missingRefs = requiredRefs.filter((ref) => !suppliedRefs.includes(ref));
  if (!suppliedRefs.length || missingRefs.length) {
    return hold(FOLLOW_UP_ACTION_CLOSURE_DECISION_STATUS.HOLD_EVIDENCE_CHAIN, ['human action-closure decision evidence chain is incomplete'], context);
  }

  const closed = [FOLLOW_UP_ACTION_CLOSURE_OUTCOME.CLOSE_ACTIONS, FOLLOW_UP_ACTION_CLOSURE_OUTCOME.CLOSE_WITH_RESIDUAL_RISK].includes(decision.outcome);
  const residualAccepted = decision.outcome === FOLLOW_UP_ACTION_CLOSURE_OUTCOME.CLOSE_WITH_RESIDUAL_RISK;
  const holdService = decision.outcome === FOLLOW_UP_ACTION_CLOSURE_OUTCOME.HOLD_SERVICE;
  const rollbackRequired = decision.outcome === FOLLOW_UP_ACTION_CLOSURE_OUTCOME.REQUIRE_ROLLBACK;

  return Object.freeze({
    schemaVersion: 1,
    caseId,
    projectId,
    status: FOLLOW_UP_ACTION_CLOSURE_DECISION_STATUS.DECISION_RECORDED,
    reasons: Object.freeze([]),
    decision: Object.freeze({
      decisionId: decision.decisionId.trim(),
      outcome: decision.outcome,
      decidedByRef: decision.decidedByRef.trim(),
      decidedAt: decidedAt.canonical,
      decisionEvidenceRef: decision.decisionEvidenceRef.trim(),
      conflictDeclarationCompleted: true,
      acknowledgements: Object.freeze(Object.fromEntries(acknowledgementKeys.map((key) => [key, true]))),
      residualRisks,
    }),
    evidenceRefs: Object.freeze(suppliedRefs),
    humanActionClosureDecisionRecorded: true,
    actionsClosedByHuman: closed,
    residualRiskAcceptedByHuman: residualAccepted,
    serviceHoldRequiredByHuman: holdService,
    rollbackRequiredByHuman: rollbackRequired,
    continuedProductionUseAuthorizedByThisModule: false,
    rollbackExecuted: false,
    productionSecurityCertified: false,
    legalApprovalEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'DECISION_RECORDED preserves an accountable human decision on completed production follow-up actions. Closure or residual-risk acceptance is human-only. This module does not independently authorize continued production use, execute rollback, certify security/legal/valuation status, or authorize an investment transaction.',
  });
}

module.exports = {
  FOLLOW_UP_ACTION_CLOSURE_OUTCOME,
  FOLLOW_UP_ACTION_CLOSURE_DECISION_STATUS,
  recordProductionFollowUpActionClosureDecision,
};
