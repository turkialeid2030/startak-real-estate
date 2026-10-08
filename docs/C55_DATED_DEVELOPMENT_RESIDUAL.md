# C55 — Governed Time-Scheduled Development Residual, Engineering Stage 1

## Starting point
The existing Wave 11C `src/engines/valuation/residual-land-value.js` intentionally calculates `NOMINAL_UNDISCOUNTED_RESIDUAL` even though its professional input packet contains dated month offsets. The separate compact `src/valuation-intelligence/residual-approach.js` discounts one aggregate residual at the end of development. Both original engines and result contracts are preserved without changing consumer semantics.

## New bounded engineering method
`src/engines/valuation/dated-development-residual.js` consumes exactly the existing, integrity-verified professional Development Residual Input Packet and reuses the legacy nominal calculator for evidence and value cross-reference. Each month's GDV receipt, development cost, fee and (where permitted) developer return is discounted individually using the actual month-derived date and ACT/365.2425.

`PV = Σ [ (GDV_m − COST_m − FEE_m − RETURN_m) / (1+r)^(days_m / 365.2425) ]`

The `RETURN_m` deduction depends on explicitly declared professional risk policy; no default is guessed.

## Mutually exclusive finance and return conventions
1. `EXPLICIT_DEVELOPER_RETURN` must use `TIME_VALUE_ONLY` discounting. The explicitly reviewed developer profit is deducted once at the terminal month.
2. `RISK_INCLUDED_IN_DISCOUNT_RATE` must use `RISK_ADJUSTED_UNLEVERED`. The stated required developer profit is preserved in metadata but **not deducted a second time**.
3. Both paths require `UNLEVERED_NO_EXPLICIT_FINANCING`: the upstream professional packet must contain **zero** finance-cost components. Any financing item triggers a HOLD until a separately approved leveraged methodology is introduced.
4. Rate, methodology, independent reviewer, date and evidence references are mandatory. Invalid dates, negative time offsets, discount-rate errors, invalid upstream packet and non-finite calculations fail closed.
5. Negative residuals are preserved but marked `REVIEW_REQUIRED`, not represented as an investable price.

## Acceptance and scope
Synthetic tests cover old nominal preservation, zero-rate algebraic parity, independently recomputed dated PV, missing/invalid rate policy, invalid finance / risk combinations, nonpositive economics, data tampering, and negative cashflow chronology. The asset-specific UI, report/persistence adapter, fully scaled Saudi data, IFRS/IVS/Taqeem applicability review, real-estate licensed appraisal and independent actual-market backtesting **remain open** and cannot be inferred from unit-test PASS.

## Conditions for full closure
- Professional signoff on methodology including treatment of taxes, indexed revenues, VAT/RETT when applicable, developer cash draw financing, contingency and risk sharing.
- Link into decision-control adapter, valuation request/version metadata, persistence, Arabic report and audit trail without misleading certified-valuation semantics.
- Adversarial sector E2E and real, independently sourced market case tests.
- No auto merge, commercial/public production, investment or transaction authority.
