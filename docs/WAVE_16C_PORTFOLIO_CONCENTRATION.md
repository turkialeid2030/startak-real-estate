# Wave 16C — Portfolio Aggregation & Concentration Governance

## Objective
Provide an auditable portfolio evidence layer above asset-level valuation/investment analytics without collapsing professional valuation, portfolio analytics, investment-committee judgment, and transaction authority into one state.

## Implemented
- explicit portfolio membership records with SHA-256 integrity
- case/property/asset identity, source artifact id/hash/classification and source as-of date
- exposure amount/currency/basis and explicit allocation weight
- membership rationale, evidence, preparer/reviewer provenance and chronology
- snapshot-level freshness, temporal validity, currency isolation and duplicate-asset controls
- explicit weight reconciliation to 100%
- `CURRENT_EXPOSURE` mode reconciles explicit weights to exposure-derived weights
- `TARGET_ALLOCATION` mode permits target weights to differ from current exposure weights
- concentration metrics: HHI, Top-1/Top-3/Top-5, asset-class, geography and sector concentration

## Deliberately not implemented
Wave 16C does not create a joint asset-return distribution, cross-asset correlation model, portfolio VaR, diversification benefit, concentration-limit compliance conclusion, automatic IC decision, professional valuation conclusion or transaction instruction.

Asset-level Wave 16A/16B risk evidence may be referenced by members, but is not probabilistically aggregated. A future correlated portfolio-risk model requires a separate specification, evidence basis and qualification.

## Maximum state
`READY_FOR_IC_EVIDENCE_ASSEMBLY`

This state means the portfolio membership and concentration packet is technically coherent for the next controlled IC-evidence workflow only.

## Operating boundary
`UNLICENSED_DECISION_SUPPORT`

- `portfolioProbabilisticAggregationPerformed=false`
- `crossAssetCorrelationModel=NOT_MODELED`
- `jointDistributionEstablished=false`
- `portfolioVaRCalculated=false`
- `diversificationBenefitCalculated=false`
- `concentrationLimitComplianceDerived=false`
- `decisionStateDerived=false`
- `automaticInvestmentDecisionAuthorized=false`
- `humanCommitteeDecisionRequired=true`
- `professionalValuationConclusionModified=false`
- `externalIssuanceAuthorized=false`
- `transactionAuthorized=false`

## Qualification
Exact-head qualification requires:
1. Wave 16A Monte Carlo governance regression.
2. Wave 16B tail-risk threshold regression.
3. Wave 16C portfolio concentration regression.
4. Canonical `npm run release:verify`.

No merge or production deployment is authorized by engineering qualification.
