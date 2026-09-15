'use strict';

const assert = require('assert');
const {
  BACKUP_RESTORE_STATUS,
} = require('../../src/qualification/controlled-backup-restore-qualification');
const {
  PERFORMANCE_STATUS,
  RESILIENCE_SCENARIO,
} = require('../../src/qualification/performance-resilience-qualification');
const {
  DR_FAILOVER_STATUS,
  createControlledDrFailoverQualification,
} = require('../../src/qualification/controlled-dr-failover-qualification');

const results = [];
const COMMIT_SHA = '1'.repeat(40);
const FINGERPRINT = 'a'.repeat(64);

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

function backupRestoreQualification(overrides = {}) {
  return {
    status: BACKUP_RESTORE_STATUS.BACKUP_RESTORE_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED,
    bundleHashSha256: 'b'.repeat(64),
    plan: {
      environment: 'staging',
      sourceDatabaseRef: 'primary-ref',
      exactCommitSha: COMMIT_SHA,
    },
    ...overrides,
  };
}

function authorization(overrides = {}) {
  return {
    approved: true,
    allowFailover: true,
    allowFailback: true,
    approvedBy: 'dr-operator',
    reviewedBy: 'independent-reviewer',
    approvedAt: '2026-09-09T15:55:00.000Z',
    changeControlRef: 'chg-dr-17',
    environment: 'staging',
    primaryDatabaseRef: 'primary-ref',
    primaryDatabaseName: 'startak_primary',
    standbyDatabaseRef: 'standby-ref',
    standbyDatabaseName: 'startak_standby',
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  return {
    backupRestoreQualification: backupRestoreQualification(),
    environment: 'staging',
    primaryDatabaseRef: 'primary-ref',
    primaryDatabaseName: 'startak_primary',
    standbyDatabaseRef: 'standby-ref',
    standbyDatabaseName: 'startak_standby',
    exactCommitSha: COMMIT_SHA,
    recoveryObjectives: {
      maximumRecoveryTimeSeconds: 60,
      maximumDataLossSeconds: 5,
      objectiveSourceRef: 'policy://dr/staging-v1',
    },
    authorization: authorization(),
    drillId: 'dr-drill-17',
    assessedAt: '2026-09-09T16:02:00.000Z',
    ...overrides,
  };
}

function preflightResult(overrides = {}) {
  return {
    primaryHealthy: true,
    standbyReachable: true,
    replicationHealthy: true,
    replicationLagSeconds: 1,
    latestPrimaryDataAt: '2026-09-09T15:59:55.000Z',
    latestStandbyDataAt: '2026-09-09T15:59:54.000Z',
    secret: 'must-not-leak',
    ...overrides,
  };
}

function transitionResult(phase, overrides = {}) {
  if (phase === 'failover') {
    return {
      startedAt: '2026-09-09T16:00:00.000Z',
      finishedAt: '2026-09-09T16:00:20.000Z',
      activeDatabaseRef: 'standby-ref',
      activeDatabaseName: 'startak_standby',
      secret: 'must-not-leak',
      ...overrides,
    };
  }
  return {
    startedAt: '2026-09-09T16:01:00.000Z',
    finishedAt: '2026-09-09T16:01:10.000Z',
    activeDatabaseRef: 'primary-ref',
    activeDatabaseName: 'startak_primary',
    secret: 'must-not-leak',
    ...overrides,
  };
}

function verificationResult(phase, overrides = {}) {
  if (phase === 'failover') {
    return {
      observedAt: '2026-09-09T16:00:30.000Z',
      latestPrimaryDataAt: '2026-09-09T16:00:25.000Z',
      latestActiveDataAt: '2026-09-09T16:00:23.000Z',
      activeDatabaseRef: 'standby-ref',
      activeDatabaseName: 'startak_standby',
      readPathHealthy: true,
      writePathHealthy: true,
      sourceRecordCount: 100,
      activeRecordCount: 100,
      sourceFingerprintSha256: FINGERPRINT,
      activeFingerprintSha256: FINGERPRINT,
      duplicateSideEffectsObserved: false,
      unreconciledDataCorruptionObserved: false,
      connectionString: 'postgres://secret',
      ...overrides,
    };
  }
  return {
    observedAt: '2026-09-09T16:01:20.000Z',
    latestPrimaryDataAt: '2026-09-09T16:01:18.000Z',
    latestActiveDataAt: '2026-09-09T16:01:18.000Z',
    activeDatabaseRef: 'primary-ref',
    activeDatabaseName: 'startak_primary',
    readPathHealthy: true,
    writePathHealthy: true,
    sourceRecordCount: 100,
    activeRecordCount: 100,
    sourceFingerprintSha256: FINGERPRINT,
    activeFingerprintSha256: FINGERPRINT,
    duplicateSideEffectsObserved: false,
    unreconciledDataCorruptionObserved: false,
    password: 'must-not-leak',
    ...overrides,
  };
}

function harness(overrides = {}) {
  const calls = { preflight: 0, failover: 0, verify: [], failback: 0 };
  const qualify = createControlledDrFailoverQualification({
    preflightExecutor: overrides.preflightExecutor || (async () => { calls.preflight += 1; return preflightResult(overrides.preflightOverrides); }),
    failoverExecutor: overrides.failoverExecutor || (async () => { calls.failover += 1; return transitionResult('failover', overrides.failoverOverrides); }),
    verificationExecutor: overrides.verificationExecutor || (async ({ phase }) => {
      calls.verify.push(phase);
      return verificationResult(phase, phase === 'failover' ? overrides.failoverVerificationOverrides : overrides.failbackVerificationOverrides);
    }),
    failbackExecutor: overrides.failbackExecutor || (async () => { calls.failback += 1; return transitionResult('failback', overrides.failbackOverrides); }),
  });
  return { qualify, calls };
}

function assertAuthorityClosed(result) {
  assert.strictEqual(result.productionQualified, false);
  for (const value of Object.values(result.authority)) assert.strictEqual(value, false);
}

(async () => {
  await test('PRODUCTIZATION-P17-01', async () => {
    const { qualify, calls } = harness();
    const result = await qualify(baseInput({ execute: false }));
    assert.strictEqual(result.status, DR_FAILOVER_STATUS.DRY_RUN_READY);
    assert.strictEqual(calls.preflight, 0);
    assert.strictEqual(calls.failover, 0);
    assert.strictEqual(calls.failback, 0);
    assert.strictEqual(result.plan.planHashSha256.length, 64);
    assertAuthorityClosed(result);
  });

  await test('PRODUCTIZATION-P17-02', async () => {
    const { qualify, calls } = harness();
    const result = await qualify(baseInput({
      execute: true,
      backupRestoreQualification: backupRestoreQualification({ status: BACKUP_RESTORE_STATUS.HOLD_VERIFICATION }),
    }));
    assert.strictEqual(result.status, DR_FAILOVER_STATUS.HOLD_BACKUP_RESTORE_QUALIFICATION);
    assert.strictEqual(calls.preflight, 0);
  });

  await test('PRODUCTIZATION-P17-03', async () => {
    const { qualify, calls } = harness();
    const result = await qualify(baseInput({
      execute: true,
      authorization: authorization({ standbyDatabaseRef: 'other-ref' }),
    }));
    assert.strictEqual(result.status, DR_FAILOVER_STATUS.HOLD_AUTHORIZATION);
    assert.strictEqual(result.authorization.accepted, false);
    assert.strictEqual(calls.preflight, 0);
  });

  await test('PRODUCTIZATION-P17-04', async () => {
    const { qualify, calls } = harness();
    const result = await qualify(baseInput({ execute: true }));
    assert.strictEqual(result.status, DR_FAILOVER_STATUS.DR_FAILOVER_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED);
    assert.strictEqual(calls.preflight, 1);
    assert.strictEqual(calls.failover, 1);
    assert.deepStrictEqual(calls.verify, ['failover', 'failback']);
    assert.strictEqual(calls.failback, 1);
    assert.strictEqual(result.resilienceEvidence.status, PERFORMANCE_STATUS.PASS);
    assert.strictEqual(result.resilienceEvidence.scenario, RESILIENCE_SCENARIO.DATABASE_UNAVAILABLE);
    assert.strictEqual(result.resilienceEvidence.observedRecoveryTimeSeconds, 30);
    assert.strictEqual(result.resilienceEvidence.observedDataLossSeconds, 2);
    assert.ok(result.evidenceRef.startsWith('sha256:'));
    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes('must-not-leak'));
    assert.ok(!serialized.includes('postgres://secret'));
    assertAuthorityClosed(result);
  });

  await test('PRODUCTIZATION-P17-05', async () => {
    const { qualify, calls } = harness({ preflightOverrides: { replicationHealthy: false } });
    const result = await qualify(baseInput({ execute: true }));
    assert.strictEqual(result.status, DR_FAILOVER_STATUS.HOLD_PREFLIGHT);
    assert.strictEqual(calls.failover, 0);
  });

  await test('PRODUCTIZATION-P17-06', async () => {
    const { qualify } = harness({ preflightExecutor: async () => { throw new Error('db password=secret'); } });
    const result = await qualify(baseInput({ execute: true }));
    assert.strictEqual(result.status, DR_FAILOVER_STATUS.HOLD_PREFLIGHT);
    assert.ok(!JSON.stringify(result).includes('db password=secret'));
  });

  await test('PRODUCTIZATION-P17-07', async () => {
    const { qualify } = harness({ failoverOverrides: { activeDatabaseRef: 'primary-ref', activeDatabaseName: 'startak_primary' } });
    const result = await qualify(baseInput({ execute: true }));
    assert.strictEqual(result.status, DR_FAILOVER_STATUS.HOLD_FAILOVER);
    assert.strictEqual(result.failover.expectedTargetActivated, false);
  });

  await test('PRODUCTIZATION-P17-08', async () => {
    const { qualify, calls } = harness({ failoverVerificationOverrides: { activeRecordCount: 99 } });
    const result = await qualify(baseInput({ execute: true }));
    assert.strictEqual(result.status, DR_FAILOVER_STATUS.HOLD_FAILOVER_VERIFICATION);
    assert.strictEqual(result.failoverVerification.recordCountsMatch, false);
    assert.strictEqual(calls.failback, 0);
  });

  await test('PRODUCTIZATION-P17-09', async () => {
    const { qualify } = harness({ failbackExecutor: async () => { throw new Error('provider token secret'); } });
    const result = await qualify(baseInput({ execute: true }));
    assert.strictEqual(result.status, DR_FAILOVER_STATUS.HOLD_FAILBACK);
    assert.ok(!JSON.stringify(result).includes('provider token secret'));
  });

  await test('PRODUCTIZATION-P17-10', async () => {
    const { qualify } = harness({ failbackVerificationOverrides: { writePathHealthy: false } });
    const result = await qualify(baseInput({ execute: true }));
    assert.strictEqual(result.status, DR_FAILOVER_STATUS.HOLD_FAILBACK_VERIFICATION);
    assert.strictEqual(result.failbackVerification.writePathHealthy, false);
  });

  await test('PRODUCTIZATION-P17-11', async () => {
    const { qualify } = harness();
    const result = await qualify(baseInput({
      execute: true,
      recoveryObjectives: {
        maximumRecoveryTimeSeconds: 10,
        maximumDataLossSeconds: 5,
        objectiveSourceRef: 'policy://dr/strict-rto',
      },
    }));
    assert.strictEqual(result.status, DR_FAILOVER_STATUS.HOLD_RECOVERY_OBJECTIVE);
    assert.ok(result.resilienceEvidence.failureCodes.includes('RECOVERY_TIME_OBJECTIVE_EXCEEDED'));
  });

  await test('PRODUCTIZATION-P17-12', async () => {
    const { qualify } = harness();
    const result = await qualify(baseInput({
      execute: true,
      recoveryObjectives: {
        maximumRecoveryTimeSeconds: 60,
        maximumDataLossSeconds: 1,
        objectiveSourceRef: 'policy://dr/strict-rpo',
      },
    }));
    assert.strictEqual(result.status, DR_FAILOVER_STATUS.HOLD_RECOVERY_OBJECTIVE);
    assert.ok(result.resilienceEvidence.failureCodes.includes('DATA_LOSS_OBJECTIVE_EXCEEDED'));
  });

  await test('PRODUCTIZATION-P17-13', async () => {
    const { qualify } = harness();
    await assert.rejects(
      () => qualify(baseInput({ environment: 'production', execute: false })),
      /environment must be staging/,
    );
    await assert.rejects(
      () => qualify(baseInput({ standbyDatabaseRef: 'primary-ref', execute: false })),
      /standby database must be distinct/,
    );
  });

  await test('PRODUCTIZATION-P17-14', async () => {
    const { qualify } = harness();
    const input = baseInput({ execute: false });
    const first = await qualify(input);
    const second = await qualify(input);
    assert.strictEqual(first.plan.planHashSha256, second.plan.planHashSha256);
    assert.strictEqual(first.executionHashSha256, second.executionHashSha256);
    assert.strictEqual(first.plan.backupRestoreQualificationRef, `sha256:${'b'.repeat(64)}`);
  });

  const failed = results.filter((entry) => entry[1] !== 'PASS');
  console.log(`PRODUCTIZATION_P17_CONTROLLED_DR_FAILOVER_RESULT=${failed.length === 0 ? 'PASS' : 'FAIL'} ${results.filter((entry) => entry[1] === 'PASS').length}/${results.length}`);
  if (failed.length > 0) process.exit(1);
})().catch((error) => {
  console.error('PRODUCTIZATION_P17_CONTROLLED_DR_FAILOVER_FATAL', error && error.stack ? error.stack : error);
  process.exit(1);
});
