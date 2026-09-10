# P45 — Human Incident Closeout Attestation

P45 closes the rollback-incident lifecycle after P44 has proved exact legacy restoration and prepared a human closeout packet.

It does **not** reactivate the failed governed-composite baseline, authorize release, merge, deployment, go-live, or any transaction.

## Required prerequisite

P45 accepts only a P44 result with status:

`POST_ROLLBACK_RELEASE_VERIFY_EVIDENCE_CONSISTENT_INCIDENT_CLOSEOUT_READY`

The P44 closeout packet is re-hashed from its deterministic core. P45 rejects packet tamper, missing restoration evidence, authority escalation, or any state that already claims automatic closeout or reactivation.

## Human decisions

The trusted closeout authority may sign one of three decisions:

- `CLOSE_INCIDENT` — requires explicit root-cause, corrective-action, and lessons-learned references.
- `KEEP_INCIDENT_OPEN` — requires a next-review reference.
- `ESCALATE_INCIDENT` — requires an escalation reference.

Every decision is bound to the exact P44 packet, activation contract, activation receipt, rollback trigger, rollback execution receipt, restored legacy registry hash, and post-rollback Release Verify evidence hash.

## Trust model

The decision authority is supplied through an out-of-band registry containing the authority identity, public key, public-key SHA-256 fingerprint, active period, governance evidence reference, and allowed purpose.

The expected registry SHA-256 is supplied separately. P45 accepts only `RSA-SHA256` signatures and never accepts a private signing key.

Purpose is fixed to:

`CANONICAL_BASELINE_ROLLBACK_INCIDENT_CLOSEOUT`

## States

Preparation produces at most:

`READY_FOR_EXTERNAL_INCIDENT_CLOSEOUT_SIGNATURE`

Verification produces either:

- `INCIDENT_CLOSED_REACTIVATION_REQUIRES_NEW_GOVERNANCE_CYCLE`, or
- `INCIDENT_REMAINS_OPEN_BY_HUMAN_DECISION`.

Even the closed state preserves:

- `reactivationAllowed=false`
- `reactivationRequiresNewGovernanceCycle=true`
- `releaseStillBlocked=true`
- `releaseAuthorized=false`
- `mergeAuthorized=false`
- `deploymentAuthorized=false`
- `goLiveAuthorized=false`
- `transactionAuthorized=false`

Closing the incident record is therefore not equivalent to authorizing a new activation.

## Operator

`tools/human-incident-closeout-attestation.js` supports `prepare` and `verify` modes, rejects private-key arguments, symlinked evidence and oversized JSON, and writes only attestation evidence. It performs no registry mutation.

## Evidence boundary

P45 verifies the signature and deterministic evidence binding. It does not establish the substantive truth of root-cause/corrective-action documents, authenticate external CI provenance, or substitute for the still-pending independent reviewer and existing release-governance process.
