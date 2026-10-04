# C41 — Full Platform Exhaustive Functional, Financial & Decision Reliability Qualification

## Purpose
C41 qualifies the complete exposed Startak Real Estate SPA surface before integration. It extends C40 and must run on one exact candidate SHA.

## Qualified surface
- 2 operating modes: Existing Building and Land + Development.
- 3 analytical tabs in each mode: Dashboard, Cash Flow, Sensitivity.
- 2 locales: Arabic and English.
- 2 responsive viewports: desktop and mobile.
- 24 explicit mode/tab/locale/viewport combinations.
- Primary numeric, optional-percent, select, switch and accordion controls.
- Saved-deal persistence, reload, reset, update/delete paths covered by the combined browser/runtime suite.
- Valuation Intelligence, governed human review, residential-income acquisition, Zakat, report/export and recommendation paths covered by existing governed integration tests plus full Playwright execution.

## Financial reliability
- 500 deterministic randomized financial cases: 250 Existing Building + 250 Land Development.
- 500 deterministic replays.
- Independent reconciliation of geometry, acquisition costs, rent/revenue and cash-flow structure.
- Metamorphic tests for rent, acquisition price and construction-cost directionality.
- Adversarial invalid-input tests that must fail closed.
- Saved-deal serialize/hydrate/direct-engine result equivalence.
- Zero-debt normalization checks.

## Completion rule
C41 is technically qualified only when the C41 qualification workflow emits `C41_FINAL_READINESS=PASS` on one exact SHA and all required gates are PASS:

- Randomized financial/cross-layer reliability.
- C40 regression and official-source governance.
- AI/grounding/recommendation/forecast governance.
- Deal input-to-report/recommendation/human-review integration.
- Financial model suite (NOI, capitalization, DCF, financing, sensitivity, Monte Carlo).
- Full Playwright UI suite.
- Production runtime persistence lifecycle.
- Full regression and decision integrity.
- Production build and package verification.
- npm audit.
- Canonical Release Verify.
- Single-SHA attestation.

Live-source activation remains a separate operational gate and is not silently treated as complete when no live connectors are configured.
