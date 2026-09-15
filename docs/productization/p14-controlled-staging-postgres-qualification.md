# P14 — Controlled Staging PostgreSQL Qualification

P14 composes the P13 controlled migration runner, the P12 PostgreSQL runtime RLS isolation probe, and the existing deterministic runtime-RLS evidence evaluator into one staging/preproduction qualification workflow.

## Execution model

Dry-run mode prepares the P13 migration plan only. It does not touch the runtime pool and does not execute the RLS probe.

Execution mode requires P13 to reach `APPLIED_NOT_PRODUCTION_CERTIFIED` before P12 can run. If migration is held, the qualification stops. If the runtime RLS probe does not reach `PASS_NOT_PRODUCTION_CERTIFIED`, the qualification stops with `HOLD_RUNTIME_RLS`.

If the narrow RLS probe passes, the existing runtime-RLS evaluator is fed the observed runtime-role, FORCE-RLS, same-tenant CRUD, cross-tenant denial, missing-context denial, and transaction-local context-reset checks.

## Privileged-path evidence

P12 deliberately does not exercise an owner/admin/privileged database path. P14 therefore remains at `HOLD_PRIVILEGED_PATH_EVIDENCE` unless a separately produced evidence record is supplied and target-bound to the same environment, database reference, and runtime role.

P14 only checks that the supplied privileged-path evidence is complete and target-bound. It does not verify the authenticity or independence of the external evidence producer. Even when the deterministic evaluator reports `VERIFICATION_EVIDENCE_COMPLETE`, P14 reports only `STAGING_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED`.

## Evidence bundle

The output contains allowlisted references only:

- P13 migration plan SHA-256 reference;
- P12 runtime RLS probe evidence reference;
- accepted privileged-path evidence reference, when supplied;
- deterministic runtime-RLS verification status;
- a SHA-256 hash over the composed evidence bundle.

No credentials, connection strings, database exception details, bearer tokens, secrets, or raw SQL are added by P14.

## Evidence boundary

P14 does not create a staging database, register a real IdP, manage TLS/DNS/secrets, prove backup/restore or DR, run API-layer IDOR/BOLA tests, perform penetration testing, validate monitoring/SLOs, establish PDPL/legal/professional approval, or authorize release, merge, deployment, go-live, or transactions.

All production authority flags remain false.
