'use strict';

const { generateTenantRlsMigration } = require('../security/postgres-rls-migration-generator');

function assertIdentifier(value, field) {
  if (typeof value !== 'string' || !/^[a-z_][a-z0-9_]*$/.test(value)) {
    throw new TypeError(`${field} must be a lowercase PostgreSQL identifier`);
  }
  return value;
}

function generateCanonicalWorkspacePostgresMigration({
  schemaName = 'public',
  tableName = 'canonical_workspaces',
  runtimeRole,
  tenantSetting = 'app.tenant_id',
} = {}) {
  const schema = assertIdentifier(schemaName, 'schemaName');
  const table = assertIdentifier(tableName, 'tableName');
  const qualified = `${schema}.${table}`;
  const updatedAtIndex = `${table}_updated_at_idx`;

  const schemaLines = [
    '-- STARTAK canonical workspace PostgreSQL schema migration.',
    '-- Generated code is not proof that this migration has been executed on a target database.',
    'BEGIN;',
    `CREATE TABLE IF NOT EXISTS ${qualified} (`,
    '  tenant_id text NOT NULL,',
    '  workspace_id text NOT NULL,',
    '  version bigint NOT NULL CHECK (version >= 1),',
    '  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = \'object\'),',
    '  updated_at timestamptz NOT NULL DEFAULT now(),',
    '  PRIMARY KEY (tenant_id, workspace_id),',
    '  CHECK (payload->>\'tenantId\' = tenant_id),',
    '  CHECK (payload->>\'workspaceId\' = workspace_id),',
    '  CHECK ((payload->>\'version\')::bigint = version)',
    ');',
    `CREATE INDEX IF NOT EXISTS ${updatedAtIndex} ON ${qualified} (updated_at DESC);`,
    'COMMIT;',
  ];

  const rlsMigration = generateTenantRlsMigration({
    schemaName: schema,
    runtimeRole,
    tenantSetting,
    tables: [{ tableName: table, tenantColumn: 'tenant_id' }],
  });

  return Object.freeze({
    schemaVersion: 1,
    schemaName: schema,
    tableName: table,
    schemaSql: schemaLines.join('\n'),
    rlsMigration,
    executionOrder: Object.freeze(['schemaSql', 'rlsMigration.sql', 'runtimeRlsVerification']),
    executed: false,
    productionPersistenceValidated: false,
    backupRestoreValidated: false,
    disasterRecoveryValidated: false,
    semantics: 'The schema migration must be executed before the RLS migration, followed by independent runtime RLS/IDOR verification against the real target database. This generator does not perform any of those operational actions.',
  });
}

module.exports = {
  generateCanonicalWorkspacePostgresMigration,
};