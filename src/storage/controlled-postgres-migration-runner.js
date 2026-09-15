'use strict';

const crypto = require('crypto');
const {
  generateCanonicalWorkspacePostgresMigration,
} = require('./postgres-canonical-workspace-migration');

const MIGRATION_STATUS = Object.freeze({
  DRY_RUN_READY: 'DRY_RUN_READY',
  HOLD_AUTHORIZATION: 'HOLD_AUTHORIZATION',
  HOLD_TARGET_MISMATCH: 'HOLD_TARGET_MISMATCH',
  HOLD_PREFLIGHT: 'HOLD_PREFLIGHT',
  HOLD_SCHEMA_EXECUTION: 'HOLD_SCHEMA_EXECUTION',
  HOLD_RLS_EXECUTION: 'HOLD_RLS_EXECUTION',
  HOLD_POSTCHECK: 'HOLD_POSTCHECK',
  APPLIED_NOT_PRODUCTION_CERTIFIED: 'APPLIED_NOT_PRODUCTION_CERTIFIED',
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

const ALLOWED_ENVIRONMENTS = Object.freeze(['staging', 'preproduction']);

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function assertIdentifier(value, field) {
  const normalized = requiredString(value, field);
  if (!/^[a-z_][a-z0-9_]*$/.test(normalized)) throw new TypeError(`${field} must be a lowercase PostgreSQL identifier`);
  return normalized;
}

function normalizeEnvironment(value) {
  const normalized = requiredString(value, 'environment').toLowerCase();
  if (!ALLOWED_ENVIRONMENTS.includes(normalized)) {
    throw new TypeError(`environment must be one of: ${ALLOWED_ENVIRONMENTS.join(', ')}`);
  }
  return normalized;
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function sanitizeAuthorization(authorization) {
  if (!authorization || typeof authorization !== 'object' || Array.isArray(authorization)) return null;
  const approved = authorization.approved === true;
  const allowMutation = authorization.allowMutation === true;
  const approvedBy = typeof authorization.approvedBy === 'string' ? authorization.approvedBy.trim() : '';
  const approvedAt = typeof authorization.approvedAt === 'string' ? authorization.approvedAt.trim() : '';
  const changeRef = typeof authorization.changeRef === 'string' ? authorization.changeRef.trim() : '';
  const environment = typeof authorization.environment === 'string' ? authorization.environment.trim().toLowerCase() : '';
  const targetDatabaseRef = typeof authorization.targetDatabaseRef === 'string' ? authorization.targetDatabaseRef.trim() : '';
  const expectedDatabaseName = typeof authorization.expectedDatabaseName === 'string' ? authorization.expectedDatabaseName.trim() : '';
  return Object.freeze({
    approved,
    allowMutation,
    approvedBy: approvedBy || null,
    approvedAt: approvedAt || null,
    changeRef: changeRef || null,
    environment: environment || null,
    targetDatabaseRef: targetDatabaseRef || null,
    expectedDatabaseName: expectedDatabaseName || null,
  });
}

function authorizationMatches({ authorization, environment, targetDatabaseRef, expectedDatabaseName }) {
  return Boolean(
    authorization
    && authorization.approved
    && authorization.allowMutation
    && authorization.approvedBy
    && authorization.approvedAt
    && authorization.changeRef
    && authorization.environment === environment
    && authorization.targetDatabaseRef === targetDatabaseRef
    && authorization.expectedDatabaseName === expectedDatabaseName,
  );
}

function buildPlan({
  environment,
  targetDatabaseRef,
  expectedDatabaseName,
  expectedMigrationRole,
  runtimeRole,
  schemaName,
  tableName,
  tenantSetting,
}) {
  const migration = generateCanonicalWorkspacePostgresMigration({
    schemaName,
    tableName,
    runtimeRole,
    tenantSetting,
  });
  const schemaHashSha256 = sha256(migration.schemaSql);
  const rlsHashSha256 = sha256(migration.rlsMigration.sql);
  const planCore = {
    schemaVersion: 1,
    environment,
    targetDatabaseRef,
    expectedDatabaseName,
    expectedMigrationRole,
    runtimeRole,
    schemaName: migration.schemaName,
    tableName: migration.tableName,
    tenantSetting: migration.rlsMigration.tenantSetting,
    schemaHashSha256,
    rlsHashSha256,
    executionOrder: migration.executionOrder,
  };
  return {
    migration,
    plan: freeze({ ...planCore, planHashSha256: sha256(JSON.stringify(planCore)) }),
  };
}

async function withClient(pool, fn) {
  const client = await pool.connect();
  if (!client || typeof client.query !== 'function' || typeof client.release !== 'function') {
    throw new TypeError('migrationPool.connect must return a client with query/release');
  }
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

function resultBase({ status, plan, authorization, execution }) {
  return freeze({
    schemaVersion: 1,
    status,
    plan,
    authorization: authorization ? {
      approved: authorization.approved,
      allowMutation: authorization.allowMutation,
      approvedBy: authorization.approvedBy,
      approvedAt: authorization.approvedAt,
      changeRef: authorization.changeRef,
    } : null,
    execution,
    productionQualified: false,
    authority: AUTHORITY,
    semantics: 'This controlled runner can prepare or execute the generated canonical-workspace schema and tenant-RLS migration only for explicitly approved staging/preproduction targets. It does not support production targets, does not supply database credentials, and does not establish production persistence/security, backup/restore, DR, legal approval, or release/deployment/go-live authority.',
  });
}

/**
 * Controlled canonical-workspace PostgreSQL migration runner.
 *
 * Default behavior is dry-run planning. Mutation requires a target-bound human authorization
 * record and is intentionally limited to staging/preproduction. Database credentials/pools are
 * injected by the host and are never returned by this module.
 */
async function runControlledCanonicalWorkspaceMigration({
  migrationPool,
  environment,
  targetDatabaseRef,
  expectedDatabaseName,
  expectedMigrationRole,
  runtimeRole,
  authorization,
  execute = false,
  schemaName = 'public',
  tableName = 'canonical_workspaces',
  tenantSetting = 'app.tenant_id',
} = {}) {
  const env = normalizeEnvironment(environment);
  const databaseRef = requiredString(targetDatabaseRef, 'targetDatabaseRef');
  const databaseName = assertIdentifier(expectedDatabaseName, 'expectedDatabaseName');
  const migrationRole = assertIdentifier(expectedMigrationRole, 'expectedMigrationRole');
  const runtime = assertIdentifier(runtimeRole, 'runtimeRole');
  if (migrationRole === runtime) throw new TypeError('expectedMigrationRole must be distinct from runtimeRole');
  const schema = assertIdentifier(schemaName, 'schemaName');
  const table = assertIdentifier(tableName, 'tableName');
  const normalizedAuthorization = sanitizeAuthorization(authorization);
  const { migration, plan } = buildPlan({
    environment: env,
    targetDatabaseRef: databaseRef,
    expectedDatabaseName: databaseName,
    expectedMigrationRole: migrationRole,
    runtimeRole: runtime,
    schemaName: schema,
    tableName: table,
    tenantSetting,
  });

  const initialExecution = {
    mutationRequested: execute === true,
    mutationExecuted: false,
    preflightPassed: false,
    schemaApplied: false,
    rlsApplied: false,
    postcheckPassed: false,
  };

  if (execute !== true) {
    return resultBase({
      status: MIGRATION_STATUS.DRY_RUN_READY,
      plan,
      authorization: normalizedAuthorization,
      execution: initialExecution,
    });
  }

  if (!authorizationMatches({
    authorization: normalizedAuthorization,
    environment: env,
    targetDatabaseRef: databaseRef,
    expectedDatabaseName: databaseName,
  })) {
    return resultBase({
      status: MIGRATION_STATUS.HOLD_AUTHORIZATION,
      plan,
      authorization: normalizedAuthorization,
      execution: initialExecution,
    });
  }

  if (!migrationPool || typeof migrationPool.connect !== 'function') throw new TypeError('migrationPool.connect is required for execution');

  let actualDatabaseName = null;
  let actualMigrationRole = null;
  try {
    const preflight = await withClient(migrationPool, (client) => client.query(
      'SELECT current_database() AS database_name, current_user AS role_name',
    ));
    actualDatabaseName = preflight?.rows?.[0]?.database_name || null;
    actualMigrationRole = preflight?.rows?.[0]?.role_name || null;
  } catch (_) {
    return resultBase({
      status: MIGRATION_STATUS.HOLD_PREFLIGHT,
      plan,
      authorization: normalizedAuthorization,
      execution: initialExecution,
    });
  }

  if (actualDatabaseName !== databaseName || actualMigrationRole !== migrationRole) {
    return resultBase({
      status: MIGRATION_STATUS.HOLD_TARGET_MISMATCH,
      plan,
      authorization: normalizedAuthorization,
      execution: {
        ...initialExecution,
        actualDatabaseName,
        actualMigrationRole,
      },
    });
  }

  const executionState = {
    ...initialExecution,
    preflightPassed: true,
    actualDatabaseName,
    actualMigrationRole,
  };

  try {
    await withClient(migrationPool, (client) => client.query(migration.schemaSql));
    executionState.mutationExecuted = true;
    executionState.schemaApplied = true;
  } catch (_) {
    return resultBase({
      status: MIGRATION_STATUS.HOLD_SCHEMA_EXECUTION,
      plan,
      authorization: normalizedAuthorization,
      execution: executionState,
    });
  }

  try {
    await withClient(migrationPool, (client) => client.query(migration.rlsMigration.sql));
    executionState.rlsApplied = true;
  } catch (_) {
    return resultBase({
      status: MIGRATION_STATUS.HOLD_RLS_EXECUTION,
      plan,
      authorization: normalizedAuthorization,
      execution: executionState,
    });
  }

  try {
    const postcheck = await withClient(migrationPool, (client) => client.query(
      'SELECT c.relrowsecurity, c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = $1 AND c.relname = $2 AND c.relkind = $3',
      [schema, table, 'r'],
    ));
    const row = postcheck?.rows?.[0];
    executionState.postcheckPassed = Boolean(row && row.relrowsecurity === true && row.relforcerowsecurity === true);
  } catch (_) {
    executionState.postcheckPassed = false;
  }

  if (!executionState.postcheckPassed) {
    return resultBase({
      status: MIGRATION_STATUS.HOLD_POSTCHECK,
      plan,
      authorization: normalizedAuthorization,
      execution: executionState,
    });
  }

  return resultBase({
    status: MIGRATION_STATUS.APPLIED_NOT_PRODUCTION_CERTIFIED,
    plan,
    authorization: normalizedAuthorization,
    execution: executionState,
  });
}

module.exports = {
  MIGRATION_STATUS,
  AUTHORITY,
  ALLOWED_ENVIRONMENTS,
  runControlledCanonicalWorkspaceMigration,
};
