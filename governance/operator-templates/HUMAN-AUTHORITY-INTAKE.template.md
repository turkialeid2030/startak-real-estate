# Human Authority Intake — Frozen RC

Use this document only to collect **public/non-secret** authority metadata for the frozen release tuple.

## Frozen tuple

- Release Candidate: `startak-real-estate-rc-2026-09-16-e876208c19ff`
- Source SHA: `e876208c19ffbddd0dacd2bf8fce24aba1e52b55`
- Artifact SHA-256: `c3ddcd7b4a66fd58c271fb08b9e5a3efb5e4237f0015d3771e7ab9818412017f`
- Environment: `cloudflare-pages:startak-real-estate:production`
- Environment Config SHA-256: `819183fb9f4fb09017c636d2d1d841dd086ac4ba4bbccd103dffbc4c5980bc73`

## A. Independent Reviewer — #254

- reviewerId: `<REPLACE>`
- reviewerSubjectRef: `<REPLACE>`
- reviewerDisplayName: `<REPLACE>`
- independenceEvidenceRef: `<REPLACE>`
- governanceEvidenceRef: `<REPLACE>`
- publicKeyPemRef: `<REPLACE_OR_EMBED_PUBLIC_ONLY>`
- publicKeySha256: `<REPLACE>`
- activeFrom: `<ISO-8601>`
- activeUntil: `<ISO-8601_OR_NULL>`
- allowedPurpose: `CANONICAL_REBASELINE_INDEPENDENT_REVIEW`

Required separation: reviewerSubjectRef MUST NOT equal the owner/release operator subject.

## B. E2F External Verifiers — #364

Create at least the externally governed verifier records necessary for these four validation types:

1. `EXTERNAL_CONFORMANCE_AUTHENTICITY`
2. `PRODUCTION_SECURITY_VALIDATION`
3. `PRODUCTION_PERFORMANCE_VALIDATION`
4. `PRODUCTION_RESILIENCE_VALIDATION`

For each verifier:

- verifierId: `<REPLACE>`
- verifierSubjectRef: `<REPLACE>`
- authorityClass: `<REPLACE>`
- governanceEvidenceRef: `<REPLACE>`
- publicKeyPemRef: `<REPLACE_OR_EMBED_PUBLIC_ONLY>`
- publicKeySha256: `<REPLACE>`
- activeFrom: `<ISO-8601>`
- activeUntil: `<ISO-8601_OR_NULL>`

A verifier may cover more than one validation type only if its documented authority and independence permit that scope.

## C. E2G Human Release Authorities — #364

### RELEASE_APPROVAL authority
- authorityId: `<REPLACE>`
- authoritySubjectRef: `<REPLACE>`
- governanceEvidenceRef: `<REPLACE>`
- publicKeySha256: `<REPLACE>`

### MERGE_APPROVAL authority
- authorityId: `<REPLACE>`
- authoritySubjectRef: `<REPLACE>`
- governanceEvidenceRef: `<REPLACE>`
- publicKeySha256: `<REPLACE>`

### DEPLOYMENT_APPROVAL authority
- authorityId: `<REPLACE>`
- authoritySubjectRef: `<REPLACE>`
- governanceEvidenceRef: `<REPLACE>`
- publicKeySha256: `<REPLACE>`

Mandatory separation: the subject holding `MERGE_APPROVAL` MUST NOT be the same subject holding `DEPLOYMENT_APPROVAL`.

## D. GitHub Administrator — #326 / #327

- administratorSubjectRef: `<REPLACE>`
- repositoryAdminAuthorityEvidenceRef: `<REPLACE>`
- rulesetEvidenceCompleted: `false`
- productionEnvironmentEvidenceCompleted: `false`

## Prohibited data

Do **not** record any of the following here:

- private keys
- tokens
- passwords
- Cloudflare API credentials
- GitHub secrets
- signing secrets
- recovery codes
- connection strings

Only public keys, hashes, subject references, authority references, evidence references, and externally produced signatures are allowed.

## Completion condition

This intake is considered administratively complete only when all roles above are populated with real accountable humans/entities and the required separation-of-duties checks pass.

This intake alone grants no release, merge, deployment, transaction, or commercial go-live authority.
