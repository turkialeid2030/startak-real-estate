# STARTAK — Unified Saudi research evidence fusion and AI-safe investment brief

Date: 2026-10-28. Branch: `feature/appraisal-assurance-p0-20261028`.

## Problem / decision
The Suhail, seven Saudi listing websites, ten Earth sections and national 11 sources currently render in **four independent research panels**. They are not independent market transactions, and they have not been authenticated against official title or executed-transaction records. Cross-panel data should not be passed to existing `evaluateMarketStudy` or the professional reporting API before verification.

## Implemented integration
- `src/market/research-evidence-fusion.js` provides a bounded, deterministic read-only join across the **existing** four source importers, not a replacement for existing valuation/finance/professional comparables engines.
- `ResearchEvidenceFusionPanel.jsx` is integrated into `PropertyMarketLocationPanel.jsx` using event callbacks whenever one of the four datasets changes. The original Suhail sample initializes the session; subsequent CSV batches from every source update unified national state.
- Explicit **source-specific** record types and origin URLs; evidence IDs are local research references, not an external transaction identity.
- Scope selection uses exact city and district in the same study date or earlier. The unit marks such rows **area context only**, never a verified subject property match. Same parcel/plan is a *candidate*, never title proof.
- Detects same-provider reference duplicate vs conflicting amounts and potential cross-provider repeats for offers or reported sales; does not merge unrelated datasets or automatically average repeated prices.
- Exports `STARTAK_RESEARCH_EVIDENCE_BRIEF_V1` JSON containing source refs, review issues, source index, and HOLD recommendation with `valuationSar:null`, `maximumPurchaseSar:null`. No user account ID, contact data, confidential documents, financial claims, source-authentication assertions, model certificates or external credentials are persisted.
- `researchClaimsGate` constrains future AI-written research observations to local evidence IDs and permitted categories. This is only a **contract**, not a live LLM connection or a robust defense against all prompt injection; the LLM must remain outside signing and arithmetic authority.

## Where existing specialized engines are preserved
- Existing `comparable-evidence.js`, `comparable-adjustments.js` and `professional-comparable-review.js` continue qualifying and reviewing individual transactions.
- Existing `instant-market-study.js`, `valuation-decision-gate.js`, `value-reconciliation-audit.js`, and `appraisal-market-validation.js` continue scenario calculations and evidence gating, cross-method reconciliation, historical holdout MAE/MAPE checks. No duplicate price calculator or new consensus weighting is introduced.
- Existing deterministic investment DCF and financing components are not rewritten. The fusion bundle explicitly withholds a maximum purchase price when verified cash flow/target return is not available.

## Outstanding functional/production blockers
1. Durable authenticated tenant-scoped research data store, per-source fetch jobs and legal access rights to provider APIs are NOT CONNECTED.
2. Reliable national parcel/property ID and executed deal cross-provider ID matching remains review-only; official title and property registry verification are NOT CONNECTED.
3. Site-wide data provenance harmonization (deal dates, effective area basis, lease currency/frequency) needs independent source evidence and actual records.
4. No independent Saudi holdout benchmark with multiple real executed transaction labels, licensed valuer methodology review, controlled model challenger (Bayut, GREM, etc.) or calibrated accuracy metrics has run.
5. No live LLM reasoning/tool usage or prompt-injection benchmark was performed. Only deterministic AI claim citation and action gates tested.
6. Full personal/commercial report automation, real-user UAT, independent pen test, operations/rollback, and signed G1–G5 release approvals remain blocked.
7. Every research value remains `marketValuationEligible:false`; a research bundle is NOT a professional valuation and cannot authorize an investment decision.

## Acceptance and traceability
Run `node tests/valuation/research-evidence-fusion.test.js` and the extended `Location Market Study Verify` pipeline, then verify canonical `Release Verify` at exact commit. Live integrations and professional approvals must be assessed separately, with evidence, before changing `HOLD/NOT_AUTHORIZED`.

## Scenario annex without automatic professional promotion
The unified JSON research bundle now carries a narrowly allowlisted `scenarioAnnex` from the existing STARTAK `evaluateMarketStudy` result and `auditValuationReadiness` state, with explicit user-scenario-only labeling. The bundle's professional `valuationSar` and investment `maximumPurchaseSar` remain null. No new standalone market-value calculator was introduced. Negative/invalid/unknown numeric result fields are rejected from the annex.

## Historical MOJ public open data bridge
The existing on-click open-license quarter research loader is now explicitly evaluated at the study as-of date, and its **district-wide** `deriveDistrictSnapshot` is available as a separate `openDataAnnex` in the unified research report. The annex discloses listed quarters, source attribution, missing-quarter coverage, count and median SAR/sqm only when matching district and date with enough observations. It is not an individual verified subject-transaction match, not a licensed live feed and not an authorized value input. No protected Ministry of Justice endpoint is scraped.
