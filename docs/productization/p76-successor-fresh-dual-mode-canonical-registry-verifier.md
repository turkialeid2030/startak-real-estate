# P76 — Successor Fresh Dual-Mode Canonical Registry Verifier

## Purpose

P76 adds a successor-specific dual-mode verifier for the future schema-v4 governed-composite canonical registry while preserving the existing strict legacy path.

It is a verifier only. It cannot mutate `config/governance/canonical-baseline.json` or grant release authority.

## Legacy mode

When the observed registry remains `LEGACY_FILE_SHA256`, P76 delegates to the established canonical legacy evaluator. No successor activation evidence is inferred.

## Schema-v4 successor mode

A governed-composite registry is accepted only when all of the following hold:

- schema version is exactly `4` and the complete top-level and governed-baseline field sets are exact;
- the historical legacy metadata remains pinned and unresolved exactly as before;
- `activationApplied=true` and `canonicalBaselineChanged=true` are observed as state facts, while every release/merge/deployment/go-live/transaction authority field remains false;
- the exact raw active-registry bytes are supplied and equal the canonical P69/P75 proposed bytes;
- P69 candidate structure/hash and P75 activation-change-contract structure/hash are independently revalidated;
- P75 rollback registry is a valid legacy registry and its **exact raw bytes** reproduce both the expected prior logical hash and expected prior content SHA-256;
- P75 is recomputed from the rollback bytes plus the complete successor upstream evidence chain, causing the P74 RSA-SHA256 owner signature and cycle-scoped trust root to be re-verified;
- the active registry object, logical hash, raw-content hash, cycle/reviewer/plan/manifest bindings and predecessor incident/RCA/CAPA lineage all match P69/P75 exactly.

## Highest state

`SUCCESSOR_FRESH_COMPOSITE_BASELINE_VERIFIED_WITH_SUCCESSOR_OWNER_AUTHORIZATION`

This means an observed schema-v4 object and its exact bytes are consistent with the supplied successor governance chain. It does **not** mean P76 authorized or executed activation.

## Authority boundary

P76 always returns:

- `activationAuthorizedByThisVerifier=false`;
- `mutationPerformedByThisVerifier=false`;
- `releaseStillBlocked=true`;
- release/merge/deployment/go-live/transaction authority=false.

A separate release-gate integration must make schema-v4 verification available to provider-neutral Release Verify before any controlled activation executor can be considered.

## Evidence limitation

Regression tests construct the successor chain with local synthetic evidence and an ephemeral RSA keypair. They prove executable verification behavior only. No real external owner signature, production provenance, merge, deployment or go-live authorization is established.
