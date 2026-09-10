# P38 — Composite Baseline Cutover Safety Guard

P38 adds a fail-closed safety prerequisite for any future explicit activation of `GOVERNED_COMPOSITE_BASELINE`.

It does **not** activate the baseline and does not grant release, merge, deployment, go-live, professional, legal or transaction authority.

## Required evidence chain

A satisfied P38 guard requires all of the following to be mutually consistent and bound to the same still-authoritative legacy registry:

1. P30 reviewer lifecycle state `REVIEWER_LOCKED_BY_VERIFIED_REVIEW`, including cryptographic reviewer identity / registry / signature guarantees and a valid reviewer-lock hash.
2. P31 activation plan `READY_FOR_EXPLICIT_BASELINE_ACTIVATION_CHANGE_PLAN`, including a valid activation-plan hash, valid successor manifest and a reviewer-lock binding equal to the P30 lock.
3. P36 shadow result `SHADOW_COMPOSITE_BASELINE_MATCH_NOT_ACTIVE`, bound to the same current registry, activation-plan hash and successor-manifest hash.
4. P37 rehearsal result `CUTOVER_REHEARSAL_COMPLETED_NO_ACTIVATION`, bound to the P36 shadow result and proving the modeled rollback returns to the exact starting registry SHA-256.

The current registry must still verify as `LEGACY_FILE_SHA256` throughout evaluation.

## Highest state

`CUTOVER_SAFETY_GUARD_SATISFIED_NOT_ACTIVATED`

This means only that the safety prerequisites are internally consistent. It does not create activation authority.

The output explicitly keeps:

- `activationAuthorizationGranted=false`
- `activationApplied=false`
- `canonicalBaselineChanged=false`
- `releaseAuthorized=false`
- `mergeAuthorized=false`
- `deploymentAuthorized=false`
- `goLiveAuthorized=false`
- `transactionAuthorized=false`

## Release Verify integration

`tools/release-verify.js` now includes `COMPOSITE_BASELINE_CUTOVER_SAFETY_GUARD`.

Ordinary engineering CI does not fabricate real P30/P31/P36/P37 evidence and therefore reports the step as `NOT_EVALUATED` when no external evidence paths are supplied.

A controlled evidence run can set:

- `REQUIRE_COMPOSITE_CUTOVER_SAFETY=1`
- `COMPOSITE_CUTOVER_REVIEWER_LIFECYCLE_PATH`
- `COMPOSITE_CUTOVER_ACTIVATION_PLAN_PATH`
- `COMPOSITE_CUTOVER_SHADOW_PATH`
- `COMPOSITE_CUTOVER_REHEARSAL_PATH`

If strict mode is requested and the evidence set is missing, partial, malformed, symlinked, inconsistent or fails the P38 guard, Release Verify fails closed.

Input paths and raw evidence file contents are not serialized in the normalized gate result.

## Governance boundary

The current workflow designation `سعيد المراجع` remains mutable while independent review is pending. P38 can only pass after a real P30 reviewer lock exists; test fixtures are engineering coverage only and are not human review evidence.

Even after a future P38 pass, an explicit reviewed registry code change and post-change Release Verify remain required. No automatic cutover is implemented here.
