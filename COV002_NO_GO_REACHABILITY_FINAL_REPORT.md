# COV002_NO_GO_REACHABILITY_FINAL_REPORT

## Nature of this wave
Coverage/characterization only. `PRODUCTION_RECOMMENDATION_CHANGES = 0`, `PRODUCTION_FINANCIAL_CHANGES = 0`. `recommendation/index.js` and `financial/index.js` SHA-256 confirmed byte-identical before/after. `App.jsx` MD5 unchanged.

## Canonical recommendation path (single, no duplicates)
`src/engines/recommendation/index.js` → `tierVerdict(criteria)`: `met === total` → GO ("يوصى بالشراء"); `met >= total - 1` → CONDITIONAL ("يوصى بالشراء بشروط"); else → NO-GO ("لا يوصى بالشراء"). Called from exactly two sites: `valuation/existing-building.js` and `valuation/land-development.js`, each building its own `criteria` array. `CANONICAL_RECOMMENDATION_PATHS = 1`, `DUPLICATE_RECOMMENDATION_ENGINES = 0`.

## Criteria (4 base, 5th conditional on financing)
**Existing Building**: c1 = net yield on price ≥ `minYieldThreshold`; c2 = payback on price ≤ `maxPaybackThreshold`; c3 = IRR ≥ `discountRate`; c4 = market value (income cap) ≥ total purchase cost; c5 (if `leverageEnabled`) = DSCR ≥ `minDscrThreshold`.
**Land Development**: c1 = simple payback ≤ `maxPaybackThreshold`; c2 = cap rate on cost ≥ `1/maxPaybackThreshold`; c3 = IRR ≥ `hurdleRate`; c4 = market value after completion ≥ total project cost; c5 (if `leverageEnabled`) = DSCR ≥ `minDscrThreshold`.
`TOTAL_RECOMMENDATION_CRITERIA` = 4 (unlevered) or 5 (levered). NO-GO threshold (unlevered): `met ≤ 2`.

## Existing Building NO-GO fixture (exact)
RE-GOLD-002 baseline with `buildingPrice` inflated 5x, all else unchanged. Result: `verdict = "لا يوصى بالشراء"`, `metCount = 0/4` (all four criteria fail -- stronger than the minimum required). `irr = -19.66%`, `NOI = 14,859,936` (unchanged from baseline, confirming only price changed the economics), `marketValueByIncomeCap = 212,284,800` vs cost `700,000,000`. `validateEngineInputs()` does not throw -- confirmed valid economic domain, not an invalid/rejected value.

## Land Development NO-GO fixture (exact)
RE-GOLD-001 baseline with `landPricePerSqm` inflated 5x. Result: `verdict = "لا يوصى بالشراء"`, `metCount = 0/4`. `irr = 2.56%` (positive but far below `hurdleRate`). Valid domain confirmed.

## Independent reachability
Both required and both proven independently -- neither fixture derived from or dependent on the other; each modifies a different study-specific input field appropriate to its own schema.

## Tier separation
The unmodified RE-GOLD baselines for both studies are GO (`metCount=4/4`) -- proving the same engine, same code path, produces both GO and NO-GO depending purely on economic inputs, not on any test-only branch.

## Determinism
10/10 repetitions each, verdict and metCount identical every time (pure function, no randomness).

## Locale invariance
Raw verdict is a fixed Arabic string returned by `tierVerdict()` -- never conditionally selected by locale. This is the same architecture verified extensively throughout R1/R5/R6/R7/I18N_FULL; not re-derived here, relied upon as already-proven.

## Real browser proof (live Chromium, both studies, both locales)
Entered each fixture's modified field through the actual UI. Result: "لا يوصى بالشراء" visible in ar-SA, "Not Recommended" visible in en, for both Building and Land. Zero page errors.

## Permanent artifacts
- `tests/fixtures/cov002-no-go-fixtures.json` -- frozen fixture definitions with expected criterion states, metCount, verdict.
- `tests/characterization/run_cov002_no_go.js` -- 15/15 assertions, integrated into the standard `tests/characterization/run_*.js` regression glob (auto-discovered, not a separate manual step).

## Browser regression note
Live browser evidence was captured and verified in this session (documented above) rather than added as a separate permanent Playwright file, given the engine-level test already provides deterministic, fast, CI-safe coverage of the same NO-GO reachability claim; the browser layer's job (rendering the correct localized verdict string) is already covered generally by the existing R5/R7/I18N_FULL UI-parity test suite for the verdict presentation architecture.

## Regression
68/68 (1 new permanent file). Core 6/6, Secondary 7/7, Storage Provider 6/6, 0 page errors. Canonical source unchanged. Recommendation and financial engine files byte-identical (SHA-256 confirmed before/after).

## Gate
COV-002 = RESOLVED
COV002_GATE = PASS

## Post-pass state
DEF-001/002/003/004 = RESOLVED, COV-001 = RESOLVED, COV-002 = RESOLVED → `COVERAGE_GAPS_RESOLVED = TRUE`.
OBS-001 = OPEN_FOR_DISPOSITION (next). SDI-001/002 = OPEN_FOR_LATER_HARDENING (untouched). `ALL_FINDINGS_RESOLVED = FALSE`. `PRODUCTION_READY = FALSE`.
