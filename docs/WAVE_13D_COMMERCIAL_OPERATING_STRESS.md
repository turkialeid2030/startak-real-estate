# Wave 13D — Commercial Operating Stress Scenarios

Status: engineering candidate only. This wave is stacked on the qualified Wave 13C commercial operating metrics branch. No merge to `main` and no production deployment authorization.

Wave 13D adds governed lease-level operating stress scenarios for occupied commercial assets. It uses explicit user-entered or professionally reviewed assumptions and preserves a strict separation between hypothetical operational stress, tenant credit assessment, lease/legal interpretation, property valuation, investment recommendation and transaction authority.

## Qualified source chain

The stress packet requires an integrity-verified Wave 13C `CommercialOperatingMetrics` packet with status `READY`, together with the exact Wave 9C reconciled income-evidence packet and verified rent-roll snapshot that produced it. The source hashes, case, property and as-of date must remain bound and consistent.

If Wave 13C is legitimately `NOT_APPLICABLE_NO_LEASE_PORTFOLIO`, Wave 13D is also not applicable rather than fabricating scenario outputs.

## Explicit scenario assumptions

Each stress scenario is immutable and content-addressed. It records:
- scenario id, kind and label;
- stress mode;
- selected tenant references and/or lease ids and/or an expiry window;
- assumption origin (`USER_ENTERED` or `PROFESSIONAL_JUDGMENT`);
- rationale and assumption references;
- preparer, reviewer, timestamps and review evidence;
- `scenarioAssumptionHashSha256`.

Only `DOWNSIDE`, `SEVERE_DOWNSIDE` and `CUSTOM` are accepted as commercial stress kinds. The engine does not attach probabilities to scenarios and does not infer a tenant default or renewal probability.

## Stress modes

### Selected tenant exit
All active leases for explicitly selected tenants are removed in the hypothetical scenario.

### Selected lease exit
Only explicitly selected active leases are removed.

### Expiry non-renewal window
Active leases whose contractual expiry falls within the explicit future window are treated as non-renewed for the scenario. This is a hypothetical stress assumption only; it is not a renewal forecast or contractual/legal interpretation.

### Combined
Explicit tenant, lease and expiry-window assumptions may be combined. The engine de-duplicates affected leases so a lease hit by more than one assumption is removed once while preserving all applicable stress causes.

Unknown active tenant/lease references or scenarios that select no active lease fail closed.

## Deterministic outputs

For each scenario, the packet preserves the factual base state and computes the hypothetical stressed state using the same verified lease evidence:
- active lease count;
- tenant count;
- occupied area;
- total lettable area;
- occupancy rate;
- annual contractual rent;
- rent-retention rate;
- occupied-area retention rate;
- Top-1 / Top-3 / Top-5 concentration by remaining contractual rent and area;
- affected lease, tenant, area and contractual-rent totals;
- occupancy-rate delta and contractual-rent delta;
- lease-level causes for each affected lease.

No market-rent replacement, downtime, reletting cost, capex, NOI, capitalization, DCF or valuation arithmetic is introduced in this wave.

## Integrity and fail-closed controls

- Wave 13C metrics integrity must verify.
- Wave 9C income-evidence and rent-roll integrity must verify independently.
- Hash bindings between Wave 13C and Wave 9C sources must match exactly.
- Case, property and as-of date must match.
- Scenario assumptions must pass their own SHA-256 integrity check.
- Duplicate scenario ids are blocked.
- Scenario review must not post-date the outer stress-packet review.
- The final output is content-addressed by `commercialOperatingStressHashSha256`.

## Governance boundary

Wave 13D does **not**:
- assign scenario probabilities;
- predict tenant default, insolvency or credit events;
- produce a tenant credit rating or probability of default;
- predict lease renewal or exercise break/renewal options;
- interpret lease clauses legally;
- write valuation inputs or perform valuation arithmetic;
- forecast NOI;
- make an investment recommendation;
- certify a valuation;
- authorize a transaction.

The output is a governed hypothetical operating-stress evidence packet for professional decision support only.

Qualification marker: `WAVE_13D_COMMERCIAL_OPERATING_STRESS=PASS`.

Next controlled work should remain evidence-first and avoid turning scenario assumptions into predicted credit, legal or valuation conclusions without separately qualified workflows.
