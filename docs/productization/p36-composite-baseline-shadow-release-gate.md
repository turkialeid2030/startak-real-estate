# P36 — Composite Baseline Shadow Release Gate

## Purpose

P36 prepares a shadow comparison path for the future `GOVERNED_COMPOSITE_BASELINE` while the repository's active and authoritative baseline remains `LEGACY_FILE_SHA256`.

It consumes a P32 governed-composite candidate plus P34 candidate-only evidence and verifies that both remain bound to the exact current legacy registry, activation-plan hash, successor-manifest hash, qualified Git commit, release-artifact SHA-256 and environment-config SHA-256.

## Release Verify behavior

`tools/release-verify.js` now includes:

`COMPOSITE_BASELINE_SHADOW_VERIFICATION`

Normal engineering CI does not fabricate the future reviewer-approved candidate/evidence, so when both shadow input paths are absent the step reports `NOT_EVALUATED` and engineering verification may continue.

An authorized evidence run can set:

- `COMPOSITE_BASELINE_SHADOW_CANDIDATE_PATH`
- `COMPOSITE_BASELINE_SHADOW_EVIDENCE_PATH`
- `REQUIRE_COMPOSITE_BASELINE_SHADOW=1`

If strict shadow mode is requested and required inputs are absent, malformed, partial, symlinked or inconsistent, Release Verify fails closed.

## Shadow pass semantics

The highest P36 evaluation state is:

`SHADOW_COMPOSITE_BASELINE_MATCH_NOT_ACTIVE`

A shadow pass proves only that the supplied P32 candidate and P34 evidence are internally consistent with the still-authoritative legacy registry. It does not activate the candidate.

The P36 output keeps:

- `authoritativeMode=LEGACY_FILE_SHA256`
- `shadowMode=GOVERNED_COMPOSITE_BASELINE`
- `activationApplied=false`
- `canonicalBaselineChanged=false`
- `legacyCanonicalEvidenceClosed=false`
- `existingE2iCanonicalEvidenceSatisfied=false`
- all release/merge/deployment/go-live/transaction authority false.

## Fail-closed conditions

P36 holds on current-registry drift, malformed or tampered P32 candidate data, successor-manifest mismatch, candidate hash mismatch, P34 evidence hash mismatch, mismatched current-registry/candidate/activation-plan/manifest bindings, exact-commit mismatch, release-artifact digest mismatch, environment-config digest mismatch or any authority escalation.

The shadow operator limits JSON input sizes, rejects symlinked input files and never serializes input paths, raw release-artifact bytes, environment-config content, credentials or private signing keys.

## Governance boundary

P36 does not bypass P27 independent-review attestation, P30 reviewer lock or P31 activation-plan requirements. `سعيد المراجع` remains only the current mutable reviewer designation and may be replaced by the owner before an accepted independent review.

A future activation of `GOVERNED_COMPOSITE_BASELINE` still requires real independent-review evidence, the explicit reviewed activation code change described by P31/P32/P33, and a successful post-activation Release Verify.
