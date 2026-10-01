# C13 — Governed Encumbrance / Mortgage / Closing Intelligence

## Purpose

C13 implements roadmap #464 backlog item 7 above exact qualified C12 head `60eeedd23c580de797de40b1dd61d2236c388966`.

It organizes explicit professional/legal closing evidence and aggregates only explicit known settlement/payoff amounts. It does not infer title validity, lien priority, release effectiveness, legal enforceability, ownership transfer, lender payoff, or transaction authority.

## Evidence classes

- `MORTGAGE_OR_SECURITY_INTEREST`
- `LIEN_OR_ENCUMBRANCE`
- `EASEMENT_OR_RESTRICTION`
- `PAYOFF_OR_RELEASE_REQUIREMENT`
- `CLOSING_CONDITION`

These are evidence classifications only.

## Professional statuses

C13 accepts only caller/professional supplied statuses:

- `OPEN`
- `SETTLEMENT_OR_RELEASE_DOCUMENTED`
- `VERIFIED_CLEARED`
- `NOT_APPLICABLE_BY_PROFESSIONAL_REVIEW`

The engine never promotes a status automatically.

## Evidence integrity

Each record is bound to:

- record ID;
- case and property;
- evidence class and professional status;
- source authority/reference/evidence reference;
- source version SHA-256;
- source verification/review window;
- professional reviewer/reference;
- review evidence SHA-256;
- reviewed-at and valid-until dates;
- optional explicit SAR settlement amount;
- optional payoff-valid-until date when an explicit payoff amount is relied upon;
- deterministic record SHA-256.

Evidence must remain valid through the target closing date. Future/stale/tampered/context-mismatched evidence fails closed.

## Economic semantics

C13 may aggregate an explicit `settlementAmountSar` only. It does not derive:

- interest;
- penalties;
- legal fees;
- RETT;
- brokerage;
- financing balances;
- regulatory carry cost;
- transfer/closing charges.

An unknown amount remains unknown. It is never converted to zero for an unresolved record.

## Governed review policy

No default closing/legal rules are embedded. The selected policy explicitly binds:

- case/property/as-of/target closing date;
- exact sorted evidence hashes;
- allowed evidence classes;
- required evidence classes;
- statuses to flag as unresolved;
- whether unknown settlement amounts are permissible for professional-review readiness;
- reviewer/reference/timestamp;
- policy SHA-256.

Risk flags are policy-driven review flags, not legal conclusions.

## Output

When all gates pass, C13 emits:

- `READY_FOR_PROFESSIONAL_CLOSING_REVIEW`;
- deterministic record summaries and lineage;
- exact evidence bindings;
- known explicit settlement total;
- unresolved records with unknown settlement amount;
- caller-policy-driven unresolved-status flags.

When a gate fails, C13 emits a HOLD status and does not expose a settlement total as though the packet were complete.

## Authority boundary

C13 always keeps the following false:

- legal title opinion established;
- lien priority determined;
- mortgage release legally confirmed;
- easement/restriction legally interpreted;
- lender payoff generated;
- transaction authority;
- approval authority;
- production authority;
- Public AI authority;
- Commercial Go-Live;
- canonical baseline activation.

No valuation, NPV, IRR, underwriting, financing approval or acquisition/closing recommendation is created.

## Qualification

Dedicated exact-head qualification must run:

1. exact candidate-head assertion;
2. `node tests/defects/c13_governed_encumbrance_mortgage_closing.js`;
3. canonical `npm run release:verify`.

Technical qualification does not authorize merge or production deployment. The PR remains Draft / Merge Hold / No Production Deploy until separate governed approval.
