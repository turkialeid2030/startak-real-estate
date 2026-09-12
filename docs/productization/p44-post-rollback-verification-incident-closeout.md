# P44 — Post-Rollback Verification & Incident Closeout Gate

P44 is a fail-closed qualification boundary after a P43-triggered rollback has actually been applied through the controlled P42 rollback executor.

It does **not** perform rollback, close an incident automatically, restore release authority, merge, deploy, go live, or authorize transactions.

## Required chain

P44 requires all of the following to be mutually consistent:

1. the P39 activation-change contract;
2. the original P42 applied activation receipt;
3. a P43 `ROLLBACK_TRIGGERED_PREBOUND_LEGACY_ONLY` decision and intact rollback-trigger hash;
4. a P42 `ROLLBACK_APPLIED_REQUIRES_POST_CHANGE_RELEASE_VERIFY` receipt;
5. the observed registry restored to the exact P39 prebound legacy object and hashes;
6. supplied post-rollback Release Verify evidence reporting PASS for the release gate, regression, build, package verification and npm-audit threshold, with `activeMode=LEGACY_FILE_SHA256` and the exact P39 rollback registry hash.

The post-rollback Release Verify completion timestamp must not precede the rollback execution timestamp.

## States

- `HOLD_POST_ROLLBACK_VERIFICATION` — required chain evidence is malformed, missing or cryptographically/hash inconsistent.
- `POST_ROLLBACK_VERIFICATION_FAILED_INCIDENT_OPEN` — rollback restoration or supplied post-rollback verification evidence failed; the incident remains open and release remains blocked.
- `POST_ROLLBACK_RELEASE_VERIFY_EVIDENCE_CONSISTENT_INCIDENT_CLOSEOUT_READY` — exact legacy restoration and supplied Release Verify evidence are internally consistent; a deterministic incident-closeout packet is ready for human handling.

The success state deliberately means **closeout-ready**, not **incident closed**. It sets:

- `incidentCloseoutReady=true`
- `incidentClosed=false`
- `humanIncidentCloseoutRequired=true`
- `automaticIncidentCloseoutPerformed=false`
- `reactivationAllowed=false`
- `reactivationRequiresNewGovernanceCycle=true`
- all release/merge/deployment/go-live/transaction authority flags to `false`.

## Evidence boundary

P44 structurally normalizes and hashes supplied Release Verify evidence. It does not independently authenticate GitHub Actions or another CI provider. External evidence authenticity remains outside this local code boundary.

## Operator CLI

`tools/post-rollback-canonical-baseline-verification.js` accepts bounded regular JSON inputs for the P39/P42/P43 chain, observed registry and post-rollback Release Verify evidence. It rejects symlink inputs, unknown arguments and private-key arguments, and writes only a verification/closeout-readiness record.

It never mutates `config/governance/canonical-baseline.json`.

## Release semantics

Even after successful P44 verification, the system remains governance-blocked. A later reactivation cannot reuse the failed activation as implicit authority; it requires a new governed activation cycle and the existing release-governance process.
