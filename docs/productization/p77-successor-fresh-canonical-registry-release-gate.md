# P77 — Successor Fresh Canonical Registry Release Gate

## Purpose

P77 integrates the P76 successor schema-v4 dual-mode verifier into the existing provider-neutral canonical-baseline registry gate already invoked by `tools/release-verify.js`.

The existing legacy, historical schema-v2 and fresh schema-v3 routes remain separate. Schema-v4 receives a distinct successor evidence namespace.

## Routing

The canonical gate now routes:

- schema-v1 `LEGACY_FILE_SHA256` → existing strict legacy semantics;
- schema-v2 governed composite → existing historical signed-human path;
- schema-v3 governed composite → existing P58/P59 fresh path;
- schema-v4 governed composite → P76 successor path.

Unsupported modes and schema versions remain fail-closed.

## Successor schema-v4 environment inputs

A schema-v4 active registry requires all of:

- `SUCCESSOR_FRESH_CANONICAL_ACTIVATION_CONTRACT_PATH`
- `SUCCESSOR_FRESH_CANONICAL_REVIEW_PACKET_PATH`
- `SUCCESSOR_FRESH_CANONICAL_REVIEWER_LIFECYCLE_PATH`
- `SUCCESSOR_FRESH_CANONICAL_ACTIVATION_PLAN_PATH`
- `SUCCESSOR_FRESH_CANONICAL_COMPOSITE_CANDIDATE_PATH`
- `SUCCESSOR_FRESH_CANONICAL_SHADOW_PATH`
- `SUCCESSOR_FRESH_CANONICAL_CUTOVER_REHEARSAL_PATH`
- `SUCCESSOR_FRESH_CANONICAL_CUTOVER_SAFETY_GUARD_PATH`
- `SUCCESSOR_FRESH_CANONICAL_OWNER_AUTHORITY_REGISTRY_PATH`
- `EXPECTED_SUCCESSOR_FRESH_CANONICAL_OWNER_AUTHORITY_REGISTRY_SHA256`
- `SUCCESSOR_FRESH_CANONICAL_SIGNED_OWNER_DECISION_PATH`

Missing, unreadable, symlinked, oversized, malformed or cryptographically inconsistent inputs return `REGISTRY_HOLD`.

## Exact-byte behavior

For schema-v4, the canonical registry file's actual raw bytes are passed to P76. P76 requires them to match the exact P75/P69 canonical proposed content and revalidates the exact legacy rollback raw-content SHA-256.

The legacy schema-v1 route intentionally retains semantic JSON compatibility and does not acquire a new raw-serialization requirement.

## Verified schema-v4 result

A successful schema-v4 gate result uses:

`SUCCESSOR_FRESH_GOVERNED_COMPOSITE_WITH_REVERIFIED_OWNER_AUTHORIZATION`

It reports P75 contract verification, re-verified successor owner authorization and exact rollback raw-content verification. It still sets `activationAuthorizationGrantedByGate=false` and all release/merge/deployment/go-live/transaction authority fields to false.

## Release Verify integration

No separate `tools/release-verify.js` code path is required because Release Verify already calls `verifyCanonicalBaselineRegistryFile()`. Therefore, a future checked-in schema-v4 registry can pass the canonical-registry stage only when all P76 successor evidence inputs are supplied and verified.

The current checked-in schema-v1 legacy registry continues to verify without successor environment inputs.

## Evidence limitation

Regression tests use locally generated successor evidence and an ephemeral synthetic RSA owner keypair. This validates routing, exact-byte binding, trust-root pinning and failure behavior only. It does not establish a real external owner signature, real production provenance, actual activation or release authority.
