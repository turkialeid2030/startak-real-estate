'use strict';

const assert = require('assert');
const {
  FOLLOW_UP_ACTION_CLOSURE_OUTCOME: OUTCOME,
  FOLLOW_UP_ACTION_CLOSURE_DECISION_STATUS: STATUS,
  recordProductionFollowUpActionClosureDecision,
} = require('../../src/production-readiness/production-follow-up-action-closure-decision');

const scope = { caseId: 'CASE-ACTION-CLOSE-DEC-001', projectId: 'PROJECT-ACTION-CLOSE-DEC-001' };

function closureEvidence(overrides = {}) {
  return {
    ...scope,
    status: 'READY_FOR_HUMAN_ACTION_CLOSURE_REVIEW',
    allActionsCompleted: true,
    readyForHumanActionClosureReview: true,
    actionsClosedByThisModule: false,
    continuedProductionUseAuthorizedByThisModule: false,
    rollbackAuthorizedByThisModule: false,
    transactionAuthorized: false,
    completions: [
      { actionId: 'ACT-1', completedAt: '2026-09-02T10:00:00+03:00' },
      { actionId: 'ACT-2', completedAt: '2026-09-03T11:00:00+03:00' },
    ],
    evidenceRefs: ['evidence://closure/1', 'evidence://completion/1', 'evidence://completion/2'],
    ...overrides,
  };
}

function decision(overrides = {}) {
  return {
    decisionId: 'ACTION-CLOSE-DEC-1',
    outcome: OUTCOME.CLOSE_ACTIONS,
    decidedByRef: 'reviewer://ops/closure/1',
    decidedAt: '2026-09-03T12:00:00+03:00',
    decisionEvidenceRef: 'evidence://action-close-decision/1',
    conflictDeclarationCompleted: true,
    acknowledgements: {
      actionCompletionEvidenceReviewed: true,
      lateActionsReviewed: true,
      incidentSummaryReviewed: true,
      evidenceChainReviewed: true,
      humanAccountabilityAccepted: true,
    },
    residualRisks: [],
    ...overrides,
  };
}

function refs(ev = closureEvidence(), dec = decision()) {
  return [...new Set([
    ...(ev.evidenceRefs || []),
    dec.decidedByRef,
    dec.decisionEvidenceRef,
    ...(dec.residualRisks || []).flatMap((risk) => [risk.ownerRef, risk.riskEvidenceRef]),
  ].filter(Boolean))];
}

function base(overrides = {}) {
  const ev = overrides.actionClosureEvidence || closureEvidence();
  const dec = overrides.decision || decision();
  return { ...scope, actionClosureEvidence: ev, decision: dec, evidenceRefs: refs(ev, dec), ...overrides };
}

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`PASS ${name}`);
}

check('human may close completed actions without software authorizing production use', () => {
  const out = recordProductionFollowUpActionClosureDecision(base());
  assert.strictEqual(out.status, STATUS.DECISION_RECORDED);
  assert.strictEqual(out.actionsClosedByHuman, true);
  assert.strictEqual(out.residualRiskAcceptedByHuman, false);
  assert.strictEqual(out.continuedProductionUseAuthorizedByThisModule, false);
  assert.strictEqual(out.rollbackExecuted, false);
  assert.strictEqual(out.transactionAuthorized, false);
});

check('scope mismatch fails closed', () => {
  assert.strictEqual(recordProductionFollowUpActionClosureDecision(base({ actionClosureEvidence: closureEvidence({ caseId: 'OTHER' }) })).status, STATUS.HOLD_SCOPE);
});

check('unready closure evidence fails closed', () => {
  assert.strictEqual(recordProductionFollowUpActionClosureDecision(base({ actionClosureEvidence: closureEvidence({ status: 'HOLD_INCIDENTS', readyForHumanActionClosureReview: false }) })).status, STATUS.HOLD_CLOSURE_EVIDENCE);
});

check('decision metadata is mandatory', () => {
  assert.strictEqual(recordProductionFollowUpActionClosureDecision(base({ decision: decision({ decidedByRef: '' }) })).status, STATUS.HOLD_DECISION_METADATA);
});

check('decision must occur after all completion evidence', () => {
  assert.strictEqual(recordProductionFollowUpActionClosureDecision(base({ decision: decision({ decidedAt: '2026-09-03T10:00:00+03:00' }) })).status, STATUS.HOLD_TIMELINE);
});

check('all acknowledgements are mandatory', () => {
  const d = decision();
  d.acknowledgements = { ...d.acknowledgements, lateActionsReviewed: false };
  assert.strictEqual(recordProductionFollowUpActionClosureDecision(base({ decision: d })).status, STATUS.HOLD_ACKNOWLEDGEMENTS);
});

check('residual-risk closure requires explicit risk', () => {
  assert.strictEqual(recordProductionFollowUpActionClosureDecision(base({ decision: decision({ outcome: OUTCOME.CLOSE_WITH_RESIDUAL_RISK }) })).status, STATUS.HOLD_RESIDUAL_RISKS);
});

check('residual-risk closure records explicit human acceptance', () => {
  const residualRisks = [{
    riskId: 'RISK-1', description: 'Observe capacity trend for another cycle', ownerRef: 'owner://risk/1',
    riskEvidenceRef: 'evidence://risk/1', monitoringRequired: true,
  }];
  const d = decision({ outcome: OUTCOME.CLOSE_WITH_RESIDUAL_RISK, residualRisks });
  const out = recordProductionFollowUpActionClosureDecision(base({ decision: d, evidenceRefs: refs(closureEvidence(), d) }));
  assert.strictEqual(out.status, STATUS.DECISION_RECORDED);
  assert.strictEqual(out.actionsClosedByHuman, true);
  assert.strictEqual(out.residualRiskAcceptedByHuman, true);
  assert.strictEqual(out.continuedProductionUseAuthorizedByThisModule, false);
});

check('unconditional closure cannot hide residual risk', () => {
  const residualRisks = [{ riskId: 'RISK-1', description: 'Residual', ownerRef: 'owner://risk/1', riskEvidenceRef: 'evidence://risk/1' }];
  assert.strictEqual(recordProductionFollowUpActionClosureDecision(base({ decision: decision({ residualRisks }) })).status, STATUS.HOLD_RESIDUAL_RISKS);
});

check('hold and rollback outcomes remain explicit human controls', () => {
  const holdOut = recordProductionFollowUpActionClosureDecision(base({ decision: decision({ outcome: OUTCOME.HOLD_SERVICE }) }));
  assert.strictEqual(holdOut.status, STATUS.DECISION_RECORDED);
  assert.strictEqual(holdOut.serviceHoldRequiredByHuman, true);
  assert.strictEqual(holdOut.actionsClosedByHuman, false);

  const rollbackOut = recordProductionFollowUpActionClosureDecision(base({ decision: decision({ outcome: OUTCOME.REQUIRE_ROLLBACK }) }));
  assert.strictEqual(rollbackOut.status, STATUS.DECISION_RECORDED);
  assert.strictEqual(rollbackOut.rollbackRequiredByHuman, true);
  assert.strictEqual(rollbackOut.rollbackExecuted, false);
});

check('evidence chain is mandatory and deduplicated', () => {
  const input = base();
  input.evidenceRefs = input.evidenceRefs.filter((ref) => ref !== input.decision.decisionEvidenceRef);
  assert.strictEqual(recordProductionFollowUpActionClosureDecision(input).status, STATUS.HOLD_EVIDENCE_CHAIN);

  const complete = base();
  complete.evidenceRefs.push(complete.evidenceRefs[0]);
  const out = recordProductionFollowUpActionClosureDecision(complete);
  assert.strictEqual(out.status, STATUS.DECISION_RECORDED);
  assert.strictEqual(new Set(out.evidenceRefs).size, out.evidenceRefs.length);
});

console.log(`PRODUCTION_FOLLOW_UP_ACTION_CLOSURE_DECISION_V1=PASS checks=${checks}`);
