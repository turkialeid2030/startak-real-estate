-- Controlled migration: do not apply to production without approved change control.
-- Use a separate non-owner, NOSUPERUSER NOBYPASSRLS runtime role.
CREATE TABLE IF NOT EXISTS public.startak_evidence_custody (
 tenant_id text NOT NULL, case_ref text NOT NULL, evidence_ref text NOT NULL,
 content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
 revision integer NOT NULL CHECK (revision BETWEEN 1 AND 1000),
 head_sha256 text NOT NULL CHECK (head_sha256 ~ '^[a-f0-9]{64}$'),
 ledger jsonb NOT NULL CHECK (jsonb_typeof(ledger)='object'),
 PRIMARY KEY (tenant_id, case_ref, evidence_ref)
);
ALTER TABLE public.startak_evidence_custody ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.startak_evidence_custody FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.startak_evidence_custody FROM PUBLIC;
DROP POLICY IF EXISTS startak_custody_scope ON public.startak_evidence_custody;
CREATE POLICY startak_custody_scope ON public.startak_evidence_custody
 USING (tenant_id=nullif(current_setting('startak.tenant_id',true),'') AND case_ref=nullif(current_setting('startak.case_ref',true),''))
 WITH CHECK (tenant_id=nullif(current_setting('startak.tenant_id',true),'') AND case_ref=nullif(current_setting('startak.case_ref',true),''));
-- Explicit operator GRANT SELECT, INSERT, UPDATE only to approved runtime role.
-- No DELETE, no owner privileges, no witness writes via this database role.
