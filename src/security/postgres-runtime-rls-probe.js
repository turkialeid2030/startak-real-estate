'use strict';

const crypto = require('crypto');

const RLS_PROBE_STATUS = Object.freeze({
  PASS_NOT_PRODUCTION_CERTIFIED: 'PASS_NOT_PRODUCTION_CERTIFIED',
  HOLD_PRIVILEGED_ROLE: 'HOLD_PRIVILEGED_ROLE',
  HOLD_FORCE_RLS: 'HOLD_FORCE_RLS',
  HOLD_SAME_TENANT: 'HOLD_SAME_TENANT',
  HOLD_CROSS_TENANT: 'HOLD_CROSS_TENANT',
  HOLD_MISSING_CONTEXT: 'HOLD_MISSING_CONTEXT',
  HOLD_CONTEXT_RESET: 'HOLD_CONTEXT_RESET',
  HOLD_CLEANUP: 'HOLD_CLEANUP',
  HOLD_PROBE_EXECUTION: 'HOLD_PROBE_EXECUTION',
});

const AUTHORITY = Object.freeze({
  releaseAuthorized: false,
  mergeAuthorized: false,
  deploymentAuthorized: false,
  goLiveAuthorized: false,
  transactionAuthorized: false,
  productionPersistenceValidated: false,
  productionSecurityValidated: false,
});

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function assertIdentifier(value, field) {
  const normalized = requiredString(value, field);
  if (!/^[a-z_][a-z0-9_]*$/.test(normalized)) throw new TypeError(`${field} must be a lowercase PostgreSQL identifier`);
  return normalized;
}

function assertTenantSetting(value) {
  const normalized = requiredString(value, 'tenantSetting');
  if (!/^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)+$/.test(normalized)) {
    throw new TypeError('tenantSetting must be a dotted lowercase PostgreSQL setting name');
  }
  return normalized;
}

function normalizeProbeRunId(value) {
  const normalized = requiredString(value, 'probeRunId');
  if (normalized.length > 64 || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(normalized)) {
    throw new TypeError('probeRunId must be a bounded opaque identifier');
  }
  return normalized;
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

async function withClient(pool, fn) {
  const client = await pool.connect();
  if (!client || typeof client.query !== 'function' || typeof client.release !== 'function') {
    throw new TypeError('pool.connect must return a client with query/release');
  }
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

async function withTransaction(pool, tenantSetting, tenantId, fn) {
  return withClient(pool, async (client) => {
    let began = false;
    try {
      await client.query('BEGIN');
      began = true;
      if (tenantId != null) {
        await client.query('SELECT set_config($1, $2, true) AS tenant_context', [tenantSetting, tenantId]);
      }
      const result = await fn(client);
      await client.query('COMMIT');
      began = false;
      return result;
    } catch (error) {
      if (began) {
        try { await client.query('ROLLBACK'); } catch (_) { /* preserve original error */ }
      }
      throw error;
    }
  });
}

function denialError(error) {
  return Boolean(error && String(error.code || '') === '42501');
}

async function expectRlsWriteDenial(pool, tenantSetting, tenantId, sql, params) {
  try {
    await withTransaction(pool, tenantSetting, tenantId, (client) => client.query(sql, params));
    return false;
  } catch (error) {
    if (denialError(error)) return true;
    throw error;
  }
}

function buildPayload({ tenantId, workspaceId, probeRunId, testedAt }) {
  return JSON.stringify({
    schemaVersion: 1,
    tenantId,
    workspaceId,
    version: 1,
    updatedAt: testedAt,
    updatedBy: `rls-probe:${probeRunId}`,
    workspace: {
      schemaVersion: 1,
      workspaceId,
      projectId: `rls-probe-project:${probeRunId}`,
      caseId: `rls-probe-case:${probeRunId}`,
    },
    history: [],
    authority: {
      productionPersistenceValidated: false,
      transactionAuthorized: false,
    },
  });
}

function statusFromChecks(checks) {
  if (checks.runtimeRoleIsSuperuser || checks.runtimeRoleBypassesRls) return RLS_PROBE_STATUS.HOLD_PRIVILEGED_ROLE;
  if (!checks.forceRlsEnabled) return RLS_PROBE_STATUS.HOLD_FORCE_RLS;
  if (!checks.sameTenantCrudAllowed) return RLS_PROBE_STATUS.HOLD_SAME_TENANT;
  if (!checks.crossTenantCrudDenied) return RLS_PROBE_STATUS.HOLD_CROSS_TENANT;
  if (!checks.missingTenantContextDenied) return RLS_PROBE_STATUS.HOLD_MISSING_CONTEXT;
  if (!checks.tenantContextResetBetweenRequests) return RLS_PROBE_STATUS.HOLD_CONTEXT_RESET;
  if (!checks.cleanupComplete) return RLS_PROBE_STATUS.HOLD_CLEANUP;
  return RLS_PROBE_STATUS.PASS_NOT_PRODUCTION_CERTIFIED;
}

function digestEvidence(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

/**
 * Executes a narrow, mutating RLS isolation probe against the injected PostgreSQL runtime pool.
 *
 * The target table must already exist and RLS must already be configured. The probe creates
 * uniquely-scoped temporary rows, checks same-tenant access, cross-tenant denial, missing-context
 * denial and transaction-local tenant-context reset, then removes its rows. It never grants
 * privileges, changes RLS policies, executes migrations, or certifies production security.
 */
async function runPostgresRuntimeRlsProbe({
  pool,
  expectedRuntimeRole,
  environment,
  targetDatabaseRef,
  probeRunId,
  testedAt = new Date().toISOString(),
  schemaName = 'public',
  tableName = 'canonical_workspaces',
  tenantSetting = 'app.tenant_id',
} = {}) {
  if (!pool || typeof pool.connect !== 'function') throw new TypeError('pool.connect is required');
  const runtimeRole = assertIdentifier(expectedRuntimeRole, 'expectedRuntimeRole');
  const env = requiredString(environment, 'environment');
  const databaseRef = requiredString(targetDatabaseRef, 'targetDatabaseRef');
  const runId = normalizeProbeRunId(probeRunId);
  const timestamp = requiredString(testedAt, 'testedAt');
  const schema = assertIdentifier(schemaName, 'schemaName');
  const table = assertIdentifier(tableName, 'tableName');
  const setting = assertTenantSetting(tenantSetting);
  const qualified = `${schema}.${table}`;

  const tenantA = `rls_probe_a:${runId}`;
  const tenantB = `rls_probe_b:${runId}`;
  const primaryId = `rls-probe:${runId}:primary`;
  const crossInsertId = `rls-probe:${runId}:cross-insert`;
  const missingInsertId = `rls-probe:${runId}:missing-insert`;
  const cleanupIds = [primaryId, crossInsertId, missingInsertId];

  const checks = {
    runtimeRoleMatchesExpected: false,
    runtimeRoleIsSuperuser: false,
    runtimeRoleBypassesRls: false,
    forceRlsEnabled: false,
    sameTenantCrudAllowed: false,
    crossTenantCrudDenied: false,
    missingTenantContextDenied: false,
    tenantContextResetBetweenRequests: false,
    privilegedPathSeparatelyTested: false,
    cleanupComplete: false,
  };

  let mutationStarted = false;
  let executionFailure = false;

  try {
    const roleRows = await withClient(pool, async (client) => {
      const result = await client.query(
        'SELECT current_user AS role_name, r.rolsuper, r.rolbypassrls FROM pg_roles r WHERE r.rolname = current_user',
      );
      return Array.isArray(result?.rows) ? result.rows : [];
    });
    if (roleRows.length !== 1) throw new Error('ROLE_METADATA_UNAVAILABLE');
    checks.runtimeRoleMatchesExpected = roleRows[0].role_name === runtimeRole;
    checks.runtimeRoleIsSuperuser = roleRows[0].rolsuper === true;
    checks.runtimeRoleBypassesRls = roleRows[0].rolbypassrls === true;
    if (!checks.runtimeRoleMatchesExpected) throw new Error('RUNTIME_ROLE_MISMATCH');

    const tableRows = await withClient(pool, async (client) => {
      const result = await client.query(
        'SELECT c.relrowsecurity, c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = $1 AND c.relname = $2 AND c.relkind = $3',
        [schema, table, 'r'],
      );
      return Array.isArray(result?.rows) ? result.rows : [];
    });
    if (tableRows.length !== 1) throw new Error('RLS_TABLE_METADATA_UNAVAILABLE');
    checks.forceRlsEnabled = tableRows[0].relrowsecurity === true && tableRows[0].relforcerowsecurity === true;

    if (checks.runtimeRoleIsSuperuser || checks.runtimeRoleBypassesRls || !checks.forceRlsEnabled) {
      const status = statusFromChecks(checks);
      const evidenceCore = { schemaVersion: 1, status, environment: env, targetDatabaseRef: databaseRef, probeRunId: runId, testedAt: timestamp, checks };
      const probeHashSha256 = digestEvidence(evidenceCore);
      return freeze({
        ...evidenceCore,
        evidenceRef: `sha256:${probeHashSha256}`,
        probeHashSha256,
        mutationExecuted: false,
        productionSecurityVerifiedByThisModule: false,
        requiresIndependentRuntimeEvidence: true,
        authority: AUTHORITY,
      });
    }

    mutationStarted = true;
    const payload = buildPayload({ tenantId: tenantA, workspaceId: primaryId, probeRunId: runId, testedAt: timestamp });
    const insertResult = await withTransaction(pool, setting, tenantA, (client) => client.query(
      `INSERT INTO ${qualified} (tenant_id, workspace_id, version, payload, updated_at) VALUES ($1, $2, 1, $3::jsonb, now()) RETURNING workspace_id`,
      [tenantA, primaryId, payload],
    ));
    const inserted = insertResult?.rowCount === 1;

    const sameTenantSelect = await withTransaction(pool, setting, tenantA, (client) => client.query(
      `SELECT workspace_id FROM ${qualified} WHERE tenant_id = $1 AND workspace_id = $2`,
      [tenantA, primaryId],
    ));
    const sameTenantUpdate = await withTransaction(pool, setting, tenantA, (client) => client.query(
      `UPDATE ${qualified} SET updated_at = updated_at WHERE tenant_id = $1 AND workspace_id = $2 RETURNING workspace_id`,
      [tenantA, primaryId],
    ));

    const contextReset = await withTransaction(pool, setting, null, (client) => client.query(
      'SELECT nullif(current_setting($1, true), \'\') AS tenant_context',
      [setting],
    ));
    checks.tenantContextResetBetweenRequests = contextReset?.rows?.[0]?.tenant_context == null;

    const crossSelect = await withTransaction(pool, setting, tenantB, (client) => client.query(
      `SELECT workspace_id FROM ${qualified} WHERE tenant_id = $1 AND workspace_id = $2`,
      [tenantA, primaryId],
    ));
    const crossUpdate = await withTransaction(pool, setting, tenantB, (client) => client.query(
      `UPDATE ${qualified} SET updated_at = updated_at WHERE tenant_id = $1 AND workspace_id = $2 RETURNING workspace_id`,
      [tenantA, primaryId],
    ));
    const crossDelete = await withTransaction(pool, setting, tenantB, (client) => client.query(
      `DELETE FROM ${qualified} WHERE tenant_id = $1 AND workspace_id = $2 RETURNING workspace_id`,
      [tenantA, primaryId],
    ));
    const crossInsertDenied = await expectRlsWriteDenial(
      pool,
      setting,
      tenantB,
      `INSERT INTO ${qualified} (tenant_id, workspace_id, version, payload, updated_at) VALUES ($1, $2, 1, $3::jsonb, now()) RETURNING workspace_id`,
      [tenantA, crossInsertId, buildPayload({ tenantId: tenantA, workspaceId: crossInsertId, probeRunId: runId, testedAt: timestamp })],
    );

    const missingSelect = await withTransaction(pool, setting, null, (client) => client.query(
      `SELECT workspace_id FROM ${qualified} WHERE tenant_id = $1 AND workspace_id = $2`,
      [tenantA, primaryId],
    ));
    const missingInsertDenied = await expectRlsWriteDenial(
      pool,
      setting,
      null,
      `INSERT INTO ${qualified} (tenant_id, workspace_id, version, payload, updated_at) VALUES ($1, $2, 1, $3::jsonb, now()) RETURNING workspace_id`,
      [tenantA, missingInsertId, buildPayload({ tenantId: tenantA, workspaceId: missingInsertId, probeRunId: runId, testedAt: timestamp })],
    );

    checks.sameTenantCrudAllowed = Boolean(
      inserted
      && sameTenantSelect?.rowCount === 1
      && sameTenantUpdate?.rowCount === 1,
    );
    checks.crossTenantCrudDenied = Boolean(
      crossSelect?.rowCount === 0
      && crossUpdate?.rowCount === 0
      && crossDelete?.rowCount === 0
      && crossInsertDenied,
    );
    checks.missingTenantContextDenied = Boolean(
      missingSelect?.rowCount === 0
      && missingInsertDenied,
    );
  } catch (_) {
    executionFailure = true;
  } finally {
    if (mutationStarted) {
      try {
        let primaryDeleteObserved = false;
        for (const workspaceId of cleanupIds) {
          const result = await withTransaction(pool, setting, tenantA, (client) => client.query(
            `DELETE FROM ${qualified} WHERE tenant_id = $1 AND workspace_id = $2 RETURNING workspace_id`,
            [tenantA, workspaceId],
          ));
          if (workspaceId === primaryId) primaryDeleteObserved = result?.rowCount === 1;
        }

        let allProbeRowsGone = true;
        for (const workspaceId of cleanupIds) {
          const result = await withTransaction(pool, setting, tenantA, (client) => client.query(
            `SELECT workspace_id FROM ${qualified} WHERE tenant_id = $1 AND workspace_id = $2`,
            [tenantA, workspaceId],
          ));
          if (result?.rowCount !== 0) allProbeRowsGone = false;
        }
        checks.cleanupComplete = allProbeRowsGone;

        // On the passing isolation path, cleanup of the primary row is also the same-tenant DELETE check.
        // If a broken cross-tenant policy already deleted that row, preserve the more material cross-tenant
        // failure instead of misclassifying the result as a cleanup failure.
        if (checks.crossTenantCrudDenied) {
          checks.sameTenantCrudAllowed = checks.sameTenantCrudAllowed && primaryDeleteObserved;
        }
      } catch (_) {
        checks.cleanupComplete = false;
      }
    }
  }

  let status = executionFailure ? RLS_PROBE_STATUS.HOLD_PROBE_EXECUTION : statusFromChecks(checks);
  if (!checks.cleanupComplete && mutationStarted) status = RLS_PROBE_STATUS.HOLD_CLEANUP;

  const evidenceCore = {
    schemaVersion: 1,
    status,
    environment: env,
    targetDatabaseRef: databaseRef,
    probeRunId: runId,
    testedAt: timestamp,
    tableRef: `${schema}.${table}`,
    runtimeRole,
    tenantSetting: setting,
    checks,
  };
  const probeHashSha256 = digestEvidence(evidenceCore);

  return freeze({
    ...evidenceCore,
    evidenceRef: `sha256:${probeHashSha256}`,
    probeHashSha256,
    mutationExecuted: mutationStarted,
    productionSecurityVerifiedByThisModule: false,
    requiresIndependentRuntimeEvidence: true,
    privilegedPathSeparatelyTested: false,
    authority: AUTHORITY,
    semantics: 'This probe executes narrow same-tenant/cross-tenant/missing-context RLS checks against the injected PostgreSQL runtime pool and cleans up its temporary rows. A PASS is runtime evidence for this probe scope only. It does not test an owner/admin path, certify security, prove API-layer IDOR/BOLA resistance, establish production persistence, or authorize release/deployment/go-live/transactions.',
  });
}

module.exports = {
  RLS_PROBE_STATUS,
  AUTHORITY,
  runPostgresRuntimeRlsProbe,
};
