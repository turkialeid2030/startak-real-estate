'use strict';

const assert = require('assert');
const { generateTenantRlsMigration } = require('../../src/security/postgres-rls-migration-generator');

let checks = 0;
function check(fn) { fn(); checks++; }

const migration = generateTenantRlsMigration({
  schemaName: 'public',
  runtimeRole: 'app_runtime',
  tenantSetting: 'app.tenant_id',
  tables: [
    { tableName: 'investment_cases', tenantColumn: 'tenant_id' },
    { tableName: 'evidence_items', tenantColumn: 'tenant_id' },
  ],
});

check(() => assert.strictEqual(migration.executed, false));
check(() => assert.strictEqual(migration.productionVerified, false));
check(() => assert.strictEqual(migration.tables.length, 2));
check(() => assert.ok(migration.sql.includes('ALTER TABLE public.investment_cases ENABLE ROW LEVEL SECURITY;')));
check(() => assert.ok(migration.sql.includes('ALTER TABLE public.investment_cases FORCE ROW LEVEL SECURITY;')));
check(() => assert.ok(migration.sql.includes('CREATE POLICY investment_cases_tenant_isolation ON public.investment_cases')));
check(() => assert.ok(migration.sql.includes("current_setting('app.tenant_id', true)")));
check(() => assert.ok(migration.sql.includes('WITH CHECK (tenant_id::text =')));
check(() => assert.ok(migration.sql.includes('REVOKE ALL ON public.investment_cases FROM PUBLIC;')));
check(() => assert.ok(migration.sql.includes('GRANT SELECT, INSERT, UPDATE, DELETE ON public.investment_cases TO app_runtime;')));
check(() => assert.ok(migration.sql.includes('rolbypassrls')));
check(() => assert.ok(migration.sql.includes('rolsuper')));
check(() => assert.ok(migration.sql.includes('BEGIN;')));
check(() => assert.ok(migration.sql.includes('COMMIT;')));

check(() => assert.throws(() => generateTenantRlsMigration({
  runtimeRole: 'app_runtime',
  tables: [{ tableName: 'Bad-Table' }],
}), /lowercase PostgreSQL identifier/));

check(() => assert.throws(() => generateTenantRlsMigration({
  runtimeRole: 'app_runtime',
  tables: [{ tableName: 'cases' }, { tableName: 'cases' }],
}), /DUPLICATE_RLS_TABLE:cases/));

check(() => assert.throws(() => generateTenantRlsMigration({
  runtimeRole: 'app_runtime;drop',
  tables: [{ tableName: 'cases' }],
}), /lowercase PostgreSQL identifier/));

check(() => assert.throws(() => generateTenantRlsMigration({
  runtimeRole: 'app_runtime',
  tenantSetting: 'bad-setting',
  tables: [{ tableName: 'cases' }],
}), /dotted lowercase PostgreSQL setting name/));

check(() => assert.throws(() => generateTenantRlsMigration({
  runtimeRole: 'app_runtime',
  tables: [],
}), /tables must be a non-empty array/));

console.log(`POSTGRES_RLS_MIGRATION_GENERATOR_V1: PASS (${checks} checks)`);
