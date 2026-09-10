# P40 — Dual-Mode Canonical Registry Verifier

## Purpose

P40 prepares the existing `CANONICAL_BASELINE_REGISTRY_VERIFICATION` Release Verify step to understand both the current legacy baseline and a future governed-composite baseline without silently weakening the activation boundary.

The repository remains on `LEGACY_FILE_SHA256`. P40 does not change `config/governance/canonical-baseline.json`, does not apply the P39 proposed registry and does not grant merge, deployment, go-live or transaction authority.

## Modes

### 1. `LEGACY_FILE_SHA256`

The verifier delegates to the existing strict P32 legacy-registry evaluator. The current schema-v1 registry continues to pass with no additional activation evidence. Its historical canonical source remains `UNAVAILABLE / NOT_EVALUATED`.

### 2. `GOVERNED_COMPOSITE_BASELINE`

A schema-v2 composite registry is recognized only if all of the following are true:

1. the registry has the exact P39 composite shape and keeps all release/merge/deployment/go-live/transaction authority flags false;
2. the historical legacy SHA-256 remains pinned and its unavailable/not-evaluated state is preserved;
3. an exact P39 `EXPLICIT_ACTIVATION_CHANGE_CONTRACT_READY_NOT_AUTHORIZED` artifact is supplied and its deterministic contract hash, proposed-registry hashes/content and exact rollback registry are revalidated;
4. the active composite registry exactly equals the P39 proposed registry;
5. a human owner activation decision is supplied as an RSA-SHA256 attestation bound to the exact P39 contract;
6. the signer is found in an activation-authority registry whose deterministic registry hash is pinned out of band;
7. the signer actor matches the P39 owner/preparer, the purpose is exactly `CANONICAL_BASELINE_ACTIVATION`, the authority is active at the decision time and the signature verifies.

A P39 contract alone is insufficient. A JSON claim of human approval alone is insufficient. Missing, malformed, untrusted, wrong-scope or invalid-signature activation evidence fails closed.

## Release Verify inputs for a future composite state

When `config/governance/canonical-baseline.json` actually contains `GOVERNED_COMPOSITE_BASELINE`, the existing registry gate requires:

- `CANONICAL_BASELINE_ACTIVATION_CONTRACT_PATH`
- `CANONICAL_BASELINE_ACTIVATION_AUTHORITY_REGISTRY_PATH`
- `CANONICAL_BASELINE_ACTIVATION_ATTESTATION_PATH`
- `EXPECTED_CANONICAL_BASELINE_ACTIVATION_AUTHORITY_REGISTRY_SHA256`

Evidence files are bounded in size and symlinks are rejected. Paths and private keys are not serialized into the normalized gate output. The repository tooling accepts only the public-key authority registry and signed attestation; no private signing key is accepted.

## Security and governance boundary

P40 distinguishes **verification of an already-applied registry state** from **authority to apply that state**. Even a successful future composite verification reports that the gate itself did not grant activation authority. It only proves that the observed active registry is exactly bound to P39 plus a cryptographically verified human owner decision.

The real independent review that produces the P30 lock consumed upstream by P31/P38/P39 remains external and pending. `سعيد المراجع` remains only the mutable workflow designation until that review actually occurs.

P40 does not establish production IdP, database/RLS, backup/DR, penetration-test/UAT, performance/resilience, PDPL/legal, professional-licensing or release-authority evidence.
