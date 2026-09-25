# Financial Integrity P4 — Governed Dated DCF — 2026-09-25

## Purpose

P4 adds a deterministic, evidence-governed DCF layer on top of the canonical P0 XNPV/XIRR primitives and the P3 Entry/Exit Cap governance.

It addresses model-risk from: undisclosed discount rates, silent reuse of Entry Cap as Exit Cap, terminal value without Exit Cap provenance, periodic IRR/NPV applied to irregular dated cash flows, and terminal selling costs omitted from the reversion.

## Calculation chain

1. Validate dated explicit-period cash flows.
2. Require an independently evidenced discount rate.
3. Require an independently evidenced Exit Cap through P3 governance.
4. Calculate terminal value = Terminal NOI / Exit Cap.
5. Deduct explicit terminal selling costs.
6. Add net terminal value at the terminal date.
7. Calculate XNPV using actual dates.
8. Calculate XIRR from the same dated cash-flow set.
9. Fail closed when critical evidence or required inputs are invalid/conflicting.

## Governance rules

- Discount rate must be > 0 and have sourceType/sourceRef evidence.
- Conflict evidence blocks DCF.
- Assumed/unverified discount-rate evidence triggers REVIEW_REQUIRED.
- Exit Cap is mandatory for terminal-value construction.
- Exit Cap has independent evidence and is not silently copied from Entry Cap.
- Equal Entry/Exit rates and cap compression follow P3 rationale/review rules.
- Terminal selling costs must be explicitly represented as a rate in [0,1).
- No universal discount-rate, exit-cap spread, hurdle-rate, or lender covenant is hard-coded.

## Status

- QUALIFIED: deterministic/evidence controls passed.
- REVIEW_REQUIRED: calculation completed but a governed warning requires human review.
- HOLD: critical input/evidence/calculation failure; no valuation indication is released.

QUALIFIED is not a certified valuation, investment approval, lender decision, transaction authority, legal/tax opinion, or commercial Go-Live.

## Regression coverage

`tests/defects/financial_integrity_p4_governed_dcf.js` covers:

- qualified dated DCF;
- terminal-value arithmetic;
- missing Exit Cap evidence -> HOLD;
- missing discount-rate evidence -> HOLD;
- conflicting discount-rate evidence -> HOLD;
- same Entry/Exit rate without rationale -> REVIEW_REQUIRED;
- same rate with rationale -> QUALIFIED;
- cap compression without rationale -> REVIEW_REQUIRED;
- cap compression with rationale -> QUALIFIED;
- assumed discount-rate evidence -> REVIEW_REQUIRED;
- invalid terminal selling-cost rate -> HOLD.

## Next controlled sequence

1. Run full Release Verify / Comprehensive / Deep Platform / supply-chain gates on P4 head.
2. Merge only after repository governance is green.
3. Add acquisition-workflow/UI integration for governed direct-cap and DCF outputs.
4. Add explicit RETT/VAT/acquisition/disposal cost boundaries outside NOI.
5. Add deterministic direct-cap vs DCF reconciliation and variance explanation.
6. Build Golden Validation Corpus from independent cases before Monte Carlo.
7. Add combined stress testing, then Monte Carlo only after deterministic validation is stable.
