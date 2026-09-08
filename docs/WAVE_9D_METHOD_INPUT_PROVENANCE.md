# Wave 9D — Professional Method-Input Provenance & Canonical Engine Boundary

Status: engineering candidate only. No merge to `main`; no production deployment authorization.

## Purpose

Wave 9D closes the Wave 9 evidence-to-method handoff without creating a second valuation engine. It binds qualified property evidence, market/comparable analysis, lease-income evidence and professionally reviewed rate inputs into an immutable candidate method-input packet for explicit human adoption review.

The canonical calculation engine remains authoritative.

## Methods

The handoff supports:

- `SALES_COMPARISON`
- `DIRECT_CAPITALIZATION`
- `DISCOUNTED_CASH_FLOW`

The module does not select a method automatically.

## Sales-comparison binding

Wave 9A/9B market analysis is case-scoped, while the subject property comes from the professional Property Evidence Packet. Wave 9D therefore requires an explicit, integrity-hashed professional subject-property binding between the market-adjustment analysis and the property. The subject property is never inferred.

A sales-comparison packet requires the adjustment analysis to be `READY_FOR_RECONCILIATION`. Adjusted comparable indications remain unweighted.

## Professional rate provenance

Each rate input records:

- case/property;
- rate type: `MARKET_CAP_RATE`, `DISCOUNT_RATE`, or `EXIT_CAP_RATE`;
- decimal value;
- source class and optional explicit source label;
- rationale;
- evidence references;
- rate as-of date;
- preparer/reviewer identities and timestamps;
- review evidence;
- confidence;
- deterministic integrity SHA-256.

Rate inputs are explicit professional inputs. They are not derived by this module.

## Method completeness

`DIRECT_CAPITALIZATION` requires verified/reconciled income evidence plus an explicit professionally reviewed `MARKET_CAP_RATE`.

`DISCOUNTED_CASH_FLOW` requires verified/reconciled income evidence plus explicit professionally reviewed `DISCOUNT_RATE` and `EXIT_CAP_RATE`.

`marketCapRate` is never substituted for a missing `exitCapRate`. This preserves the existing V2 canonical-engine exit-cap boundary.

Required rate types must have an explicit maximum-age policy. Future-dated, stale, duplicate, tampered or post-preparation reviewed rate records fail closed.

## Candidate canonical bindings

The output exposes only candidate bindings for explicit human adoption review:

- direct capitalization: `marketCapRate`
- DCF: `discountRate`, `exitCapRate`

It does not write those fields into the engine.

## Deliberate non-actions

The packet explicitly keeps false:

- `canonicalEngineInputWriteAuthorized`
- `financialEngineInputsWritten`
- `automaticMethodSelection`
- `automaticValuationWeighting`
- `valuationConclusionProduced`
- `certifiedValuationEstablished`
- `transactionAuthorized`

It also leaves NOI and final reconciliation to downstream canonical/professional workflows.

## Qualification marker

`WAVE_9D_METHOD_INPUT_PROVENANCE=PASS`

## Wave 9 completion target

On qualification, Wave 9 establishes:

`Property Evidence → Market Evidence → Comparable Quality → Professional Selection → Adjustment Trace → Lease Evidence → Rent-Roll Reconciliation → Professional Rate Provenance → Method-Input Packet → Canonical Engine Adoption Review`.

The next engineering wave is Wave 10: Highest & Best Use, Saudi planning/zoning evidence, temporal planning validity and evidence-grounded ESG consideration without automatic value adjustment.
