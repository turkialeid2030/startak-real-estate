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
const verifiedReview = readJson('verified-said-review/said-review-verified-response.json');
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

assert.strictEqual(
  verifiedReview.status,
  'VERIFIED_REVIEW_RESPONSE_READY_FOR_P25_REEVALUATION',
);
assert.strictEqual(verifiedReview.reviewPacketHashSha256, recordedPacket.reviewPacketHashSha256);
assert.strictEqual(verifiedReview.reviewerSubjectRef, 'human:said');
assert.strictEqual(verifiedReview.publicKeySha256, '0af393bd7c091106c3b16e493b4f99d39570c77675c9c5dee175d5a7727ebbc1');
assert.strictEqual(verifiedReview.reviewerIdentityCryptographicallyVerified, true);
assert.strictEqual(verifiedReview.reviewerRegistryTrustRootVerified, true);
assert.strictEqual(verifiedReview.reviewAttestationSignatureVerified, true);
assert.strictEqual(verifiedReview.independentReview.actorRef, 'human:said');
assert.strictEqual(verifiedReview.independentReview.result, 'APPROVE');
assert.strictEqual(
  verifiedReview.independentReview.decisionArtifactSha256,
  '3e992e93dd701283215d95d3d3cf2ab0fe1d7ccda605866ab829f4e743a16aec',
);

const regeneratedP25 = createCanonicalRebaselineGovernanceDecision({
  proposal,
  ownerDecision,
  independentReview: verifiedReview.independentReview,
});
assert.deepStrictEqual(JSON.parse(JSON.stringify(regeneratedP25)), recordedP25);
assert.strictEqual(regeneratedP25.status, 'READY_FOR_EXPLICIT_BASELINE_ACTIVATION_CHANGE');
assert.strictEqual(regeneratedP25.ownerDecision.decisionHashSha256, summary.ownerDecisionHashSha256);
assert.strictEqual(
  regeneratedP25.governanceDecisionHashSha256,
  'a933ef596c623c9e2a732b2685236682174be2263a418ae0a91c037e2c36983b',
);
assert.deepStrictEqual(regeneratedP25.blockers, []);
assert.strictEqual(regeneratedP25.ownerMayReplaceReviewerBeforeAcceptedReview, false);
assert.strictEqual(regeneratedP25.automaticBaselineSwitchAllowed, false);
assert.strictEqual(regeneratedP25.canonicalBaselineChanged, false);
assert.strictEqual(regeneratedP25.releaseAuthorized, false);
assert.strictEqual(regeneratedP25.mergeAuthorized, false);
assert.strictEqual(regeneratedP25.deploymentAuthorized, false);
assert.strictEqual(regeneratedP25.goLiveAuthorized, false);
assert.strictEqual(regeneratedP25.transactionAuthorized, false);

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

assert.strictEqual(summary.p25Status, 'READY_FOR_EXPLICIT_BASELINE_ACTIVATION_CHANGE');
assert.strictEqual(summary.reviewerRegistryStatus, 'KEY_ROTATED_AND_PINNED_REVIEW_VERIFIED_PENDING_FRESH_EXACT_HEAD_CI');
assert.strictEqual(summary.reviewerRegistryHashSha256, '2cd45d81863afb8d41a30404d5b1cf2113c216abf6ae13e51d6f41e0962d0f53');
assert.strictEqual(summary.reviewerPublicKeySha256, '0af393bd7c091106c3b16e493b4f99d39570c77675c9c5dee175d5a7727ebbc1');
assert.strictEqual(summary.previousReviewerPublicKeySha256, 'fbd4b0eee65ba6a08dfd6f673a80eb538149549f6bfcef26ade26ddacab14af1');
assert.strictEqual(summary.canonicalReviewVerifier, 'tools/verify-canonical-rebaseline-review-attestation.js');
assert.strictEqual(summary.saidDecision, 'APPROVE_VERIFIED_RSA_SHA256');
assert.strictEqual(summary.reviewMemo, 'COMPLETED_SHA256_3e992e93dd701283215d95d3d3cf2ab0fe1d7ccda605866ab829f4e743a16aec');
assert.strictEqual(summary.canonicalSigningPayload, 'REGENERATED_AFTER_KEY_ROTATION_AND_SIGNED');
assert.strictEqual(summary.signedReview, 'VERIFIED_REVIEW_RESPONSE_READY_FOR_P25_REEVALUATION');
assert.strictEqual(summary.independentReviewGate254, 'PASS_PENDING_FRESH_EXACT_HEAD_CI_AND_ISSUE_CLOSEOUT');
assert.strictEqual(summary.e2f, 'HOLD');
assert.strictEqual(summary.e2g, 'HOLD');
assert.strictEqual(summary.merge, 'HOLD');
assert.strictEqual(summary.deploy, 'HOLD');

console.log('current-lineage P24/P25/P26 verified Said review chain: PASS');
