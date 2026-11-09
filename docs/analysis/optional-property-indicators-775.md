# STARTAK — Issue #775: Optional property investment indicators (engineering note)

**Scope:** supplemental *personal research* only, not certified appraisal, property-market value, regulated investment advice, or a transaction approval. Based on the six user-supplied educational images listing 60 formulas. The mathematical names below reflect the images; governance restrictions and input contracts are engineering corrections, not claims by the original author.

## Isolation and usage
- Implementation: `src/analysis/optional-property-indicators.js`, exported `calculateOptionalPropertyIndicator(id,explicitInputs)`.
- No imports from canonical valuation engines, report exports, Deal lifecycle, portfolio decision cockpit, or production deployment rules. A **separate collapsible manual-input UI** is displayed inside the personal research area by `src/components/OptionalPropertyIndicatorsResearchPanel.jsx`; no routes, report columns, valuation equations, or saved-deal fields are added.
- Output states: `CALCULATED_UNVERIFIED` for a mathematically calculated educational indicator, `HOLD_INVALID_OR_INCOMPLETE` with `value:null` and `reasonCode` otherwise. The UI uses `calculateDeclaredOptionalResearchIndicator` to require a **user-supplied** source reference, a real nonfuture source date and explicit attestation. These are assertions, not independent evidence verification.
- Always: `professionalApproval:false`, `transactionAuthorized:false`, and `sourceStatus:USER_DECLARED_UNVERIFIED`. These indicators may not amend valuation conclusions or override release governance.

## Seven specifically scoped indicators
| ID | Inputs | Formula / condition |
|---|---|---|
| GROSS_RENTAL_YIELD | grossAnnualRentSar >= 0; purchasePriceSar > 0 | Annual **gross** rent / property purchase price, *not NOI yield or market cap rate* |
| GROSS_RENT_MULTIPLIER | grossAnnualRentSar > 0; purchasePriceSar > 0 | Purchase price / annual gross rent, in years, *not price-to-earnings* |
| CASH_ON_CASH | signed annualPreTaxEquityCashFlowSar; actual cashEquityInvestedSar > 0 | Annual **after-debt**, before-tax equity cash flow / cash equity invested, *not NOI / total project cost*. Calculation cannot verify the asserted equity cash-flow construction |
| DISCOUNTED_PAYBACK | annualCashflowsSar=[negative t0,...nonnegative annual cashflows], discountRate>=0, explicit includesTerminalSale boolean; terminalSaleYear=last period if sale | First recovery from **cumulative discounted** cash flows. Disallow additional negative capital calls and undisclosed sale timing. If recovery is triggered by terminal sale, use the full sale year (not within-year interpolation). Disclose sale inclusion |
| PROFITABILITY_INDEX | initialInvestmentSar>0, futureAnnualInflowsSar[] all nonnegative, discountRate>=0 | PV of future positive annual inflows / **single** t0 outlay. Additional future negative capital calls are not represented and therefore must not be silently ignored; multi-contribution projects require a different guarded convention |
| MIRR | signed annualCashflowsSar[], financeRate>=0, reinvestmentRate>=0 | (FV positive cash flows reinvested to end / PV negative cash flows financed to t0)^(1/n)-1; both signs required. Independent assumptions, not substituted from IRR |
| EQUIVALENT_ANNUAL_ANNUITY | npvSar signed finite, discountRate>=0, integer periodYears>=1 | NPV * r / (1-(1+r)^(-n)); at r=0 use NPV/n. Use only for projects comparable under a declared repeatability/economic-life policy |

## Safeguards and exclusions

- No numeric strings, missing/nonfinite amounts, zero denominators, nonfinite results or unqualified input sets are accepted.
- All periods are **equal annual** periods, indexed from t0. This is *not* XIRR/XNPV; irregular-date cash flows must use existing date-aware routines instead.
- Numbers are in **SAR** for cash inputs and annual rates are entered as **decimals** (0.10 for 10%), never 10 or 10%.
- Gross yield and GRM can be reciprocal but use different units; never infer one from cap rate.
- The simplified CoC calculation does not perform checks for debt service, taxes, reserves or capital calls. Input provenance and external corroboration remain open.
- The DPP series is monotone after its initial outflow; if the project requires interim negative flows or mid-period sale cash timing, this function returns HOLD rather than fabricating recovery.
- No compounded portfolio return, CAPM, listed-company ratios, ratio of shareholders' equity, ROIC, or WACC are implemented by this module.

## Acceptance
- The targeted defect test `tests/defects/optional_property_indicators_775.js` is automatically picked up by the canonical `tools/release-verify.js` test discovery for every PR. The browser test `tests/e2e/run_optional_property_indicators_775.js` is executed by `.github/workflows/optional-property-indicators-775-verify.yml` on relevant PR changes.
- Test vectors cover each indicator; reciprocal relation; zero rate; negative CoC and EAA; annual payback interpolation and terminal sale; later negative MIRR contribution; arithmetic and source/authorization semantics; rejection of missing, numeric-text, nonfinite, negative future PI inflows, unsupported DPP capital calls, no IRR-style root, invalid periods, and zero divisors.
- Passing these tests is only **engineering** acceptance of the optional library and isolated personal-research UI. No deployment, formula registry replacement, canonical appraisal adoption, or professional approval is implied.
- Before integrating into any formal owner report: require independently checked provenance for each input, source dates, cash-flow timing, professional review of property-rights and asset type, accurate units and separated investor-equity vs property-NOI scope, and original 17-case actual-engine parity under authorized source access.

**Release:** HOLD_NOT_AUTHORIZED. No changes to `main`, original portfolio formulas or published assets.

## 9 November 2026 — research UI boundary

The user selects an indicator, manually enters amounts/annual rates, supplies an identifying source reference and its date, then affirms the data are user declared. The selected metric, numeric fields, reference and attestation are reset on metric changes; any input edit clears stale computed output. Source dates are format/chronology checked, **not independently authenticated**. The selected indicator is not auto-seeded from saved deal values; no personal JSON/HTML study export incorporates any of these optional numbers or source references. A linked appraisal-review HOLD disables calculation in the supplemental panel. Negative/blank, zero-denominator and unsupported cashflow shapes remain fail-closed. Browser acceptance must verify canonical study input fingerprint and calculations unchanged before and after using the panel.
