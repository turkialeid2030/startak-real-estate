# Wave 7C — Professional Assignment Workflow

## Scope

Adds the governed professional-assignment entry layer before standards routing. This wave is stacked on qualified Wave 7B and remains non-production.

## Assignment contract

Every professional valuation assignment records the directive fields:

- client
- intended user
- intended use
- purpose
- asset
- rights
- basis
- valuation date
- report date
- scope
- assumptions
- special assumptions
- information reliance
- limitations
- conflicts
- independence
- competence
- reviewer

Optional router context may also be carried for reporting framework, regulated-entity status, transaction context, and financing context.

## Basis of Value gate

Formal valuation scope cannot pass without:

- basis of value
- valuation date
- property interest/right
- purpose

Missing any of those produces:

`VALUATION_SCOPE_INCOMPLETE`

Passing this minimum scope gate does **not** create certified valuation authority, licensed-provider status, legal approval, or transaction authority.

## Conflict / independence states

The workflow supports exactly:

- `CLEAR`
- `DISCLOSURE_REQUIRED`
- `REVIEW_REQUIRED`
- `CANNOT_PROCEED`

`CANNOT_PROCEED` blocks the workflow before standards routing. Disclosure/review states require human review.

## Competence gate

Competence is recorded against location, complexity and specialization need. Supported workflow states are:

- `CLEAR`
- `REVIEW_REQUIRED`
- `SPECIALIST_REVIEW_REQUIRED`
- `CANNOT_PROCEED`

If `specialization_required = true` and no specialist reviewer is identified, the effective result is:

`SPECIALIST_REVIEW_REQUIRED`

and standards routing is blocked until the review presence gate is resolved.

## Property-rights minimum model

Wave 7C introduces the minimum governed rights vocabulary required for the Basis-of-Value gate:

- ownership
- usufruct
- lease
- mortgage
- easement
- restriction
- encumbrance
- registered right

Each right carries a source classification:

- `REGISTERED`
- `VERIFIED`
- `EXTRACTED`
- `CLIENT_PROVIDED`
- `ASSUMED`

An `ASSUMED` right does not pass silently. It moves the assignment to `REVIEW_REQUIRED` before standards routing.

## Semantic validation

The workflow validates, among other items:

- required assignment fields;
- governed conflict/independence enums;
- governed right type/source enums;
- asset type/jurisdiction/location presence;
- valuation and report dates;
- report date not preceding valuation date;
- explicit assumptions/special assumptions/reliance/limitations arrays.

## Standards-router integration

Only `READY_FOR_STANDARDS_ROUTING` assignments are passed into the qualified Wave 7B router.

Router context is derived from the assignment itself:

- jurisdiction ← asset jurisdiction
- valuation purpose ← assignment purpose
- intended use/user ← assignment scope parties
- asset type ← assignment asset type
- as-of date ← valuation date

No replacement defaults are introduced.

If no matching active standards route exists, the assignment becomes:

`STANDARDS_ROUTE_UNAVAILABLE`

rather than falling back to a different ruleset.

## Tests

`tests/architecture/run_professional_assignment_v1.js` verifies with synthetic-only data:

- the full assignment field contract;
- Basis-of-Value missing-field gates;
- `VALUATION_SCOPE_INCOMPLETE` fail-closed behavior;
- conflict/independence states;
- assumed-right review behavior;
- specialist review requirement;
- semantic report/valuation date ordering;
- rights type/source validation;
- assignment→router context derivation;
- matching active standards route;
- no-match ruleset behavior;
- human-review stop before router execution;
- no certified valuation or transaction authority.

Expected marker:

`WAVE_7C_PROFESSIONAL_ASSIGNMENT=PASS`

## Explicit non-goals

- no live standards activation;
- no certified appraisal output;
- no legal opinion;
- no transaction authorization;
- no merge to `main`;
- no production deployment;
- no financial formula change.

## Next controlled sub-wave

Wave 7D — standards/assignment provenance and saved-deal standards snapshot persistence, including historical reconstruction and release-gate traceability.
