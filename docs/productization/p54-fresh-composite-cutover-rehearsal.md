# P54 — Fresh Composite Cutover Rehearsal

P54 deterministically rehearses the fresh post-incident canonical-baseline transition using only a verified P53 fresh shadow result. It simulates:

`LEGACY_FILE_SHA256 -> GOVERNED_COMPOSITE_BASELINE -> LEGACY_FILE_SHA256`

No repository, deployment or release-gate state is changed.

## Required state

P54 accepts only P53:

`FRESH_SHADOW_COMPOSITE_MATCH_NOT_ACTIVE`

The P53 shadow record is independently re-hashed and must remain bound to the exact current legacy registry, fresh governance-cycle hash, P49 reviewer lifecycle lock, P50 activation plan, P51 candidate, P52 evidence and candidate logical/content hashes.

## Highest state

`FRESH_CUTOVER_REHEARSAL_COMPLETED_NO_ACTIVATION`

A successful result proves only that the modeled cutover can be followed by a modeled rollback to the exact starting legacy registry hash.

## Transition model

The deterministic record contains three ordered states:

1. current authoritative `LEGACY_FILE_SHA256` state;
2. simulated, non-authoritative `GOVERNED_COMPOSITE_BASELINE` state sourced from the P53 candidate/evidence chain;
3. simulated rollback to the exact initial legacy registry hash.

The complete transition record is SHA-256 hashed as `freshCutoverRehearsalHashSha256`.

## Operator boundary

`tools/fresh-composite-cutover-rehearsal.js` reads a bounded regular P53 shadow JSON file, rejects symlinks, unknown/duplicate/private-key arguments and writes restrictive output when requested. It performs no registry write or deployment action.

## Authority boundary

P54 always keeps:

- `actualRegistryMutationPerformed=false`;
- `actualReleaseGateModeChanged=false`;
- `actualDeploymentMutationPerformed=false`;
- `activationAuthorized=false`;
- `activationApplied=false`;
- `reactivationAuthorized=false`;
- `currentBaselineMutationPerformed=false`;
- `releaseStillBlocked=true`;
- all release/merge/deployment/go-live/transaction authority flags false.

Fresh cutover-safety evidence, fresh human-owner activation authorization, a fresh explicit activation-change contract, controlled execution and post-change Release Verify remain separate later requirements.
