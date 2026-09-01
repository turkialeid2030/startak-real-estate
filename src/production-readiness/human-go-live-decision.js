'use strict';

const HUMAN_GO_LIVE_OUTCOME = Object.freeze({
  APPROVE_CONTROLLED_PRODUCTION: 'APPROVE_CONTROLLED_PRODUCTION',
  APPROVE_WITH_CONDITIONS: 'APPROVE_WITH_CONDITIONS',
  DEFER: 'DEFER',
  REJECT: 'REJECT',
});

const HUMAN_GO_LIVE_STATUS = Object.freeze({
  DECISION_RECORDED: 'DECISION_RECORDED',
  HOLD_SCOPE: 'HOLD_SCOPE',
  HOLD_GATE: 'HOLD_GATE',
  HOLD_DECISION_METADATA: 'HOLD_DECISION_METADATA',
  HOLD_ACKNOWLEDGEMENTS: 'HOLD_ACKNOWLEDGEMENTS',
  HOLD_CONDITIONS: 'HOLD_CONDITIONS',
  HOLD_EVIDENCE_CHAIN: 'HOLD_EVIDENCE_CHAIN',
});

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoDate(value) {
  return nonEmptyString(value) && Number.isFinite(Date.parse(value));
}

function cleanRefs(refs) {
  return Array.isArray(refs) ? [...new Set(refs.filter(nonEmptyString).map((ref) => ref.trim()))] : [];
}

function hold(status, reasons, context = {}) {
  return {
    caseId: context.caseId || null,
    projectId: context.projectId || null,
    status,
    reasons,
    humanDecisionRecorded: false,
    humanGoLiveApproved: false,
    deploymentExecutionAuthorizedByThisModule: false,
    deploymentExecuted: false,
    productionSecurityCertified: false,
    legalApprovalEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  };
}

function normalizeConditions(conditions) {
  if (!Array.isArray(conditions)) return null;
  const normalized = [];
  for (const [index, condition] of conditions.entries()) {
    if (!condition || typeof condition !== 'object') return null;
    if (!nonEmptyString(condition.conditionId) || !nonEmptyString(condition.description) || !nonEmptyString(condition.ownerRef)) return null;
    normalized.push({
      conditionId: condition.conditionId.trim(),
      description: condition.description.trim(),
      ownerRef: condition.ownerRef.trim(),
      evidenceRequired: condition.evidenceRequired === true,
      evidenceRef: nonEmptyString(condition.evidenceRef) ? condition.evidenceRef.trim() : null,
    });
  }
  return normalized;
}

function recordHumanGoLiveDecision({
  caseId,
  projectId,
  institutionalGoLiveGate,
  decision,
  evidenceRefs = [],
}) {
  const context = { caseId, projectId };
  if (!nonEmptyString(caseId) || !nonEmptyString(projectId)) {
    return hold(HUMAN_GO_LIVE_STATUS.HOLD_SCOPE, ['caseId/projectId required'], context);
  }

  if (!institutionalGoLiveGate || institutionalGoLiveGate.caseId !== caseId || institutionalGoLiveGate.projectId !== projectId) {
    return hold(HUMAN_GO_LIVE_STATUS.HOLD_SCOPE, ['institutional go-live gate scope mismatch'], context);
  }

  const gateReady =
    institutionalGoLiveGate.status === 'READY_FOR_HUMAN_GO_LIVE_DECISION' &&
    institutionalGoLiveGate.readyForHumanGoLiveDecision === true &&
    institutionalGoLiveGate.goLiveAuthorized === false &&
    institutionalGoLiveGate.productionDeploymentAuthorized === false &&
    institutionalGoLiveGate.transactionAuthorized === false;
  if (!gateReady) {
    return hold(HUMAN_GO_LIVE_STATUS.HOLD_GATE, ['institutional go-live gate must be ready for a human decision'], context);
  }

  const metadataValid =
    decision &&
    nonEmptyString(decision.decisionId) &&
    nonEmptyString(decision.decidedByRef) &&
    nonEmptyString(decision.decisionEvidenceRef) &&
    isIsoDate(decision.decidedAt) &&
    Object.values(HUMAN_GO_LIVE_OUTCOME).includes(decision.outcome) &&
    decision.conflictDeclarationCompleted === true;
  if (!metadataValid) {
    return hold(HUMAN_GO_LIVE_STATUS.HOLD_DECISION_METADATA, ['human decision metadata, outcome, conflict declaration, and evidence reference are required'], context);
  }

  const acknowledgements = decision.acknowledgements || {};
  const acknowledgementKeys = [
    'securityLimitationsAcknowledged',
    'regulatoryBoundaryAcknowledged',
    'valuationValidationLimitationsAcknowledged',
    'pilotLimitationsAcknowledged',
    'rollbackReadinessAcknowledged',
    'humanAccountabilityAccepted',
  ];
  if (!acknowledgementKeys.every((key) => acknowledgements[key] === true)) {
    return hold(HUMAN_GO_LIVE_STATUS.HOLD_ACKNOWLEDGEMENTS, ['all explicit human go-live acknowledgements are required'], context);
  }

  const normalizedConditions = normalizeConditions(decision.conditions || []);
  if (normalizedConditions === null) {
    return hold(HUMAN_GO_LIVE_STATUS.HOLD_CONDITIONS, ['conditions must contain conditionId, description, and ownerRef'], context);
  }
  if (decision.outcome === HUMAN_GO_LIVE_OUTCOME.APPROVE_WITH_CONDITIONS && normalizedConditions.length === 0) {
    return hold(HUMAN_GO_LIVE_STATUS.HOLD_CONDITIONS, ['APPROVE_WITH_CONDITIONS requires at least one explicit condition'], context);
  }
  if (decision.outcome === HUMAN_GO_LIVE_OUTCOME.APPROVE_CONTROLLED_PRODUCTION && normalizedConditions.some((condition) => condition.evidenceRequired && !condition.evidenceRef)) {
    return hold(HUMAN_GO_LIVE_STATUS.HOLD_CONDITIONS, ['unresolved evidence-required conditions are incompatible with unconditional controlled-production approval'], context);
  }

  const suppliedRefs = cleanRefs(evidenceRefs);
  const requiredRefs = cleanRefs([
    ...(institutionalGoLiveGate.evidenceRefs || []),
    decision.decisionEvidenceRef,
    decision.decidedByRef,
    ...normalizedConditions.map((condition) => condition.ownerRef),
    ...normalizedConditions.map((condition) => condition.evidenceRef),
  ]);
  const missingRefs = requiredRefs.filter((ref) => !suppliedRefs.includes(ref));
  if (missingRefs.length > 0) {
    return hold(HUMAN_GO_LIVE_STATUS.HOLD_EVIDENCE_CHAIN, ['human go-live decision evidence chain is incomplete'], context);
  }

  const approved = [HUMAN_GO_LIVE_OUTCOME.APPROVE_CONTROLLED_PRODUCTION, HUMAN_GO_LIVE_OUTCOME.APPROVE_WITH_CONDITIONS].includes(decision.outcome);

  return {
    caseId,
    projectId,
    status: HUMAN_GO_LIVE_STATUS.DECISION_RECORDED,
    reasons: [],
    decision: {
      decisionId: decision.decisionId.trim(),
      outcome: decision.outcome,
      decidedByRef: decision.decidedByRef.trim(),
      decidedAt: decision.decidedAt,
      decisionEvidenceRef: decision.decisionEvidenceRef.trim(),
      conflictDeclarationCompleted: true,
      acknowledgements: Object.fromEntries(acknowledgementKeys.map((key) => [key, true])),
      conditions: normalizedConditions,
    },
    evidenceRefs: suppliedRefs,
    humanDecisionRecorded: true,
    humanGoLiveApproved: approved,
    conditionsRemain: normalizedConditions.length > 0,
    deploymentExecutionAuthorizedByThisModule: false,
    deploymentExecuted: false,
    productionSecurityCertified: false,
    legalApprovalEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'DECISION_RECORDED records an explicit human go-live decision after the institutional evidence gate. Even an approval outcome is not deployment execution, security certification, legal approval, certified valuation, or transaction authorization; operational deployment remains a separate controlled action.',
  };
}

module.exports = {
  HUMAN_GO_LIVE_OUTCOME,
  HUMAN_GO_LIVE_STATUS,
  recordHumanGoLiveDecision,
};
