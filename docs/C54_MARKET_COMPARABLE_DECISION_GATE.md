# C54 — Market Comparable Decision Qualification (Saudi Real Estate)

## Scope and exact base

Stacked on qualified C53 head `890ce6bd9ab47643642e21e1b88d96974b692b55`. C54 addresses the comparison/evidence boundary only. No cost, residual, DCF, portfolio, approval, live public AI or deployment change is authorized.

## Verified pre-change gap

The direct `market-comparables.js` engine previously computed an indication when all inputs were asking prices, or when sale and lease transactions were mixed; it emitted warnings but continued with a `QUALIFIED` result. The market evidence package in Wave 9A and selection/adjustment package in Wave 9B have stronger provenance, yet the compact valuation-intelligence engine had no equivalent mandatory decision qualification.

## C54 behavior

A numeric preliminary result remains visible for diagnostic arithmetic, while decision-control eligibility now fails closed unless:

- Market Value / Fair Value comparables are executed **sales**, and Market Rent comparables are executed **leases**.
- At least **two** executed comparable records are structurally qualified (this is a minimum gate, not statistical adequacy).
- Each has a nonempty source reference and parsable transaction date at or before the specified valuation date.
- Executed-sales evidence grade is verified official or verified transaction; executed leases may additionally carry contractual evidence grade.
- Comparable IDs are unique.
- Missing valuation date, offer-only cases, mixed sale/rent, low evidence grade or future dated records result in an explicit `HOLD_EVIDENCE_CONFLICT` with blocker codes.

No inferred offer discount, imputed date, fabricated evidence, automatic professional selection or automatic valuation weights have been added. A high declared evidence grade **alone does not authenticate the underlying source**.

## Acceptance testing

Adversarial checks cover eligible sales, eligible contractual leases, asking-only, mixed sale/lease, wrong basis, missing source, missing date, future transaction, weak evidence grade, duplicate ID, missing valuation date and preliminary arithmetic retention. Existing valuation and orchestration regressions plus release/build/package/audit are run in a dedicated exact-head GitHub workflow.

## Critical remaining gates before investment reliance

1. Link comparable records to immutable Wave 9A/9B source hashes and independently confirm provider authenticity and property/transaction identity; `sourceAndDateVerifiedBySystem` remains **false**.
2. Enforce market locality, asset subtype, unit/rent-period normalization, arms-length status, professional adjustment rationale, evidence vintage and independence of sales.
3. Complete sector-by-sector UI → engine → persistence → governed report E2E execution using real authorized evidence.
4. Run pre-registered, out-of-sample Saudi market backtests with time-based splits, provenance, independent value or closed transaction truth, analyst signoff and segment-level errors. The existing golden-validation module and external-validation module are statistical primitives, **not proof of observed market accuracy**.
5. Reconcile nominal undiscounted development-residual output against the discounted compact residual engine. Apply timing to each income/cost draw and explicitly prevent double-counting financing, required developer returns and discount-rate risk.
6. Professional valuation and external source-rights authorizations remain independent of passing CI. No accredited report, commercial launch or transaction authority follows from C54.

## Release rule

C54 is a **Draft** stacked engineering pull request. Do not merge, deploy or present it as market-validated while the full exact-head CI, external source validation and independent-market backtest have not been evidenced.
