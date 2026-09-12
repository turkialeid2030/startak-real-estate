# Wave 14F — Specialized Operating Forecast

## Scope

Wave 14F converts only qualified Wave 14E assumptions into deterministic hospitality or leisure operating forecasts. Arithmetic is centralized under `src/engines/valuation/specialized-operating-forecast.js`.

## Hospitality forecast

For each forecast period:

- occupied room nights = available room nights × occupancy
- rooms revenue = occupied room nights × ADR
- total operating revenue = rooms revenue + explicit F&B revenue + explicit other revenue
- gross operating profit before operator fees = total operating revenue − departmental expenses − undistributed expenses
- operator fees = explicit management fees + explicit franchise fees
- operating surplus before reserve = GOP before operator fees − operator fees
- operating surplus after reserve = operating surplus before reserve − FF&E reserve
- RevPAR and revenue per available room night are deterministic derived metrics

## Leisure forecast

For each forecast period:

- admissions revenue = attendance × admissions revenue per visitor
- ancillary revenue = attendance × ancillary spend per visitor
- total operating revenue = admissions revenue + ancillary revenue
- operating surplus before management/reserve = total operating revenue − direct operating expenses − undistributed expenses
- operating surplus before reserve = prior measure − explicit management fees
- operating surplus after reserve = prior measure − capital reserve
- attendance per operating day and per-visitor metrics are deterministic derived metrics

## Provenance

Every calculated period is bound to:

- the exact Wave 14E assumption packet hash
- the exact period hash
- every assumption-line hash
- the internal metric convention `STARTAK_SPECIALIZED_OPERATING_FORECAST_V1`
- preparer and reviewer provenance

## Governance boundary

Operating surplus is **not** automatically treated as NOI. This wave performs no capitalization, discounting, terminal-value calculation, property valuation, method selection, investment recommendation, certified valuation, legal conclusion or transaction authorization.

No formula is duplicated in UI or AI layers; specialized forecast arithmetic resides in the canonical engine only.

## Qualification marker

`WAVE_14F_SPECIALIZED_OPERATING_FORECAST=PASS`

Engineering candidate only. Do not merge or deploy to production without explicit authorization.
