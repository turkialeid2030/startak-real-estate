# Changelog

## Unreleased

### Added

- Residential Income Acquisition Intelligence foundation (`RIAI-01A`) with an immutable PropertyInterest/Property/Building/Unit/Lease/Tenant operating graph.
- Evidence-aware operating inputs, explicit underwriting adoption lineage, and fail-closed readiness states.
- Deterministic API projection for operating-underwriting readiness without invoking or duplicating the financial, title, or tenant engines.
- Safe, bilingual Existing Building readiness panel with an explicit no-case-loaded state.
- Deterministic Rent Roll, current contractual-rent escalation, physical and contracted occupancy, WALE/WALT, 12/24/36-month expiry exposure, and lease-cliff detection (`RIAI-01B`).
- Synthetic regression coverage for long step-rent leases, time-limited usufruct, conflicting occupancy evidence, omitted operating cost, waqf restrictions, and contradictory active leases.
- Property-level OPEX analysis preserving Actual, Budget, Normalized, and Benchmark bases without implicit substitution (`RIAI-01C`).
- Deferred-maintenance and technical CAPEX inventory with immediate/deferred totals, severity and life-safety routing, and fail-closed unknown-cost handling.
- Bilingual RIAI cost summary for normalized OPEX, OPEX-to-contract-rent, known immediate CAPEX, and unpriced technical items.
- Versioned, local-only Residential Income operating-case JSON import/export with complete canonical rehydration and a 5 MB fail-closed limit (`RIAI-01P`).
- Optional operating-case persistence inside building Saved Deals and backup format v2, with backward-compatible restore of version-1 backups.

### Boundaries

- Economic occupancy is intentionally unavailable until collected-rent and potential-rent inputs exist; source-total Rent Roll reconciliation also remains unavailable without an adopted source total.
- OPEX completeness depends on a supplied expense inventory, while CAPEX completeness depends on a supplied technical assessment; no omitted item is inferred to be zero.
- Operating-case portability currently uses a validated JSON contract; a user-facing Rent Roll/lease editor is not yet implemented.
- This release does not implement mark-to-market, stabilized NOI, reverse underwriting v2, or exit-strategy comparison.
- The readiness panel does not calculate value or returns, issue an investment/legal/credit conclusion, or authorize a transaction.
