# Startak — C56 / Production AI / C73.3 external qualification packet
**State: HOLD — not an authorization, licensed report or market accuracy certification.**

## Gate 1. Independent Saudi executed-sale holdout (C56 #615)

Reuse exactly `src/validation/time-forward-valuation-holdout.js` and
`src/validation/external-valuation-validation.js`. **Do not replace with synthetic regression datasets**.

1. Obtain authorized, independently auditable **individual completed sales** from official channels:
   - REGA transaction service: https://rei.rega.gov.sa/ar/advanced-search/deals
   - Ministry of Justice real estate statistics/data: https://moj.gov.sa/ar/opendata/Pages/reports.aspx
   The existence of free public access is **not** proof of redistribution/API/commercial licensing; seek explicit data-owner legal assessment. The initial Startak local CSV intake is not independent source authentication.
2. Register, date and independently anchor the protocol **before** outcomes are inspected: immutable version of valuation engine, train cutoff, holdout forward window, regional and asset-type slices, error thresholds (median/mean APE, bias, P90), minimum counts and duplicate/asset-match protocol. **No thresholds have been invented or approved** in this packet.
3. Maintain Riyadh, Jeddah and Eastern Province cohorts and property subtypes, comparable rights, actual title/transaction identity, area and basis-of-value; remove offers and rental data as sale-price targets, reject train/holdout overlap, and preserve source evidence + independent reviewer signature.
4. Run actual sealed holdout, publish segment counts, error distribution, gaps, rejected cases, bias, P90 and drift; require independent model and valuer review. **Until a real pack arrives, `HOLD`**.

## Gate 2. Live provider AI (C73 production AI / residential-income assist)

1. Production gateway implementation is `functions/api/riai/ai-assist.js`; the client is `src/residential-income-acquisition/ai-assist-client.js`. Role orchestration `src/decision-intelligence/ai-expert-orchestrator.js` **builds a context contract; it does not itself call a model**.
2. The public configuration endpoint `/api/riai/public-config` reports only the server's declared public AI toggle and Turnstile site key. A configured toggle, synthetic model mock or successful HTTP response **is not proof of a paid real provider invocation**.
3. For authorized testing, an operator must enable scoped credentials only in secret-bound production environment with tenant roles/Turnstile/quota/audit and privacy review; conduct an **actual metered provider call** with nonpersonal synthetic test prompts, independent signed request/response/usage receipt, server-side audit, budget and timeout controls, outage/circuit-breaker behavior and model safety tests.
4. Explicitly test hallucinated market prices, unsupported source citations, prompt injections, scope/role cross-over and unauthorized buy/sell/reports. AI does not override deterministic valuations or professional advice. Default **HOLD** until these real artifacts are independently checked.

## Gate 3. Saudi security, privacy and professional authorization (C73.3 #648)

- Run identity/role/tenant penetration test; confirm per-tenant Saudi-data storage topology with contractual location, key rotation and access, encrypted evidence upload, malware scan/quarantine, immutable audit, backup restoration, retention/delete and incident response. A SHA-256 digest does **not** prove data provenance, rights, safe malware content or an authorized signature.
- Establish controller/processor map and actual PDPL processing grounds, subject rights, retention, incident and cross-border review with counsel using Saudi regulatory publications:
  - https://dgp.sdaia.gov.sa/wps/portal/pdp/knowledgecenter/details/PDPL
  - https://dgp.sdaia.gov.sa/wps/portal/pdp/knowledgecenter/details/PDPL2
- Require real independently verified accredited evaluator licensing/discipline and a professional review of asset method, report scope and Arabic disclosures; Saudi Taqeem professional licensing reference: https://taqeem.gov.sa/service-guide/1355
- Conduct actual independent human UAT on representative owned files and signed acceptance. Obtain appropriately authorized entity governance decision; never treat GitHub pass, owner checkboxes or this packet as those approvals.

## Owner-facing UI

`src/components/ExternalThreeGatesReadinessPanel.jsx` shows three distinct **HOLD** gates, next to all 13 owner research sectors. `src/governance/external-three-gates-readiness.js` accepts bounded evidence *references*, invokes the existing time-forward cohort calculator when a protocol and observations are provided, and explicitly never converts asserted document references into authentic independent verification.

`tests/architecture/run_external_three_gates_readiness.js` and browser acceptance cover missing protocol, fake evidence assertions, bad refs, fake production AI status, incomplete PDPL/licensed appraisal packet, and continued forbidden purchase/report/go-live authority. Passing these is **software correctness**, not market accuracy.

**Closure condition:** Three distinct independent authorized evidence reviewers and an accountable governance authority establish the facts and issue dated signatures outside the owner-local prototype. A future authenticated production service may consume verified evidence after separate security signoff. Until then use status `HOLD / NOT_AUTHORIZED`.
