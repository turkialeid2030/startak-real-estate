# Wave 11C — Development Property and Residual Land Value

Status: engineering candidate only. No merge to `main`; no production deployment authorization.

## Purpose

Wave 11C adds a governed Development Property residual-land-value path. It separates professional assumptions and evidence from deterministic arithmetic and does not reuse the legacy investment-underwriting `land-development.js` engine.

## Required upstream governance

A Development Property residual packet requires a ready Property Evidence Packet for the same case/property and valuation date, a concluded HBU decision for the same case/property, an exact match between the selected HBU scenario/use and the proposed development scenario/use, and an explicitly selected `LAND_AREA` measurement in square metres.

## Explicit economic inputs

The professional packet requires reviewed, evidence-linked and integrity-hashed components for GDV and development costs. Finance costs and fees are optional arrays but, when supplied, are explicit reviewed amounts. Contingency is never hidden: it is an explicit development-cost component. Required developer return is explicitly supplied as either a SAR amount or a fraction of GDV. Wave 11C never estimates GDV, construction costs, finance costs, fees, contingency, or required developer return.

Each economic component records amount, month, source, evidence, rationale, preparer, reviewer and review evidence. Components after the terminal month fail closed.

## Canonical calculation

All arithmetic lives only in `src/engines/valuation/residual-land-value.js`:

`Residual Land Value = GDV - Development Costs - Finance Costs - Fees - Required Developer Return`

`Residual Land Value / sqm = Residual Land Value / verified subject LAND_AREA`

If developer return is `PERCENT_OF_GDV`, its SAR amount is calculated by the canonical engine from explicit GDV and the explicit professional percentage.

The month schedule is preserved for traceability, but Wave 11C deliberately performs no discounting. Its timing convention is `NOMINAL_UNDISCOUNTED_RESIDUAL`; no discount rate or hidden financing model is assumed.

A zero or negative residual is not treated as a software error. It is preserved as an economically meaningful indication and marked `NON_POSITIVE_RESIDUAL_REVIEW_REQUIRED`.

## Professional boundary

The result is `DEVELOPMENT_RESIDUAL_LAND_VALUE_INDICATION`. It is not automatically reconciled with the Wave 11B land-sales-comparison indication and is not a final or certified property valuation.

## Safety boundaries

- no automatic HBU selection;
- no automatic GDV/cost/finance/fee/contingency estimation;
- no automatic developer-return estimation;
- no hidden discounting;
- no automatic land-value selection or reconciliation;
- no final/certified valuation;
- no legal opinion;
- no transaction authority;
- no change to legacy investment-underwriting formulas or golden fixtures.

## Qualification marker

`WAVE_11C_DEVELOPMENT_RESIDUAL=PASS`

## Next controlled sub-wave

Wave 11D: governed Development Property sensitivity and uncertainty around residual value, with explicit scenario dimensions, no silent probability assumptions, and no automatic reconciliation or final valuation conclusion.
