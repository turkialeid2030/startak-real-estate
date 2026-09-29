# C3M — Whole-Property Market Sales Comparison Foundation

Status: **Phase-0 engineering foundation only**

Roadmap: #464  
Tracking issue: #472

## Why C3M exists

C3 Phase 0 identified a material scope gap in the canonical valuation engine set:

- `LAND_SALES_COMPARISON_1.0` is a **LAND_ONLY** market indication;
- Direct Capitalization, DCF and Cost Approach are **WHOLE_PROPERTY** indications.

A land-only market indication must not be blended with whole-property income/cost indications merely to create a nominal three-approach reconciliation. C3M therefore builds the missing MARKET / WHOLE_PROPERTY method foundation.

## Core rule: denominator cannot be inferred

C2 closed-sale evidence can establish the transaction amount and governed transaction identity, but a generic transaction `areaSqm` is not sufficient to determine whether the denominator is:

- land area;
- gross building area;
- gross leasable area;
- net leasable area;
- saleable area;
- another physical measure.

C3M therefore never infers a whole-property unit-of-comparison denominator from generic C2 `areaSqm`.

Each comparable requires separately verified property measurement evidence, while the subject uses a measurement from a ready property-evidence packet.

## Phase-0 supported units of comparison

The allowed vocabulary is intentionally explicit and finite:

- `GROSS_BUILDING_AREA_SQM`
- `GROSS_LEASABLE_AREA_SQM`
- `NET_LEASABLE_AREA_SQM`
- `SALEABLE_AREA_SQM`
- `ROOM_KEY`
- `RESIDENTIAL_UNIT`

`LAND_AREA_SQM` is deliberately excluded. Land-area comparison remains the responsibility of the existing land-only method.

All selected comparables and the subject must use one identical governed unit of comparison.

## Subject evidence

The subject requires a ready property-evidence packet and an explicit measurement ID matching the selected unit of comparison.

C3M verifies the property-evidence packet hash over its canonical packet core before use. The subject measurement must have:

- the expected measurement type;
- the expected unit (`sqm` or `count`);
- a finite positive value;
- a measurement hash reference.

The subject property evidence case, property reference, valuation date and asset type must remain consistent with the C3M case and C2 market context.

## C2 market evidence dependency

C3M re-evaluates the supplied C2 market-evidence packet internally.

Only `CLOSED_SALE_TRANSACTION` authoritative evidence is eligible for the method. Each selected comparable measurement must bind to a C2 transaction by `transactionKey`.

For whole-property sales comparison, C3M requires an explicit positive `amountSar` in the C2 normalized transaction value. A price-per-square-metre value alone is insufficient because the denominator basis may not be the same physical measure used by C3M.

Asking/listing evidence cannot enter the method as a closed sale.

## Property-to-market-context binding

C3M requires a trusted binding between the subject property and the C2 market context. The binding records:

- binding ID;
- property reference;
- market-context ID;
- geography key;
- asset type;
- trusted binder identity;
- reference;
- timestamp.

The binding must match the actual C2 input and must be established at/after the valuation date and no later than `asOf`.

## Comparable measurement evidence

Each comparable requires:

- comparable ID;
- C2 transaction key;
- source-property reference;
- asset type;
- unit of comparison;
- denominator quantity;
- measurement source reference;
- trusted verifier;
- verification reference;
- verification timestamp.

The base unit value is derived only as:

`C2 closed-sale amount / separately verified comparable denominator`

C3M does not reuse C2 generic transaction area as the denominator.

## Professional selection

C3M never auto-selects comparables.

The selected-comparable instruction requires:

- explicit selected IDs;
- rationale per selected comparable;
- trusted selector identity;
- selection reference;
- selection timestamp.

The governed policy defines the minimum number of selected comparables.

## Professional adjustments

C3M never estimates adjustment magnitudes automatically.

Adjustment records support:

- factor;
- direction;
- percent-of-base or amount-per-basis-unit method;
- magnitude;
- rationale;
- evidence references;
- trusted reviewer;
- review reference and timestamp.

If no adjustment is required for a selected comparable, the governed policy may require an explicit no-adjustment rationale.

The policy controls hard limits for:

- maximum single adjustment;
- maximum net adjustment;
- maximum gross adjustment.

A threshold breach is fail-closed in Phase 0 rather than silently accepted as an outlier.

## Professional reconciliation and weighting

C3M does not generate comparable weights.

The governed reconciliation requires:

- explicit weight per selected comparable;
- rationale per weight;
- trusted reconciler identity;
- reconciliation reference;
- reconciliation timestamp.

The policy controls maximum weight concentration and maximum adjusted-unit-value dispersion.

## Canonical calculation

The canonical model version is:

`WHOLE_PROPERTY_SALES_COMPARISON_1.0`

After a governed input packet passes, the canonical engine performs only deterministic arithmetic:

1. adjusted unit value for each professionally selected comparable;
2. weighted reconciled unit value;
3. subject basis quantity × reconciled unit value;
4. adjusted comparable range and spread diagnostics.

The result declares:

- `approachFamily = MARKET`
- `valueScope = WHOLE_PROPERTY`
- `indicationType = WHOLE_PROPERTY_SALES_COMPARISON_VALUE_INDICATION`

It remains only a method indication.

## Sandbox boundary

The C3M Sandbox can capture draft comparable denominator data and proposed reconciliation weights, but it cannot create:

- measurement verification;
- C2 transaction qualification;
- comparable selection authority;
- adjustment review authority;
- reconciliation authority;
- certification;
- transaction approval.

## Trust boundary

Phase 0 uses allow-listed selector, measurement-verifier, adjustment-reviewer, market-context-binder and reconciler identifiers plus references as governance contracts. These are not cryptographic signatures.

Production integration requires authenticated identity/authorization and tamper-evident provenance appropriate to the runtime architecture.

## Explicit non-authority

C3M Phase 0 does not create or imply:

- automatic comparable selection;
- automatic denominator inference;
- automatic adjustment estimation;
- automatic comparable weighting;
- licensed/certified valuation authority;
- Taqeem-accredited valuation opinion;
- final valuation conclusion;
- lender approval;
- transaction authority;
- Public AI activation;
- canonical-baseline activation;
- Commercial Go-Live.

Current governance remains:

- `COMMERCIAL_GO_LIVE = HOLD`
- `TRANSACTION_AUTHORITY = FALSE`
- `PUBLIC_AI = FALSE`
- `CANONICAL_BASELINE_ACTIVATION_AUTHORIZED = FALSE`

## Required next integration step after C3M qualification

C3 must be updated and independently requalified before it may recognize `WHOLE_PROPERTY_SALES_COMPARISON_1.0` as a MARKET / WHOLE_PROPERTY input. C3M qualification alone does not modify the already-qualified C3 model registry.
