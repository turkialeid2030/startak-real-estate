# P37 — Composite Baseline Cutover Rehearsal

## Purpose

P37 rehearses the future canonical-baseline transition without changing the active registry, Release Verify mode, deployment state or any production authority.

The modeled sequence is:

`LEGACY_FILE_SHA256 -> GOVERNED_COMPOSITE_BASELINE -> LEGACY_FILE_SHA256`

The exercise is deliberately simulation-only. It exists to verify that the cutover/rollback state transition is internally coherent before any real activation change is considered.

## Preconditions

P37 requires:

- the current P32 registry to remain the confirmed `LEGACY_FILE_SHA256` baseline;
- a valid P36 result with status `SHADOW_COMPOSITE_BASELINE_MATCH_NOT_ACTIVE`;
- exact binding between the P36 shadow result and the current registry hash;
- deterministic P36 shadow-evaluation hash integrity;
- all activation/release/merge/deployment/go-live/transaction authority flags to remain false.

## Rehearsed states

1. **Initial authoritative state** — the exact current legacy registry hash is captured.
2. **Simulated cutover state** — the governed-composite candidate, P34 evidence, activation-plan and successor-manifest hashes are represented as a non-authoritative simulated state.
3. **Simulated rollback state** — the model returns to `LEGACY_FILE_SHA256` and must reproduce the exact initial authoritative registry hash.

A successful rehearsal therefore proves only that the modeled rollback returns to the exact starting registry identity.

## Highest result

`CUTOVER_REHEARSAL_COMPLETED_NO_ACTIVATION`

This means the transition model and rollback identity are coherent. It does **not** mean the governed-composite baseline is active or approved for activation.

## Fail-closed conditions

P37 holds if the current registry is no longer the confirmed legacy state, if P36 shadow evidence is missing/tampered, if authority flags are escalated, if P36 hashes no longer recompute, or if required rehearsal metadata is invalid.

## Non-claims

P37 does not:

- mutate `config/governance/canonical-baseline.json`;
- change the Release Verify baseline mode;
- deploy or modify infrastructure;
- close the unavailable historical canonical-source evidence;
- satisfy external E2I evidence;
- replace the required independent review;
- authorize release, merge, deployment, go-live or transactions.

The independent reviewer remains externally required for any real activation path. The owner may still replace the current placeholder reviewer designation before an accepted independent review.
