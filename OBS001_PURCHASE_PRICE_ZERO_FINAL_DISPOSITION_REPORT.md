# OBS001_PURCHASE_PRICE_ZERO_FINAL_DISPOSITION_REPORT

## Reproduction (from canonical engine, not UI-only)
`OBS001_REPRODUCED = TRUE`. Direct price sweep via `calculateInvestmentCase()`:

| buildingPrice | verdict | metCount | IRR |
|---|---|---|---|
| 140,000,000 (baseline) | يوصى بالشراء (GO) | 4/4 | 14.9% |
| 1 | يوصى بالشراء (GO) | 4/4 | 110.07% |
| 0.01 | يوصى بالشراء (GO) | 4/4 | 110.07% |
| **0** | **يوصى بالشراء بشروط (CONDITIONAL)** | **3/4** | 110.07% |

## Exact definition of "inversion"
`OBS001_ZERO_DISCONTINUITY = TRUE`. This is **not** a smooth trend toward a more favorable result as price approaches zero -- prices arbitrarily close to zero (1, 0.01) produce a full GO with a fictitious 110% IRR, while price = 0 **exactly** produces a *worse* tier (CONDITIONAL). `OBS001_RECOMMENDATION_TIER_CHANGE = GO→CONDITIONAL` (comparing the near-zero neighbor to exactly zero), not a monotonic function of price.

**Root cause of the discontinuity**: `netYieldOnPrice = inp.buildingPrice > 0 ? NOI / inp.buildingPrice : 0` (`existing-building.js`). This guard prevents `Infinity`/`NaN` but substitutes `0` -- which then fails criterion c1 (`netYieldOnPrice >= minYieldThreshold`) even though `NOI` is strongly positive (14,859,936). At any price above zero, however small, the division proceeds and produces an astronomically large (economically meaningless) yield that trivially satisfies every criterion.

## Complete purchasePrice trace
`PURCHASE_PRICE_PRODUCERS`: `DEFAULT_BUILDING_INPUTS.buildingPrice` (default), user `NumField` input (no `min=` attribute), Saved Deal load (`record.inputs.buildingPrice`).
`PURCHASE_PRICE_VALIDATORS` (before this fix): none -- only generic `requireFinite` via the general numeric pass, no positivity check.
`PURCHASE_PRICE_FINANCIAL_CONSUMERS`: `totalPurchaseCost` (sum component), `netYieldOnPrice` (divisor, guarded), `paybackOnPrice` (divisor, guarded), `c4` comparison (`marketValueByIncomeCap >= totalPurchaseCost`).
`PURCHASE_PRICE_RECOMMENDATION_CONSUMERS`: c1 (via `netYieldOnPrice`), c4 (via `totalPurchaseCost`).
No legacy adapter, no export path, no Saved Deal special-casing exists for this field -- it flows through the general `inputs` object identically to every other numeric field.

## Current domain contract (before fix)
`UI_DOMAIN` = any finite number (no `min` on the input). `ENGINE_DOMAIN` (before fix) = any finite number (only `requireFinite`, no positivity rule). `PERSISTED_DOMAIN` = whatever was accepted at calculation time -- identical to engine domain. All three agreed on "any finite number," which is exactly the gap: no layer enforced strict positivity despite the field's use as a divisor.

## Business semantic classification
`buildingPrice` represents the acquisition consideration paid for an existing building -- the product's entire "Existing Building" investment-case concept is built around evaluating a *purchase*. The current model has no acquisition-mode field, no "already-owned"/"contributed"/"inherited" concept anywhere in the schema, UI, or engine. A theoretical real-world zero-cost acquisition is not a case this product currently models.

`ZERO_PURCHASE_PRICE_SUPPORTED_BY_CURRENT_PRODUCT_MODEL = FALSE`.

## Formula denominator audit
`PURCHASE_PRICE_ZERO_DIVISION_PATHS = 2` (`netYieldOnPrice`, `paybackOnPrice`), both already defensively guarded to avoid `Infinity`/`NaN`. `NONFINITE_OUTPUTS_AT_ZERO = 0` (confirmed: guards work correctly at the arithmetic level). `MATHEMATICALLY_FINITE_BUT_SEMANTICALLY_INVALID_OUTPUTS = ["netYieldOnPrice=0 despite NOI>0", "IRR=110% at near-zero price (economically fictitious, not zero-specific but part of the same underlying gap)"].`

## Monetary domain policy consistency (evidence, not copied blindly)
`STRICTLY_POSITIVE_DIVISOR_FIELDS` already existed with exactly one member: `maxPaybackThreshold`, following precisely this pattern (a field used as a divisor, required strictly positive, rejected via canonical `ValidationError`). `buildingPrice` fits the identical criteria (used as a divisor, same risk class) but had been omitted. `MONETARY_DOMAIN_POLICY_CONSISTENT = FALSE` (before fix) -- an existing, already-correct pattern simply wasn't applied to a second qualifying field.

**Noted but out of this task's explicit scope**: Land Development's `totalProjectCost` is used identically as a divisor (`capRateOnCost`, `simplePaybackYears`) with the same `>0?...:0` guard shape, but reaching `totalProjectCost=0` requires the *sum* of land acquisition and construction costs to be zero, not a single field -- structurally different from the direct single-field case here. This is flagged as a related observation for a possible future finding, not addressed in this OBS-001 disposition (task scope was purchasePrice specifically).

## Reachability (all paths, before fix)
`ZERO_REACHABLE_UI = TRUE` (no `min` on the NumField). `ZERO_REACHABLE_SAVED_DEAL = TRUE` (any UI-entered value persists). `ZERO_REACHABLE_DIRECT_ENGINE = TRUE` (confirmed via direct `calculateInvestmentCase` call). `ZERO_REACHABLE_LEGACY_ADAPTER`: N/A -- no legacy adapter exists for this field.

## Classification
**`OBS001_CLASSIFICATION = CLASS A: INVALID_DOMAIN_MISSING_VALIDATION`**

## Correction applied (Class A, narrowest central fix)
Added `'buildingPrice'` to the existing `STRICTLY_POSITIVE_DIVISOR_FIELDS` array in `src/validation/numeric-safety.js` -- reusing the identical architecture already proven for `maxPaybackThreshold`, not inventing a new rule or a new error class. One line changed.

```
price <= 0 → rejected (ValidationError, rule=STRICTLY_POSITIVE_REQUIRED)
price > 0  → accepted, unchanged behavior
```

`Land` is structurally unaffected -- its inputs object never contains a `buildingPrice` key, so the generic `field in inputs` check never fires for it.

## Live browser proof (real Chromium, after rebuild)
Entered `0` into the actual Building Purchase Price field: the **existing** validation disclosure (built in the earlier targeted R6 fix) fired automatically with zero new UI code -- "قيمة إدخال غير صالحة" / "Field \"buildingPrice\" value 0 must be strictly positive (it is used as a divisor)" in ar-SA, the English equivalent in en, zero cross-locale leakage. Last-valid result (previous GO verdict) remained displayed throughout. Corrected back to a valid price: disclosure cleared and a genuine new recommendation ("Recommended"/GO) was recalculated. Zero page errors.

**Process note**: the first browser-test attempt showed no disclosure at all -- root-caused to having forgotten to run `npm run build` after editing `numeric-safety.js` (the Playwright test serves the last-built `dist/`, not live source). Rebuilt, re-ran, confirmed working correctly. Documented rather than hidden.

## Valid-case invariance
RE-GOLD-002 baseline (positive price): verdict/metCount unchanged (`GO`, `4/4`). COV-002's Existing Building NO-GO fixture (inflated but positive price): still reaches NO-GO correctly -- `RECOMMENDATION_THRESHOLDS_CHANGED = FALSE`, `COV002_EXISTING_NO_GO = PASS`. Land Development baseline: unaffected (`GO`, unchanged).

## Production freeze proof
`recommendation/index.js` and `financial/index.js` SHA-256 confirmed byte-identical before/after (untouched -- only `numeric-safety.js`'s array was modified). `App.jsx` MD5 unchanged -- zero UI code added; the pre-existing R6 disclosure architecture handles presentation automatically for any `ValidationError`, regardless of which field triggers it.

## Permanent test
`tests/characterization/run_obs001_purchase_price_zero.js` -- 11/11 assertions, encodes the disposition (rejection, not merely current behavior), including COV-002 and Land non-regression checks.

## i18n freeze
No new dictionary keys needed -- `ValidationError`'s existing bilingual `message_ar`/`message_en` construction and the existing `validationDisclosure` presentation architecture (from the prior targeted R6 fix) cover this automatically.

## Regression
69/69 (1 new permanent file). Core 6/6, Secondary 7/7, Storage Provider 6/6, 0 page errors. Canonical source unchanged.

## Gate
OBS-001 = RESOLVED_INVALID_DOMAIN
OBS001_GATE = PASS

## Post-disposition state
DEF-001..004 = RESOLVED, COV-001 = RESOLVED, COV-002 = RESOLVED, OBS-001 = RESOLVED.
SDI-001 = OPEN_FOR_LATER_HARDENING, SDI-002 = OPEN_FOR_LATER_HARDENING (untouched, as required).
`ALL_FINDINGS_RESOLVED = FALSE`. `PRODUCTION_READY = FALSE`.

NEXT: Saved Deal data-integrity hardening (SDI-001, SDI-002), then production readiness.
