'use strict';

const assert = require('assert');
const {
  DR_FAILOVER_STATUS,
} = require('../../src/qualification/controlled-dr-failover-qualification');
const {
  OBSERVABILITY_STATUS,
  createControlledObservabilityIncidentQualification,
} = require('../../src/qualification/controlled-observability-incident-qualification');

const results = [];
const COMMIT_SHA = '2'.repeat(40);

async function test(id, fn) {
  try {
    await fn();
    results.push([id, 'PASS']);
    console.log(id + ' PASS');
  } catch (error) {
    results.push([id, 'FAIL: ' + error.message]);
    console.log(id + ' FAIL: ' + error.message);
  }
}

function drQualification(overrides = {}) {
  return {
    status: DR_FAILOVER_STATUS.DR_FAILOVER_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED,
    executionHashSha256: 'd'.repeat(64),
    plan: {
      environment: 'staging',
      exactCommitSha: COMMIT_SHA,
    },
    ...overrides,
  };
}

function authorization(overrides = {}) {
  return {
    approved: true,
    allowSyntheticAlert: true,
    approvedBy: 'ops-engineer',
    reviewedBy: 'independent-ops-reviewer',
    approvedAt: '2026-09-09T16:05:00.000Z',
    changeControlRef: 'chg-observability-18',
    environment: 'staging',
    serviceRef: 'canonical-workspace-api',
    exactCommitSha: COMMIT_SHA,
    ...overrides,
  };
}

function objectives(overrides = {}) {
  return {
    requiredSignals: ['availability', 'error-rate', 'latency'],
    maximumMetricFreshnessSeconds: 30,
    maximumAlertDeliverySeconds: 10,
    maximumIncidentAcknowledgeSeconds: 60,
    objectiveSourceRef: 'policy://ops/staging-v1',
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  return {
    drFailoverQualification: drQualification(),
    environment: 'staging',
    serviceRef: 'canonical-workspace-api',
    exactCommitSha: COMMIT_SHA,
    monitoringObjectives: objectives(),
    authorization: authorization(),
    probeId: 'obs-probe-18',
    assessedAt: '2026-09-09T16:12:00.000Z',
    ...overrides,
  };
}

function metricsResult(overrides = {}) {
  return {
    observedAt: '2026-09-09T16:10:00.000Z',
    latestSampleAt: '2026-09-09T16:09:55.000Z',
    queryHealthy: true,
    availableSignals: ['availability', 'error-rate', 'latency', 'internal-secret-signal'],
    metricsBackendRef: 'https://metrics.internal.example/tenant?token=secret',
    password: 'must-not-leak',
    ...overrides,
  };
}

function alertResult(overrides = {}) {
  return {
    triggeredAt: '2026-09-09T16:10:10.000Z',
    deliveredAt: '2026-09-09T16:10:14.000Z',
    deliveryConfirmed: true,
    alertId: 'alert-secret-id-18',
    routeRef: 'pager://route-with-secret-token',
    receiverRef: 'receiver://private-oncall',
    apiKey: 'must-not-leak',
    ...overrides,
  };
}

function incidentResult(overrides = {}) {
  return {
    openedAt: '2026-09-09T16:10:15.000Z',
    acknowledgedAt: '2026-09-09T16:10:35.000Z',
    resolvedAt: '2026-09-09T16:11:20.000Z',
    acknowledgementConfirmed: true,
    runbookAvailable: true,
    incidentRef: 'incident://private-18',
    runbookRef: 'https://wiki.internal/runbook?secret=abc',
    onCallOwnerRef: 'user://private-owner',
    escalationPolicyRef: 'policy://private-escalation',
    token: 'must-not-leak',
    ...overrides,
  };
}

function harness(overrides = {}) {
  const calls = { metrics: 0, alert: 0, incident: 0 };
  const qualify = createControlledObservabilityIncidentQualification({
    metricsExecutor: overrides.metricsExecutor || (async () => { calls.metrics += 1; return metricsResult(overrides.metricsOverrides); }),
    alertExecutor: overrides.alertExecutor || (async () => { calls.alert += 1; return alertResult(overrides.alertOverrides); }),
    incidentExecutor: overrides.incidentExecutor || (async () => { calls.incident += 1; return incidentResult(overrides.incidentOverrides); }),
  });
  return { qualify, calls };
}

function assertAuthorityClosed(result) {
  assert.strictEqual(result.productionQualified, false);
  for (const value of Object.values(result.authority)) assert.strictEqual(value, false);
}

(async () => {
  await test('PRODUCTIZATION-P18-01', async () => {
    const { qualify, calls } = harness();
    const result = await qualify(baseInput({ execute: false }));
    assert.strictEqual(result.status, OBSERVABILITY_STATUS.DRY_RUN_READY);
    assert.strictEqual(calls.metrics, 0);
    assert.strictEqual(calls.alert, 0);
    assert.strictEqual(calls.incident, 0);
    assert.strictEqual(result.plan.planHashSha256.length, 64);
    assertAuthorityClosed(result);
  });

  await test('PRODUCTIZATION-P18-02', async () => {
    const { qualify, calls } = harness();
    const result = await qualify(baseInput({
      execute: true,
      drFailoverQualification: drQualification({ status: DR_FAILOVER_STATUS.HOLD_RECOVERY_OBJECTIVE }),
    }));
    assert.strictEqual(result.status, OBSERVABILITY_STATUS.HOLD_DR_FAILOVER_QUALIFICATION);
    assert.strictEqual(calls.metrics, 0);
  });

  await test('PRODUCTIZATION-P18-03', async () => {
    const { qualify, calls } = harness();
    const result = await qualify(baseInput({
      execute: true,
      authorization: authorization({ serviceRef: 'different-service' }),
    }));
    assert.strictEqual(result.status, OBSERVABILITY_STATUS.HOLD_AUTHORIZATION);
    assert.strictEqual(result.authorization.accepted, false);
    assert.strictEqual(calls.metrics, 0);
  });

  await test('PRODUCTIZATION-P18-04', async () => {
    const { qualify, calls } = harness();
    const result = await qualify(baseInput({ execute: true }));
    assert.strictEqual(result.status, OBSERVABILITY_STATUS.OBSERVABILITY_INCIDENT_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED);
    assert.strictEqual(calls.metrics, 1);
    assert.strictEqual(calls.alert, 1);
    assert.strictEqual(calls.incident, 1);
    assert.strictEqual(result.metrics.freshnessSeconds, 5);
    assert.strictEqual(result.alert.deliverySeconds, 4);
    assert.strictEqual(result.incident.acknowledgeSecondsFromDelivery, 21);
    assert.ok(result.metrics.metricsBackendRef.startsWith('sha256:'));
    assert.ok(result.alert.alertIdRef.startsWith('sha256:'));
    assert.ok(result.incident.runbookRef.startsWith('sha256:'));
    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes('must-not-leak'));
    assert.ok(!serialized.includes('token=secret'));
    assert.ok(!serialized.includes('private-oncall'));
    assert.ok(!serialized.includes('internal-secret-signal'));
    assertAuthorityClosed(result);
  });

  await test('PRODUCTIZATION-P18-05', async () => {
    const { qualify, calls } = harness({ metricsOverrides: { availableSignals: ['availability', 'latency'] } });
    const result = await qualify(baseInput({ execute: true }));
    assert.strictEqual(result.status, OBSERVABILITY_STATUS.HOLD_METRICS);
    assert.deepStrictEqual(result.metrics.missingRequiredSignals, ['error-rate']);
    assert.strictEqual(calls.alert, 0);
  });

  await test('PRODUCTIZATION-P18-06', async () => {
    const { qualify, calls } = harness({ metricsOverrides: { latestSampleAt: '2026-09-09T16:09:00.000Z' } });
    const result = await qualify(baseInput({ execute: true }));
    assert.strictEqual(result.status, OBSERVABILITY_STATUS.HOLD_OBJECTIVES);
    assert.strictEqual(result.metrics.freshnessSeconds, 60);
    assert.strictEqual(calls.alert, 0);
  });

  await test('PRODUCTIZATION-P18-07', async () => {
    const { qualify, calls } = harness({ alertOverrides: { deliveryConfirmed: false } });
    const result = await qualify(baseInput({ execute: true }));
    assert.strictEqual(result.status, OBSERVABILITY_STATUS.HOLD_ALERT_DELIVERY);
    assert.strictEqual(calls.incident, 0);
  });

  await test('PRODUCTIZATION-P18-08', async () => {
    const { qualify, calls } = harness({ alertOverrides: { deliveredAt: '2026-09-09T16:10:25.000Z' } });
    const result = await qualify(baseInput({ execute: true }));
    assert.strictEqual(result.status, OBSERVABILITY_STATUS.HOLD_OBJECTIVES);
    assert.strictEqual(result.alert.deliverySeconds, 15);
    assert.strictEqual(calls.incident, 0);
  });

  await test('PRODUCTIZATION-P18-09', async () => {
    const { qualify } = harness({ incidentOverrides: { runbookAvailable: false } });
    const result = await qualify(baseInput({ execute: true }));
    assert.strictEqual(result.status, OBSERVABILITY_STATUS.HOLD_INCIDENT_RESPONSE);
    assert.strictEqual(result.incident.runbookAvailable, false);
  });

  await test('PRODUCTIZATION-P18-10', async () => {
    const { qualify } = harness({ incidentOverrides: { acknowledgedAt: '2026-09-09T16:11:20.000Z', resolvedAt: '2026-09-09T16:11:30.000Z' } });
    const result = await qualify(baseInput({ execute: true }));
    assert.strictEqual(result.status, OBSERVABILITY_STATUS.HOLD_OBJECTIVES);
    assert.strictEqual(result.incident.acknowledgeSecondsFromDelivery, 66);
  });

  await test('PRODUCTIZATION-P18-11', async () => {
    const { qualify } = harness({ incidentExecutor: async () => { throw new Error('webhook secret=top-secret'); } });
    const result = await qualify(baseInput({ execute: true }));
    assert.strictEqual(result.status, OBSERVABILITY_STATUS.HOLD_INCIDENT_RESPONSE);
    assert.ok(!JSON.stringify(result).includes('top-secret'));
  });

  await test('PRODUCTIZATION-P18-12', async () => {
    const { qualify } = harness();
    await assert.rejects(
      () => qualify(baseInput({ environment: 'production', execute: false })),
      /environment must be staging/,
    );
    await assert.rejects(
      () => qualify(baseInput({ monitoringObjectives: objectives({ requiredSignals: ['latency', 'latency'] }), execute: false })),
      /must not contain duplicates/,
    );
  });

  await test('PRODUCTIZATION-P18-13', async () => {
    const { qualify } = harness();
    const input = baseInput({ execute: false });
    const first = await qualify(input);
    const second = await qualify(input);
    assert.strictEqual(first.plan.planHashSha256, second.plan.planHashSha256);
    assert.strictEqual(first.evidenceHashSha256, second.evidenceHashSha256);
    assert.strictEqual(first.plan.drFailoverQualificationRef, `sha256:${'d'.repeat(64)}`);
  });

  await test('PRODUCTIZATION-P18-14', async () => {
    const { qualify, calls } = harness();
    const result = await qualify(baseInput({
      execute: true,
      drFailoverQualification: drQualification({ plan: { environment: 'staging', exactCommitSha: '3'.repeat(40) } }),
    }));
    assert.strictEqual(result.status, OBSERVABILITY_STATUS.HOLD_DR_FAILOVER_QUALIFICATION);
    assert.strictEqual(calls.metrics, 0);
  });

  const failed = results.filter((entry) => entry[1] !== 'PASS');
  console.log(`PRODUCTIZATION_P18_OBSERVABILITY_INCIDENT_RESULT=${failed.length === 0 ? 'PASS' : 'FAIL'} ${results.filter((entry) => entry[1] === 'PASS').length}/${results.length}`);
  if (failed.length > 0) process.exit(1);
})().catch((error) => {
  console.error('PRODUCTIZATION_P18_OBSERVABILITY_INCIDENT_FATAL', error && error.stack ? error.stack : error);
  process.exit(1);
});
