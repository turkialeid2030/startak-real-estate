# Wave 12B — Governed Direct Capitalization

Status: engineering candidate only. No merge to `main`; no production deployment authorization.

## Purpose

Wave 12B creates a professional Direct Capitalization method indication from the qualified Wave 12A stabilized NOI and one explicit professionally reviewed market capitalization rate. It does not select the valuation method, derive a capitalization rate, reconcile methods, establish a final valuation, certify an appraisal, provide a legal opinion or authorize a transaction.

## Required upstream evidence

The input packet requires:

- an integrity-verified Wave 12A `PROFESSIONAL_NOI_READY` result for the same case/property and valuation date;
- a positive explicit stabilized NOI;
- an integrity-verified professional rate input of type `MARKET_CAP_RATE` for the same case/property;
- an explicit rate freshness policy (`maximumRateAgeDays`);
- rate `asOfDate` not after the valuation date;
- completed rate review not after Direct Capitalization packet preparation.

An `EXIT_CAP_RATE` cannot substitute for `MARKET_CAP_RATE`. A stale, future-dated, tampered or wrong-type rate fails closed.

## Canonical calculation

Only `src/engines/valuation/direct-capitalization.js` performs the method arithmetic:

`Direct Capitalization Value Indication = Stabilized Professional NOI / Market Capitalization Rate`

The selected NOI basis is explicitly `STABILIZED_NOI`. The NOI convention inherited from Wave 12A is retained in the trace.

## Integrity and provenance

Wave 12B binds:

- the Wave 12A NOI calculation hash;
- the Wave 12A input packet hash;
- the selected stabilized NOI and NOI convention;
- the professional cap-rate input hash, source, rationale, evidence, confidence, review and freshness;
- the Direct Capitalization packet hash;
- the canonical calculation hash.

## Safety boundaries

- no automatic method selection;
- no automatic cap-rate derivation;
- no exit-cap fallback;
- no capitalization of zero or negative NOI;
- no method reconciliation;
- no DCF;
- no financing or credit decision;
- no final/certified valuation;
- no legal opinion;
- no transaction authority;
- no changes to legacy investment formulas or golden fixtures.

## Qualification marker

`WAVE_12B_DIRECT_CAPITALIZATION=PASS`

## Next controlled sub-wave

Wave 12C: governed professional DCF with explicit forecast cash flows, explicit discount-rate and exit-cap provenance, explicit timing convention and terminal-value trace. It must remain separate from financing/equity return analysis and must not manufacture missing exit assumptions.
