'use strict';

const assert = require('assert');
const {
  POST_PRODUCTION_DEPLOYMENT_STATUS: STATUS,
  buildPostProductionDeploymentEvidence,
} = require('../../src/production-readiness/post-production-deployment-evidence');

const scope = { caseId: 'CASE-PROD-EV-001', projectId: 'PROJECT-PROD-EV-001' };
const sourceCommit = 'c'.repeat(40);

function activation(overrides = {}) {
  const base = {
    ...scope,
    status: 'READY_FOR_CONTROLLED_PRODUCTION_ACTIVATION',
    humanDecision: {
      decisionId: 'GLD-001', outcome: 'APPROVE_CONTROLLED_PRODUCTION',
      decidedByRef: 'reviewer://go-live/1', decidedAt: '2026-09-01T10:00:00.000Z',
    },
    sourceRelease: {
      appVersion: '1.0.0', buildId: '1.0.0-cccccccccccc', sourceCommit,
      stagingReleaseRef: 'release://staging/1', artifactDigest: 'sha256:artifact-1',
    },
    productionTarget: { name: 'production-primary', kind: 'PRODUCTION', targetRef: 'target://production/primary', url: null },
    changeWindow: {
      windowId: 'CW-001', startsAt: '2026-09-01T10:30:00.000Z', endsAt: '2026-09-01T12:00:00.000Z',
      plannedExecutionAt: '2026-09-01T11:00:00.000Z', approvedByRef: 'reviewer://change/1', approvalEvidenceRef: 'evidence://change/1',
    },
    operator: {
      operatorRef: 'operator://deployment/1', authorizationBasisRef: 'evidence://operator-auth/1',
      verified: true, humanOperator: true, accountabilityAccepted: true,
    },
    humanApprovalConfirmed: true,
    conditionsResolved: true,
    stagingEvidenceConfirmed: true,
    releaseIdentityBound: true,
    productionTargetDeclared: true,
    changeWindowValidated: true,
    humanOperatorValidated: true,
    deploymentExecutionReadyForAuthorizedOperator: true,
    deploymentExecutionAuthorizedByThisModule: false,
    deploymentExecuted: false,
    transactionAuthorized: false,
    evidenceRefs: ['evidence://human/1', 'release://staging/1', 'target://production/primary', 'operator://deployment/1', 'evidence://operator-auth/1'],
  };
  return { ...base, ...overrides };
}

function execution(overrides = {}) {
  return {
    executionId: 'DEPLOY-001',
    deploymentCompleted: true,
    performedByRef: 'operator://deployment/1',
    changeWindowId: 'CW-001',
    startedAt: '2026-09-01T10:45:00Z',
    completedAt: '2026-09-01T11:10:00Z',
    executionEvidenceRef: 'evidence://production/execution/1',
    appVersion: '1.0.0',
    buildId: '1.0.0-cccccccccccc',
    sourceCommit,
    artifactDigest: 'sha256:artifact-1',
    targetRef: 'target://production/primary',
    targetName: 'production-primary',
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
    observedBuildId: '1.0.0-cccccccccccc',
    observedSourceCommit: sourceCommit,
    verifiedAt: '2026-09-01T11:15:00Z',
    evidenceCapturedAt: '2026-09-01T11:20:00Z',
    runtimeEvidenceRef: 'evidence://production/runtime/1',
    ...overrides,
  };
}

function observability(overrides = {}) {
  return {
    monitoringConfigured: true,
    alertingConfigured: true,
    errorTrackingConfigured: true,
    healthMonitoringConfigured: true,
    evidenceRef: 'evidence://production/observability/1',
    ...overrides,
  };
}

function rollback(overrides = {}) {
  return {
    rollbackProcedureAvailable: true,
    rollbackTargetVerified: true,
    knownGoodReleaseRef: 'release://known-good/previous',
    evidenceRef: 'evidence://production/rollback/1',
    ...overrides,
  };
}

function refs(act = activation(), exec = execution(), run = runtime(), obs = observability(), rb = rollback()) {
  return [...new Set([
    ...act.evidenceRefs,
    act.productionTarget.targetRef,
    act.operator.operatorRef,
    act.operator.authorizationBasisRef,
    exec.executionEvidenceRef,
    exec.performedByRef,
    run.runtimeEvidenceRef,
    obs.evidenceRef,
    rb.knownGoodReleaseRef,
    rb.evidenceRef,
  ])];
}

function base(overrides = {}) {
  const act = overrides.activation || activation();
  const exec = overrides.execution || execution();
  const run = overrides.runtimeVerification || runtime();
  const obs = overrides.observability || observability();
  const rb = overrides.rollback || rollback();
  return {
    ...scope,
    activation: act,
    execution: exec,
    runtimeVerification: run,
    observability: obs,
    rollback: rb,
    incidents: [],
    evidenceRefs: refs(act, exec, run, obs, rb),
    ...overrides,
  };
}

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`PASS ${name}`);
}

check('positive evidence pack records production execution evidence without self-attestation', () => {
  const out = buildPostProductionDeploymentEvidence(base());
  assert.strictEqual(out.status, STATUS.EVIDENCE_PACK_COMPLETE);
  assert.strictEqual(out.productionExecutionEvidenceRecorded, true);
  assert.strictEqual(out.releaseIdentityObserved, true);
  assert.strictEqual(out.runtimeVerificationRecorded, true);
  assert.strictEqual(out.observabilityEvidenceRecorded, true);
  assert.strictEqual(out.rollbackReadinessRecorded, true);
  assert.strictEqual(out.readyForPostDeploymentHumanReview, true);
  assert.strictEqual(out.productionDeploymentVerifiedByThisModule, false);
  assert.strictEqual(out.productionUseAuthorizedByThisModule, false);
  assert.strictEqual(out.productionSecurityCertified, false);
  assert.strictEqual(out.legalApprovalEstablished, false);
  assert.strictEqual(out.certifiedValuationEstablished, false);
  assert.strictEqual(out.transactionAuthorized, false);
});

check('scope mismatch fails closed', () => {
  const act = activation({ caseId: 'OTHER' });
  assert.strictEqual(buildPostProductionDeploymentEvidence(base({ activation: act })).status, STATUS.HOLD_SCOPE);
});

check('activation gate must be ready and non-executing', () => {
  assert.strictEqual(buildPostProductionDeploymentEvidence(base({ activation: activation({ status: 'HOLD_RELEASE_BINDING' }) })).status, STATUS.HOLD_ACTIVATION);
  assert.strictEqual(buildPostProductionDeploymentEvidence(base({ activation: activation({ deploymentExecuted: true }) })).status, STATUS.HOLD_ACTIVATION);
  assert.strictEqual(buildPostProductionDeploymentEvidence(base({ activation: activation({ transactionAuthorized: true }) })).status, STATUS.HOLD_ACTIVATION);
});

check('production execution must match exact approved release identity', () => {
  assert.strictEqual(buildPostProductionDeploymentEvidence(base({ execution: execution({ sourceCommit: 'd'.repeat(40) }) })).status, STATUS.HOLD_RELEASE);
  assert.strictEqual(buildPostProductionDeploymentEvidence(base({ execution: execution({ buildId: 'other-build' }) })).status, STATUS.HOLD_RELEASE);
  assert.strictEqual(buildPostProductionDeploymentEvidence(base({ execution: execution({ appVersion: '2.0.0' }) })).status, STATUS.HOLD_RELEASE);
  assert.strictEqual(buildPostProductionDeploymentEvidence(base({ execution: execution({ artifactDigest: 'sha256:other' }) })).status, STATUS.HOLD_RELEASE);
});

check('production execution must match approved target', () => {
  assert.strictEqual(buildPostProductionDeploymentEvidence(base({ execution: execution({ targetRef: 'target://other' }) })).status, STATUS.HOLD_TARGET);
  assert.strictEqual(buildPostProductionDeploymentEvidence(base({ execution: execution({ targetName: 'other-production' }) })).status, STATUS.HOLD_TARGET);
});

check('only the approved human operator and change window may be recorded', () => {
  assert.strictEqual(buildPostProductionDeploymentEvidence(base({ execution: execution({ performedByRef: 'operator://other' }) })).status, STATUS.HOLD_EXECUTION);
  assert.strictEqual(buildPostProductionDeploymentEvidence(base({ execution: execution({ changeWindowId: 'CW-OTHER' }) })).status, STATUS.HOLD_EXECUTION);
  assert.strictEqual(buildPostProductionDeploymentEvidence(base({ execution: execution({ deploymentCompleted: false }) })).status, STATUS.HOLD_EXECUTION);
});

check('execution must remain wholly inside approved timezone-aware window', () => {
  assert.strictEqual(buildPostProductionDeploymentEvidence(base({ execution: execution({ startedAt: '2026-09-01T10:00:00Z' }) })).status, STATUS.HOLD_TIMELINE);
  assert.strictEqual(buildPostProductionDeploymentEvidence(base({ execution: execution({ completedAt: '2026-09-01T12:00:01Z' }) })).status, STATUS.HOLD_TIMELINE);
  assert.strictEqual(buildPostProductionDeploymentEvidence(base({ execution: execution({ startedAt: '2026-09-01T10:45:00', completedAt: '2026-09-01T11:10:00Z' }) })).status, STATUS.HOLD_TIMELINE);
  assert.strictEqual(buildPostProductionDeploymentEvidence(base({ execution: execution({ startedAt: '2026-09-01T11:20:00Z', completedAt: '2026-09-01T11:10:00Z' }) })).status, STATUS.HOLD_TIMELINE);
});

check('runtime verification must occur after deployment and observe exact build identity', () => {
  assert.strictEqual(buildPostProductionDeploymentEvidence(base({ runtimeVerification: runtime({ healthCheckPassed: false }) })).status, STATUS.HOLD_RUNTIME);
  assert.strictEqual(buildPostProductionDeploymentEvidence(base({ runtimeVerification: runtime({ fatalConsoleErrors: 1 }) })).status, STATUS.HOLD_RUNTIME);
  assert.strictEqual(buildPostProductionDeploymentEvidence(base({ runtimeVerification: runtime({ observedBuildId: 'other-build' }) })).status, STATUS.HOLD_RUNTIME);
  assert.strictEqual(buildPostProductionDeploymentEvidence(base({ runtimeVerification: runtime({ observedSourceCommit: 'd'.repeat(40) }) })).status, STATUS.HOLD_RUNTIME);
  assert.strictEqual(buildPostProductionDeploymentEvidence(base({ runtimeVerification: runtime({ verifiedAt: '2026-09-01T11:00:00Z' }) })).status, STATUS.HOLD_RUNTIME);
  assert.strictEqual(buildPostProductionDeploymentEvidence(base({ runtimeVerification: runtime({ evidenceCapturedAt: '2026-09-01T11:14:00Z' }) })).status, STATUS.HOLD_RUNTIME);
});

check('observability evidence is mandatory', () => {
  assert.strictEqual(buildPostProductionDeploymentEvidence(base({ observability: observability({ alertingConfigured: false }) })).status, STATUS.HOLD_OBSERVABILITY);
  assert.strictEqual(buildPostProductionDeploymentEvidence(base({ observability: observability({ evidenceRef: '' }) })).status, STATUS.HOLD_OBSERVABILITY);
});

check('rollback readiness and known-good release evidence are mandatory', () => {
  assert.strictEqual(buildPostProductionDeploymentEvidence(base({ rollback: rollback({ rollbackTargetVerified: false }) })).status, STATUS.HOLD_ROLLBACK);
  assert.strictEqual(buildPostProductionDeploymentEvidence(base({ rollback: rollback({ knownGoodReleaseRef: '' }) })).status, STATUS.HOLD_ROLLBACK);
});

check('unresolved high or critical incidents fail closed', () => {
  for (const severity of ['HIGH', 'CRITICAL']) {
    const out = buildPostProductionDeploymentEvidence(base({ incidents: [{ severity, type: 'RUNTIME', resolved: false }] }));
    assert.strictEqual(out.status, STATUS.HOLD_INCIDENTS);
  }
})();

check('any recorded data leakage incident fails closed even if marked resolved', () => {
  const out = buildPostProductionDeploymentEvidence(base({ incidents: [{ severity: 'LOW', type: 'DATA_LEAKAGE', resolved: true }] }));
  assert.strictEqual(out.status, STATUS.HOLD_INCIDENTS);
});

check('resolved non-leakage incidents may coexist with complete evidence', () => {
  const out = buildPostProductionDeploymentEvidence(base({ incidents: [{ severity: 'HIGH', type: 'RUNTIME', resolved: true }] }));
  assert.strictEqual(out.status, STATUS.EVIDENCE_PACK_COMPLETE);
  assert.strictEqual(out.incidentSummary.total, 1);
  assert.strictEqual(out.incidentSummary.unresolvedBlocking, 0);
});

check('evidence chain is mandatory and deduplicated', () => {
  const input = base();
  input.evidenceRefs = input.evidenceRefs.filter((ref) => ref !== input.runtimeVerification.runtimeEvidenceRef);
  assert.strictEqual(buildPostProductionDeploymentEvidence(input).status, STATUS.HOLD_EVIDENCE_CHAIN);

  const complete = base();
  complete.evidenceRefs.push(complete.evidenceRefs[0]);
  const out = buildPostProductionDeploymentEvidence(complete);
  assert.strictEqual(out.status, STATUS.EVIDENCE_PACK_COMPLETE);
  assert.strictEqual(new Set(out.evidenceRefs).size, out.evidenceRefs.length);
});

console.log(`POST_PRODUCTION_DEPLOYMENT_EVIDENCE_V1=PASS checks=${checks}`);
