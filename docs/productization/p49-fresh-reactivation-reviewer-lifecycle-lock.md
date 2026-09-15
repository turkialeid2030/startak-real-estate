# P49 — Fresh Reactivation Reviewer Lifecycle Lock

P49 freezes the fresh P47 reviewer designation only after the exact P48 independent-review approval has been cryptographically verified.

It is intentionally cycle-specific. The failed historical reviewer lifecycle, reviewer approval, activation plan, owner authorization and activation contract remain non-reusable.

## Required chain

P49 requires:

1. a valid P47 `FRESH_REACTIVATION_REVIEW_PACKET_READY_NOT_APPROVED` packet;
2. a P48 `FRESH_REACTIVATION_REVIEW_APPROVED_CRYPTOGRAPHICALLY_VERIFIED` result;
3. exact P47/P48 review-packet binding;
4. exact P48 verified-review-record re-hash;
5. the reviewer subject to remain the P47 cycle-specific reviewer;
6. the review decision to be `APPROVE_FRESH_REACTIVATION_REVIEW`;
7. reviewer identity, trust root and RSA-SHA256 attestation verification to remain true;
8. lock time not to precede the verified review decision.

Any packet tampering, reviewer drift, record-hash mismatch, cryptographic downgrade or authority escalation fails closed.

## Highest state

`FRESH_REACTIVATION_REVIEWER_LOCKED_BY_VERIFIED_REVIEW`

This state means only that reviewer replacement is frozen for the fresh reactivation cycle after the accepted cryptographically verified review.

It does **not** authorize reactivation. It sets or preserves:

- `freshReviewerLifecycleLocked=true`
- `reviewerReplacementAllowedNow=false`
- `independentReviewCompleted=true`
- `freshActivationPlanRequired=true`
- `freshCutoverSafetyEvidenceRequired=true`
- `freshOwnerActivationAuthorizationRequired=true`
- `freshActivationChangeContractRequired=true`
- `reactivationAuthorized=false`
- `currentBaselineMutationPerformed=false`
- `releaseStillBlocked=true`
- all release/merge/deployment/go-live/transaction authority flags false.

## Operator CLI

`tools/fresh-reactivation-reviewer-lifecycle-lock.js` consumes bounded regular JSON for the P47 packet and P48 verified review, rejects symlinks, unknown/duplicate/private-key arguments and writes restrictive output where supported.

It does not mutate `config/governance/canonical-baseline.json`, merge, deploy, go live or authorize transactions.

## Next governance boundary

A later slice may create the **fresh activation plan** from this P49 lock. That plan must remain bound to the fresh P46/P47/P48/P49 chain and must not inherit any prior-cycle activation authority.

**Keep Draft. Do not merge or deploy.**
