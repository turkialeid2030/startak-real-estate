# C18 — Governed Subdivision and Merge Review Intelligence

## Purpose

C18 implements roadmap #464 item 12 as a deterministic, evidence-bound preparation layer for professional subdivision, merge and boundary-adjustment review. It does not determine legal or technical feasibility and does not execute cadastral or municipal actions.

Capability identifier:

`C18_GOVERNED_SUBDIVISION_MERGE_REVIEW_INTELLIGENCE_V1`

Policy version:

`C18_SUBDIVISION_MERGE_REVIEW_POLICY_V1`

## Governed operation types

- `SUBDIVISION_REVIEW`
- `MERGE_REVIEW`
- `BOUNDARY_ADJUSTMENT_REVIEW`

These values describe the externally authored review request. They are not software conclusions.

## Governed evidence classes

- `TITLE_AND_PARCEL_IDENTITY`
- `SURVEY_AND_AREA`
- `URBAN_CODE_AND_PLOT_FEASIBILITY`
- `ACCESS_AND_SERVICES`
- `MUNICIPAL_OR_CADASTRAL_REQUIREMENTS`
- `EXTERNAL_PROFESSIONAL_INSTRUCTION`

Evidence states are explicit: `SATISFIED`, `UNRESOLVED`, and `NOT_REQUIRED`. Required evidence must be `SATISFIED`; `NOT_REQUIRED` never silently satisfies a policy hard gate.

Every evidence record binds case, property, parcel, upstream capability and record, upstream SHA-256, source status/reference, reviewer evidence, timestamps, validity and its own SHA-256. Survey evidence additionally carries an explicit positive surveyed area supplied by governed evidence.

## Parcel-set contract

Every proposal carries a deterministic, order-neutral parcel set. Each parcel binding contains:

- `parcelRef`
- exact title/identity evidence SHA-256
- exact survey evidence SHA-256
- explicit surveyed area in square metres

C18 verifies that title and survey hashes resolve to the same parcel and that the parcel-bound area exactly matches the governed survey evidence. It never infers geometry, boundaries, adjacency or ownership.

## Area reconciliation

C18 may perform arithmetic only when the external proposal explicitly supplies both:

- `proposedTotalAreaSqm`
- `areaToleranceSqm`

It then compares the sum of explicitly governed input surveyed areas with the externally supplied proposed total area. The tolerance is external; C18 does not invent a tolerance.

If the absolute delta exceeds the supplied tolerance, C18 returns `HOLD_AREA_RECONCILIATION`. A non-zero delta inside the supplied tolerance is surfaced as a risk flag, not as a feasibility or compliance conclusion.

## Policy contract

The policy exact-binds:

- allowed operation types;
- allowed evidence classes;
- required evidence classes for every allowed operation;
- exact evidence hashes;
- exact proposal hashes;
- reviewer and review evidence;
- review and validity timestamps;
- policy SHA-256.

`TITLE_AND_PARCEL_IDENTITY` and `SURVEY_AND_AREA` are mandatory hard-gate classes for every governed operation policy. Required classes must also be present in the policy's allowed evidence classes.

## Fail-closed behavior

C18 blocks readiness for professional review when it detects missing, unresolved, stale, future-dated, tampered or duplicate evidence; case/property/parcel mismatches; missing title or survey bindings; proposal evidence absent from the governed packet; policy binding mismatches; disallowed operations/classes; survey-area binding mismatches; arithmetic reconciliation outside external tolerance; or authority/conclusion injection.

When blocked, the review payload is `null`.

## Explicit non-goals

C18 does not:

- determine subdivision, merge or boundary-adjustment feasibility;
- infer cadastral geometry, parcel boundaries or adjacency;
- determine ownership or title validity;
- determine zoning, entitlement or buildability;
- conclude municipal or registry approval;
- mutate cadastral records;
- submit municipal or registry filings;
- calculate land value, residual value, DCF, NPV or IRR;
- approve acquisition, disposal, financing or development;
- create transaction, approval, production, Public AI or commercial authority.

## Deterministic output

A fully valid packet returns:

`READY_FOR_PROFESSIONAL_SUBDIVISION_MERGE_REVIEW`

Proposal rows are sorted only by stable proposal ID for deterministic serialization. The output contains arithmetic facts only: input parcel count, proposed output parcel count, explicit input surveyed area, externally proposed total area, external tolerance and absolute area delta. `recommendation` remains `null`.

## Authority boundary

C18 permanently emits:

- `transactionAuthorized = false`
- `approvalAuthorized = false`
- `productionAuthorized = false`
- `publicAiAuthorized = false`
- `commercialGoLive = HOLD`
- `canonicalBaselineActivationAuthorized = false`
- `feasibilityDeterminedBySoftware = false`
- `ownershipDeterminedBySoftware = false`
- `geometryInferredBySoftware = false`
- `adjacencyInferredBySoftware = false`
- `zoningDeterminedBySoftware = false`
- `entitlementDeterminedBySoftware = false`
- `buildabilityDeterminedBySoftware = false`
- `legalConclusionBySoftware = false`
- `cadastralMutationAuthorized = false`
- `registryFilingAuthorized = false`
- `municipalFilingAuthorized = false`
- `valuationCalculated = false`
- `residualLandValueCalculated = false`
- `npvCalculated = false`
- `irrCalculated = false`

Repository governance remains `MERGE HOLD = ON` and `DEPLOY = NO`.

## Qualification

Qualification requires exact-head assertion, dedicated C18 adversarial regression, inherited C17 regression, canonical `npm run release:verify`, and the production build/package/audit/baseline checks contained in the canonical release verification. Technical qualification never authorizes merge, deployment, commercial operation or a real-estate transaction.
