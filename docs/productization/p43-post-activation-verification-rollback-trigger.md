# P43 — Post-Activation Verification & Prebound Rollback Trigger

## Purpose

P43 closes the safety gap after a future P42 governed-composite registry mutation. It binds the applied P42 activation receipt, the observed active registry, P40 verification, and supplied post-change Release Verify evidence. A failure creates a deterministic rollback trigger limited to the exact legacy registry already prebound in P39.

## Outcomes

- `HOLD_POST_ACTIVATION_VERIFICATION` — evidence is missing, malformed, or the P42 execution receipt cannot be trusted.
- `POST_ACTIVATION_RELEASE_VERIFY_EVIDENCE_CONSISTENT_GOVERNANCE_BLOCKED` — the observed composite registry and supplied Release Verify evidence are mutually consistent. Release governance remains required.
- `ROLLBACK_TRIGGERED_PREBOUND_LEGACY_ONLY` — the observed post-activation state or supplied Release Verify result failed and rollback is required.

## Rollback safety

The generated rollback trigger contains the P42 execution-receipt hash, P39 activation-contract hash, observed composite-registry hash, exact rollback logical hash, exact rollback content hash, and deterministic reason codes. It cannot select any other rollback state.

P43 does **not** mutate the registry automatically. `automaticRollbackMutationAllowed=false`. The rollback must still pass through the controlled P42 rollback executor and must be followed by another Release Verify.

## Release Verify evidence boundary

P43 structurally validates and hashes the supplied Release Verify evidence, including the run reference, source commit, completion time, registry mode/hash, regression/build/package/audit outcomes and evidence-artifact digest. P43 does not itself authenticate the external CI artifact; `releaseVerifyEvidenceAuthenticityVerifiedHere=false` remains explicit.

## Authority boundary

A successful P43 result does not grant release, merge, deployment, go-live or transaction authority. A rollback trigger also grants no such authority. The repository baseline remains unchanged by this productization slice.

The independent reviewer remains pending. `سعيد المراجع` is still only the owner-designated mutable workflow reviewer until a real accepted independent review establishes the upstream reviewer lock required for real P31/P38/P39 evidence.
