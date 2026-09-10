# P61 — Fresh Post-Activation Verification & Rollback Trigger

P61 evaluates a **fresh-cycle applied P60 activation** after the canonical registry has changed to schema v3. It binds the P60 execution receipt to the exact observed registry, re-runs the P58 fresh dual-mode verification chain, and evaluates supplied P59-style post-change Release Verify evidence.

P61 never performs rollback automatically and never grants release, merge, deployment, go-live, or transaction authority.

## Required evidence chain

P61 accepts only P60 status:

`FRESH_ACTIVATION_APPLIED_POST_WRITE_VERIFIED_REQUIRES_RELEASE_VERIFY`

The P60 receipt must show a non-dry-run ACTIVATE operation, successful mutation, successful post-write P58 verification, exact P57 contract/registry/hash bindings, and a still-blocked release state. P61 recomputes the deterministic P60 receipt hash instead of trusting the supplied hash field.

The observed canonical registry must match the exact P57 proposed schema-v3 registry in:

- logical object identity;
- logical SHA-256;
- exact raw canonical content;
- raw-content SHA-256.

P61 then invokes P58 using P50, P51, P55, the P57 contract, the fresh owner trust registry, the independently pinned trust-registry digest, and the externally signed P56 owner decision. This re-verifies the owner signature/trust path rather than trusting P60 booleans.

## Post-change Release Verify evidence

A supplied Release Verify record is normalized and deterministically hashed. A successful consistency result requires:

- `releaseVerifyResult=PASS`;
- regression, production build, package verification, npm audit threshold, and canonical-baseline registry verification all `PASS`;
- active mode `GOVERNED_COMPOSITE_BASELINE`;
- registry schema version `3`;
- P59 verification mode `FRESH_GOVERNED_COMPOSITE_WITH_REVERIFIED_OWNER_AUTHORIZATION`;
- registry logical/content hashes equal the exact observed post-activation registry;
- source commit equals the P50 successor manifest qualified Git commit;
- Release Verify completion time does not precede the P60 activation execution.

P61 checks evidence consistency only. It does **not** authenticate GitHub Actions or another external CI provider by itself. Therefore `releaseVerifyEvidenceAuthenticityVerifiedHere=false` and `productionEvidenceEstablishedHere=false` remain explicit.

## Success state

When the P60 receipt, observed schema-v3 registry, P58 chain, and supplied Release Verify evidence are all internally consistent, P61 returns:

`FRESH_POST_ACTIVATION_RELEASE_VERIFY_EVIDENCE_CONSISTENT_GOVERNANCE_BLOCKED`

This marks deterministic post-activation consistency, not release authorization. `releaseStillBlocked=true` and all authority fields remain false.

## Missing Release Verify evidence

If the observed schema-v3 registry passes P58 but no Release Verify record is supplied, P61 returns:

`HOLD_FRESH_POST_ACTIVATION_VERIFICATION`

with `POST_CHANGE_RELEASE_VERIFY_EVIDENCE_REQUIRED`. Missing evidence alone does not fabricate a rollback failure.

## Rollback trigger

Observed registry drift, P58 failure, malformed/failing Release Verify evidence, wrong mode/schema/verification mode, wrong source commit, hash mismatch, or Release Verify evidence predating activation produces:

`FRESH_ROLLBACK_TRIGGERED_P57_PREBOUND_LEGACY_ONLY`

The trigger is deterministically bound to:

- the exact P60 activation execution receipt;
- the exact P57 activation-change contract;
- the observed post-activation registry hashes;
- the exact P57 legacy rollback registry logical/content hashes;
- normalized reason codes.

The trigger explicitly records:

- `automaticRollbackMutationAllowed=false`;
- `automaticRollbackMutationPerformed=false`;
- `p60ControlledRollbackExecutionRequired=true`;
- `rollbackLimitedToP57PreboundLegacyState=true`;
- `postRollbackReleaseVerifyRequired=true`.

A separate controlled P60 rollback execution is therefore required before any claim of restoration can be made.

## Operator

`tools/fresh-post-activation-verification-rollback-trigger.js` reads bounded regular JSON inputs, preserves the exact observed registry raw bytes, rejects symlinks and private/secret key arguments, and emits one of the deterministic P61 states. It never mutates the registry.

Exit codes:

- `0` — post-activation evidence consistency state;
- `2` — HOLD / incomplete evidence;
- `3` — deterministic rollback trigger emitted;
- `1` — operator/input error.

## Governance boundary

P61 is an evidence-consistency and rollback-trigger layer only. A successful result does not convert synthetic test evidence into operational human authorization, does not authenticate an external CI artifact by itself, and does not authorize merge, deployment, go-live, or transactions.

The repository canonical registry remains legacy unless an explicitly authorized P60 apply operation occurs outside this qualification slice. No real activation or rollback is performed by P61 tests.
