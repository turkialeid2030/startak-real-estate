# P56 — Fresh Owner Activation Authorization

P56 prepares and verifies an externally signed human-owner decision for the fresh post-incident canonical-baseline governance cycle. It consumes the exact P55 cutover-safety guard and P50 fresh activation plan while the authoritative registry remains `LEGACY_FILE_SHA256`.

## Required state

P56 accepts only:

- P55 `FRESH_CUTOVER_SAFETY_GUARD_SATISFIED_NOT_AUTHORIZED`;
- P50 `FRESH_REACTIVATION_ACTIVATION_PLAN_READY_NOT_AUTHORIZED` bound to the same fresh cycle;
- the current repository canonical registry still verifying as the exact legacy registry.

P56 independently re-hashes the P55 safety core, invokes the P50 activation-plan validator and requires exact agreement on cycle, current registry, reviewer lifecycle lock, activation plan and successor-baseline manifest.

## Dedicated owner trust root

A separate fresh-owner authority registry binds each authority to:

- authority ID;
- owner actor reference;
- RSA public key and SHA-256 of the exact PEM text;
- governance evidence reference;
- active period;
- fixed purpose `FRESH_CANONICAL_BASELINE_ACTIVATION_AUTHORIZATION`.

The deterministic registry SHA-256 must match an expected hash supplied out-of-band. Repository tooling never accepts or stores a private signing key.

## Decision

Only one positive authorization decision is accepted:

`AUTHORIZE_FRESH_CANONICAL_BASELINE_ACTIVATION`

The decision actor must equal the P50 fresh-cycle owner (`preparedByRef`). The decision cannot predate the fresh activation plan and must fall inside the trusted authority's active period.

The signed payload binds the exact P55 safety guard, P50 activation plan, current legacy registry, fresh reviewer lock, candidate logical/content hashes, composite evidence, shadow verification and cutover rehearsal.

## Signing flow

The operator supports two modes:

1. `prepare` — validates scope/trust and emits deterministic signing bytes plus an unsigned decision package.
2. `verify` — verifies an externally produced `RSA-SHA256` signature against the pinned fresh-owner trust root.

Prepare state:

`READY_FOR_EXTERNAL_FRESH_OWNER_SIGNATURE`

Verified state:

`FRESH_OWNER_ACTIVATION_AUTHORIZATION_CRYPTOGRAPHICALLY_VERIFIED_NOT_APPLIED`

## Authority boundary

A cryptographically verified P56 result proves the fresh owner decision record only. It deliberately keeps:

- `ownerActivationAuthorizationVerified=true` only after valid external signature verification;
- top-level `activationAuthorized=false`;
- `activationApplied=false`;
- `reactivationAuthorized=false`;
- `currentBaselineMutationPerformed=false`;
- `releaseStillBlocked=true`;
- all release/merge/deployment/go-live/transaction authority flags false.

A fresh explicit activation-change contract remains mandatory before any controlled activation executor can be considered. Post-change Release Verify remains mandatory after any future authorized mutation.
