'use strict';

const assert = require('assert');
const {
  MIGRATION_STATUS,
} = require('../../src/storage/controlled-postgres-migration-runner');
const {
  RLS_PROBE_STATUS,
} = require('../../src/security/postgres-runtime-rls-probe');
const {
  VERIFICATION_STATUS,
} = require('../../src/security/runtime-rls-verification');
const {
  STAGING_QUALIFICATION_STATUS,
  createControlledStagingPostgresQualification,
} = require('../../src/qualification/controlled-staging-postgres-qualification');

const results = [];

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

function migrationResult(status = MIGRATION_STATUS.APPLIED_NOT_PRODUCTION_CERTIFIED) {
  return {
    schemaVersion: 1,
    status,
    plan: {
      planHashSha256: 'a'.repeat(64),
      schemaHashSha256: 'b'.repeat(64),
      rlsHashSha256: 'c'.repeat(64),
    },
    productionQualified: false,
    authority: { releaseAuthorized: false },
  };
}

function rlsProbeResult(status = RLS_PROBE_STATUS.PASS_NOT_PRODUCTION_CERTIFIED) {
  return {
    schemaVersion: 1,
    status,
    evidenceRef: `sha256:${'d'.repeat(64)}`,
    probeHashSha256: 'd'.repeat(64),
    checks: {
      runtimeRoleIsSuperuser: false,
      runtimeRoleBypassesRls: false,
      forceRlsEnabled: true,
      sameTenantCrudAllowed: true,
      crossTenantCrudDenied: true,
      missingTenantContextDenied: true,
      tenantContextResetBetweenRequests: true,
      privilegedPathSeparatelyTested: false,
      cleanupComplete: true,
    },
    productionSecurityVerifiedByThisModule: false,
    authority: { releaseAuthorized: false },
  };
}

function privilegedEvidence(overrides = {}) {
  return {
    status: 'PASS',
    ownerOrAdminPathTested: true,
    evidenceRef: 'evidence://privileged-path/test-1',
    testedAt: '2026-09-09T15:40:00.000Z',
    reviewedBy: 'independent-reviewer',
    environment: 'staging',
    targetDatabaseRef: 'staging-db-ref',
    runtimeRole: 'startak_runtime',
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  return {
    environment: 'staging',
    targetDatabaseRef: 'staging-db-ref',
    expectedDatabaseName: 'startak_staging',
    expectedMigrationRole: 'startak_migrator',
    runtimeRole: 'startak_runtime',
    authorization: { approved: true },
    probeRunId: 'probe-1',
    testedAt: '2026-09-09T15:45:00.000Z',
    ...overrides,
  };
}

function runtimePool() {
  return { connect() { throw new Error('stub runner must not call pool directly'); } };
}

function buildHarness({ migrationStatus, probeStatus, migrationValue, probeValue } = {}) {
  const calls = { migration: [], probe: [] };
  const migrationRunner = async (input) => {
    calls.migration.push(input);
    if (migrationValue !== undefined) return migrationValue;
    return migrationResult(input.execute === true
      ? (migrationStatus || MIGRATION_STATUS.APPLIED_NOT_PRODUCTION_CERTIFIED)
      : MIGRATION_STATUS.DRY_RUN_READY);
  };
  const rlsProbeRunner = async (input) => {
    calls.probe.push(input);
    if (probeValue !== undefined) return probeValue;
    return rlsProbeResult(probeStatus || RLS_PROBE_STATUS.PASS_NOT_PRODUCTION_CERTIFIED);
  };
  const qualify = createControlledStagingPostgresQualification({ migrationRunner, rlsProbeRunner });
  return { qualify, calls };
}

function assertAuthorityClosed(result) {
  assert.strictEqual(result.productionQualified, false);
  for (const value of Object.values(result.authority)) assert.strictEqual(value, false);
}

(async () => {
  await test('PRODUCTIZATION-P14-01', async () => {
    const { qualify, calls } = buildHarness();
    const result = await qualify(baseInput({ execute: false }));
    assert.strictEqual(result.status, STAGING_QUALIFICATION_STATUS.DRY_RUN_READY);
    assert.strictEqual(calls.migration.length, 1);
    assert.strictEqual(calls.migration[0].execute, false);
    assert.strictEqual(calls.probe.length, 0);
    assert.strictEqual(result.rlsProbe, null);
    assertAuthorityClosed(result);
  });

  await test('PRODUCTIZATION-P14-02', async () => {
    const { qualify, calls } = buildHarness({ migrationStatus: MIGRATION_STATUS.HOLD_AUTHORIZATION });
    const result = await qualify(baseInput({ execute: true, runtimePool: runtimePool() }));
    assert.strictEqual(result.status, STAGING_QUALIFICATION_STATUS.HOLD_MIGRATION);
    assert.strictEqual(calls.probe.length, 0);
  });

  await test('PRODUCTIZATION-P14-03', async () => {
    const { qualify } = buildHarness({ probeStatus: RLS_PROBE_STATUS.HOLD_CROSS_TENANT });
    const result = await qualify(baseInput({ execute: true, runtimePool: runtimePool() }));
    assert.strictEqual(result.status, STAGING_QUALIFICATION_STATUS.HOLD_RUNTIME_RLS);
    assert.strictEqual(result.runtimeRlsVerification, null);
  });

  await test('PRODUCTIZATION-P14-04', async () => {
    const { qualify } = buildHarness();
    const result = await qualify(baseInput({ execute: true, runtimePool: runtimePool() }));
    assert.strictEqual(result.status, STAGING_QUALIFICATION_STATUS.HOLD_PRIVILEGED_PATH_EVIDENCE);
    assert.strictEqual(result.runtimeRlsVerification.status, VERIFICATION_STATUS.HOLD_RUNTIME_EVIDENCE);
    assert.strictEqual(result.runtimeRlsVerification.checks.privilegedPathSeparatelyTested, false);
  });

  await test('PRODUCTIZATION-P14-05', async () => {
    const { qualify } = buildHarness();
    const result = await qualify(baseInput({
      execute: true,
      runtimePool: runtimePool(),
      privilegedPathEvidence: privilegedEvidence({ targetDatabaseRef: 'other-db-ref', secret: 'must-not-leak' }),
    }));
    assert.strictEqual(result.status, STAGING_QUALIFICATION_STATUS.HOLD_PRIVILEGED_PATH_EVIDENCE);
    assert.strictEqual(result.privilegedPathEvidence.accepted, false);
    assert.strictEqual(result.privilegedPathEvidence.evidenceRef, null);
    assert.ok(!JSON.stringify(result).includes('must-not-leak'));
  });

  await test('PRODUCTIZATION-P14-06', async () => {
    const { qualify, calls } = buildHarness();
    const result = await qualify(baseInput({
      execute: true,
      runtimePool: runtimePool(),
      privilegedPathEvidence: privilegedEvidence(),
    }));
    assert.strictEqual(result.status, STAGING_QUALIFICATION_STATUS.STAGING_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED);
    assert.strictEqual(result.privilegedPathEvidence.accepted, true);
    assert.strictEqual(result.runtimeRlsVerification.status, VERIFICATION_STATUS.VERIFICATION_EVIDENCE_COMPLETE);
    assert.strictEqual(result.runtimeRlsVerification.productionSecurityVerifiedByThisModule, false);
    assert.strictEqual(calls.probe.length, 1);
    assert.strictEqual(calls.probe[0].environment, 'staging');
    assert.strictEqual(calls.probe[0].targetDatabaseRef, 'staging-db-ref');
    assert.strictEqual(calls.probe[0].expectedRuntimeRole, 'startak_runtime');
    assertAuthorityClosed(result);
  });

  await test('PRODUCTIZATION-P14-07', async () => {
    const { qualify, calls } = buildHarness();
    await assert.rejects(
      () => qualify(baseInput({ environment: 'production', execute: false })),
      /environment must be one of/,
    );
    assert.strictEqual(calls.migration.length, 0);
  });

  await test('PRODUCTIZATION-P14-08', async () => {
    const { qualify } = buildHarness();
    await assert.rejects(
      () => qualify(baseInput({ execute: true, runtimePool: null })),
      /runtimePool.connect is required/,
    );
  });

  await test('PRODUCTIZATION-P14-09', async () => {
    const { qualify } = buildHarness();
    const input = baseInput({
      execute: true,
      runtimePool: runtimePool(),
      privilegedPathEvidence: privilegedEvidence(),
    });
    const first = await qualify(input);
    const second = await qualify(input);
    assert.strictEqual(first.evidenceBundle.bundleHashSha256.length, 64);
    assert.strictEqual(first.evidenceBundle.bundleHashSha256, second.evidenceBundle.bundleHashSha256);
    assert.strictEqual(first.evidenceBundle.migrationPlanRef, `sha256:${'a'.repeat(64)}`);
    assert.strictEqual(first.evidenceBundle.rlsProbeRef, `sha256:${'d'.repeat(64)}`);
  });

  await test('PRODUCTIZATION-P14-10', async () => {
    const { qualify, calls } = buildHarness({ migrationValue: null });
    const result = await qualify(baseInput({ execute: true, runtimePool: runtimePool() }));
    assert.strictEqual(result.status, STAGING_QUALIFICATION_STATUS.HOLD_MIGRATION);
    assert.strictEqual(result.migration, null);
    assert.strictEqual(calls.probe.length, 0);
  });

  const failed = results.filter((entry) => entry[1] !== 'PASS');
  console.log(`PRODUCTIZATION_P14_STAGING_POSTGRES_QUALIFICATION_RESULT=${failed.length === 0 ? 'PASS' : 'FAIL'} ${results.filter((entry) => entry[1] === 'PASS').length}/${results.length}`);
  if (failed.length > 0) process.exit(1);
})().catch((error) => {
  console.error('PRODUCTIZATION_P14_STAGING_POSTGRES_QUALIFICATION_FATAL', error && error.stack ? error.stack : error);
  process.exit(1);
});
