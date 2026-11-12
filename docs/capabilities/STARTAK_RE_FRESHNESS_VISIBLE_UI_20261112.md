# STARTAK Real Estate — user-visible source freshness, limited safe activation

**Date:** 2026-11-12 · **Repository:** turkialeid2030/startak-real-estate only.

## Why this separate change is needed
Earlier [PR #789](https://github.com/turkialeid2030/startak-real-estate/pull/789) recovered source freshness/domain and governance but did NOT connect the panel to the modern owner workflow; code existence alone was not UI parity. This feature adds exactly one **read-only** source freshness panel inside modern `ValuationIntelligencePanel` if a validated `valuationCase` is present. It neither changes the canonical property valuation, case storage, registry, nor executes market report downloads.

## User-visible behavior
- Lists each available `valuationCase.evidence` descriptor's source type, date, age in days and classification CURRENT/AGING/STALE/UNKNOWN.
- Flags future-dated/invalid dates as UNKNOWN, not current.
- Flags stale sources with an explicit bilingual message requiring data renewal.
- Marks the entire group source freshness status without treating a source's self-asserted VERIFIED marker as independent government/licensed source authentication.
- Displays Arabic/English and is responsive to mobile and desktop viewports.
- Contains **no approve, execute, pay, sell, buy, certify or report export button**.

## Acceptance and limitations
- New isolated synthetic React browser harness verifies rendered behavior in Chromium at 390px and 1440px for Arabic and English, with current, stale, future-dated and undated sources.
- Parent source wiring is asserted. Canonical release tests must pass exact SHA. This browser harness is not a live owner end-to-end test against an authenticated current saved deal.
- Existing real owner UI functions, market comparables and financial calculations are unchanged; source freshness is an additional information panel.
- Professional asset valuation, current Saudi market evidence rights, private client data custody, business/tenant roles and formal acquisition approval remain separately governed. Freshness by itself cannot establish truth, legality or professional valuation.
- Old `GuidedDecisionStatusPanel` and `GovernedReportExportPanel` remain isolated until their current-runtime and auth/receipt contracts are qualified.

`READ_ONLY_UI_SOURCE_VISIBILITY=TEST_REQUIRED`, `REPORT_EXPORT=NOT_ACTIVATED`, `MAIN_AND_PRODUCTION=UNCHANGED`, `COMMERCIAL_GO_LIVE=HOLD_NOT_AUTHORIZED`.
