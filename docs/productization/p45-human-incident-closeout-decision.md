# P45 — Human Incident Closeout Decision & Governance Reset

P45 is the human decision boundary immediately after P44 has verified exact rollback to the legacy canonical baseline and prepared an incident-closeout packet.

It does **not** merge, deploy, reactivate the governed-composite baseline, grant release authority, or treat incident closure as release authorization.

## Required P44 state

P45 accepts only:

`POST_ROLLBACK_RELEASE_VERIFY_EVIDENCE_CONSISTENT_INCIDENT_CLOSEOUT_READY`

The P44 result and embedded closeout packet must still prove:

- exact P39 legacy baseline restoration;
- internally consistent post-rollback Release Verify evidence;
- `incidentCloseoutReady=true`;
- `incidentClosed=false` before the human decision;
- `humanIncidentCloseoutRequired=true`;
- `reactivationAllowed=false`;
- all release/merge/deployment/go-live/transaction authority flags remain false.

P45 independently re-hashes the deterministic P44 incident-closeout packet core and rejects packet/result hash drift.

## Human decision

Exactly two decision values are accepted:

- `CLOSE_INCIDENT`
- `KEEP_INCIDENT_OPEN`

A close decision requires both a Root Cause Analysis reference/hash and a Corrective/Preventive Action reference/hash. A keep-open decision may omit them.

The decision is cryptographically bound to the exact P44 packet and its historical activation/rollback chain, including the activation contract, activation execution receipt, rollback trigger, rollback execution receipt, restored legacy registry hash and post-rollback Release Verify evidence hash.

## Independent incident-closeout authority

P45 uses a dedicated incident-authority registry with:

- incident authority ID;
- actor reference;
- RSA public key and pinned SHA-256;
- governance evidence reference;
- active period;
- fixed allowed purpose `INCIDENT_CLOSEOUT_DECISION`.

The registry itself is hashed and must match an externally supplied expected trust-root SHA-256. The signing private key is never accepted by repository code or the operator CLI.

The P44 closeout preparer cannot approve the same incident closeout. This enforces separation of duties between preparation and human incident closure.

## Signing flow

The operator supports two modes:

1. `prepare` — validates P44, authority trust root and decision scope, then emits deterministic signing bytes and an unsigned attestation package.
2. `verify` — verifies an externally produced RSA-SHA256 signature against the pinned incident authority registry.

## Highest states

For a verified keep-open decision:

`INCIDENT_REMAINS_OPEN_HUMAN_DECISION_VERIFIED`

For a verified close decision:

`INCIDENT_CLOSED_BY_VERIFIED_HUMAN_DECISION_REACTIVATION_BLOCKED`

Even after verified human closure:

- `incidentClosed=true`;
- `automaticIncidentCloseoutPerformed=false`;
- `reactivationAllowed=false`;
- `previousActivationAuthorizationReusable=false`;
- `previousReviewerApprovalReusable=false`;
- `failedActivationCycleReusable=false`;
- `newGovernanceCycleRequired=true`;
- `newActivationPlanRequired=true`;
- `newOwnerAuthorizationRequired=true`;
- `newIndependentReviewRequired=true`;
- `releaseStillBlocked=true`;
- every release/merge/deployment/go-live/transaction authority flag remains false.

## Governance reset record

A verified human decision produces a deterministic governance-reset record that marks the failed activation cycle as historical only and binds the old P39/P42/P43/P42 chain to the restored legacy baseline.

The reset record deliberately prevents reusing the prior activation authorization or prior reviewer approval for a future reactivation. Any later reactivation must begin a new governed cycle from the repository's then-current state.

## Evidence boundary

P45 verifies the signed decision metadata and its binding to a pinned authority trust root. It does not independently validate the substantive contents of the external RCA, CAPA, governance artifact or decision artifact; those remain external evidence responsibilities.

## Operator safety

`tools/human-incident-closeout-decision.js`:

- reads bounded regular JSON only;
- rejects symlinks;
- rejects duplicate/unknown arguments;
- rejects private-key arguments;
- writes output with restrictive permissions where supported;
- never mutates `config/governance/canonical-baseline.json`;
- never merges, deploys, goes live or authorizes transactions.
