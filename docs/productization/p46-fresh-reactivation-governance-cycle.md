# P46 — Fresh Reactivation Governance Cycle

P46 opens a new governance envelope only after P45 has cryptographically verified a human `CLOSE_INCIDENT` decision for the exact P44 closeout packet.

It does **not** reactivate the governed-composite baseline, reuse any authority from the failed activation cycle, merge, deploy, go live or authorize transactions.

## Required P45 state

P46 accepts only:

`INCIDENT_CLOSED_BY_VERIFIED_HUMAN_DECISION_REACTIVATION_BLOCKED`

The P45 result must retain:

- verified human closeout decision;
- verified incident-authority identity/trust-root/signature;
- `incidentClosed=true`;
- `reactivationAllowed=false`;
- prior activation authorization non-reusable;
- prior reviewer approval non-reusable;
- failed activation cycle historical only;
- release/merge/deployment/go-live/transaction authority false.

P46 re-hashes both the P45 human-decision record and governance-reset record. Tampering or broken cross-binding fails closed.

## Current baseline prerequisite

The observed canonical registry must still be the confirmed `LEGACY_FILE_SHA256` baseline and its deterministic registry hash must equal the legacy registry restored and recorded by P45.

P46 never mutates `config/governance/canonical-baseline.json`.

## Fresh cycle scope

The new cycle envelope binds:

- a new cycle ID;
- cycle owner actor reference;
- preparation timestamp after incident closure;
- requested target mode `GOVERNED_COMPOSITE_BASELINE`;
- exact qualified Git commit SHA;
- release-artifact SHA-256;
- environment-config SHA-256;
- rationale reference;
- cycle evidence artifact SHA-256;
- P45 human-decision and governance-reset hashes;
- current authoritative legacy registry hash.

The resulting cycle envelope has a deterministic SHA-256.

## Explicit non-reuse boundary

P46 rejects attempts to carry forward old values such as:

- reviewer lock / reviewer approval hashes;
- activation plan hash;
- owner activation authorization hash;
- cutover safety hash;
- activation change contract hash.

Those artifacts remain historical evidence only.

## Highest state

`FRESH_REACTIVATION_GOVERNANCE_CYCLE_OPEN_NOT_AUTHORIZED`

This state means only that a clean governance envelope has been opened. It explicitly requires new:

- independent reviewer designation;
- independent review;
- reviewer lifecycle lock;
- activation plan;
- cutover-safety evidence;
- owner activation authorization;
- activation change contract;
- post-activation Release Verify.

No one of these requirements is satisfied by P46 itself.

## Operator

`tools/fresh-reactivation-governance-cycle.js` reads bounded regular JSON for P45, the current canonical registry and fresh cycle scope. It rejects symlinks, duplicate/unknown/private-key arguments and writes restrictive JSON output where requested.

## Authority boundary

P46 always keeps:

- `reactivationAuthorized=false`;
- `incidentClosureTreatedAsReleaseAuthorization=false`;
- `currentBaselineMutationPerformed=false`;
- `releaseStillBlocked=true`;
- all release/merge/deployment/go-live/transaction authority flags false.
