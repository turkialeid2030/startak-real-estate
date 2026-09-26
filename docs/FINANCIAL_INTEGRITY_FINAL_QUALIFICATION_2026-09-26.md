# Financial Integrity — Final Engineering Qualification Scope — 2026-09-26

## Purpose

This document defines the final engineering qualification boundary for the Financial Integrity sequence P0–P10. It records what must be proven before the sequence is treated as technically qualified and what remains outside engineering authority.

## Final governed components

The sequence now contains governed controls for:

- assumption/evidence integrity and fail-closed critical inputs;
- stabilized NOI and direct capitalization;
- independent Entry Cap and Exit Cap evidence;
- dated DCF using XNPV/XIRR semantics;
- transaction-cost separation from property NOI;
- Direct Cap versus DCF method reconciliation;
- independent Golden Validation Corpus comparison;
- deterministic multi-factor stress testing;
- seeded Monte Carlo uncertainty simulation;
- exact annual-period IRR within Monte Carlo cash-flow streams;
- HBU / residual development / maximum land bid;
- portfolio concentration and portfolio DSCR diagnostics;
- exact dated XIRR/XNPV with strict calendar-date validation and multiple-IRR ambiguity protection.

## Financial defects corrected during final qualification

### Dated XIRR/XNPV

- Reject impossible calendar dates instead of relying on JavaScript date normalization.
- Reject cash-flow patterns with multiple sign changes where a single XIRR could be ambiguous.
- Validate solver configuration and root bracket.
- Verify residual XNPV at the solved rate.

### Monte Carlo

- Removed the former terminal-value CAGR proxy labelled as IRR.
- Monte Carlo now solves IRR from the complete simulated annual cash-flow stream: initial investment, annual NOI, and final-year NOI plus terminal value.
- Same-seed simulations must be reproducible.
- Distribution draws that violate governed mathematical domains fail closed.
- Negative supplied annual debt service fails closed.

### Deterministic stress

- Base NOI must reconcile to effective revenue less OpEx when both components are supplied.
- Relative shocks cannot be less than or equal to -100%.
- Invalid or non-positive stressed capitalization rates fail closed.
- Non-positive stressed NOI is flagged explicitly; a negative capitalization value is not presented as a property valuation indication. Stress severity uses a zero-value floor and a 100% value decline for that case.

### HBU / maximum land bid

- Alternative IDs must be non-empty and unique.
- Legal and physical gates must be explicit booleans.
- GDV must be positive and development cost fields non-negative.
- Maximum land bid remains a residual feasibility ceiling, not market value, an offer, or transaction authority.

### Portfolio

- Concentration limits must be within (0, 1].
- Negative or non-finite supplied debt service fails closed.
- Portfolio DSCR, city concentration, asset-type concentration, and single-asset concentration remain diagnostics requiring human decision authority.

### Golden validation

- Tolerance must be between 0% and 100%.
- Independent case IDs must be unique.
- Independent source references must be non-empty.
- A variance outside tolerance produces REVIEW_REQUIRED, not silent acceptance.

## Integrated simulation corpus

The final regression suite includes an integrated simulation that exercises all of the following in one qualification path:

1. Optimistic, conservative, and severe deterministic operating scenarios.
2. Rent, occupancy, OpEx, capitalization-rate, and debt-service shocks.
3. Seeded Monte Carlo with 2,000 iterations and ordered P05/P50/P95 outputs.
4. Probability of negative NPV, IRR below hurdle, and DSCR below threshold.
5. HBU comparison across residential, mixed-use, and logistics alternatives.
6. Maximum land bid and SAR/m² output with no transaction authority.
7. Diversified versus concentrated portfolio cases.
8. Irregular dated XIRR with residual XNPV verification.
9. Multiple-IRR ambiguity fail-closed test.
10. Independent Golden Corpus cases within tolerance and an outlier requiring review.

## Final qualification gates

A final head is engineering-qualified only if all applicable repository gates on that exact head are successful, including:

- full regression discovery and execution;
- production build;
- package verification;
- npm audit release threshold;
- canonical baseline registry verification;
- comprehensive verification;
- deep platform verification;
- supply-chain audit;
- preview/build verification where applicable.

Any prior PASS attached to an older head becomes historical evidence only after the branch changes.

## Explicit boundaries

Engineering qualification does **not** by itself establish:

- certified or licensed real-estate valuation authority;
- a legal, tax, accounting, financing, or lender opinion;
- investment committee approval;
- BUY / SELL / HOLD transaction authority;
- authority to execute brokerage, financing, acquisition, disposal, or settlement;
- commercial external Go-Live;
- correctness of unsupplied external canonical evidence.

External professional, legal, regulatory, evidence-source, and transaction-authority gates remain separate and fail closed.

## Merge sequence

The intended production sequence remains strictly ordered:

P8 -> P9 -> P10 -> final `main` verification.

If repository rules prevent merge because required status contexts are misconfigured, the engineering evidence remains valid for the tested head, but production completion must not be asserted until the actual merge and post-merge verification occur.
