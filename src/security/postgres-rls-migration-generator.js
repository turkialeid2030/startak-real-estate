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

function quoteLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function normalizeTables(tables) {
  if (!Array.isArray(tables) || tables.length === 0) throw new TypeError('tables must be a non-empty array');
  const seen = new Set();
  return tables.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new TypeError(`tables[${index}] must be an object`);
    const tableName = assertIdentifier(item.tableName, `tables[${index}].tableName`);
    const tenantColumn = assertIdentifier(item.tenantColumn || 'tenant_id', `tables[${index}].tenantColumn`);
    if (seen.has(tableName)) throw new Error(`DUPLICATE_RLS_TABLE:${tableName}`);
    seen.add(tableName);
    return Object.freeze({ tableName, tenantColumn });
  });
}

/**
 * Generates a migration text for tenant RLS. It does not execute SQL.
 * Runtime verification against a real PostgreSQL instance remains mandatory.
 */
function generateTenantRlsMigration({
  schemaName = 'public',
  tables,
  runtimeRole,
  tenantSetting = 'app.tenant_id',
} = {}) {
  const schema = assertIdentifier(schemaName, 'schemaName');
  const role = assertIdentifier(runtimeRole, 'runtimeRole');
  const setting = assertTenantSetting(tenantSetting);
  const normalizedTables = normalizeTables(tables);

  const lines = [];
  lines.push('-- STARTAK PostgreSQL tenant RLS migration generated deterministically.');
  lines.push('-- This file is not proof of production security until executed and independently verified on the target database.');
  lines.push('BEGIN;');
  lines.push('');
  lines.push('DO $$');
  lines.push('DECLARE');
  lines.push('  v_super boolean;');
  lines.push('  v_bypass boolean;');
  lines.push('BEGIN');
  lines.push(`  SELECT rolsuper, rolbypassrls INTO v_super, v_bypass FROM pg_roles WHERE rolname = ${quoteLiteral(role)};`);
  lines.push(`  IF NOT FOUND THEN RAISE EXCEPTION 'RLS runtime role does not exist: %', ${quoteLiteral(role)}; END IF;`);
  lines.push(`  IF v_super OR v_bypass THEN RAISE EXCEPTION 'RLS runtime role must not be superuser or BYPASSRLS: %', ${quoteLiteral(role)}; END IF;`);
  lines.push('END $$;');
  lines.push('');

  for (const { tableName, tenantColumn } of normalizedTables) {
    const qualified = `${schema}.${tableName}`;
    const policy = `${tableName}_tenant_isolation`;
    lines.push(`-- ${qualified}`);
    lines.push(`ALTER TABLE ${qualified} ENABLE ROW LEVEL SECURITY;`);
    lines.push(`ALTER TABLE ${qualified} FORCE ROW LEVEL SECURITY;`);
    lines.push(`DROP POLICY IF EXISTS ${policy} ON ${qualified};`);
    lines.push(`CREATE POLICY ${policy} ON ${qualified}`);
    lines.push(`  FOR ALL TO ${role}`);
    lines.push(`  USING (${tenantColumn}::text = nullif(current_setting(${quoteLiteral(setting)}, true), ''))`);
    lines.push(`  WITH CHECK (${tenantColumn}::text = nullif(current_setting(${quoteLiteral(setting)}, true), ''));`);
    lines.push(`REVOKE ALL ON ${qualified} FROM PUBLIC;`);
    lines.push(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${qualified} TO ${role};`);
    lines.push('');
  }

  lines.push('COMMIT;');
  lines.push('');
  lines.push('-- Required runtime verification outside this generator:');
  lines.push('-- 1) role is not superuser/BYPASSRLS; 2) cross-tenant SELECT/INSERT/UPDATE/DELETE are denied;');
  lines.push('-- 3) missing app.tenant_id fails closed; 4) owner/admin paths are separately governed;');
  lines.push('-- 5) migration is exercised against the real target schema and connection pool behavior.');

  return Object.freeze({
    schemaVersion: 1,
    schemaName: schema,
    runtimeRole: role,
    tenantSetting: setting,
    tables: Object.freeze(normalizedTables),
    sql: lines.join('\n'),
    executed: false,
    productionVerified: false,
    semantics: 'This generator produces deterministic PostgreSQL RLS migration SQL. It does not execute the migration and is not production-security evidence.',
  });
}

module.exports = { generateTenantRlsMigration };
