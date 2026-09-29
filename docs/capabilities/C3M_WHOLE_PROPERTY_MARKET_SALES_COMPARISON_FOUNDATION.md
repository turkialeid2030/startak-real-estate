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

All selected comparables and the subject must use one identical governed unit of comparison. Count-based denominators (`ROOM_KEY`, `RESIDENTIAL_UNIT`) must be positive integers.

## Subject evidence

The subject requires a ready property-evidence packet and an explicit measurement ID matching the selected unit of comparison.

C3M verifies the property-evidence packet hash over its canonical packet core before use. The subject measurement must have:

- the expected measurement type;
- the expected unit (`sqm` or `count`);
- a finite positive value;
- an integer value for count-based denominators;
- a measurement hash reference;
- a non-future measurement timestamp.

The subject property evidence case, property reference, valuation date and asset type must remain consistent with the C3M case and C2 market context.

## C2 market evidence dependency

C3M re-evaluates the supplied C2 market-evidence packet internally.

Only `CLOSED_SALE_TRANSACTION` authoritative evidence is eligible for the method. Each selected comparable measurement must bind to a C2 transaction by `transactionKey`.

For whole-property sales comparison, C3M requires an explicit positive `amountSar` in the C2 normalized transaction value. A price-per-square-metre value alone is insufficient because the denominator basis may not be the same physical measure used by C3M.

Asking/listing evidence cannot enter the method as a closed sale.

### Valuation-date anti-look-ahead rule

C3M fails closed when a selected closed-sale transaction has an `effectiveAt` later than the valuation timestamp. Future transactions cannot be used to value the property retrospectively.

Phase 0 compares exact timestamps rather than silently converting them to calendar dates. A later timestamp on the same calendar day is therefore treated conservatively as post-valuation evidence until a governed day-level convention is explicitly adopted.

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
- measurement `effectiveAt`;
- measurement `validUntil`;
- trusted verifier;
- verification reference;
- verification timestamp.

Measurement evidence must be non-stale as of the C3M evaluation, verified no earlier than its effective timestamp, and non-future.

The governed policy also defines `maxMeasurementTransactionDateGapDays`. If the comparable denominator describes a materially different date than the bound transaction beyond that governed tolerance, C3M fails closed rather than assuming the physical basis was unchanged.

The base unit value is derived only as:

`C2 closed-sale amount / separately verified comparable denominator`

C3M does not reuse C2 generic transaction area as the denominator.

## Professional selection

C3M never auto-selects comparables.

The selected-comparable instruction requires:

- explicit non-empty selected IDs;
- no duplicate selected IDs;
- rationale per selected comparable;
- trusted selector identity;
- selection reference;
- selection timestamp.

The governed policy defines the minimum number of selected comparables.

## Professional adjustment disposition

C3M never estimates adjustment magnitudes automatically and does not accept a caller-written plain-text “no adjustment needed” statement as professional review evidence.

Every selected comparable must have at least one trusted reviewed adjustment-disposition record.

A material adjustment record contains:

- factor;
- direction;
- percent-of-base or amount-per-basis-unit method;
- magnitude;
- rationale;
- evidence references;
- trusted reviewer;
- review reference and timestamp.

When professional review concludes that no material adjustment is required, the disposition is still represented as a trusted reviewed record with:

- `direction = NONE`;
- `magnitude = 0`;
- explicit rationale and evidence references;
- trusted reviewer, review reference and timestamp.

The policy controls hard limits for:

- maximum single adjustment;
- maximum net adjustment;
- maximum gross adjustment.

A threshold breach is fail-closed in Phase 0 rather than silently accepted as an outlier.

## Professional reconciliation and weighting

C3M does not generate comparable weights.

The governed reconciliation requires:

- explicit positive weight per selected comparable;
- rationale per weight;
- trusted reconciler identity;
- reconciliation reference;
- reconciliation timestamp.

Weights must sum to 1. The policy controls maximum weight concentration and maximum adjusted-unit-value dispersion.

Phase-0 safety flags `requireAllSelectedWeighted` and `requireAdjustmentDisposition` are mandatory `true`; a policy cannot weaken either control. The policy is also rejected if its minimum comparable count and maximum single-comparable weight make a total weight of 1 mathematically impossible.

## Canonical calculation

The canonical model version is:

`WHOLE_PROPERTY_SALES_COMPARISON_1.0`

After a governed input packet passes, the canonical engine performs only deterministic arithmetic:

1. derive each base unit value from the C2 closed-sale amount and separately verified denominator;
2. apply only professionally reviewed adjustment dispositions;
3. reconcile adjusted unit values using explicit professional weights;
4. multiply the reconciled unit value by the governed subject denominator;
5. expose adjusted comparable range and spread diagnostics.

The result declares:

- `approachFamily = MARKET`
- `valueScope = WHOLE_PROPERTY`
- `indicationType = WHOLE_PROPERTY_SALES_COMPARISON_VALUE_INDICATION`

It remains only a method indication.

## Integrity controls

C3M creates a deterministic governed-input packet hash. The canonical engine recalculates the packet hash before performing arithmetic and rejects a mutated/tampered packet.

The packet binds, among other items:

- property-evidence packet hash;
- subject measurement;
- C2 market-evaluation hash;
- property-to-market-context binding;
- selected comparables and selection rationales;
- transaction/measurement evidence hashes;
- adjustment dispositions;
- weights and professional reconciliation metadata.

Duplicate comparable IDs, duplicate transaction keys and duplicate adjustment factors for the same comparable are fail-closed.

## Sandbox boundary

The C3M Sandbox can capture draft comparable denominator data and proposed reconciliation weights, but it cannot create:

- measurement verification;
- C2 transaction qualification;
- comparable selection authority;
- adjustment review authority;
- reconciliation authority;
- certification;
- transaction approval.

It also rejects `LAND_AREA_SQM` as a whole-property denominator.

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

C3 must be updated and independently requalified before it may recognize `WHOLE_PROPERTY_SALES_COMPARISON_1.0` as a MARKET / WHOLE_PROPERTY input.

C3M qualification alone does not modify the already-qualified C3 model registry, does not create three-approach reconciliation authority, and does not authorize a merge or production deployment.
