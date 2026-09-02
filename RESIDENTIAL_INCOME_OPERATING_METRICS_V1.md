# Residential Income Acquisition Intelligence - Operating Metrics v1

Status: **RIAI-01B IMPLEMENTED**

## Scope

This wave adds deterministic unit and lease operating metrics over the `RIAI-01A` canonical contract. It does not replace the Existing Building financial engine and does not calculate stabilized NOI, value, returns, or an investment decision.

## Implemented calculations

- Current periodic and annual contract rent by unit.
- Monthly, quarterly, semi-annual, and annual rent annualization.
- Fixed-percentage, fixed-amount, step-rent, manual-schedule, and no-escalation handling.
- Internal Rent Roll summation and reconciliation.
- Physical occupancy by unit and rentable area.
- Contracted occupancy by rentable area.
- Rent-weighted WALE and area-weighted WALT.
- Lease expiries by calendar year.
- Rent and area exposure within 12, 24, and 36 months.
- Configurable lease-cliff detection, defaulting to 25% of current annual contract rent.

## Fail-closed rules

The metrics return `NOT_CALCULABLE` instead of inventing a result when relevant unit or lease inputs are not adopted, a unit carries multiple active leases, unit status contradicts active leases, an active lease falls outside its dates, rent frequency is custom/unsupported, indexed rent lacks an adopted index value, or current rent becomes invalid.

Base rent is the amount for the declared payment frequency. Its unit must match that frequency (`SAR/month`, `SAR/quarter`, `SAR/half-year`, or `SAR/year`). Fixed-amount and scheduled escalations must use the same unit; fixed-percentage escalations use `ratio`. A mismatch blocks calculation rather than being converted implicitly.

## Definitions

`Physical occupancy by units = occupied units / total unit inventory`

`Physical occupancy by area = occupied rentable area / total rentable area`

`Contracted occupancy by area = area with an active lease / total rentable area`

`WALE = sum(current annual contract rent × remaining term) / total current annual contract rent`

`WALT = sum(contracted area × remaining term) / total contracted area`

Offline units remain in the physical-occupancy denominator so downtime and deferred maintenance are not hidden from the acquisition view.

## Explicitly unavailable

- Economic occupancy: requires collected rent and potential gross rent.
- Source-total Rent Roll reconciliation: requires an independently adopted source total.
- Indexed escalation: requires an adopted index observation and effective date.
- OPEX, deferred CAPEX, mark-to-market, stabilized NOI, valuation, acquisition price, and exit comparison.

Contract rent is not collected rent, and physical occupancy is not economic occupancy. These outputs are analytical inputs only and are not a certified valuation, legal conclusion, credit rating, or investment recommendation.
