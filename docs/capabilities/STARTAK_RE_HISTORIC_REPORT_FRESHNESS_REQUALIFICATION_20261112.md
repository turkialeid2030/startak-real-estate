# STARTAK Real Estate — historic source freshness and governed report control

**Date:** 2026-11-12. **Scope:** `turkialeid2030/startak-real-estate` only.

## Recovered from former decision-governance integrated RC
Historical branch `release/decision-governance-integrated-rc-2026-09-16` contains the following source functions and UI classes missing at their original paths in current stage:
- `src/decision-governance/data-freshness.js`, `valuation-data-freshness.js`
- `methodology-metadata.js`, `report-governance.js`, `audit-trail.js`, `valuation-report-export.js`
- `guided-decision-flow.js`, `guided-ui-status.js`
- `DataFreshnessPanel.jsx`, `GuidedDecisionStatusPanel.jsx`, `GovernedReportExportPanel.jsx`

The eleven source files were selectively restored in isolation without replacing current `ValuationIntelligencePanel`, `App.jsx`, current case storage, Cloudflare APIs or renderer. Old owner export controls are **not** automatically mounted.

## Reproduced legacy defects and bounded fixes
1. Original `ageInDays` clamped a future-dated source to **zero days old**, falsely classifying it CURRENT. Future dated sources now yield UNKNOWN and `materialMarketIndicatorAllowed=false`.
2. Original report readiness required only a present source name/date. A **stale** source could therefore produce a report despite currency risk. Revised `evaluateGovernedValuationReportReadiness` separately blocks `REPORT_STALE_MARKET_SOURCE` and `REPORT_SOURCE_DATE_UNVERIFIED_OR_FUTURE`; an empty source list remains blocked.
3. Synthetic negative regression verifies fresh evidence can produce **only a non-authorizing analytical report** with audit metadata, while stale, future, missing and undated evidence cannot. A 'VERIFIED' flag in a supplied descriptor is **not** independent legal/official provider authentication.

A deliberately strict 90-day historical freshness convention is retained as a test policy, **not** a statement that all market appraisals automatically become invalid after 90 days. Professional methodology-specific freshness thresholds, as-of valuation dates and materiality must be reviewed before owner-facing activation.

## Remaining contracts
- Bind these functions to an authenticated real property, source-rights and actual transaction/lease timestamp under current schema.
- Verify no issuer-issued historical valuations, external licensed professional appraisals, or genuine market transactions become *certified* solely through an internally dated descriptor.
- Review report export retention, provenance and status against the current saved-deal schema and genuine security identities.
- Test Arabic/English, RTL/keyboard/mobile, stale sources, future-dated sources, cancellation, duplicate and tampered reports in the **current** browser app before enabling a historical export button.
- Require regional data custody, Q01–Q12 release signoffs and independent professional valuation approval.

`SOURCE_AND_DEFECT_REMEDIATION=READY_FOR_CI`; `PRESENT_DAY_OWNER_BROWSER_AND_SOURCE_PARITY=OPEN`; `MAIN_AND_PRODUCTION=UNCHANGED`; `COMMERCIAL_GO_LIVE=HOLD_NOT_AUTHORIZED`.
