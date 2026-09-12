# P53 — Fresh Composite Shadow Release Gate

P53 compares the P51 schema-v3 fresh governed-composite registry candidate and the P52 exact-byte evidence beside the still-authoritative legacy canonical registry. It is a shadow-only release-verification gate and does not activate or mutate the canonical baseline.

## Required state

P53 accepts only:

- a valid P51 `FRESH_COMPOSITE_REGISTRY_CANDIDATE_READY_NOT_ACTIVE` record;
- a valid P52 `FRESH_COMPOSITE_EVIDENCE_MATCH_NOT_ACTIVE` record;
- the current repository canonical registry still verifying as `LEGACY_FILE_SHA256`.

The evaluator independently re-hashes the P52 evidence core, revalidates the complete P51 candidate record and requires the P51/P52/current-registry chain to agree on the fresh governance-cycle hash, P49 reviewer lifecycle lock, P50 activation plan, candidate logical/content hashes, source commit, release-artifact SHA-256 and environment-config SHA-256.

## Highest state

`FRESH_SHADOW_COMPOSITE_MATCH_NOT_ACTIVE`

This means the fresh candidate and supplied evidence are mutually consistent in shadow mode only. The active registry remains legacy.

## Release Verify integration

`tools/fresh-composite-shadow-release-gate.js` exposes a provider-neutral environment gate:

- `FRESH_COMPOSITE_SHADOW_CANDIDATE_PATH`
- `FRESH_COMPOSITE_SHADOW_EVIDENCE_PATH`
- `REQUIRE_FRESH_COMPOSITE_SHADOW=1`

If no fresh-shadow inputs are supplied, the canonical release verifier reports `NOT_EVALUATED`. Supplying only one input fails closed with `HOLD`. When strict mode is enabled, missing inputs fail closed with `MISSING_REQUIRED`.

The operator accepts bounded regular JSON files, rejects symlinks, rejects unknown/duplicate/private-key CLI arguments and can write restrictive `0600` JSON output. It does not accept credentials or mutate the canonical registry.

## Evidence boundary

P53 verifies consistency of the supplied P51/P52 metadata and hashes. It does not independently establish production suitability, independent human approval, legal/professional approval, deployment readiness or transaction authority.

## Authority boundary

P53 always keeps:

- `activationAuthorized=false`;
- `activationApplied=false`;
- `reactivationAuthorized=false`;
- `currentBaselineMutationPerformed=false`;
- `releaseStillBlocked=true`;
- all release/merge/deployment/go-live/transaction authority flags false.

A successful P53 shadow match still requires a fresh cutover rehearsal, fresh cutover-safety evidence, fresh human-owner activation authorization, a new explicit activation-change contract and post-activation Release Verify before any later governance layer can consider further progression.
