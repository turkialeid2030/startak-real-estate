# SDI001_SAVED_DEAL_STRUCTURAL_SCHEMA_VALIDATION_FINAL_REPORT

## Current record contract (re-discovered, not assumed)
`CURRENT_SAVED_DEAL_RECORD_FIELDS` = `{id, name, mode, inputs, savedAt}`. `CURRENT_INDEX_STRUCTURE` = array of `{id, name, mode, savedAt}` under key `deals-index`. `CURRENT_STORAGE_NAMESPACE` = `STARTAK_REAL_ESTATE:SAVED_DEALS:`. No schema-version field exists in the record.

## Legacy investigation -- important finding
`src/migrations/legacy-saved-deal-adapter.js` exists, but traced its actual purpose: it converts a record of the **exact same current shape** into a separate `ExecutableInvestmentCase` structure for a different consumer -- it is not an adapter for an *older, different* Saved Deal shape that `loadDeal()` needs to accept. `SUPPORTED_LEGACY_RECORDS_IDENTIFIED = FALSE` for the `loadDeal()` path specifically -- there is exactly one supported structural shape, not a legacy/canonical duality to reconcile.

## Architecture (new file, non-invasive)
`src/validation/saved-deal-schema.js` -- `validateSavedDealRecord(parsed)`: envelope must be a plain object (rejects null/array/string/number); `mode` must be exactly `'building'` or `'land'`; `inputs` must be a plain object (rejects null/array/primitive); `id`/`name`, if present, must be strings. Returns the same object unmodified on success; throws `SavedDealValidationError` (safe enumerated `reasonCode`, no raw record/stack/path) on failure. Explicitly does **not** duplicate `numeric-safety.js`'s economic-domain rules (e.g. OBS-001's `buildingPrice>0`) -- structure and domain validation remain separate layers, confirmed by regression.

## Wiring (minimal, one call site)
`loadDeal()` in `App.jsx`: added `validateSavedDealRecord(record)` immediately after `JSON.parse(value)`, before `setMode`/`setBuildingInputs`/`setLandInputs`. The pre-existing generic `catch(e)` (already present, unchanged) catches `SavedDealValidationError` the same way it catches a `JSON.parse` `SyntaxError` -- both map to the same existing public `DEAL_LOAD_FAILED` code with zero new UI code. `DEAL_LOAD_FAILED_PUBLIC_CONTRACT_CHANGED = FALSE`.

## Self-caught critical error during editing (disclosed, not hidden)
While adding the new `require`, a `str_replace` briefly **replaced** the entire existing `domain-presentation.js` import line instead of adding alongside it -- which would have deleted `getVerdictLabel`, `getDealDisplayName`, `getProjectTitleDisplay`, etc. This was caught immediately via a `grep` count check and full regression re-run *before* proceeding to any further edit, and corrected in the same turn. Documented here in full rather than omitted, consistent with this program's standing practice.

## Malformed structural matrix (12 cases, all rejected)
`null`, array, string, number, missing `mode`, unknown `mode`, missing `inputs`, `inputs=null`, `inputs=array`, `inputs=primitive`, wrong-type `id`, wrong-type `name` -- `STRUCTURALLY_INVALID_RECORDS_ACCEPTED = 0`.

## Non-destructive proof
Object reference and JSON content identical before/after a successful validation call (no field added/removed/coerced). Live browser: injected a structurally malformed record (missing `inputs` entirely) directly into `localStorage`, attempted load through the real UI, confirmed via direct read that the raw stored bytes were byte-identical before and after the failed load attempt. `MALFORMED_RECORD_STORAGE_MUTATED = FALSE`, `MALFORMED_RECORD_AUTO_DELETED = FALSE` (index/record both left untouched -- `FAILED_LOAD_INDEX_POLICY = "malformed entry remains in the index and storage; no automatic cleanup was added, consistent with not widening this task into repair UX"`).

## Live browser proof (real Chromium, after rebuild)
Both locales: "تعذّر تحميل الصفقة" / "The deal could not be loaded" displayed correctly, zero internal reason-code/class-name leakage in either render, zero page errors, app remained fully interactive afterward.

## Internal error type
`SavedDealValidationError` -- `name`, `reasonCode` (one of `ENVELOPE_NOT_OBJECT`/`INVALID_MODE`/`INVALID_INPUTS_SHAPE`/`INVALID_ID_TYPE`/`INVALID_NAME_TYPE`), safe short `detail` string (type names only, never raw values dumped). No stack trace or path ever included in the thrown message. `SAVED_DEAL_INTERNAL_DETAIL_LEAKAGE = 0`.

## Valid-record and cross-finding invariance
Building/Land GOLD-baseline records pass structural validation and still calculate identically (`verdict` unchanged). The separate `legacy-saved-deal-adapter.js` consumer still works unaffected (confirmed: `caseId`/`irr` match exactly). OBS-001 (`buildingPrice=0` rejection) and COV-002 (both NO-GO fixtures) re-confirmed unaffected -- different validation layers, no overlap.

## Test discovery note
The new permanent tests live under `tests/saved-deals/` (a new directory, created for this wave). Confirmed included in this session's master regression glob (70/70 total, up from 69). Flagging for the record that any external/CI regression runner must include this directory going forward, alongside the existing `tests/{characterization,architecture,defects,runtime,i18n}/` set.

## Regression
70/70 (1 new permanent file, `tests/saved-deals/run_sdi001_schema_validation.js`, 21/21 internal assertions). Core 6/6, Secondary 7/7, Storage Provider 6/6, 0 page errors. Canonical source unchanged. `App.jsx` MD5 changed (`af8d4e78...`) reflecting the new import + one-line validation call in `loadDeal` -- the only production change.

## Gate
SDI001_GATE = PASS
SDI-001 = RESOLVED

## Post-pass state
SDI-002 = OPEN_FOR_LATER_HARDENING (next, untouched here). OBS-002 (Land `totalProjectCost` zero-domain discontinuity) = OPEN_FOR_DISPOSITION (untouched, as required). `PRODUCTION_READY = FALSE`.
