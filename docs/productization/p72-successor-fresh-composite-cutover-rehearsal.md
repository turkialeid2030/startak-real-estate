# P72 — Successor Fresh Composite Cutover Rehearsal

## Purpose

P72 deterministically rehearses the successor-cycle cutover sequence without mutating any real registry, release gate, deployment or runtime state.

The modeled sequence is:

`LEGACY_FILE_SHA256 -> schema-v4 GOVERNED_COMPOSITE_BASELINE -> exact starting LEGACY_FILE_SHA256`

P72 consumes the P71 successor fresh shadow result and requires the actual current registry object plus the exact raw registry bytes. The rehearsal proves modeled rollback to both the starting logical registry hash and the starting raw-content SHA-256.

## Required evidence

A successful rehearsal requires:

- current registry still verified as `LEGACY_FILE_SHA256`;
- current raw registry bytes parse to the supplied current registry object;
- exact current raw-content SHA-256 matches the P71 shadow binding;
- valid P71 status `SUCCESSOR_FRESH_SHADOW_COMPOSITE_MATCH_NOT_ACTIVE`;
- deterministic P71 shadow hash recomputation;
- P71 authority-false and no-mutation boundary;
- schema-v4 candidate logical/content hashes and successor P64–P71 lineage still intact.

## Success state

`SUCCESSOR_FRESH_CUTOVER_REHEARSAL_COMPLETED_NO_ACTIVATION`

Success records three deterministic states:

1. exact authoritative legacy starting state;
2. simulated schema-v4 governed-composite cutover state sourced from P71;
3. simulated rollback to the exact starting legacy logical and raw-content hashes.

The output requires both:

- `rollbackRestoresExactAuthoritativeRegistry=true`;
- `rollbackRestoresExactAuthoritativeRegistryContent=true`.

## Authority boundary

Even after a successful rehearsal:

- `simulationOnly=true`;
- `actualRegistryMutationPerformed=false`;
- `actualReleaseGateModeChanged=false`;
- `actualDeploymentMutationPerformed=false`;
- `activationAuthorized=false`;
- `activationApplied=false`;
- `reactivationAuthorized=false`;
- `currentBaselineMutationPerformed=false`;
- all release/merge/deployment/go-live/transaction authority flags remain false.

A successor fresh cutover safety guard, successor owner activation authorization, successor activation change contract and successor active-mode verifier remain mandatory.

## Operator

`tools/successor-fresh-composite-cutover-rehearsal.js` is read-only with respect to the canonical registry. It consumes bounded regular files, rejects symlinks and private/secret-key style arguments, and may only emit a restrictive-permission JSON rehearsal record.

## Evidence limitation

P72 proves deterministic modeled transition/rollback behavior only. It is not an operational cutover, production failover, deployment, merge, go-live or owner authorization.
