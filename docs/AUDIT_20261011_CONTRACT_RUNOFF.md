# Monthly contract run-off — 2026-10-11

## Delivered scope

The operating-case view now derives and exports a 12-calendar-month analytical lease run-off from the case date. The first month is partial when applicable. Fixed annualized contract rent is allocated equally over twelve months, then prorated by actual covered calendar days. Start dates are inclusive and end dates exclusive. ACTIVE and signed/adopted FUTURE leases are included; expiry does not imply renewal. Overlapping leases for a unit block results rather than double counting rent.

Normalized annual OPEX is allocated on the same monthly basis. ACTUAL, BUDGET and BENCHMARK records are not substituted. Missing, future-dated or unadopted amounts leave net income null; explicit zero remains valid. Negative net months are preserved. Source/adoption lineage, dates, units and numerical bounds are checked. A 2000-lease projection limit prevents an unbounded detailed export.

Historical collection reconciliation is shown separately, retaining its actual reporting-period metadata in JSON. Neither collected cash nor its ratio becomes a future collection forecast. The export contains the full operating-case inputs and derived output for reproduction, with an explicit calculation version. It is downloaded locally and is not posted to a service.

## Acceptance

`tests/architecture/run_audit_20261011_contract_runoff.js` covers lease expiry, future leases, overlap, partial months, annualization, missing versus zero OPEX, unsupported bases, dates, evidence and authority boundaries, non-mutation and arithmetic sweeps. Browser acceptance extends the three-engine/two-viewport suite with real import, displayed missing-cost hold, JSON export and a second case containing normalized OPEX. Exact final CI and deployment results are recorded in the PR and #658; their success must not be inferred from this document.

## Explicit limitations

This initial scope is fixed-rent FREEHOLD only. Escalated/indexed leases and time-limited property interests are held, not approximated. This is a base-rent accrual illustration, not an invoice, payment schedule, collection forecast or legal interpretation of day-count conventions. It does not model rent-free periods, concessions, other income, renewal, growth, new leasing, debt, taxes or CAPEX timing. Those items require separately qualified data and policies. Annual OPEX allocation is an assumption, not a payment prediction.

The main financial study, stabilized NOI, valuation, IRR and committee authorization are not mutated. The full contractual billing/collections/forecast cycle remains open. Local evidence declarations do not authenticate sources or reviewers. No user documents or actual tenant records are included in tests or source control.
