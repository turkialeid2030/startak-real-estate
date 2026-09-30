# C11 — Governed Income Asset Intelligence

## Purpose

C11 implements the asset-level intelligence portion of roadmap #464 item 5 on top of exact qualified C10 head `4c60bdd6759070e14c04ea0bebda558b0bb2eeec`.

The repository already has governed lease/rent-roll reconciliation, professional income forecast inputs, canonical NOI arithmetic and direct-capitalization indication. C11 does not duplicate those engines. It adds deterministic contractual occupancy, tenant concentration, lease-expiry concentration and professionally supplied tenant-strength linkage.

## Required upstream evidence

C11 accepts only an integrity-valid `incomeEvidencePacket` produced by `reconcileLeaseIncomeEvidence` with:

- `status = READY_FOR_INCOME_ANALYSIS_HANDOFF`;
- `readyForIncomeAnalysisHandoff = true`;
- valid `incomeEvidencePacketHashSha256`.

The exact verified rent-roll snapshot must also:

- pass SHA-256 integrity verification;
- match the packet's case, property and as-of date;
- match the packet's exact `rentRollHashSha256`.

C11 therefore cannot progress from raw rent-roll claims, unverified leases or an independently substituted snapshot.

## Contractual metrics

C11 calculates only deterministic metrics supported by the governed upstream contracts:

- total lettable area;
- occupied area;
- vacant area;
- contractual occupancy ratio;
- annual contracted rent;
- annual contracted rent per occupied square metre;
- active lease count;
- active tenant count;
- tenant contractual-rent share;
- tenant occupied-area share;
- top-tenant contractual-rent share;
- top-three-tenant contractual-rent share;
- contractual-rent HHI (`sum(rentShare^2)`);
- contractual rent expiring inside explicitly governed calendar-month horizons.

HHI is emitted only as a mathematical concentration measure. C11 does not attach an undisclosed risk interpretation to it.

## Tenant financial-strength linkage

Roadmap #464 references earlier tenant-strength / tenant-mix engines, but those named paths are not present on the exact C10 dependency head. C11 therefore does not pretend those engines exist.

Instead, `createGovernedTenantStrengthAssessment` captures a professional external assessment contract with:

- assessment ID;
- exact case/property/tenant identity;
- caller-supplied professional strength band;
- methodology reference;
- one or more evidence references;
- assessor reference;
- assessed-at and valid-until timestamps;
- review evidence reference;
- SHA-256 integrity hash.

C11 performs no automatic credit scoring and infers no financial thresholds. Every active tenant must have exactly one current, integrity-valid assessment for professional income-asset review readiness.

## Governed review policy

No default Saudi or market risk thresholds are embedded.

The selected `C11_INCOME_ASSET_REVIEW_POLICY_V1` policy must explicitly provide:

- policy ID;
- exact case/property/as-of context;
- exact income-evidence packet hash;
- exact rent-roll hash;
- exact sorted tenant-assessment hash bindings;
- minimum contractual occupancy ratio;
- maximum top-tenant rent share;
- maximum top-three-tenant rent share;
- one or more explicit lease-expiry horizons and maximum rent shares;
- reviewer and review evidence;
- policy SHA-256 integrity hash.

Risk flags are generated only by comparing deterministic contractual metrics with these explicit policy values.

## Boundary semantics

Policy ratio boundaries are inclusive:

- occupancy breaches only when `actual < minimum`;
- concentration breaches only when `actual > maximum`.

Lease-expiry horizons use a deterministic UTC calendar-month addition with end-of-month clamping. A lease is included when:

`expiryDate <= horizonEnd`

No rolling-day approximation is silently substituted for a calendar-month horizon.

## Fail-closed states

- `HOLD_UPSTREAM_EVIDENCE`
- `HOLD_INTEGRITY`
- `HOLD_POLICY`
- `HOLD_TENANT_EVIDENCE`
- `HOLD_METRICS`

The only progression state is:

- `READY_FOR_PROFESSIONAL_INCOME_ASSET_REVIEW`

A policy risk breach is not misrepresented as an evidence-integrity failure. The result can remain review-ready while emitting explicit `riskFlags` for human review.

## Explicit non-goals

C11 does not:

- interpret lease law or contractual ambiguity;
- exercise break/renewal options;
- infer market rent;
- create vacancy assumptions;
- generate NOI forecasts;
- derive cap rates or discount rates;
- perform capitalization or DCF arithmetic;
- create hidden tenant scores;
- establish a final/certified valuation;
- auto-adopt underwriting inputs;
- recommend acquisition/sale/financing;
- authorize approvals or transactions;
- activate production or canonical baselines.

## Authority boundary

Every result keeps:

- `tenantStrengthAutomaticallyScored=false`
- `marketRentApplied=false`
- `leaseOptionsAutomaticallyExercised=false`
- `noiForecastGenerated=false`
- `capitalizationPerformed=false`
- `dcfPerformed=false`
- `capRateDerived=false`
- `discountRateDerived=false`
- `certifiedValuationEstablished=false`
- `automaticUnderwritingAdoption=false`
- `automaticAcquisitionRecommendation=false`
- `transactionAuthorized=false`
- `approvalAuthorized=false`
- `decisionBinding=false`
- `productionAuthorityGranted=false`
- `publicAiAuthorized=false`
- `commercialGoLiveAuthorized=false`
- `canonicalBaselineActivationAuthorized=false`

Project posture remains **DRAFT / MERGE HOLD / NO DEPLOY**.

## Qualification gate

The exact C11 candidate head must pass:

1. `node tests/defects/c11_governed_income_asset_intelligence.js`
2. canonical `npm run release:verify`

No merge/deploy/activation is authorized by technical qualification.