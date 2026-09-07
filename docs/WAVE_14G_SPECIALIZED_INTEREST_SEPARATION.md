# Wave 14G — Specialized Interest / Property-Business Separation

## Scope

Wave 14G adds an explicit professional separation layer for specialized assets so that real property, FF&E, the operating business, brand/franchise intangibles and operator/management contracts are not silently blended into one value premise.

This layer is classificatory and evidentiary only. It performs no monetary allocation and no valuation arithmetic.

## Value components

- `REAL_PROPERTY`
- `FF_E`
- `OPERATING_BUSINESS`
- `INTANGIBLE_BRAND_OR_FRANCHISE`
- `MANAGEMENT_OR_OPERATOR_CONTRACT`
- `OTHER_NON_REAL_PROPERTY`

Each component receives an explicit treatment:

- `INCLUDED_IN_PREMISE`
- `EXCLUDED_FROM_PREMISE`
- `SEPARATE_REVIEW_REQUIRED`

Every treatment is evidence-backed, professionally prepared/reviewed and SHA-256 integrity protected.

## Valuation-premise states

### REAL_PROPERTY_ONLY

Real property must be explicitly included. No non-real-property component may be silently included.

### REAL_PROPERTY_PLUS_FF_E

Real property and FF&E must be explicitly included. Operating-business, intangible/brand, operator-contract and other non-real-property components cannot be included without separate professional review.

### ENTERPRISE_CONTEXT_REQUIRES_SEPARATE_ALLOCATION_REVIEW

This premise records that non-real-property components require a separate allocation/review workflow. Wave 14G does not calculate that allocation.

## Required component completeness

Real property is required for every specialized asset.

Hospitality and leisure assets additionally require explicit classification of FF&E and operating-business components. Managed, franchised or leased-operator assets require operator/management-contract classification. Franchise assets additionally require brand/franchise-intangible classification.

Heritage assets do not inherit fabricated business components by default; a heritage real-property-only premise may therefore require only the real-property component unless the engagement facts indicate otherwise.

## Fail-closed controls

The packet fails closed on:

- tampered or non-ready specialized-asset evidence packet
- tampered component treatment
- cross-case or cross-property records
- duplicate treatment IDs
- duplicate component classifications
- required component missing
- required component supported only by assumed/unverified evidence
- component review after packet review
- a premise/component treatment conflict
- invalid optional operating-forecast provenance

## Governance boundary

Wave 14G does **not**:

- perform monetary purchase-price or value allocation
- calculate business enterprise value
- calculate intangible or brand value
- interpret management/franchise/operator contracts legally
- write valuation inputs
- perform valuation arithmetic
- establish a final or certified valuation conclusion
- authorize a transaction

The output is a governed handoff for later specialized valuation-method, reconciliation and reporting review.

## Qualification marker

`WAVE_14G_SPECIALIZED_INTEREST_SEPARATION=PASS`

Engineering candidate only. Do not merge or deploy to production without explicit authorization.
