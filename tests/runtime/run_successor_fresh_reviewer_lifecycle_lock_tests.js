'use strict';

const assert = require('assert');
const crypto = require('crypto');
const { AUTHORITY, stableStringify } = require('../../src/qualification/canonical-baseline-registry');
const { STATUS: P65_STATUS } = require('../../src/qualification/successor-fresh-independent-review-handoff');
const {
  PURPOSE,
  DECISION: P66_DECISION,
  designationCore,
  reviewPacketCore,
  normalizeSuccessorReviewerRegistry,
  createSuccessorFreshReviewSigningPayload,
  verifySuccessorFreshReviewAttestation,
} = require('../../src/qualification/successor-fresh-review-attestation');
const {
  STATUS,
  createSuccessorFreshReviewerLifecycleLock,
} = require('../../src/qualification/successor-fresh-reviewer-lifecycle-lock');
const { parseArgs } = require('../../tools/successor-fresh-reviewer-lifecycle-lock');

function sha256Text(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}
function sha256Object(value) {
  return sha256Text(stableStringify(value));
}
function h(label) {
  return sha256Text(`p67:${label}`);
}
function authorityFalse() {
  return Object.fromEntries(Object.keys(AUTHORITY).map((key) => [key, false]));
}

function buildPacket() {
  const designation = {
    schemaVersion: 1,
    designationId: 'successor-designation-001',
    cycleId: 'successor-cycle-002',
    successorFreshReactivationGovernanceCycleHashSha256: h('cycle'),
    designatedByRef: 'owner:successor',
    reviewerRef: 'reviewer:successor-independent',
    reviewerDisplayName: 'Successor Independent Reviewer',
    designatedAt: '2026-09-10T19:20:00.000Z',
    designationSourceRef: 'governance://successor-reviewer-designation/001',
    designationArtifactSha256: h('designation-artifact'),
  };
  designation.successorFreshReviewerDesignationHashSha256 = sha256Object(designationCore(designation));

  const core = {
    schemaVersion: 1,
    reviewRequestId: 'successor-review-request-001',
    requestedAt: '2026-09-10T19:21:00.000Z',
    cycleId: designation.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: designation.successorFreshReactivationGovernanceCycleHashSha256,
    ownerActorRef: designation.designatedByRef,
    currentAuthoritativeMode: 'LEGACY_FILE_SHA256',
    currentRegistryHashSha256: h('legacy-logical'),
    currentRegistryContentSha256: h('legacy-content'),
    requestedTargetMode: 'GOVERNED_COMPOSITE_BASELINE',
    qualifiedSourceCommitSha: 'a'.repeat(40),
    releaseArtifactSha256: h('release-artifact'),
    environmentConfigSha256: h('environment-config'),
    cycleEvidenceArtifactSha256: h('cycle-evidence'),
    predecessorIncidentCloseoutPacketHashSha256: h('predecessor-closeout'),
    predecessorHumanDecisionRecordHashSha256: h('predecessor-human-decision'),
    predecessorGovernanceResetRecordHashSha256: h('predecessor-reset'),
    predecessorRootCauseAnalysisSha256: h('predecessor-rca'),
    predecessorCorrectivePreventiveActionSha256: h('predecessor-capa'),
    successorFreshReviewerDesignationHashSha256: designation.successorFreshReviewerDesignationHashSha256,
    independentReviewerRef: designation.reviewerRef,
    reviewerDisplayName: designation.reviewerDisplayName,
    reviewChecklist: Object.freeze(['CONFIRM_SUCCESSOR_SCOPE', 'CONFIRM_NO_PREDECESSOR_AUTHORITY_REUSE']),
  };
  const packet = {
    ...core,
    status: P65_STATUS.SUCCESSOR_FRESH_REVIEW_PACKET_READY_NOT_APPROVED,
    verified: true,
    blockers: Object.freeze([]),
    successorFreshReviewerDesignation: designation,
    successorFreshReviewPacketHashSha256: sha256Object(reviewPacketCore(core)),
    reviewPacketReady: true,
    successorFreshReviewerDesignated: true,
    ownerMayReplaceReviewerBeforeVerifiedReview: true,
    replacementRequiresNewDesignationAndReviewPacket: true,
    reviewerIdentityCryptographicallyVerified: false,
    reviewerTrustRootVerified: false,
    independentReviewAccepted: false,
    successorFreshCryptographicReviewAttestationRequired: true,
    successorFreshReviewerLifecycleLockRequired: true,
    predecessorReviewerAuthorityAccepted: false,
    predecessorActivationAuthorityAccepted: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    releaseStillBlocked: true,
    ...authorityFalse(),
  };
  return packet;
}

function makeReviewFixture(packet) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const reviewerRegistry = {
    schemaVersion: 1,
    registryId: 'successor-reviewer-registry-001',
    governanceArtifactSha256: h('reviewer-registry-governance'),
    reviewers: [{
      reviewerId: 'successor-reviewer-001',
      reviewerSubjectRef: packet.independentReviewerRef,
      publicKeyPem: String(publicKey).trim(),
      publicKeySha256: sha256Text(String(publicKey).trim()),
      governanceEvidenceRef: 'governance://successor-reviewer-trust/001',
      activeFrom: '2026-09-10T18:00:00.000Z',
      activeUntil: '2026-09-11T18:00:00.000Z',
      allowedPurpose: PURPOSE,
    }],
  };
  const expectedReviewerRegistryHashSha256 = normalizeSuccessorReviewerRegistry(reviewerRegistry).successorReviewerRegistryHashSha256;

  function signDecision(decision) {
    const attestation = {
      decisionId: `successor-review-${decision === P66_DECISION.APPROVE ? 'approve' : 'reject'}-001`,
      reviewerId: 'successor-reviewer-001',
      actorRef: packet.independentReviewerRef,
      decision,
      decisionSourceRef: 'review://successor/decision/001',
      decisionArtifactSha256: h(`decision-artifact:${decision}`),
      reviewEvidenceRef: 'review://successor/evidence/001',
      reviewEvidenceSha256: h('review-evidence'),
      decidedAt: '2026-09-10T19:30:00.000Z',
      rationaleRef: 'review://successor/rationale/001',
      signatureAlgorithm: 'RSA-SHA256',
    };
    const payload = createSuccessorFreshReviewSigningPayload({ packet, attestation });
    const signatureBase64 = crypto.sign(
      'RSA-SHA256',
      Buffer.from(stableStringify(payload), 'utf8'),
      privateKey,
    ).toString('base64');
    const signedAttestation = { ...attestation, signatureBase64 };
    const verifiedReview = verifySuccessorFreshReviewAttestation({
      packet,
      reviewerRegistry,
      expectedReviewerRegistryHashSha256,
      attestation: signedAttestation,
    });
    return { signedAttestation, verifiedReview };
  }

  return { reviewerRegistry, expectedReviewerRegistryHashSha256, signDecision };
}

(function run() {
  const packet = buildPacket();
  const fixture = makeReviewFixture(packet);
  const approved = fixture.signDecision(P66_DECISION.APPROVE);
  const baseInput = {
    packet,
    verifiedReview: approved.verifiedReview,
    reviewerRegistry: fixture.reviewerRegistry,
    expectedReviewerRegistryHashSha256: fixture.expectedReviewerRegistryHashSha256,
    signedAttestation: approved.signedAttestation,
    lockId: 'successor-reviewer-lock-001',
    lockOperatorRef: 'governance-operator:successor',
    lockedAt: '2026-09-10T19:31:00.000Z',
  };

  const result = createSuccessorFreshReviewerLifecycleLock(baseInput);
  assert.strictEqual(result.status, STATUS.SUCCESSOR_FRESH_REVIEWER_LOCKED_BY_VERIFIED_REVIEW);
  assert.strictEqual(result.verified, true);
  assert.strictEqual(result.p66ReviewRecomputed, true);
  assert.strictEqual(result.successorFreshReviewerLifecycleLocked, true);
  assert.strictEqual(result.reviewerReplacementAllowedNow, false);
  assert.strictEqual(result.acceptedVerifiedReviewFreezesReviewerReplacement, true);
  assert.strictEqual(result.independentReviewCompleted, true);
  assert.strictEqual(result.successorFreshActivationPlanRequired, true);
  assert.strictEqual(result.reactivationAuthorized, false);
  assert.strictEqual(result.currentBaselineMutationPerformed, false);
  assert.strictEqual(result.releaseStillBlocked, true);
  for (const key of Object.keys(AUTHORITY)) assert.strictEqual(result[key], false);
  assert.match(result.successorFreshReviewerLifecycleLockHashSha256, /^[a-f0-9]{64}$/);
  assert.strictEqual(
    createSuccessorFreshReviewerLifecycleLock(baseInput).successorFreshReviewerLifecycleLockHashSha256,
    result.successorFreshReviewerLifecycleLockHashSha256,
  );

  const rejected = fixture.signDecision(P66_DECISION.REJECT);
  const rejectionLock = createSuccessorFreshReviewerLifecycleLock({
    ...baseInput,
    verifiedReview: rejected.verifiedReview,
    signedAttestation: rejected.signedAttestation,
  });
  assert.strictEqual(rejectionLock.status, STATUS.HOLD_SUCCESSOR_FRESH_REVIEWER_LIFECYCLE);
  assert(rejectionLock.blockers.includes('P66_APPROVED_CRYPTOGRAPHICALLY_VERIFIED_REVIEW_REQUIRED'));

  const badSignature = createSuccessorFreshReviewerLifecycleLock({
    ...baseInput,
    signedAttestation: { ...approved.signedAttestation, signatureBase64: Buffer.from('not-a-valid-signature').toString('base64') },
  });
  assert.strictEqual(badSignature.status, STATUS.HOLD_SUCCESSOR_FRESH_REVIEWER_LIFECYCLE);
  assert(badSignature.blockers.includes('P66_APPROVED_CRYPTOGRAPHICALLY_VERIFIED_REVIEW_REQUIRED'));

  const tamperedReview = JSON.parse(JSON.stringify(approved.verifiedReview));
  tamperedReview.verifiedSuccessorFreshReviewRecordHashSha256 = h('tampered-review-record');
  const tamperedReviewLock = createSuccessorFreshReviewerLifecycleLock({ ...baseInput, verifiedReview: tamperedReview });
  assert.strictEqual(tamperedReviewLock.status, STATUS.HOLD_SUCCESSOR_FRESH_REVIEWER_LIFECYCLE);
  assert(tamperedReviewLock.blockers.includes('P66_REVIEW_RECORD_HASH_MISMATCH'));

  const tamperedPacket = JSON.parse(JSON.stringify(packet));
  tamperedPacket.reviewerDisplayName = 'Tampered Reviewer';
  const packetLock = createSuccessorFreshReviewerLifecycleLock({ ...baseInput, packet: tamperedPacket });
  assert.strictEqual(packetLock.status, STATUS.HOLD_SUCCESSOR_FRESH_REVIEWER_LIFECYCLE);

  const earlyLock = createSuccessorFreshReviewerLifecycleLock({ ...baseInput, lockedAt: '2026-09-10T19:29:59.000Z' });
  assert.strictEqual(earlyLock.status, STATUS.HOLD_SUCCESSOR_FRESH_REVIEWER_LIFECYCLE);
  assert(earlyLock.blockers.includes('SUCCESSOR_FRESH_REVIEWER_LOCK_PRECEDES_VERIFIED_REVIEW_DECISION'));

  const escalation = createSuccessorFreshReviewerLifecycleLock({ ...baseInput, releaseAuthorized: true });
  assert.strictEqual(escalation.status, STATUS.HOLD_SUCCESSOR_FRESH_REVIEWER_LIFECYCLE);
  assert(escalation.blockers.includes('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED'));

  const keyMaterial = createSuccessorFreshReviewerLifecycleLock({ ...baseInput, privateKeyPem: 'forbidden' });
  assert.strictEqual(keyMaterial.status, STATUS.HOLD_SUCCESSOR_FRESH_REVIEWER_LIFECYCLE);
  assert(keyMaterial.blockers.some((item) => item.startsWith('PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:')));

  assert.throws(() => parseArgs(['--packet', 'a.json', '--packet', 'b.json']), /duplicate argument/);
  assert.throws(() => parseArgs(['--unknown', 'x']), /unknown argument/);
  assert.throws(() => parseArgs(['--private-key', 'secret.pem']), /private or secret key argument rejected/);

  process.stdout.write('P67 successor fresh reviewer lifecycle lock tests passed\n');
})();
