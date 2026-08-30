# I18N_R2B1_PROPERTY_AREA_COST_FINAL_REPORT

## Authoritative 23 IDs
MR-B01..MR-B12 (Building: areas ×6, purchase cost ×6)
MR-L01..MR-L11 (Land: areas ×6, cost ×5)

## Label inventory (23 dictionary keys under `metricRow`)
landArea, totalBasementArea, totalFloorArea, netLeasableAreaApproved, coverageRatio, areaCheck (+ areaCheckOk/Fail),
parkingSpotsNote, avgAreaPerFloorNote, buildingPurchasePrice, commissionAmount, transferFeeAmount,
inspectionAndValuationCost, totalPurchaseCost, costPerLeasableSqm, landMarketValue, floorPlateArea,
totalNetLeasableArea, totalConstructionCost, landCommissionAndTransferFee, totalLandAcquisitionCost, totalProjectCost.

## Formatter usage (within the 23 rows)
fmtSAR-equivalent (formatRecommendationCurrency, reused from R1B): 12 calls
fmtNum+area (new formatMetricArea): 8 calls
fmtNum+currency/area (new formatMetricCurrencyPerArea): 2 calls
fmtX (unchanged, numeric-only): 1 call
ternary string (areaCheckOk/Fail): 1 call

## Units
New keys added: `units.squareMeters` (م²/m²), `units.sarPerSquareMeter` (ريال/م² / SAR/m²), `units.parkingSpots`.
Reused: `units.sar`.
Global fmtSAR/fmtYears/fmtPct/fmtNum: **untouched** -- all new formatting goes through local helpers inside DashboardTab, exactly as in R1B/R2-A.

## Localization architecture
Two new local helpers (`formatMetricArea`, `formatMetricCurrencyPerArea`) added alongside the existing R1B helpers inside `DashboardTab`. Zero global formatter changes. Zero scattered `locale ===` conditionals -- all localization flows through `t()`.

## Arabic / English proof (real Chromium, both study types)
Initial broad-scope Arabic-character scan produced a false positive: the DOM selector matched an ancestor `<div>` spanning the entire page (including the still-untranslated 8-section input panel and `MetricGroup` headings like "القسم الثاني" -- both explicitly out of R2B-1 scope). A precisely re-scoped test (string-sliced from "Land Area" through "Cost per Leasable Square Meter") confirmed: **all 12 Building MetricRow labels/values/notes render in pure English with zero Arabic characters**, except the two out-of-scope `MetricGroup` heading words, which are correctly untranslated pending R2B-2/R3. Land Development (MR-L01..L11) confirmed via targeted string checks in both directions.

## Numeric invariance
Raw engine values (NOI=14,859,936; IRR=14.90%; stabilizedNOI=12,307,075.2) identical regardless of locale -- confirmed via the permanent test's direct engine calls, which never pass a locale parameter.

## Source scope isolation
One coincidental text match outside the intended 23 ("قيمة شراء المبنى") was found in a `<NumField>` input-panel call site -- confirmed to be a different component (`BuildingInputPanel`, explicitly forbidden scope), left untouched.

## V1A / R1 / R2-A preservation
`run_verdict_presentation_invariance.js`: 11/11 PASS (unaffected).
`RecommendationCard`/`KPIRibbon`: not touched this wave: confirmed via full regression pass.

## RE-GOLD / COV-001
Legacy fixtures unmodified. `run_cov001_forward_noi.js` still PASS.

## Regression / Core / Secondary
24/24 direct pass (22 pre-existing categories + verdict + new R2B-1 test). Core 6/6, Secondary 7/7, 0 page errors.

## Responsive / Security
Not independently re-tested this wave (no CSS/layout changes made -- only text content); Secondary E2E's 3 viewport checks (390/768/1440px) already re-ran clean as part of the standard suite. Security scan: 0 secrets, 0 absolute path leaks across all 5 changed files and dist output.

## Remaining
R2B-2 (30 rows: income/opex/valuation/appraisal) and R2B-3 (13 rows: financing-conditional) not started -- inventory confirms both counts unchanged.
