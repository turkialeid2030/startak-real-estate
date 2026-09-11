# Wave 12C — Professional DCF Governance

Status: engineering candidate only. No merge to `main`; no production deployment authorization.

Wave 12C adds a governed professional discounted-cash-flow method indication on top of the qualified Wave 12A professional NOI forecast. It is intentionally separated from leverage, debt sizing, equity-return analysis, tax/Zakat calculation, method reconciliation, final valuation certification and transaction authority.

## Qualified inputs

The DCF packet must bind to one integrity-verified professional NOI result for the same case, property and valuation date. The forecast periods are retained exactly and must remain contiguous. Non-finite NOI fails closed.

Two independent professional rate inputs are mandatory: `DISCOUNT_RATE` and `EXIT_CAP_RATE`. Each rate carries source, rationale, evidence references, as-of date, professional reviewer, review evidence, confidence and SHA-256 integrity. A market capitalization rate cannot substitute either DCF rate. Future-dated, stale, wrong-type or tampered rate inputs fail closed. Rate freshness limits are explicit packet inputs.

Terminal NOI is a separate explicit reviewed input and is never derived automatically from the final forecast period. It must be positive and supported by explicit provenance. Disposition cost is also an explicit reviewed input, either a SAR amount or a percentage of gross terminal value.

## Non-NOI property cash flows

Professional DCF must not hide capital expenditures, tenant improvements or leasing commissions inside NOI. Wave 12C therefore requires an explicit `periodAdjustments` array, even when it is empty. Supported adjustment types are capital expenditure, tenant improvements, leasing commission and other property cash flow. Each item has a direction (`INFLOW` or `OUTFLOW`), amount, source, evidence, as-of date, preparer/reviewer and integrity hash.

The canonical period cash flow is:

`Unlevered Property Cash Flow = Professional NOI + Explicit Adjustment Inflows - Explicit Adjustment Outflows`

Debt service, financing, income tax and Zakat are excluded from this professional property-level DCF layer.

## Canonical arithmetic

The only DCF arithmetic is implemented in `src/engines/valuation/professional-dcf.js`.

Operating property cash flows use either `END_OF_PERIOD` or `MID_YEAR` discount timing. Terminal value always occurs at the end of the final forecast period:

`Gross Terminal Value = Explicit Terminal NOI / Explicit Exit Cap Rate`

`Net Terminal Value = Gross Terminal Value - Explicit Disposition Cost`

`DCF Value Indication = PV(Explicit Unlevered Property Cash Flows) + PV(Net Terminal Value)`

Negative period property cash flow, non-positive net terminal value, excessive disposition cost or non-positive total DCF indication is surfaced for professional review. The engine does not silently repair, cap or replace those results.

## Safety boundaries

No automatic rent adoption, lease-option exercise, rate derivation, terminal-NOI derivation, financing, debt service, equity IRR, income-tax or Zakat calculation is performed. No method reconciliation, final valuation conclusion, certified valuation, legal opinion or transaction authorization is produced.

The output is only `PROFESSIONAL_DCF_VALUE_INDICATION` and remains a method indication pending later governed reconciliation and licensed professional review.

Qualification marker: `WAVE_12C_PROFESSIONAL_DCF=PASS`.

Next controlled sub-wave: Wave 12D — separate unlevered investment metrics, debt/financing metrics and equity-return analysis, preserving the professional valuation indication as a distinct layer and preventing leverage from changing the underlying property value indication.
