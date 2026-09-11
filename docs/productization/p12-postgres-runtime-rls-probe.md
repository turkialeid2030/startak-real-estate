# P12 — PostgreSQL Runtime RLS Probe

## Purpose

P12 adds an executable, server-side RLS isolation probe for the canonical workspace table. Unlike the earlier deterministic evidence evaluator, this module can connect through the injected PostgreSQL **runtime pool** and perform narrow same-tenant, cross-tenant, missing-context, and tenant-context-reset checks against a real target database.

It does not execute migrations and it does not certify production security.

## Probe scope

`runPostgresRuntimeRlsProbe(...)` verifies:

- the connected runtime role matches an explicitly expected role;
- the runtime role is not a PostgreSQL superuser;
- the runtime role does not have `BYPASSRLS`;
- the canonical workspace table has both RLS enabled and FORCE RLS enabled;
- same-tenant insert/select/update/delete work through the runtime role;
- cross-tenant select/update/delete cannot access the probe row;
- cross-tenant insert is rejected with the PostgreSQL RLS permission error class;
- missing tenant context cannot read the probe row or insert into another tenant scope;
- the transaction-local tenant setting resets between pool transactions;
- temporary probe rows are cleaned up.

The probe derives unique tenant/workspace identifiers from an explicit bounded `probeRunId` and emits a SHA-256 evidence digest over the allowlisted probe result.

## Mutating behavior

The probe is intentionally **mutating**. It creates temporary rows in the canonical workspace table and then deletes them. It therefore must only be run against an explicitly selected environment/database by an accountable operator. The module itself does not choose a database, discover credentials, or initiate a deployment.

If runtime-role privilege or FORCE RLS checks fail, the probe returns a HOLD before any mutation.

## Evidence boundary

A `PASS_NOT_PRODUCTION_CERTIFIED` result is direct runtime evidence for the narrow checks executed by this probe. It is still not sufficient by itself to establish production security because it does not independently verify:

- owner/admin/privileged database paths;
- API-layer IDOR/BOLA behavior;
- production IdP registration and session/MFA controls;
- migration provenance and change approval;
- database encryption/KMS controls;
- durable audit persistence;
- backup/restore and disaster recovery;
- monitoring/alerting/SLOs;
- penetration testing;
- PDPL/legal/professional qualification;
- human release/deployment/go-live approval.

Authority remains false for release, merge, deployment, go-live, transactions, production persistence, and production security.
