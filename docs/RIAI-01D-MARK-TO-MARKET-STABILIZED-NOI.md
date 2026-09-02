# RIAI-01D — Mark-to-Market and Stabilized NOI

## Scope

This wave adds an evidence-gated income bridge to the Residential Income Acquisition operating case. It uses adopted annual market rent for every unit and explicit stabilized loss and other-income inputs.

The deterministic bridge is:

1. Unit annual market rent produces potential gross income.
2. Stabilized vacancy loss and credit loss are each applied to potential gross income.
3. Annual concessions are deducted and other operating income is added.
4. Complete normalized annual OPEX is deducted from effective gross income.
5. The result is stabilized NOI.

## Required adopted inputs

- `unit.<unitId>.annualMarketRent` in `SAR/year` for every unit.
- `income.stabilizedVacancyLossRate` as a ratio.
- `income.stabilizedCreditLossRate` as a ratio.
- `income.annualConcessions` in `SAR/year`.
- `income.annualOtherOperatingIncome` in `SAR/year`.
- A complete normalized OPEX total from RIAI-01C.

Missing, duplicate, unavailable, future-effective, incorrectly unitized, or out-of-range inputs fail closed. No missing amount is inferred as zero.

## Mark-to-market boundary

Headline mark-to-market compares annual market rent with current annual contract rent. Vacant and offline units remain visibly classified rather than silently treated as occupied rent reversion.

Realizable mark-to-market remains `null`. It requires adopted inputs for lease expiry, downtime, tenant improvements, leasing commission, rent-free periods, and renewal probability. Headline rent gap is not presented as immediately realizable value.

## NOI boundary

Stabilized NOI excludes debt service, depreciation, income tax, acquisition cost, and capital improvements. CAPEX remains in the property-cost and acquisition-basis layers rather than being deducted inside NOI.

The engine does not calculate property value, acquisition price, returns, a legal conclusion, an investment decision, or transaction authorization.
