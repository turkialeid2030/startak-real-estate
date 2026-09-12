# P34 — Governed Composite Baseline Evidence Verifier

P34 prepares the verification engine for the future `GOVERNED_COMPOSITE_BASELINE` without activating that baseline and without waiting on the final independent reviewer identity.

## Purpose

The active repository baseline remains `LEGACY_FILE_SHA256`. P34 verifies that a P32 governed-composite candidate is internally bound to the intended successor manifest and that supplied candidate evidence matches the exact qualified Git commit, release-artifact bytes and environment-config bytes referenced by that manifest.

## Preconditions

P34 requires:

- the current P32 registry to still evaluate as `LEGACY_BASELINE_REGISTRY_CONFIRMED`;
- a P32 `COMPOSITE_REGISTRY_CANDIDATE_READY_FOR_EXPLICIT_CODE_CHANGE` candidate;
- intact candidate and successor-manifest SHA-256 bindings;
- the expected successor baseline type and legacy supersession hash;
- supplied exact commit SHA, release-artifact bytes and environment-config bytes.

The verifier computes SHA-256 directly over the supplied artifact/config bytes and does not serialize those bytes into evidence output.

## Success state

The highest P34 result is:

`COMPOSITE_BASELINE_EVIDENCE_VERIFIED_CANDIDATE_ONLY`

This means only that the candidate evidence matches the P32/P31 digest scope while the active registry is still the confirmed legacy baseline.

It does **not** mean:

- the governed composite baseline is active;
- the missing historical canonical original has been recovered or verified;
- the independent reviewer has approved the re-baseline;
- E2I canonical evidence has been satisfied;
- release, merge, deployment, go-live or transaction authority has been granted.

## Fail-closed checks

P34 holds on current-registry drift, candidate authority escalation, mode drift, malformed hashes, successor-manifest scope or hash mismatch, candidate hash mismatch, commit mismatch, release-artifact mismatch, environment-config mismatch or invalid activation target path.

## Sensitive-data boundary

Only SHA-256 digests are emitted for the supplied release artifact and environment configuration. Raw bytes, configuration values, credentials, tokens and connection strings are not included in the evidence object.

## Activation boundary

P34 is deliberately not wired as an active composite-baseline Release Verify mode. P33 continues to require the existing legacy registry. A future reviewed activation change may alter both the registry and the release gate only after real P27/P30/P31 governance evidence exists.

All authority flags remain false.
