# Productization Evidence Notes

These notes describe incremental productization slices and their explicit evidence boundaries. They do not confer release, merge, deployment, go-live, legal, professional, or transaction authority.

## P8 — Admin / Operations Runtime

- [`p8-admin-operations-runtime.md`](./p8-admin-operations-runtime.md) — authenticated ADMIN-only read-only operational inspection contract and non-claims.
- [`p8-admin-operations-checklist.md`](./p8-admin-operations-checklist.md) — external production qualification evidence still required.

## P9 — Production Qualification Evidence Gate

- [`p9-production-qualification-gate.md`](./p9-production-qualification-gate.md) — deterministic composition of existing readiness, independent release qualification, and institutional go-live review outputs.
- [`p9-external-evidence-checklist.md`](./p9-external-evidence-checklist.md) — external production, legal, professional, security, resilience, and human-approval evidence that P9 does not establish.

## P10 — Server HTTP API Boundary

- [`p10-server-http-api-boundary.md`](./p10-server-http-api-boundary.md) — narrow authenticated Node HTTP interface for canonical workspace load/save, with bounded JSON input, exact-origin CORS, sanitized errors, security headers, and fail-closed authority semantics.

## P11 — Server Runtime Composition

- [`p11-server-runtime-composition.md`](./p11-server-runtime-composition.md) — controlled server-side composition of HTTP, OIDC/JWKS authentication, verified tenant/RBAC workspace runtime, and PostgreSQL-compatible persistence with narrow external dependency reachability probes.

## P12 — PostgreSQL Runtime RLS Probe

- [`p12-postgres-runtime-rls-probe.md`](./p12-postgres-runtime-rls-probe.md) — executable staging/runtime probe for PostgreSQL runtime-role privilege, FORCE RLS, same-tenant CRUD, cross-tenant denial, missing tenant context, pool context reset, cleanup, and evidence hashing.

## P13 — Controlled PostgreSQL Migration Runner

- [`p13-controlled-postgres-migration-runner.md`](./p13-controlled-postgres-migration-runner.md) — dry-run-by-default, target-bound migration execution boundary limited to staging/preproduction, with preflight database/role identity matching and FORCE-RLS post-check.

## P14 — Controlled Staging PostgreSQL Qualification

- [`p14-controlled-staging-postgres-qualification.md`](./p14-controlled-staging-postgres-qualification.md) — composes controlled migration, live runtime RLS probing and the deterministic runtime-RLS evaluator; privileged-path evidence remains separately required and production certification remains explicitly false.

## P15 — Controlled Staging API Security Qualification

- [`p15-controlled-staging-api-security-qualification.md`](./p15-controlled-staging-api-security-qualification.md) — read-only API object-isolation/IDOR-BOLA qualification plus an authenticated ADMIN-only application inspection path, bound to completed P14 staging evidence and explicitly not a database-owner or production-security certification.

## P16 — Controlled Backup / Restore Qualification

- [`p16-controlled-backup-restore-qualification.md`](./p16-controlled-backup-restore-qualification.md) — staging-only, dry-run-by-default backup/isolated-restore/verification orchestration through host-injected adapters, producing caller-objective-bound `BACKUP_RESTORE` resilience evidence without embedding credentials or infrastructure commands.

## P17 — Controlled DR Failover Qualification

- [`p17-controlled-dr-failover-qualification.md`](./p17-controlled-dr-failover-qualification.md) — staging-only, dry-run-by-default primary/standby failover and failback drill orchestration, producing caller-objective-bound `DATABASE_UNAVAILABLE` resilience evidence while keeping provider-specific mutation and credentials host-injected.

## P18 — Controlled Observability and Incident Qualification

- [`p18-controlled-observability-incident-qualification.md`](./p18-controlled-observability-incident-qualification.md) — staging-only, dry-run-by-default metrics freshness/signal coverage, synthetic alert delivery, incident acknowledgement and runbook-readiness qualification using host-injected adapters and hashed operational references.

## P19 — Independent Security / UAT Evidence Gate

- [`p19-independent-security-uat-evidence-gate.md`](./p19-independent-security-uat-evidence-gate.md) — exact-commit staging gate for supplied independent penetration-test and UAT evidence, blocking open Critical/High findings, requiring retest of remediated Critical/High findings, enforcing UAT scenario completion and independent review separation, and hashing external references without granting release authority.

## P20 — Release Candidate Evidence Bundle

- [`p20-release-candidate-evidence-bundle.md`](./p20-release-candidate-evidence-bundle.md) — deterministic handoff manifest that composes the existing P9 production-qualification result with exact-commit P19 security/UAT evidence, requires a complete explicit register of unresolved external blockers and separate review governance, and can only make the package eligible for the existing human release-governance review.

Authority remains fail-closed until the existing release-governance process explicitly changes it.
