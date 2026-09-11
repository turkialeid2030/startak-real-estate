# Wave 14E — Specialized Forecast Assumption Governance

## Scope

Wave 14E governs explicit forward-looking assumptions for hospitality and leisure assets. It does not calculate forecasts, NOI, valuation or investment returns.

## Supported families

### Hospitality
Applies to:
- full-service hotels
- limited-service hotels
- serviced apartments
- resorts

Required assumptions include available room nights, occupancy, ADR, departmental expenses, undistributed expenses and FF&E reserve. Full-service hotels and resorts additionally require F&B revenue assumptions. Management-agreement and franchise structures require the corresponding fee assumptions.

### Leisure
Applies to `LEISURE_ATTRACTION` and requires operating days, attendance, admissions revenue per visitor, ancillary spend per visitor, direct operating expenses, undistributed expenses and capital reserve. Management-agreement structures also require management-fee assumptions.

Heritage assets are not silently routed into either family.

## Evidence and review model

Every assumption line contains:
- metric and unit
- explicit value
- origin (`USER_ENTERED` or `PROFESSIONAL_JUDGMENT`)
- rationale
- evidence references
- preparer/reviewer provenance
- SHA-256 integrity

Forecast periods are individually hashed and cannot contain duplicate metrics or duplicate line IDs.

## Temporal and family controls

- forecast periods must begin after the valuation date
- periods may not overlap
- hospitality metrics cannot be injected into leisure forecasts and vice versa
- required metrics are enforced for every period
- assumption lines are not automatically derived from historical operating analytics
- no probability is assigned to an assumption in this wave

## Governance boundary

This layer does **not**:
- derive future assumptions automatically from historical ADR/RevPAR/attendance
- assign scenario probabilities
- calculate a hospitality or leisure forecast
- produce NOI
- write valuation-engine inputs
- select a valuation method
- perform valuation arithmetic
- certify a valuation
- authorize a transaction

The packet is only a governed handoff to a later specialized forecast calculation workflow.

## Qualification marker

`WAVE_14E_SPECIALIZED_FORECAST_ASSUMPTIONS=PASS`

Engineering candidate only. Do not merge or deploy to production without explicit authorization.
