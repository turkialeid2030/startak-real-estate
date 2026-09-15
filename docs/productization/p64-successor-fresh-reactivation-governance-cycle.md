# P64 — Successor Fresh Reactivation Governance Cycle

## Purpose

P64 opens a new governance envelope after a P63 human closeout of a failed fresh activation cycle. It is deliberately stricter than simply accepting a P63 status flag: the P63 closeout is recomputed from the P62 packet, the externally signed incident decision, and the pinned incident-authority trust registry before any successor cycle can be opened.

## Preconditions

P64 requires:

- a valid P62 fresh post-rollback closeout-ready packet;
- a supplied P63 close decision matching a fresh recomputation from the same P62 packet and external incident-authority evidence;
- the canonical baseline still confirmed as `LEGACY_FILE_SHA256`;
- the current logical registry hash and exact raw-content SHA-256 to match the P62 restored legacy baseline;
- a successor cycle ID distinct from the failed fresh cycle;
- a preparation time at or after the verified P63 closeout decision;
- a fresh qualified source commit, release-artifact digest, environment-config digest, rationale reference and cycle-evidence digest.

## Non-reuse enforcement

The successor cycle rejects embedded prior fresh reviewer designation/lock evidence, prior review-record hashes, prior activation-plan and cutover-safety hashes, prior owner-authorization records, prior activation contracts, activation execution receipts, rollback triggers and rollback execution receipts.

The P63 RCA and CAPA hashes are bound into the successor cycle hash, together with the P62 closeout packet and P63 governance-reset hashes. This preserves traceability to the failed cycle without converting any prior authority into current-cycle authority.

## Result

The highest state is:

`SUCCESSOR_FRESH_REACTIVATION_GOVERNANCE_CYCLE_OPEN_NOT_AUTHORIZED`

It means only that a successor governance envelope is validly opened. It requires a fresh independent reviewer designation, independent review, reviewer lifecycle lock, activation plan, shadow evidence, cutover rehearsal, safety evidence, owner authorization, activation contract and post-activation Release Verify.

All release, merge, deployment, go-live, transaction, reactivation and canonical-baseline mutation authority remains false.

## Operator

`tools/successor-fresh-reactivation-governance-cycle.js` consumes P62/P63 evidence, the incident-authority trust registry and signed decision, the exact current canonical registry bytes, and a successor-cycle scope. Inputs are bounded regular files; symlinks and private/secret key arguments are rejected. The operator performs no mutation.

## Evidence limits

Regression tests use synthetic human-signature evidence and do not establish a real external incident authority, production incident, production closeout, release authority or permission to activate, merge, deploy or go live.
