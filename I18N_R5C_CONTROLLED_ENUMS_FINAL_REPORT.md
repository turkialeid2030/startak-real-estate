# I18N_R5C_CONTROLLED_ENUMS_FINAL_REPORT

## Inventory
7 rows: 3 control + 3 options + 1 note. Zero financingStructureLabel rows (confirmed R5-D-owned).

## Critical architectural discovery
`SelectField`'s original implementation rendered `<option value={o}>{o}</option>` -- the display text and the raw value sent to `onChange` were **identical**, with no separation point. Localizing the visible option text directly would have broken `onChange`, state, and Saved Deal semantics.

**Resolution**: extended `SelectField` to accept either a plain string (legacy) or a `{value, label}` object per option, backward-compatible. Verified explicitly: `financingStructureLabel`'s two untouched instances (R5-D, still `options={["مرابحة", "إجارة منتهية بالتمليك"]}`) continue to work identically -- confirmed via full regression before and after the component change, and via a dedicated closure-test assertion.

## Presentation mapping (extends R3V's existing pattern)
Added `getLeaseStatusLabel`/`LEASE_STATUS_PRESENTATION_KEYS` and `getBuildingTypeLabel`/`BUILDING_TYPE_PRESENTATION_KEYS` to `domain-presentation.js`, alongside the existing `getBuildingPermitStatusLabel` -- same throw-on-unknown architecture, no second mapping path created. All three verified to throw on an unmapped raw value (3/3 guard test).

## Raw value enumeration (unchanged)
- leaseStatus: مؤجر, 3 أشهر, 6 أشهر, 9 أشهر, سنة (5)
- buildingTypeLabel: برج مكتبي, برج سكني, مبنى تجاري, استخدام مختلط (4)
- buildingPermitStatus: لم يُستخرج, قيد الإجراء, صادر (3)

## Semantic comparison preservation
`checked: inputs.buildingPermitStatus === "صادر"` verified byte-identical in source after all changes (line-grep confirmed).

## End-to-end proof (not just DOM text)
Real browser: extracted each `<option>`'s `value` attribute (raw) separately from its `textContent` (display) -- e.g. `{value: "صادر", text: "Issued"}`. Then actually selected the "Issued" option via `dispatchEvent`, confirmed `RegulatoryStatusCard` updated to "Building permit status: Issued", switched to Arabic, and confirmed the raw value persisted as "حالة رخصة البناء: صادر" -- proving the full chain (selection → raw state → checked logic → display) survives a locale switch intact.

## Self-caught error during implementation
First draft referenced a non-existent constant name (`LEASE_STATUS_PRESENTATION_KEYS_FOR_OPTIONS` instead of the actual exported `LEASE_STATUS_PRESENTATION_KEYS`). Caught immediately via the build step before any test ran; fixed by importing the correct exported name.

## Test suite update (not a regression)
`run_r5a_full_closure.js` and `run_r5b_full_closure.js` initially failed after R5-C's changes -- both had asserted "R5-C fields remain hardcoded" as a scope-isolation proof, which was correct at the time they were written but became stale once R5-C legitimately localized those fields. Updated both assertions to check for the new central-mapper usage instead of the old hardcoded strings, restoring 13/13 and 12/12 passes respectively.

## Regression
41/41 direct (25 new R5-C assertions). Core 6/6, Secondary 7/7, 0 page errors. Canonical source unchanged.

## Gate
I18N_R5C_GATE = PASS
R5-A/B/C = CLOSED/FROZEN. I18N_R5_GATE = HOLD (R5-D remains, 16 rows).
