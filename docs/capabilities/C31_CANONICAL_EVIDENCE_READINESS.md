# C31 — Canonical Evidence Readiness

## Purpose
C31 consolidates the five canonical activation/source checks that remain outside the C30 external-evidence pack. It does not invent, generate, approve, or activate canonical evidence.

## Required gates
1. `COMPOSITE_BASELINE_SHADOW`
2. `FRESH_COMPOSITE_SHADOW`
3. `SUCCESSOR_FRESH_COMPOSITE_SHADOW`
4. `COMPOSITE_CUTOVER_SAFETY`
5. `CANONICAL_SOURCE_HASH`

The exact file/environment inputs are recorded in `release/evidence/c31-canonical-evidence-input-map.json` and are consumed by the existing gate implementations.

## Readiness states
C31 intentionally exposes no automatic `GO` state.

- `HOLD_CANONICAL_INPUTS_REQUIRED`: one or more real inputs are absent / not evaluated.
- `NO_GO_CANONICAL_REMEDIATION_REQUIRED`: supplied inputs caused a governed HOLD or canonical-source hash mismatch.
- `CANONICAL_EVIDENCE_COMPLETE_AWAITING_INDEPENDENT_ACTIVATION_DECISION`: all five gate results are verified, but activation remains a separate independent decision.

## Authority boundary
Every C31 output keeps these false:
- canonical baseline activation authorization;
- release-decision authorization;
- merge authorization;
- deployment authorization;
- commercial go-live authorization;
- transaction authority;
- approval authorization;
- Public AI authorization.

Synthetic test fixtures only verify classification semantics. They are not evidence and cannot be promoted into a real readiness record.

## Current real state
At this engineering handoff, none of the five real canonical input sets has been supplied to qualification. Therefore the current result must remain `HOLD_CANONICAL_INPUTS_REQUIRED`.

## Relationship to C30
C31 does not replace or satisfy the eight C30 external gates. C30 external evidence and C31 canonical evidence are independent prerequisite families. Completion of one family cannot override a HOLD or NO-GO in the other.
