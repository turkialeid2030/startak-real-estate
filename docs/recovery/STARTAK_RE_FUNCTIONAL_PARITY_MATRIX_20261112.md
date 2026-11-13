# STARTAK Real Estate — historic feature continuity, model review and no-drop inventory

**Audit capture:** 2026-11-12 · **Repository:** `turkialeid2030/startak-real-estate` ONLY.

> Excludes STARTAK Entrepreneur, STARTAK Business, Sindbad and other repositories. This document and the full [branch-name census](./STARTAK_RE_BRANCH_CENSUS_20261112.json) never imply that name-level or path-level comparison proves function-level parity.

## Scope and verified source anchors

- Primary modern staging: [PR #777](https://github.com/turkialeid2030/startak-real-estate/pull/777) original audit head `55abb3e38dd9dacd7b775b140ce90cef92971b7b` (OPEN/DRAFT/UNMERGED). Main remains separately governed.
- **630 pre-audit retained branches** found in this repo. A new branch was then created to stage the audit, so the generated census includes **631** repository branches at census time, all enumerated as `BRANCH_DISCOVERED_SOURCE_NOT_FUNCTIONALLY_AUDITED`.
- Source PR [#520 C22](https://github.com/turkialeid2030/startak-real-estate/pull/520), [#523 C23](https://github.com/turkialeid2030/startak-real-estate/pull/523), [#525 C24](https://github.com/turkialeid2030/startak-real-estate/pull/525), [#530 C26](https://github.com/turkialeid2030/startak-real-estate/pull/530), [#538 C26 UI](https://github.com/turkialeid2030/startak-real-estate/pull/538), [#537 C29](https://github.com/turkialeid2030/startak-real-estate/pull/537), [#606 C48](https://github.com/turkialeid2030/startak-real-estate/pull/606).
- Current other staged work: C7 (correlated simulation), C58 (source rights/provenance), P27 (4-case financial reference), Kite personal research. Tests and source presence do not establish owner/UI or live external parity.

## Cross-version functional matrix

| Historical family / functionality | Source candidate | Evidence in modern staging before this audit | Action on audit branch | Functional acceptance |
| --- | --- | --- | --- | --- |
| C22 evidence-grounded generative model profiles, model card, untrusted-content isolation, numeric grounding | `src/ai/governed-generative-intelligence.js` | Absent at original path | Restore byte-identical source, regression and documentation | **STANDALONE REQUALIFICATION PENDING**; not live AI |
| C23 provider-neutral authorised envelope, grounded generated claims, refusal/no-fallback, external-rights controls | `src/ai/governed-live-provider-gateway.js`; `proof-grounded-ai-runtime.js` | Absent at original paths, but distinct Cloudflare RIAI gateway is present | Restore isolated original source/tests/docs | **STANDALONE REQUALIFICATION PENDING**; no provider credentials |
| C24 case/property hard-gate state orchestration | `src/orchestration/governed-case-property-orchestrator.js` | Absent at original path | Restore source/test/docs | **STANDALONE ONLY**; no live deal routing |
| C26 controlled operator workspace, RBAC, audit / review | `src/operator/governed-operator-workspace.js` | Absent at original path; App has separate modern UI | Restore source/test/docs | **STANDALONE ONLY**; no owner-console UI identity proof |
| C26 integrated operator panel, navigation and actions | `src/components/IntegratedCaseReviewPanel.jsx`, `src/presentation/integrated-case-review.js` (PR #538) | Paths absent, current `src/app/App.jsx` and `src/main.jsx` differ | Restored original UI/presentation source, modified old test to enforce no public-root activation | **SOURCE RECOVERED, UI/RBAC E2E NOT QUALIFIED** |
| C29 shadow simulation, audit/replay, synthetic vs actual proof | `src/simulation/governed-shadow-simulation.js` | Absent at original path | Restore source/test/docs | **STANDALONE ONLY**; production witness/real UAT remain unverified |
| C7 correlated Gaussian-copula sensitivity & governance | Historical PR #485; modern PR #780 | Restored to PR #777 in prior development | No duplicate | Modern code/tests exist; **owner UI not qualified** |
| C58 transaction provenance, capture receipts, rights, executed sale vs lease | Historical PR #625; modern PR #781 | Restored to PR #777 in prior development | No duplicate | Structural evidence gate only; **authenticity and real source rights not verified** |
| P27 independently recomputed four financial scenarios | Historical PR #463; modern PR #782 | Restored in PR #777 | No duplicate | 4 financial cases in CI; **not 17 private owner reports** |
| Owner 5-step intake and whole-property sale/annual rent | PR #773/#767/#774 | Some current owner UI exists, source/purpose matching incomplete | Audit only | **PARTIAL; no assumption that financial mode=valuation purpose** |
| Sector research — 13 real estate property categories | PR #722/#741/#764 | Current personal research features and sector tests exist | Audit only | **SECTOR-BY-SECTOR E2E PARITY NOT PROVEN** |
| Historical C75 functions, 84 historical path candidates | Issue #337, PR #655 / sibling #772 | Mixed matched/changed/missing paths | Census and targeted source contract review | **NOT 84 PROVEN MISSING FEATURES**; function-by-function inventory necessary |
| Land boundaries/maps, comparables, zoning and permitted use | C1-C21, C55-C61, modern location UI | Current location and source guards present | Audit only | Live official source and municipal permits **OPEN** |
| Saved-deal versioning, reports, PDFs/JSON, Arabic/English, backups, buttons | Prior waves through C75; PR #766 | Modern code/automated browser suites present | Audit only | Exact UI/keyboard/RTL/source-protected export regression required |
| Production AI/market providers, data sovereignty, credentials, pricing quotas | C23/C48, current RIAI gateway | Current RIAI server gateway has model configured via `RIAI_AI_MODEL`; approval, residency and production rights not verified | Latest candidate registry plus restored standalone C48 authorization/security/PDPL test and original evidence contract; never auto-switch production model | **MODEL ROLLOUT HOLD / C48 EXTERNAL GATE NOT SATISFIED** |
| 17 report-based capital/rent cases + 4 residual cases | Private Library `golden-cases-17.json`; issue #774 | 17/17 reference **formula** self-consistency only | Private records not uploaded | Engine output parity and independent **market rent** proof **OPEN** |
| Release/rollback/Cloudflare verified deployment | QCR #747/#758/#761 | Release tests exist, signed external gates absent | No main/prod modification | **COMMERCIAL GO = HOLD** |

## AI model candidates as of 2026-11-12

Official directories reviewed (rather than guessed model aliases):
- <https://developers.openai.com/api/docs/models>: `gpt-6-astra`, `gpt-6.1-sol`, `gpt-6.1-terra`.
- <https://platform.claude.com/docs/en/models/overview>: `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`.
- <https://ai.google.dev/gemini-api/docs/models>: `gemini-3.8-flash`, `gemini-3.1-pro-preview` (latter **preview, not a production pin**).

`src/ai/real-estate-model-candidates.js` is a **read-only research catalog**. The catalog denies invocation even with a complete claimed checklist, until an authenticated provider/security/consent/source-rights/region integration in a **separately signed, benchmarked** release. These public source listings DO NOT certify actual account API entitlement, price, response quality, inference in Saudi Arabia, data residency, legal license, or safety.

### Required real-estate AI benchmarking before any model change

For each candidate, run a blind benchmark across Arabic/English and real, source-cleared study classes:
1. Deed / title OCR, extraction and discrepancy detection, with no silent transcription.
2. Property ID, city, building class, location, ownership and valid regulatory use evidence.
3. Official completed-sale vs offer separation, sale-price vs annual-rent separation, currency/year units and appraisal-date provenance.
4. Financial double-check: NOI, cap rate, NPV, IRR, discounted residual, lease rollovers, vacancy, zakat, transfer and intermediary fee burden.
5. Citation-grounded output and injection resistance, numerical hallucination count, abstention when evidence absent, repeatability across seeds.
6. Confidentiality / DLP / PDPL, legal rights, appropriate in-KSA custody/processing contract where applicable, model retirement and rollbacks.

Metrics **not measured yet**: claim grounding, source recall/precision, quantitative absolute errors, model benchmark relative ranking, latency, SAR/1000 analyses, tokens, data-transfer legality, and external provider uptime. Do not advertise accuracy percentages without replay logs.

## Safe migration stages

`DISCOVERED_BRANCH` → `SOURCE_INSPECTED` → `FEATURE_CONTRACT_MAPPED` → `REGRESSION_PASSED_ON_EXACT_SHA` → `UI_AND_REPORT_PARITY` → `LICENSED_REAL_SOURCE_ACCEPTANCE` → `INDEPENDENT_REVIEW` → `PRODUCTION_DEPLOYED` → `OBSERVED_SUCCESS`.

Missing steps are **OPEN**. All recovered modules in this audit remain **isolated**, not directly imported by production `src/app/App.jsx`, `src/main.jsx`, or server `functions/api/riai/ai-assist.js`. Keep separate external provider gateway and deterministically authoritative finance engine. Do not merge old branches wholesale, delete sources, change public AI, claim certification or deploy to `main` without independent acceptance.

**Release:** `HOLD_NOT_AUTHORIZED`. Function-level exhaustive coverage of all 631 named branches remains unproven; this document is the verified source-backed subset plus an exhaustive branch-name baseline.
