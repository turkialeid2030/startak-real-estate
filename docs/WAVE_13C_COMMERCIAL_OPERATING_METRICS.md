# Wave 13C — Commercial Operating Metrics & Lease Concentration

Status: engineering candidate only. No merge to `main`; no production deployment authorization.

Wave 13C adds deterministic factual operating analytics for occupied commercial assets. It is built on the qualified Wave 13A commercial specialization layer and the reconciled Wave 9C lease/rent-roll evidence. It does not introduce a tenant credit-rating model, valuation engine, investment recommendation or legal lease interpretation.

## Qualified source chain

The metrics packet requires:
1. an integrity-verified Wave 13A `CommercialSpecializationPacket` with status `READY_FOR_PROFESSIONAL_METHOD_WORKFLOW`;
2. a qualified `LEASE_AND_RENT_ROLL` evidence topic for lease-applicable occupancy structures;
3. an integrity-verified Wave 9C income-evidence packet with status `READY_FOR_INCOME_ANALYSIS_HANDOFF`;
4. its exact integrity-verified rent-roll snapshot, bound by `rentRollHashSha256`;
5. the same case, property and valuation/as-of date.

`SINGLE_TENANT`, `MULTI_TENANT` and `MIXED` are lease-applicable. `VACANT` and `OWNER_OCCUPIED` do not fabricate lease metrics; absent lease data returns `NOT_APPLICABLE_NO_LEASE_PORTFOLIO`. Supplying an active lease portfolio against a non-lease occupancy structure produces an explicit hold.

## Deterministic factual metrics

Using reconciled active leases only, the packet computes:
- active lease count;
- unique tenant count;
- occupied area;
- total lettable area from the verified rent-roll snapshot;
- lease-derived occupancy rate;
- annual contractual rent;
- weighted-average contractual rent per square metre per year;
- rent-weighted WALE;
- area-weighted WALE;
- Top-1 / Top-3 / Top-5 tenant concentration by annual contractual rent;
- Top-1 / Top-3 / Top-5 tenant concentration by occupied area;
- tenant-level factual aggregates;
- contractual lease-expiry buckets: <=1 year, >1–3 years, >3–5 years, and >5 years, including lease count, area, rent and shares.

WALE and expiry buckets use contractual `expiryDate` only. Break/renewal options are not automatically exercised or interpreted.

## Integrity and fail-closed behavior

Both the rent-roll snapshot and reconciled income-evidence packet are independently SHA-256 verified. Their rent-roll hashes must match. Cross-case/property inputs, tampering, invalid dates, non-ready source packets or an occupied area greater than verified total lettable area fail closed.

The output itself is content-addressed by `commercialOperatingMetricsHashSha256`.

## Safety and governance boundary

Wave 13C does not:
- produce a credit rating or tenant risk grade;
- estimate probability of default;
- treat concentration as an automatic risk classification;
- adopt valuation inputs;
- perform valuation arithmetic;
- forecast rent or NOI;
- make an investment recommendation;
- interpret lease clauses legally;
- certify a valuation;
- authorize a transaction.

The metrics are factual decision-support evidence only. Existing Tenant & Covenant Intelligence remains a separate evidence-based analytical layer and is not converted into a regulated credit rating by this wave.

Qualification marker: `WAVE_13C_COMMERCIAL_OPERATING_METRICS=PASS`.

Next controlled sub-wave: Wave 13D — governed commercial concentration and expiry stress scenarios, using explicit user/professional scenario assumptions and preserving separation from property valuation, tenant credit ratings and transaction decisions.
