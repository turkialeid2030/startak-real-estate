# Human Authority Intake — Current State for Frozen RC

This file records public/non-secret authority metadata only. Registration of public material does not create substantive approval or execution authority.

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
- #326: `PASS_CLOSED`
- #327: `PARTIAL_PASS_OPEN`

#327 remains open because the required-reviewer or equivalent independent production Environment approval boundary is not yet evidenced as satisfied.

## B. Said public-key rotation governance — #367

The owner approved rotating Said's public trust material for E2F external verification and E2G `DEPLOYMENT_APPROVAL` only.

- owner rotation evidence: `https://github.com/turkialeid2030/startak-real-estate/issues/367#issuecomment-5756532755`
- previous Said publicKeySha256: `fbd4b0eee65ba6a08dfd6f673a80eb538149549f6bfcef26ade26ddacab14af1`
- current Said publicKeySha256: `0af393bd7c091106c3b16e493b4f99d39570c77675c9c5dee175d5a7727ebbc1`
- rotation scope: `E2F_EXTERNAL_VERIFIER`, `E2G_DEPLOYMENT_APPROVAL`
- owner Release/Merge public key: unchanged
- authority effect of rotation: `NONE`

The rotation changes public trust roots only. It does not create validation results, RSA signatures, release approval, merge approval, deployment approval, transaction authority or Go-Live.

## C. Independent Reviewer — #254

Status: `PASS_CLOSED`

- reviewerId: `reviewer-said-2026-09-17`
- reviewerSubjectRef: `human:said`
- reviewerDisplayName: `سعيد`
- current publicKeySha256: `0af393bd7c091106c3b16e493b4f99d39570c77675c9c5dee175d5a7727ebbc1`
- completed review memo SHA-256: `3e992e93dd701283215d95d3d3cf2ab0fe1d7ccda605866ab829f4e743a16aec`
- allowedPurpose: `CANONICAL_REBASELINE_INDEPENDENT_REVIEW`
- reviewerRegistryPath: `governance/operator-templates/canonical-rebaseline-reviewer-registry.current.json`
- normalizedReviewerRegistryHashSha256: `2cd45d81863afb8d41a30404d5b1cf2113c216abf6ae13e51d6f41e0962d0f53`
- signature verification: `PASS`
- verifier state: `VERIFIED_REVIEW_RESPONSE_READY_FOR_P25_REEVALUATION`
- P25: `READY_FOR_EXPLICIT_BASELINE_ACTIVATION_CHANGE`

This does not automatically activate the canonical baseline and grants no release/merge/deployment authority.

## D. E2F External Verifier — #364

Status: `TRUST_ROOT_ROTATED_PENDING_FRESH_EXACT_HEAD_CI_OUT_OF_BAND_PINNING_AND_GENUINE_VALIDATIONS`

- verifierId: `e2f-verifier-said-2026-09-17`
- verifierSubjectRef: `human:said`
- authorityClass: `OWNER_RISK_ACCEPTED_EXTERNAL_HUMAN_VERIFIER`
- current publicKeySha256: `0af393bd7c091106c3b16e493b4f99d39570c77675c9c5dee175d5a7727ebbc1`
- previous publicKeySha256: `fbd4b0eee65ba6a08dfd6f673a80eb538149549f6bfcef26ade26ddacab14af1`
- registryPath: `governance/operator-templates/e2f-verifier-registry.current.json`
- normalizedRegistryHashSha256 candidate: `59de1600dd145c7504c2eb907cb19c4c0df3e98fd85e8aa2331a31a0b14386a9`
- registryOutOfBandPinStatus: `REQUIRED_NOT_ESTABLISHED_BY_REPOSITORY_FILE`

Required validation coverage remains:

1. `EXTERNAL_CONFORMANCE_AUTHENTICITY`
2. `PRODUCTION_SECURITY_VALIDATION`
3. `PRODUCTION_PERFORMANCE_VALIDATION`
4. `PRODUCTION_RESILIENCE_VALIDATION`

Each E2F validation still requires genuine evidence, a real result and a genuine RSA-SHA256 signature over repository canonical bytes. No validation result is created by this intake.

## E. E2G Human Release Authorities — #364

Public release-authority registry staging:

- governanceArtifactPath: `governance/operator-templates/release-authority-governance-artifact.current.json`
- governanceArtifactSha256: `bf8191a4f13021ca7b18abb9857d58770ce9546ad01c2439fc544e61fe74c0c1`
- registryPath: `governance/operator-templates/e2g-release-authority-registry.current.template.json`
- normalizedRegistryHashSha256 candidate: `35c28e89061a69e6c001f2db512261f8a67180a08fe7a07cc90d839537cbb781`
- registryOutOfBandPinStatus: `REQUIRED_NOT_ESTABLISHED_BY_REPOSITORY_FILE`

### RELEASE_APPROVAL

- authorityId: `release-authority-turki-al-eid-2026-09-16`
- authoritySubjectRef: `github:turkialeid2030`
- publicKeySha256: `194f78b203841fbefebd9c360e591748b1f787be5f1b310a620ea91589aefccf`
- status: `KEY_REGISTERED_PENDING_QUALIFIED_E2F_AND_GENUINE_SIGNATURE`

### MERGE_APPROVAL

- authorityId: `merge-authority-turki-al-eid-2026-09-16`
- authoritySubjectRef: `github:turkialeid2030`
- publicKeySha256: `194f78b203841fbefebd9c360e591748b1f787be5f1b310a620ea91589aefccf`
- status: `KEY_REGISTERED_PENDING_QUALIFIED_E2F_AND_GENUINE_SIGNATURE`

### DEPLOYMENT_APPROVAL

- authorityId: `deployment-authority-said-2026-09-17`
- authoritySubjectRef: `human:said`
- current publicKeySha256: `0af393bd7c091106c3b16e493b4f99d39570c77675c9c5dee175d5a7727ebbc1`
- previous publicKeySha256: `fbd4b0eee65ba6a08dfd6f673a80eb538149549f6bfcef26ade26ddacab14af1`
- governanceEvidenceRef: `https://github.com/turkialeid2030/startak-real-estate/issues/367#issuecomment-5756532755`
- status: `KEY_ROTATED_PENDING_QUALIFIED_E2F_AND_GENUINE_DECISION_SIGNATURE`

Merge and Deployment authorities remain distinct subjects as required. No E2G decision is signed yet.

## F. Current holds

- #254: `PASS_CLOSED`
- E2D: `HOLD_GENUINE_EXTERNAL_CHAIN_REQUIRED`
- E2E: `HOLD_GENUINE_EVIDENCE_REQUIRED`
- E2F: `HOLD_FOUR_GENUINE_SIGNED_VALIDATIONS_REQUIRED`
- E2G decisions: `HOLD_UPSTREAM_E2F_AND_GENUINE_SIGNATURES_REQUIRED`
- #327: `PARTIAL_PASS_REQUIRED_REVIEWER_SEPARATION_UNRESOLVED`
- Final RC → main PR: `HOLD`
- Merge: `HOLD`
- Deployment: `HOLD`
- Transaction authority: `false`
- Commercial Go-Live: `HOLD`

## Prohibited data

Do not record private keys, passphrases, tokens, passwords, production credentials, recovery codes, signing secrets or connection strings.

This intake records designations and public trust material only; it does not itself create any cryptographic signature or substantive approval.
