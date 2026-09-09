# P26 — Canonical Re-baseline Independent Review Handoff

## Purpose

P26 operationalizes the real governance blocker after P25: an independent reviewer, distinct from the owner/proposer, must review the P24 re-baseline proposal before any explicit baseline-activation code change can be proposed.

P26 does **not** fabricate that review. It creates a deterministic review packet and a narrow response-normalization boundary.

## Review packet

`createCanonicalRebaselineIndependentReviewPacket(...)` only succeeds when P25 evaluates the supplied P24 proposal and owner decision to `WAITING_FOR_INDEPENDENT_REVIEW`.

The packet binds the reviewer to:

- P24 proposal id and proposal SHA-256;
- exact qualified Git commit;
- release artifact SHA-256;
- environment configuration SHA-256;
- historical legacy canonical SHA-256, explicitly marked unavailable;
- owner decision hash;
- the independent reviewer reference selected in P24;
- an explicit review checklist;
- a deterministic packet SHA-256.

## Review checklist

The reviewer is asked to confirm that:

1. the legacy canonical original is accurately recorded as unavailable;
2. no claim is made that the historical SHA-256 was re-verified;
3. the successor baseline is tied to an exact qualified Git commit;
4. the release artifact digest scope is understood;
5. the environment-config digest scope is understood;
6. owner/reviewer separation is maintained;
7. impact on the E2I canonical-evidence contract is reviewed;
8. no release, merge, deployment, go-live or transaction authority is granted by the re-baseline decision.

## Response normalization

`createIndependentReviewResponse(...)` validates the supplied reviewer response contract and ensures the actor is exactly the assigned independent reviewer and differs from the owner.

A normalized response reaches only:

`REVIEW_RESPONSE_READY_FOR_P25_REEVALUATION`

It must then be supplied back to P25. P26 does not itself activate the baseline.

## Evidence boundary

P26 intentionally reports:

- `reviewerIdentityCryptographicallyVerified=false`
- `externalReviewEvidenceAuthenticityVerifiedHere=false`

Those are external governance/evidence responsibilities. A GitHub username, CI execution or generated test fixture must not be treated as independent human review.

## Authority boundary

P26 always keeps:

- `canonicalBaselineChanged=false`
- `legacyCanonicalEvidenceClosed=false`
- `existingE2iCanonicalEvidenceSatisfied=false`
- `releaseAuthorized=false`
- `mergeAuthorized=false`
- `deploymentAuthorized=false`
- `goLiveAuthorized=false`
- `transactionAuthorized=false`

No merge or deploy is authorized by this slice.
