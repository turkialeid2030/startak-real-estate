# P58 — Fresh Dual-Mode Canonical Registry Verifier

P58 extends canonical-registry verification for the post-incident fresh governance cycle without changing the active repository registry.

It preserves the strict legacy verification path and adds a fail-closed verifier for a future schema-v3 `GOVERNED_COMPOSITE_BASELINE` registry.

## Legacy mode

When the observed registry remains `LEGACY_FILE_SHA256`, P58 delegates to the existing canonical-baseline registry verifier. It does not infer any fresh activation evidence.

Highest legacy state:

`LEGACY_BASELINE_VERIFIED`

## Fresh composite mode

A schema-v3 fresh composite registry is accepted only when all of the following are true:

- exact schema-v3 top-level and governed-composite field sets are present;
- legacy baseline metadata remains pinned to the historical expected SHA-256 and remains `UNAVAILABLE` / `NOT_EVALUATED`;
- release/merge/deployment/go-live/transaction authority flags remain false;
- exact observed registry bytes are canonical and match the P57 proposed registry content;
- the observed logical registry hash matches the P57 proposed registry hash;
- P51 candidate shape and hashes are revalidated;
- P57 contract shape and deterministic contract hash are revalidated;
- the P57 rollback registry is independently verified as the exact legacy baseline and its logical/content hashes match the P57 contract;
- P57 is recomputed from the supplied P50/P51/P55 inputs plus the externally signed owner decision and pinned owner trust registry;
- recomputation therefore re-verifies the P56 RSA-SHA256 signature and trust root rather than trusting a caller-supplied approval boolean;
- the active schema-v3 registry is exactly bound to the fresh governance cycle, reviewer lifecycle lock, activation plan and prior legacy registry.

Highest fresh-composite state:

`FRESH_COMPOSITE_BASELINE_VERIFIED_WITH_FRESH_OWNER_AUTHORIZATION`

## Raw file-content binding

For fresh composite mode, raw observed registry file content is mandatory. P58 rejects a logically equivalent object if its on-disk content is not the exact canonical JSON representation bound by P57.

This prevents a logical-object-only verification from masking file-content drift.

## Operator boundary

`tools/fresh-dual-mode-canonical-registry-verifier.js`:

- accepts only bounded regular JSON files;
- rejects symlinks;
- rejects unknown or duplicate arguments;
- rejects private/secret signing-key arguments;
- requires the full P57/P56 evidence chain only when the observed registry is in fresh composite mode;
- writes restrictive output when an output path is supplied;
- performs no canonical-registry mutation.

## Authority boundary

P58 verifies state; it does not authorize or perform state transition.

Even after a valid fresh-composite verification:

- `activationAuthorizedByThisVerifier=false`;
- `mutationPerformedByThisVerifier=false`;
- `releaseStillBlocked=true`;
- release/merge/deployment/go-live/transaction authority remain false;
- post-activation Release Verify remains required.

A separate controlled activation executor is still required for any actual registry mutation. The repository's authoritative baseline remains `LEGACY_FILE_SHA256` until such a separately controlled action is explicitly executed under real governance evidence.
