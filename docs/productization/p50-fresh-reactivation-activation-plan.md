# P50 — Fresh Reactivation Activation Plan

P50 creates a deterministic fresh activation plan only from the cycle-specific P49 reviewer lifecycle lock and the exact P47 review packet.

It is not an activation. It does not authorize reactivation, change the canonical baseline, merge, deploy, go live or authorize transactions.

## Required chain

P50 requires:

1. the exact valid P47 review packet;
2. P49 `FRESH_REACTIVATION_REVIEWER_LOCKED_BY_VERIFIED_REVIEW`;
3. a valid P49 lock hash;
4. exact cycle/reviewer/registry/commit/artifact/config binding between P47 and P49;
5. plan preparation by the fresh-cycle owner;
6. plan preparation after the P49 reviewer lock;
7. no prior-cycle reviewer, activation-plan, owner-authorization, cutover or activation-contract artifact reuse.

## Highest state

`FRESH_REACTIVATION_ACTIVATION_PLAN_READY_NOT_AUTHORIZED`

The plan prepares a `freshSuccessorBaselineManifest` bound to:

- fresh governance cycle;
- exact qualified Git commit;
- release-artifact SHA-256;
- environment-config SHA-256;
- exact current legacy registry hash;
- P47 review packet;
- fresh reviewer designation;
- P49 reviewer lifecycle lock;
- P48 verified review record.

The target activation contract remains `LEGACY_FILE_SHA256 -> GOVERNED_COMPOSITE_BASELINE`, but no baseline switch occurs in P50.

## Remaining mandatory steps

P50 explicitly keeps these requirements open:

- fresh shadow evidence;
- fresh cutover rehearsal;
- fresh cutover safety evidence;
- fresh owner activation authorization;
- fresh explicit activation change contract;
- post-change Release Verify.

All release/merge/deployment/go-live/transaction authority remains false.

## Operator CLI

`tools/fresh-reactivation-activation-plan.js` reads bounded regular JSON, rejects symlink inputs, unknown/duplicate/private-key arguments and writes restrictive output where supported.

**Keep Draft. Do not merge or deploy.**
