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

- #326: ruleset `21861129` requires both `release-verify` and `trusted-main-production-governance`, with strict enforcement and no bypass actors.
- #327 partial hardening: administrator bypass is OFF, deployment branches/tags are restricted to `main`, `CLOUDFLARE_API_TOKEN` is scoped as a `production` Environment secret, `CLOUDFLARE_ACCOUNT_ID` is a `production` Environment variable, and the broader repository-level `CLOUDFLARE_API_TOKEN` secret has been removed.

Administrative work still required:

- #327 remains open because Required Reviewers are currently OFF under the owner-operated interim model.

## B. Current owner-operated model

The current operational model is owner-operated by `تركي العيد` only.

Current intended roles:

- Repository Owner / Administrator
- Release Governance Accountable
- `RELEASE_APPROVAL` authority
- `MERGE_APPROVAL` authority

No other named person is currently designated in this intake.

This owner-operated constraint does not waive any independent-human requirement already enforced by the current governance contracts.

## C. Independent Reviewer — #254

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

The owner cannot satisfy this independent-review role under the current gate because the reviewer must be distinct from the release owner/operator.

## D. E2F External Verifiers — #364

Status: `UNASSIGNED_EXTERNAL_VALIDATORS_REQUIRED`

Required validation coverage:

1. `EXTERNAL_CONFORMANCE_AUTHENTICITY`
2. `PRODUCTION_SECURITY_VALIDATION`
3. `PRODUCTION_PERFORMANCE_VALIDATION`
4. `PRODUCTION_RESILIENCE_VALIDATION`

External verifier identity, governance evidence, public key material and genuine signed validation evidence remain required by the current E2F contract.

## E. E2G Human Release Authorities — #364

### RELEASE_APPROVAL authority

- authorityId: `release-authority-turki-al-eid-2026-09-16`
- authoritySubjectRef: `github:turkialeid2030`
- governanceEvidenceRef: `https://github.com/turkialeid2030/startak-real-estate/issues/365#issuecomment-5703765871`
- publicKeySha256: `194f78b203841fbefebd9c360e591748b1f787be5f1b310a620ea91589aefccf`
- publicKeyRegisteredAt: `2026-09-17T09:56:48+03:00`
- publicKeyRegistryPath: `governance/operator-templates/e2g-release-authority-registry.current.template.json`
- status: `KEY_REGISTERED_PENDING_E2F_AND_SIGNATURE`

### MERGE_APPROVAL authority

- authorityId: `merge-authority-turki-al-eid-2026-09-16`
- authoritySubjectRef: `github:turkialeid2030`
- governanceEvidenceRef: `https://github.com/turkialeid2030/startak-real-estate/issues/365#issuecomment-5703765871`
- publicKeySha256: `194f78b203841fbefebd9c360e591748b1f787be5f1b310a620ea91589aefccf`
- publicKeyRegisteredAt: `2026-09-17T09:56:48+03:00`
- publicKeyRegistryPath: `governance/operator-templates/e2g-release-authority-registry.current.template.json`
- status: `KEY_REGISTERED_PENDING_E2F_AND_SIGNATURE`

The same owner RSA public key is intentionally registered for both RELEASE and MERGE authority records. The current validator permits this because both records belong to the same owner subject; Deployment authority must remain a different human subject.

### DEPLOYMENT_APPROVAL authority

Status: `UNASSIGNED_DISTINCT_HUMAN_REQUIRED`

- authorityId: `<REPLACE_DEPLOYMENT_AUTHORITY_ID>`
- authoritySubjectRef: `<MUST_NOT_EQUAL_github:turkialeid2030>`
- governanceEvidenceRef: `<REPLACE>`
- publicKeyPem: `<PUBLIC_ONLY>`
- publicKeySha256: `<REPLACE>`

The current verifier requires Merge and Deployment to be held by different human subjects.

## F. Immediate Environment target state — #327

Current administrator-confirmed interim state:

- Required Reviewers: `OFF` temporarily
- Administrator bypass: `OFF`
- Deployment branches/tags: `main` only
- `CLOUDFLARE_API_TOKEN`: scoped as an Environment secret for `production`
- `CLOUDFLARE_ACCOUNT_ID`: scoped as an Environment variable for `production`
- repository-level `CLOUDFLARE_API_TOKEN`: removed

This is an interim environment-hardening state only. It does not satisfy independent review, external validation, or distinct Deployment authority requirements elsewhere in the release chain.

## G. Remaining human inputs

The unresolved human inputs are:

1. one real independent reviewer for #254;
2. externally governed verifier coverage for the four E2F validation types;
3. one distinct Deployment authority with its own public RSA key;
4. signed E2G decisions after upstream E2F qualification;
5. final resolution of #327 Required Reviewer separation, or an explicit governed policy change if the owner-operated model is to replace that control.

## Prohibited data

Do not record private keys, tokens, passwords, Cloudflare credentials, GitHub secrets, recovery codes, signing secrets, or connection strings.

This intake grants no release, merge, deployment, transaction, professional, or commercial authority by itself.
