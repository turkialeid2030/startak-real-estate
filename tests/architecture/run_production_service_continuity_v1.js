'use strict';

const assert = require('assert');
const {
  PRODUCTION_SERVICE_CONTINUITY_STATUS: STATUS,
  buildProductionServiceContinuityEvidence,
} = require('../../src/production-readiness/production-service-continuity');

const scope = { caseId: 'CASE-CONT-001', projectId: 'PROJECT-CONT-001' };

function review(overrides = {}) {
  const base = {
    ...scope,
    status: 'REVIEW_RECORDED',
    review: {
      reviewId: 'PDR-001',
      outcome: 'ACCEPT_PRODUCTION_SERVICE',
      reviewedByRef: 'reviewer://post-deploy/1',
      reviewedAt: '2026-09-01T12:30:00+03:00',
      reviewEvidenceRef: 'evidence://post-deploy/review/1',
      monitoringConditions: [],
    },
    humanPostDeploymentReviewRecorded: true,
    productionServiceUseApprovedByHuman: true,
    monitoringConditionsRemain: false,
    rollbackRequiredByHuman: false,
    productionUseAuthorizedByThisModule: false,
    transactionAuthorized: false,
    evidenceRefs: ['evidence://post-deploy/review/1', 'reviewer://post-deploy/1'],
  };
  return { ...base, ...overrides };
}

function policy(overrides = {}) {
  return {
    policyId: 'MON-POLICY-001',
    policyEvidenceRef: 'evidence://monitoring/policy/1',
    requiredSignalIds: ['APP_HEALTH', 'ERROR_CONTROL', 'BROWSER_JOURNEY'],
    blockingResults: ['FAIL'],
    ...overrides,
  };
}

function observations(overrides = {}) {
  const base = [
    { signalId: 'APP_HEALTH', observationId: 'OBS-1', observedAt: '2026-09-01T13:00:00+03:00', result: 'PASS', evidenceRef: 'evidence://obs/1', observedByRef: 'operator://monitor/1' },
    { signalId: 'ERROR_CONTROL', observationId: 'OBS-2', observedAt: '2026-09-01T13:05:00+03:00', result: 'PASS', evidenceRef: 'evidence://obs/2', observedByRef: 'operator://monitor/1' },
    { signalId: 'BROWSER_JOURNEY', observationId: 'OBS-3', observedAt: '2026-09-01T13:10:00+03:00', result: 'WARN', evidenceRef: 'evidence://obs/3', observedByRef: 'operator://monitor/2' },
  ];
  return base.map((item, index) => ({ ...item, ...(overrides[index] || {}) }));
}

function rollback(overrides = {}) {
  return {
    procedureAvailable: true,
    knownGoodReleaseVerified: true,
    knownGoodReleaseRef: 'release://known-good/1',
    evidenceRef: 'evidence://rollback/continuity/1',
    ...overrides,
  };
}

function refs(input) {
  return [...new Set([
    ...(input.postDeploymentHumanReview.evidenceRefs || []),
    input.monitoringPolicy.policyEvidenceRef,
    ...input.observations.flatMap((item) => [item.evidenceRef, item.observedByRef]),
    ...input.conditionEvidence.flatMap((item) => [item.ownerRef, item.evidenceRef]),
    ...input.incidents.map((item) => item.evidenceRef).filter(Boolean),
    input.rollbackReadiness.knownGoodReleaseRef,
    input.rollbackReadiness.evidenceRef,
  ])];
}

function base(overrides = {}) {
  const input = {
    ...scope,
    postDeploymentHumanReview: review(),
    monitoringPolicy: policy(),
    observationWindow: { startsAt: '2026-09-01T12:45:00+03:00', endsAt: '2026-09-01T14:00:00+03:00' },
    observations: observations(),
    conditionEvidence: [],
    incidents: [],
    rollbackReadiness: rollback(),
    evidenceRefs: [],
    ...overrides,
  };
  input.evidenceRefs = overrides.evidenceRefs || refs(input);
  return input;
}

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`PASS ${name}`);
}

check('complete continuity evidence is ready only for human continuity review', () => {
  const out = buildProductionServiceContinuityEvidence(base());
  assert.strictEqual(out.status, STATUS.READY_FOR_HUMAN_CONTINUITY_REVIEW);
  assert.strictEqual(out.readyForHumanContinuityReview, true);
  assert.strictEqual(out.continuedProductionUseAuthorizedByThisModule, false);
  assert.strictEqual(out.rollbackAuthorizedByThisModule, false);
  assert.strictEqual(out.productionDeploymentVerifiedByThisModule, false);
  assert.strictEqual(out.productionSecurityCertified, false);
  assert.strictEqual(out.legalApprovalEstablished, false);
  assert.strictEqual(out.certifiedValuationEstablished, false);
  assert.strictEqual(out.transactionAuthorized, false);
});

check('scope mismatch fails closed', () => {
  assert.strictEqual(buildProductionServiceContinuityEvidence(base({ postDeploymentHumanReview: review({ caseId: 'OTHER' }) })).status, STATUS.HOLD_SCOPE);
});

check('hold or rollback human outcomes cannot enter continuity monitoring', () => {
  for (const outcome of ['HOLD_SERVICE', 'REQUIRE_ROLLBACK']) {
    const r = review({
      review: { ...review().review, outcome },
      productionServiceUseApprovedByHuman: false,
      rollbackRequiredByHuman: outcome === 'REQUIRE_ROLLBACK',
    });
    assert.strictEqual(buildProductionServiceContinuityEvidence(base({ postDeploymentHumanReview: r })).status, STATUS.HOLD_POST_DEPLOYMENT_REVIEW);
  }
});

check('monitoring policy must be explicit and cannot duplicate signal ids', () => {
  assert.strictEqual(buildProductionServiceContinuityEvidence(base({ monitoringPolicy: policy({ policyEvidenceRef: '' }) })).status, STATUS.HOLD_MONITORING_POLICY);
  assert.strictEqual(buildProductionServiceContinuityEvidence(base({ monitoringPolicy: policy({ requiredSignalIds: ['APP_HEALTH', 'APP_HEALTH'] }) })).status, STATUS.HOLD_MONITORING_POLICY);
  assert.strictEqual(buildProductionServiceContinuityEvidence(base({ monitoringPolicy: policy({ blockingResults: ['UNKNOWN'] }) })).status, STATUS.HOLD_MONITORING_POLICY);
});

check('monitoring window must follow human review and be ordered', () => {
  assert.strictEqual(buildProductionServiceContinuityEvidence(base({ observationWindow: { startsAt: '2026-09-01T12:00:00+03:00', endsAt: '2026-09-01T14:00:00+03:00' } })).status, STATUS.HOLD_WINDOW);
  assert.strictEqual(buildProductionServiceContinuityEvidence(base({ observationWindow: { startsAt: '2026-09-01T14:00:00+03:00', endsAt: '2026-09-01T13:00:00+03:00' } })).status, STATUS.HOLD_WINDOW);
  assert.strictEqual(buildProductionServiceContinuityEvidence(base({ observationWindow: { startsAt: '2026-09-01T12:45:00', endsAt: '2026-09-01T14:00:00+03:00' } })).status, STATUS.HOLD_WINDOW);
});

check('required observations must exist inside the declared window', () => {
  const missing = observations().filter((item) => item.signalId !== 'ERROR_CONTROL');
  assert.strictEqual(buildProductionServiceContinuityEvidence(base({ observations: missing })).status, STATUS.HOLD_OBSERVATIONS);
  const outside = observations({ 0: { observedAt: '2026-09-01T15:00:00+03:00' } });
  assert.strictEqual(buildProductionServiceContinuityEvidence(base({ observations: outside })).status, STATUS.HOLD_OBSERVATIONS);
});

check('caller-policy blocking signal fails closed without inventing a threshold', () => {
  const obs = observations({ 1: { result: 'FAIL' } });
  const out = buildProductionServiceContinuityEvidence(base({ observations: obs }));
  assert.strictEqual(out.status, STATUS.HOLD_OBSERVATIONS);
  assert.deepStrictEqual(out.diagnostics.blockingSignalIds, ['ERROR_CONTROL']);
});

check('latest observation per required signal controls the caller-policy check', () => {
  const obs = observations();
  obs.push({ signalId: 'ERROR_CONTROL', observationId: 'OBS-4', observedAt: '2026-09-01T13:20:00+03:00', result: 'PASS', evidenceRef: 'evidence://obs/4', observedByRef: 'operator://monitor/1' });
  obs[1].result = 'FAIL';
  const out = buildProductionServiceContinuityEvidence(base({ observations: obs }));
  assert.strictEqual(out.status, STATUS.READY_FOR_HUMAN_CONTINUITY_REVIEW);
  assert.strictEqual(out.latestRequiredObservations.find((item) => item.signalId === 'ERROR_CONTROL').observationId, 'OBS-4');
});

check('conditional acceptance requires all monitoring conditions to be satisfied by the same owner', () => {
  const condition = {
    conditionId: 'COND-MON-1',
    description: 'Observe application stability during controlled service',
    ownerRef: 'owner://condition/1',
    monitoringEvidenceRef: 'evidence://condition/monitoring/1',
  };
  const r = review({
    review: { ...review().review, outcome: 'ACCEPT_WITH_MONITORING_CONDITIONS', monitoringConditions: [condition] },
    monitoringConditionsRemain: true,
    evidenceRefs: [...review().evidenceRefs, condition.ownerRef, condition.monitoringEvidenceRef],
  });
  const evidence = [{ conditionId: 'COND-MON-1', ownerRef: condition.ownerRef, satisfied: true, satisfiedAt: '2026-09-01T13:30:00+03:00', evidenceRef: 'evidence://condition/satisfied/1' }];
  assert.strictEqual(buildProductionServiceContinuityEvidence(base({ postDeploymentHumanReview: r, conditionEvidence: evidence })).status, STATUS.READY_FOR_HUMAN_CONTINUITY_REVIEW);
  assert.strictEqual(buildProductionServiceContinuityEvidence(base({ postDeploymentHumanReview: r, conditionEvidence: [] })).status, STATUS.HOLD_CONDITIONS);
  assert.strictEqual(buildProductionServiceContinuityEvidence(base({ postDeploymentHumanReview: r, conditionEvidence: [{ ...evidence[0], ownerRef: 'owner://other' }] })).status, STATUS.HOLD_CONDITIONS);
});

check('unconditional human acceptance cannot acquire hidden continuity conditions', () => {
  const evidence = [{ conditionId: 'HIDDEN', ownerRef: 'owner://hidden', satisfied: true, satisfiedAt: '2026-09-01T13:30:00+03:00', evidenceRef: 'evidence://hidden/1' }];
  assert.strictEqual(buildProductionServiceContinuityEvidence(base({ conditionEvidence: evidence })).status, STATUS.HOLD_CONDITIONS);
});

check('unresolved high or critical incidents and any data leakage fail closed', () => {
  for (const severity of ['HIGH', 'CRITICAL']) {
    const incidents = [{ incidentId: `INC-${severity}`, severity, type: 'RUNTIME', resolved: false, evidenceRef: `evidence://incident/${severity}` }];
    assert.strictEqual(buildProductionServiceContinuityEvidence(base({ incidents })).status, STATUS.HOLD_INCIDENTS);
  }
  const leakage = [{ incidentId: 'INC-LEAK', severity: 'LOW', type: 'DATA_LEAKAGE', resolved: true, evidenceRef: 'evidence://incident/leak' }];
  assert.strictEqual(buildProductionServiceContinuityEvidence(base({ incidents: leakage })).status, STATUS.HOLD_INCIDENTS);
});

check('resolved non-leakage incident may remain in the evidence pack', () => {
  const incidents = [{ incidentId: 'INC-1', severity: 'HIGH', type: 'RUNTIME', resolved: true, evidenceRef: 'evidence://incident/1' }];
  const out = buildProductionServiceContinuityEvidence(base({ incidents }));
  assert.strictEqual(out.status, STATUS.READY_FOR_HUMAN_CONTINUITY_REVIEW);
  assert.strictEqual(out.incidentSummary.total, 1);
  assert.strictEqual(out.incidentSummary.unresolvedBlocking, 0);
});

check('rollback readiness is mandatory throughout continuity monitoring', () => {
  assert.strictEqual(buildProductionServiceContinuityEvidence(base({ rollbackReadiness: rollback({ procedureAvailable: false }) })).status, STATUS.HOLD_ROLLBACK_READINESS);
  assert.strictEqual(buildProductionServiceContinuityEvidence(base({ rollbackReadiness: rollback({ knownGoodReleaseRef: '' }) })).status, STATUS.HOLD_ROLLBACK_READINESS);
});

check('evidence chain is complete and deduplicated', () => {
  const input = base();
  input.evidenceRefs = input.evidenceRefs.filter((ref) => ref !== input.observations[0].evidenceRef);
  assert.strictEqual(buildProductionServiceContinuityEvidence(input).status, STATUS.HOLD_EVIDENCE_CHAIN);

  const complete = base();
  complete.evidenceRefs.push(complete.evidenceRefs[0]);
  const out = buildProductionServiceContinuityEvidence(complete);
  assert.strictEqual(out.status, STATUS.READY_FOR_HUMAN_CONTINUITY_REVIEW);
  assert.strictEqual(new Set(out.evidenceRefs).size, out.evidenceRefs.length);
});

console.log(`PRODUCTION_SERVICE_CONTINUITY_V1=PASS checks=${checks}`);
