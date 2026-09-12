'use strict';

const assert = require('assert');
const {
  RLS_PROBE_STATUS,
  runPostgresRuntimeRlsProbe,
} = require('../../src/security/postgres-runtime-rls-probe');

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

function rlsDenied() {
  const error = new Error('new row violates row-level security policy');
  error.code = '42501';
  return error;
}

function createFakePool({
  superuser = false,
  bypassRls = false,
  forceRls = true,
  permissiveCrossTenant = false,
  allowMissingContext = false,
  leakContext = false,
  failRoleQuery = false,
} = {}) {
  const rows = new Map();
  const state = {
    rows,
    connects: 0,
    releases: 0,
    queries: [],
    sessionTenant: null,
  };

  function key(tenantId, workspaceId) {
    return `${tenantId}|${workspaceId}`;
  }

  return {
    state,
    async connect() {
      state.connects += 1;
      let txTenant = leakContext ? state.sessionTenant : null;
      return {
        async query(sql, params = []) {
          state.queries.push({ sql, params });
          if (sql === 'BEGIN') return { rowCount: null, rows: [] };
          if (sql === 'COMMIT') {
            if (leakContext) state.sessionTenant = txTenant;
            else state.sessionTenant = null;
            txTenant = leakContext ? state.sessionTenant : null;
            return { rowCount: null, rows: [] };
          }
          if (sql === 'ROLLBACK') {
            if (!leakContext) state.sessionTenant = null;
            txTenant = leakContext ? state.sessionTenant : null;
            return { rowCount: null, rows: [] };
          }
          if (sql === 'SELECT set_config($1, $2, true) AS tenant_context') {
            txTenant = params[1];
            return { rowCount: 1, rows: [{ tenant_context: txTenant }] };
          }
          if (sql.startsWith('SELECT current_user AS role_name')) {
            if (failRoleQuery) throw new Error('database password=should-not-leak');
            return { rowCount: 1, rows: [{ role_name: 'startak_runtime', rolsuper: superuser, rolbypassrls: bypassRls }] };
          }
          if (sql.startsWith('SELECT c.relrowsecurity')) {
            return { rowCount: 1, rows: [{ relrowsecurity: forceRls, relforcerowsecurity: forceRls }] };
          }
          if (sql.startsWith('SELECT nullif(current_setting')) {
            return { rowCount: 1, rows: [{ tenant_context: txTenant || null }] };
          }

          const tenantId = params[0];
          const workspaceId = params[1];
          const visible = txTenant === tenantId || permissiveCrossTenant || (txTenant == null && allowMissingContext);

          if (sql.startsWith('INSERT INTO public.canonical_workspaces')) {
            if (!visible) throw rlsDenied();
            const rowKey = key(tenantId, workspaceId);
            if (rows.has(rowKey)) {
              const duplicate = new Error('duplicate key');
              duplicate.code = '23505';
              throw duplicate;
            }
            rows.set(rowKey, { tenantId, workspaceId, payload: params[2] });
            return { rowCount: 1, rows: [{ workspace_id: workspaceId }] };
          }
          if (sql.startsWith('SELECT workspace_id FROM public.canonical_workspaces')) {
            const exists = visible && rows.has(key(tenantId, workspaceId));
            return { rowCount: exists ? 1 : 0, rows: exists ? [{ workspace_id: workspaceId }] : [] };
          }
          if (sql.startsWith('UPDATE public.canonical_workspaces')) {
            const exists = visible && rows.has(key(tenantId, workspaceId));
            return { rowCount: exists ? 1 : 0, rows: exists ? [{ workspace_id: workspaceId }] : [] };
          }
          if (sql.startsWith('DELETE FROM public.canonical_workspaces')) {
            const rowKey = key(tenantId, workspaceId);
            const exists = visible && rows.has(rowKey);
            if (exists) rows.delete(rowKey);
            return { rowCount: exists ? 1 : 0, rows: exists ? [{ workspace_id: workspaceId }] : [] };
          }
          throw new Error(`unexpected SQL: ${sql}`);
        },
        release() { state.releases += 1; },
      };
    },
  };
}

function probeInput(pool, overrides = {}) {
  return {
    pool,
    expectedRuntimeRole: 'startak_runtime',
    environment: 'STAGING',
    targetDatabaseRef: 'db-ref-staging-1',
    probeRunId: 'probe-001',
    testedAt: '2026-09-09T14:45:00.000Z',
    ...overrides,
  };
}

(async () => {
  await test('PRODUCTIZATION-P12-01', async () => {
    const pool = createFakePool();
    const result = await runPostgresRuntimeRlsProbe(probeInput(pool));
    assert.strictEqual(result.status, RLS_PROBE_STATUS.PASS_NOT_PRODUCTION_CERTIFIED);
    assert.strictEqual(result.checks.runtimeRoleMatchesExpected, true);
    assert.strictEqual(result.checks.runtimeRoleIsSuperuser, false);
    assert.strictEqual(result.checks.runtimeRoleBypassesRls, false);
    assert.strictEqual(result.checks.forceRlsEnabled, true);
    assert.strictEqual(result.checks.sameTenantCrudAllowed, true);
    assert.strictEqual(result.checks.crossTenantCrudDenied, true);
    assert.strictEqual(result.checks.missingTenantContextDenied, true);
    assert.strictEqual(result.checks.tenantContextResetBetweenRequests, true);
    assert.strictEqual(result.checks.privilegedPathSeparatelyTested, false);
    assert.strictEqual(result.checks.cleanupComplete, true);
    assert.strictEqual(result.productionSecurityVerifiedByThisModule, false);
    assert.strictEqual(result.authority.productionPersistenceValidated, false);
    assert.strictEqual(result.authority.productionSecurityValidated, false);
    assert.strictEqual(pool.state.rows.size, 0);
    assert.ok(/^sha256:[a-f0-9]{64}$/.test(result.evidenceRef));
  });

  await test('PRODUCTIZATION-P12-02', async () => {
    const pool = createFakePool({ superuser: true });
    const result = await runPostgresRuntimeRlsProbe(probeInput(pool, { probeRunId: 'probe-superuser' }));
    assert.strictEqual(result.status, RLS_PROBE_STATUS.HOLD_PRIVILEGED_ROLE);
    assert.strictEqual(result.mutationExecuted, false);
    assert.strictEqual(pool.state.rows.size, 0);
  });

  await test('PRODUCTIZATION-P12-03', async () => {
    const pool = createFakePool({ forceRls: false });
    const result = await runPostgresRuntimeRlsProbe(probeInput(pool, { probeRunId: 'probe-force' }));
    assert.strictEqual(result.status, RLS_PROBE_STATUS.HOLD_FORCE_RLS);
    assert.strictEqual(result.mutationExecuted, false);
    assert.strictEqual(pool.state.rows.size, 0);
  });

  await test('PRODUCTIZATION-P12-04', async () => {
    const pool = createFakePool({ permissiveCrossTenant: true });
    const result = await runPostgresRuntimeRlsProbe(probeInput(pool, { probeRunId: 'probe-cross' }));
    assert.strictEqual(result.status, RLS_PROBE_STATUS.HOLD_CROSS_TENANT);
    assert.strictEqual(result.checks.crossTenantCrudDenied, false);
    assert.strictEqual(result.checks.cleanupComplete, true);
    assert.strictEqual(pool.state.rows.size, 0);
  });

  await test('PRODUCTIZATION-P12-05', async () => {
    const pool = createFakePool({ allowMissingContext: true });
    const result = await runPostgresRuntimeRlsProbe(probeInput(pool, { probeRunId: 'probe-missing' }));
    assert.strictEqual(result.status, RLS_PROBE_STATUS.HOLD_MISSING_CONTEXT);
    assert.strictEqual(result.checks.missingTenantContextDenied, false);
    assert.strictEqual(result.checks.cleanupComplete, true);
    assert.strictEqual(pool.state.rows.size, 0);
  });

  await test('PRODUCTIZATION-P12-06', async () => {
    const pool = createFakePool({ leakContext: true });
    const result = await runPostgresRuntimeRlsProbe(probeInput(pool, { probeRunId: 'probe-reset' }));
    assert.strictEqual(result.status, RLS_PROBE_STATUS.HOLD_CONTEXT_RESET);
    assert.strictEqual(result.checks.tenantContextResetBetweenRequests, false);
    assert.strictEqual(result.checks.cleanupComplete, true);
    assert.strictEqual(pool.state.rows.size, 0);
  });

  await test('PRODUCTIZATION-P12-07', async () => {
    const pool = createFakePool({ failRoleQuery: true });
    const result = await runPostgresRuntimeRlsProbe(probeInput(pool, { probeRunId: 'probe-error' }));
    assert.strictEqual(result.status, RLS_PROBE_STATUS.HOLD_PROBE_EXECUTION);
    assert.strictEqual(result.productionSecurityVerifiedByThisModule, false);
    assert.ok(!JSON.stringify(result).includes('database password'));
    assert.ok(!JSON.stringify(result).includes('should-not-leak'));
  });

  await test('PRODUCTIZATION-P12-08', async () => {
    const pool = createFakePool();
    await assert.rejects(
      () => runPostgresRuntimeRlsProbe(probeInput(pool, { expectedRuntimeRole: 'Admin Role' })),
      /lowercase PostgreSQL identifier/,
    );
    await assert.rejects(
      () => runPostgresRuntimeRlsProbe(probeInput(pool, { probeRunId: '../unsafe' })),
      /bounded opaque identifier/,
    );
  });

  const failed = results.filter((entry) => entry[1] !== 'PASS');
  console.log(`PRODUCTIZATION_P12_POSTGRES_RLS_PROBE_RESULT=${failed.length === 0 ? 'PASS' : 'FAIL'} ${results.filter((entry) => entry[1] === 'PASS').length}/${results.length}`);
  if (failed.length > 0) process.exit(1);
})().catch((error) => {
  console.error('PRODUCTIZATION_P12_POSTGRES_RLS_PROBE_FATAL', error && error.stack ? error.stack : error);
  process.exit(1);
});
