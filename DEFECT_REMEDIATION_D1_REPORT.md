# DEFECT_REMEDIATION_D1_REPORT

## Fixes applied
1. src/validation/numeric-safety.js -- centralized Number.isFinite() + occupancyRate [0,1] range check, single boundary at calculateInvestmentCase (src/engines/index.js).
2. src/app/App.jsx buildSensitivityData -- bounded-occupancy scenario-generation metadata (requestedValue/effectiveValue/boundaryLimited/boundaryReason), canonical engine boundary unchanged.
3. src/app/App.jsx useMemo (buildingResults/landResults) -- catch ValidationError, retain last-known-valid result via useRef, surface a clear dismissible warning banner. This second fix was NOT originally requested but was discovered to be required: without it, any invalid input froze the entire app (blur() timing out at 30000ms), a strictly worse outcome than the defects being fixed.

## Evidence summary
DEF_002_PRE_FIX_REPRODUCED = TRUE
DEF_003_PRE_FIX_REPRODUCED = TRUE
DEF_002_POST_FIX_REJECTED = TRUE (DIRECT-01/04, UI banner test)
DEF_003_POST_FIX_REJECTED = TRUE (DIRECT-02/03, 309-digit UI test)

SENSITIVITY_USES_MODULAR_ENGINE = TRUE
SENSITIVITY_ENGINE_VALIDATION_BYPASS = FALSE
SENSITIVITY_INVALID_OCCUPANCY_CASES = 0
SENSITIVITY_BOUNDARY_LIMITING = PASS (5/5)

DIRECT_ENGINE_REJECTION = PASS (4/4)

APP_FREEZE_ON_INVALID_INPUT_PRE_FIX = TRUE (blur() timeout 30000ms, empirically confirmed)
APP_FREEZE_ON_INVALID_INPUT_POST_FIX = FALSE
LAST_VALID_RESULT_PRESERVED = TRUE
VALIDATION_BANNER_VISIBLE_ON_ERROR = TRUE
VALIDATION_BANNER_CLEARS_ON_VALID_INPUT = TRUE
VALIDATION_BANNER_SHOWS_ACTUAL_FIELD_AND_VALUE = TRUE

CORE_RUNTIME_E2E = PASS (6/6)
SECONDARY_E2E = PASS (7/7)
REGRESSION_TEST_SCRIPTS = 15/15 PASS
BUILD_STATUS = PASS
PAGE_ERRORS = 0

RE_GOLD_001_U/L, RE_GOLD_002_U/L = PASS
CANONICAL_SOURCE_HASH_UNCHANGED = TRUE

## DEF-002/DEF-003 status
DEF_002 = RESOLVED
DEF_003 = RESOLVED
DEF-001 and DEF-004 = untouched, unchanged, as instructed.

## Scope discipline
No formula changed. No RE-GOLD fixture changed. No engine calculation logic
touched beyond the single validation call inserted at the canonical boundary.
NO_COMMIT = TRUE throughout.
