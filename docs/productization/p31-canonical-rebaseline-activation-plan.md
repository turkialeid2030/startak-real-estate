# P31 — Canonical Re-baseline Activation Plan

P31 prepares the deterministic input for a future explicit reviewed code change that may activate the governed successor canonical baseline. It does **not** perform that change.

## Required prerequisites

P31 fails closed unless all of the following are simultaneously true:

- the P24 re-baseline proposal is qualified and still records the historical canonical original as unavailable;
- P25 is in `READY_FOR_EXPLICIT_BASELINE_ACTIVATION_CHANGE` with owner approval plus a distinct approved independent review;
- the P25 governance-decision hash validates against its exact decision contents;
- P30 is in `REVIEWER_LOCKED_BY_VERIFIED_REVIEW`;
- the P30 lock is bound to the same effective reviewer designation as P25;
- reviewer identity, reviewer-registry trust root and RSA-SHA256 review attestation are all verified;
- the P30 reviewer-lock hash validates;
- the activation plan is prepared by the proposal owner.

## Successor baseline manifest

When all prerequisites are satisfied, P31 produces a deterministic successor-baseline manifest containing:

- exact qualified Git commit SHA;
- release-artifact SHA-256;
- environment-config SHA-256;
- historical canonical SHA-256 being superseded;
- P25 governance-decision SHA-256;
- P30 reviewer-lock SHA-256.

It also produces `successorBaselineManifestHashSha256` and `activationPlanHashSha256`.

The planned activation contract targets `config/governance/canonical-baseline.json`, expects the prior mode `LEGACY_FILE_SHA256`, and proposes `GOVERNED_COMPOSITE_BASELINE`.

## Authority boundary

Even when P31 returns `READY_FOR_EXPLICIT_BASELINE_ACTIVATION_CHANGE_PLAN`, all of the following remain false:

- `canonicalBaselineChanged`
- `legacyCanonicalEvidenceClosed`
- `existingE2iCanonicalEvidenceSatisfied`
- `releaseAuthorized`
- `mergeAuthorized`
- `deploymentAuthorized`
- `goLiveAuthorized`
- `transactionAuthorized`

A separate explicit reviewed code change, post-change Release Verify and E2I policy review remain required. No reviewer decision is fabricated by P31.