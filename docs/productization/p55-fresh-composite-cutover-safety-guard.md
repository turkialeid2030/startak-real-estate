# P55 — Fresh Composite Cutover Safety Guard

P55 composes the fresh post-incident governance evidence chain into a fail-closed cutover-safety prerequisite while the authoritative canonical registry remains `LEGACY_FILE_SHA256`.

## Required evidence chain

P55 requires all of the following to be mutually consistent:

- P49 `FRESH_REACTIVATION_REVIEWER_LOCKED_BY_VERIFIED_REVIEW`;
- P50 `FRESH_REACTIVATION_ACTIVATION_PLAN_READY_NOT_AUTHORIZED`;
- P53 `FRESH_SHADOW_COMPOSITE_MATCH_NOT_ACTIVE`;
- P54 `FRESH_CUTOVER_REHEARSAL_COMPLETED_NO_ACTIVATION`;
- the current repository canonical registry still verifying as the exact legacy registry.

The guard independently re-hashes the P49 reviewer lock and P54 rehearsal, invokes the P50 activation-plan validator and P53 shadow validator, and verifies that cycle, registry, reviewer-lock, activation-plan, candidate and rehearsal bindings all agree.

## Highest state

`FRESH_CUTOVER_SAFETY_GUARD_SATISFIED_NOT_AUTHORIZED`

This state means the fresh reviewer/plan/shadow/rehearsal evidence is internally bound and the exact modeled rollback identity is established. It is not owner authorization and it is not activation authority.

## Operator

`tools/fresh-composite-cutover-safety-guard.js` accepts bounded regular JSON records for the reviewer lock, activation plan, shadow result and rehearsal result. It rejects symlinks, unknown/duplicate/private-key arguments, writes restrictive output when requested and performs no mutation.

## Authority boundary

P55 always keeps:

- `activationAuthorized=false`;
- `activationApplied=false`;
- `reactivationAuthorized=false`;
- `currentBaselineMutationPerformed=false`;
- `releaseStillBlocked=true`;
- all release/merge/deployment/go-live/transaction authority flags false.

A separate fresh human-owner activation authorization remains required, followed by a fresh explicit activation-change contract, controlled executor and post-change Release Verify. P55 itself cannot activate or mutate the canonical baseline.
