# STARTAK Real Estate — E2B External Review & Credential Evidence Envelope

Date: 2026-09-08

## Objective

E2B defines the evidence-intake envelope required after E2 identifies a Saudi legal/professional applicability candidate.

E2B does **not** obtain or invent the external review. It validates only:

- packet linkage to a qualified E2 applicability packet;
- required evidence-class coverage;
- artifact SHA-256 format and deterministic record integrity;
- review/credential chronology;
- evidence-to-triggered-candidate scope;
- reviewer-to-credential-evidence linkage;
- duplicate/malformed evidence rejection.

It does not authenticate external documents or validate the correctness/authority of their issuer.

## States

### `HOLD_APPLICABILITY_PACKET`
The upstream E2 applicability packet is not qualified or its integrity cannot be verified.

### `HOLD_EVIDENCE_INTEGRITY`
Evidence is malformed, duplicate, out of scope, temporally invalid, or contains invalid content-addressed artifact metadata.

### `WAITING_FOR_EXTERNAL_REVIEW_EVIDENCE`
One or more required evidence classes are missing for a triggered E2 candidate.

### `WAITING_FOR_CREDENTIAL_EVIDENCE`
Review evidence is structurally complete, but one or more reviewers lack corresponding credential/authority evidence.

### `READY_FOR_EXTERNAL_AUTHORITY_VALIDATION`
All required review and reviewer-credential evidence is structurally present and content-addressed.

This is the highest E2B state. It still does **not** mean that the evidence is authentic, the reviewer is licensed/authorized, the legal/professional conclusion is correct, or any standard/regulatory rule may be activated.

## Evidence classes

E2B supports:

- `LEGAL_REVIEW`
- `PROFESSIONAL_REVIEW`
- `ACCOUNTING_REVIEW`
- `TAX_REVIEW`
- `DATA_GOVERNANCE_REVIEW`
- `REFERENCE_CONFIRMATION`

Required classes are derived from each E2 candidate's review class.

## Review evidence contract

Each review evidence record requires:

- evidence identifier;
- E2 candidate identifier;
- evidence class;
- reviewer reference;
- issuer/firm reference;
- source artifact identifier;
- artifact SHA-256;
- scope reference;
- issue timestamp;
- receipt timestamp.

The module computes a deterministic evidence-record SHA-256 from the metadata.

## Credential evidence contract

Each reviewer must have corresponding credential/authority evidence containing:

- credential-evidence identifier;
- reviewer reference;
- authority reference;
- credential class;
- source artifact identifier;
- artifact SHA-256;
- observation timestamp;
- external verification-source reference;
- optional claimed validity dates.

E2B deliberately records these as **evidence**, not verified credential truth.

## Authority boundary

Even at `READY_FOR_EXTERNAL_AUTHORITY_VALIDATION`, all remain false:

- `externalReviewAuthenticityValidated`
- `credentialAuthenticityValidated`
- `reviewerAuthorityValidated`
- `reviewerCredentialsVerified`
- `reviewerIndependenceVerified`
- `legalConclusionEstablished`
- `professionalApplicabilityEstablished`
- `formalStandardsConformanceEstablished`
- `saudiProfessionalLicensingEstablished`
- `pdplComplianceEstablished`
- `taxComplianceEstablished`
- `financialReportingComplianceEstablished`
- `certifiedValuationAuthorityEstablished`
- `externalIssuanceAuthorized`
- `releaseAuthorized`
- `mergeAuthorized`
- `deploymentAuthorized`
- `transactionAuthorized`

Operating mode remains `UNLICENSED_DECISION_SUPPORT`.

## Next controlled stage

After E2B engineering qualification, the next stage is:

`E2C_EXTERNAL_AUTHORITY_VALIDATION`

E2C must consume actual independent verification results for evidence authenticity, reviewer credentials/authority and review scope. It must not allow caller-supplied labels alone to promote an evidence record to verified authority.
