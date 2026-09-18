'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  createCanonicalBaselineReconstitutionProposal,
} = require('../../src/qualification/canonical-baseline-reconstitution');
const {
  createCanonicalRebaselineGovernanceDecision,
} = require('../../src/qualification/canonical-rebaseline-governance-decision');
const {
  createCanonicalRebaselineIndependentReviewPacket,
} = require('../../src/qualification/canonical-rebaseline-independent-review');

const root = path.resolve(__dirname, '../..');
const chainDir = path.join(root, 'governance/operator-templates/current-lineage-review');
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(chainDir, name), 'utf8'));

const proposal = readJson('proposal.current.json');
const ownerDecision = readJson('owner-decision.current.json');
const recordedP25 = readJson('p25-governance.current.json');
const recordedPacket = readJson('review-packet.current.json');
const summary = readJson('chain-summary.current.json');
const ownerArtifactPath = path.join(chainDir, 'CURRENT-LINEAGE-OWNER-REBASELINE-DIRECTION.current.md');
const ownerArtifactSha256 = crypto.createHash('sha256').update(fs.readFileSync(ownerArtifactPath)).digest('hex');

assert.strictEqual(ownerArtifactSha256, ownerDecision.decisionArtifactSha256);
assert.strictEqual(ownerArtifactSha256, summary.ownerArtifactSha256);

const regeneratedProposal = createCanonicalBaselineReconstitutionProposal({
  proposalId: proposal.proposalId,
  qualifiedSourceCommitSha: proposal.qualifiedSourceCommitSha,
  releaseArtifactSha256: proposal.releaseArtifactSha256,
  environmentConfigSha256: proposal.environmentConfigSha256,
  preparedByRef: proposal.preparedByRef,
  independentReviewerRef: proposal.independentReviewerRef,
  rationaleCode: proposal.rationaleCode,
  preparedAt: proposal.preparedAt,
});
assert.deepStrictEqual(JSON.parse(JSON.stringify(regeneratedProposal)), proposal);
assert.strictEqual(proposal.proposalHashSha256, summary.proposalHashSha256);
assert.strictEqual(proposal.status, 'READY_FOR_HUMAN_REBASELINE_GOVERNANCE');
assert.strictEqual(proposal.qualifiedSourceCommitSha, 'e876208c19ffbddd0dacd2bf8fce24aba1e52b55');
assert.strictEqual(proposal.releaseArtifactSha256, 'c3ddcd7b4a66fd58c271fb08b9e5a3efb5e4237f0015d3771e7ab9818412017f');
assert.strictEqual(proposal.environmentConfigSha256, '819183fb9f4fb09017c636d2d1d841dd086ac4ba4bbccd103dffbc4c5980bc73');
assert.strictEqual(proposal.preparedByRef, 'github:turkialeid2030');
assert.strictEqual(proposal.independentReviewerRef, 'human:said');

const regeneratedP25 = createCanonicalRebaselineGovernanceDecision({
  proposal,
  ownerDecision,
  independentReview: null,
});
assert.deepStrictEqual(JSON.parse(JSON.stringify(regeneratedP25)), recordedP25);
assert.strictEqual(regeneratedP25.status, 'WAITING_FOR_INDEPENDENT_REVIEW');
assert.strictEqual(regeneratedP25.ownerDecision.decisionHashSha256, summary.ownerDecisionHashSha256);
assert.deepStrictEqual(regeneratedP25.blockers, ['INDEPENDENT_REVIEW_REQUIRED']);

const regeneratedPacket = createCanonicalRebaselineIndependentReviewPacket({
  proposal,
  ownerDecision,
  reviewerDesignation: null,
  reviewRequestId: recordedPacket.reviewRequestId,
  requestedAt: recordedPacket.requestedAt,
});
assert.deepStrictEqual(JSON.parse(JSON.stringify(regeneratedPacket)), recordedPacket);
assert.strictEqual(regeneratedPacket.status, 'READY_FOR_INDEPENDENT_REVIEW');
assert.strictEqual(regeneratedPacket.reviewPacketHashSha256, summary.reviewPacketHashSha256);
assert.strictEqual(regeneratedPacket.ownerActorRef, 'github:turkialeid2030');
assert.strictEqual(regeneratedPacket.independentReviewerRef, 'human:said');
assert.strictEqual(regeneratedPacket.expectedResponseContract.actorRefMustEqual, 'human:said');

assert.strictEqual(summary.reviewerRegistryStatus, 'READY_TECHNICALLY_OUT_OF_BAND_PIN_REQUIRED');
assert.strictEqual(summary.reviewerRegistryHashSha256, '62c76efae99b3cf07a2f2fe7182b9c76932b39e9b72bd1eb48ea625dc620b5ca');
assert.strictEqual(summary.reviewerPublicKeySha256, 'fbd4b0eee65ba6a08dfd6f673a80eb538149549f6bfcef26ade26ddacab14af1');
assert.strictEqual(summary.canonicalReviewVerifier, 'tools/verify-canonical-rebaseline-review-attestation.js');
assert.strictEqual(summary.saidDecision, 'APPROVE_REPORTED');
assert.strictEqual(summary.reviewMemo, 'REQUIRED');
assert.strictEqual(summary.canonicalSigningPayload, 'BLOCKED_UNTIL_REVIEW_ARTIFACT_FIELDS_EXIST');
assert.strictEqual(summary.signedReview, 'NOT_YET');
assert.strictEqual(summary.independentReviewGate254, 'HOLD');
assert.strictEqual(summary.e2f, 'HOLD');
assert.strictEqual(summary.e2g, 'HOLD');
assert.strictEqual(summary.merge, 'HOLD');
assert.strictEqual(summary.deploy, 'HOLD');

console.log('current-lineage P24/P25/P26 review chain: PASS');
