# P59 — Fresh Canonical Registry Release Gate

P59 integrates the P58 fresh schema-v3 canonical-registry verifier into the provider-neutral Release Verify path without changing the repository's active canonical baseline.

`tools/release-verify.js` already invokes `tools/canonical-baseline-registry-gate.js`; P59 extends that gate so it can fail closed across the legacy baseline, historical schema-v2 governed-composite evidence, and the new fresh schema-v3 governance cycle.

## Mode routing

### Legacy schema-v1

`LEGACY_FILE_SHA256` continues to use strict semantic legacy verification and is routed through P58 without changing the pre-P59 acceptance contract for equivalent JSON serialization. This preserves existing release-gate compatibility while continuing to enforce the pinned legacy hash, exact legacy object shape and false authority flags.

Exact raw canonical-file byte binding is intentionally **not** introduced retroactively for schema-v1 legacy mode. That stronger byte-level requirement applies to the fresh schema-v3 path because P57 explicitly binds the future active registry content hash.

No fresh activation evidence is required in legacy mode.

Verification mode:

`LEGACY_STRICT`

### Historical governed-composite schema-v2

The existing P39/P40 activation-evidence path is preserved for compatibility. Its existing environment variables remain unchanged and are not reused for the fresh cycle.

Verification mode:

`GOVERNED_COMPOSITE_WITH_SIGNED_HUMAN_AUTHORIZATION`

### Fresh governed-composite schema-v3

A future active schema-v3 registry requires all fresh evidence inputs:

- `FRESH_CANONICAL_ACTIVATION_CONTRACT_PATH` — P57 activation-change contract;
- `FRESH_CANONICAL_ACTIVATION_PLAN_PATH` — P50 fresh activation plan;
- `FRESH_CANONICAL_COMPOSITE_CANDIDATE_PATH` — P51 schema-v3 candidate;
- `FRESH_CANONICAL_CUTOVER_SAFETY_GUARD_PATH` — P55 cutover-safety result;
- `FRESH_CANONICAL_OWNER_AUTHORITY_REGISTRY_PATH` — fresh owner trust registry;
- `EXPECTED_FRESH_CANONICAL_OWNER_AUTHORITY_REGISTRY_SHA256` — independently pinned trust-root hash;
- `FRESH_CANONICAL_SIGNED_OWNER_DECISION_PATH` — externally signed owner decision.

Missing or partial fresh evidence causes `REGISTRY_HOLD` before the active schema-v3 baseline can pass Release Verify.

The gate invokes P58, which in turn revalidates P51/P57, verifies exact raw registry content, verifies the exact P57 rollback image, and recomputes P57 so the P56 RSA-SHA256 owner signature and trust root are verified again.

Verification mode:

`FRESH_GOVERNED_COMPOSITE_WITH_REVERIFIED_OWNER_AUTHORIZATION`

## File hardening

All gate inputs are bounded regular JSON files. Symlinks, oversized files, invalid JSON, non-object JSON and unavailable files fail closed. Fresh evidence uses distinct environment-variable names so historical schema-v2 authority evidence cannot be silently substituted for fresh-cycle evidence.

## Release Verify semantics

P59 does not cause the current repository to enter schema-v3 mode. The checked-in canonical registry remains `LEGACY_FILE_SHA256`.

If a later controlled executor changes the registry to schema v3, the mandatory `CANONICAL_BASELINE_REGISTRY_VERIFICATION` step can then verify that observed state using P58 and the fresh evidence chain. Missing or invalid fresh evidence makes Release Verify fail.

## Authority boundary

A successful gate verifies evidence consistency only. It does not grant activation, release, merge, deployment, go-live or transaction authority.

In every mode:

- `activationAuthorizationGrantedByGate=false`;
- release/merge/deployment/go-live/transaction authority remain false;
- a future schema-v3 activation still requires a separate controlled executor;
- any applied activation remains release-blocked until a new post-change Release Verify succeeds under the actual observed registry state.

P59 itself performs no canonical-registry mutation and no deployment action.
