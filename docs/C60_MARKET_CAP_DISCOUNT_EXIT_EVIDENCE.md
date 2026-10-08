# C60 — Source-Verified Market Income Rates and Entry/Exit/Discount Consistency

## Reuse, not reimplementation
The platform already has `src/valuation-intelligence/income-capitalization.js`, `cap-rate-governance.js` and `governed-dcf.js`: these validate the arithmetic of capitalization, separately distinguish entry and exit capitalization rates and calculate discounted terminal value and XIRR. The remaining C60 issue is **market derivation, normalization and authentication of rates** rather than DCF calculation.

## Stage 1 — executable evidence preflight
New `market-rate-provenance.js` requires a caller-predeclared verification/stress policy. Each comparable must be an executed sale for the same asset class/city and valuation date window, with distinct transaction reference and source/document/permission/reviewer metadata.

Reconciles **annual landlord-borne NOI** from gross contractual annual income minus vacancy/bad-debt effect minus landlord OPEX plus documented one-off normalization into annual operating income and derives observed cap = NOI / executed transaction price. A self-declared `NOI` or `SALE` label does not independently establish validity.

The professional selected entry capitalization rate must be within an explicit documented policy distance of the comparison median, while the exit capitalization rate requires a **separate forward-risk/methodology review**. Entry and exit equality or compression cannot pass without its own justification. The discount rate must reconcile within a predeclared bps tolerance to explicit reference rate and documented property/liquidity/other risk-premium contributions.

Uses existing entry/exit cap governance and displays terminal-value sensitivity under explicit NOI and exit-cap shocks. No generic cap/discount rate is silently fabricated. No market observation is automatically converted into a final valuation or a production decision.

## Important boundaries
The module only establishes `READY_FOR_EXTERNAL_RATE_AUTHENTICATION`, not `PROVEN_MARKET_RATE`. Its case fixtures are synthetic, and nothing here supplies independent executed Saudi transactions, valid source rights, professional rate signoff or calibrated future exit-rate accuracy. Source rights, independently verified official datasets, dated rent-roll leases and operating expense normalization, C56 historical out-of-sample samples and real C57 UI/Arabic reports remain **HOLD**.

## Acceptance for G07 closure
Independent external evidence must verify true transaction prices, effective rent roll, audited net operating income, period alignment, operating-expense service charge recoverability, lease term, vacancy and incentives, location/subtype and rights, and signed professional selection and review. Actual E2E must use C60 results as a hard gate in the method orchestration without bypass; then obtain actual historical market validation and separate commercial deployment approval.
