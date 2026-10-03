# C41 — Full Platform Exhaustive Functional, Financial & Decision Reliability Qualification

## Purpose
C41 qualifies the complete exposed Startak Real Estate SPA surface before integration. It extends C40 and must run on one exact candidate SHA.

## Integrated qualification status
C41 was first technically qualified standalone, then merged into C40. The integrated C40+C41 candidate was requalified on exact SHA:

`c896518200862e9b14917204de03e3155bbdd990`

Integrated result: `C41_FINAL_READINESS=PASS`.

All required C41 gates passed on the same integrated SHA:
- Randomized financial/cross-layer reliability.
- C40 regression and official-source governance.
- AI/grounding/recommendation/forecast governance.
- Deal input-to-report/recommendation/human-review integration.
- Financial model suite (NOI, capitalization, DCF, financing, sensitivity, Monte Carlo).
- Full Playwright UI suite.
- Saved-deal persistence/runtime lifecycle.
- Full regression and decision integrity.
- Production build and package verification.
- Dependency security audit.
- Canonical Release Verify.
- Single exact-SHA attestation.

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
- 720 metamorphic checks.
- 22 validation guard checks.
- 16 cross-layer roundtrip checks.
- Independent reconciliation of geometry, acquisition costs, rent/revenue and cash-flow structure.
- Adversarial invalid-input tests that must fail closed.
- Saved-deal serialize/hydrate/direct-engine result equivalence.
- Zero-debt normalization checks.

## Browser/runtime evidence
The integrated exact-SHA run completed 12/12 Chromium tests. Desktop Arabic, desktop English, mobile Arabic, and mobile English surfaces passed. Each surface exercised 16 accordion sections, 6 analytical tabs, 66 scalar edits, 5 select cycles, 9 switch cycles, and 45 visible interactive icons. Saved-deal persistence, storage attestation, active-deal reset/reload, deletion, locale toggle, and storage-provider reload probing all passed. CORE-01 through CORE-06 passed with zero page errors and zero fatal console errors.

## Defects closed during C41
1. Preserved identifier-like user-entered deal names on the Arabic surface instead of rewriting them as untranslated prose. This restored identity/traceability for saved deals.
2. Hardened host-storage-provider selection so unrelated `window.storage` objects are not selected unless the complete get/set/delete contract exists; browser localStorage remains the portable fallback.
3. Removed test-side localStorage clearing across reload so persistence tests validate the real lifecycle.
4. Closed the Saved Deals dialog through its semantic dialog boundary before exercising header controls, avoiding a false locale-toggle failure caused by the modal overlay.

## Operational boundary
Engineering qualification does not activate production evidence sources. Official-source governance passes, source values are not hardcoded, and unverified sources fail closed; however live source connectors configured remain 0. External canonical-source hash evidence, composite baseline shadow verification, fresh/successor composite shadow verification, and composite cutover safety remain NOT_EVALUATED until their external evidence/authorization inputs are supplied.

Deployment, live-source activation, composite-baseline cutover, and commercial go-live remain separate governed decisions.