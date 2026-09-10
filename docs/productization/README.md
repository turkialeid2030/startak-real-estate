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

## P21 — Canonical Source Evidence Hardening

- [`p21-canonical-source-evidence-hardening.md`](./p21-canonical-source-evidence-hardening.md) — corrects the canonical release verifier so missing external source evidence is reported as `NOT_EVALUATED`, adds strict fail-closed mode for authorized external-evidence runs, and reserves `PASS` for an actual matching SHA-256 comparison.

## P22 — Canonical Source E2I Signing Package

- [`p22-canonical-e2i-signing-package.md`](./p22-canonical-e2i-signing-package.md) — converts an already verified pinned canonical-source comparison into the exact unsigned `CANONICAL_SOURCE_HASH_COMPARISON` E2I signing payload, with deterministic signing bytes and compatibility tests against the existing E2I RSA signature verifier while keeping the external signer and trust root out of the repository.

## P23 — External Canonical Evidence Operator

- [`p23-external-canonical-evidence-operator.md`](./p23-external-canonical-evidence-operator.md) — operationalizes the strict P21 comparison and P22 unsigned E2I package into one fail-closed operator command for the real externally controlled source bytes, rejecting unknown/secret context fields and never accepting a private signing key or granting authority.

## P24 — Governed Canonical Baseline Reconstitution

- [`p24-canonical-baseline-reconstitution.md`](./p24-canonical-baseline-reconstitution.md) — records the historical canonical original as unavailable and prepares a deterministic human-governance proposal to supersede the legacy file-hash baseline with an exact qualified Git commit plus release-artifact and environment-config digests; it does not switch the baseline or satisfy E2I automatically.

## P25 — Canonical Re-baseline Governance Decision

- [`p25-canonical-rebaseline-governance-decision.md`](./p25-canonical-rebaseline-governance-decision.md) — records owner direction and requires a distinct independent review before the P24 proposal can become eligible for a separate explicit baseline-activation code change; no automatic baseline switch or release authority is granted.

## P26 — Canonical Re-baseline Independent Review Handoff

- [`p26-canonical-rebaseline-independent-review.md`](./p26-canonical-rebaseline-independent-review.md) — produces a deterministic review packet only from a valid P25 `WAITING_FOR_INDEPENDENT_REVIEW` state, normalizes a distinct reviewer response for P25 re-evaluation, and explicitly does not treat CI or automation as human review.

## P27 — Canonical Re-baseline Review Attestation

- [`p27-canonical-rebaseline-review-attestation.md`](./p27-canonical-rebaseline-review-attestation.md) — verifies RSA-SHA256 reviewer-decision attestations against an out-of-band pinned reviewer registry and binds the decision to the exact P26 packet, while leaving external review-artifact substance and all release authority outside the automated trust boundary.

## P28 — Owner-Controlled Reviewer Designation

- [`p28-owner-controlled-reviewer-designation.md`](./p28-owner-controlled-reviewer-designation.md) — gives the proposal owner the narrow governance capability to designate or replace the independent-review workflow assignee before an accepted review; the current mutable designation is `سعيد المراجع` (`reviewer:saeed-pending`), pending final identity/trust binding.

## P29 — Reviewer Designation Ledger and Owner Operator

- [`p29-reviewer-designation-ledger.md`](./p29-reviewer-designation-ledger.md) — adds an append-only reviewer-designation history, strict replacement-chain validation and an owner operator for preparing future reviewer replacements without weakening the P27 independent-review trust boundary.

## P30 — Reviewer Lifecycle Lock

- [`p30-reviewer-lifecycle-lock.md`](./p30-reviewer-lifecycle-lock.md) — keeps reviewer replacement mutable while review is pending, then freezes replacement only when a P27 cryptographically verified response is bound to the exact P26 packet and current P29 designation; stale-review carryover fails closed.

## P31 — Canonical Re-baseline Activation Plan

- [`p31-canonical-rebaseline-activation-plan.md`](./p31-canonical-rebaseline-activation-plan.md) — prepares a deterministic successor-baseline manifest and explicit activation-change contract only after P25 dual approval and a P30 cryptographically bound reviewer lifecycle lock; it does not apply the baseline switch or grant release authority.

## P32 — Canonical Baseline Registry Contract

- [`p32-canonical-baseline-registry-contract.md`](./p32-canonical-baseline-registry-contract.md) — explicitly records the unchanged legacy baseline and provides a fail-closed contract for producing only a non-active governed-composite candidate from a valid P31 activation plan.

## P33 — Canonical Baseline Registry Release Gate

- [`p33-canonical-baseline-registry-release-gate.md`](./p33-canonical-baseline-registry-release-gate.md) — makes the P32 current baseline registry a mandatory Release Verify gate so silent mode drift, legacy-hash drift, fabricated evidence state or authority escalation fails CI before canonical-source verification.

## P34 — Governed Composite Baseline Evidence Verifier

- [`p34-governed-composite-baseline-evidence-verifier.md`](./p34-governed-composite-baseline-evidence-verifier.md) — verifies a future governed-composite candidate against exact commit, release-artifact bytes and environment-config bytes while the active baseline remains legacy; verification is candidate-only and cannot activate the baseline or grant release authority.

## P35 — Governed Composite Baseline Evidence Operator

- [`p35-governed-composite-baseline-evidence-operator.md`](./p35-governed-composite-baseline-evidence-operator.md) — provides a fail-closed CLI for supplying the P32 candidate, exact commit, release-artifact bytes and environment-config bytes to P34, emitting only hashed candidate evidence and never activating the baseline.

## P36 — Composite Baseline Shadow Release Gate

- [`p36-composite-baseline-shadow-release-gate.md`](./p36-composite-baseline-shadow-release-gate.md) — compares a P32 governed-composite candidate and P34 evidence beside the still-authoritative legacy baseline, reports absent external shadow inputs as `NOT_EVALUATED`, supports strict fail-closed shadow runs, and cannot activate the composite baseline or grant release authority.

## P37 — Composite Baseline Cutover Rehearsal

- [`p37-composite-baseline-cutover-rehearsal.md`](./p37-composite-baseline-cutover-rehearsal.md) — deterministically rehearses `LEGACY_FILE_SHA256 -> GOVERNED_COMPOSITE_BASELINE -> LEGACY_FILE_SHA256` from a valid P36 shadow match, proves modeled rollback to the exact starting registry hash, and performs no active-registry, release-mode or deployment mutation.

## P38 — Composite Baseline Cutover Safety Guard

- [`p38-composite-baseline-cutover-safety-guard.md`](./p38-composite-baseline-cutover-safety-guard.md) — fail-closed safety prerequisite that binds a cryptographically locked P30 reviewer, P31 activation plan, P36 shadow match and P37 exact rollback rehearsal to the same still-authoritative legacy registry; it cannot authorize or apply cutover.

Authority remains fail-closed until the existing release-governance process explicitly changes it.
