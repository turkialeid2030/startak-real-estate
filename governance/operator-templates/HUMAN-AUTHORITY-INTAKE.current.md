# Human Authority Intake — Current State for Frozen RC

This file records only public/non-secret authority metadata for the current execution state.

## Frozen tuple

- Release Candidate: `startak-real-estate-rc-2026-09-16-e876208c19ff`
- Source SHA: `e876208c19ffbddd0dacd2bf8fce24aba1e52b55`
- Artifact SHA-256: `c3ddcd7b4a66fd58c271fb08b9e5a3efb5e4237f0015d3771e7ab9818412017f`
- Environment: `cloudflare-pages:startak-real-estate:production`
- Environment Config SHA-256: `819183fb9f4fb09017c636d2d1d841dd086ac4ba4bbccd103dffbc4c5980bc73`

## A. Current accountable owner / administrator

- displayName: `تركي العيد`
- administratorSubjectRef: `github:turkialeid2030`
- repositoryRole: `OWNER`
- authorityEvidenceRef: `https://github.com/turkialeid2030/startak-real-estate/issues/365#issuecomment-5703765871`
- rulesetEvidenceCompleted: `false`
- productionEnvironmentEvidenceCompleted: `false`

Administrative work still required:

- #326: update ruleset `21861129` so both `release-verify` and `trusted-main-production-governance` are required while preserving strict/no-bypass controls.
- #327: verify and document `production` Environment reviewers, branch restrictions, and Cloudflare token scope without exposing any secret value.

## B. Independent Reviewer — #254

Status: `UNASSIGNED_EXTERNAL_HUMAN_REQUIRED`

- reviewerId: `<REPLACE_REAL_INDEPENDENT_REVIEWER_ID>`
- reviewerSubjectRef: `<MUST_DIFFER_FROM_github:turkialeid2030>`
- reviewerDisplayName: `<REPLACE>`
- independenceEvidenceRef: `<REPLACE>`
- governanceEvidenceRef: `<REPLACE>`
- publicKeyPemRef: `<PUBLIC_ONLY>`
- publicKeySha256: `<REPLACE>`
- activeFrom: `<ISO-8601>`
- activeUntil: `<ISO-8601_OR_NULL>`
- allowedPurpose: `CANONICAL_REBASELINE_INDEPENDENT_REVIEW`

The current owner is not eligible to satisfy this role because the gate requires an independent reviewer distinct from the release owner/operator.

## C. E2F External Verifiers — #364

Status: `UNASSIGNED_EXTERNAL_VALIDATORS_REQUIRED`

Required validation coverage:

1. `EXTERNAL_CONFORMANCE_AUTHENTICITY`
2. `PRODUCTION_SECURITY_VALIDATION`
3. `PRODUCTION_PERFORMANCE_VALIDATION`
4. `PRODUCTION_RESILIENCE_VALIDATION`

For each verifier, provide only public authority metadata and public key material. The current owner is not being designated as an independent E2F verifier.

## D. E2G Human Release Authorities — #364

### RELEASE_APPROVAL authority

- authorityId: `release-authority-turki-al-eid-2026-09-16`
- authoritySubjectRef: `github:turkialeid2030`
- governanceEvidenceRef: `https://github.com/turkialeid2030/startak-real-estate/issues/365#issuecomment-5703765871`
- publicKeyPem: `<REPLACE_WITH_OWNER_RSA_PUBLIC_KEY_ONLY>`
- publicKeySha256: `<REPLACE_64_HEX_SHA256_OF_PUBLIC_KEY_PEM>`
- status: `DESIGNATED_PENDING_KEY_E2F_AND_SIGNATURE`

### MERGE_APPROVAL authority

- authorityId: `merge-authority-turki-al-eid-2026-09-16`
- authoritySubjectRef: `github:turkialeid2030`
- governanceEvidenceRef: `https://github.com/turkialeid2030/startak-real-estate/issues/365#issuecomment-5703765871`
- publicKeyPem: `<REPLACE_WITH_OWNER_RSA_PUBLIC_KEY_ONLY>`
- publicKeySha256: `<REPLACE_64_HEX_SHA256_OF_PUBLIC_KEY_PEM>`
- status: `DESIGNATED_PENDING_KEY_E2F_AND_SIGNATURE`

### DEPLOYMENT_APPROVAL authority

Status: `UNASSIGNED_DISTINCT_HUMAN_REQUIRED`

- authorityId: `<REPLACE_DEPLOYMENT_AUTHORITY_ID>`
- authoritySubjectRef: `<MUST_NOT_EQUAL_github:turkialeid2030>`
- governanceEvidenceRef: `<REPLACE>`
- publicKeyPem: `<PUBLIC_ONLY>`
- publicKeySha256: `<REPLACE>`

Mandatory separation: the subject holding `MERGE_APPROVAL` must not be the same subject holding `DEPLOYMENT_APPROVAL`.

## E. Remaining human inputs

The minimum unresolved human inputs are now reduced to:

1. one real independent reviewer for #254;
2. externally governed verifier coverage for the four E2F validation types;
3. one distinct Deployment authority;
4. the current owner executing the GitHub administrator controls in #326 and #327;
5. public RSA key material for designated E2G authorities.

## Prohibited data

Do not record private keys, tokens, passwords, Cloudflare credentials, GitHub secrets, recovery codes, signing secrets, or connection strings.

This intake grants no release, merge, deployment, transaction, professional, or commercial authority by itself.
