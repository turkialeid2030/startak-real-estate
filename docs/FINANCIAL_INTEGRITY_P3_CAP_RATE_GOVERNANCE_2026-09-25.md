# Financial Integrity P3 — Cap-Rate Governance and Evidence-Backed Direct Capitalization — 2026-09-25

## Purpose

P3 connects the P2 reconciled stabilized NOI to the existing valuation-intelligence direct-capitalization engine and introduces explicit governance for Entry Cap and Exit Cap assumptions.

The objective is to eliminate three model-risk classes:

1. producing a valuation indication from an unreconciled NOI;
2. treating a capitalization rate as a naked number without provenance;
3. silently copying Entry Cap into Exit Cap or assuming cap-rate compression without review signals.

P3 remains a decision-support engineering layer. It does **not** establish certified valuation authority, lender approval, transaction authority, legal/tax advice, or commercial Go-Live.

## Evidence-backed direct capitalization

`calculateReconciledEvidenceBackedDirectCapitalization()` performs the following sequence:

1. reconcile the residential-income stabilized operating case to the canonical P0 NOI waterfall;
2. validate capitalization-rate evidence and provenance;
3. pass reconciled EGI and operating expenses into the existing valuation-intelligence direct-capitalization engine;
4. calculate the value independently again from canonical NOI using the P0 direct-cap primitive;
5. compare the two values within a governed tolerance;
6. return a valuation indication only when the chain is coherent.

A mismatch or missing critical evidence fails closed.

## Entry Cap / Exit Cap separation

P3 treats Entry Cap and Exit Cap as separate assumptions.

Rules:

- Entry Cap must have its own evidence descriptor and source reference.
- Exit Cap, when required, must have its own evidence descriptor and source reference.
- The system never auto-copies Entry Cap into Exit Cap.
- Equal Entry and Exit Cap rates are allowed, but if they use the same source and no explicit rationale is supplied the case is flagged `REVIEW_REQUIRED`.
- Exit-cap compression is allowed, but without an explicit rationale it is flagged `REVIEW_REQUIRED`.
- An optional policy threshold can flag unusually wide Entry/Exit spreads for review; no universal spread threshold is hard-coded.
- Evidence conflict forces `HOLD`.
- Assumed or unverified cap-rate evidence triggers review rather than silent acceptance.

## Status semantics

Cap-rate governance:

- `PASS`
- `REVIEW_REQUIRED`
- `HOLD`

Reconciled evidence-backed direct capitalization:

- `QUALIFIED`
- `REVIEW_REQUIRED`
- `HOLD_INPUTS`
- `HOLD_EVIDENCE_CONFLICT`

`QUALIFIED` means only that the calculation chain passed the engineering/evidence controls implemented here. It is not a certified or final professional valuation conclusion.

## Evidence model

P3 reuses the existing valuation-intelligence evidence contract:

- evidence grade;
- input status;
- source type;
- source reference;
- observation date;
- note.

For cap-rate provenance, `sourceRef` is mandatory at the P3 governance boundary even though the generic evidence contract allows null references for other use cases.

## Cross-check control

The evidence-backed direct-cap result is cross-checked against:

`Canonical Value = Reconciled Stabilized NOI / Market Cap Rate`

The default tolerance is SAR 0.01 unless a different governed tolerance is supplied.

Any unexplained value mismatch blocks the output.

## Regression coverage

`tests/defects/financial_integrity_p3_cap_governance.js` covers:

- separate Entry/Exit evidence;
- required Exit Cap missing -> HOLD;
- equal Entry/Exit rate from the same source without rationale -> REVIEW;
- equal rate with explicit rationale -> PASS;
- cap-rate compression without rationale -> REVIEW;
- cap-rate compression with explicit rationale -> PASS;
- missing cap-rate source reference -> HOLD;
- assumed cap-rate evidence -> REVIEW;
- optional Entry/Exit spread policy threshold -> REVIEW;
- evidence-backed direct capitalization from reconciled NOI;
- arithmetic cross-check against canonical direct capitalization;
- unreconciled NOI blocks valuation;
- missing cap-rate provenance blocks valuation;
- evidence conflict blocks valuation.

## Next implementation sequence

1. Wire the P3 governed direct-cap result into the active acquisition workflow/UI.
2. Add governed DCF using dated cash flows and P0 XNPV/XIRR.
3. Require explicit Exit Cap evidence in DCF terminal-value construction.
4. Add RETT/VAT boundaries outside property NOI and cash-flow semantics.
5. Build the Golden Validation Corpus from independent valuation cases with tolerance bands and variance explanations.
6. Add combined downside and Monte Carlo only after deterministic direct-cap and DCF reconciliation remain stable under regression.
