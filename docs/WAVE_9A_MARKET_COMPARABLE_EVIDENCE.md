# Wave 9A — Governed Market & Comparable Evidence

Status: engineering candidate only. No merge to `main`; no production deployment authorization.

## Purpose

Wave 9A establishes a governed market-evidence and comparable-quality layer for professional valuation workflows. It does not select comparables automatically, assign valuation weights, calculate a valuation conclusion, or authorize a transaction.

## Evidence hierarchy

The module preserves the ordered evidence hierarchy:

`OFFICIAL_REGISTERED_TRANSACTION > VERIFIED_TRANSACTION > CONFIRMED_TRANSACTION > VERIFIED_OFFER > BROKER_CONFIRMED > PUBLIC_AD > UNVERIFIED`.

Claims at higher levels require matching verification status. A merely confirmed or public source cannot be promoted to a verified transaction by label alone.

## Comparable provenance

Each comparable records case/property identity, asset type, transaction type, evidence level/rank, source identity/reference, source and transaction dates, location, area, amount, normalized SAR/sqm unit value, verification provenance, abnormal-transaction flags, capture time, and deterministic SHA-256.

## Quality gates

The comparable-set quality gate explicitly evaluates:

- case isolation;
- evidence-level floor;
- freshness/staleness against an explicit as-of date;
- duplicate transaction fingerprints;
- abnormal/non-arm's-length flags requiring professional disposition;
- configured unit-value outlier warnings;
- contradictory records for the same property/date;
- minimum count of unique qualified comparables.

Outliers are not silently deleted. Duplicates, abnormal transactions, stale evidence, and evidence below the configured floor are traceable. No source winner is manufactured.

## Deliberate non-actions

The quality module returns `professionalSelectionRequired=true`, `automaticComparableSelection=false`, and `automaticValuationWeighting=false`.

It does not create a certified valuation, licensed-provider status, legal conclusion, investment recommendation, or transaction authority.

## Qualification marker

`WAVE_9A_MARKET_COMPARABLE_EVIDENCE=PASS`

## Next controlled sub-wave

Wave 9B will add professional comparable selection and quantitative adjustment traceability: factor, direction, amount/percentage, rationale, evidence references, confidence, reviewer, and final adjusted indication, without automatic professional-judgment substitution.
