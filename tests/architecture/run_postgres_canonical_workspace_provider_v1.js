'use strict';

const assert = require('assert');
const { createVerifiedIdentityContext } = require('../../src/security/verified-identity-context');
const { createCanonicalWorkspacePersistence } = require('../../src/runtime/canonical-workspace-persistence');
const { createCanonicalWorkspaceRuntime } = require('../../src/runtime/canonical-workspace-runtime');
const { createPostgresCanonicalWorkspaceProvider } = require('../../src/storage/postgres-canonical-workspace-provider');
const { generateCanonicalWorkspacePostgresMigration } = require('../../src/storage/postgres-canonical-workspace-migration');

let checks = 0;
async function check(fn) { await fn(); checks++; }

function identityContext({ sub, tenantId, roles = ['ANALYST'] }) {
  return createVerifiedIdentityContext({
    claims: {
      sub,
      tenant_id: tenantId,
      roles,
      iss: 'https://id.example.test/',
      aud: 'startak-real-estate',
      exp: 2000003600,
    },
    tokenVerificationEvidence: { verified: true, verificationRef: `VERIFY-${sub}` },
    requiredTenantId: tenantId,
    nowEpochSeconds: 2000000000,
  });
}

function workspace(actorId, suffix = '001') {
  return {
    schemaVersion: 1,
    workspaceId: `WS-${suffix}`,
    projectId: `PROJECT-${suffix}`,
    caseId: `CASE-${suffix}`,
    status: 'CASE_ASSEMBLED',
    attribution: { actorId, actorRole: 'ANALYST', source: 'IN_APP' },
    executableCase: { projectId: `PROJECT-${suffix}`, caseId: `CASE-${suffix}` },
    authority: {
      operatingMode: 'UNLICENSED_DECISION_SUPPORT',
      professionalReportExternalIssuanceAuthorized: false,
      releaseAuthorized: false,
      mergeAuthorized: false,
      deploymentAuthorized: false,
      transactionAuthorized: false,
    },
  };
}

function createFakePgPool() {
  const state = new Map();
  const queryLog = [];
  let releases = 0;
  let failNextDataQuery = false;

  function key(tenantId, workspaceId) { return `${tenantId}|${workspaceId}`; }

  return {
    state,
    queryLog,
    get releases() { return releases; },
    failNextDataQuery() { failNextDataQuery = true; },
    async connect() {
      return {
        async query(sql, params = []) {
          queryLog.push({ sql, params: [...params] });
          const normalized = String(sql).trim();
          if (normalized === 'BEGIN' || normalized === 'COMMIT' || normalized === 'ROLLBACK') return { rowCount: null, rows: [] };
          if (normalized.startsWith('SELECT set_config(')) return { rowCount: 1, rows: [{ tenant_context: params[1] }] };

          if (failNextDataQuery) {
            failNextDataQuery = false;
            const error = new Error('synthetic database failure');
            error.code = 'SYNTHETIC_DB_FAILURE';
            throw error;
          }

          if (normalized.startsWith('SELECT payload FROM')) {
            const record = state.get(key(params[0], params[1]));
            return record
              ? { rowCount: 1, rows: [{ payload: record.payload }] }
              : { rowCount: 0, rows: [] };
          }

          if (normalized.startsWith('INSERT INTO')) {
            const recordKey = key(params[0], params[1]);
            if (state.has(recordKey)) return { rowCount: 0, rows: [] };
            state.set(recordKey, { version: params[2], payload: JSON.parse(params[3]) });
            return { rowCount: 1, rows: [{ version: params[2] }] };
          }

          if (normalized.startsWith('UPDATE')) {
            const recordKey = key(params[0], params[1]);
            const current = state.get(recordKey);
            if (!current || current.version !== params[4]) return { rowCount: 0, rows: [] };
            state.set(recordKey, { version: params[2], payload: JSON.parse(params[3]) });
            return { rowCount: 1, rows: [{ version: params[2] }] };
          }

          throw new Error(`Unexpected SQL in fake PostgreSQL pool: ${normalized}`);
        },
        release() { releases++; },
      };
    },
  };
}

async function main() {
  const pool = createFakePgPool();
  const provider = createPostgresCanonicalWorkspaceProvider({ pool });
  const persistence = createCanonicalWorkspacePersistence({ storageProvider: provider });
  const runtime = createCanonicalWorkspaceRuntime({ persistence });
  const analystA = identityContext({ sub: 'user-a', tenantId: 'tenant-a' });
  const analystB = identityContext({ sub: 'user-b', tenantId: 'tenant-b' });

  await check(async () => assert.strictEqual(provider.capabilities.serverSideOnly, true));
  await check(async () => assert.strictEqual(provider.capabilities.structuredTenantScope, true));
  await check(async () => assert.strictEqual(provider.capabilities.atomicCompareAndSet, true));
  await check(async () => assert.strictEqual(provider.capabilities.transactionScopedTenantContext, true));
  await check(async () => assert.strictEqual(provider.capabilities.productionPersistenceValidated, false));
  await check(async () => assert.strictEqual(provider.capabilities.rlsMigrationExecuted, false));
  await check(async () => assert.strictEqual(provider.capabilities.backupRestoreValidated, false));
  await check(async () => assert.strictEqual(provider.capabilities.disasterRecoveryValidated, false));
  await check(async () => assert.strictEqual(persistence.capabilities.structuredTenantScope, true));
  await check(async () => assert.strictEqual(persistence.capabilities.productionPersistenceValidated, false));

  const savedA = await runtime.saveWorkspace({
    identityContext: analystA,
    workspace: workspace('user-a'),
    expectedVersion: 0,
    operationId: 'PG-OP-001',
    occurredAt: '2026-09-09T13:00:00Z',
  });
  await check(async () => assert.strictEqual(savedA.version, 1));
  await check(async () => assert.strictEqual(savedA.tenantId, 'tenant-a'));
  await check(async () => assert.strictEqual(pool.state.size, 1));

  const loadedA = await runtime.loadWorkspace({ identityContext: analystA, workspaceId: 'WS-001' });
  await check(async () => assert.strictEqual(loadedA.version, 1));
  await check(async () => assert.strictEqual(loadedA.updatedBy, 'user-a'));

  const hiddenFromB = await runtime.loadWorkspace({ identityContext: analystB, workspaceId: 'WS-001' });
  await check(async () => assert.strictEqual(hiddenFromB, null));

  const savedB = await runtime.saveWorkspace({
    identityContext: analystB,
    workspace: workspace('user-b'),
    expectedVersion: 0,
    operationId: 'PG-OP-002',
    occurredAt: '2026-09-09T13:01:00Z',
  });
  await check(async () => assert.strictEqual(savedB.tenantId, 'tenant-b'));
  await check(async () => assert.strictEqual(pool.state.size, 2));

  const dataQueries = pool.queryLog.filter(({ sql }) => /SELECT payload FROM|INSERT INTO|UPDATE public\./.test(sql));
  await check(async () => assert.ok(dataQueries.length >= 4));
  await check(async () => assert.ok(dataQueries.every(({ sql }) => !sql.includes('tenant-a') && !sql.includes('tenant-b'))));
  await check(async () => assert.ok(dataQueries.every(({ sql }) => !sql.includes('WS-001'))));
  await check(async () => assert.ok(dataQueries.some(({ params }) => params.includes('tenant-a') && params.includes('WS-001'))));

  const contextQueries = pool.queryLog.filter(({ sql }) => sql.startsWith('SELECT set_config('));
  await check(async () => assert.ok(contextQueries.length >= 4));
  await check(async () => assert.ok(contextQueries.every(({ sql }) => !sql.includes('app.tenant_id'))));
  await check(async () => assert.ok(contextQueries.every(({ params }) => params[0] === 'app.tenant_id')));
  await check(async () => assert.ok(contextQueries.some(({ params }) => params[1] === 'tenant-a')));
  await check(async () => assert.ok(contextQueries.some(({ params }) => params[1] === 'tenant-b')));

  const transactionStarts = pool.queryLog.filter(({ sql }) => sql === 'BEGIN').length;
  const transactionCommits = pool.queryLog.filter(({ sql }) => sql === 'COMMIT').length;
  await check(async () => assert.strictEqual(transactionStarts, transactionCommits));
  await check(async () => assert.ok(pool.releases >= transactionCommits));

  const rawV1 = JSON.stringify(savedA);
  const rawV2 = JSON.stringify({ ...savedA, version: 2 });
  const cas1 = await provider.compareAndSetScoped({
    tenantId: 'tenant-a', workspaceId: 'WS-001', expectedRaw: rawV1, nextRaw: rawV2, expectedVersion: 1, nextVersion: 2,
  });
  await check(async () => assert.strictEqual(cas1, true));
  const staleCas = await provider.compareAndSetScoped({
    tenantId: 'tenant-a', workspaceId: 'WS-001', expectedRaw: rawV1, nextRaw: rawV2, expectedVersion: 1, nextVersion: 2,
  });
  await check(async () => assert.strictEqual(staleCas, false));

  await check(async () => assert.rejects(
    provider.compareAndSetScoped({
      tenantId: 'tenant-b', workspaceId: 'WS-001', expectedRaw: null,
      nextRaw: JSON.stringify({ ...savedA, tenantId: 'tenant-a' }), expectedVersion: 0, nextVersion: 1,
    }),
    (error) => error && error.code === 'POSTGRES_WORKSPACE_SCOPE_MISMATCH',
  ));

  pool.failNextDataQuery();
  const rollbackCountBefore = pool.queryLog.filter(({ sql }) => sql === 'ROLLBACK').length;
  await check(async () => assert.rejects(
    provider.getScoped({ tenantId: 'tenant-a', workspaceId: 'WS-FAIL' }),
    (error) => error && error.code === 'SYNTHETIC_DB_FAILURE',
  ));
  const rollbackCountAfter = pool.queryLog.filter(({ sql }) => sql === 'ROLLBACK').length;
  await check(async () => assert.strictEqual(rollbackCountAfter, rollbackCountBefore + 1));

  const migration = generateCanonicalWorkspacePostgresMigration({
    schemaName: 'public',
    tableName: 'canonical_workspaces',
    runtimeRole: 'app_runtime',
    tenantSetting: 'app.tenant_id',
  });
  await check(async () => assert.ok(migration.schemaSql.includes('CREATE TABLE IF NOT EXISTS public.canonical_workspaces')));
  await check(async () => assert.ok(migration.schemaSql.includes('PRIMARY KEY (tenant_id, workspace_id)')));
  await check(async () => assert.ok(migration.schemaSql.includes("CHECK (payload->>'tenantId' = tenant_id)")));
  await check(async () => assert.ok(migration.schemaSql.includes("CHECK ((payload->>'version')::bigint = version)")));
  await check(async () => assert.ok(migration.rlsMigration.sql.includes('ALTER TABLE public.canonical_workspaces FORCE ROW LEVEL SECURITY;')));
  await check(async () => assert.ok(migration.rlsMigration.sql.includes("current_setting('app.tenant_id', true)")));
  await check(async () => assert.strictEqual(migration.rlsMigration.executed, false));
  await check(async () => assert.strictEqual(migration.executed, false));
  await check(async () => assert.strictEqual(migration.productionPersistenceValidated, false));
  await check(async () => assert.strictEqual(migration.backupRestoreValidated, false));
  await check(async () => assert.strictEqual(migration.disasterRecoveryValidated, false));
  await check(async () => assert.deepStrictEqual(migration.executionOrder, ['schemaSql', 'rlsMigration.sql', 'runtimeRlsVerification']));

  await check(async () => assert.throws(
    () => createPostgresCanonicalWorkspaceProvider({ pool, tableName: 'Bad-Table' }),
    /lowercase PostgreSQL identifier/,
  ));
  await check(async () => assert.throws(
    () => generateCanonicalWorkspacePostgresMigration({ tableName: 'canonical_workspaces', runtimeRole: 'bad-role' }),
    /lowercase PostgreSQL identifier/,
  ));

  console.log(`POSTGRES_CANONICAL_WORKSPACE_PROVIDER_V1: PASS (${checks} checks)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});