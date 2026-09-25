# Financial Integrity P1 — Assumption Governance Integration — 2026-09-25

## Purpose

P1 wires the evidence-backed Assumption Registry introduced in P0 into the persisted Saved Deal envelope and the canonical `ExecutableInvestmentCase` without changing deterministic economic inputs or rewriting historical records.

This wave is intentionally additive and fail-closed. It does **not** establish certified valuation authority, lender approval, transaction authority, legal/tax advice, or commercial Go-Live.

## Controls implemented

1. **Saved Deal governance metadata**
   - Adds optional top-level `assumptionRegistry` metadata.
   - Adds deterministic version metadata: `SAVED_DEAL_ASSUMPTION_REGISTRY_V1`.
   - Keeps the legacy Saved Deal core valid when the registry is absent.
   - Prohibits assumption-registry metadata from being embedded inside `inputs`.

2. **Persistence versus decision semantics**
   - Structural persistence validation checks shape, field types, uniqueness and versioning.
   - Stale or unsupported assumption evidence remains loadable so historical records can be audited and remediated.
   - Decision-time evaluation is separate and may return `PASS`, `REVIEW`, or `HOLD`.

3. **Canonical case integration**
   - The legacy Saved Deal adapter evaluates the persisted registry when present.
   - The evaluated assumptions are carried into the canonical `assumptions` section.
   - Registry hash, blockers and warnings are carried into `governance`.
   - Unsupported or stale critical assumptions force the canonical `decision.status` to `HOLD` while preserving the deterministic financial engine result for audit.
   - Warning-only registries produce `REVIEW_REQUIRED` rather than an automatic investment decision.

4. **No economic mutation**
   - Assumption governance metadata does not rewrite `inputs`.
   - It does not alter NPV, IRR, NOI, verdict calculations or leverage calculations.
   - It does not auto-migrate legacy records.

## Fail-closed behavior

A critical assumption with missing evidence or expired evidence can be persisted, but cannot advance the governed decision:

- `governance.status = HOLD`
- `governance.failClosed = true`
- `decision.status = HOLD`
- the original deterministic engine result remains visible for audit only.

This distinction prevents two failure modes:

- destroying historical evidence merely because it is stale; and
- allowing stale/unsupported evidence to authorize a current decision.

## Regression coverage

`tests/defects/financial_integrity_p1_assumption_governance.js` covers:

- legacy backward compatibility;
- non-destructive registry attachment;
- supported-registry PASS;
- wiring into the canonical investment case;
- deterministic financial-result equivalence with and without governance metadata;
- unsupported critical assumption -> HOLD;
- stale critical assumption -> HOLD;
- malformed registry rejection;
- duplicate assumption ID rejection;
- registry-version consistency;
- prohibition against governance metadata contaminating economic inputs.

## Boundaries preserved

P1 does not claim or activate:

- final professional valuation conclusion;
- certified valuation authority;
- lender approval or credit decision;
- transaction authority;
- legal or tax conclusion;
- commercial Go-Live.

## Next implementation sequence

1. Wire evidence-backed assumptions into the active new-deal UI/workflow rather than Saved Deals only.
2. Reconcile Rent Roll -> normalized NOI -> direct capitalization and DCF outputs.
3. Add explicit Entry Cap / Exit Cap assumption IDs, provenance and variance rules.
4. Add governed RETT/VAT treatment outside property NOI.
5. Promote uploaded independent valuation cases into a Golden Validation Corpus with tolerance bands and variance explanations.
6. Add combined downside and Monte Carlo only after deterministic financial semantics remain stable under regression.
