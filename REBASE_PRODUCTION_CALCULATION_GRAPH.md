# REBASE_PRODUCTION_CALCULATION_GRAPH
Based on actual current code references, verified by direct grep this pass.

## Main production path
```
src/app/App.jsx (lines 1245-1246, verified via REBASE_APP_DIFF_AUDIT.md DIFF-3)
  → useMemo(() => calculateInvestmentCase({studyType, inputs, leverageEnabled}))
    → src/engines/index.js: calculateInvestmentCase()
      → dispatches by studyType to:
        src/engines/valuation/existing-building.js: calcExistingBuilding()
        OR
        src/engines/valuation/land-development.js: calcLandDevelopment()
      → each internally calls src/engines/financial/index.js (computeNPV/computeIRR/amortizationSchedule)
        and src/engines/recommendation/index.js (tierVerdict)
  → returns raw engine result object
  → consumed directly by results.NOI/results.irr/results.verdict/etc. in DashboardTab/KPIRibbon/RecommendationCard
    (facades src/engines/{valuation,financing}/index.js + src/engines/{financial,recommendation}/selectors.js
     are available for StudyDefinition consumers -- see WB-13/WB-14 -- but App.jsx's own useMemo consumes
     the raw result directly, confirmed: no facade import present in App.jsx per DIFF-1/DIFF-3)
```
Verified by: run_ui_path.js (0/204 mismatches, executes this exact call pattern)

## Sensitivity path
```
App.jsx buildSensitivityData (line 467, verified via REBASE_APP_DIFF_AUDIT.md DIFF-2)
  → calc = (i) => calculateInvestmentCase({...})
    → SAME src/engines/index.js entrypoint as main path
      → SAME two study engines
```
Verified by: run_sensitivity_path.js (0 mismatches, LEGACY_CALC_CALLS_IN_SENSITIVITY=0, extracted and executed the ACTUAL function body from App.jsx)

SENSITIVITY_PRODUCTION_PATHS = 1 (confirmed identical entrypoint to main path, not a parallel implementation)

## Saved Deal path
```
Saved Deal record ({id, name, mode, inputs, savedAt} -- unchanged shape, confirmed SAVED_DEAL_SCHEMA_CHANGED=false)
  → loadDeal() -- unchanged in App.jsx (outside all 3 diff hunks)
    → setBuildingInputs/setLandInputs({...DEFAULT_*_INPUTS, ...record.inputs}) -- unchanged merge logic
      → flows into the SAME buildingInputs/landInputs state consumed by the main path's useMemo above
        → SAME calculateInvestmentCase() entrypoint
```
Verified by: run_saved_deal_compatibility.js (2/2 cases, 0 mismatches, using the actual extracted DEFAULT_*_INPUTS + the documented exact merge pattern)

SAVED_DEAL_CALCULATION_PATHS = 1 (no separate calculation logic for loaded deals -- they flow through the identical state → useMemo → calculateInvestmentCase chain as freshly-typed inputs)

## Hidden path search result
Grep across the complete src/ and tests/ trees for calcExistingBuilding/calcLandDevelopment/computeIRR/computeNPV: every hit is either (a) the function DEFINITION inside src/engines/ itself, (b) an ENGINE_INTERNAL call from one engine file to another within src/engines/, or (c) a TEST_ONLY reference inside tests/. Zero hits inside src/app/ or src/modules/ outside the 3 documented calculateInvestmentCase call sites.

ACTIVE_PRODUCTION_CALCULATION_PATHS = 1
ACTIVE_LEGACY_CALCULATION_CALLS = 0
