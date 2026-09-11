'use strict';

function assertIdentifier(value, field) {
  if (typeof value !== 'string' || !/^[a-z_][a-z0-9_]*$/.test(value)) {
    throw new TypeError(`${field} must be a lowercase PostgreSQL identifier`);
  }
  return value;
}

function assertTenantSetting(value) {
  if (typeof value !== 'string' || !/^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)+$/.test(value)) {
    throw new TypeError('tenantSetting must be a dotted lowercase PostgreSQL setting name');
  }
  return value;
}

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function fail(code, message = code) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function normalizePayload(raw, scope, expectedVersion) {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (_) {
    fail('POSTGRES_WORKSPACE_INVALID_JSON');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) fail('POSTGRES_WORKSPACE_INVALID_JSON');
  if (payload.tenantId !== scope.tenantId || payload.workspaceId !== scope.workspaceId) {
    fail('POSTGRES_WORKSPACE_SCOPE_MISMATCH');
  }
  if (payload.version !== expectedVersion) fail('POSTGRES_WORKSPACE_VERSION_MISMATCH');
  return payload;
}

function serializePayload(payload) {
  if (payload == null) return null;
  if (typeof payload === 'string') return payload;
  return JSON.stringify(payload);
}

/**
 * PostgreSQL-compatible atomic workspace provider.
 *
 * `pool` is dependency-injected and must implement the standard pool shape:
 *   pool.connect() -> client; client.query(sql, params); client.release().
 * This module intentionally does not import a database driver into the browser bundle.
 * A server runtime must provide and configure the real PostgreSQL pool.
 */
function createPostgresCanonicalWorkspaceProvider({
  pool,
  schemaName = 'public',
  tableName = 'canonical_workspaces',
  tenantSetting = 'app.tenant_id',
} = {}) {
  if (!pool || typeof pool.connect !== 'function') throw new TypeError('pool.connect is required');
  const schema = assertIdentifier(schemaName, 'schemaName');
  const table = assertIdentifier(tableName, 'tableName');
  const setting = assertTenantSetting(tenantSetting);
  const qualifiedTable = `${schema}.${table}`;

  async function withTenantTransaction(tenantId, operation) {
    const normalizedTenantId = requiredString(tenantId, 'tenantId');
    const client = await pool.connect();
    if (!client || typeof client.query !== 'function' || typeof client.release !== 'function') {
      throw new TypeError('pool.connect must return a client with query/release');
    }

    let began = false;
    try {
      await client.query('BEGIN');
      began = true;
      await client.query('SELECT set_config($1, $2, true) AS tenant_context', [setting, normalizedTenantId]);
      const result = await operation(client, normalizedTenantId);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      if (began) {
        try {
          await client.query('ROLLBACK');
        } catch (_) {
          // Preserve the original failure. Pool health/rollback failures are operational evidence concerns.
        }
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async function getScoped({ tenantId, workspaceId } = {}) {
    const scope = {
      tenantId: requiredString(tenantId, 'tenantId'),
      workspaceId: requiredString(workspaceId, 'workspaceId'),
    };

    return withTenantTransaction(scope.tenantId, async (client) => {
      const result = await client.query(
        `SELECT payload FROM ${qualifiedTable} WHERE tenant_id = $1 AND workspace_id = $2 LIMIT 1`,
        [scope.tenantId, scope.workspaceId],
      );
      if (!result || !Number.isInteger(result.rowCount)) fail('POSTGRES_WORKSPACE_INVALID_DRIVER_RESULT');
      if (result.rowCount === 0) return null;
      if (!Array.isArray(result.rows) || result.rows.length !== 1) fail('POSTGRES_WORKSPACE_INVALID_DRIVER_RESULT');
      const raw = serializePayload(result.rows[0].payload);
      if (raw == null) fail('POSTGRES_WORKSPACE_INVALID_DRIVER_RESULT');
      return raw;
    });
  }

  async function compareAndSetScoped({
    tenantId,
    workspaceId,
    expectedRaw,
    nextRaw,
    expectedVersion,
    nextVersion,
  } = {}) {
    const scope = {
      tenantId: requiredString(tenantId, 'tenantId'),
      workspaceId: requiredString(workspaceId, 'workspaceId'),
    };
    if (!Number.isInteger(expectedVersion) || expectedVersion < 0) throw new TypeError('expectedVersion must be an integer >= 0');
    if (!Number.isInteger(nextVersion) || nextVersion !== expectedVersion + 1) {
      throw new TypeError('nextVersion must equal expectedVersion + 1');
    }
    if (typeof nextRaw !== 'string' || nextRaw.trim() === '') throw new TypeError('nextRaw must be a non-empty JSON string');
    normalizePayload(nextRaw, scope, nextVersion);

    if (expectedVersion === 0) {
      if (expectedRaw != null) fail('POSTGRES_WORKSPACE_EXPECTED_STATE_MISMATCH');
    } else {
      if (typeof expectedRaw !== 'string' || expectedRaw.trim() === '') fail('POSTGRES_WORKSPACE_EXPECTED_STATE_MISMATCH');
      normalizePayload(expectedRaw, scope, expectedVersion);
    }

    return withTenantTransaction(scope.tenantId, async (client) => {
      let result;
      if (expectedVersion === 0) {
        result = await client.query(
          `INSERT INTO ${qualifiedTable} (tenant_id, workspace_id, version, payload, updated_at)\n`
            + 'VALUES ($1, $2, $3, $4::jsonb, now())\n'
            + 'ON CONFLICT (tenant_id, workspace_id) DO NOTHING\n'
            + 'RETURNING version',
          [scope.tenantId, scope.workspaceId, nextVersion, nextRaw],
        );
      } else {
        result = await client.query(
          `UPDATE ${qualifiedTable}\n`
            + 'SET version = $3, payload = $4::jsonb, updated_at = now()\n'
            + 'WHERE tenant_id = $1 AND workspace_id = $2 AND version = $5\n'
            + 'RETURNING version',
          [scope.tenantId, scope.workspaceId, nextVersion, nextRaw, expectedVersion],
        );
      }
      if (!result || !Number.isInteger(result.rowCount)) fail('POSTGRES_WORKSPACE_INVALID_DRIVER_RESULT');
      if (result.rowCount > 1) fail('POSTGRES_WORKSPACE_INVALID_DRIVER_RESULT');
      return result.rowCount === 1;
    });
  }

  return Object.freeze({
    getScoped,
    compareAndSetScoped,
    providerName: () => 'PostgresCanonicalWorkspaceProvider',
    capabilities: Object.freeze({
      serverSideOnly: true,
      structuredTenantScope: true,
      atomicCompareAndSet: true,
      transactionScopedTenantContext: true,
      parameterizedValues: true,
      productionPersistenceValidated: false,
      rlsMigrationExecuted: false,
      backupRestoreValidated: false,
      disasterRecoveryValidated: false,
    }),
    configuration: Object.freeze({ schemaName: schema, tableName: table, tenantSetting: setting }),
    semantics: 'This provider implements a PostgreSQL-compatible, transaction-scoped tenant and optimistic-CAS contract. It requires a real server-side pool and executed RLS/schema migrations. Code presence is not evidence that PostgreSQL, RLS, encryption, backup/restore, DR, monitoring, or production operations are deployed or validated.',
  });
}

module.exports = {
  createPostgresCanonicalWorkspaceProvider,
};