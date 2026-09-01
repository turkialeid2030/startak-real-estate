'use strict';

const assert = require('assert');
const {
  PRODUCTION_SERVICE_CONTINUITY_OUTCOME: OUTCOME,
  PRODUCTION_SERVICE_CONTINUITY_DECISION_STATUS: STATUS,
  recordProductionServiceContinuityDecision,
} = require('../../src/production-readiness/production-service-continuity-decision');

const scope = { caseId: 'CASE-CONT-DEC-001', projectId: 'PROJECT-CONT-DEC-001' };

function continuity(overrides = {}) {
  const base = {
    ...scope,
    status: 'READY_FOR_HUMAN_CONTINUITY_REVIEW',
    observationWindow: {
      startsAt: '2026-09-01T12:45:00+03:00',
      endsAt: '2026-09-01T14:00:00+03:00',
    },
    readyForHumanContinuityReview: true,
    continuedProductionUseAuthorizedByThisModule: false,
    rollbackAuthorizedByThisModule: false,
    transactionAuthorized: false,
    evidenceRefs: ['evidence://continuity/1', 'evidence://monitoring/1'],
  };
  return { ...base, ...overrides };
}

function decision(overrides = {}) {
  return {
    decisionId: 'CONT-DEC-001',
    outcome: OUTCOME.CONTINUE_SERVICE,
    decidedByRef: 'reviewer://continuity/1',
    decidedAt: '2026-09-01T14:10:00+03:00',
    decisionEvidenceRef: 'evidence://continuity/decision/1',
    conflictDeclarationCompleted: true,
    acknowledgements: {
      monitoringPolicyReviewed: true,
      requiredObservationsReviewed: true,
      monitoringConditionsReviewed: true,
      incidentSummaryReviewed: true,
      rollbackReadinessReviewed: true,
      humanAccountabilityAccepted: true,
    },
    actions: [],
    ...overrides,
  };
}

function base(overrides = {}) {
  const c = overrides.continuityEvidence || continuity();
  const d = overrides.decision || decision();
  const evidenceRefs = overrides.evidenceRefs || [...new Set([
    ...(c.evidenceRefs || []),
    d.decidedByRef,
    d.decisionEvidenceRef,
    ...(d.actions || []).flatMap((action) => [action.ownerRef, action.actionEvidenceRef]),
  ])];
  return {
    ...scope,
    continuityEvidence: c,
    decision: d,
    evidenceRefs,
    ...overrides,
  };
}

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`PASS ${name}`);
}

check('human continuation decision is recorded without software authorization', () => {
  const out = recordProductionServiceContinuityDecision(base());
  assert.strictEqual(out.status, STATUS.DECISION_RECORDED);
  assert.strictEqual(out.humanContinuityDecisionRecorded, true);
  assert.strictEqual(out.productionServiceContinuationApprovedByHuman, true);
  assert.strictEqual(out.continuationActionsRemain, false);
  assert.strictEqual(out.rollbackRequiredByHuman, false);
  assert.strictEqual(out.continuedProductionUseAuthorizedByThisModule, false);
  assert.strictEqual(out.rollbackExecuted, false);
  assert.strictEqual(out.productionSecurityCertified, false);
  assert.strictEqual(out.legalApprovalEstablished, false);
  assert.strictEqual(out.certifiedValuationEstablished, false);
  assert.strictEqual(out.transactionAuthorized, false);
});

check('scope mismatch fails closed', () => {
  assert.strictEqual(recordProductionServiceContinuityDecision(base({ continuityEvidence: continuity({ caseId: 'OTHER' }) })).status, STATUS.HOLD_SCOPE);
});

check('continuity evidence must be ready and bounded', () => {
  assert.strictEqual(recordProductionServiceContinuityDecision(base({ continuityEvidence: continuity({ status: 'HOLD_INCIDENTS' }) })).status, STATUS.HOLD_CONTINUITY_EVIDENCE);
  assert.strictEqual(recordProductionServiceContinuityDecision(base({ continuityEvidence: continuity({ continuedProductionUseAuthorizedByThisModule: true }) })).status, STATUS.HOLD_CONTINUITY_EVIDENCE);
  assert.strictEqual(recordProductionServiceContinuityDecision(base({ continuityEvidence: continuity({ rollbackAuthorizedByThisModule: true }) })).status, STATUS.HOLD_CONTINUITY_EVIDENCE);
});

check('human decision metadata is mandatory', () => {
  assert.strictEqual(recordProductionServiceContinuityDecision(base({ decision: decision({ decidedByRef: '' }) })).status, STATUS.HOLD_DECISION_METADATA);
  assert.strictEqual(recordProductionServiceContinuityDecision(base({ decision: decision({ conflictDeclarationCompleted: false }) })).status, STATUS.HOLD_DECISION_METADATA);
  assert.strictEqual(recordProductionServiceContinuityDecision(base({ decision: decision({ decidedAt: '2026-09-01T14:10:00' }) })).status, STATUS.HOLD_DECISION_METADATA);
});

check('continuity decision must follow the complete observation window', () => {
  assert.strictEqual(recordProductionServiceContinuityDecision(base({ decision: decision({ decidedAt: '2026-09-01T13:59:59+03:00' }) })).status, STATUS.HOLD_TIMELINE);
});

check('all continuity acknowledgements are mandatory', () => {
  const d = decision();
  d.acknowledgements.incidentSummaryReviewed = false;
  assert.strictEqual(recordProductionServiceContinuityDecision(base({ decision: d })).status, STATUS.HOLD_ACKNOWLEDGEMENTS);
});

check('continue with actions requires explicit unique human-owned actions', () => {
  const action = {
    actionId: 'ACT-1',
    description: 'Review warning signal with operations owner',
    ownerRef: 'owner://ops/1',
    dueAt: '2026-09-01T16:00:00+03:00',
    actionEvidenceRef: 'evidence://action/1',
    requiresFollowUpEvidence: true,
  };
  const d = decision({ outcome: OUTCOME.CONTINUE_WITH_ACTIONS, actions: [action] });
  const out = recordProductionServiceContinuityDecision(base({ decision: d }));
  assert.strictEqual(out.status, STATUS.DECISION_RECORDED);
  assert.strictEqual(out.productionServiceContinuationApprovedByHuman, true);
  assert.strictEqual(out.continuationActionsRemain, true);
  assert.strictEqual(out.decision.actions.length, 1);

  assert.strictEqual(recordProductionServiceContinuityDecision(base({ decision: decision({ outcome: OUTCOME.CONTINUE_WITH_ACTIONS, actions: [] }) })).status, STATUS.HOLD_ACTIONS);
  assert.strictEqual(recordProductionServiceContinuityDecision(base({ decision: decision({ outcome: OUTCOME.CONTINUE_WITH_ACTIONS, actions: [action, { ...action }] }) })).status, STATUS.HOLD_ACTIONS);
});

check('action due date cannot precede the decision', () => {
  const action = {
    actionId: 'ACT-EARLY',
    description: 'Follow-up action',
    ownerRef: 'owner://ops/2',
    dueAt: '2026-09-01T14:00:00+03:00',
    actionEvidenceRef: 'evidence://action/early',
  };
  const d = decision({ outcome: OUTCOME.CONTINUE_WITH_ACTIONS, actions: [action] });
  assert.strictEqual(recordProductionServiceContinuityDecision(base({ decision: d })).status, STATUS.HOLD_ACTIONS);
});

check('unconditional continue cannot carry hidden actions', () => {
  const action = {
    actionId: 'ACT-HIDDEN',
    description: 'Hidden condition',
    ownerRef: 'owner://ops/3',
    dueAt: '2026-09-01T16:00:00+03:00',
    actionEvidenceRef: 'evidence://action/hidden',
  };
  assert.strictEqual(recordProductionServiceContinuityDecision(base({ decision: decision({ actions: [action] }) })).status, STATUS.HOLD_ACTIONS);
});

check('hold and rollback outcomes remain fail-closed human decisions', () => {
  const holdResult = recordProductionServiceContinuityDecision(base({ decision: decision({ outcome: OUTCOME.HOLD_SERVICE }) }));
  assert.strictEqual(holdResult.status, STATUS.DECISION_RECORDED);
  assert.strictEqual(holdResult.productionServiceContinuationApprovedByHuman, false);
  assert.strictEqual(holdResult.serviceHoldRequiredByHuman, true);
  assert.strictEqual(holdResult.rollbackRequiredByHuman, false);

  const rollbackResult = recordProductionServiceContinuityDecision(base({ decision: decision({ outcome: OUTCOME.REQUIRE_ROLLBACK }) }));
  assert.strictEqual(rollbackResult.status, STATUS.DECISION_RECORDED);
  assert.strictEqual(rollbackResult.productionServiceContinuationApprovedByHuman, false);
  assert.strictEqual(rollbackResult.serviceHoldRequiredByHuman, false);
  assert.strictEqual(rollbackResult.rollbackRequiredByHuman, true);
  assert.strictEqual(rollbackResult.rollbackExecuted, false);
});

check('hold and rollback cannot be disguised as continuation with actions', () => {
  const action = {
    actionId: 'ACT-INVALID',
    description: 'Invalid continuation action',
    ownerRef: 'owner://ops/4',
    dueAt: '2026-09-01T16:00:00+03:00',
    actionEvidenceRef: 'evidence://action/invalid',
  };
  for (const outcome of [OUTCOME.HOLD_SERVICE, OUTCOME.REQUIRE_ROLLBACK]) {
    assert.strictEqual(recordProductionServiceContinuityDecision(base({ decision: decision({ outcome, actions: [action] }) })).status, STATUS.HOLD_ACTIONS);
  }
});

check('evidence chain is mandatory and deduplicated', () => {
  const input = base();
  input.evidenceRefs = input.evidenceRefs.filter((ref) => ref !== input.decision.decisionEvidenceRef);
  assert.strictEqual(recordProductionServiceContinuityDecision(input).status, STATUS.HOLD_EVIDENCE_CHAIN);

  const complete = base();
  complete.evidenceRefs.push(complete.evidenceRefs[0]);
  const out = recordProductionServiceContinuityDecision(complete);
  assert.strictEqual(out.status, STATUS.DECISION_RECORDED);
  assert.strictEqual(new Set(out.evidenceRefs).size, out.evidenceRefs.length);
});

console.log(`PRODUCTION_SERVICE_CONTINUITY_DECISION_V1=PASS checks=${checks}`);
