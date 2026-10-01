# C17 — Governed Raw Land Strategic Optionality

## Purpose

C17 implements roadmap item 11 from #464 as a deterministic, evidence-bound review layer for raw-land strategic options. It prepares explicit externally authored options for professional review. It does not rank options, recommend build/sell/hold, infer planning facts, calculate land value, or grant transaction authority.

## Capability boundary

Capability identifier:

`C17_GOVERNED_RAW_LAND_STRATEGIC_OPTIONALITY_V1`

Policy version:

`C17_RAW_LAND_STRATEGY_REVIEW_POLICY_V1`

C17 accepts only exact governed evidence references, exact externally authored option records, and an exact review policy. Every record is bound by deterministic SHA-256 integrity.

## Governed option types

- `HOLD_AS_IS`
- `PREPARE_FOR_SALE`
- `SEEK_PLANNING_OR_ZONING_CLARIFICATION`
- `ENABLE_SERVICES_OR_INFRASTRUCTURE_EVIDENCE`
- `PREPARE_SUBDIVISION_OR_MERGE_REVIEW`
- `PREPARE_DEVELOPMENT_CONCEPT_REVIEW`

These are review preparations, not software recommendations.

## Governed evidence classes

- `TITLE_AND_PARCEL_IDENTITY`
- `SURVEY_AND_AREA`
- `URBAN_CODE_AND_PLOT_FEASIBILITY`
- `MARKET_AND_LIQUIDITY`
- `REGULATORY_CARRY_COST`
- `ACCESS_AND_SERVICES`
- `EXTERNAL_STRATEGY_INSTRUCTION`

Each evidence reference exact-binds case, property, evidence class, upstream capability, upstream record ID and SHA-256, upstream status, source reference, reviewer evidence, review timestamp, validity window, evidence state, and its own SHA-256.

## Evidence states

C17 uses only three explicit states:

- `SATISFIED`
- `UNRESOLVED`
- `NOT_REQUIRED`

`UNRESOLVED` requires an explicit unresolved-reason reference. `NOT_REQUIRED` requires an explicit external rationale. A required evidence class is not satisfied by `NOT_REQUIRED`. Unknown access or service status is never converted by software into available or unavailable.

## Strategic option contract

Each option is externally authored and reviewed. It exact-binds:

- case and property;
- option type;
- rationale reference;
- exact governed evidence hashes;
- author and reviewer references;
- review evidence;
- review and validity timestamps;
- its own SHA-256.

C17 does not assign rank or score. Both remain `null`, and `recommendedBySoftware` remains `false`.

## Review policy

The policy exact-binds:

- allowed option types;
- allowed evidence classes;
- required evidence classes for every allowed option type;
- exact evidence-reference hashes;
- exact option hashes;
- reviewer and review evidence;
- review timestamp and validity;
- policy SHA-256.

Every required evidence class must also appear in the policy's allowed evidence classes. This is enforced at policy construction and rechecked during evaluation.

## Fail-closed behavior

C17 blocks professional-review readiness when any of the following is detected:

- missing, stale, future-dated, tampered or duplicate evidence;
- unresolved required evidence;
- a required class marked only `NOT_REQUIRED`;
- case/property mismatch;
- missing evidence referenced by an option;
- option type or evidence class outside policy allowance;
- policy/evidence/option hash-binding mismatch;
- duplicate evidence or option IDs/hashes;
- expired or future review windows;
- authority or conclusion injection attempts.

When blocked, C17 returns no option review payload.

## Explicit non-goals

C17 does not:

- rank strategic options;
- recommend build, sell or hold;
- infer zoning, entitlement, density, buildability, land use or service availability;
- determine subdivision or merge feasibility;
- calculate market value, residual land value, DCF, NPV or IRR;
- issue legal or regulatory conclusions;
- approve acquisition, disposal, financing or development;
- create transaction, approval, production, Public AI or commercial authority.

Roadmap item 12 remains responsible for governed subdivision/merge intelligence.

## Deterministic outputs

A fully valid packet returns:

`READY_FOR_PROFESSIONAL_STRATEGY_REVIEW`

The returned review is sorted only by stable option ID for deterministic serialization. It is not a preference ordering. `recommendedOption` and `rankedOptions` remain `null`.

## Authority boundary

C17 permanently emits:

- `transactionAuthorized = false`
- `approvalAuthorized = false`
- `productionAuthorized = false`
- `publicAiAuthorized = false`
- `commercialGoLive = HOLD`
- `canonicalBaselineActivationAuthorized = false`
- `automaticStrategicRecommendation = false`
- `zoningDeterminedBySoftware = false`
- `serviceAvailabilityDeterminedBySoftware = false`
- `subdivisionMergeFeasibilityDeterminedBySoftware = false`
- `legalConclusionBySoftware = false`
- `valuationCalculated = false`
- `residualLandValueCalculated = false`
- `npvCalculated = false`
- `irrCalculated = false`

Repository governance remains:

- `MERGE HOLD = ON`
- `DEPLOY = NO`
- `COMMERCIAL_GO_LIVE = HOLD`
- `TRANSACTION_AUTHORITY = FALSE`
- `APPROVAL_AUTHORIZED = FALSE`
- `PUBLIC_AI = FALSE`
- `CANONICAL_BASELINE_ACTIVATION_AUTHORIZED = FALSE`

## Qualification

Qualification requires:

1. exact candidate-head assertion;
2. dedicated C17 deterministic/adversarial regression;
3. inherited C16 regression;
4. canonical `npm run release:verify`;
5. production build/package/audit/baseline checks inherited through canonical release verification.

Technical qualification does not authorize merge, deployment, commercial operation or any real-estate transaction.
