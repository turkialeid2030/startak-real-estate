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

assert.strictEqual(governanceArtifactSha256, '26ca3a5370e427c40a195c1e7609c8f3f69c8d330ca9f8e8aad3b4b5ebcb7e07');
assert.strictEqual(registry.governanceArtifactSha256, governanceArtifactSha256);
assert.strictEqual(normalized.registryHashSha256, '2cd45d81863afb8d41a30404d5b1cf2113c216abf6ae13e51d6f41e0962d0f53');
assert.strictEqual(normalized.reviewers.length, 1);

const reviewer = normalized.reviewers[0];
assert.strictEqual(reviewer.reviewerId, 'reviewer-said-2026-09-17');
assert.strictEqual(reviewer.reviewerSubjectRef, 'human:said');
assert.strictEqual(reviewer.reviewerSubjectRef, packet.independentReviewerRef);
assert.strictEqual(reviewer.publicKeySha256, '0af393bd7c091106c3b16e493b4f99d39570c77675c9c5dee175d5a7727ebbc1');
assert.strictEqual(reviewer.allowedPurpose, 'CANONICAL_REBASELINE_INDEPENDENT_REVIEW');
assert.strictEqual(reviewer.governanceEvidenceRef, 'https://github.com/turkialeid2030/startak-real-estate/issues/367#issuecomment-5756079007');
assert.strictEqual(reviewer.activeFrom, '2026-09-21T06:01:00.000Z');

assert.strictEqual(packet.status, 'READY_FOR_INDEPENDENT_REVIEW');
assert.strictEqual(packet.reviewPacketHashSha256, 'ed8a0ffb242081d308f89b1e177920d6bf2d6e058bceb5047ddedaf4f0eed107');
assert.strictEqual(packet.ownerActorRef, 'github:turkialeid2030');
assert.notStrictEqual(packet.ownerActorRef, reviewer.reviewerSubjectRef);

console.log('current canonical rebaseline reviewer registry after Said key rotation: PASS');
