# P48 — Fresh Reactivation Review Attestation

P48 cryptographically verifies the independent-review decision for the exact P47 fresh-reactivation review packet. It uses a dedicated pinned reviewer trust registry and does not accept a private signing key.

## Required P47 state

P48 accepts only:

`FRESH_REACTIVATION_REVIEW_PACKET_READY_NOT_APPROVED`

It re-hashes both the fresh reviewer designation and the complete deterministic P47 review-packet core. Reviewer/designator scope drift, packet tampering, authority escalation or a stale replacement packet fails closed.

## Fresh reviewer trust root

The reviewer registry binds:

- reviewer ID;
- reviewer subject reference;
- RSA public key and public-key SHA-256;
- governance evidence reference;
- active period;
- fixed purpose `FRESH_REACTIVATION_INDEPENDENT_REVIEW`.

The normalized registry has a deterministic SHA-256 and must match an expected hash supplied as an external trust root.

## Review decisions

Only two decisions are valid:

- `APPROVE_FRESH_REACTIVATION_REVIEW`
- `REJECT_FRESH_REACTIVATION_REVIEW`

The signed payload binds the exact P47 packet, P46 cycle hash, fresh reviewer designation hash, current legacy registry hash, qualified Git commit, release-artifact SHA-256, environment-config SHA-256, cycle-evidence artifact SHA-256 and the external review-evidence reference/hash.

The decision actor must equal the P47 designated reviewer and the trusted registry subject. The decision cannot predate the P47 review request or fall outside the reviewer's trusted active period.

## Signing flow

The operator has two modes:

1. `prepare` — verifies packet/trust-root/scope and emits deterministic signing bytes plus an unsigned attestation package.
2. `verify` — verifies an externally produced RSA-SHA256 signature against the pinned reviewer trust root.

Repository tooling never accepts or stores the reviewer private key.

## Highest states

Approval:

`FRESH_REACTIVATION_REVIEW_APPROVED_CRYPTOGRAPHICALLY_VERIFIED`

Rejection:

`FRESH_REACTIVATION_REVIEW_REJECTED_CYCLE_BLOCKED`

A verified approval is not an activation or release authorization. It only establishes cryptographically verified independent-review evidence for a later fresh reviewer lifecycle lock.

A verified rejection blocks the current reactivation cycle. It does not mutate the canonical baseline and grants no authority.

## Evidence boundary

P48 verifies the signed review-decision metadata, reviewer identity binding and trust root. It records an external review-evidence reference/hash but does not independently evaluate the substantive contents of that external review artifact.

## Authority boundary

P48 always keeps:

- `reactivationAuthorized=false`;
- `currentBaselineMutationPerformed=false`;
- `releaseStillBlocked=true`;
- all release/merge/deployment/go-live/transaction authority flags false.
