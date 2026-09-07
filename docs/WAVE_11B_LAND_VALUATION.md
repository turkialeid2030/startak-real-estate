# Wave 11B — Governed Professional Land Valuation

Status: engineering candidate only. No merge to `main`; no production deployment authorization.

## Purpose

Wave 11B adds a governed land sales-comparison valuation path using the qualified market/comparable infrastructure from Wave 9. It preserves the separation between evidence qualification, professional comparable selection/adjustment, professional reconciliation decisions, and deterministic canonical calculation.

## Required upstream evidence

The land valuation input packet requires:

- a ready Property Evidence Packet for the same case/property and valuation date;
- an explicitly selected `LAND_AREA` measurement in square metres, including its evidence/standard/method/hash provenance;
- a Wave 9 comparable-adjustment analysis in `READY_FOR_RECONCILIATION` state with verified analysis integrity;
- original comparable records bound by comparable ID/hash;
- each used comparable must be asset type `LAND` and transaction type `SALE`.

Rental evidence or non-land comparable evidence cannot be used in this land sales-comparison path.

## Professional reconciliation

The system does not average adjusted land comparables automatically and does not create weights. The valuer must explicitly supply:

- a positive weight for every reconciled indication;
- a rationale for every weight;
- weights summing to 1;
- an overall reconciliation rationale;
- accountable reconciler identity, timestamp and evidence reference.

The governed input packet hashes these choices but performs no land-value arithmetic.

## Canonical calculation

The deterministic calculation lives only under `src/engines/valuation/land-sales-comparison.js`.

The canonical engine calculates:

`reconciled unit land value = Σ(adjusted comparable unit value × explicit professional weight)`

`land value indication = selected subject land area × reconciled unit land value`

The result includes a contribution trace for every comparable and a deterministic calculation SHA-256.

## Professional boundary

The output is a `LAND_SALES_COMPARISON_VALUE_INDICATION`. It is not a final property valuation. It may support Cost Approach or Development Property work only through an explicit downstream professional adoption/review workflow.

## Safety boundaries

- no automatic comparable selection;
- no automatic comparable adjustment estimation;
- no automatic weighting;
- no simple average fallback;
- no automatic land-value selection;
- no final property valuation conclusion;
- no certified valuation or licensed-provider status;
- no legal opinion;
- no transaction authority;
- no change to existing investment/financial formulas or golden fixtures.

## Qualification marker

`WAVE_11B_LAND_VALUATION=PASS`

## Next controlled sub-wave

Wave 11C: governed Development Property and Residual Land Value architecture with explicit GDV, cost, timing, finance, fees, contingency and required developer-return assumptions, calculated only in the canonical engine.
