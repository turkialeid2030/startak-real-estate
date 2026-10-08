# C65 — Institutional Hold Evidence Disclosure, Arabic and English

## Real root cause
Actual C63 Chromium observed `محتوى واجهة غير معرّب` and `حالة نظامية غير معرّفة` inside the Valuation V1 institutional HOLD region. The DOM localization sanitizer is correctly fail-closed against raw English code spills, but broad raw internal identifiers such as `HOLD_EXTERNAL_EVIDENCE_AND_DECISION_AUTHORITY`, `C62_...` blockers and unclassified evidence IDs became meaningless to property professionals.

## Engineering changes
- `institutional-valuation-reason-presentation.js` maps documented C62 gate blockers into full Arabic/English professional-language explanations. Includes explicit method names, independently verified source authority, source rights, mismatched cost depreciation, and hotel/industrial eligibility; unknown requirements explicitly say an *additional audit record needs inspection* rather than disappearing or being mistaken for approval.
- `ValuationIntelligenceBasePanel.jsx` now keeps the machine-readable source status `data-c62-status` unchanged, while displaying a separately worded human status, exact blocker count and each blocker explanation. Source blocker array, audit hashes, method arithmetic and transaction authority are untouched. Unknown evidence-gap IDs are counted, not transformed into guessed details or falsely declared verified; originals remain in runtime case records.
- The generic Arabic V1 badge no longer leaks internal English implementation nomenclature.
- Unit regression asserts output remains HOLD, no certification/export, Arabic/English parity and unchanged V1 numerical value.
- Real production-build Playwright Chromium walks through three existing-building classes and after browser reload checks Arabic display is meaningful and has retained institutional HOLD.

## Non-closure
- C65 helps the specifically observed Valuation V1 hold region. Other screens across the app can still have masked language and must be audited separately. This does not repair the `require is not defined` Vite development boot failure #632.
- A readable warning is not legal approval, independent data provenance, licensed Saudi professional valuation, real external market validation, all C57 asset E2E, independent human UAT or deployed software.
