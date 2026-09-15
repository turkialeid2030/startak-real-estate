# P42 — Controlled Canonical Baseline Activation Executor

## Purpose

P42 operationalizes the already-prepared P39/P40/P41 activation path without changing the active repository baseline by default. Execution is **dry-run by default** and remains fail-closed.

The current repository baseline remains `LEGACY_FILE_SHA256` until a real independent review has produced the upstream reviewer lock, P31/P38/P39 artifacts exist, the owner activation authorization is signed externally and verified, and an explicit mutation run is deliberately invoked.

## Evidence chain

P42 reuses the existing trust path instead of introducing a parallel approval model:

`P39 exact activation/rollback contract -> P40 composite + signed owner verification -> P41 signed-owner authorization verification -> P42 controlled execution`

For activation, the current registry must still be the exact P39 prior legacy registry. The proposed registry must be the exact P39 composite registry and exact UTF-8 content hash.

For rollback, the observed active registry must be the exact P39 proposed composite registry, and the target is limited to the exact legacy rollback state already cryptographically bound into the owner's P40/P41 authorization payload through the P39 contract.

## Execution modes

### Dry run — default

Highest activation state:

`ACTIVATION_DRY_RUN_READY`

Highest rollback state:

`ROLLBACK_DRY_RUN_READY`

No writer is invoked and `mutationPerformed=false`.

### Explicit mutation

A non-dry-run call additionally requires an injected registry writer. The writer receives the exact expected prior logical/content state and exact next content/hash and must confirm the observed written content SHA-256.

Highest activation state:

`ACTIVATION_APPLIED_REQUIRES_POST_CHANGE_RELEASE_VERIFY`

Highest rollback state:

`ROLLBACK_APPLIED_REQUIRES_POST_CHANGE_RELEASE_VERIFY`

Even after a confirmed write, P42 keeps release/merge/deployment/go-live/transaction authority false and requires a subsequent Release Verify against the observed state.

## CLI

`tools/controlled-canonical-baseline-activation.js` is dry-run unless both `--apply` and `--confirm-exact-registry-mutation` are supplied. It rejects private-key arguments, symbolic-link evidence inputs and oversized JSON evidence. Mutation uses an atomic same-directory temporary file, exact prior-content/hash checks and post-write content-hash confirmation.

Private signing keys are never accepted. Signing remains external to the repository.

## CI boundary

CI regression uses generated RSA test keys and test-double writers or temporary files only. No real canonical-registry mutation, merge, deployment or external infrastructure mutation is performed by qualification CI.

The real independent reviewer is still pending. `سعيد المراجع` remains only the mutable workflow designation until a real accepted independent review creates the upstream P30 reviewer lock.

## Authority boundary

P42 is an execution-safety mechanism, not release authority. It does not establish production evidence, legal/professional authority, merge authority, deployment authority, go-live authority or transaction authority.
