# Changelog

## Unreleased

### Added

- Residential Income Acquisition Intelligence foundation (`RIAI-01A`) with an immutable PropertyInterest/Property/Building/Unit/Lease/Tenant operating graph.
- Evidence-aware operating inputs, explicit underwriting adoption lineage, and fail-closed readiness states.
- Deterministic API projection for operating-underwriting readiness without invoking or duplicating the financial, title, or tenant engines.
- Safe, bilingual Existing Building readiness panel with an explicit no-case-loaded state.
- Synthetic regression coverage for long step-rent leases, time-limited usufruct, conflicting occupancy evidence, omitted operating cost, waqf restrictions, and contradictory active leases.

### Boundaries

- This release does not implement Rent Roll aggregation, occupancy/WALE calculations, OPEX/CAPEX normalization, mark-to-market, stabilized NOI, reverse underwriting v2, exit-strategy comparison, or operating-case persistence.
- The readiness panel does not calculate value or returns, issue an investment/legal/credit conclusion, or authorize a transaction.
