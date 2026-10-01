# C15 — Governed Rental Regulation Intelligence

## Purpose
C15 provides a deterministic, fail-closed review layer for proposed rental actions against externally supplied and professionally reviewed rental-regulation evidence.

It is an analytical control, not a legal-advice engine. Software does not infer statutes, determine legal applicability, amend leases, file with Ejar/registries, or authorize transactions.

## Qualified upstream dependency
C15 requires an integrity-valid lease/rent-roll evidence packet produced by the governed lease-income reconciliation flow and ready for income-analysis handoff. The exact lease evidence hash is carried into every rule and every proposed rental action.

## Supported proposed actions
- `ANNUAL_RENT_CHANGE`
- `NOTICE_EVENT`
- `RENEWAL_EVENT`
- `TERMINATION_EVENT`
- `REGISTRATION_OR_DOCUMENTATION_EVENT`

## Governed rental rule classes
- `RENT_ADJUSTMENT`
- `NOTICE_PERIOD`
- `RENEWAL_OR_TERM`
- `REGISTRATION_OR_DOCUMENTATION`
- `OTHER_RENTAL_REGULATION`

## Numeric bases
Numeric constraints are never hard-coded as Saudi statutory rules. When a professional/external review supplies a numeric rule, Phase 0 supports:
- no numeric constraint;
- no rent increase;
- maximum increase rate from the current contractual annual rent;
- maximum annual rent in SAR;
- minimum notice days.

The engine performs arithmetic only against those supplied values. An arithmetic flag is not a legal-compliance conclusion.

## Applicability model
Every regulation-evidence record must carry an external professional applicability status:
- `APPLIES`
- `DOES_NOT_APPLY`
- `UNRESOLVED`

Phase 0 review policy must keep unresolved applicability disabled. Required unresolved rule classes therefore fail closed.

## Evidence and integrity requirements
Each governed rule binds:
- case, property and lease;
- exact lease-evidence SHA-256;
- source authority/reference/evidence reference;
- source version SHA-256;
- source verification and review window;
- rule effective window;
- professional reviewer identity;
- applicability evidence and validity window;
- review evidence reference and SHA-256.

Each proposed action binds:
- case, property and lease;
- exact lease-evidence SHA-256;
- proposed action type and effective date;
- applicable numeric input when required;
- evidence reference, creator and timestamp;
- deterministic proposal SHA-256.

The governed review policy binds the exact upstream income-evidence packet hash, exact rule hashes, exact proposal hashes, allowed action/rule classes and required rule classes by action type.

## Deterministic review semantics
For an annual rent-change proposal, C15 may compare the proposed rent with a professionally supplied explicit numeric bound using the current contractual annual rent from the governed lease packet.

For a notice event, C15 may calculate elapsed 24-hour UTC days and compare the result with a professionally supplied minimum-day value. It does not infer legal calendar-day conventions.

Multiple simultaneously applicable numeric rules for the same required dimension are treated as ambiguity and fail closed rather than selecting a convenient rule.

## Fail-closed statuses
- `HOLD_UPSTREAM_EVIDENCE`
- `HOLD_EVIDENCE`
- `HOLD_INTEGRITY`
- `HOLD_POLICY`
- `HOLD_APPLICABILITY`
- `HOLD_AMBIGUITY`
- `HOLD_CALCULATION`

Only a fully governed case can reach `READY_FOR_PROFESSIONAL_RENTAL_REGULATION_REVIEW`.

## Explicit non-goals / authority boundary
C15 does not establish:
- legal advice or statutory interpretation;
- automatic Saudi-rule applicability;
- legal compliance or enforceability;
- lease amendment or Ejar/registry filing;
- automatic rent-setting recommendation;
- market-rent inference;
- NOI, valuation, DCF, NPV or IRR;
- transaction or approval authority;
- production, Public AI, canonical-baseline activation or Commercial Go-Live authority.

All corresponding authority flags remain false.

## Governance posture
- `COMMERCIAL_GO_LIVE = HOLD`
- `TRANSACTION_AUTHORITY = FALSE`
- `APPROVAL_AUTHORIZED = FALSE`
- `PUBLIC_AI = FALSE`
- `CANONICAL_BASELINE_ACTIVATION_AUTHORIZED = FALSE`
- `MERGE HOLD = ON`
- `DEPLOY = NO`
