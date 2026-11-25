# Asset efficiency research V1 — 2026-11-24

Scope: one property, one linked case, one closed historical period; SAR nominal, same measurement basis, no implied valuation or audited accounts. This module supplements, and never overwrites, canonical NOI, DCF, financing, hospitality or asset-class engines. The source references and review dates are user supplied, not authenticated. No live accounting, maintenance, timekeeping, HR or governance integration is asserted.

| KPI | Numerator / denominator or calculation | Suggested accountable role |
|---|---|---|
| Operating surplus | Recognized effective operating revenue minus same-period operating expense; exclude financing, capex, depreciation and income tax from both consistent operating basis inputs | Finance |
| Operating surplus margin | Operating surplus / effective revenue | Finance |
| Expense ratio | Operating expense / effective revenue | Finance |
| Revenue budget variance | Actual revenue minus pre-approved same-basis period budget | Finance |
| Expense budget variance | Actual operating expense minus pre-approved same-basis period budget; lower is favorable, subject to service/quality guardrails | Finance |
| Collection rate | Cash applied against specified due cohort / receivables due in that cohort; exclude advances, unrelated arrears, unapplied amounts, and duplicate allocations | Finance |
| Cash debt coverage | Documented cash available for debt service / scheduled debt service in same period; not canonical NOI-based DSCR | Finance |
| Occupancy | Sum occupied rentable sqm-days / sum available rentable sqm-days, same inventory eligibility | Asset operations |
| Maintenance SLA | Due work orders completed by deadline / all work orders due during period, including overdue | Asset operations |
| Maintenance cost intensity | Period maintenance expense / available rentable sqm-days | Asset operations |
| Maintenance throughput | Completed maintenance orders / attributable maintenance labor hours in the same population and period; not a quality score | Operations |
| Maintenance reopen rate | Completed orders reopened within fixed follow-up window / completed orders eligible with full follow-up; exclude immature cohorts | Operations |
| Admin throughput | Completed comparable admin tasks / attributable admin labor hours; do not compare heterogeneous task mixes without adjustment | Administration |
| Admin SLA | Due admin tasks completed by deadline / all admin tasks due | Administration |
| Control timeliness | Required control reviews completed by deadline / all control reviews due | Governance |

Financial and operational source groups should be reconciled to GL and approved budget, rent/collection ledger, asset inventory and work-order system. Productivity requires timesheets and completion/reopen cohorts; admin requires task and control registers. Source reference points to a reconciled manifest when multiple systems contribute. Include dates, period, scope, measurement-basis reference and source reference for each group. Missing/zero denominators mean unavailable; zero numerators are valid when documented. Targets only from approved plan dated no later than period start; no default industry thresholds or composite score. Suggested ownership is not an appointment. Monthly review is proposed, not an approved schedule. Do not reward throughput or lower spend at the expense of reopen rate, SLA, maintenance safety or control reviews.

UI: local JSON import/export, blank template, case-scoped explicit scope/date exchange; no automatic persistence. No private source document upload, no AI computation. Browser and Node share the same deterministic calculations. UI results clear on scope change. A downloaded research draft may contain sensitive metrics and must be handled accordingly. Source authenticity, completeness and cohort membership are not independently verified.

Separate platform-efficiency work still requires actual telemetry: compute cost per completed analysis, AI cost per accepted report, end-to-end latency p50/p95, error and rework rate, availability, manual time saved, and administrative closure lag. Establish measured baseline and service-quality guardrails before targets or savings claims. No production performance measurement, live workflow automation, actual cost saving or organizational efficiency increase is claimed here.


## Follow-up hardening — 2026-11-24

Budget-bearing financial groups now require a separate budget source, approval date no later than period start, case/property/market-scope/period/basis match. Each target requires the same independent scope and date binding; approval is user-attested, not authenticated. Extreme non-finite or out-of-range ratio outputs are unavailable rather than displayed as fabricated zero. Administrative throughput without timeliness produces an explicit warning. The updated synthetic suite (15 metrics, 33 negative cases) was replayed in an isolated JavaScript environment using a UTF-8 byte-length stand-in: 85 assertions passed, not a replacement for Node/CI or actual browser verification.

The existing Wave 17B performance/resilience gate was hardened to retain the reviewed SLO with every evaluation and recompute the result before qualification, reject rehashed fabricated PASS results, duplicate IDs, invalid counts, nonchronological SLOs and missing explicit resilience observations. Resilience outcomes are recomputed from recovery and loss observations; old evaluations without SLO evidence require regeneration. These checks do not measure production latency, throughput, cost or recovery and do not authenticate the source. New Wave 17B regression tests include rehashed forged outcomes.

Remaining closure gates: exact-head full CI and browser evidence; encrypted KPI draft lifecycle; verified real asset records and independently reviewed targets; end-to-end cross-tool compatibility and current source data; actual model permissions, synthetic live provider canary, model cost reconciliation and data residency/retention review; real platform performance and capacity evidence; institutional identity/isolation/storage and backup/restore; historical module parity, 21 original cases (independent rent evidence and protected IRR provenance unresolved), 14 candidate formula reconciliation, stacked PR reconciliation and authorized release. No production savings, performance or completion percentage claimed.


## Encrypted local custody — verified 2026-11-24

Exact commit 2371762401e8968c84341de3c59f7a94f6466e91: Release Verify 676/676, build/package PASS (run 45467623527); actual three-engine browser suite 46 checks each, 138 total (run 45467623329); Wave 17B 94 checks PASS (run 45467623368). All synthetic; final release gate remains HOLD_NOT_AUTHORIZED.

Explicit opt-in save, overwrite and delete are available for one encrypted KPI draft per saved case. AES-256-GCM, PBKDF2 SHA-256 600,000 iterations, native crypto; scope-bound additional data, source field allowlist and recomputation on unlock. Cooperative Web Locks serialize saves and deletes; browsers without lock support reject mutations. No institutional authentication, key recovery, synchronization, or guaranteed forensic erasure. Rename, case deletion or lost passphrase can prevent unlock; orphaned draft lifecycle remains open. Noncooperative storage writers are outside the lock guarantee.

## AI live qualification

Run `node tools/qualify-riai-live-model.mjs` only in an authorized environment with the provider key supplied securely as RIAI_AI_PROVIDER_KEY (never in chat or git). It requires explicit RIAI_LIVE_CANARY_CONFIRM=ONE_SYNTHETIC_BILLABLE_REQUEST, reviewed model/policy, unexpired model-specific monetary reservation configuration, input token bound, and RIAI_LIVE_CANARY_MAX_USD_MICROS (positive integer at most 2000000). Exactly one request using synthetic input, native Responses, store=false, strict JSON schema, no tools, no retry; checks reported model, completion, output and token reconciliation. Outputs only bounded diagnostics, never raw provider content/key. The price ceiling is operator-supplied, not a provider billing guarantee. A successful standalone canary is not proof of production credential equivalence, data residency, integrated quota/identity, release authorization or Arabic quality. The new automated test mocks the provider. Live activation remains unverified until a real authorized request and production gates succeed.
