# Wave 7B — Purpose-Based Standards Router

## Scope

Adds the central `Purpose-Based Standards Router` on top of the qualified Wave 7A standards foundation. This wave is stacked and non-production; it does not authorize merge to `main` or deployment.

## Router inputs

The router accepts the directive dimensions:

- jurisdiction
- valuation purpose
- intended use
- intended user
- asset type
- reporting framework
- regulated entity status
- transaction context
- financing context
- as-of / valuation-context date

The following are non-defaultable core inputs and fail closed when missing:

- jurisdiction
- valuation purpose
- intended use
- intended user
- asset type
- as-of date

No silent fallback ruleset is selected when those dimensions are incomplete or when no matching active standard exists.

## Selection model

Production selection is data-driven from the governed Standards Registry. The router does not hard-code Taqeem, IVS, IFRS, CMA, SAMA, or other live standards versions.

A standard can enter `selected_standards` only when it is:

1. a valid registry record;
2. `ACTIVE`;
3. effective on the supplied date;
4. not expired;
5. applicable to the supplied jurisdiction, purpose, asset class and any declared contextual applicability dimensions.

Non-active records are not discarded from awareness. They are separated into non-production advisory channels:

- `future_requirements`
- `draft_references`
- `under_review`

Each advisory item is explicitly marked `production_enforced: false`.

## Future standard behavior

A contextual `FUTURE` version can be surfaced alongside the currently active version, including:

- future version
- effective date
- current active version
- expected system impact when supplied by the registry

This does not activate the future version. Activation remains governed exclusively by Wave 7A's effective-date plus eight-gate process.

## Historical standards snapshot

Every route includes the deterministic Wave 7A `standards_snapshot`. `assertRouteProductionReady()` verifies that the selected production ruleset and snapshot contain the same exact standard/version identities.

A mismatch fails closed as:

`STANDARDS_ROUTE_SNAPSHOT_MISMATCH`

## Route integrity

Each resolved ruleset receives a deterministic `route_hash` based on the normalized context plus sorted selected standard/version identities.

This supports later report provenance and the requirement to prove which standards were selected and why.

## Route states

- `READY`
- `READY_WITH_WARNINGS`
- `NO_ACTIVE_STANDARD`

Warnings can include:

- `STANDARD_VERIFICATION_STALE`
- `FUTURE_STANDARD_CHANGE_PENDING`
- `DRAFT_STANDARD_REFERENCE_AVAILABLE`
- `STANDARD_UNDER_REVIEW`

A `NO_ACTIVE_STANDARD` route cannot pass the production-ready assertion.

## Tests

`tests/architecture/run_purpose_standards_router_v1.js` uses synthetic-only standards data to verify:

- required context dimensions fail closed;
- only matching ACTIVE standards are selected;
- wrong-purpose standards are excluded;
- purpose + reporting framework routing is deterministic;
- wrong reporting framework does not silently fall back;
- FUTURE/DRAFT/UNDER_REVIEW entries stay advisory only;
- future advisory shows the current active version;
- route and standards snapshot identities reconcile exactly;
- route and snapshot hashes are order-independent;
- stale verification warnings propagate;
- invalid registry lifecycle state fails closed;
- no transaction or certified-valuation authority is created.

Expected marker:

`WAVE_7B_PURPOSE_STANDARDS_ROUTER=PASS`

## Explicit non-goals

- no live standards data activation;
- no professional assignment conclusion;
- no certified valuation;
- no legal opinion;
- no production merge/deploy;
- no financial formula changes.

## Next controlled sub-wave

Wave 7C — Professional Assignment Workflow:

`Assignment → Purpose → Basis of Value → Valuation Date → Intended Use/User → Property Interest → Conflict → Independence → Competence → Specialist Review → Standards Route`
