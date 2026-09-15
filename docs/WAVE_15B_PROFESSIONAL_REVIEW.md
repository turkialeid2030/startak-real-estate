# Wave 15B — Governed Professional / Independent Review

## Purpose

Wave 15B adds a fail-closed review workflow on top of a Wave 15A report contract that is already `READY_FOR_INTERNAL_QA`. The workflow records review findings, their resolution and explicit reviewer conclusions without modifying the underlying report or authorizing external issuance.

## Review levels

- `INTERNAL_QA`
- `PROFESSIONAL_REVIEW`
- `INDEPENDENT_REVIEW`

Independent review requires an explicit independence attestation, independence evidence and a reviewer who is not the report preparer. These controls are engineering evidence only; credential or licensing validity is not established in Wave 15B.

## Findings

Findings are immutable, SHA-256-bound records with explicit topic, severity, description, evidence, reviewer and timestamp. Supported severities are `CRITICAL`, `MAJOR`, `MINOR` and `OBSERVATION`.

All open findings fail closed. `APPROVE_NEXT_CONTROLLED_GATE` is prohibited until every finding has been resolved and explicitly accepted by the assigned reviewer. Resolution records preserve the responder, evidence, reviewer acceptance and chronology.

## Review conclusion

A reviewer can explicitly select:

- `HOLD`
- `APPROVE_NEXT_CONTROLLED_GATE`

An approval means only that the review package can progress to the next controlled reporting/standards QA gate. It does not authorize report issuance.

## Integrity controls

- exact Wave 15A report hash binding;
- tampered report or review session fails closed;
- report must already be `READY_FOR_INTERNAL_QA`;
- finding hashes are verified before review creation;
- duplicate finding IDs are blocked;
- a finding must be raised by the assigned reviewer;
- resolution acceptance must come from the assigned reviewer;
- resolution cannot pre-date the finding;
- conclusion cannot pre-date review start;
- concluded sessions cannot be silently reopened or mutated.

## Governance boundary

Wave 15B preserves:

- `credentialValidationPerformed=false`
- `externalIssuanceAuthorized=false`
- `certifiedValuationAuthorized=false`
- `legalOpinionEstablished=false`
- `transactionAuthorized=false`
- `reportMutationPerformed=false`
- `aiReviewApprovalPermitted=false`

The workflow does not alter valuation arithmetic, method results, standards applicability, report content or professional credentials. It cannot simulate an independent valuer or licensed reviewer.

## Qualification

Required on the exact Wave 15B head:

- `Professional Review Verify`
- marker `WAVE_15B_PROFESSIONAL_REVIEW=PASS`
- canonical `Release Verify`

The next controlled sub-wave is Wave 15C: standards/report conformance QA and section-level requirement traceability, while named standards remain non-enforcing until official-source lifecycle activation. Do not merge or deploy without explicit authorization.
