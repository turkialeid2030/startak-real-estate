# P39 — Composite Baseline Activation Change Contract

P39 prepares the exact repository change contract that could later switch the canonical baseline from `LEGACY_FILE_SHA256` to `GOVERNED_COMPOSITE_BASELINE`. It does **not** authorize or apply that change.

## Preconditions

P39 accepts only a still-authoritative P32 legacy registry, a valid P31 activation plan, and a P38 `CUTOVER_SAFETY_GUARD_SATISFIED_NOT_ACTIVATED` result. The P38 result must remain bound to the same registry hash, activation-plan hash, successor-manifest hash and reviewer-lock hash.

## Deterministic outputs

The contract produces:

- the exact proposed `config/governance/canonical-baseline.json` post-activation content;
- SHA-256 of both the proposed logical registry and exact UTF-8 file content;
- the exact rollback registry content matching the current authoritative registry;
- SHA-256 of both the rollback logical registry and exact UTF-8 file content;
- a deterministic activation-change-contract SHA-256 binding the prior registry, P31, P38, successor manifest, reviewer lock, proposed content and rollback content.

The proposed registry uses schema version 2 and records the governed-composite baseline while keeping every release, merge, deployment, go-live and transaction authority flag false. The unavailable legacy source remains recorded as unavailable/not evaluated and is not rewritten as verified.

## Safety boundary

A successful P39 result is only:

`EXPLICIT_ACTIVATION_CHANGE_CONTRACT_READY_NOT_AUTHORIZED`

It explicitly retains:

- `activationAuthorizationGranted=false`
- `actualRegistryMutationPerformed=false`
- `actualReleaseGateModeChanged=false`
- `actualDeploymentMutationPerformed=false`
- `releaseAuthorized=false`
- `mergeAuthorized=false`
- `deploymentAuthorized=false`
- `goLiveAuthorized=false`
- `transactionAuthorized=false`

The proposed registry embedded in the contract describes a *future post-activation file state* and therefore contains `activationApplied=true` and `canonicalBaselineChanged=true` inside that proposed payload only. The outer P39 evidence remains `activationApplied=false` and `canonicalBaselineChanged=false` until a separate explicitly reviewed and human-authorized code change is actually made.

## Remaining requirements before any real activation

P39 does not replace the pending independent reviewer, does not constitute human activation approval, does not update the P33 release-gate implementation to accept schema version 2, and does not perform post-activation Release Verify. Those remain separate mandatory steps.

`سعيد المراجع` remains only the current mutable workflow designation until a real independently signed review is accepted and P30 locks the reviewer lifecycle.
