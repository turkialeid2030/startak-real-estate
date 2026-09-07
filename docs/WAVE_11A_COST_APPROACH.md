# Wave 11A — Cost Approach Canonical Valuation Indication

Status: engineering candidate only. No merge to `main`; no production deployment authorization.

## Purpose

Wave 11A introduces a governed professional Cost Approach input layer and a deterministic canonical Cost Approach calculator. The architecture deliberately separates professional evidence/judgment from calculation and keeps the resulting Cost Approach figure as a method indication only, subject to later reconciliation.

## Professional input governance

The governed packet binds:

- a ready Property Evidence Packet;
- verified cost components with quantity, unit, unit cost, cost basis, source class, source reference/date and verification provenance;
- an explicitly reviewed professional land-value indication with method reference, rationale and evidence references;
- explicit accrued-depreciation judgments with taxonomy, method, magnitude, rationale, evidence and professional review;
- valuation date, source-age policy, allowed source classes and deterministic SHA-256 provenance.

Cost components support replacement cost new and reproduction cost new and classes for structure, MEP, fit-out, site improvements, professional fees, indirect costs and explicit other components.

## Depreciation taxonomy

Wave 11A supports one aggregate reviewed record per configured depreciation taxonomy type:

- physical curable;
- physical incurable;
- functional curable;
- functional incurable;
- external obsolescence.

Each record uses either an explicit SAR amount or an explicit percentage of total improvement cost new. The input layer does not calculate the depreciation amount. The canonical calculator performs that arithmetic.

## Canonical calculation boundary

The only Wave 11A formula is implemented under `src/engines/valuation/cost-approach.js`:

`Cost Approach indication = professional land-value input + improvement cost new - accrued depreciation`

The engine computes each extended component cost, total improvement cost new, each depreciation amount, total accrued depreciation, depreciated improvement value and the resulting Cost Approach indication.

The engine fails closed if any extended cost is non-finite/non-positive, accrued depreciation exceeds improvement cost new, the governed packet is tampered/unready, or the resulting indication is invalid.

## Land-value boundary

Wave 11A does not manufacture land value. It consumes an explicitly prepared and reviewed professional land-value indication with a method reference such as sales comparison, allocation, extraction, ground-rent capitalization, residual or explicit other.

Wave 11B will add governed land-valuation analysis using market evidence and professional reconciliation. Historical Wave 11A indications remain reproducible from their bound land-value input hash.

## Safety boundaries

- no hidden cost assumption;
- no automatic land valuation;
- no automatic depreciation estimation;
- no automatic method selection;
- no automatic reconciliation;
- no final valuation conclusion;
- no certified valuation or licensed-provider status;
- no legal opinion;
- no transaction authority;
- no modification to the existing investment/financial formulas or golden fixtures.

## Qualification marker

`WAVE_11A_COST_APPROACH=PASS`

## Next controlled sub-wave

Wave 11B: governed professional land valuation, initially using qualified land comparable evidence, explicit selection/adjustments and accountable reconciliation without automatic averaging.
