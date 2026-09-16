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
- rulesetEvidenceCompleted: `true`
- productionEnvironmentEvidenceCompleted: `false`

Completed administrative control:

- #326: ruleset `21861129` now requires both `release-verify` and `trusted-main-production-governance`, preserves strict required-status enforcement, and has no bypass actors.

Administrative work still required:

- #327: complete `production` Environment protection configuration and evidence without exposing any secret value.

## B. Two-person operating model

The owner states that the currently available human operating set is limited to:

1. `تركي العيد`
2. `سعيد`

This is recorded as an operating constraint only. It does not by itself prove identity, independence, key ownership, or any signed decision.

### تركي العيد

Intended roles:

- Repository Owner / Administrator
- Release Governance Accountable
- `RELEASE_APPROVAL` authority
- `MERGE_APPROVAL` authority

### سعيد

Intended distinct-human roles, pending identity/trust/public-key evidence:

- Production Environment Required Reviewer
- Independent Reviewer candidate for #254
- `DEPLOYMENT_APPROVAL` authority candidate
- E2F verifier candidate only if the implemented verifier permits the assigned validation coverage and independence requirements are actually met

The same person must not be represented as independent evidence where the underlying verifier/policy requires a different actor or authority class.

## C. Independent Reviewer — #254

Status: `CANDIDATE_SAEED_PENDING_IDENTITY_TRUST_KEY_AND_REVIEW_EVIDENCE`

- reviewerId: `<REPLACE_WITH_REAL_SAEED_REVIEWER_ID>`
- reviewerSubjectRef: `<REPLACE_WITH_REAL_SAEED_SUBJECT_REF>`
- reviewerDisplayName: `سعيد`
- independenceRequirement: `MUST_DIFFER_FROM_github:turkialeid2030`
- independenceEvidenceRef: `<REPLACE>`
- governanceEvidenceRef: `<REPLACE>`
- publicKeyPemRef: `<PUBLIC_ONLY>`
- publicKeySha256: `<REPLACE>`
- activeFrom: `<ISO-8601>`
- activeUntil: `<ISO-8601_OR_NULL>`
- allowedPurpose: `CANONICAL_REBASELINE_INDEPENDENT_REVIEW`

No historical `سعيد المراجع` placeholder or stale reviewer record is accepted as identity evidence. A fresh real identity/trust record remains required.

## D. E2F External Verifiers — #364

Status: `CANDIDATE_SAEED_PENDING_VERIFIER_CONTRACT_CHECK_AND_INDEPENDENCE_EVIDENCE`

Required validation coverage:

1. `EXTERNAL_CONFORMANCE_AUTHENTICITY`
2. `PRODUCTION_SECURITY_VALIDATION`
3. `PRODUCTION_PERFORMANCE_VALIDATION`
4. `PRODUCTION_RESILIENCE_VALIDATION`

Before assigning all or any of these classes to سعيد, verify the implemented E2F registry/validation contract allows the proposed coverage and that سعيد is not the implementation actor or otherwise disqualified by the independence rules. Public key material and genuine signed validation evidence remain required.

## E. E2G Human Release Authorities — #364

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

Status: `CANDIDATE_SAEED_PENDING_IDENTITY_KEY_AND_SIGNATURE`

- authorityId: `<REPLACE_WITH_SAEED_DEPLOYMENT_AUTHORITY_ID>`
- authoritySubjectRef: `<REPLACE_WITH_REAL_SAEED_SUBJECT_REF>`
- authorityDisplayName: `سعيد`
- governanceEvidenceRef: `<REPLACE>`
- publicKeyPem: `<PUBLIC_ONLY>`
- publicKeySha256: `<REPLACE>`

Mandatory separation remains satisfied only when the real سعيد subject is verified to differ from `github:turkialeid2030`.

## F. Immediate Environment target state — #327

Given the current two-person operating model, the intended `production` Environment configuration is:

- Required Reviewers: `ON`
- Required Reviewer: `سعيد` using his real GitHub identity/collaborator record
- Prevent self review: use the strongest available setting if exposed by the repository plan/UI
- Administrator bypass: `OFF`
- Deployment branches/tags: `main` only
- `CLOUDFLARE_API_TOKEN`: scoped as an Environment secret for `production` rather than a broad repository production credential where possible

Do not select `تركي العيد` as the only Required Reviewer for the production environment, because that would collapse the intended two-person production separation.

## G. Remaining human inputs

The unresolved human inputs are now reduced to:

1. سعيد's real GitHub/authority identity;
2. public RSA key material for تركي and سعيد;
3. fresh #254 independent-review evidence from سعيد if he is confirmed eligible;
4. E2F verifier eligibility/coverage check and genuine signed validations;
5. signed E2G decisions for Release, Merge, and Deployment;
6. completion/evidence of #327 production Environment controls.

## Prohibited data

Do not record private keys, tokens, passwords, Cloudflare credentials, GitHub secrets, recovery codes, signing secrets, or connection strings.

This intake grants no release, merge, deployment, transaction, professional, or commercial authority by itself.
