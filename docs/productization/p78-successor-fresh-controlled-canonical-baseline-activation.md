# P78 — Successor Fresh Controlled Canonical Baseline Activation

## Purpose

P78 introduces a dry-run-by-default executor for the successor schema-v4 canonical-baseline transition prepared by P75 and verified by P76/P77.

It supports only two actions:

- `ACTIVATE`: exact legacy state -> exact P75 schema-v4 proposed registry.
- `ROLLBACK`: exact active P75 schema-v4 state -> exact P75 legacy rollback bytes.

## Mandatory evidence boundary

Before activation P78 requires the current legacy registry to match the P75 rollback state exactly and requires the target schema-v4 state to pass P76 with the full successor evidence chain. P76 therefore re-verifies the successor owner RSA-SHA256 authorization through P75 rather than trusting a stored boolean.

Before rollback P78 requires the currently observed schema-v4 state to pass P76 and requires the rollback target to match the P75 legacy object and exact raw bytes.

## Dry-run default

`dryRun=true` is the default. Dry-run returns a deterministic execution receipt but performs no write.

The CLI requires all of the following before an apply path is even attempted:

- `--apply`
- `--confirm-exact-registry-mutation`
- `--expected-contract-sha256`
- `--expected-prior-registry-sha256`
- `--expected-target-registry-sha256`

Those expected hashes must match the P75 contract and the requested direction.

## Atomic writer

The operator writer:

1. re-reads the target canonical registry immediately before mutation;
2. rejects symlinks and non-regular files;
3. compares exact prior raw content and logical SHA-256;
4. validates target raw-content and logical SHA-256;
5. writes through a restrictive temporary file opened with `wx`;
6. fsyncs the temporary file;
7. atomically renames it over the registry;
8. attempts to fsync the parent directory;
9. re-reads the written object and exact raw content for post-write verification.

## Post-write boundary

A successful write is not a release decision. P78 immediately re-runs P76 against the observed written state. Even when that passes, the result remains:

`SUCCESSOR_FRESH_ACTIVATION_APPLIED_POST_WRITE_VERIFIED_REQUIRES_RELEASE_VERIFY`

or, for rollback:

`SUCCESSOR_FRESH_ROLLBACK_APPLIED_POST_WRITE_VERIFIED_REQUIRES_RELEASE_VERIFY`

P77-backed post-change Release Verify remains mandatory and all release, merge, deployment, go-live and transaction authority remains false.

If an activation write is observed but P76 post-write verification fails, P78 returns a rollback-required state. If rollback write verification fails, it returns a manual-intervention-required state. It does not silently claim success.

## Security constraints

Private, secret or signing-key material is rejected recursively. P78 accepts only public trust evidence and an already externally signed owner decision. No private signing operation exists in this slice.

## Regression evidence limitation

Regression tests may exercise apply behavior only against temporary files and use the existing synthetic successor fixture with ephemeral RSA signing evidence. They must never modify the checked-in `config/governance/canonical-baseline.json` and do not establish a real owner approval or production activation.

## Non-claims

P78 does not itself authorize activation, release, merge, deployment, go-live or transactions. It provides a controlled mutation mechanism that may only be used after the separate governance and evidence prerequisites are genuinely supplied.
