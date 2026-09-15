# Wave 10B — ESG Evidence and Materiality Governance

Status: engineering candidate only. No merge to `main`; no production deployment authorization.

## Purpose

Wave 10B adds an evidence-first ESG layer for professional valuation workflows. It deliberately separates ESG evidence, professional materiality judgment, market linkage, and any later valuation-method adoption.

An ESG factor is never assumed to change value merely because it exists. A value-related consideration requires verified evidence, explicit materiality review, market-evidence linkage, and accountable professional adoption.

## ESG evidence model

The model supports Environmental, Social and Governance pillars and factors including energy performance, water efficiency, GHG emissions, climate physical risk, resilience/adaptation, indoor environmental quality, accessibility/inclusion, health/safety, community impact, governance/compliance, certification/rating and explicit `OTHER`.

Each evidence record carries case/property binding, claim key, normalized value, unit, observation, source class/name/reference, source date, validity interval, verification provenance, capture timestamp and deterministic SHA-256.

## Evidence-set qualification

A configured evidence set fails closed for:

- missing required factor evidence;
- evidence not valid on the valuation date;
- unverified or disallowed source class;
- stale evidence under factor-specific freshness policy;
- contradictory verified claims for the same factor/claim key;
- duplicate evidence IDs;
- integrity-hash failure;
- cross-case or cross-property contamination.

`READY_FOR_MATERIALITY_REVIEW` means evidence is ready for professional materiality review only. It does not establish a value effect.

## Materiality review

Every configured factor must receive an explicit professional materiality outcome:

- `MATERIAL`
- `POTENTIALLY_MATERIAL`
- `NOT_MATERIAL`
- `REVIEW_REQUIRED`

Each outcome is tied to rationale and the underlying evidence IDs/hashes. The assessment records reviewer, timestamp, review evidence and deterministic SHA-256.

Materiality review does not calculate a premium, discount, cap-rate change, discount-rate change or any other numeric value adjustment.

## Valuation consideration handoff

Only factors assessed as `MATERIAL` or `POTENTIALLY_MATERIAL` may be handed to professional valuation consideration. Each consideration requires explicit market-evidence references and a professional directional view (`UPWARD`, `DOWNWARD`, `NEUTRAL`, `UNCERTAIN`).

This packet remains non-calculative:

- `automaticValueAdjustmentApplied=false`
- `numericValueAdjustmentProduced=false`
- `canonicalEngineInputsWritten=false`
- `explicitProfessionalAdoptionRequired=true`

Any quantitative effect must be supported and adopted in the relevant professional valuation method/adjustment workflow; it is not created by the ESG module.

## Safety boundaries

- no automatic ESG premium or discount;
- no automatic cap/discount/exit-rate modification;
- no automatic comparable adjustment;
- no valuation conclusion;
- no certified valuation or licensed-provider status;
- no legal opinion;
- no transaction authority.

## Qualification marker

`WAVE_10B_ESG_EVIDENCE=PASS`

## Wave 10 completion target

On qualification, Wave 10 establishes:

`Planning Evidence → Valuation-Date Validity → HBU Sequential Gates → Maximally Productive Professional Decision → ESG Evidence → ESG Materiality → Market Linkage → Professional Valuation Consideration`.

The next engineering wave is Wave 11: Cost Approach, land valuation and development-property/residual-land-value architecture with explicit depreciation, cost-source provenance, development timing, finance/fees and developer-return assumptions.
