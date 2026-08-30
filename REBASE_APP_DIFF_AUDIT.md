# REBASE_APP_DIFF_AUDIT
Generated via `diff -u platform-source.jsx src/app/App.jsx` (real structured diff tool, not memory-based summary). Full output: 332 lines, exactly 3 hunks.

| diff_id | canonical_lines | working_lines | category | reason | behavior_change | test_evidence |
|---|---|---|---|---|---|---|
| DIFF-1 | 87-386 (300 lines) | 87-103 (17 lines) | CALCULATION_BODY_REMOVAL | Removed the 6 inline calculation function bodies (computeNPV, computeIRR, amortizationSchedule, tierVerdict, calcExistingBuilding, calcLandDevelopment) + VACANCY_MONTHS_MAP, replaced with a single `require('../engines')` import line and an explanatory comment. DEFAULT_BUILDING_INPUTS/DEFAULT_LAND_INPUTS (which follow immediately after) are UNCHANGED and NOT part of this hunk. | run_dual_path.js, run_triple_path.js: 0 mismatches (the imported functions are the verbatim-extracted originals) |
| DIFF-2 | 761 (1 line) | 478 (1 line) | CALCULATION_CALLSITE_REPLACEMENT | `buildSensitivityData`'s calc dispatcher changed from a direct function reference (`calcExistingBuilding`/`calcLandDevelopment`) to a wrapper calling `calculateInvestmentCase()` | NONE | run_sensitivity_path.js: 0 mismatches, LEGACY_CALC_CALLS_IN_SENSITIVITY=0 |
| DIFF-3 | 1528-1529 (2 lines) | 1245-1246 (2 lines) | CALCULATION_CALLSITE_REPLACEMENT | The two `useMemo` calculation call sites changed from direct function calls to `calculateInvestmentCase()` calls | NONE | run_ui_path.js: 0/204 mismatches |

APP_DIFF_HUNKS_TOTAL = 3
APP_DIFF_HUNKS_CLASSIFIED = 3
UNCLASSIFIED_APP_DIFF_HUNKS = 0
UNEXPLAINED_APP_DIFFERENCES = 0
PRODUCTION_BEHAVIOR_DIFF_HUNKS = 0 (all 3 hunks are structural wiring only, each independently proven behavior-neutral by a passing test)

## Explicit UI preservation check
None of the 3 hunks touch: JSX/layout, input defaults, labels, field ordering, study mode names, Saved Deals labels/buttons/logic, Reset behavior, recommendation text, KPI labels, sensitivity dimension definitions (the `vars` arrays, labels, and 0.9/1.1 perturbation factors are byte-identical, confirmed by direct inspection of DIFF-2's surrounding unchanged context lines), CSS/className values, dashboard structure, cash-flow display, financing toggle, or Levered/Unlevered display -- all of that code is OUTSIDE the 3 diff hunks entirely, confirmed by the diff tool itself showing zero additional hunks.

INPUT_DEFAULT_CHANGES = 0 | UI_LABEL_CHANGES = 0 | STYLE_CHANGES = 0 | SAVED_DEAL_BEHAVIOR_CHANGES = 0 | RECOMMENDATION_TEXT_CHANGES = 0 | SENSITIVITY_DIMENSION_CHANGES = 0
