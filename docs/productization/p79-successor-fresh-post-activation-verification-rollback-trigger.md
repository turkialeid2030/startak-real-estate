# P79 — Successor Fresh Post-Activation Verification & Rollback Trigger

## Purpose

P79 evaluates the state immediately after a future applied P78 successor schema-v4 activation. It binds the applied P78 receipt to the actually observed canonical registry, re-runs P76 against that observed state, and evaluates caller-supplied P77-style post-change Release Verify evidence.

P79 never mutates the registry. When a failure requires rollback it emits only a deterministic trigger restricted to the exact P75 legacy rollback image.

## Required activation receipt

Only an applied, post-write-P76-verified P78 activation receipt is accepted. A dry-run receipt, rollback receipt, hash-tampered receipt or receipt whose P75/cycle/reviewer/plan/candidate/safety/owner/prior/target bindings drift is rejected.

The P78 receipt hash is recomputed from its deterministic execution core plus the exact P75 target logical/content hashes and the successful P76 post-write verification state.

## Observed schema-v4 verification

P79 requires the actual observed registry object and raw content after activation. It re-runs P76 with the full successor evidence chain:

- P75 activation change contract
- P65 successor review packet
- P67 reviewer lifecycle lock
- P68 activation plan
- P69 schema-v4 candidate
- P71 shadow result
- P72 rehearsal
- P73 safety guard
- P74 owner authority registry, pinned registry hash and externally signed owner decision

The observed logical hash, content SHA-256 and exact raw bytes must match the P75 proposed registry.

## Post-change Release Verify evidence

When the observed schema-v4 registry passes P76 but no Release Verify evidence is supplied, P79 returns HOLD. Absence of evidence is not treated as an automatic rollback failure.

Supplied evidence is normalized and checked for:

- Release Verify overall PASS
- regression PASS
- production build PASS
- package verification PASS
- npm audit threshold PASS
- canonical baseline registry verification PASS
- active mode `GOVERNED_COMPOSITE_BASELINE`
- registry schema version 4
- P77 verification mode `SUCCESSOR_FRESH_GOVERNED_COMPOSITE_WITH_REVERIFIED_OWNER_AUTHORIZATION`
- exact observed registry logical/content hashes
- exact qualified source commit from P68
- completion after the P78 activation execution timestamp

P79 checks internal consistency only. It does not independently authenticate the provenance of the supplied CI evidence, so `releaseVerifyEvidenceAuthenticityVerifiedHere=false` and `productionEvidenceEstablishedHere=false` remain explicit.

## Rollback trigger

If the observed registry fails P76, differs from the exact P75 target, or supplied Release Verify evidence fails/mismatches, P79 emits:

`SUCCESSOR_FRESH_ROLLBACK_TRIGGERED_P75_PREBOUND_LEGACY_ONLY`

The trigger binds:

- the P78 activation receipt hash;
- P75 activation-change-contract hash;
- successor cycle ID;
- observed schema-v4 logical/content hashes;
- exact P75 rollback logical/content hashes;
- deterministic reason codes.

Automatic rollback mutation is prohibited. The trigger requires P78 controlled rollback execution followed by a separate post-rollback Release Verify.

## Success state

When the applied P78 receipt, observed P76-verified schema-v4 state and supplied P77-style Release Verify evidence are internally consistent, the highest state is:

`SUCCESSOR_FRESH_POST_ACTIVATION_RELEASE_VERIFY_EVIDENCE_CONSISTENT_GOVERNANCE_BLOCKED`

This remains governance-blocked. Release, merge, deployment, go-live and transaction authority all remain false.

## Regression evidence limitation

Regression uses synthetic successor governance evidence and ephemeral RSA fixtures. The applied P78 receipt used by the P79 regression is created through an in-memory writer only. No checked-in canonical registry is modified and no real external owner approval or production Release Verify evidence is established.

## Non-claims

P79 does not authenticate external CI infrastructure, grant release authority, deploy, merge, go live, perform transactions or execute rollback automatically.
