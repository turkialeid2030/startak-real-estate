# P57 — Fresh Activation Change Contract

P57 prepares the exact fresh-cycle canonical-registry change contract only after re-verifying the external P56 owner signature and binding it to the P55 safety evidence, P50 activation plan and P51 schema-v3 candidate. It performs no canonical-registry mutation.

## Required evidence

P57 requires:

- current canonical registry still verified as `LEGACY_FILE_SHA256`;
- valid P50 fresh activation plan;
- valid P51 `FRESH_COMPOSITE_REGISTRY_CANDIDATE_READY_NOT_ACTIVE`;
- P55 safety guard bound to that exact P51 candidate;
- fresh owner trust registry plus externally pinned registry hash;
- externally signed P56 owner decision.

P57 invokes P56 verification again rather than trusting a caller-supplied boolean. The owner RSA signature, owner trust root and exact fresh-cycle decision are therefore re-verified before a contract can be produced.

## Highest state

`FRESH_ACTIVATION_CHANGE_CONTRACT_READY_OWNER_AUTH_VERIFIED_NOT_APPLIED`

## Exact change and rollback content

The proposed registry is taken directly from the validated P51 schema-v3 candidate. P57 preserves both its deterministic logical hash and exact canonical UTF-8 content hash.

Rollback content is generated from the exact currently authoritative legacy registry. The contract fails closed unless the rollback logical SHA-256 equals the current verified registry hash.

The deterministic contract binds:

- fresh governance cycle;
- P49 reviewer lifecycle lock;
- P50 activation plan and successor manifest;
- P51 candidate record;
- P55 cutover-safety guard;
- cryptographically re-verified P56 owner authorization record and trust registry;
- exact proposed-registry logical/content hashes;
- exact rollback-registry logical/content hashes.

## Authority boundary

P57 records `ownerActivationAuthorizationVerified=true` and binds that evidence into the contract, but deliberately keeps:

- `activationAuthorized=false`;
- `activationApplied=false`;
- `reactivationAuthorized=false`;
- `currentBaselineMutationPerformed=false`;
- `releaseStillBlocked=true`;
- all release/merge/deployment/go-live/transaction authority flags false.

A fresh schema-v3 aware dual-mode registry verifier remains required before a controlled executor can be considered. Any later actual mutation must remain separately controlled and followed by a new Release Verify.
