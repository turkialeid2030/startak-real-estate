# P60 — Fresh Controlled Canonical Baseline Activation Executor

P60 is the first fresh-cycle slice permitted to model an actual schema-v3 canonical-registry mutation. It remains dry-run by default and does not itself grant activation, release, merge, deployment, go-live or transaction authority.

## Inputs and evidence chain

P60 requires the exact fresh-cycle evidence already established by P50–P58:

- current observed canonical registry and exact raw file content;
- P57 fresh activation-change contract;
- P50 fresh activation plan;
- P51 schema-v3 composite candidate;
- P55 fresh cutover-safety guard;
- P56 fresh owner trust registry and independently pinned registry hash;
- P56 externally signed owner decision.

Before any dry-run or mutation, P60 recomputes P57 from its underlying evidence rather than trusting the supplied contract booleans or hashes. The recomputation therefore re-verifies the P56 RSA-SHA256 owner signature and trust root.

P60 then invokes P58 to verify the exact relevant registry state:

- activation requires the observed current registry to be the exact P57 legacy rollback image;
- the target schema-v3 registry must pass the full P58 fresh-composite verification chain;
- rollback requires the observed current schema-v3 registry to pass P58 and exactly match the P57 proposed registry;
- the rollback target must be the exact P57 legacy registry.

## Actions

Supported actions:

- `ACTIVATE`
- `ROLLBACK`

Both actions are dry-run by default.

### Activation dry-run

Highest state:

`FRESH_ACTIVATION_DRY_RUN_READY_NOT_APPLIED`

This proves only that the supplied observed legacy state and target schema-v3 state satisfy the P57/P58 preconditions. It performs no write.

### Applied activation

A non-dry-run activation requires a host-injected registry writer. The repository CLI supplies an atomic file writer that verifies exact prior raw content, prior logical hash, target logical hash and target content hash before replacing the registry file.

After the write, P60 does not trust the writer acknowledgement. It re-parses the observed file state returned by the writer and reruns P58 against that observed schema-v3 state.

Success state:

`FRESH_ACTIVATION_APPLIED_POST_WRITE_VERIFIED_REQUIRES_RELEASE_VERIFY`

If the writer reports an applied state but the observed registry fails P58, the result is:

`FRESH_ACTIVATION_APPLIED_POST_WRITE_VERIFICATION_FAILED_ROLLBACK_REQUIRED`

That failure does not trigger automatic rollback. It marks rollback and manual intervention as required and keeps every release authority flag false.

If the writer throws or cannot return a verifiable post-write state, P60 does not claim that mutation did or did not occur. The outcome is recorded as unknown and manual intervention is required.

### Rollback

Rollback is limited to the exact legacy image already bound into P57.

Dry-run state:

`FRESH_ROLLBACK_DRY_RUN_READY_NOT_APPLIED`

Applied success state:

`FRESH_ROLLBACK_APPLIED_POST_WRITE_VERIFIED_REQUIRES_RELEASE_VERIFY`

If the rollback write is reported as applied but the observed restored registry fails the legacy P58 verification, P60 returns:

`FRESH_ROLLBACK_APPLIED_POST_WRITE_VERIFICATION_FAILED_MANUAL_INTERVENTION_REQUIRED`

No automatic second mutation is attempted.

## Operator hardening

`tools/fresh-controlled-canonical-baseline-activation.js`:

- rejects private/secret/signing-key arguments;
- rejects unknown and duplicate arguments;
- reads only bounded regular JSON files and rejects symlinks;
- defaults to dry-run;
- requires both `--apply` and `--confirm-exact-registry-mutation` before a real write path is enabled;
- uses an atomic temporary-file + fsync + rename writer;
- validates exact prior bytes and both logical/content hashes before replacement;
- preserves the existing registry file mode where possible;
- writes optional result evidence with restrictive permissions.

## P59 and Release Verify boundary

P59 is deliberately not treated as pre-action authorization. P59 is the provider-neutral Release Verify gate for an observed repository registry state, so its meaningful fresh schema-v3 evaluation occurs only after an actual mutation exists on disk.

Accordingly every P60 applied result sets:

- `p59ReleaseGateRequiredAfterMutation=true`;
- `postChangeReleaseVerifyRequired=true`;
- `postChangeReleaseVerifySatisfied=false`;
- `releaseStillBlocked=true`.

The next governed slice must consume an actual post-change Release Verify result in which the P59 canonical-registry gate verifies the observed schema-v3 state. P60 itself never converts a successful write into release authority.

## Authority boundary

In all P60 states:

- `activationAuthorized=false`;
- `reactivationAuthorized=false`;
- release/merge/deployment/go-live/transaction authority remain false.

An applied activation only records that an exact governed mutation occurred and that P58 verified the observed post-write state. It is not a release decision, deployment approval or go-live approval.
