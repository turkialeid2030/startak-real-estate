-- Controlled migration for encrypted envelopes; operator approval required.
CREATE TABLE IF NOT EXISTS public.startak_private_evidence_envelopes (
 tenant_id text NOT NULL, case_ref text NOT NULL, evidence_ref text NOT NULL,
 envelope text NOT NULL CHECK(octet_length(envelope) BETWEEN 1 AND 36700160),
 PRIMARY KEY(tenant_id,evidence_ref),
 CHECK (tenant_id ~ '^[A-Za-z0-9_.:-]{2,128}$' AND case_ref ~ '^[A-Za-z0-9_.:-]{2,128}$' AND evidence_ref ~ '^[A-Za-z0-9_.:-]{2,128}$')
);
ALTER TABLE public.startak_private_evidence_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.startak_private_evidence_envelopes FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.startak_private_evidence_envelopes FROM PUBLIC;
DROP POLICY IF EXISTS startak_envelope_scope ON public.startak_private_evidence_envelopes;
CREATE POLICY startak_envelope_scope ON public.startak_private_evidence_envelopes
 USING (tenant_id=nullif(current_setting('startak.tenant_id',true),'') AND case_ref=nullif(current_setting('startak.case_ref',true),''))
 WITH CHECK (tenant_id=nullif(current_setting('startak.tenant_id',true),'') AND case_ref=nullif(current_setting('startak.case_ref',true),''));
-- Approved backend role receives SELECT, INSERT only; no UPDATE/DELETE/TRUNCATE.
