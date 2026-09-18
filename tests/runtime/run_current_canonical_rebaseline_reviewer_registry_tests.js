'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  normalizeRegistry,
} = require('../../src/qualification/canonical-rebaseline-review-attestation');

const root = path.resolve(__dirname, '../..');
const registryPath = path.join(root, 'governance/operator-templates/canonical-rebaseline-reviewer-registry.current.json');
const governanceArtifactPath = path.join(root, 'governance/operator-templates/canonical-rebaseline-review-governance-artifact.current.json');
const packetPath = path.join(root, 'governance/operator-templates/current-lineage-review/review-packet.current.json');

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const packet = JSON.parse(fs.readFileSync(packetPath, 'utf8'));
const governanceArtifactBytes = fs.readFileSync(governanceArtifactPath);
const governanceArtifactSha256 = crypto.createHash('sha256').update(governanceArtifactBytes).digest('hex');
const normalized = normalizeRegistry(registry);

assert.strictEqual(governanceArtifactSha256, '284b5995b9d964481c42aa9ef3820206ef1db12c4b7aadf68f44ca6e50695e68');
assert.strictEqual(registry.governanceArtifactSha256, governanceArtifactSha256);
assert.strictEqual(normalized.registryHashSha256, '62c76efae99b3cf07a2f2fe7182b9c76932b39e9b72bd1eb48ea625dc620b5ca');
assert.strictEqual(normalized.reviewers.length, 1);

const reviewer = normalized.reviewers[0];
assert.strictEqual(reviewer.reviewerId, 'reviewer-said-2026-09-17');
assert.strictEqual(reviewer.reviewerSubjectRef, 'human:said');
assert.strictEqual(reviewer.reviewerSubjectRef, packet.independentReviewerRef);
assert.strictEqual(reviewer.publicKeySha256, 'fbd4b0eee65ba6a08dfd6f673a80eb538149549f6bfcef26ade26ddacab14af1');
assert.strictEqual(reviewer.allowedPurpose, 'CANONICAL_REBASELINE_INDEPENDENT_REVIEW');
assert.strictEqual(reviewer.governanceEvidenceRef, 'https://github.com/turkialeid2030/startak-real-estate/issues/367');

assert.strictEqual(packet.status, 'READY_FOR_INDEPENDENT_REVIEW');
assert.strictEqual(packet.reviewPacketHashSha256, 'ed8a0ffb242081d308f89b1e177920d6bf2d6e058bceb5047ddedaf4f0eed107');
assert.strictEqual(packet.ownerActorRef, 'github:turkialeid2030');
assert.notStrictEqual(packet.ownerActorRef, reviewer.reviewerSubjectRef);

console.log('current canonical rebaseline reviewer registry: PASS');
