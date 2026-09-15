'use strict';

const assert = require('assert');
const {
  MIGRATION_STATUS,
  runControlledCanonicalWorkspaceMigration,
} = require('../../src/storage/controlled-postgres-migration-runner');

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

function approval(overrides = {}) {
  return {
    approved: true,
    allowMutation: true,
    approvedBy: 'change-owner',
    approvedAt: '2026-09-09T14:50:00.000Z',
    changeRef: 'CHG-1234',
    environment: 'staging',
    targetDatabaseRef: 'staging-db-ref',
    expectedDatabaseName: 'startak_staging',
    ...overrides,
  };
}

function createMigrationPool({
  databaseName = 'startak_staging',
  roleName = 'startak_migrator',
  schemaFailure = false,
  rlsFailure = false,
  postcheckForceRls = true,
  preflightFailure = false,
} = {}) {
  const calls = [];
  return {
    calls,
    async connect() {
      return {
        async query(sql, params) {
          const text = String(sql);
          calls.push({ sql: text, params: params || null });
          if (text === 'SELECT current_database() AS database_name, current_user AS role_name') {
            if (preflightFailure) throw new Error('password=do-not-leak-preflight');
            return { rows: [{ database_name: databaseName, role_name: roleName }], rowCount: 1 };
          }
          if (text.includes('STARTAK canonical workspace PostgreSQL schema migration')) {
            if (schemaFailure) throw new Error('database secret schema-failure');
            return { rows: [], rowCount: 0 };
          }
          if (text.includes('STARTAK PostgreSQL tenant RLS migration generated deterministically')) {
            if (rlsFailure) throw new Error('database secret rls-failure');
            return { rows: [], rowCount: 0 };
          }
          if (text.startsWith('SELECT c.relrowsecurity')) {
            return { rows: [{ relrowsecurity: true, relforcerowsecurity: postcheckForceRls }], rowCount: 1 };
          }
          throw new Error('UNEXPECTED_SQL');
        },
        release() {},
      };
    },
  };
}

function baseInput(overrides = {}) {
  return {
    environment: 'staging',
    targetDatabaseRef: 'staging-db-ref',
    expectedDatabaseName: 'startak_staging',
    expectedMigrationRole: 'startak_migrator',
    runtimeRole: 'startak_runtime',
    ...overrides,
  };
}

function assertAuthorityClosed(result) {
  assert.strictEqual(result.productionQualified, false);
  for (const value of Object.values(result.authority)) assert.strictEqual(value, false);
}

(async () => {
  await test('PRODUCTIZATION-P13-01', async () => {
    const result = await runControlledCanonicalWorkspaceMigration(baseInput());
    assert.strictEqual(result.status, MIGRATION_STATUS.DRY_RUN_READY);
    assert.strictEqual(result.execution.mutationExecuted, false);
    assert.strictEqual(result.execution.mutationRequested, false);
    assert.strictEqual(result.plan.planHashSha256.length, 64);
    assert.strictEqual(result.plan.schemaHashSha256.length, 64);
    assert.strictEqual(result.plan.rlsHashSha256.length, 64);
    assertAuthorityClosed(result);
  });

  await test('PRODUCTIZATION-P13-02', async () => {
    const pool = createMigrationPool();
    const result = await runControlledCanonicalWorkspaceMigration(baseInput({ migrationPool: pool, execute: true }));
    assert.strictEqual(result.status, MIGRATION_STATUS.HOLD_AUTHORIZATION);
    assert.strictEqual(pool.calls.length, 0);
    assertAuthorityClosed(result);
  });

  await test('PRODUCTIZATION-P13-03', async () => {
    const pool = createMigrationPool();
    const result = await runControlledCanonicalWorkspaceMigration(baseInput({
      migrationPool: pool,
      execute: true,
      authorization: approval({ targetDatabaseRef: 'other-db-ref' }),
    }));
    assert.strictEqual(result.status, MIGRATION_STATUS.HOLD_AUTHORIZATION);
    assert.strictEqual(pool.calls.length, 0);
  });

  await test('PRODUCTIZATION-P13-04', async () => {
    const pool = createMigrationPool({ databaseName: 'wrong_database' });
    const result = await runControlledCanonicalWorkspaceMigration(baseInput({
      migrationPool: pool,
      execute: true,
      authorization: approval(),
    }));
    assert.strictEqual(result.status, MIGRATION_STATUS.HOLD_TARGET_MISMATCH);
    assert.strictEqual(result.execution.mutationExecuted, false);
    assert.strictEqual(pool.calls.length, 1);
  });

  await test('PRODUCTIZATION-P13-05', async () => {
    const pool = createMigrationPool({ preflightFailure: true });
    const result = await runControlledCanonicalWorkspaceMigration(baseInput({
      migrationPool: pool,
      execute: true,
      authorization: approval(),
    }));
    assert.strictEqual(result.status, MIGRATION_STATUS.HOLD_PREFLIGHT);
    assert.ok(!JSON.stringify(result).includes('do-not-leak-preflight'));
  });

  await test('PRODUCTIZATION-P13-06', async () => {
    const pool = createMigrationPool();
    const result = await runControlledCanonicalWorkspaceMigration(baseInput({
      migrationPool: pool,
      execute: true,
      authorization: approval(),
    }));
    assert.strictEqual(result.status, MIGRATION_STATUS.APPLIED_NOT_PRODUCTION_CERTIFIED);
    assert.strictEqual(result.execution.preflightPassed, true);
    assert.strictEqual(result.execution.schemaApplied, true);
    assert.strictEqual(result.execution.rlsApplied, true);
    assert.strictEqual(result.execution.postcheckPassed, true);
    assert.strictEqual(result.execution.mutationExecuted, true);
    assert.strictEqual(pool.calls.length, 4);
    assertAuthorityClosed(result);
  });

  await test('PRODUCTIZATION-P13-07', async () => {
    const pool = createMigrationPool({ schemaFailure: true });
    const result = await runControlledCanonicalWorkspaceMigration(baseInput({
      migrationPool: pool,
      execute: true,
      authorization: approval(),
    }));
    assert.strictEqual(result.status, MIGRATION_STATUS.HOLD_SCHEMA_EXECUTION);
    assert.strictEqual(result.execution.schemaApplied, false);
    assert.ok(!JSON.stringify(result).includes('schema-failure'));
  });

  await test('PRODUCTIZATION-P13-08', async () => {
    const pool = createMigrationPool({ rlsFailure: true });
    const result = await runControlledCanonicalWorkspaceMigration(baseInput({
      migrationPool: pool,
      execute: true,
      authorization: approval(),
    }));
    assert.strictEqual(result.status, MIGRATION_STATUS.HOLD_RLS_EXECUTION);
    assert.strictEqual(result.execution.schemaApplied, true);
    assert.strictEqual(result.execution.rlsApplied, false);
    assert.ok(!JSON.stringify(result).includes('rls-failure'));
  });

  await test('PRODUCTIZATION-P13-09', async () => {
    const pool = createMigrationPool({ postcheckForceRls: false });
    const result = await runControlledCanonicalWorkspaceMigration(baseInput({
      migrationPool: pool,
      execute: true,
      authorization: approval(),
    }));
    assert.strictEqual(result.status, MIGRATION_STATUS.HOLD_POSTCHECK);
    assert.strictEqual(result.execution.rlsApplied, true);
    assert.strictEqual(result.execution.postcheckPassed, false);
  });

  await test('PRODUCTIZATION-P13-10', async () => {
    await assert.rejects(
      () => runControlledCanonicalWorkspaceMigration(baseInput({ environment: 'production' })),
      /environment must be one of/,
    );
    await assert.rejects(
      () => runControlledCanonicalWorkspaceMigration(baseInput({ expectedMigrationRole: 'startak_runtime' })),
      /must be distinct from runtimeRole/,
    );
  });

  const failed = results.filter((entry) => entry[1] !== 'PASS');
  console.log(`PRODUCTIZATION_P13_CONTROLLED_POSTGRES_MIGRATION_RESULT=${failed.length === 0 ? 'PASS' : 'FAIL'} ${results.filter((entry) => entry[1] === 'PASS').length}/${results.length}`);
  if (failed.length > 0) process.exit(1);
})().catch((error) => {
  console.error('PRODUCTIZATION_P13_CONTROLLED_POSTGRES_MIGRATION_FATAL', error && error.stack ? error.stack : error);
  process.exit(1);
});
