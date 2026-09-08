# Wave 15A — Professional Report Contract & Internal QA Gate

## Purpose

Wave 15A begins the reporting/review wave from the qualified Wave 14 / standards convergence head. It creates a governed professional-report contract and report-completeness gate. It does not produce a certified valuation report and it does not authorize external issuance.

## Contract scope

The report contract binds, without recalculating valuation arithmetic:

- engagement, case and property identity;
- assignment state and engagement scope;
- purpose, intended use, basis of value, valuation date and valued property interest;
- immutable StandardsSnapshot identity/hash;
- evidence and calculation artifact references with SHA-256 provenance;
- required evidence roles selected explicitly for the engagement/report;
- methods considered and an explicit `USED` / `NOT_USED` disposition with rationale;
- explicit result-artifact reference for every used method;
- assumptions, special assumptions and limitations;
- material-uncertainty disclosure state and rationale;
- preparer and reviewer identity/role references;
- report date and immutable report hash.

## Fail-closed internal QA

Critical completeness gaps produce `REPORT_BLOCKED`. Examples include a missing required evidence role, no methods considered, no used method, missing uncertainty disclosure, missing preparer/reviewer, or a missing financial-reporting disclosure packet for the financial-reporting handoff type.

Structural integrity failures are rejected rather than converted into warnings: cross-case/property references, duplicate artifact IDs, tampered artifact-reference hashes, tampered StandardsSnapshots, valuation-date snapshot mismatch, used methods without a result reference, unknown result references, duplicate method assessments and report-date chronology errors.

A complete contract can reach only `READY_FOR_INTERNAL_QA` in Wave 15A.

## Standards / Taqeem boundary

Wave 15A does not treat the 2026 master directive as proof of a particular Taqeem, IVS or RICS edition/status. The explicit report-QA marker remains:

`UNDER_REVIEW_OFFICIAL_SOURCE_VERIFICATION_REQUIRED`

Accordingly:

- `taqeemConformanceClaimEstablished=false`
- `ivsConformanceClaimEstablished=false`
- `ricsConformanceClaimEstablished=false`

Actual standards compliance and report-template conformance require official-source verification and the governed standards lifecycle before any production rule can be activated.

## Professional-authority boundary

The existing assignment state `AUTHORIZED_FOR_ANALYSIS` authorizes analytical progression only. It is not a licensed/certified valuation authorization. Wave 15A therefore preserves:

- `operatingMode=UNLICENSED_DECISION_SUPPORT`
- `professionalValuationAuthorized=false`
- `certifiedValuationAuthorized=false`
- `externalIssuanceAuthorized=false`
- `professionalReviewerApprovalEstablished=false`
- `credentialValidationPerformed=false`
- `legalOpinionEstablished=false`
- `transactionAuthorized=false`

The system records credential references as evidence only; it does not validate, simulate or sign as a licensed valuer.

## Calculation boundary

No valuation arithmetic is performed by the reporting contract. It references qualified upstream method results by immutable IDs/hashes. It does not select a valuation method automatically, reconcile methods automatically, create a final value conclusion, change an existing indication, or generate a professional conclusion through AI.

## Qualification

Required on the exact Wave 15A head:

- `Professional Report Contract Verify`
- marker `WAVE_15A_PROFESSIONAL_REPORT_CONTRACT=PASS`
- canonical `Release Verify`

Wave 15B should add governed professional/independent review workflow and findings resolution on top of the qualified Wave 15A head. Do not merge or deploy this branch without explicit authorization.
