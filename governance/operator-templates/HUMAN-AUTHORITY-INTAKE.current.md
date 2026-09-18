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
- rulesetEvidenceCompleted: `true`
- productionEnvironmentEvidenceCompleted: `false`

Completed administrative control:

- #326: ruleset `21861129` requires both `release-verify` and `trusted-main-production-governance`, with strict enforcement and no bypass actors.
- #327 partial hardening: administrator bypass is OFF, deployment branches/tags are restricted to `main`, `CLOUDFLARE_API_TOKEN` is scoped as a `production` Environment secret, `CLOUDFLARE_ACCOUNT_ID` is a `production` Environment variable, and the broader repository-level `CLOUDFLARE_API_TOKEN` secret has been removed.

Administrative work still required:

- #327 remains open because Required Reviewers are currently OFF under the owner-operated interim model.

## B. Owner-directed custody exception — #367 / #364

The owner explicitly directed that separate-device / sole-private-key-custody evidence for `human:said` be waived for the current governance path. Issue #367 is closed/completed as the repository record of that owner risk acceptance.

- governanceEvidenceRef: `https://github.com/turkialeid2030/startak-real-estate/issues/367`
- سعيد publicKeySha256: `fbd4b0eee65ba6a08dfd6f673a80eb538149549f6bfcef26ade26ddacab14af1`
- privateKeyPassphraseConfigured: `true`
- custody model: `OWNER_RISK_ACCEPTED_PASSPHRASE_PROTECTED_OWNER_HOSTED_KEY`

This exception removes the project-level custody-evidence blocker only. It does not fabricate a review, validation result, RSA signature, release approval, merge approval, deployment approval, transaction authority or Go-Live.

## C. Independent Reviewer — #254

Status: `SAID_DESIGNATED_PENDING_GENUINE_REVIEW_AND_SIGNATURE`

- reviewerId: `reviewer-said-2026-09-17`
- reviewerSubjectRef: `human:said`
- reviewerDisplayName: `سعيد`
- publicKeySha256: `fbd4b0eee65ba6a08dfd6f673a80eb538149549f6bfcef26ade26ddacab14af1`
- governanceEvidenceRef: `https://github.com/turkialeid2030/startak-real-estate/issues/367`
- allowedPurpose: `CANONICAL_REBASELINE_INDEPENDENT_REVIEW`
- governanceArtifactPath: `governance/operator-templates/canonical-rebaseline-review-governance-artifact.current.json`
- governanceArtifactSha256: `284b5995b9d964481c42aa9ef3820206ef1db12c4b7aadf68f44ca6e50695e68`
- reviewerRegistryPath: `governance/operator-templates/canonical-rebaseline-reviewer-registry.current.json`
- normalizedReviewerRegistryHashSha256: `62c76efae99b3cf07a2f2fe7182b9c76932b39e9b72bd1eb48ea625dc620b5ca`
- reviewerRegistryOutOfBandPinStatus: `STAGED_NOT_ESTABLISHED_BY_REPOSITORY_FILE`

The owner-relayed سعيد decision is preserved as `APPROVE_REPORTED` only. A genuine completed review artifact for the exact frozen tuple, evidence/rationale, and a genuine RSA-SHA256 signature over the repository canonical payload are still required before #254 can be closed.

## D. E2F External Verifier — #364

Status: `TRUST_RECORD_REGISTERED_PENDING_GENUINE_VALIDATIONS_AND_SIGNATURES`

- verifierId: `e2f-verifier-said-2026-09-17`
- verifierSubjectRef: `human:said`
- authorityClass: `OWNER_RISK_ACCEPTED_EXTERNAL_HUMAN_VERIFIER`
- publicKeySha256: `fbd4b0eee65ba6a08dfd6f673a80eb538149549f6bfcef26ade26ddacab14af1`
- governanceEvidenceRef: `https://github.com/turkialeid2030/startak-real-estate/issues/367`
- registryPath: `governance/operator-templates/e2f-verifier-registry.current.json`
- registryHashSha256: `fb544ff5555be8f71fb9afbda1f5f2edc60aa8465bd7d91ea392c6865873fbaa`
- registryOutOfBandPinStatus: `STAGED_NOT_ESTABLISHED_BY_REPOSITORY_FILE`

Required validation coverage remains:

1. `EXTERNAL_CONFORMANCE_AUTHENTICITY`
2. `PRODUCTION_SECURITY_VALIDATION`
3. `PRODUCTION_PERFORMANCE_VALIDATION`
4. `PRODUCTION_RESILIENCE_VALIDATION`

Each required E2F validation still needs genuine evidence plus a genuine `RSA-SHA256` signature over the canonical payload. No such validation result is created by this intake.

## E. E2G Human Release Authorities — #364

Public release-authority registry staging:

- governanceArtifactPath: `governance/operator-templates/release-authority-governance-artifact.current.json`
- governanceArtifactSha256: `c08fb5bad0d98dabf897af2401af0b6f8abec8f0d3d1bacf3f471c17035630ac`
- registryPath: `governance/operator-templates/e2g-release-authority-registry.current.template.json`
- normalizedRegistryHashSha256: `5125ae7c55541f37fee2ed571107cd846bfb5d91b2a1399633e20eacc67a0d3e`
- registryOutOfBandPinStatus: `STAGED_NOT_ESTABLISHED_BY_REPOSITORY_FILE`

### RELEASE_APPROVAL

- authorityId: `release-authority-turki-al-eid-2026-09-16`
- authoritySubjectRef: `github:turkialeid2030`
- publicKeySha256: `194f78b203841fbefebd9c360e591748b1f787be5f1b310a620ea91589aefccf`
- status: `KEY_REGISTERED_PENDING_E2F_AND_SIGNATURE`

### MERGE_APPROVAL

- authorityId: `merge-authority-turki-al-eid-2026-09-16`
- authoritySubjectRef: `github:turkialeid2030`
- publicKeySha256: `194f78b203841fbefebd9c360e591748b1f787be5f1b310a620ea91589aefccf`
- status: `KEY_REGISTERED_PENDING_E2F_AND_SIGNATURE`

### DEPLOYMENT_APPROVAL

- authorityId: `deployment-authority-said-2026-09-17`
- authoritySubjectRef: `human:said`
- publicKeySha256: `fbd4b0eee65ba6a08dfd6f673a80eb538149549f6bfcef26ade26ddacab14af1`
- governanceEvidenceRef: `https://github.com/turkialeid2030/startak-real-estate/issues/367`
- status: `KEY_REGISTERED_PENDING_E2F_AND_GENUINE_DECISION_SIGNATURE`

The Merge and Deployment authorities are distinct subjects as required. Actual decisions are not yet signed and no release/merge/deployment authority is exercised by registration alone.

## F. Current holds

- #254: `HOLD_GENUINE_SIGNED_REVIEW_REQUIRED`
- E2F: `HOLD_FOUR_GENUINE_SIGNED_VALIDATIONS_REQUIRED`
- E2G decisions: `HOLD_UPSTREAM_E2F_AND_GENUINE_SIGNATURES_REQUIRED`
- #327: `PARTIAL_PASS_REQUIRED_REVIEWER_SEPARATION_UNRESOLVED`
- Final RC → main PR: `HOLD`
- Merge: `HOLD`
- Deployment: `HOLD`
- Transaction authority: `false`
- Commercial Go-Live: `HOLD`

## Prohibited data

Do not record private keys, passphrases, tokens, passwords, Cloudflare credentials, GitHub secrets, recovery codes, signing secrets, or connection strings.

This intake records designations and public trust material only; it does not itself create any cryptographic signature or substantive approval.
