'use strict';

// Emits SQL ONLY for a freshly created disposable CI PostgreSQL service.
// Never run this script against a live or shared database. No credentials,
// application data, or destructive production migration are embedded.
const { generateCanonicalWorkspacePostgresMigration } =
  require('../../src/storage/postgres-canonical-workspace-migration');

const migration = generateCanonicalWorkspacePostgresMigration({
  runtimeRole: 'startak_runtime',
  tenantSetting: 'app.tenant_id',
});
const sql = `
\\set ON_ERROR_STOP on
-- This test is confined to the dedicated GitHub Actions PostgreSQL service.
CREATE ROLE startak_runtime NOLOGIN NOBYPASSRLS;
${migration.schemaSql}
${migration.rlsMigration.sql}
SET ROLE startak_runtime;
DO $$
DECLARE v_super boolean; v_bypass boolean; v_rls boolean; v_force boolean;
BEGIN
  SELECT rolsuper, rolbypassrls INTO v_super, v_bypass FROM pg_roles WHERE rolname = current_user;
  IF current_user <> 'startak_runtime' OR v_super OR v_bypass THEN
    RAISE EXCEPTION 'CI_ROLE_NOT_RESTRICTED';
  END IF;
  SELECT relrowsecurity, relforcerowsecurity INTO v_rls, v_force
    FROM pg_class WHERE oid = 'public.canonical_workspaces'::regclass;
  IF NOT v_rls OR NOT v_force THEN RAISE EXCEPTION 'CI_RLS_NOT_FORCED'; END IF;
END $$;
-- Tenant A positive CREATE, READ, UPDATE
BEGIN;
SELECT set_config('app.tenant_id', 'tenant-ci-a', true);
INSERT INTO public.canonical_workspaces (tenant_id, workspace_id, version, payload)
VALUES ('tenant-ci-a', 'WS-CI-001', 1,
  '{"schemaVersion":1,"tenantId":"tenant-ci-a","workspaceId":"WS-CI-001","version":1}'::jsonb);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.canonical_workspaces
      WHERE tenant_id = 'tenant-ci-a' AND workspace_id = 'WS-CI-001') <> 1 THEN
    RAISE EXCEPTION 'CI_SAME_TENANT_READ_DENIED';
  END IF;
END $$;
UPDATE public.canonical_workspaces SET updated_at = updated_at
 WHERE tenant_id = 'tenant-ci-a' AND workspace_id = 'WS-CI-001';
COMMIT;

-- New transaction MUST NOT inherit tenant A's transaction-scoped context.
BEGIN;
DO $$
DECLARE rejected boolean := false;
BEGIN
  IF nullif(current_setting('app.tenant_id', true), '') IS NOT NULL THEN
    RAISE EXCEPTION 'CI_TENANT_CONTEXT_LEAK';
  END IF;
  IF (SELECT count(*) FROM public.canonical_workspaces WHERE tenant_id='tenant-ci-a') <> 0 THEN
    RAISE EXCEPTION 'CI_MISSING_CONTEXT_READ_ALLOWED';
  END IF;
  BEGIN
    INSERT INTO public.canonical_workspaces (tenant_id, workspace_id, version, payload)
    VALUES ('tenant-ci-a', 'WS-CI-MISSING', 1,
      '{"schemaVersion":1,"tenantId":"tenant-ci-a","workspaceId":"WS-CI-MISSING","version":1}'::jsonb);
  EXCEPTION WHEN insufficient_privilege THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'CI_MISSING_CONTEXT_WRITE_ALLOWED'; END IF;
END $$;
COMMIT;

-- Tenant B MUST NOT READ, UPDATE, DELETE, OR INSERT for tenant A.
BEGIN;
SELECT set_config('app.tenant_id', 'tenant-ci-b', true);
DO $$
DECLARE rejected boolean := false;
BEGIN
  IF (SELECT count(*) FROM public.canonical_workspaces WHERE tenant_id='tenant-ci-a') <> 0 THEN
    RAISE EXCEPTION 'CI_CROSS_TENANT_READ_ALLOWED';
  END IF;
  IF (SELECT count(*) FROM (
    UPDATE public.canonical_workspaces SET updated_at = updated_at
    WHERE tenant_id='tenant-ci-a' AND workspace_id='WS-CI-001'
    RETURNING workspace_id
  ) AS x) <> 0 THEN
    RAISE EXCEPTION 'CI_CROSS_TENANT_UPDATE_ALLOWED';
  END IF;
END $$;
COMMIT;
`;

// PostgreSQL does not permit UPDATE inside a subquery SELECT in the DO above.
// Keep executable commands inside PL/pgSQL with GET DIAGNOSTICS instead.
const correctedSql = sql.replace(
  `  IF (SELECT count(*) FROM (
    UPDATE public.canonical_workspaces SET updated_at = updated_at
    WHERE tenant_id='tenant-ci-a' AND workspace_id='WS-CI-001'
    RETURNING workspace_id
  ) AS x) <> 0 THEN
    RAISE EXCEPTION 'CI_CROSS_TENANT_UPDATE_ALLOWED';
  END IF;`,
  `  UPDATE public.canonical_workspaces SET updated_at = updated_at
    WHERE tenant_id='tenant-ci-a' AND workspace_id='WS-CI-001';
  IF FOUND THEN RAISE EXCEPTION 'CI_CROSS_TENANT_UPDATE_ALLOWED'; END IF;
  DELETE FROM public.canonical_workspaces
    WHERE tenant_id='tenant-ci-a' AND workspace_id='WS-CI-001';
  IF FOUND THEN RAISE EXCEPTION 'CI_CROSS_TENANT_DELETE_ALLOWED'; END IF;
  BEGIN
    INSERT INTO public.canonical_workspaces (tenant_id, workspace_id, version, payload)
    VALUES ('tenant-ci-a', 'WS-CI-CROSS', 1,
      '{"schemaVersion":1,"tenantId":"tenant-ci-a","workspaceId":"WS-CI-CROSS","version":1}'::jsonb);
  EXCEPTION WHEN insufficient_privilege THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'CI_CROSS_TENANT_INSERT_ALLOWED'; END IF;`,
);

const cleanup = `
BEGIN;
SELECT set_config('app.tenant_id', 'tenant-ci-a', true);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.canonical_workspaces
     WHERE tenant_id='tenant-ci-a' AND workspace_id='WS-CI-001') <> 1 THEN
    RAISE EXCEPTION 'CI_CROSS_TENANT_CORRUPTED_PRIMARY_ROW';
  END IF;
  DELETE FROM public.canonical_workspaces
  WHERE tenant_id='tenant-ci-a' AND workspace_id='WS-CI-001';
  IF FOUND IS NOT TRUE THEN RAISE EXCEPTION 'CI_OWNER_DELETE_FAILED'; END IF;
END $$;
COMMIT;
RESET ROLE;
SELECT 'LIVE_ISOLATED_POSTGRES_RLS_PASS' AS ci_rls_result;
`;
process.stdout.write(correctedSql + cleanup);
