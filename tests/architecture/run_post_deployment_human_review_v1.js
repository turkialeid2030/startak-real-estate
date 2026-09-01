'use strict';

const assert = require('assert');
const {
  POST_DEPLOYMENT_REVIEW_OUTCOME: OUTCOME,
  POST_DEPLOYMENT_REVIEW_STATUS: STATUS,
  recordPostDeploymentHumanReview,
} = require('../../src/production-readiness/post-deployment-human-review');

const scope = { caseId: 'CASE-POST-REVIEW-001', projectId: 'PROJECT-POST-REVIEW-001' };

function deploymentEvidence(overrides = {}) {
  const base = {
    ...scope,
    status: 'EVIDENCE_PACK_COMPLETE',
    execution: {
      executionId: 'DEPLOY-001', executionEvidenceRef: 'evidence://execution/1',
      performedByRef: 'operator://1', changeWindowId: 'CW-001',
      startedAt: '2026-09-01T10:45:00.000Z', completedAt: '2026-09-01T11:10:00.000Z',
    },
    release: {
      appVersion: '1.0.0', buildId: '1.0.0-aaaaaaaaaaaa', sourceCommit: 'a'.repeat(40),
      artifactDigest: 'sha256:artifact', releaseIdentityObservedAtRuntime: true,
    },
    target: { name: 'production-primary', targetRef: 'target://production/1', kind: 'PRODUCTION' },
    runtime: {
      verifiedAt: '2026-09-01T11:15:00.000Z', evidenceCapturedAt: '2026-09-01T11:20:00.000Z',
      runtimeEvidenceRef: 'evidence://runtime/1', healthCheckPassed: true, smokeTestsPassed: true,
      realBrowserE2ePassed: true, fatalConsoleErrors: 0, pageErrors: 0,
    },
    rollback: {
      knownGoodReleaseRef: 'release://known-good/1', evidenceRef: 'evidence://rollback/1',
      rollbackProcedureAvailable: true, rollbackTargetVerified: true,
    },
    evidenceRefs: ['evidence://execution/1', 'evidence://runtime/1', 'evidence://rollback/1', 'release://known-good/1'],
    productionExecutionEvidenceRecorded: true,
    releaseIdentityObserved: true,
    runtimeVerificationRecorded: true,
    observabilityEvidenceRecorded: true,
    rollbackReadinessRecorded: true,
    readyForPostDeploymentHumanReview: true,
    productionDeploymentVerifiedByThisModule: false,
    productionUseAuthorizedByThisModule: false,
    transactionAuthorized: false,
  };
  return { ...base, ...overrides };
}

function review(overrides = {}) {
  const base = {
    reviewId: 'PDR-001',
    outcome: OUTCOME.ACCEPT_PRODUCTION_SERVICE,
    reviewedByRef: 'reviewer://production/1',
    reviewedAt: '2026-09-01T11:30:00Z',
    reviewEvidenceRef: 'evidence://post-review/1',
    conflictDeclarationCompleted: true,
    acknowledgements: {
      releaseIdentityReviewed: true,
      runtimeEvidenceReviewed: true,
      incidentSummaryReviewed: true,
      observabilityReviewed: true,
      rollbackReadinessReviewed: true,
      humanAccountabilityAccepted: true,
    },
    monitoringConditions: [],
  };
  return { ...base, ...overrides, acknowledgements: { ...base.acknowledgements, ...(overrides.acknowledgements || {}) } };
}

function refs(ev = deploymentEvidence(), rv = review(), extra = []) {
  return [...new Set([
    ...ev.evidenceRefs,
    ev.execution.executionEvidenceRef,
    ev.runtime.runtimeEvidenceRef,
    ev.rollback.evidenceRef,
    rv.reviewedByRef,
    rv.reviewEvidenceRef,
    ...extra,
  ])];
}

function base(overrides = {}) {
  const ev = overrides.postDeploymentEvidence || deploymentEvidence();
  const rv = overrides.review || review();
  return { ...scope, postDeploymentEvidence: ev, review: rv, evidenceRefs: refs(ev, rv), ...overrides };
}

let checks = 0;
function check(name, fn) { fn(); checks += 1; console.log(`PASS ${name}`); }

check('unconditional human acceptance records service acceptance without software self-authorization', () => {
  const out = recordPostDeploymentHumanReview(base());
  assert.strictEqual(out.status, STATUS.REVIEW_RECORDED);
  assert.strictEqual(out.humanPostDeploymentReviewRecorded, true);
  assert.strictEqual(out.productionServiceUseApprovedByHuman, true);
  assert.strictEqual(out.monitoringConditionsRemain, false);
  assert.strictEqual(out.rollbackRequiredByHuman, false);
  assert.strictEqual(out.productionUseAuthorizedByThisModule, false);
  assert.strictEqual(out.productionDeploymentVerifiedByThisModule, false);
  assert.strictEqual(out.productionSecurityCertified, false);
  assert.strictEqual(out.legalApprovalEstablished, false);
  assert.strictEqual(out.certifiedValuationEstablished, false);
  assert.strictEqual(out.transactionAuthorized, false);
});

check('scope mismatch fails closed', () => {
  const ev = deploymentEvidence({ projectId: 'OTHER' });
  assert.strictEqual(recordPostDeploymentHumanReview(base({ postDeploymentEvidence: ev })).status, STATUS.HOLD_SCOPE);
});

check('incomplete post-deployment evidence cannot be reviewed as complete', () => {
  const ev = deploymentEvidence({ readyForPostDeploymentHumanReview: false });
  assert.strictEqual(recordPostDeploymentHumanReview(base({ postDeploymentEvidence: ev })).status, STATUS.HOLD_DEPLOYMENT_EVIDENCE);
});

check('review metadata and timezone-explicit timestamp are mandatory', () => {
  assert.strictEqual(recordPostDeploymentHumanReview(base({ review: review({ reviewedByRef: '' }) })).status, STATUS.HOLD_REVIEW_METADATA);
  assert.strictEqual(recordPostDeploymentHumanReview(base({ review: review({ reviewedAt: '2026-09-01T11:30:00' }) })).status, STATUS.HOLD_REVIEW_METADATA);
  assert.strictEqual(recordPostDeploymentHumanReview(base({ review: review({ conflictDeclarationCompleted: false }) })).status, STATUS.HOLD_REVIEW_METADATA);
});

check('review cannot predate captured runtime evidence', () => {
  assert.strictEqual(recordPostDeploymentHumanReview(base({ review: review({ reviewedAt: '2026-09-01T11:19:59Z' }) })).status, STATUS.HOLD_TIMELINE);
});

check('all human acknowledgements are mandatory', () => {
  const rv = review({ acknowledgements: { runtimeEvidenceReviewed: false } });
  assert.strictEqual(recordPostDeploymentHumanReview(base({ review: rv })).status, STATUS.HOLD_ACKNOWLEDGEMENTS);
});

check('conditional acceptance requires explicit unique monitoring conditions', () => {
  const empty = review({ outcome: OUTCOME.ACCEPT_WITH_MONITORING_CONDITIONS });
  assert.strictEqual(recordPostDeploymentHumanReview(base({ review: empty })).status, STATUS.HOLD_CONDITIONS);

  const duplicate = review({
    outcome: OUTCOME.ACCEPT_WITH_MONITORING_CONDITIONS,
    monitoringConditions: [
      { conditionId: 'MON-1', description: 'Watch error rate', ownerRef: 'owner://ops/1', monitoringEvidenceRef: 'evidence://monitor/1' },
      { conditionId: 'MON-1', description: 'Watch latency', ownerRef: 'owner://ops/2', monitoringEvidenceRef: 'evidence://monitor/2' },
    ],
  });
  assert.strictEqual(recordPostDeploymentHumanReview(base({ review: duplicate })).status, STATUS.HOLD_CONDITIONS);
});

check('conditional acceptance preserves monitoring obligations and evidence chain', () => {
  const condition = { conditionId: 'MON-1', description: 'Monitor error rate for controlled operation', ownerRef: 'owner://ops/1', monitoringEvidenceRef: 'evidence://monitor/1' };
  const rv = review({ outcome: OUTCOME.ACCEPT_WITH_MONITORING_CONDITIONS, monitoringConditions: [condition] });
  const ev = deploymentEvidence();
  const out = recordPostDeploymentHumanReview(base({ review: rv, evidenceRefs: refs(ev, rv, [condition.ownerRef, condition.monitoringEvidenceRef]) }));
  assert.strictEqual(out.status, STATUS.REVIEW_RECORDED);
  assert.strictEqual(out.productionServiceUseApprovedByHuman, true);
  assert.strictEqual(out.monitoringConditionsRemain, true);
  assert.strictEqual(out.review.monitoringConditions.length, 1);
});

check('unconditional acceptance cannot hide monitoring conditions', () => {
  const condition = { conditionId: 'MON-1', description: 'Watch service', ownerRef: 'owner://ops/1', monitoringEvidenceRef: 'evidence://monitor/1' };
  const rv = review({ monitoringConditions: [condition] });
  assert.strictEqual(recordPostDeploymentHumanReview(base({ review: rv })).status, STATUS.HOLD_CONDITIONS);
});

check('hold service is recorded without production-service acceptance', () => {
  const rv = review({ outcome: OUTCOME.HOLD_SERVICE });
  const out = recordPostDeploymentHumanReview(base({ review: rv }));
  assert.strictEqual(out.status, STATUS.REVIEW_RECORDED);
  assert.strictEqual(out.productionServiceUseApprovedByHuman, false);
  assert.strictEqual(out.rollbackRequiredByHuman, false);
});

check('require rollback is recorded explicitly without service acceptance', () => {
  const rv = review({ outcome: OUTCOME.REQUIRE_ROLLBACK });
  const out = recordPostDeploymentHumanReview(base({ review: rv }));
  assert.strictEqual(out.status, STATUS.REVIEW_RECORDED);
  assert.strictEqual(out.productionServiceUseApprovedByHuman, false);
  assert.strictEqual(out.rollbackRequiredByHuman, true);
  assert.strictEqual(out.transactionAuthorized, false);
});

check('hold and rollback outcomes cannot carry monitoring-acceptance conditions', () => {
  const condition = { conditionId: 'MON-1', description: 'Watch service', ownerRef: 'owner://ops/1', monitoringEvidenceRef: 'evidence://monitor/1' };
  for (const outcome of [OUTCOME.HOLD_SERVICE, OUTCOME.REQUIRE_ROLLBACK]) {
    const rv = review({ outcome, monitoringConditions: [condition] });
    assert.strictEqual(recordPostDeploymentHumanReview(base({ review: rv })).status, STATUS.HOLD_CONDITIONS);
  }
});

check('human review evidence chain is fail-closed', () => {
  const input = base();
  input.evidenceRefs = input.evidenceRefs.filter((ref) => ref !== input.review.reviewEvidenceRef);
  assert.strictEqual(recordPostDeploymentHumanReview(input).status, STATUS.HOLD_EVIDENCE_CHAIN);
});

console.log(`POST_DEPLOYMENT_HUMAN_REVIEW_V1=PASS checks=${checks}`);
