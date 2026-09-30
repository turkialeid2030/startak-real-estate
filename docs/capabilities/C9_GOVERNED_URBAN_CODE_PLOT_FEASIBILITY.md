# C9 — Governed Urban Code / Plot Feasibility

## Purpose

C9 implements extended-capability backlog item 3 from roadmap #464 above the exact qualified C8 head `639a96794ee5048e217dd71186a6cca103060b6e`.

C9 is a deterministic professional review aid. It does not establish statutory interpretation, planning compliance, building-permit feasibility, Highest & Best Use, valuation, underwriting adoption, transaction authority, approval authority or production authority.

## Dependencies

C9 fails closed unless both upstream evidence layers are ready and integrity-bound:

1. governed planning evidence with status `READY_FOR_HBU_LEGAL_REVIEW`;
2. C8 title/survey/property evidence with status `READY_FOR_PROFESSIONAL_REVIEW`.

Case and property identity must match across the planning evidence, C8 result, urban-code profile and surveyed geometry.

## Professional urban-code profile

C9 requires an explicit professional profile containing:

- the exact planning-evidence-set hash;
- eligible planning evidence IDs for `FAR`, `BCR` and `SETBACK`;
- adopted FAR;
- adopted BCR expressed as a ratio between 0 and 1;
- adopted front/rear/left/right setbacks;
- exact area and length units;
- optional permitted-use labels, height limit and parking requirement context;
- interpretation evidence reference;
- accountable reviewer reference and review timestamp.

The profile is SHA-256 bound. C9 does not manufacture a Saudi urban-code rule, source hierarchy, BCR percentage conversion, setback, FAR, permitted use, parking rule or height rule.

## Surveyed rectangular plot geometry

The current C9 scope supports one explicit geometry model only:

`SURVEYED_RECTANGLE`

The geometry record requires:

- case/property identity;
- land area;
- surveyed width and depth;
- exact area/length units;
- evidence references;
- accountable verifier and verification timestamp.

The geometry record is SHA-256 bound.

C9 does not approximate irregular polygons as rectangles. Irregular polygon feasibility requires a later governed geospatial/geometry capability.

## Explicit geometry-area tolerance

The caller must provide an explicit absolute and/or relative tolerance for comparison between:

- reported surveyed land area; and
- surveyed rectangular width × depth.

C9 does not invent a tolerance.

The allowed difference is the greater of the explicitly supplied absolute tolerance and the explicitly supplied relative tolerance multiplied by the reported land area.

## Deterministic calculations

When all upstream and integrity gates pass, C9 calculates:

1. `buildableWidth = width - leftSetback - rightSetback`
2. `buildableDepth = depth - frontSetback - rearSetback`
3. `setbackEnvelopeArea = buildableWidth × buildableDepth`
4. `bcrFootprintCap = landArea × BCR`
5. `governingFootprintCap = min(setbackEnvelopeArea, bcrFootprintCap)`
6. `farGrossFloorAreaCap = landArea × FAR`

No automatic floor count, parking compliance, height compliance, use selection or financial-model input is derived.

## Fail-closed states

- `HOLD_UPSTREAM_EVIDENCE`
- `HOLD_POLICY`
- `HOLD_INTEGRITY`
- `HOLD_CONSTRAINT_BINDING`
- `HOLD_UNIT_COMPATIBILITY`
- `HOLD_GEOMETRY`
- `INFEASIBLE_ENVELOPE`

The only progression state is:

- `READY_FOR_PROFESSIONAL_PLOT_REVIEW`

That state means the deterministic C9 calculations are ready for professional review under the supplied governed evidence and adopted profile. It is not a regulatory or permit conclusion.

## No silent unit conversion

Area and length units must match exactly between the urban-code profile and surveyed geometry. C9 does not convert feet/metres, square feet/square metres, percentages/ratios or any other unit representation silently.

## Authority boundary

Every result keeps:

- `statutoryInterpretationEstablished=false`
- `planningComplianceEstablished=false`
- `buildingPermitEstablished=false`
- `legalOpinionEstablished=false`
- `highestBestUseEstablished=false`
- `automaticUseSelection=false`
- `certifiedValuationEstablished=false`
- `automaticUnderwritingAdoption=false`
- `financialEngineInputsWritten=false`
- `transactionAuthorized=false`
- `approvalAuthorized=false`
- `decisionBinding=false`

Project-level boundaries remain:

- `COMMERCIAL_GO_LIVE = HOLD`
- `TRANSACTION_AUTHORITY = FALSE`
- `PUBLIC_AI = FALSE`
- `CANONICAL_BASELINE_ACTIVATION_AUTHORIZED = FALSE`

## Qualification gate

The dedicated C9 workflow must pass on the exact candidate head:

1. `node tests/defects/c9_governed_urban_code_plot_feasibility.js`
2. canonical `npm run release:verify`

The branch and PR remain **Draft / Merge Hold / No Deploy** until a separate explicit authorization.
