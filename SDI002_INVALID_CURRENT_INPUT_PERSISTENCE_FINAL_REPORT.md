# SDI002_INVALID_CURRENT_INPUT_PERSISTENCE_FINAL_REPORT

## Reproduction (before fix, real UI)
`SDI002_REPRODUCED = TRUE`: occupancyRate=200% → validation disclosure active → clicked actual "Save New Deal" → `INVALID_RAW_VALUE_PERSISTED = TRUE` (persisted `occupancyRate=2` exactly). `LAST_VALID_RESULT_VISIBLE = TRUE` throughout.

## Save paths traced
`SAVED_DEAL_WRITE_PATHS = 2`: `saveCurrentAsNewDeal`, `updateActiveDeal`. Both consume `inputs` (current, live React state) directly -- neither reads last-valid cached values or `activeValidationError` for their record construction, confirming the record always reflects current-screen state (which is exactly why it needed gating, not substitution).

## Canonical active validation state
`CANONICAL_ACTIVE_VALIDATION_STATE`: `validateEngineInputs()` in `numeric-safety.js` -- the same function `calculateInvestmentCase()` invokes internally for both studies. Per this task's explicit architectural requirement, persistence safety does **not** depend on the derived UI state (`buildingValidationError`/`landValidationError`); the guard calls this canonical function directly and independently.

## Policy implemented
`INVALID CURRENT STATE → SAVE/UPDATE REJECTED`. No substitution of last-valid inputs, no silent repair, no form mutation. User remains on their current (invalid) screen exactly as typed.

## Production change (narrow, both write paths)
One identical guard added at the top of both `saveCurrentAsNewDeal` and `updateActiveDeal`, before any state/storage mutation begins:
```js
try { validateEngineInputs({ ...inputs, leverageEnabled: inputs.leverageEnabled }); }
catch (e) { if (e.name === 'ValidationError') return; throw e; }
```
On block: silent `return` -- no new `dealsError` code introduced. The existing R6 active-validation disclosure (already visible whenever this condition holds) already explains the rejection; per this task's explicit instruction, `DEAL_SAVE_FAILED`/`DEAL_UPDATE_FAILED` (storage-infrastructure codes) are never used for this. Non-`ValidationError` exceptions are explicitly re-thrown (`throw e`), not swallowed -- confirmed by test (`UNEXPECTED_ERRORS_SILENTLY_SWALLOWED = FALSE`).

## Self-caught test-tooling error (disclosed)
The first browser-test draft referenced a Node-scope variable (`dealId`) directly inside `page.evaluate()`, which runs in an isolated browser context -- this always fails, regardless of application behavior. Root-caused immediately (not blamed on the application), fixed by passing the value as an explicit `evaluate` argument, and the complete test was re-run from a clean state rather than resumed.

## Live browser proof (real Chromium, full sequence, single continuous session)
- **Occupancy 200%, new save**: 0 new `deal:` keys created, `deals-index` byte-identical before/after, raw form value remained `"200"` (not silently reset).
- **buildingPrice=0, new save**: blocked identically (OBS-001's rule reused via the same guard, not duplicated); active-validation disclosure remained visible.
- **Valid save (control)**: succeeded normally, proving the guard doesn't block legitimate records.
- **Invalid update on an existing deal**: target record string byte-identical before/after the blocked update attempt; `deals-index` unchanged.
- **Unrelated control deal** (a second, separate record established before any invalid-save testing): confirmed byte-identical throughout the *entire* multi-step sequence -- proves the guard's effect is precisely scoped, not a broader side effect.
- **Recovery**: corrected `buildingPrice=150000000` actually present in the record after a successful post-recovery update -- not any cached last-valid value.
- **Land**: identical guard blocks Land's shared `occupancyRate` rule; corrected Land save succeeds afterward -- study-agnostic.
- **EN presentation**: existing "Invalid Input Value" disclosure explains the block with zero new UI code.
- **Zero page errors** across the entire session.

## Regression (all re-confirmed this session)
SDI-001: `STRUCTURALLY_INVALID_RECORDS_ACCEPTED = 0`, unaffected (separate layer). OBS-001: `buildingPrice=0/negative` still rejected. COV-002: both NO-GO fixtures still reachable. I18N_FULL: no new dictionary keys, existing bilingual disclosure architecture handles this automatically.

## Production diff
Exactly: one new `require` (`validateEngineInputs`, already existed as a module export, not newly created) + the identical 2-line guard in each of the 2 write functions. `SAVED_DEAL_SCHEMA_CHANGED_SDI002 = FALSE`, `FINANCIAL_FORMULAS_CHANGED_SDI002 = FALSE`, `RECOMMENDATION_LOGIC_CHANGED_SDI002 = FALSE`, `VALIDATION_RULES_DUPLICATED_SDI002 = FALSE` (the exact same function, not a reimplementation).

## Permanent tests
`tests/saved-deals/run_sdi002_invalid_save_block.js` (8/8), `run_sdi002_invalid_update_block.js` (2/2, source-level guard-presence proof), `run_sdi002_recovery.js` (2/2), `run_sdi002_real_browser_path.js` (10/10, documents this session's live evidence), `run_sdi002_full_closure.js` (orchestrates all 5, including SDI-001). All confirmed in the standard `tests/saved-deals/*.js` discovery glob.

## Regression
75/75 (5 new permanent files). Core 6/6, Secondary 7/7, Storage Provider 6/6, 0 page errors. Canonical source unchanged. `App.jsx` MD5 reflects exactly the narrow guard addition described above.

## Gate
SDI002_GATE = PASS
SDI-002 = RESOLVED

## Post-pass state
SDI-001 = RESOLVED, SDI-002 = RESOLVED. NEXT: OBS-002 (Land `totalProjectCost` zero-domain discontinuity, flagged as a related observation during OBS-001, still unclassified). `PRODUCTION_READY = FALSE` until OBS-002 is independently dispositioned.
