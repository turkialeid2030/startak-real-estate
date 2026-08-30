# I18N_R4A_CASHFLOW_FINAL_REPORT

## Inventory
18 items across 4 components (CASHFLOW_TAB=9, CASHFLOW_TABLE=5, CASHFLOW_CHART=2, CASHFLOW_TOOLTIP=2). Full detail: `I18N_R4A_CASHFLOW_INVENTORY.csv`. 0 unclassified, 0 missing-scope rows.

## Signed currency (fmtSARSigned)
3 direct uses found (CF-TABLE-04, CF-TABLE-05, CF-TOOLTIP-02). Global `fmtSARSigned` **untouched** — confirmed via source scan (0 direct calls remain within CashFlow scope) and via full-file scan (0 direct `fmtSARSigned(` calls anywhere in App.jsx, meaning no other consumer was missed). Local `formatSigned` helper added independently inside each of the 3 components (CashFlowTable, CashFlowTooltip), preserving the exact original formula: `Math.round(Math.abs(n)).toLocaleString("en-US")`, sign prefix, and zero behavior — verified numerically (`1,234,567 SAR` / `-1,234,567 SAR` / `0 SAR`).

## Chart formatters
- X-axis: `` `س${y}` `` → `t("cashFlow.chartYearTick", {value: y})`. Raw `y` never touched.
- Y-axis: `` `${(v/1e6).toFixed(0)}م` `` → `t("cashFlow.chartMillionTick", {value: (v/1e6).toFixed(0)})`. Exact same division/rounding, only the suffix localizes.
- **Chart rendering proof (not DOM-text-only)**: actual SVG `<text>` content extracted directly from the rendered chart. English: `["Y0","Y1","Y2","Y3","Y4","Y5","-220M","-110M","0M","110M","220M"]`. Arabic (Building): `["س0"..."س5","-220م"..."220م"]`. Arabic (Land, 13-year series): `["س0"..."س12","-70م"..."210م"]` — confirms the array-length-13 Land series renders correctly and is unaffected by the Building fixture used elsewhere.
- **Tooltip interaction proof**: real `hover()` on a rendered bar element produced `"Year 0\n-150,635,000 SAR"` — full pipeline (data → React → Recharts → DOM → user interaction) confirmed working end-to-end.

## Raw invariance
Cash flow array lengths unchanged (Building unlevered/levered = 6, Land = 13). Year-0 outflow sign unchanged (`-150,635,000`, negative as designed). Forward-NOI convention unaffected (verified independently via COV-001, which does not depend on any presentation-layer code touched here).

## Scenarios
Confirmed NOT_APPLICABLE — no Scenarios component exists anywhere in source. Re-confirmed via full-text search in this wave.

## Regression / E2E
33/33 direct regression PASS (includes the 4 new permanent tests: table 9/9, chart 7/7, tooltip 3/3, full closure 11/11). Core 6/6, Secondary 7/7, 0 page errors. Canonical source SHA256 unchanged throughout.

## Scope discipline
R4-B (Sensitivity), R5 (Input Panels), R6 (Saved Deals/Validation) — all confirmed untouched via source diff review; only CashFlowTab/Table/Chart/Tooltip and their dedicated dictionary section (`cashFlow`) were modified.

## Gate
I18N_R4A_GATE = PASS
I18N_R4_GATE = HOLD (R4-B Sensitivity remains)
