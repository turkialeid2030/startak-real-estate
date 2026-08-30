# OBS002_LAND_TOTAL_PROJECT_COST_ZERO_FINAL_DISPOSITION_REPORT

## totalProjectCost construction (traced, not assumed)
`TOTAL_PROJECT_COST_COMPONENTS`: `landMarketValue` (`landLength × landWidth × landPricePerSqm`) → `totalLandAcquisitionCost` (+ `landCommission` + `landTransferFee` + `engineeringCost` + `landValuationCost`) + `totalConstructionCost` (`totalBuiltArea × constructionCostPerSqm`, where `totalBuiltArea` depends on `buildableRatio`/`officeFloorCount`/`basementFloorCount`). `ZERO_TOTAL_PROJECT_COST_REACHABILITY`: requires **4 independent fields simultaneously zero** (`landPricePerSqm`, `engineeringCost`, `landValuationCost`, `constructionCostPerSqm`) -- structurally harder to reach than OBS-001's single-field case, but not impossible through ordinary UI entry.

## Reproduction (component-level sweep, not faking the derived aggregate)
| factor | totalProjectCost | verdict | metCount | IRR |
|---|---|---|---|---|
| 1 (baseline) | 100,340,000 | GO | 4/4 | 14.6% |
| 0.01 | 1,003,400 | GO | 4/4 | 227% |
| 0.0001 | 10,034 | GO | 4/4 | 1,376% |
| **0** | **0** | **NO-GO** | **2/4** | **NaN** |

`OBS002_REPRODUCED = TRUE`. `OBS002_ZERO_DISCONTINUITY = TRUE` -- and notably **worse** than OBS-001: `IRR` becomes literal `NaN` at exactly zero (a genuinely non-finite output), not merely a finite-but-misleading value.

## Domain contract (before fix) / business semantics
No layer enforced `totalProjectCost > 0` -- only generic `requireFinite` on individual numeric fields. `totalProjectCost` represents the full cost basis of a land-development project; the current product model has no concept of a zero-cost development. `ZERO_TOTAL_PROJECT_COST_SUPPORTED_BY_CURRENT_PRODUCT_MODEL = FALSE`.

## Classification
**`OBS002_CLASSIFICATION = CLASS A: INVALID_DOMAIN_MISSING_VALIDATION`**

## Correction applied
Since `totalProjectCost` is a derived aggregate (not a single input field), it cannot join `STRICTLY_POSITIVE_DIVISOR_FIELDS` directly. Per this task's own guidance ("validate the derived aggregate at the earliest canonical point where all components are available"), a new block was added to `validateEngineInputs()` that recomputes `totalProjectCost` using the identical formula `land-development.js` uses, then rejects if `≤ 0`.

## Critical design error caught mid-session, disclosed in full
The new block was first guarded by `'buildableRatio' in inputs`... actually, the **first attempt** used `'landLength' in inputs` as the guard, reasoning it was Land-exclusive. An immediate full-regression check (run reflexively after every production change this session) caught 3 test failures. Root-caused directly: `landLength` is **also** present in `DEFAULT_BUILDING_INPUTS` (`landLength: 100, landWidth: 53.26, buildingAge: 1` -- describing the plot a building sits on). Had this shipped, every Building calculation would have silently attempted to compute a Land-only formula using undefined fields (`buildableRatio`, `officeFloorCount`, etc. -- all `undefined` for Building), producing `NaN`, which happened to evaluate `NaN <= 0` as `false` and not throw by accident -- a fragile, unintended near-miss, not a safe design. Corrected immediately to `'buildableRatio' in inputs`, confirmed genuinely exclusive to Land (Building's equivalent concepts use different names entirely: `floorCount`/`basementCount`), and the full regression suite re-run clean before proceeding further.

## Regression test count change (also disclosed, not silently absorbed)
Adding this 4th `throw new ValidationError` site broke `run_r6c_full_closure.js`'s `PRODUCERS-3` assertion (an intentional guard from R6-C protecting against undetected new validation rules). This was not a defect in the new code -- it was that guard correctly detecting a legitimate, later-authorized change. Updated the assertion to `PRODUCERS-4` with an explanatory detail string; `run_r6d_full_closure.js`/`run_r6e_full_closure.js` (which orchestrate it via child process) passed automatically once the underlying test was corrected -- no separate changes needed in either.

## Live browser proof (real Chromium, after rebuild)
Zeroed `landPricePerSqm` and `constructionCostPerSqm` together in ar-SA: disclosure appeared mentioning "إجمالي تكلفة المشروع" (confirmed via direct text search -- the only place this phrase exists in the dictionary is this new message). Corrected back to valid values: disclosure cleared, zero page errors.

**English-locale browser path -- closed in a follow-up targeted session.** Root cause of the earlier gap identified precisely: after switching to `en`, field labels change to their English text, so continuing to search for Arabic labels (as the first attempt did) cannot find the inputs -- an identical class of mistake to earlier "forgot to rebuild"/"wrong-locale-label" issues in this program, not an application defect. Fixed by using the exact English labels for all 4 fields ("Price per Square Meter (Market Price)", "Engineering Office and Permit Fees", "Land Valuation", "Total Construction Cost per Sqm") and re-running the complete sequence fresh: html `lang=en`/`dir=ltr` confirmed; all 4 components set to `0` via their real EN-labeled controls (verified via `inputValue()`, not assumed); DOM-level (not just the `message_en` object) confirmation that "Invalid Input Value" and "Total project cost" both render; **zero** Arabic-character fragments in the disclosure (excluding the registered "ع" invariant); **no "NaN" string ever appears in the rendered page** -- the original pre-fix defect (a live NaN result) does not resurface; last-valid NPV preserved unchanged through the invalid state; an actual Save attempt while zero-cost-invalid was blocked (deal count in `localStorage` unchanged) -- confirming SDI-002's guard fires correctly in English too; full recovery (all 4 components corrected to positive) cleared the disclosure with a finite new result; app remained interactive; zero page errors throughout.

## Building non-regression (explicit, not assumed)
`'buildableRatio' in B` (full RE-GOLD Building inputs) confirmed `false` -- the new block is structurally inert for every Building call. Full RE-GOLD Building validation and calculation both confirmed unaffected (`GO`, unchanged).

## Cross-finding regression
OBS-001 (`buildingPrice=0` rejection, independent field/rule): unaffected. COV-002 (both NO-GO fixtures): unaffected. SDI-001/SDI-002 (structural validation, save-gating): both operate on the same `validateEngineInputs()`, automatically inheriting this new rule for Land saves with zero cost -- no separate wiring needed, consistent with SDI-002's architecture of calling the canonical validator directly.

## Production diff
`numeric-safety.js`: one new conditional block (~12 lines), reusing the existing `ValidationError` class and bilingual message pattern. `recommendation/index.js` and `financial/index.js` SHA-256 confirmed byte-identical (untouched). `App.jsx`: **zero changes** -- this rule is inherited automatically by every existing consumer of `validateEngineInputs()` (the `useMemo` calculations, and now also SDI-002's save/update guards).

## Regression
77/77 (1 additional permanent EN-browser-evidence file added in the follow-up session, on top of the 76 from the initial disposition). Core 6/6, Secondary 7/7, Storage Provider 6/6, 0 page errors. Canonical source unchanged. `App.jsx` unchanged in the follow-up session -- this was qualification only, zero new production code.

## Gate
OBS002_GATE = PASS
OBS-002 = RESOLVED_INVALID_DOMAIN

## Post-pass state
DEF-001..004 = RESOLVED, COV-001/002 = RESOLVED, OBS-001/002 = RESOLVED, SDI-001/002 = RESOLVED.
**All tracked findings are now resolved.** `PRODUCTION_READY` is **not** thereby declared `TRUE` -- per this task's explicit instruction, an independent release-readiness gate (security, runtime, deployment, package integrity, failure handling, environment/production configuration, final evidence reconciliation) remains a separate, not-yet-performed stage.
