'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  normalizeRegistry: normalizeCanonicalReviewRegistry,
} = require('../../src/qualification/canonical-rebaseline-review-attestation');
const {
  normalizeTrustedVerifierRegistry,
} = require('../../src/standards/external-authority-validation');
const {
  normalizeReleaseAuthorityRegistry,
} = require('../../src/standards/human-release-authority-deployment-decision');

const ROOT = path.join(__dirname, '..', '..');
const OPERATOR = path.join(ROOT, 'governance', 'operator-templates');

const EXPECTED = Object.freeze({
  canonicalReviewRegistry: '2cd45d81863afb8d41a30404d5b1cf2113c216abf6ae13e51d6f41e0962d0f53',
  canonicalReviewGovernanceArtifact: '26ca3a5370e427c40a195c1e7609c8f3f69c8d330ca9f8e8aad3b4b5ebcb7e07',
  e2fVerifierRegistry: '59de1600dd145c7504c2eb907cb19c4c0df3e98fd85e8aa2331a31a0b14386a9',
  e2gReleaseAuthorityRegistry: '35c28e89061a69e6c001f2db512261f8a67180a08fe7a07cc90d839537cbb781',
});

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function rawSha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function main() {
  const governanceArtifactPath = path.join(OPERATOR, 'canonical-rebaseline-review-governance-artifact.current.json');
  const canonicalReviewPath = path.join(OPERATOR, 'canonical-rebaseline-reviewer-registry.current.json');
  const e2fPath = path.join(OPERATOR, 'e2f-verifier-registry.current.json');
  const e2gPath = path.join(OPERATOR, 'e2g-release-authority-registry.current.template.json');

  const governanceArtifactSha = rawSha256(governanceArtifactPath);
  assert.strictEqual(
    governanceArtifactSha,
    EXPECTED.canonicalReviewGovernanceArtifact,
    'canonical-review governance artifact raw-file SHA-256 drifted',
  );

  const canonicalReview = normalizeCanonicalReviewRegistry(readJson(canonicalReviewPath));
  assert.strictEqual(
    canonicalReview.governanceArtifactSha256,
    governanceArtifactSha,
    'canonical-review registry governance artifact binding mismatch',
  );
  assert.strictEqual(
    canonicalReview.registryHashSha256,
    EXPECTED.canonicalReviewRegistry,
    'canonical-review normalized registry SHA-256 drifted',
  );

  const e2f = normalizeTrustedVerifierRegistry(readJson(e2fPath));
  assert.strictEqual(
    e2f.registryHashSha256,
    EXPECTED.e2fVerifierRegistry,
    'E2F normalized verifier registry SHA-256 drifted',
  );

  const e2g = normalizeReleaseAuthorityRegistry(readJson(e2gPath));
  assert.strictEqual(
    e2g.registryHashSha256,
    EXPECTED.e2gReleaseAuthorityRegistry,
    'E2G normalized release-authority registry SHA-256 drifted',
  );

  const evidence = readJson(path.join(OPERATOR, 'pre-signature', 'TRUST-ROOT-HASH-VERIFICATION.current.json'));
  assert.strictEqual(evidence.canonicalReviewRegistry.normalizedRegistryHashSha256Verified, canonicalReview.registryHashSha256);
  assert.strictEqual(evidence.e2fVerifierRegistry.normalizedRegistryHashSha256Verified, e2f.registryHashSha256);
  assert.strictEqual(evidence.e2gReleaseAuthorityRegistry.normalizedRegistryHashSha256Verified, e2g.registryHashSha256);
  assert.strictEqual(evidence.canonicalReviewRegistry.repositoryImplementationVerificationPassed, true);
  assert.strictEqual(evidence.e2fVerifierRegistry.repositoryImplementationVerificationPassed, false);
  assert.strictEqual(evidence.e2gReleaseAuthorityRegistry.repositoryImplementationVerificationPassed, false);
  assert.strictEqual(evidence.verificationMethod.freshExactHeadCiRequired, true);
  assert.strictEqual(evidence.boundary.outOfBandPinningStillRequired, true);

  const staged = readJson(path.join(OPERATOR, 'pre-signature', 'TRUST-ROOT-PIN-CANDIDATES.current.json'));
  assert.strictEqual(staged.canonicalReviewRegistry.normalizedRegistryHashSha256, canonicalReview.registryHashSha256);
  assert.strictEqual(staged.e2fVerifierRegistry.normalizedRegistryHashSha256, e2f.registryHashSha256);
  assert.strictEqual(staged.e2gReleaseAuthorityRegistry.normalizedRegistryHashSha256, e2g.registryHashSha256);
  assert.strictEqual(staged.e2fVerifierRegistry.repositoryImplementationHashVerified, false);
  assert.strictEqual(staged.e2gReleaseAuthorityRegistry.repositoryImplementationHashVerified, false);
  assert.strictEqual(staged.calculationContract.repositoryImplementationVerificationCompleted, false);
  assert.strictEqual(staged.calculationContract.freshExactHeadCiRequiredAfterKeyRotation, true);
  assert.strictEqual(staged.boundary.outOfBandPinningStillRequired, true);
  assert.strictEqual(staged.boundary.signatureCreated, false);
  assert.strictEqual(staged.boundary.reviewAccepted, false);
  assert.strictEqual(staged.boundary.releaseAuthorized, false);
  assert.strictEqual(staged.boundary.mergeAuthorized, false);
  assert.strictEqual(staged.boundary.deploymentAuthorized, false);
  assert.strictEqual(staged.boundary.transactionAuthorized, false);

  console.log('CURRENT_TRUST_ROOT_REGISTRY_HASH_TEST=PASS');
  console.log(`CANONICAL_REVIEW_REGISTRY_SHA256=${canonicalReview.registryHashSha256}`);
  console.log(`E2F_VERIFIER_REGISTRY_SHA256=${e2f.registryHashSha256}`);
  console.log(`E2G_RELEASE_AUTHORITY_REGISTRY_SHA256=${e2g.registryHashSha256}`);
  console.log('ROTATED_E2F_E2G_TRUST_ROOTS_REQUIRE_FRESH_EXACT_HEAD_CI=true');
  console.log('OUT_OF_BAND_PINNING_STILL_REQUIRED=true');
  console.log('AUTHORITY_EFFECT=NONE');
}

main();
