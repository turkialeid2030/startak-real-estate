# Wave 12A — Professional Income Forecast & NOI Governance

Status: engineering candidate only. No merge to `main`; no production deployment authorization.

## Purpose

Wave 12A creates the governed bridge from the verified lease-income evidence packet established in Wave 9D to a deterministic professional income forecast and NOI calculation. It deliberately does **not** perform capitalization, DCF, financing analysis, tax calculation, final valuation, certification or transaction authorization.

## Upstream gate

A Wave 12A packet requires a Wave 9D lease-income evidence packet that:

- is `READY_FOR_INCOME_ANALYSIS_HANDOFF`;
- belongs to the same case and property;
- passes deterministic SHA-256 integrity verification;
- has an `asOfDate` equal to the valuation date.

The verified rent-roll baseline is retained in the packet as context: annual contract rent, occupied area and active lease count. It is not silently overwritten by forecast assumptions.

## Explicit professional forecast

Each annualized forecast period contains:

- explicit income lines (`CONTRACTUAL_RENT`, `MARKET_RENT`, `RECOVERIES`, `OTHER_PROPERTY_INCOME`);
- one explicit vacancy/collection-loss assumption, including an explicit zero when zero is intended;
- explicit operating expense lines, including an explicit zero line when zero operating expenses are intended;
- a professional rationale, preparer, reviewer and review evidence;
- deterministic integrity hashes.

Contractual rent lines require `VERIFIED_LEASE_EVIDENCE`. Market rent and other forecast assumptions cannot be inferred automatically.

Exactly one period must be explicitly designated as the stabilized period. The system does not decide stabilization automatically.

## NOI conventions

The packet explicitly chooses one of:

- `BEFORE_REPLACEMENT_RESERVE`
- `AFTER_REPLACEMENT_RESERVE`

The canonical engine calculates and discloses both measures for every period. The selected convention controls only the selected NOI field; it does not delete the alternate measure.

## Canonical arithmetic

Only `src/engines/valuation/professional-income-noi.js` performs Wave 12A arithmetic.

For each period:

`PGI = sum(explicit income lines)`

`Vacancy / collection loss = explicit SAR amount OR explicit % of PGI`

`EGI = PGI - vacancy / collection loss`

`Operating expenses = explicit SAR amounts + explicit % of EGI`

`NOI before reserve = EGI - operating expenses excluding replacement reserve`

`NOI after reserve = NOI before reserve - replacement reserve`

Negative or zero NOI is retained as an economically meaningful result and flagged for professional review. It is not replaced by zero or a fabricated positive value.

## Exclusions and professional boundary

Wave 12A excludes from NOI arithmetic:

- debt service and financing;
- depreciation;
- capital expenditure;
- income tax / Zakat calculation;
- acquisition costs;
- capitalization and terminal value;
- DCF and discounting.

Lease break and renewal options are preserved upstream as evidence but are not automatically exercised. Market rent is never auto-applied.

## Qualification marker

`WAVE_12A_PROFESSIONAL_INCOME_NOI=PASS`

## Next controlled sub-wave

Wave 12B: governed Direct Capitalization using the qualified stabilized NOI from Wave 12A plus an explicit professionally reviewed market capitalization rate. No automatic method selection, no rate derivation, and no final valuation conclusion.
