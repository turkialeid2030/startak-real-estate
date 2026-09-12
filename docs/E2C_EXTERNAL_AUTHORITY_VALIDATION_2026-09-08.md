# STARTAK Real Estate — E2C External Authority Validation

Date: 2026-09-08

## Objective

E2C is the controlled stage after E2B has assembled a structurally complete external-review and reviewer-credential evidence envelope.

E2C addresses a narrower question:

> Can an external validation attestation be cryptographically verified against an independently governed verifier key that is anchored by an out-of-band pinned registry hash?

The stage is intentionally designed so that caller-supplied labels such as `verified`, `licensed`, `independent`, `approved` or `valid` cannot promote evidence or reviewer authority by themselves.

## Upstream prerequisite

E2C accepts only an E2B envelope whose status is:

`READY_FOR_EXTERNAL_AUTHORITY_VALIDATION`

and whose deterministic envelope hash passes integrity verification.

Any other status or a tampered upstream envelope produces:

`HOLD_EXTERNAL_EVIDENCE_ENVELOPE`

## Trust root

E2C requires a trusted verifier registry with:

- `status = EXTERNALLY_GOVERNED`;
- one or more verifier identities;
- verifier subject reference;
- authority class;
- public key;
- public-key SHA-256 fingerprint;
- governance evidence reference;
- verifier active period.

The normalized registry receives a deterministic SHA-256 hash.

That hash must match an expected value supplied from an **out-of-band trusted deployment/release configuration**. If it does not match, E2C fails closed with:

`HOLD_TRUST_ROOT`

The repository does not contain a production trusted-verifier registry or production trust-root hash. Therefore this PR does not establish any real reviewer credential, authority or independence.

## Cryptographic attestations

Each E2C attestation contains a signed payload with:

- attestation identifier;
- validation type;
- target reference;
- optional linked credential-evidence identifier;
- subject artifact SHA-256;
- result;
- verifier identifier;
- independent verification-source reference;
- verification artifact SHA-256;
- verification timestamp;
- optional expiry timestamp;
- signature algorithm.

The signature is verified against the pinned trusted verifier registry.

Initial supported signature algorithm:

`RSA-SHA256`

## Validation types

E2C requires four validation classes:

1. `REVIEW_EVIDENCE_AUTHENTICITY`
2. `CREDENTIAL_AUTHENTICITY`
3. `REVIEWER_AUTHORITY`
4. `REVIEWER_INDEPENDENCE`

For reviewer authority/independence attestations, the attestation must link to credential evidence for the same reviewer and bind to that credential artifact SHA-256.

## Attestation results

Allowed results:

- `VERIFIED`
- `REJECTED`
- `INCONCLUSIVE`

A validly signed `REJECTED` result is blocking and produces:

`HOLD_EXTERNAL_VALIDATION_REJECTED`

An `INCONCLUSIVE` result is preserved as evidence but never counts as verification.

## Self-validation control

A trusted verifier may not validate a reviewer when the verifier's governed subject reference equals that reviewer reference.

Such an attempt produces:

`SELF_VALIDATION_PROHIBITED`

and the packet is held under:

`HOLD_ATTESTATION_INTEGRITY`

## E2C states

- `HOLD_EXTERNAL_EVIDENCE_ENVELOPE`
- `HOLD_TRUST_ROOT`
- `HOLD_ATTESTATION_INTEGRITY`
- `HOLD_EXTERNAL_VALIDATION_REJECTED`
- `WAITING_FOR_REVIEW_AUTHENTICITY_VALIDATION`
- `WAITING_FOR_CREDENTIAL_AUTHENTICITY_VALIDATION`
- `WAITING_FOR_REVIEWER_AUTHORITY_VALIDATION`
- `WAITING_FOR_REVIEWER_INDEPENDENCE_VALIDATION`
- `AUTHORITY_VALIDATION_COMPLETE_PENDING_SUBSTANTIVE_REVIEW`

## Meaning of the maximum state

`AUTHORITY_VALIDATION_COMPLETE_PENDING_SUBSTANTIVE_REVIEW` means only that all required authenticity, credential-authority and reviewer-independence attestations were cryptographically verified against the supplied externally governed registry and its pinned hash.

At that state E2C may set these narrow validation gates to true:

- `externalReviewAuthenticityValidated`
- `credentialAuthenticityValidated`
- `reviewerAuthorityValidated`
- `reviewerCredentialsVerified`
- `reviewerIndependenceVerified`
- `externalAuthorityValidationComplete`

It does **not** set any of the following:

- `legalConclusionEstablished`
- `professionalApplicabilityEstablished`
- `formalStandardsConformanceEstablished`
- `saudiProfessionalLicensingEstablished`
- `pdplComplianceEstablished`
- `taxComplianceEstablished`
- `financialReportingComplianceEstablished`
- `certifiedValuationAuthorityEstablished`
- `standardsOrRulesActivated`
- `externalIssuanceAuthorized`
- `releaseAuthorized`
- `mergeAuthorized`
- `deploymentAuthorized`
- `transactionAuthorized`

The operating mode remains:

`UNLICENSED_DECISION_SUPPORT`

## Production boundary

This engineering stage deliberately ships with:

- `productionTrustedVerifierRegistryConfigured = false`
- `productionExternalAttestationEvidencePresent = false`

Tests use an ephemeral RSA key pair and a test-only externally governed registry fixture solely to prove that the cryptographic and fail-closed controls work. Test fixtures do not constitute production authority evidence.

## Next controlled stage

After E2C engineering qualification, the next stage is:

`E2D_SUBSTANTIVE_REVIEW_DISPOSITION_AND_RULE_ACTIVATION_PROPOSAL`

E2D may consume an actually completed E2C packet plus the substantive human review conclusions. It must still separate:

- applicability conclusion;
- legal/professional correctness;
- rule activation proposal;
- platform/entity licensing;
- certified valuation authority;
- external issuance authority;
- release/deployment authorization.

No one of those may be inferred from another.