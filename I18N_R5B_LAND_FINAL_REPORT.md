# I18N_R5B_LAND_FINAL_REPORT

## Inventory (from authoritative CSV)
45 rows: 37 control + 8 property (5 note + 3 warnText). Zero SelectField, zero building-study rows.

## Component reconciliation
Section=7, NumField=12, PercentField=14, Toggle=4 → 37. Matches CSV exactly.

## Self-caught extraction errors during manual `old_str` drafting (all fixed same-turn, before any bad write persisted)
1. Section 1 was missing `defaultOpen` in my draft.
2. `landLength`/`landWidth` unit is `"متر"` (meter), not `"متر طولي"` — I had copied the Building panel's unit key by habit; caught via a 0-match replacement, verified against live source, corrected.
3. `buildableRatio` had an undocumented `warnAbove={0.9}` I'd omitted.
4. `constructionCostPerSqm` is a multi-line block (label/unit/value/onChange/note on separate lines) — my single-line draft never matched; rebuilt from verbatim source.

All four were caught by the replacement script's built-in match-count check (0 or 2 matches trigger a printed warning, never a silent wrong write) — none reached the file in a broken state.

## Cross-study literal duplicates handled safely
`occupancyRate`, `marketCapRate`, `maxPaybackThreshold`, `minDscrThreshold` (label only), `equityRiskSpread` (label only) share identical Arabic text with their Building-panel counterparts. Since R5-A already localized the Building instances first, by the time R5-B ran, `content.count(old)` found exactly one remaining match each (the Land instance) — no risk of touching the wrong panel. Verified explicitly per-field via `grep` before each batch.

## Notable divergence from Building
`minDscrThreshold`/`equityRiskSpread`: labels match Building verbatim, but the **notes differ** ("hurdle rate" vs "discount rate" framing, since Land uses hurdle-rate terminology) and the DSCR warnText is shorter (no "no lender would accept it" clause). Captured as distinct `inputLand.*` keys, not reused from `inputBuilding.*`.

## Source purity
Scoped check (Land panel, excluding the R5-D financing Section) found exactly 2 remaining hardcoded Arabic `label=` attributes: `buildingTypeLabel` and `buildingPermitStatus` — both R5-C, deferred by design, not a leak.

## Browser proof
Real Chromium: all 7 section headings + Section 8 render correctly in both locales; R5-A (Building) confirmed still intact after switching to Land and back, proving no cross-contamination.

## Engine/recommendation invariance
Both studies' raw engine outputs (irr, stabilizedNOI) unaffected; raw verdict unchanged; Forward-NOI verified independently via COV-001.

## Regression
40/40 direct (12 new R5-B closure assertions). Core 6/6, Secondary 7/7, 0 page errors. Canonical source unchanged throughout.

## Gate
I18N_R5B_GATE = PASS
R5-A = CLOSED/FROZEN, R5-B = CLOSED/FROZEN
I18N_R5_GATE = HOLD (R5-C, R5-D remain)
