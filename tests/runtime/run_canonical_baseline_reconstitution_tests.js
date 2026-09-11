'use strict';

const assert = require('assert');
const {
  STATUS,
  createCanonicalBaselineReconstitutionProposal,
  createLegacyCanonicalUnavailableHold,
} = require('../../src/qualification/canonical-baseline-reconstitution');

const COMMIT = '7ccec21bbdf88ed0aea302b6f3cfb2f5a142c6c6';
const ARTIFACT = 'a'.repeat(64);
const ENV = 'b'.repeat(64);

(function holdPath() {
  const hold = createLegacyCanonicalUnavailableHold();
  assert.strictEqual(hold.status, STATUS.LEGACY_CANONICAL_SOURCE_UNAVAILABLE_REBASELINE_REQUIRED);
  assert.strictEqual(hold.rebaselineGovernanceRequired, true);
  assert.strictEqual(hold.legacyCanonicalEvidenceClosed, false);
  assert.strictEqual(hold.canonicalBaselineChanged, false);
  assert.strictEqual(hold.releaseAuthorized, false);
  assert.strictEqual(hold.mergeAuthorized, false);
  assert.strictEqual(hold.deploymentAuthorized, false);
  assert.strictEqual(hold.goLiveAuthorized, false);
  assert.strictEqual(hold.transactionAuthorized, false);
  assert(Object.isFrozen(hold));
})();

(function proposalPath() {
  const proposal = createCanonicalBaselineReconstitutionProposal({
    proposalId: 'REBASELINE-001',
    qualifiedSourceCommitSha: COMMIT,
    releaseArtifactSha256: ARTIFACT,
    environmentConfigSha256: ENV,
    preparedByRef: 'owner-a',
    independentReviewerRef: 'reviewer-b',
    preparedAt: '2026-09-09T18:30:00Z',
  });
  assert.strictEqual(proposal.status, STATUS.READY_FOR_HUMAN_REBASELINE_GOVERNANCE);
  assert.strictEqual(proposal.proposedBaselineType, 'QUALIFIED_GIT_COMMIT_AND_RELEASE_ARTIFACT');
  assert.strictEqual(proposal.qualifiedSourceCommitSha, COMMIT);
  assert.strictEqual(proposal.releaseArtifactSha256, ARTIFACT);
  assert.strictEqual(proposal.environmentConfigSha256, ENV);
  assert.match(proposal.proposalHashSha256, /^[a-f0-9]{64}$/);
  assert.strictEqual(proposal.automaticBaselineSwitchAllowed, false);
  assert.strictEqual(proposal.existingE2iCanonicalEvidenceSatisfied, false);
  assert.strictEqual(proposal.legacyCanonicalEvidenceClosed, false);
  assert.strictEqual(proposal.canonicalBaselineChanged, false);
  assert.strictEqual(proposal.releaseAuthorized, false);
  assert.strictEqual(proposal.mergeAuthorized, false);
  assert.strictEqual(proposal.deploymentAuthorized, false);
  assert.strictEqual(proposal.goLiveAuthorized, false);
  assert.strictEqual(proposal.transactionAuthorized, false);
  assert(proposal.requiredHumanActions.includes('AUTHORITATIVE_OWNER_APPROVAL'));
  assert(proposal.requiredHumanActions.includes('INDEPENDENT_REVIEW_APPROVAL'));
  assert(proposal.requiredHumanActions.includes('EXPLICIT_CODE_CHANGE_TO_ACTIVATE_NEW_BASELINE'));
  assert(Object.isFrozen(proposal));
  assert(Object.isFrozen(proposal.requiredHumanActions));
})();

(function deterministicHash() {
  const input = {
    proposalId: 'REBASELINE-DET',
    qualifiedSourceCommitSha: COMMIT,
    releaseArtifactSha256: ARTIFACT,
    environmentConfigSha256: ENV,
    preparedByRef: 'owner-a',
    independentReviewerRef: 'reviewer-b',
    preparedAt: '2026-09-09T18:30:00Z',
  };
  assert.strictEqual(
    createCanonicalBaselineReconstitutionProposal(input).proposalHashSha256,
    createCanonicalBaselineReconstitutionProposal(input).proposalHashSha256,
  );
})();

assert.throws(() => createCanonicalBaselineReconstitutionProposal({
  proposalId: 'X',
  qualifiedSourceCommitSha: COMMIT,
  releaseArtifactSha256: ARTIFACT,
  environmentConfigSha256: ENV,
  preparedByRef: 'same',
  independentReviewerRef: 'same',
  preparedAt: '2026-09-09T18:30:00Z',
}), /REBASELINE_PROPOSER_REVIEWER_SEPARATION_REQUIRED/);

assert.throws(() => createCanonicalBaselineReconstitutionProposal({
  proposalId: 'X',
  qualifiedSourceCommitSha: 'not-a-commit',
  releaseArtifactSha256: ARTIFACT,
  environmentConfigSha256: ENV,
  preparedByRef: 'owner-a',
  independentReviewerRef: 'reviewer-b',
  preparedAt: '2026-09-09T18:30:00Z',
}), /40-character commit SHA/);

assert.throws(() => createCanonicalBaselineReconstitutionProposal({
  proposalId: 'X',
  qualifiedSourceCommitSha: COMMIT,
  releaseArtifactSha256: 'bad',
  environmentConfigSha256: ENV,
  preparedByRef: 'owner-a',
  independentReviewerRef: 'reviewer-b',
  preparedAt: '2026-09-09T18:30:00Z',
}), /SHA-256/);

console.log('canonical baseline reconstitution tests: PASS');
