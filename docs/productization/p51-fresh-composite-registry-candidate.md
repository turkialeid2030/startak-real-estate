# P51 — Fresh Composite Registry Candidate

P51 prepares the fresh governed-composite canonical-registry candidate from the exact P50 fresh activation plan while keeping the currently authoritative registry unchanged in `LEGACY_FILE_SHA256` mode.

## Required chain

P51 requires a valid P50 `FRESH_REACTIVATION_ACTIVATION_PLAN_READY_NOT_AUTHORIZED` result and re-hashes both its fresh successor-baseline manifest and complete deterministic plan core. It also re-verifies the observed current registry through the existing strict legacy registry evaluator and requires the observed registry hash to equal the exact P50 expected-prior hash.

Prior-cycle activation-plan, owner-authorization, cutover-safety and activation-contract evidence is rejected rather than inherited.

## Candidate schema

The future candidate is deliberately emitted as **schema version 3** with `activeMode=GOVERNED_COMPOSITE_BASELINE` and explicit bindings to the fresh governance cycle, P49 reviewer lifecycle lock and P50 activation plan.

The schema-v3 choice is fail-closed: the existing active-registry verifier must not silently accept the new candidate. A later reviewed fresh-mode verifier/change is required before any activation can be considered.

P51 computes both:

- deterministic logical candidate-registry SHA-256;
- exact canonical UTF-8 JSON-content SHA-256.

## Highest state

`FRESH_COMPOSITE_REGISTRY_CANDIDATE_READY_NOT_ACTIVE`

The proposed registry represents a possible future post-activation state, but the P51 outer result always keeps:

- `candidateOnly=true`;
- `activeRegistryChanged=false`;
- `activationAuthorized=false`;
- `activationApplied=false`;
- `reactivationAuthorized=false`;
- `currentBaselineMutationPerformed=false`;
- `releaseStillBlocked=true`;
- all release/merge/deployment/go-live/transaction authority flags false.

## Remaining mandatory steps

P51 requires later fresh composite evidence verification, shadow verification, cutover rehearsal, cutover-safety evidence, owner activation authorization, an explicit activation-change contract and post-change Release Verify.

## Operator CLI

`tools/fresh-composite-registry-candidate.js` reads bounded regular JSON, rejects symlink inputs, unknown/duplicate/private-key arguments and writes restrictive JSON output where supported.

It never writes `config/governance/canonical-baseline.json`.

**Keep Draft. Do not merge or deploy.**
