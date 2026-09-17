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

## B. Current operating model

Repository and GitHub administration remain owner-operated by `تركي العيد`.

Current intended owner roles:

- Repository Owner / Administrator
- Release Governance Accountable
- `RELEASE_APPROVAL` authority
- `MERGE_APPROVAL` authority

`سعيد` has now been nominated as a human candidate for independent review, E2F external verification and Deployment approval, without requiring a GitHub account. However, the currently generated سعيد RSA key pair was created under the owner-controlled Windows profile and without a private-key passphrase. Therefore the public key is recorded only as candidate material and does not, by itself, establish independent private-key custody or satisfy any current independence gate.

This operating model does not waive any independent-human requirement already enforced by the current governance contracts.

## C. Independent Reviewer — #254

Status: `SAID_NOMINATED_CANDIDATE_NOT_YET_INDEPENDENCE_QUALIFIED`

- reviewerId: `reviewer-candidate-said-2026-09-17`
- reviewerSubjectRef: `human:said`
- reviewerDisplayName: `سعيد`
- candidatePublicKeySha256: `924cff36221c486f285d969ad8fcdd927b3f868e76c5726efcef49bbb0305999`
- candidateRegistryPath: `governance/operator-templates/e2f-verifier-candidate.said.current.json`
- independenceEvidenceRef: `<REQUIRED_BEFORE_ACTIVATION>`
- governanceEvidenceRef: `<REQUIRED_BEFORE_ACTIVATION>`
- activeFrom: `<NOT_ACTIVE>`
- allowedPurpose: `CANONICAL_REBASELINE_INDEPENDENT_REVIEW`

The owner cannot satisfy this independent-review role. سعيد may become the independent reviewer only after genuine independent control/custody of his signing private key and the required independence evidence are established.

## D. E2F External Verifiers — #364

Status: `SAID_NOMINATED_CANDIDATE_NOT_TRUSTED_NOT_EXTERNALLY_GOVERNED`

Candidate:

- verifierSubjectRef: `human:said`
- publicKeySha256: `924cff36221c486f285d969ad8fcdd927b3f868e76c5726efcef49bbb0305999`
- candidateRegistryPath: `governance/operator-templates/e2f-verifier-candidate.said.current.json`
- keyCustodyStatus: `OWNER_CONTROLLED_KEY_MATERIAL_DOES_NOT_ESTABLISH_INDEPENDENT_HUMAN_CUSTODY`

Required validation coverage remains:

1. `EXTERNAL_CONFORMANCE_AUTHENTICITY`
2. `PRODUCTION_SECURITY_VALIDATION`
3. `PRODUCTION_PERFORMANCE_VALIDATION`
4. `PRODUCTION_RESILIENCE_VALIDATION`

The candidate public key MUST NOT be inserted into the active `EXTERNALLY_GOVERNED` trusted E2F verifier registry or used to sign E2F evidence as independent until genuine independent private-key custody by سعيد is established and evidenced.

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

Status: `SAID_NOMINATED_CANDIDATE_NOT_ACTIVE`

- authorityId: `deployment-authority-candidate-said-2026-09-17`
- authoritySubjectRef: `human:said`
- candidatePublicKeySha256: `924cff36221c486f285d969ad8fcdd927b3f868e76c5726efcef49bbb0305999`
- candidateRegistryPath: `governance/operator-templates/e2f-verifier-candidate.said.current.json`
- governanceEvidenceRef: `<REQUIRED_BEFORE_ACTIVATION>`

Although `human:said` is distinct from `github:turkialeid2030`, the current generated key material is under owner-controlled custody and therefore is not activated as the distinct Deployment authority key. Independent key custody must be established first.

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

1. establish and evidence genuine independent private-key custody for سعيد before using him as #254 independent reviewer;
2. establish and evidence externally governed E2F verifier authority/custody for سعيد before activating his candidate key;
3. complete the four genuine E2F validation results and RSA-SHA256 signatures after verifier qualification;
4. establish distinct Deployment authority custody for سعيد before activation;
5. signed E2G decisions after upstream E2F qualification;
6. final resolution of #327 Required Reviewer separation, or an explicit governed policy change if the owner-operated model is to replace that control.

## Prohibited data

Do not record private keys, tokens, passwords, Cloudflare credentials, GitHub secrets, recovery codes, signing secrets, or connection strings.

This intake grants no release, merge, deployment, transaction, professional, or commercial authority by itself.
