# C21 — Governed Listing Transparency & Amenity Utility Intelligence

## Purpose
C21 is a governed analytical review layer for listing transparency and amenity utility. It is stacked on the exact qualified C20 head and does not change production, transaction, approval, Public AI or commercial authority.

## Listing transparency boundary
Listing evidence is treated as **asking evidence only**. C21 never promotes an asking listing into a closed transaction comparable. Every listing record carries:
- exact case/property/market scope;
- listing reference and deduplication key;
- listing status;
- explicit asking price and area only when both are supplied;
- source provider/tier/record/reference/SHA-256;
- provenance verification and timestamps;
- immutable evidence hash.

When the review is fully governed, C21 may calculate descriptive asking-price-per-square-metre statistics from active or under-offer listings. Those values are not market value, closed-transaction evidence, AVM output or a recommendation.

## Amenity evidence boundary
Amenity evidence is one of:
- `EXISTING_VERIFIED`
- `PLANNED_NOT_DELIVERED`
- `PROPOSED_UNCERTAIN`
- `UNRESOLVED`

Supported evidence may carry externally supplied numeric metrics such as distance, drive time, walk time or counts. C21 does not geocode, calculate routes, infer distance/travel time, infer service availability, or infer that a planned/proposed amenity has been delivered.

## Professional utility assessment
Utility scores and importance weights are supplied externally by a professional/reviewer and bound to an exact amenity-evidence SHA-256. C21 only computes a weighted mean from the explicit professional scores and weights for `EXISTING_VERIFIED` amenities.

The resulting value is an analytical utility summary, not investment attractiveness, valuation, ranking, purchase recommendation or development recommendation.

## Fail-closed controls
C21 holds review on:
- tampered listing, amenity, utility or policy records;
- duplicate IDs, hashes or listing deduplication keys;
- cross-case/property/market-scope evidence;
- unverified provenance or disallowed source tier;
- future/stale evidence;
- unresolved required amenity evidence;
- required amenity-class coverage gaps;
- utility assessment bound to planned/proposed/unresolved amenity evidence;
- policy/hash binding mismatch;
- authority, geospatial, valuation or recommendation injection.

## Explicit non-goals
C21 does not provide:
- geocoding or routing;
- listing authenticity guarantee beyond governed evidence status;
- closed-transaction conversion from asking listings;
- automatic amenity quality inference;
- automatic investment ranking;
- valuation, AVM, residual value, DCF, NPV or IRR;
- acquisition/disposal/development recommendation;
- transaction or filing authority.

## Authority boundary
- `COMMERCIAL_GO_LIVE = HOLD`
- `TRANSACTION_AUTHORITY = FALSE`
- `APPROVAL_AUTHORIZED = FALSE`
- `PUBLIC_AI = FALSE`
- `CANONICAL_BASELINE_ACTIVATION_AUTHORIZED = FALSE`
- `MERGE HOLD = ON`
- `DEPLOY = NO`
