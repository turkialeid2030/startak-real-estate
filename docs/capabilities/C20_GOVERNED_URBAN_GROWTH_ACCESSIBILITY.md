# C20 — Governed Urban Growth / Accessibility Intelligence

## Purpose
C20 is an evidence-bound professional-review capability for urban-growth and accessibility signals. It prepares externally sourced observations for deterministic review and arithmetic reconciliation without creating geospatial, legal, valuation, investment, or transaction authority.

C20 is stacked on the exact qualified C19 head and remains subject to the repository's merge/deploy governance.

## Evidence model
Every evidence record exact-binds:

- case, property, and market-scope context;
- an explicit `signalKey` and governed signal class;
- metric type, metric unit, and an evidence-supplied numeric value;
- observation state;
- source capability/provider/tier/record/reference/status and source-record SHA-256;
- provenance verification;
- known, reference, review, and validity timestamps;
- professional reviewer evidence;
- its own SHA-256 integrity hash.

Supported signal classes are population/household growth, building-permit/construction activity, urban footprint/developed area, road/transit accessibility, employment/activity-center access, essential-services access, planned infrastructure/corridor, and explicitly labelled OTHER evidence.

## Existing versus non-existing evidence
Observation state is explicit:

- `OBSERVED_EXISTING`
- `PLANNED_COMMITTED_NOT_DELIVERED`
- `PROPOSED_UNCERTAIN`
- `UNRESOLVED`

Planned or proposed infrastructure is never treated as delivered or existing. When policy allows it, it is exposed only as review-only context with `treatedAsExisting=false`. `UNRESOLVED` evidence is fail-closed.

## Professional comparison pairs
A comparison pair is externally authored and exact-binds a baseline evidence hash and current evidence hash. Both sides must share the same signal key, signal class, metric type, and metric unit. They must both be `OBSERVED_EXISTING`, and the current reference timestamp must be later than the baseline reference timestamp.

Allowed analysis types are:

- `GROWTH_DELTA`
- `ACCESSIBILITY_DELTA`

The engine rejects semantically incompatible pairings, such as applying an accessibility delta to a population-growth signal.

## Deterministic arithmetic boundary
When the governed packet is complete, C20 may calculate only:

- signed absolute delta = current evidence value − baseline evidence value;
- percentage delta when the baseline is non-zero.

A zero baseline does not create an invented percentage; percentage delta remains `null` and is surfaced as a review risk flag.

The sign of a delta is descriptive only. A shorter travel-time delta, larger population count, or any other movement is not automatically labelled beneficial, adverse, investable, or value-accretive.

## Source governance
Source tiers are explicit. `C_INDICATIVE_AVM` is not accepted as urban-growth/accessibility evidence and cannot be allowed by a C20 review policy.

Public availability, a map display, or a website does not establish machine-access rights, licensing, redistribution rights, or authoritative truth. C20 consumes governed evidence records; it does not grant a source new authority.

## Fail-closed controls
C20 holds professional review on integrity failure, policy mismatch, cross-context evidence, future knowledge, stale evidence, unresolved evidence, unverified provenance, disallowed source tier, duplicate IDs/hashes/role bindings, baseline/current incompatibility, non-observed evidence used in a pair, missing required signal-class coverage, hash-binding mismatch, or invalid/non-finite arithmetic.

## Explicit non-goals
C20 does not:

- geocode or resolve a parcel/location;
- calculate a route, distance, or travel time from geometry;
- infer that roads, transit, services, or projects exist;
- infer project delivery or completion probability;
- determine service availability;
- estimate causal uplift or policy/project impact;
- create an automatic accessibility score, growth score, or investment ranking;
- determine zoning, entitlement, buildability, title, or legal compliance;
- calculate market value, AVM, residual value, DCF, NPV, or IRR;
- recommend acquisition, disposal, development, or financing;
- authorize a transaction, approval, production deployment, Public AI, commercial go-live, or canonical baseline activation.

## Authority posture
The capability always returns:

- `transactionAuthorized = false`
- `approvalAuthorized = false`
- `productionAuthorized = false`
- `publicAiAuthorized = false`
- `commercialGoLive = HOLD`
- `canonicalBaselineActivationAuthorized = false`

Repository governance remains:

- `MERGE HOLD = ON`
- `DEPLOY = NO`

Technical qualification does not change these authority boundaries.
