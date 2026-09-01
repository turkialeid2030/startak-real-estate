'use strict';

const assert = require('assert');
const {
  POST_ROLLBACK_REVIEW_OUTCOME: OUTCOME,
  POST_ROLLBACK_REVIEW_STATUS: STATUS,
  recordPostRollbackHumanReview,
} = require('../../src/production-readiness/post-rollback-human-review');

const scope = { caseId: 'CASE-POST-RB-001', projectId: 'PROJECT-POST-RB-001' };
const targetCommit = 'b'.repeat(40);

function rollbackEvidence(overrides = {}) {
  const base = {
    ...scope,
    status: 'EVIDENCE_PACK_COMPLETE',
    humanRollbackDecision: {
      source: 'CONTINUITY_DECISION',
      decisionId: 'CONT-RB-001',
      decidedByRef: 'reviewer://rollback-decision/1',
      decidedAt: '2026-09-01T15:00:00+03:00',
      decisionEvidenceRef: 'evidence://rollback-decision/1',
    },
    rollbackPlan: {
      planId: 'RB-PLAN-001',
      targetRelease: {
        appVersion: '1.1.9',
        buildId: '1.1.9-bbbbbbbbbbbb',
        sourceCommit: targetCommit,
        releaseRef: 'release://known-good/previous',
      },
    },
    execution: {
      executionId: 'RB-EXEC-001',
      executionEvidenceRef: 'evidence://rollback-execution/1',
    },
    runtime: {
      evidenceCapturedAt: '2026-09-01T15:30:00+03:00',
      runtimeEvidenceRef: 'evidence://rollback-runtime/1',
    },
    evidenceRefs: [
      'evidence://rollback-decision/1',
      'evidence://rollback-execution/1',
      'evidence://rollback-runtime/1',
      'release://known-good/previous',
    ],
    rollbackExecutionEvidenceRecorded: true,
    targetReleaseRuntimeEvidenceRecorded: true,
    readyForHumanRollbackReview: true,
    rollbackVerifiedByThisModule: false,
    productionUseAuthorizedByThisModule: false,
    transactionAuthorized: false,
  };
  return { ...base, ...overrides };
}

function review(overrides = {}) {
  return {
    reviewId: 'POST-RB-REVIEW-001',
    outcome: OUTCOME.ACCEPT_RESTORED_SERVICE,
    reviewedByRef: 'reviewer://post-rollback/1',
    reviewedAt: '2026-09-01T15:40:00+03:00',
    reviewEvidenceRef: 'evidence://post-rollback/review/1',
    conflictDeclarationCompleted: true,
    acknowledgements: {
      rollbackDecisionReviewed: true,
      rollbackPlanReviewed: true,
      rollbackExecutionReviewed: true,
      targetReleaseIdentityReviewed: true,
      runtimeEvidenceReviewed: true,
      humanAccountabilityAccepted: true,
    },
    monitoringConditions: [],
    ...overrides,
  };
}

function base(overrides = {}) {
  const rb = overrides.rollbackEvidence || rollbackEvidence();
  const rv = overrides.review || review();
  const evidenceRefs = overrides.evidenceRefs || [...new Set([
    ...(rb.evidenceRefs || []),
    rb.humanRollbackDecision?.decisionEvidenceRef,
    rb.execution?.executionEvidenceRef,
    rb.runtime?.runtimeEvidenceRef,
    rv.reviewedByRef,
    rv.reviewEvidenceRef,
    ...(rv.monitoringConditions || []).flatMap((condition) => [condition.ownerRef, condition.monitoringEvidenceRef]),
  ].filter(Boolean))];
  return { ...scope, rollbackEvidence: rb, review: rv, evidenceRefs, ...overrides };
}

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`PASS ${name}`);
}

check('restored service acceptance is recorded as a human outcome only', () => {
  const out = recordPostRollbackHumanReview(base());
  assert.strictEqual(out.status, STATUS.REVIEW_RECORDED);
  assert.strictEqual(out.humanPostRollbackReviewRecorded, true);
  assert.strictEqual(out.restoredServiceAcceptedByHuman, true);
  assert.strictEqual(out.monitoringConditionsRemain, false);
  assert.strictEqual(out.serviceHoldRequiredByHuman, false);
  assert.strictEqual(out.escalationRequiredByHuman, false);
  assert.strictEqual(out.productionUseAuthorizedByThisModule, false);
  assert.strictEqual(out.rollbackVerifiedByThisModule, false);
  assert.strictEqual(out.productionSecurityCertified, false);
  assert.strictEqual(out.legalApprovalEstablished, false);
  assert.strictEqual(out.certifiedValuationEstablished, false);
  assert.strictEqual(out.transactionAuthorized, false);
});

check('scope mismatch fails closed', () => {
  assert.strictEqual(recordPostRollbackHumanReview(base({ rollbackEvidence: rollbackEvidence({ caseId: 'OTHER' }) })).status, STATUS.HOLD_SCOPE);
});

check('rollback evidence must be complete and bounded', () => {
  assert.strictEqual(recordPostRollbackHumanReview(base({ rollbackEvidence: rollbackEvidence({ status: 'HOLD_RUNTIME' }) })).status, STATUS.HOLD_ROLLBACK_EVIDENCE);
  assert.strictEqual(recordPostRollbackHumanReview(base({ rollbackEvidence: rollbackEvidence({ readyForHumanRollbackReview: false }) })).status, STATUS.HOLD_ROLLBACK_EVIDENCE);
  assert.strictEqual(recordPostRollbackHumanReview(base({ rollbackEvidence: rollbackEvidence({ productionUseAuthorizedByThisModule: true }) })).status, STATUS.HOLD_ROLLBACK_EVIDENCE);
});

check('review metadata is mandatory and timezone explicit', () => {
  assert.strictEqual(recordPostRollbackHumanReview(base({ review: review({ reviewedByRef: '' }) })).status, STATUS.HOLD_REVIEW_METADATA);
  assert.strictEqual(recordPostRollbackHumanReview(base({ review: review({ reviewedAt: '2026-09-01T15:40:00' }) })).status, STATUS.HOLD_REVIEW_METADATA);
  assert.strictEqual(recordPostRollbackHumanReview(base({ review: review({ conflictDeclarationCompleted: false }) })).status, STATUS.HOLD_REVIEW_METADATA);
});

check('human review must follow rollback runtime evidence capture', () => {
  assert.strictEqual(recordPostRollbackHumanReview(base({ review: review({ reviewedAt: '2026-09-01T15:29:59+03:00' }) })).status, STATUS.HOLD_TIMELINE);
});

check('all post-rollback acknowledgements are mandatory', () => {
  const rv = review();
  rv.acknowledgements.runtimeEvidenceReviewed = false;
  assert.strictEqual(recordPostRollbackHumanReview(base({ review: rv })).status, STATUS.HOLD_ACKNOWLEDGEMENTS);
});

check('conditional restored-service acceptance requires explicit monitoring conditions', () => {
  const condition = {
    conditionId: 'RB-COND-1',
    description: 'Observe restored release during controlled service',
    ownerRef: 'owner://rollback-monitor/1',
    monitoringEvidenceRef: 'evidence://rollback-monitor/1',
  };
  const rv = review({ outcome: OUTCOME.ACCEPT_WITH_MONITORING_CONDITIONS, monitoringConditions: [condition] });
  const out = recordPostRollbackHumanReview(base({ review: rv }));
  assert.strictEqual(out.status, STATUS.REVIEW_RECORDED);
  assert.strictEqual(out.restoredServiceAcceptedByHuman, true);
  assert.strictEqual(out.monitoringConditionsRemain, true);

  assert.strictEqual(recordPostRollbackHumanReview(base({ review: review({ outcome: OUTCOME.ACCEPT_WITH_MONITORING_CONDITIONS, monitoringConditions: [] }) })).status, STATUS.HOLD_CONDITIONS);
});

check('unconditional acceptance cannot hide monitoring conditions', () => {
  const condition = {
    conditionId: 'RB-HIDDEN',
    description: 'Hidden condition',
    ownerRef: 'owner://hidden/1',
    monitoringEvidenceRef: 'evidence://hidden/1',
  };
  assert.strictEqual(recordPostRollbackHumanReview(base({ review: review({ monitoringConditions: [condition] }) })).status, STATUS.HOLD_CONDITIONS);
});

check('hold and escalation outcomes remain explicit fail-closed human decisions', () => {
  const holdResult = recordPostRollbackHumanReview(base({ review: review({ outcome: OUTCOME.HOLD_SERVICE }) }));
  assert.strictEqual(holdResult.status, STATUS.REVIEW_RECORDED);
  assert.strictEqual(holdResult.restoredServiceAcceptedByHuman, false);
  assert.strictEqual(holdResult.serviceHoldRequiredByHuman, true);
  assert.strictEqual(holdResult.escalationRequiredByHuman, false);

  const escalationResult = recordPostRollbackHumanReview(base({ review: review({ outcome: OUTCOME.ESCALATE_INCIDENT }) }));
  assert.strictEqual(escalationResult.status, STATUS.REVIEW_RECORDED);
  assert.strictEqual(escalationResult.restoredServiceAcceptedByHuman, false);
  assert.strictEqual(escalationResult.serviceHoldRequiredByHuman, false);
  assert.strictEqual(escalationResult.escalationRequiredByHuman, true);
});

check('hold and escalation cannot be disguised as conditional acceptance', () => {
  const condition = {
    conditionId: 'RB-INVALID',
    description: 'Invalid condition',
    ownerRef: 'owner://invalid/1',
    monitoringEvidenceRef: 'evidence://invalid/1',
  };
  for (const outcome of [OUTCOME.HOLD_SERVICE, OUTCOME.ESCALATE_INCIDENT]) {
    assert.strictEqual(recordPostRollbackHumanReview(base({ review: review({ outcome, monitoringConditions: [condition] }) })).status, STATUS.HOLD_CONDITIONS);
  }
});

check('evidence chain is mandatory and deduplicated', () => {
  const input = base();
  input.evidenceRefs = input.evidenceRefs.filter((ref) => ref !== input.review.reviewEvidenceRef);
  assert.strictEqual(recordPostRollbackHumanReview(input).status, STATUS.HOLD_EVIDENCE_CHAIN);

  const complete = base();
  complete.evidenceRefs.push(complete.evidenceRefs[0]);
  const out = recordPostRollbackHumanReview(complete);
  assert.strictEqual(out.status, STATUS.REVIEW_RECORDED);
  assert.strictEqual(new Set(out.evidenceRefs).size, out.evidenceRefs.length);
});

console.log(`POST_ROLLBACK_HUMAN_REVIEW_V1=PASS checks=${checks}`);
