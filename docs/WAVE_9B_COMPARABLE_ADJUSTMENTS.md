# Wave 9B — Professional Comparable Selection & Adjustment Traceability

Status: engineering candidate only. No merge to `main`; no production deployment authorization.

## Purpose

Wave 9B converts a quality-qualified comparable set into an accountable professional selection and a deterministic adjustment trace without substituting professional judgement.

## Selection gate

A comparable cannot enter adjustment analysis unless the Wave 9A quality gate is `QUALIFIED_FOR_PROFESSIONAL_SELECTION`, the selected comparable exists in the same case, the comparable is among the qualified IDs, and the professional user records a rationale, identity, evidence reference and timestamp.

The module never selects comparables automatically and never assigns valuation weights.

## Adjustment record

Each adjustment carries:

- comparable identity;
- adjustment factor and optional explicit `OTHER` label;
- direction: increase/decrease/none;
- method: percentage of base unit value or SAR/sqm amount;
- explicit magnitude supplied by the professional user;
- rationale;
- evidence references;
- confidence classification;
- preparer and preparation timestamp;
- reviewer, review timestamp and review evidence;
- deterministic SHA-256.

`NONE` requires zero magnitude. A non-zero direction requires positive magnitude. `OTHER` requires an explicit label. Review cannot predate preparation.

## Calculation convention

Wave 9B initially supports only the explicit convention `ADDITIVE_TO_BASE_UNIT_VALUE` to prevent hidden sequencing assumptions. The module calculates adjusted comparable indications from user-supplied adjustments, but it does not estimate the adjustments itself.

## Materiality review

Caller-supplied thresholds govern flags for material single adjustments, material net adjustment and material gross adjustment. Material flags produce `REVIEW_REQUIRED`; they do not silently discard the comparable or manufacture a replacement assumption.

A non-positive adjusted unit indication fails closed.

## Deliberate non-actions

The module does not create:

- automatic comparable selection;
- automatic adjustment estimation;
- automatic valuation weighting;
- final reconciliation or value conclusion;
- certified valuation status;
- legal conclusion;
- transaction authority.

## Qualification marker

`WAVE_9B_COMPARABLE_ADJUSTMENTS=PASS`

## Next controlled sub-wave

Wave 9C: governed lease-level and income evidence, rent-roll/lease reconciliation, contractual escalation/break/renewal/incentive/recovery provenance, and income-evidence handoff without automatic DCF adoption.
