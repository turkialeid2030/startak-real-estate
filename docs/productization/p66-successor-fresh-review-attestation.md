# P66 — Successor Fresh Review Attestation

## Purpose

P66 cryptographically verifies the independent-review decision for the exact P65 successor-cycle review packet. It introduces no activation or release authority.

## Trust boundary

The reviewer trust registry is supplied externally and pinned by an independently supplied deterministic SHA-256. Each reviewer record binds reviewer identity, RSA public key hash, governance evidence, allowed purpose and active interval.

P66 rejects private/secret key material and never signs on behalf of a reviewer. It can prepare the deterministic RSA-SHA256 signing payload or verify an externally supplied signature.

## Packet validation

Before accepting a signature, P66 recomputes both the P65 reviewer-designation hash and the complete P65 review-packet hash. The packet must still represent an unapproved review handoff, with reviewer identity/trust unresolved, predecessor authority rejected, reactivation false and release blocked.

## Decisions

Only two values are accepted:

- `APPROVE_SUCCESSOR_FRESH_REACTIVATION_REVIEW`
- `REJECT_SUCCESSOR_FRESH_REACTIVATION_REVIEW`

The signing payload is bound to the exact successor cycle, reviewer designation, current legacy logical/content hashes, qualified commit, release artifact, environment configuration, predecessor incident/human/reset hashes and RCA/CAPA hashes.

Approval produces:

`SUCCESSOR_FRESH_REVIEW_APPROVED_CRYPTOGRAPHICALLY_VERIFIED`

Rejection produces:

`SUCCESSOR_FRESH_REVIEW_REJECTED_CYCLE_BLOCKED`

Approval is review evidence only. A successor reviewer lifecycle lock and a later fresh activation plan remain required. Rejection blocks the current successor cycle.

## Operator

`tools/successor-fresh-review-attestation.js` supports `prepare` and `verify`, reads bounded regular JSON, rejects symlinks and private/secret-key arguments, and performs no mutation.

## Evidence limits

Regression tests use synthetic RSA keys and synthetic governance evidence. They prove implementation behavior only; they do not establish a real reviewer identity, real human approval, production evidence, release authority, reactivation authority or permission to merge/deploy/go live.

All release, merge, deployment, go-live, transaction, reactivation and canonical-baseline mutation authority remains false.
