# I18N_R4B_SENSITIVITY_FINAL_REPORT

## Inventory
20 items: SensitivityTab=9, buildSensitivityData=8 (variable labels), SensitivityChart=2, SensitivityTooltip=1. Full detail: `I18N_R4B_SENSITIVITY_INVENTORY.csv`.

## Critical discovery: d.label role
Source review of `buildSensitivityData` proved conclusively: `rows.sort((a,b) => b.range - a.range)` sorts by the numeric `.range` field only; every actual computation (`inputs[key]`, `{...inputs, [key]: value}`) uses `.key`, never `.label`. **`d.label` is PRESENTATION_ONLY** -- confirmed, not assumed.

## Critical discovery: YAxis dataKey="label"
`SensitivityChart` binds `<YAxis type="category" dataKey="label">` directly to the label field -- a structural Recharts binding, not a translatable string in the traditional sense. Solution: `buildSensitivityData(mode, inputs, t)` now takes `t` as a parameter and computes `label` in the current locale at data-build time (inside `useMemo(..., [mode, inputs, t])`), rather than storing a fixed raw value with a separate presentation-mapping layer (the V1A/R3V pattern would have broken the chart's category axis, which needs the actual localized string as its dataKey).

## boundaryReason
Only one raw value discovered: `"OCCUPANCY_MAX_100_PERCENT"` (already an English semantic code) or `null`. **Confirmed not rendered anywhere in the current UI** -- no presentation mapping was needed or created.

## irrKindLabel
Reused existing `kpi.irrLevered`/`kpi.irrUnlevered` keys from R2-A (KPIRibbon) rather than creating duplicates -- same semantic concept, zero terminology drift.

## Test-writing errors caught and fixed mid-development (2 instances)
1. `run_sensitivity_path.js` (pre-existing Rebase-era test) called `buildSensitivityData(c.mode, c.inputs)` with the old signature -- broke immediately on the signature change. Fixed with a single-line identity-function passthrough (`(key) => key`), verified the test's actual assertion (canonical-engine-reuse, 4/4 baseline IRR matches) was completely unaffected.
2. `run_r4b_sensitivity_full_closure.js`'s own scope-isolation check initially failed twice: first because `'function CashFlowTab'` matched `'function CashFlowTable'` as a prefix (fixed by anchoring on the opening paren), second because the file's actual function order places `CashFlowTab` physically between `buildSensitivityData` and `SensitivityTab` (not adjacent) -- fixed by slicing two separate ranges and excluding CashFlowTab explicitly.

## Chart rendering proof
Real SVG text extraction, both locales, both studies:
- Building EN: `["Building Purchase Price","Rent per Square Meter","Market Capitalization Rate","Occupancy Rate"]`
- Land EN: includes `"Construction Cost per Square Meter"`, `"Land Price per Square Meter"`, `"Exit Capitalization Rate"`
- Zero Arabic characters in English-mode axis text (confirmed via Unicode range scan).

## Tooltip interaction proof
Real hover on rendered bar: `"Building Purchase Price\nfrom 12.36% to 17.80%"`.

## Raw invariance
lo/hi/range/requestedValue*/effectiveValue*/boundaryLimited*/boundaryReason* all bit-identical between ar-SA and en builds of the same inputs (verified programmatically, not just visually). Sort order (by range) identical regardless of locale -- proves label language never influences data ordering.

## SENS-OCC preservation
All 5 cases re-verified PASS, including the direct boundary-function test.

## Regression / E2E
38/38 direct regression PASS (5 new R4-B permanent tests + all prior). Core 6/6, Secondary 7/7, 0 page errors. Canonical source unchanged.

## Gate
I18N_R4B_GATE = PASS
I18N_R4_GATE = PASS (R4-A + R4-B both closed; Scenarios confirmed NOT_APPLICABLE)
I18N_FULL_GATE = HOLD (R5/R6/R7 remain)
