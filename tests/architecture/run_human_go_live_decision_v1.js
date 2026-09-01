'use strict';

const assert = require('assert');
const {
  HUMAN_GO_LIVE_OUTCOME: OUTCOME,
  HUMAN_GO_LIVE_STATUS: STATUS,
  recordHumanGoLiveDecision,
} = require('../../src/production-readiness/human-go-live-decision');

const scope = { caseId: 'CASE-HUMAN-GO-LIVE-001', projectId: 'PROJECT-HUMAN-GO-LIVE-001' };

function base() {
  const gateRefs = ['evidence://gate/1', 'evidence://pilot/1'];
  const decidedByRef = 'reviewer://go-live/decision-maker/1';
  const decisionEvidenceRef = 'evidence://go-live/decision/1';
  return {
    ...scope,
    institutionalGoLiveGate: {
      ...scope,
      status: 'READY_FOR_HUMAN_GO_LIVE_DECISION',
      readyForHumanGoLiveDecision: true,
      goLiveAuthorized: false,
      productionDeploymentAuthorized: false,
      transactionAuthorized: false,
      evidenceRefs: gateRefs,
    },
    decision: {
      decisionId: 'GLD-001',
      outcome: OUTCOME.APPROVE_CONTROLLED_PRODUCTION,
      decidedByRef,
      decisionEvidenceRef,
      decidedAt: '2026-09-01T15:00:00Z',
      conflictDeclarationCompleted: true,
      acknowledgements: {
        securityLimitationsAcknowledged: true,
        regulatoryBoundaryAcknowledged: true,
        valuationValidationLimitationsAcknowledged: true,
        pilotLimitationsAcknowledged: true,
        rollbackReadinessAcknowledged: true,
        humanAccountabilityAccepted: true,
      },
      conditions: [],
    },
    evidenceRefs: [...gateRefs, decidedByRef, decisionEvidenceRef],
  };
}

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`PASS ${name}`);
}

check('human approval is recorded without executing deployment', () => {
  const result = recordHumanGoLiveDecision(base());
  assert.strictEqual(result.status, STATUS.DECISION_RECORDED);
  assert.strictEqual(result.humanDecisionRecorded, true);
  assert.strictEqual(result.humanGoLiveApproved, true);
  assert.strictEqual(result.deploymentExecutionAuthorizedByThisModule, false);
  assert.strictEqual(result.deploymentExecuted, false);
  assert.strictEqual(result.productionSecurityCertified, false);
  assert.strictEqual(result.legalApprovalEstablished, false);
  assert.strictEqual(result.certifiedValuationEstablished, false);
  assert.strictEqual(result.transactionAuthorized, false);
});

check('scope mismatch fails closed', () => {
  const input = base();
  input.institutionalGoLiveGate = { ...input.institutionalGoLiveGate, caseId: 'OTHER' };
  assert.strictEqual(recordHumanGoLiveDecision(input).status, STATUS.HOLD_SCOPE);
});

check('unready institutional gate fails closed', () => {
  const input = base();
  input.institutionalGoLiveGate = { ...input.institutionalGoLiveGate, status: 'HOLD_MARKET_EVIDENCE', readyForHumanGoLiveDecision: false };
  assert.strictEqual(recordHumanGoLiveDecision(input).status, STATUS.HOLD_GATE);
});

check('decision metadata is mandatory', () => {
  const input = base();
  input.decision.decidedByRef = '';
  assert.strictEqual(recordHumanGoLiveDecision(input).status, STATUS.HOLD_DECISION_METADATA);
});

check('all acknowledgements are mandatory', () => {
  const input = base();
  input.decision.acknowledgements.securityLimitationsAcknowledged = false;
  assert.strictEqual(recordHumanGoLiveDecision(input).status, STATUS.HOLD_ACKNOWLEDGEMENTS);
});

check('conditional approval requires an explicit condition', () => {
  const input = base();
  input.decision.outcome = OUTCOME.APPROVE_WITH_CONDITIONS;
  input.decision.conditions = [];
  assert.strictEqual(recordHumanGoLiveDecision(input).status, STATUS.HOLD_CONDITIONS);
});

check('conditional approval records condition without auto-deployment', () => {
  const input = base();
  const ownerRef = 'owner://condition/1';
  input.decision.outcome = OUTCOME.APPROVE_WITH_CONDITIONS;
  input.decision.conditions = [{
    conditionId: 'COND-1',
    description: 'Complete controlled release checklist',
    ownerRef,
    evidenceRequired: false,
  }];
  input.evidenceRefs.push(ownerRef);
  const result = recordHumanGoLiveDecision(input);
  assert.strictEqual(result.status, STATUS.DECISION_RECORDED);
  assert.strictEqual(result.humanGoLiveApproved, true);
  assert.strictEqual(result.conditionsRemain, true);
  assert.strictEqual(result.deploymentExecuted, false);
});

check('unresolved evidence-required condition blocks unconditional approval', () => {
  const input = base();
  const ownerRef = 'owner://condition/2';
  input.decision.conditions = [{
    conditionId: 'COND-2',
    description: 'Provide final rollback evidence',
    ownerRef,
    evidenceRequired: true,
    evidenceRef: null,
  }];
  input.evidenceRefs.push(ownerRef);
  assert.strictEqual(recordHumanGoLiveDecision(input).status, STATUS.HOLD_CONDITIONS);
});

check('defer remains a recorded human decision without approval', () => {
  const input = base();
  input.decision.outcome = OUTCOME.DEFER;
  const result = recordHumanGoLiveDecision(input);
  assert.strictEqual(result.status, STATUS.DECISION_RECORDED);
  assert.strictEqual(result.humanGoLiveApproved, false);
  assert.strictEqual(result.deploymentExecuted, false);
});

check('reject remains a recorded human decision without approval', () => {
  const input = base();
  input.decision.outcome = OUTCOME.REJECT;
  const result = recordHumanGoLiveDecision(input);
  assert.strictEqual(result.status, STATUS.DECISION_RECORDED);
  assert.strictEqual(result.humanGoLiveApproved, false);
});

check('decision evidence chain is mandatory', () => {
  const input = base();
  input.evidenceRefs = input.evidenceRefs.filter((ref) => ref !== input.decision.decisionEvidenceRef);
  assert.strictEqual(recordHumanGoLiveDecision(input).status, STATUS.HOLD_EVIDENCE_CHAIN);
});

console.log(`HUMAN_GO_LIVE_DECISION_V1=PASS checks=${checks}`);
