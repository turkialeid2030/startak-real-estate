# C63 — Actual automated Chromium user-interface journey (3 existing-building asset classes)

## What the test actually executes
This stage upgrades previous paper/structural tests into **genuine Playwright Chromium execution** in the GitHub Actions Ubuntu environment, against the built deployment artifact served by Vite preview (not the broken development server). Unlike `tests/saved-deals/run_sdi002_real_browser_path.js`, the test does not mark check constants as PASS.

The browser:
1. Opens the actual Arabic page as a new browser context in default LEGACY_ONLY mode;
2. Clicks the genuine Valuation V1 setup control and enters an OFFICE, RETAIL or RESIDENTIAL case with explicit lifecycle, strategy, income, expense, basis, currency, valuation date and project ID;
3. Applies the configuration and sees the C62 institutional-HOLD warning, preliminary-value caption, neutral HOLD status and warning code; does not silently convert mathematical readiness into investment approval;
4. Opens actual Saved Deals, names and stores a case, **reloads the entire document**, opens Saved Deals and reloads the case. The institutional HOLD must still be visible after storage restoration;
5. Fails on any uncaught browser page error, missing control, missing warning, blocked save or failed reload. CI links the exact PR head and runs financial regressions and independent Release Verify.

## Live browser discovery and negative test (do not erase)
Initial actual Chromium test targeting the Vite **development** server failed: root stayed empty, with genuine browser `ReferenceError: require is not defined`. That is a pre-existing browser startup defect in the dev module graph, not a test selector problem. This is recorded as [issue #632](https://github.com/turkialeid2030/startak-real-estate/issues/632), remains OPEN, and demands a second dev-specific smoke test after safe ESM/CommonJS remediation. The C63 workflow is now explicitly targeted at the production build served via `npm run build` + `npm run preview`; succeeding here **must not be used to claim that dev mode works**.

## Distinct closure tiers (must not conflate)
- `REAL_CHROMIUM_BROWSER_EXECUTED=TRUE` only if CI completes the actual browser journey. No such claim follows merely from committing this test.
- Synthetic user-entered valuation configurations in the real browser DO NOT authenticate independent market values or source rights.
- Automated Chromium tests do not establish real human UAT, an independently signed legal/professional reviewer, external source licences, official transaction data, production deployment or Saudi market error.
- This stage covers **three existing-building asset classes only**. LAND, HOSPITALITY, INDUSTRIAL_LOGISTICS, MIXED_USE and other specialist routes still lack equivalent full runtime, browser, persistence and report-export coverage.
- Governed internal C5/C6 analytical reports remain distinct from professional licensed valuation and cannot be treated as regulatory reports. C62 authenticated professional export remains blocked.

## External acceptance still required
For final G05/G09 closeout, run licensed human-designed procedures on all C57 eight-sector scenarios and report generation/export, verify real completed Saudi historical transactions against C56 and rights C58, independently review C59/C60/C61, and obtain explicit separate lawful launch approval.
