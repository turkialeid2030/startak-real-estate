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
