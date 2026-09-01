'use strict';

const assert = require('assert');
const {
  PRODUCTION_ROLLBACK_STATUS: STATUS,
  buildProductionRollbackExecutionEvidence,
} = require('../../src/production-readiness/production-rollback-execution-evidence');

const scope = { caseId: 'CASE-RB-001', projectId: 'PROJECT-RB-001' };
const currentCommit = 'a'.repeat(40);
const targetCommit = 'b'.repeat(40);

function continuityDecision(overrides = {}) {
  const base = {
    ...scope,
    status: 'DECISION_RECORDED',
    decision: {
      decisionId: 'CONT-RB-001',
      outcome: 'REQUIRE_ROLLBACK',
      decidedByRef: 'reviewer://continuity/rollback/1',
      decidedAt: '2026-09-01T15:00:00+03:00',
      decisionEvidenceRef: 'evidence://continuity/rollback-decision/1',
    },
    rollbackRequiredByHuman: true,
    rollbackExecuted: false,
    evidenceRefs: ['reviewer://continuity/rollback/1', 'evidence://continuity/rollback-decision/1'],
  };
  return { ...base, ...overrides };
}

function postDeploymentDecision(overrides = {}) {
  const base = {
    ...scope,
    status: 'REVIEW_RECORDED',
    review: {
      reviewId: 'POST-RB-001',
      outcome: 'REQUIRE_ROLLBACK',
      reviewedByRef: 'reviewer://post/rollback/1',
      reviewedAt: '2026-09-01T15:00:00+03:00',
      reviewEvidenceRef: 'evidence://post/rollback-decision/1',
    },
    rollbackRequiredByHuman: true,
    productionUseAuthorizedByThisModule: false,
    evidenceRefs: ['reviewer://post/rollback/1', 'evidence://post/rollback-decision/1'],
  };
  return { ...base, ...overrides };
}

function release(kind, overrides = {}) {
  const current = {
    appVersion: '1.2.0',
    buildId: '1.2.0-aaaaaaaaaaaa',
    sourceCommit: currentCommit,
    releaseRef: 'release://production/current',
    artifactDigest: 'sha256:current-artifact',
  };
  const target = {
    appVersion: '1.1.9',
    buildId: '1.1.9-bbbbbbbbbbbb',
    sourceCommit: targetCommit,
    releaseRef: 'release://known-good/previous',
    artifactDigest: 'sha256:target-artifact',
  };
  return { ...(kind === 'current' ? current : target), ...overrides };
}

function plan(overrides = {}) {
  return {
    planId: 'RB-PLAN-001',
    approvedByRef: 'reviewer://rollback-plan/1',
    approvalEvidenceRef: 'evidence://rollback-plan/1',
    operatorRef: 'operator://rollback/1',
    currentRelease: release('current'),
    targetRelease: release('target'),
    ...overrides,
  };
}

function execution(overrides = {}) {
  return {
    rollbackCompleted: true,
    executionId: 'RB-EXEC-001',
    planId: 'RB-PLAN-001',
    performedByRef: 'operator://rollback/1',
    startedAt: '2026-09-01T15:10:00+03:00',
    completedAt: '2026-09-01T15:20:00+03:00',
    executionEvidenceRef: 'evidence://rollback-execution/1',
    targetRelease: release('target'),
    ...overrides,
  };
}

function runtime(overrides = {}) {
  return {
    healthCheckPassed: true,
    smokeTestsPassed: true,
    realBrowserE2ePassed: true,
    fatalConsoleErrors: 0,
    pageErrors: 0,
    observedBuildId: '1.1.9-bbbbbbbbbbbb',
    observedSourceCommit: targetCommit,
    verifiedAt: '2026-09-01T15:25:00+03:00',
    evidenceCapturedAt: '2026-09-01T15:30:00+03:00',
    runtimeEvidenceRef: 'evidence://rollback-runtime/1',
    ...overrides,
  };
}

function refs(decision, rollbackPlan, exec, run) {
  return [...new Set([
    ...(decision.evidenceRefs || []),
    decision.decision?.decidedByRef,
    decision.decision?.decisionEvidenceRef,
    decision.review?.reviewedByRef,
    decision.review?.reviewEvidenceRef,
    rollbackPlan.approvedByRef,
    rollbackPlan.approvalEvidenceRef,
    rollbackPlan.operatorRef,
    rollbackPlan.currentRelease.releaseRef,
    rollbackPlan.targetRelease.releaseRef,
    exec.executionEvidenceRef,
    run.runtimeEvidenceRef,
  ].filter(Boolean))];
}

function base(overrides = {}) {
  const d = overrides.humanRollbackDecision || continuityDecision();
  const p = overrides.rollbackPlan || plan();
  const e = overrides.execution || execution();
  const r = overrides.runtimeVerification || runtime();
  return {
    ...scope,
    humanRollbackDecision: d,
    rollbackPlan: p,
    execution: e,
    runtimeVerification: r,
    evidenceRefs: overrides.evidenceRefs || refs(d, p, e, r),
    ...overrides,
  };
}

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`PASS ${name}`);
}

check('complete rollback evidence is ready only for human rollback review', () => {
  const out = buildProductionRollbackExecutionEvidence(base());
  assert.strictEqual(out.status, STATUS.EVIDENCE_PACK_COMPLETE);
  assert.strictEqual(out.rollbackExecutionEvidenceRecorded, true);
  assert.strictEqual(out.targetReleaseRuntimeEvidenceRecorded, true);
  assert.strictEqual(out.readyForHumanRollbackReview, true);
  assert.strictEqual(out.rollbackVerifiedByThisModule, false);
  assert.strictEqual(out.productionUseAuthorizedByThisModule, false);
  assert.strictEqual(out.productionSecurityCertified, false);
  assert.strictEqual(out.legalApprovalEstablished, false);
  assert.strictEqual(out.certifiedValuationEstablished, false);
  assert.strictEqual(out.transactionAuthorized, false);
});

check('post-deployment human REQUIRE_ROLLBACK decision is also accepted as an input source', () => {
  const d = postDeploymentDecision();
  const out = buildProductionRollbackExecutionEvidence(base({ humanRollbackDecision: d }));
  assert.strictEqual(out.status, STATUS.EVIDENCE_PACK_COMPLETE);
  assert.strictEqual(out.humanRollbackDecision.source, 'POST_DEPLOYMENT_REVIEW');
});

check('scope mismatch fails closed', () => {
  assert.strictEqual(buildProductionRollbackExecutionEvidence(base({ humanRollbackDecision: continuityDecision({ projectId: 'OTHER' }) })).status, STATUS.HOLD_SCOPE);
});

check('explicit human REQUIRE_ROLLBACK outcome is mandatory', () => {
  const d = continuityDecision({
    decision: { ...continuityDecision().decision, outcome: 'CONTINUE_SERVICE' },
    rollbackRequiredByHuman: false,
  });
  assert.strictEqual(buildProductionRollbackExecutionEvidence(base({ humanRollbackDecision: d })).status, STATUS.HOLD_HUMAN_DECISION);
});

check('rollback plan and accountable operator evidence are mandatory', () => {
  assert.strictEqual(buildProductionRollbackExecutionEvidence(base({ rollbackPlan: plan({ approvalEvidenceRef: '' }) })).status, STATUS.HOLD_PLAN);
  assert.strictEqual(buildProductionRollbackExecutionEvidence(base({ rollbackPlan: plan({ operatorRef: '' }) })).status, STATUS.HOLD_PLAN);
});

check('rollback target must be distinct from the current release', () => {
  const p = plan({ targetRelease: release('current', { releaseRef: 'release://production/current' }) });
  assert.strictEqual(buildProductionRollbackExecutionEvidence(base({ rollbackPlan: p })).status, STATUS.HOLD_RELEASE_BINDING);
});

check('rollback execution must match the approved plan and operator', () => {
  assert.strictEqual(buildProductionRollbackExecutionEvidence(base({ execution: execution({ planId: 'OTHER' }) })).status, STATUS.HOLD_EXECUTION);
  assert.strictEqual(buildProductionRollbackExecutionEvidence(base({ execution: execution({ performedByRef: 'operator://other' }) })).status, STATUS.HOLD_EXECUTION);
  assert.strictEqual(buildProductionRollbackExecutionEvidence(base({ execution: execution({ rollbackCompleted: false }) })).status, STATUS.HOLD_EXECUTION);
});

check('rollback cannot begin before the human rollback decision and must complete after start', () => {
  assert.strictEqual(buildProductionRollbackExecutionEvidence(base({ execution: execution({ startedAt: '2026-09-01T14:59:59+03:00' }) })).status, STATUS.HOLD_TIMELINE);
  assert.strictEqual(buildProductionRollbackExecutionEvidence(base({ execution: execution({ startedAt: '2026-09-01T15:20:00+03:00', completedAt: '2026-09-01T15:19:59+03:00' }) })).status, STATUS.HOLD_TIMELINE);
});

check('executed target release must exactly match the approved rollback target', () => {
  const e = execution({ targetRelease: release('target', { buildId: '1.1.9-other' }) });
  assert.strictEqual(buildProductionRollbackExecutionEvidence(base({ execution: e })).status, STATUS.HOLD_RELEASE_BINDING);
});

check('post-rollback runtime verification must observe exact approved target identity after completion', () => {
  assert.strictEqual(buildProductionRollbackExecutionEvidence(base({ runtimeVerification: runtime({ healthCheckPassed: false }) })).status, STATUS.HOLD_RUNTIME);
  assert.strictEqual(buildProductionRollbackExecutionEvidence(base({ runtimeVerification: runtime({ fatalConsoleErrors: 1 }) })).status, STATUS.HOLD_RUNTIME);
  assert.strictEqual(buildProductionRollbackExecutionEvidence(base({ runtimeVerification: runtime({ observedBuildId: 'other-build' }) })).status, STATUS.HOLD_RUNTIME);
  assert.strictEqual(buildProductionRollbackExecutionEvidence(base({ runtimeVerification: runtime({ observedSourceCommit: currentCommit }) })).status, STATUS.HOLD_RUNTIME);
  assert.strictEqual(buildProductionRollbackExecutionEvidence(base({ runtimeVerification: runtime({ verifiedAt: '2026-09-01T15:19:59+03:00' }) })).status, STATUS.HOLD_RUNTIME);
  assert.strictEqual(buildProductionRollbackExecutionEvidence(base({ runtimeVerification: runtime({ evidenceCapturedAt: '2026-09-01T15:24:00+03:00' }) })).status, STATUS.HOLD_RUNTIME);
});

check('evidence chain is mandatory and deduplicated', () => {
  const input = base();
  input.evidenceRefs = input.evidenceRefs.filter((ref) => ref !== input.runtimeVerification.runtimeEvidenceRef);
  assert.strictEqual(buildProductionRollbackExecutionEvidence(input).status, STATUS.HOLD_EVIDENCE_CHAIN);

  const complete = base();
  complete.evidenceRefs.push(complete.evidenceRefs[0]);
  const out = buildProductionRollbackExecutionEvidence(complete);
  assert.strictEqual(out.status, STATUS.EVIDENCE_PACK_COMPLETE);
  assert.strictEqual(new Set(out.evidenceRefs).size, out.evidenceRefs.length);
});

console.log(`PRODUCTION_ROLLBACK_EXECUTION_EVIDENCE_V1=PASS checks=${checks}`);
