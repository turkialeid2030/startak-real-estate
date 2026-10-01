# C24 — Integrated Case / Property Orchestration

## Purpose
C24 implements the P1 integration layer from issue #521. It does not replace underlying engines or recalculate their domain logic. It composes already governed stage outputs into one deterministic case/property state.

## Canonical stage states
- `READY`
- `HOLD`
- `NOT_EVALUATED`

Overall precedence is fixed: any required HOLD wins; otherwise any required NOT_EVALUATED wins; only complete required READY coverage reaches `READY_FOR_HUMAN_CASE_REVIEW`.

AI stages have no special voting power and cannot upgrade an upstream deterministic HOLD or NOT_EVALUATED state.

## Full-stack stage registry
The orchestration registry covers source/provenance, geospatial, market/comparables, valuation/reconciliation, correlated scenario risk, title/survey/property, urban code/plot, market/liquidity, income asset, regulatory carry cost, encumbrance/closing, financing, rental regulation, auction acquisition, raw-land optionality, subdivision/merge, policy shock, urban growth/accessibility, listing/amenity, generative intelligence and the governed AI provider gateway.

## Stage packet
Each packet exact-binds case/property/market scope, capability reference, stage state, input/output SHA-256, lineage hashes, blockers, risk flags and validity time. Authority fields must be false. Packet SHA-256 protects integrity.

## Policy
The orchestration policy declares required and optional stages and exact allowed capability references for each stage. This prevents an unqualified engine output from being substituted into a qualified stage.

## Replay safety
The orchestration result exposes an input fingerprint and result SHA-256. Same execution ID + same fingerprint + same result is an idempotent replay. Reuse of an execution ID with a different fingerprint is a conflict and must not be silently accepted.

## Fail-closed behavior
Missing required stages, duplicate stage IDs, tampered packets, cross-case/property scope, stale/future packets, unapproved capability references and authority injection produce HOLD. Domain HOLD reasons are preserved in the aggregate blocker list and full audit lineage.

## Authority boundary
C24 grants no transaction, approval, Public AI, autonomous action, production deployment or Commercial Go-Live authority. `MERGE HOLD = ON` and `DEPLOY = NO` remain in force.
