# Collections integrity — 2026-10-11

## Scope and corrected defects

- Blank, missing, boolean and coercible non-monetary values no longer become zero in the operating editor. Zero is explicit; Arabic and Persian decimal digits are accepted. Unsafe monetary magnitudes are rejected.
- Calendar-invalid ISO dates and collection periods ending after the case date are rejected.
- Gross unpaid contractual rent and excess cash are reported separately per record. An excess or prepayment cannot erase another record's deficit without documented allocation. The legacy `creditLoss` field now aliases unpaid contractual rent, not an authenticated write-off. Economic shortfall is also per record; ratios are not silently capped.
- Changing any draft input clears the review confirmation. Submission is guarded against duplicate in-flight writes and requires an explicit successful case-update result.
- Case/date changes remount the editor, clearing drafts and confirmations. User identifiers remain untranslated, money displays halalas, and known errors have Arabic explanations with their diagnostic code.

## Verification

`node tests/architecture/run_audit_20261011_collections_integrity.js` passed 255 assertions, including invalid inputs, explicit zero, non-netting examples, 81 arithmetic combinations, snapshot round-trip and malformed dates. The existing reconciliation and editor suites passed. Local release verification passed 477 regression suites; final immutable-tree CI and public acceptance are required before deployment is claimed.

The browser acceptance suite adds synthetic operating-case import, actual edit/export, confirmation invalidation, cross-case draft isolation and viewport overflow checks in Chromium, Firefox and WebKit at 1366 and 390 CSS pixels. Synthetic fixtures contain no user documents. Local browser execution was blocked by missing browser executables; CI supplies the browsers. Actual CI counts and deployment identity are recorded in the PR and release issues, not assumed here.

## Boundaries still open

Local confirmation and typed evidence do not authenticate a reviewer, source, tenant or bank receipt. No automated allocation, write-off, billing engine, contractual legal review or stabilized-NOI mutation is introduced. Full contract/collections/forecast integration, institutional authorization, professional qualification and physical-device accessibility remain open in #658. The advisory council's source-integrity and delivery gates keep these boundaries separate from engineering test success.
