# P27 — Canonical Re-baseline Review Attestation

## Purpose

P27 hardens the P26 independent-review handoff by allowing a real reviewer decision to be cryptographically bound to the exact P26 packet and to an out-of-band pinned reviewer registry.

It does not create or simulate the review. The human review remains external.

## Trust model

The reviewer registry contains reviewer identity references, RSA public keys, public-key SHA-256 digests, governance evidence references, active periods and the allowed purpose `CANONICAL_REBASELINE_INDEPENDENT_REVIEW`.

The registry is normalized and hashed. A caller must provide the expected registry SHA-256 from an out-of-band trusted source. A mismatch fails closed.

## Signed decision

`createIndependentReviewSigningPayload(...)` creates deterministic signing bytes bound to:

- P26 review request and packet hash;
- P24 proposal id/hash;
- exact qualified source commit;
- release artifact digest;
- environment configuration digest;
- reviewer id and actor reference;
- decision result and evidence reference/digest;
- decision timestamp/rationale;
- `RSA-SHA256`.

The repository tooling can prepare the signing bytes, but does not accept or store a private key.

## Verification

`createVerifiedIndependentReviewResponse(...)` verifies:

- P26 packet qualification;
- pinned reviewer-registry hash;
- reviewer public-key digest;
- reviewer subject equals the P24/P26 assigned reviewer;
- owner/reviewer separation;
- allowed purpose and active period;
- RSA-SHA256 signature over deterministic bytes.

On success the maximum state is:

`VERIFIED_REVIEW_RESPONSE_READY_FOR_P25_REEVALUATION`

The normalized review record can then be supplied back to P25.

## Explicit evidence boundary

A valid signature proves that the signed decision metadata was produced with the private key corresponding to the trusted registry entry. It does **not** verify the substantive contents of the external review artifact. Therefore P27 reports `externalReviewArtifactContentVerifiedHere=false`.

## Authority boundary

Even a valid APPROVE attestation keeps:

- `canonicalBaselineChanged=false`
- `legacyCanonicalEvidenceClosed=false`
- `existingE2iCanonicalEvidenceSatisfied=false`
- `releaseAuthorized=false`
- `mergeAuthorized=false`
- `deploymentAuthorized=false`
- `goLiveAuthorized=false`
- `transactionAuthorized=false`

P25 re-evaluation and a separate explicit reviewed baseline-activation change remain mandatory.
