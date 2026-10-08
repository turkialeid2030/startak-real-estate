-- C73.2 isolated staging migration; requires c73_app LOGIN NOSUPERUSER NOBYPASSRLS.
-- The database owner/migrator is never the runtime role. Not a production deployment.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='c73_app') THEN
   RAISE EXCEPTION 'c73_app runtime role must be pre-provisioned';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='c73_app' AND (rolsuper OR rolbypassrls)) THEN
   RAISE EXCEPTION 'c73_app must not be privileged';
 END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS c73;
REVOKE ALL ON SCHEMA c73 FROM PUBLIC;
GRANT USAGE ON SCHEMA c73 TO c73_app;
CREATE TABLE IF NOT EXISTS c73.custody_heads(
 tenant_id text NOT NULL,
 document_id text NOT NULL,
 revision integer NOT NULL CHECK(revision BETWEEN 1 AND 1000),
 head_tag text NOT NULL CHECK(head_tag ~ '^[a-f0-9]{64}$'),
 ledger jsonb NOT NULL CHECK(jsonb_typeof(ledger)='object'),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id, document_id)
);
CREATE TABLE IF NOT EXISTS c73.custody_events(
 tenant_id text NOT NULL,
 document_id text NOT NULL,
 revision integer NOT NULL CHECK(revision BETWEEN 1 AND 1000),
 event_tag text NOT NULL CHECK(event_tag ~ '^[a-f0-9]{64}$'),
 event_json jsonb NOT NULL CHECK(jsonb_typeof(event_json)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id, document_id, revision),
 FOREIGN KEY(tenant_id, document_id)
   REFERENCES c73.custody_heads(tenant_id, document_id) ON DELETE RESTRICT
);
ALTER TABLE c73.custody_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE c73.custody_heads FORCE ROW LEVEL SECURITY;
ALTER TABLE c73.custody_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE c73.custody_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS custody_heads_tenant ON c73.custody_heads;
CREATE POLICY custody_heads_tenant ON c73.custody_heads TO c73_app
 USING (tenant_id = nullif(current_setting('app.tenant_id',true),''))
 WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),''));
DROP POLICY IF EXISTS custody_events_tenant ON c73.custody_events;
CREATE POLICY custody_events_tenant ON c73.custody_events TO c73_app
 USING (tenant_id = nullif(current_setting('app.tenant_id',true),''))
 WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),''));
REVOKE ALL ON c73.custody_heads,c73.custody_events FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE ON c73.custody_heads TO c73_app;
GRANT SELECT,INSERT ON c73.custody_events TO c73_app;
REVOKE DELETE ON c73.custody_heads FROM c73_app;
REVOKE UPDATE,DELETE ON c73.custody_events FROM c73_app;
COMMIT;
-- RLS settings are transaction-local. The application must use a trusted server
-- verifier; arbitrary user SQL and runtime DDL are explicitly forbidden.
-- Privileged administrators and full database restore can alter/rollback ledger state.
-- Independent external/WORM anchoring remains a separate production requirement.
