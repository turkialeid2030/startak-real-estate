# Wave 13A — Commercial Real Estate Specialization

Status: engineering candidate only. No merge to `main`; no production deployment authorization.

Wave 13A adds a commercial real-estate specialization layer on top of the qualified property-evidence, market-evidence, income/NOI, valuation and investment/financing architecture. It does not introduce a second valuation engine and does not change any canonical valuation arithmetic.

## Commercial asset taxonomy

Supported internal specialization classes:
- Office
- Street Retail
- Shopping Centre
- Business Park
- Industrial / Logistics
- Commercial Mixed Use

Supported occupancy structures:
- Owner Occupied
- Single Tenant
- Multi-Tenant
- Vacant
- Mixed

These are internal analysis taxonomies only. They do not establish legal zoning, regulatory classification or standards applicability.

## Use-specific evidence matrix

The specialization layer evaluates evidence completeness across topics such as property rights/physical facts, measurements, leases/rent roll, market rent, occupancy/vacancy, operating expenses, service-charge recoveries, tenant covenant/concentration, capital expenditure, parking/access/amenities, retail trading performance, logistics technical specifications, mixed-use allocation and sale comparables.

Requirements vary by asset class and occupancy structure. A topic may be `REQUIRED`, `CONDITIONAL` or `NOT_APPLICABLE`. Conditional topics require an explicit applicability decision; omission is not interpreted as false.

## Evidence quality boundary

A required or applicable conditional topic is satisfied only by `VERIFIED` or `PROFESSIONAL_REVIEWED` evidence. `ASSUMED`, `CLIENT_PROVIDED_UNVERIFIED` and `MISSING` cannot satisfy a mandatory commercial evidence requirement.

Evidence items bind case/property, as-of date, rationale, evidence references, preparer, reviewer, review evidence and deterministic SHA-256 integrity.

The specialization packet must also bind an integrity-verified `PropertyEvidencePacket` whose status is `READY_FOR_PROFESSIONAL_VALUATION_WORKFLOW`. Tampered or non-ready property evidence fails closed.

## Safety and governance boundary

Wave 13A:
- does not select a valuation method automatically;
- does not adopt rent, expense, cap-rate, discount-rate, exit-cap or comparable inputs automatically;
- does not perform valuation arithmetic;
- does not establish standards/legal applicability;
- does not certify a valuation;
- does not issue legal, investment-advice or credit conclusions;
- does not authorize a transaction.

A successful result is only `READY_FOR_PROFESSIONAL_METHOD_WORKFLOW`, meaning commercial evidence completeness has passed the internal specialization gate and the case may proceed to the existing governed method workflows.

Qualification marker: `WAVE_13A_COMMERCIAL_SPECIALIZATION=PASS`.

Next controlled sub-wave: Wave 13B — commercial method-readiness routing, assessing whether the evidence set is sufficient for Sales Comparison, Direct Capitalization, DCF and Cost Approach without choosing a method or changing canonical arithmetic.
