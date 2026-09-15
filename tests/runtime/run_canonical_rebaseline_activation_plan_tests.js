'use strict';

const assert = require('assert');
const crypto = require('crypto');
const { createCanonicalBaselineReconstitutionProposal } = require('../../src/qualification/canonical-baseline-reconstitution');
const {
  DECISION_RESULT,
  createCanonicalRebaselineGovernanceDecision,
} = require('../../src/qualification/canonical-rebaseline-governance-decision');
const {
  createCanonicalRebaselineReviewerDesignation,
} = require('../../src/qualification/canonical-rebaseline-reviewer-designation');
const {
  createCanonicalRebaselineReviewerDesignationLedger,
} = require('../../src/qualification/canonical-rebaseline-reviewer-designation-ledger');
const {
  createCanonicalRebaselineIndependentReviewPacket,
} = require('../../src/qualification/canonical-rebaseline-independent-review');
const {
  normalizeRegistry,
  createIndependentReviewSigningPayload,
  createVerifiedIndependentReviewResponse,
  stableStringify,
} = require('../../src/qualification/canonical-rebaseline-review-attestation');
const {
  evaluateCanonicalRebaselineReviewerLifecycle,
} = require('../../src/qualification/canonical-rebaseline-reviewer-lifecycle');
const {
  STATUS,
  createCanonicalRebaselineActivationPlan,
} = require('../../src/qualification/canonical-rebaseline-activation-plan');

const H64 = (c) => c.repeat(64);
const COMMIT = 'a'.repeat(40);
const OWNER = 'owner:turkialeid2030';
const REVIEWER = 'reviewer:saeed-pending';

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).trim();
const publicKeySha256 = crypto.createHash('sha256').update(publicKeyPem, 'utf8').digest('hex');

function proposal() {
  return createCanonicalBaselineReconstitutionProposal({
    proposalId: 'rebaseline-activation-plan-1',
    qualifiedSourceCommitSha: COMMIT,
    releaseArtifactSha256: H64('b'),
    environmentConfigSha256: H64('c'),
    preparedByRef: OWNER,
    independentReviewerRef: 'reviewer:placeholder',
    preparedAt: '2026-09-09T18:00:00Z',
  });
}

function ownerDecision() {
  return {
    decisionId: 'owner-activation-plan-1',
    actorRef: OWNER,
    result: DECISION_RESULT.APPROVE,
    decisionSourceRef: 'issue:250#owner',
    decisionArtifactSha256: H64('d'),
    decidedAt: '2026-09-09T19:00:00Z',
    rationaleRef: 'owner-approved-governed-rebaseline',
  };
}

function buildQualifiedPipeline() {
  const p = proposal();
  const designation = createCanonicalRebaselineReviewerDesignation({
    proposal: p,
    designationId: 'saeed-designation-1',
    assignedByRef: OWNER,
    reviewerRef: REVIEWER,
    reviewerDisplayName: 'سعيد المراجع',
    designationSourceRef: 'owner-governance:saeed',
    designationArtifactSha256: H64('e'),
    designatedAt: '2026-09-09T20:00:00Z',
  });
  const ledger = createCanonicalRebaselineReviewerDesignationLedger({
    proposal: p,
    ownerActorRef: OWNER,
    designations: [designation],
  });
  const packet = createCanonicalRebaselineIndependentReviewPacket({
    proposal: p,
    ownerDecision: ownerDecision(),
    reviewerDesignation: designation,
    reviewRequestId: 'review-request-activation-plan-1',
    requestedAt: '2026-09-09T20:10:00Z',
  });
  const registry = {
    registryId: 'reviewers-v1',
    governanceArtifactSha256: H64('f'),
    reviewers: [{
      reviewerId: 'saeed-registry-1',
      reviewerSubjectRef: REVIEWER,
      publicKeyPem,
      publicKeySha256,
      governanceEvidenceRef: 'governance:saeed',
      activeFrom: '2026-09-01T00:00:00Z',
      activeUntil: '2026-12-31T23:59:59Z',
      allowedPurpose: 'CANONICAL_REBASELINE_INDEPENDENT_REVIEW',
    }],
  };
  const normalizedRegistry = normalizeRegistry(registry);
  const unsigned = {
    decisionId: 'saeed-review-activation-plan-1',
    reviewerId: 'saeed-registry-1',
    actorRef: REVIEWER,
    result: DECISION_RESULT.APPROVE,
    decisionSourceRef: 'external-review:saeed',
    decisionArtifactSha256: H64('1'),
    decidedAt: '2026-09-09T21:00:00Z',
    rationaleRef: 'approved-after-independent-review',
    signatureAlgorithm: 'RSA-SHA256',
  };
  const signingPayload = createIndependentReviewSigningPayload({ packet, attestation: unsigned });
  const signatureBase64 = crypto.sign('RSA-SHA256', Buffer.from(stableStringify(signingPayload), 'utf8'), privateKey).toString('base64');
  const verified = createVerifiedIndependentReviewResponse({
    packet,
    reviewerRegistry: registry,
    expectedReviewerRegistryHashSha256: normalizedRegistry.registryHashSha256,
    attestation: { ...unsigned, signatureBase64 },
  });
  const lifecycle = evaluateCanonicalRebaselineReviewerLifecycle({
    ledger,
    reviewPacket: packet,
    verifiedReviewResponse: verified,
  });
  const governanceDecision = createCanonicalRebaselineGovernanceDecision({
    proposal: p,
    ownerDecision: ownerDecision(),
    independentReview: verified.independentReview,
    reviewerDesignation: designation,
  });
  return { p, designation, ledger, packet, verified, lifecycle, governanceDecision };
}

(function run() {
  const q = buildQualifiedPipeline();
  const ready = createCanonicalRebaselineActivationPlan({
    proposal: q.p,
    governanceDecision: q.governanceDecision,
    reviewerLifecycle: q.lifecycle,
    activationChangeId: 'activation-change-1',
    preparedByRef: OWNER,
    preparedAt: '2026-09-09T22:00:00Z',
  });
  assert.strictEqual(ready.status, STATUS.READY_FOR_EXPLICIT_BASELINE_ACTIVATION_CHANGE_PLAN);
  assert.strictEqual(ready.successorBaselineManifest.qualifiedSourceCommitSha, COMMIT);
  assert.strictEqual(ready.successorBaselineManifest.releaseArtifactSha256, H64('b'));
  assert.strictEqual(ready.successorBaselineManifest.environmentConfigSha256, H64('c'));
  assert.strictEqual(ready.targetActivationContract.targetPath, 'config/governance/canonical-baseline.json');
  assert.strictEqual(ready.activationApplied, false);
  assert.strictEqual(ready.canonicalBaselineChanged, false);
  assert.strictEqual(ready.releaseAuthorized, false);
  assert.match(ready.activationPlanHashSha256, /^[a-f0-9]{64}$/);
  assert.match(ready.successorBaselineManifestHashSha256, /^[a-f0-9]{64}$/);
  assert.strictEqual(Object.isFrozen(ready), true);

  const pendingLifecycle = evaluateCanonicalRebaselineReviewerLifecycle({ ledger: q.ledger });
  const pending = createCanonicalRebaselineActivationPlan({
    proposal: q.p,
    governanceDecision: q.governanceDecision,
    reviewerLifecycle: pendingLifecycle,
    activationChangeId: 'activation-change-2',
    preparedByRef: OWNER,
    preparedAt: '2026-09-09T22:01:00Z',
  });
  assert.strictEqual(pending.status, STATUS.HOLD_ACTIVATION_PLAN);
  assert.deepStrictEqual(pending.blockers, ['P30_VERIFIED_REVIEWER_LIFECYCLE_LOCK_REQUIRED']);

  const wrongOwner = createCanonicalRebaselineActivationPlan({
    proposal: q.p,
    governanceDecision: q.governanceDecision,
    reviewerLifecycle: q.lifecycle,
    activationChangeId: 'activation-change-3',
    preparedByRef: 'owner:someone-else',
    preparedAt: '2026-09-09T22:02:00Z',
  });
  assert.strictEqual(wrongOwner.status, STATUS.HOLD_ACTIVATION_PLAN);
  assert.deepStrictEqual(wrongOwner.blockers, ['ACTIVATION_PLAN_MUST_BE_PREPARED_BY_PROPOSAL_OWNER']);

  const tamperedGovernance = { ...q.governanceDecision, releaseArtifactSha256: H64('9') };
  const badScope = createCanonicalRebaselineActivationPlan({
    proposal: q.p,
    governanceDecision: tamperedGovernance,
    reviewerLifecycle: q.lifecycle,
    activationChangeId: 'activation-change-4',
    preparedByRef: OWNER,
    preparedAt: '2026-09-09T22:03:00Z',
  });
  assert.strictEqual(badScope.status, STATUS.HOLD_ACTIVATION_PLAN);
  assert.deepStrictEqual(badScope.blockers, ['GOVERNANCE_DECISION_BASELINE_SCOPE_MISMATCH']);

  const tamperedLifecycle = { ...q.lifecycle, currentReviewerRef: 'reviewer:other' };
  const badLifecycle = createCanonicalRebaselineActivationPlan({
    proposal: q.p,
    governanceDecision: q.governanceDecision,
    reviewerLifecycle: tamperedLifecycle,
    activationChangeId: 'activation-change-5',
    preparedByRef: OWNER,
    preparedAt: '2026-09-09T22:04:00Z',
  });
  assert.strictEqual(badLifecycle.status, STATUS.HOLD_ACTIVATION_PLAN);
  assert.deepStrictEqual(badLifecycle.blockers, ['REVIEWER_LIFECYCLE_GOVERNANCE_MISMATCH']);

  console.log('canonical rebaseline activation plan tests: PASS');
})();
