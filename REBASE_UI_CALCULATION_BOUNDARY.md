# REBASE_UI_CALCULATION_BOUNDARY (before-state, from platform-source.jsx)

## Active study input selection
`App` (line 1526) holds `mode` state ("building"/"land"), and two separate input-state objects `buildingInputs`/`landInputs` (lines 1528-1529). `leverageEnabled` lives INSIDE each of those input objects (a field within `DEFAULT_BUILDING_INPUTS`/`DEFAULT_LAND_INPUTS`), not as separate App-level state.

## Exact calculation call sites (3 total, confirmed by direct grep)
1. Line 1531: `const buildingResults = useMemo(() => calcExistingBuilding(buildingInputs), [buildingInputs]);`
2. Line 1532: `const landResults = useMemo(() => calcLandDevelopment(landInputs), [landInputs]);`
3. Line 764 (inside `buildSensitivityData`): `const calc = mode === "building" ? calcExistingBuilding : calcLandDevelopment;` -- then called twice per variable (lo/hi) inside a loop.

## Result consumption (after calculation)
- `results = mode === "building" ? buildingResults : landResults` (single active-mode selection, consumed by:)
- KPIRibbon (receives `results`, `mode`)
- DashboardTab (receives `results`, `mode`, `inputs`) -- reads dozens of individual fields directly (NOI, irr, npv, dscrMin, verdict, etc.)
- CashFlowTab (receives `results.cashflows`/`results.leveredCashflows`)
- SensitivityTab (receives `inputs`, `mode` -- calls `buildSensitivityData` itself, which re-invokes the calc function directly, NOT via `results`)
- RecommendationCard (receives `results.verdict`, `results.metCount`, `results.totalCriteria`)

No guessing performed -- every line/consumer above verified by direct grep against the canonical source before this document was written.
