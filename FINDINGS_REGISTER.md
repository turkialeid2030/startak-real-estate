# FINDINGS_REGISTER

Non-i18n findings discovered incidentally during the i18n localization program. Tracked here for later hardening; never fixed as part of an i18n wave.

---

## SDI-001 — Saved Deal Structural Schema Validation Gap

**Classification**: DATA_INTEGRITY / HARDENING (NOT_I18N)
**Status**: OPEN_FOR_LATER_HARDENING
**Discovered**: R6-B, confirmed again in R6-D

**Finding**: `loadDeal()` (in `src/app/App.jsx`) rejects a persisted Saved Deal record only when `JSON.parse(value)` itself throws (syntactically invalid JSON). It performs no further structural validation on a successfully-parsed object — a well-formed JSON object missing required fields (e.g. no `inputs`, no `mode`) is silently accepted and merged with `DEFAULT_BUILDING_INPUTS`/`DEFAULT_LAND_INPUTS`, with no error surfaced to the user.

**Impact**: A corrupted-but-JSON-valid Saved Deal record (e.g. from a future schema change, a manual `localStorage` edit, or a partial write) could load with silently-defaulted fields rather than being rejected, potentially showing a study that does not reflect what the user actually saved.

**Not fixed here because**: fixing this requires a genuine schema-validation design decision (what fields are required, what error code/message to add, whether to reject or repair) — out of scope for i18n presentation work, and explicitly excluded from R6-D's mandate ("Do not fix this in R6-D").

**Recommended next step**: a dedicated hardening pass that adds structural validation to `loadDeal()` (e.g. require `mode` and `inputs` to be present) with its own stable error code, following the same architecture already established for `DEAL_LOAD_FAILED` et al.

---

## SDI-002 — Saved Deal Can Persist Invalid Current Input

**Classification**: DATA_INTEGRITY / DECISION_SAFETY (NOT_I18N)
**Status**: OPEN_FOR_LATER_HARDENING
**Discovered**: R6-D

**Finding**: `saveCurrentAsNewDeal()` performs no validation check before persisting -- if the current live input state is invalid (e.g. `occupancyRate=200%`, which the calculation-boundary `validateEngineInputs()` would reject and which triggers the active stale-result disclosure), the raw invalid value is saved as-is into the new Saved Deal record. Live-verified: with the disclosure active, opening Saved Deals and saving succeeded, and the persisted record's `occupancyRate` field contained the invalid `2` (200%).

**Impact**: A user could unknowingly save a deal that, when later loaded, would itself immediately trigger the same validation rejection -- potentially confusing, since the save action itself gave no warning that the current state was invalid.

**Not fixed here because**: deciding whether to block saving while invalid (and what UX that should have) is a product/decision-safety design choice, out of scope for i18n presentation work.

**Recommended next step**: consider disabling the save action (or warning explicitly) while `activeValidationError` is non-null, consistent with the existing stale-result disclosure's spirit of never presenting invalid state as though it were normal.

