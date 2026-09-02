# Residential Income Acquisition Intelligence - Operating Contract v1

Status: **RIAI-01A FOUNDATION + DETERMINISTIC READINESS API/UI IMPLEMENTED**

## Purpose

This boundary introduces the canonical operating graph required before a residential income acquisition can be underwritten from unit and lease data:

`Investment Case -> Property Interest -> Property -> Building -> Unit -> Lease -> Tenant`

It extends the Existing Building study without replacing its financial engine. No formula in the current valuation or recommendation path is changed by this foundation.

## Implemented boundary

- Explicit property-interest types: freehold, leasehold, usufruct, ground lease, long-term lease, waqf development right, JV economic interest, and other contractual interest.
- Immutable Property, Building, Unit, Lease, and Tenant records with case/property graph isolation.
- Evidence-aware operating values carrying source, evidence type, effective date, verification status, confidence, human adoption, assumption override, and lineage references.
- Lease escalation contracts for fixed percentage, fixed amount, step rent, indexed rent, manual schedules, and no escalation.
- Links to the existing Title Intelligence and Tenant/Covenant Intelligence outputs without duplicating their legal or credit logic.
- Fail-closed readiness states:
  - `READY_FOR_OPERATING_UNDERWRITING`
  - `READY_WITH_ASSUMPTIONS`
  - `NEEDS_DUE_DILIGENCE`
  - `INSUFFICIENT_EVIDENCE`
  - `DECISION_BLOCKED`
- Existing Building integration through `createOperatingUnderwritingCase` and `assessOperatingUnderwritingReadiness`.
- Deterministic, immutable UI projection through `createResidentialIncomeAcquisitionViewModel`.
- A safe Existing Building surface that shows the not-loaded state or the operating-case readiness, record counts, blockers, evidence gaps, and required diligence.
- An explicit production empty state: the application does not create or preload a synthetic operating case.

## Safety invariants

1. Mixed investment cases, properties, buildings, units, leases, tenants, or evidence lineages are rejected.
2. Duplicate entity identifiers and dangling graph references are rejected.
3. Verified facts do not enter underwriting until an explicit human-adoption reference exists.
4. Assumptions require a reason, accountable approver reference, approval time, and explicit adoption.
5. Unverified, observed-only, unavailable, or conflicting material inputs do not become ready inputs.
6. Conflicting operating inputs are not silently averaged or resolved by source order.
7. Occupied units must reconcile to one active lease; contradictory occupancy/lease states block the decision path.
8. Time-limited interests retain commencement and expiry boundaries and do not create an inferred freehold terminal value.
9. Title flags route to legal review; the platform does not certify title or provide legal clearance.
10. Tenant assessment outputs remain analytical indications; the platform does not issue a credit rating or tenant approval.

## Reference-derived regression scenarios

Private source documents informed the synthetic regression scenarios, but private identities and document numbers are not stored in fixtures:

- a 20-year lease with SAR 2 million annual rent and a SAR 100,000 increase every five years;
- a 14-year usufruct/long-term interest with conflicting occupancy statements and an omitted management-cost assumption;
- a waqf-restricted title fact routed to legal review;
- deferred-maintenance items whose unknown costs must remain unavailable rather than becoming zero.

## API and UI boundary

The API is a projection over the canonical contract and readiness assessment. It does not call the financial engine, write financial inputs, access the network, read ambient browser globals, authorize a transaction, or infer missing facts. When no operating case is supplied it returns `NOT_LOADED`, not a synthetic example.

The Existing Building screen exposes this boundary as a readiness panel. It is intentionally not shown for Land + Development. The current production screen has no persistence or ingestion path for operating cases; attaching a validated case remains a later integration wave.

## Explicitly not implemented in this foundation

- Rent Roll aggregation and reconciliation.
- Physical, area, contracted, and economic occupancy calculations.
- WALE/WALT, lease cliffs, rollover exposure, and renewal windows.
- OPEX normalization and market benchmarking.
- Deferred-maintenance and technical CAPEX cost engine.
- Mark-to-market and realizable reversion.
- Stabilized NOI and risk-adjusted NOI.
- Acquisition basis, reverse underwriting v2, and exit-strategy comparison.
- Operating-case ingestion and persistence.
- Location, lifecycle, subdivision, upside catalysts, and AI acquisition score.

These remain later RIAI waves. The presence of the v1 contract, readiness API, and safe UI surface must not be represented as completion of the broader Residential Income Acquisition Intelligence capability.

This document is an engineering and analytical boundary, not a legal opinion, certified valuation, credit rating, or investment recommendation.
