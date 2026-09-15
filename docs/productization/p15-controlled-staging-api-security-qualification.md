# P15 — Controlled Staging API Security Qualification

P15 adds a controlled staging/preproduction application-security qualification boundary above P14. It is deliberately non-production and does not authorize release, merge, deployment, go-live, or transactions.

## Scope

The qualification requires an already-complete P14 PostgreSQL staging evidence result bound to the same environment and logical database reference. It then performs a read-only API object-isolation sequence against the canonical workspace endpoint and a separate ADMIN-only application inspection path.

The API checks are:

- tenant A can read the expected workspace;
- tenant B cannot read the same object reference and receives no `data` payload;
- an unauthenticated request is denied;
- the result surface records only allowlisted status/check data and never bearer tokens.

The privileged application-path checks are:

- an authenticated ADMIN can invoke the existing read-only operations inspection path;
- the returned scope matches the requested workspace;
- a non-ADMIN principal is denied;
- the path remains read-only and secret-free.

## Evidence semantics

A passing result is reported only as:

`STAGING_API_SECURITY_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED`

The output includes SHA-256 evidence references for the API IDOR/BOLA checks, the ADMIN application-path checks, and the composed bundle.

## Important boundary

P15 does **not** claim that the database owner/superuser/BYPASSRLS path was tested by the ADMIN application-path probe. The output explicitly keeps `databaseOwnerOrBypassRlsPathTestedHere=false`. Database privileged-path evidence, penetration testing, destructive authorization testing, production IdP/TLS/DNS/secrets, backup/restore, disaster recovery, monitoring/SLO validation, PDPL/legal/professional approval, and human release authority remain external.

P15 is suitable for controlled staging evidence collection only. Production remains rejected by configuration.
