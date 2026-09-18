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
  canonicalReviewRegistry: '62c76efae99b3cf07a2f2fe7182b9c76932b39e9b72bd1eb48ea625dc620b5ca',
  canonicalReviewGovernanceArtifact: '284b5995b9d964481c42aa9ef3820206ef1db12c4b7aadf68f44ca6e50695e68',
  e2fVerifierRegistry: 'fb544ff5555be8f71fb9afbda1f5f2edc60aa8465bd7d91ea392c6865873fbaa',
  e2gReleaseAuthorityRegistry: '5125ae7c55541f37fee2ed571107cd846bfb5d91b2a1399633e20eacc67a0d3e',
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
  assert.strictEqual(evidence.canonicalReviewRegistry.normalizedRegistryHashSha256Recomputed, canonicalReview.registryHashSha256);
  assert.strictEqual(evidence.e2fVerifierRegistry.normalizedRegistryHashSha256Recomputed, e2f.registryHashSha256);
  assert.strictEqual(evidence.e2gReleaseAuthorityRegistry.normalizedRegistryHashSha256Recomputed, e2g.registryHashSha256);

  const staged = readJson(path.join(OPERATOR, 'pre-signature', 'TRUST-ROOT-PIN-CANDIDATES.current.json'));
  assert.strictEqual(staged.canonicalReviewRegistry.normalizedRegistryHashSha256, canonicalReview.registryHashSha256);
  assert.strictEqual(staged.e2fVerifierRegistry.normalizedRegistryHashSha256, e2f.registryHashSha256);
  assert.strictEqual(staged.e2gReleaseAuthorityRegistry.normalizedRegistryHashSha256, e2g.registryHashSha256);
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
  console.log('OUT_OF_BAND_PINNING_STILL_REQUIRED=true');
  console.log('AUTHORITY_EFFECT=NONE');
}

main();
