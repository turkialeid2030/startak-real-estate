'use strict';

const assert = require('assert');
const {
  CONTROLLED_PRODUCTION_ACTIVATION_STATUS: STATUS,
  buildControlledProductionActivation,
} = require('../../src/production-readiness/controlled-production-activation');

const scope = { caseId: 'CASE-ACT-001', projectId: 'PROJECT-ACT-001' };
const sourceCommit = 'a'.repeat(40);

function humanDecision(overrides = {}) {
  const base = {
    ...scope,
    status: 'DECISION_RECORDED',
    humanDecisionRecorded: true,
    humanGoLiveApproved: true,
    deploymentExecuted: false,
    transactionAuthorized: false,
    decision: {
      decisionId: 'GLD-001',
      outcome: 'APPROVE_CONTROLLED_PRODUCTION',
      decidedByRef: 'reviewer://go-live/1',
      decidedAt: '2026-09-01T10:00:00Z',
      decisionEvidenceRef: 'evidence://human-decision/1',
      conditions: [],
    },
    evidenceRefs: ['evidence://institutional/1', 'reviewer://go-live/1', 'evidence://human-decision/1'],
  };
  return { ...base, ...overrides, decision: { ...base.decision, ...(overrides.decision || {}) } };
}

function stagingEvidence(overrides = {}) {
  const base = {
    ...scope,
    status: 'EVIDENCE_PACK_COMPLETE',
    environment: { kind: 'STAGING', name: 'staging', url: 'https://staging.example.invalid' },
    release: {
      version: '1.0.0', commitSha: sourceCommit, releaseRef: 'release://1.0.0/staging', artifactDigest: 'sha256:abc',
    },
    readyForProductionReadinessAudit: true,
    productionDeploymentAuthorized: false,
    transactionAuthorized: false,
    evidenceRefs: ['release://1.0.0/staging', 'evidence://staging/runtime', 'evidence://staging/rollback'],
  };
  return { ...base, ...overrides, environment: { ...base.environment, ...(overrides.environment || {}) }, release: { ...base.release, ...(overrides.release || {}) } };
}

function manifest(overrides = {}) {
  return {
    schemaVersion: 1,
    appVersion: '1.0.0',
    buildId: `1.0.0-${sourceCommit.slice(0, 12)}`,
    sourceCommit,
    sourceCommitBound: true,
    buildEnvironment: 'github-actions',
    deploymentVerified: false,
    productionDeploymentAuthorized: false,
    evidenceBoundary: 'BUILD_TRACE_ONLY_NOT_DEPLOYMENT_PROOF',
    ...overrides,
  };
}

function target(overrides = {}) {
  return { targetDeclared: true, kind: 'PRODUCTION', name: 'production-primary', targetRef: 'target://production/primary', ...overrides };
}

function changeWindow(overrides = {}) {
  return {
    windowId: 'CW-001',
    startsAt: '2026-09-01T13:00:00+03:00',
    endsAt: '2026-09-01T15:00:00+03:00',
    plannedExecutionAt: '2026-09-01T14:00:00+03:00',
    approvedByRef: 'reviewer://change/1',
    approvalEvidenceRef: 'evidence://change-window/1',
    rollbackWindowAcknowledged: true,
    ...overrides,
  };
}

function operator(overrides = {}) {
  return {
    operatorRef: 'operator://deployment/1',
    verified: true,
    humanOperator: true,
    accountabilityAccepted: true,
    authorizationBasisRef: 'evidence://operator-authorization/1',
    ...overrides,
  };
}

function requiredRefs(human = humanDecision(), staging = stagingEvidence(), extra = []) {
  return [...new Set([
    ...human.evidenceRefs,
    ...staging.evidenceRefs,
    staging.release.releaseRef,
    human.decision.decidedByRef,
    human.decision.decisionEvidenceRef,
    target().targetRef,
    changeWindow().approvedByRef,
    changeWindow().approvalEvidenceRef,
    operator().operatorRef,
    operator().authorizationBasisRef,
    ...extra,
  ])];
}

function base(overrides = {}) {
  const human = overrides.humanGoLiveDecision || humanDecision();
  const staging = overrides.stagingDeploymentEvidence || stagingEvidence();
  return {
    ...scope,
    humanGoLiveDecision: human,
    stagingDeploymentEvidence: staging,
    releaseManifest: manifest(),
    productionTarget: target(),
    changeWindow: changeWindow(),
    operator: operator(),
    conditionResolutions: [],
    evidenceRefs: requiredRefs(human, staging),
    ...overrides,
  };
}

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`PASS ${name}`);
}

check('ready state binds approved human decision to exact staged source release without executing deployment', () => {
  const out = buildControlledProductionActivation(base());
  assert.strictEqual(out.status, STATUS.READY_FOR_CONTROLLED_PRODUCTION_ACTIVATION);
  assert.strictEqual(out.humanApprovalConfirmed, true);
  assert.strictEqual(out.stagingEvidenceConfirmed, true);
  assert.strictEqual(out.releaseIdentityBound, true);
  assert.strictEqual(out.conditionsResolved, true);
  assert.strictEqual(out.deploymentExecutionReadyForAuthorizedOperator, true);
  assert.strictEqual(out.deploymentExecutionAuthorizedByThisModule, false);
  assert.strictEqual(out.deploymentExecuted, false);
  assert.strictEqual(out.productionDeploymentVerified, false);
  assert.strictEqual(out.productionUseAuthorizedByThisModule, false);
  assert.strictEqual(out.productionSecurityCertified, false);
  assert.strictEqual(out.legalApprovalEstablished, false);
  assert.strictEqual(out.certifiedValuationEstablished, false);
  assert.strictEqual(out.transactionAuthorized, false);
  assert.strictEqual(out.sourceRelease.sourceCommit, sourceCommit);
  assert.strictEqual(out.changeWindow.plannedExecutionAt, '2026-09-01T11:00:00.000Z');
});

check('defer or reject cannot reach activation readiness', () => {
  for (const outcome of ['DEFER', 'REJECT']) {
    const human = humanDecision({ humanGoLiveApproved: false, decision: { outcome } });
    const out = buildControlledProductionActivation(base({ humanGoLiveDecision: human, evidenceRefs: requiredRefs(human) }));
    assert.strictEqual(out.status, STATUS.HOLD_HUMAN_DECISION);
  }
});

check('scope mismatch fails closed', () => {
  const staging = stagingEvidence({ caseId: 'OTHER' });
  const out = buildControlledProductionActivation(base({ stagingDeploymentEvidence: staging }));
  assert.strictEqual(out.status, STATUS.HOLD_SCOPE);
});

check('prior deployment evidence must be STAGING, never already-production evidence', () => {
  const staging = stagingEvidence({ environment: { kind: 'PRODUCTION' } });
  const out = buildControlledProductionActivation(base({ stagingDeploymentEvidence: staging, evidenceRefs: requiredRefs(humanDecision(), staging) }));
  assert.strictEqual(out.status, STATUS.HOLD_STAGING_EVIDENCE);
});

check('release manifest must be source-bound and exactly match staged release', () => {
  assert.strictEqual(buildControlledProductionActivation(base({ releaseManifest: manifest({ sourceCommitBound: false }) })).status, STATUS.HOLD_RELEASE_BINDING);
  assert.strictEqual(buildControlledProductionActivation(base({ releaseManifest: manifest({ sourceCommit: 'b'.repeat(40) }) })).status, STATUS.HOLD_RELEASE_BINDING);
  assert.strictEqual(buildControlledProductionActivation(base({ releaseManifest: manifest({ appVersion: '9.9.9' }) })).status, STATUS.HOLD_RELEASE_BINDING);
});

check('production target must be explicit', () => {
  assert.strictEqual(buildControlledProductionActivation(base({ productionTarget: target({ kind: 'STAGING' }) })).status, STATUS.HOLD_TARGET);
  assert.strictEqual(buildControlledProductionActivation(base({ productionTarget: target({ targetRef: ' ' }) })).status, STATUS.HOLD_TARGET);
});

check('change window requires timezone, ordering, approval, and execution inside window', () => {
  assert.strictEqual(buildControlledProductionActivation(base({ changeWindow: changeWindow({ startsAt: '2026-09-01T13:00:00' }) })).status, STATUS.HOLD_CHANGE_WINDOW);
  assert.strictEqual(buildControlledProductionActivation(base({ changeWindow: changeWindow({ endsAt: '2026-09-01T12:00:00+03:00' }) })).status, STATUS.HOLD_CHANGE_WINDOW);
  assert.strictEqual(buildControlledProductionActivation(base({ changeWindow: changeWindow({ plannedExecutionAt: '2026-09-01T16:00:00+03:00' }) })).status, STATUS.HOLD_CHANGE_WINDOW);
  assert.strictEqual(buildControlledProductionActivation(base({ changeWindow: changeWindow({ rollbackWindowAcknowledged: false }) })).status, STATUS.HOLD_CHANGE_WINDOW);
});

check('planned production execution cannot precede human decision', () => {
  const human = humanDecision({ decision: { decidedAt: '2026-09-01T12:00:01Z' } });
  const out = buildControlledProductionActivation(base({ humanGoLiveDecision: human, evidenceRefs: requiredRefs(human) }));
  assert.strictEqual(out.status, STATUS.HOLD_CHANGE_WINDOW);
});

check('verified accountable human operator is mandatory', () => {
  assert.strictEqual(buildControlledProductionActivation(base({ operator: operator({ verified: false }) })).status, STATUS.HOLD_OPERATOR);
  assert.strictEqual(buildControlledProductionActivation(base({ operator: operator({ humanOperator: false }) })).status, STATUS.HOLD_OPERATOR);
  assert.strictEqual(buildControlledProductionActivation(base({ operator: operator({ authorizationBasisRef: '' }) })).status, STATUS.HOLD_OPERATOR);
});

check('conditional human approval requires every condition resolved before execution', () => {
  const human = humanDecision({
    decision: {
      outcome: 'APPROVE_WITH_CONDITIONS',
      conditions: [{ conditionId: 'COND-1', description: 'Close release checklist', ownerRef: 'owner://condition/1', evidenceRequired: true, evidenceRef: 'evidence://condition/original' }],
    },
    evidenceRefs: [
      'evidence://institutional/1', 'reviewer://go-live/1', 'evidence://human-decision/1',
      'owner://condition/1', 'evidence://condition/original',
    ],
  });
  const staging = stagingEvidence();
  const missing = buildControlledProductionActivation(base({
    humanGoLiveDecision: human,
    evidenceRefs: requiredRefs(human, staging),
  }));
  assert.strictEqual(missing.status, STATUS.HOLD_CONDITIONS);

  const resolution = {
    conditionId: 'COND-1', satisfied: true,
    resolvedByRef: 'reviewer://condition/1',
    resolvedAt: '2026-09-01T10:30:00Z',
    resolutionEvidenceRef: 'evidence://condition/resolution/1',
  };
  const ready = buildControlledProductionActivation(base({
    humanGoLiveDecision: human,
    conditionResolutions: [resolution],
    evidenceRefs: requiredRefs(human, staging, [resolution.resolvedByRef, resolution.resolutionEvidenceRef]),
  }));
  assert.strictEqual(ready.status, STATUS.READY_FOR_CONTROLLED_PRODUCTION_ACTIVATION);
  assert.strictEqual(ready.conditionResolutions.length, 1);
});

check('condition resolved after planned execution is rejected', () => {
  const human = humanDecision({
    decision: {
      outcome: 'APPROVE_WITH_CONDITIONS',
      conditions: [{ conditionId: 'COND-1', description: 'Close item', ownerRef: 'owner://condition/1', evidenceRequired: false, evidenceRef: null }],
    },
    evidenceRefs: ['evidence://institutional/1', 'reviewer://go-live/1', 'evidence://human-decision/1', 'owner://condition/1'],
  });
  const resolution = {
    conditionId: 'COND-1', satisfied: true, resolvedByRef: 'reviewer://condition/1',
    resolvedAt: '2026-09-01T12:00:01Z', resolutionEvidenceRef: 'evidence://condition/resolution/1',
  };
  const out = buildControlledProductionActivation(base({
    humanGoLiveDecision: human,
    conditionResolutions: [resolution],
    evidenceRefs: requiredRefs(human, stagingEvidence(), [resolution.resolvedByRef, resolution.resolutionEvidenceRef]),
  }));
  assert.strictEqual(out.status, STATUS.HOLD_CONDITIONS);
});

check('unconditional approval cannot carry hidden conditions', () => {
  const human = humanDecision({
    decision: {
      outcome: 'APPROVE_CONTROLLED_PRODUCTION',
      conditions: [{ conditionId: 'COND-HIDDEN', description: 'Hidden condition', ownerRef: 'owner://hidden', evidenceRequired: false, evidenceRef: null }],
    },
    evidenceRefs: ['evidence://institutional/1', 'reviewer://go-live/1', 'evidence://human-decision/1', 'owner://hidden'],
  });
  const resolution = {
    conditionId: 'COND-HIDDEN', satisfied: true, resolvedByRef: 'reviewer://hidden',
    resolvedAt: '2026-09-01T10:30:00Z', resolutionEvidenceRef: 'evidence://hidden/resolution',
  };
  const out = buildControlledProductionActivation(base({
    humanGoLiveDecision: human,
    conditionResolutions: [resolution],
    evidenceRefs: requiredRefs(human, stagingEvidence(), [resolution.resolvedByRef, resolution.resolutionEvidenceRef]),
  }));
  assert.strictEqual(out.status, STATUS.HOLD_CONDITIONS);
});

check('evidence chain is fail-closed', () => {
  const input = base();
  input.evidenceRefs = input.evidenceRefs.filter((ref) => ref !== input.operator.authorizationBasisRef);
  const out = buildControlledProductionActivation(input);
  assert.strictEqual(out.status, STATUS.HOLD_EVIDENCE_CHAIN);
});

console.log(`CONTROLLED_PRODUCTION_ACTIVATION_V1=PASS checks=${checks}`);
