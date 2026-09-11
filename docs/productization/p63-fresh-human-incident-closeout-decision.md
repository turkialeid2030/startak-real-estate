# P63 — Fresh Human Incident Closeout Decision & Governance Reset

## Purpose

P63 consumes only a P62 `FRESH_POST_ROLLBACK_RELEASE_VERIFY_EVIDENCE_CONSISTENT_INCIDENT_CLOSEOUT_READY` result. It creates an unsigned external-signing package or verifies an externally signed RSA-SHA256 human incident-closeout decision against a separately pinned incident-authority trust registry.

It does not treat CI, an automation result, or the P62 closeout-ready packet as a human decision.

## Required closeout boundary

The P62 packet must prove the exact P57 legacy rollback image was restored after a P61-triggered P60 rollback, the rollback trigger and execution were verified, post-rollback Release Verify evidence was internally consistent, the incident is still open, and the failed fresh activation cycle is non-reusable.

P63 recomputes the P62 closeout packet hash from its exact cycle, contract, activation receipt, rollback trigger, rollback receipt, restored-registry hashes, Release Verify evidence and rollback reason codes. Tampered packets fail closed.

## Human authority and signature

The incident authority is resolved only from a caller-supplied trust registry whose deterministic SHA-256 must equal an independently supplied expected registry hash. Each authority record binds actor identity, RSA public key hash, governance evidence, validity interval and the exact purpose `FRESH_INCIDENT_CLOSEOUT_DECISION`.

Private or secret signing-key material is rejected. P63 prepares deterministic signing bytes but never signs on behalf of the incident authority.

The human decision supports only:

- `KEEP_INCIDENT_OPEN`
- `CLOSE_INCIDENT`

The closeout preparer and approving incident authority must differ. Closing the incident additionally requires root-cause-analysis and corrective/preventive-action references plus their SHA-256 digests.

## Governance reset semantics

A cryptographically verified close decision produces a deterministic governance-reset record that marks the failed fresh activation cycle historical and non-reusable. Prior fresh reviewer approval, owner authorization, activation plan, activation contract and rollback trigger remain non-reusable.

Incident closure does **not** reactivate the composite baseline. A new governance cycle, new independent review, new activation plan and new owner authorization remain required.

## Highest states

- `READY_FOR_EXTERNAL_FRESH_INCIDENT_AUTHORITY_SIGNATURE`
- `FRESH_INCIDENT_REMAINS_OPEN_HUMAN_DECISION_VERIFIED`
- `FRESH_INCIDENT_CLOSED_BY_VERIFIED_HUMAN_DECISION_GOVERNANCE_RESET_REACTIVATION_BLOCKED`

All release, merge, deployment, go-live and transaction authority fields remain false in every state.

## Operator

`tools/fresh-human-incident-closeout-decision.js` supports `prepare` and `verify` modes, reads bounded regular JSON, rejects symlinks and unknown/duplicate/private-key arguments, and may write a restrictive-permission JSON result. It performs no repository, registry, infrastructure or deployment mutation.

## Evidence limits

Tests use synthetic RSA keys and synthetic P62 closeout-ready evidence. They demonstrate implementation behavior only. They do not establish a real incident, real RCA/CAPA content, real external incident-authority identity, real human signature, production qualification, release authority or permission to merge/deploy/go live.
