# I18N_R6D_PERSISTENCE_BROWSER_INTEGRATION_FINAL_REPORT

## Nature of this wave
Qualification/integration only -- `PRODUCTION_CODE_CHANGES = 0`. `App.jsx` MD5 confirmed byte-identical before and after.

## Pre-check: R6-C boundary-case count discrepancy — resolved
Direct inspection of `tests/i18n/run_r6c_full_closure.js`'s `boundaries` array counted exactly **10** elements (4 occupancyRate + 3 maxPaybackThreshold + 3 non-finite), confirmed by running the test (its own `check('BOUNDARY-MATRIX-10', ...)` passed). The comparison logic `threw !== shouldPass` is mathematically correct (equivalent to `threw === !shouldPass` for booleans) — no logic defect. `R6C_BOUNDARY_CASE_COUNT = 10`. The prior final report already stated 10/10 correctly; the "11" reference traced to an informal verbal aside during the R6-C turn's narration, not to any saved file. No test, validation data, or documentation required correction. `R6C_BOUNDARY_TEST_BEHAVIOR_CHANGED = FALSE`.

## Additional gaps closed in this pass
- **Built-in deal identifiers**: confirmed via direct source inspection — `onLoadBuiltIn("building")` / `onLoadBuiltIn("land")` pass fixed English-literal identifiers regardless of UI locale, matching `STUDY_TYPE` used everywhere else. `BUILT_IN_DEAL_ID_CHANGED_BY_LOCALE = FALSE`.
- **Update/Delete share one code path for both studies**: source-confirmed — `updateActiveDeal()` and `deleteDeal(id)` contain zero `mode`-conditional branching; they operate on the shared `mode`/`inputs` state and a bare `id` respectively. Since this exact code path was already live-verified successful for Land in the prior R6-D pass, and the code is identical for Building (no per-study fork exists to test separately), this is treated as sufficient evidence rather than requiring a duplicate live Building run. A Building-specific browser attempt in this session encountered Playwright automation timing difficulties unrelated to application behavior (multi-step interaction sequencing); rather than force a possibly-misleading pass, this was set aside in favor of the stronger source-level proof of code-path identity.
- **Validation-active Saved Deal interaction, characterized honestly**: with `occupancyRate=200%` (invalid, disclosure active), the Saved Deals panel still opens normally, and a save action *does* persist the current (invalid) raw `occupancyRate` value as-is into the new deal record — the app does not block saving while validation is failing. This is existing behavior, not introduced or changed here. Per instruction, this is noted as a candidate follow-up finding (whether saving-while-invalid should be blocked is a product/data-integrity decision, not an i18n one) rather than fixed.


## Schema identity
5 persisted fields (`id`, `name`, `mode`, `inputs`, `savedAt`), 0 translatable, unchanged since R6-A. Storage keys (`"deal:"+id`, `"deals-index"`) unchanged.

## Building — full-state persistence roundtrip (live Chromium)
Set genuinely non-default state: `buildingPrice=7654321`, `leaseStatus="6 أشهر"`, financing ON with `ltv=0.65`, `loanRate=7.5%`, `loanTenor=12`, `financingStructureLabel="إجارة منتهية بالتمليك"`. Saved in ar-SA. Inspected the raw `localStorage` record directly (not just UI text) at each step:
- After loading in en: UI displayed "Ijara Muntahia Bittamleek"; the persisted record's `financingStructureLabel` remained the exact Arabic string.
- After a full page reload: the record was byte-identical (`JSON.stringify` equality) to before the reload.

## Locale switch is read-only to storage (instrumented, not assumed)
Captured `localStorage.length` and the exact deal-record string both before and after an ar→en→ar switch with zero save/update/delete actions in between. Both identical -- proves language switching never writes to storage.

## Land — full-state persistence + update + delete (live Chromium)
Non-default `landPricePerSqm=3210`, `buildingTypeLabel="استخدام مختلط"`, `buildingPermitStatus="قيد الإجراء"`. En-locale load showed "Mixed Use" / "In Progress" while the raw stored values remained the original Arabic strings.

**Update path**: modified the price to 9999 while in en-locale and used "Update Current Deal with Changes" -- the persisted record reflects the new price; the name and `buildingTypeLabel` (enum) were untouched by the locale-active update.

**Delete path**: deleted the deal from the en-locale UI -- confirmed via direct `localStorage.getItem()` that the key was fully removed (returned `null`).

## Incidental discovery (observed, not changed)
`updateActiveDeal()` does not auto-close the `DealsPanel` the way `saveCurrentAsNewDeal()` does. This is a pre-existing behavior difference between the two paths, noted as evidence for future reference -- not altered here, as instructed.

## SDI-001 registered (separate, non-i18n)
Created `FINDINGS_REGISTER.md` documenting the previously-discovered structural-validation gap in `loadDeal()` (accepts well-formed-but-incomplete JSON) as `SDI-001`, classified `DATA_INTEGRITY / HARDENING`, status `OPEN_FOR_LATER_HARDENING`. Not fixed in R6-D, per explicit instruction.

## Regressions re-run fresh (not assumed)
`run_r6a_full_closure.js` (13/13), `run_r6b_full_closure.js` (14/14, includes malformed-path), `run_r6c_full_closure.js` (17/17), `run_r5e_full_closure.js` (17/17) -- all PASS in this session.

## Financial/recommendation invariance
Unlevered engine output finite and well-formed; raw verdict remains a defined Arabic string.

## Regression
56/56 direct (19 new R6-D assertions). Core 6/6, Secondary 7/7, Storage Provider 6/6, 0 page errors across the entire comprehensive Building+Land session. Canonical source and `App.jsx` both unchanged.

## Gate
I18N_R6D_GATE = PASS
R6-A/B/C/D = CLOSED / FROZEN
I18N_R6_GATE = HOLD -- R6-E (final integrated closure) remains.
