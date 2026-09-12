'use strict';

const assert = require('assert');
const crypto = require('crypto');
const path = require('path');
const { spawnSync } = require('child_process');
const { MODE, stableStringify } = require('../../src/qualification/canonical-baseline-registry');
const { STATUS: P46_STATUS } = require('../../src/qualification/fresh-reactivation-governance-cycle');
const { createFreshReactivationIndependentReviewHandoff } = require('../../src/qualification/fresh-reactivation-independent-review-handoff');
const {
  PURPOSE,
  DECISION,
  STATUS,
  normalizeReviewerRegistry,
  prepareFreshReactivationReviewAttestation,
  verifyFreshReactivationReviewAttestation,
} = require('../../src/qualification/fresh-reactivation-review-attestation');

const hashText = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const hashObject = (value) => hashText(stableStringify(value));

function p46Fixture() {
  const core = {
    schemaVersion: 1,
    cycleId: 'reactivation-cycle:p48-001',
    ownerActorRef: 'owner:p48',
    preparedAt: '2026-09-10T12:00:00.000Z',
    currentAuthoritativeMode: MODE.LEGACY_FILE_SHA256,
    currentRegistryHashSha256: '1'.repeat(64),
    requestedTargetMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    qualifiedSourceCommitSha: 'a'.repeat(40),
    releaseArtifactSha256: '2'.repeat(64),
    environmentConfigSha256: '3'.repeat(64),
    cycleRationaleRef: 'rationale:p48-cycle',
    cycleEvidenceArtifactSha256: '4'.repeat(64),
    priorGovernanceResetRecordHashSha256: '5'.repeat(64),
    priorHumanDecisionRecordHashSha256: '6'.repeat(64),
  };
  return {
    ...core,
    status: P46_STATUS.FRESH_REACTIVATION_GOVERNANCE_CYCLE_OPEN_NOT_AUTHORIZED,
    verified: true,
    blockers: [],
    freshReactivationGovernanceCycleHashSha256: hashObject(core),
    freshGovernanceCycleOpened: true,
    priorReviewerApprovalAccepted: false,
    priorActivationAuthorizationAccepted: false,
    priorActivationPlanAccepted: false,
    priorActivationContractAccepted: false,
    freshIndependentReviewerDesignationRequired: true,
    freshIndependentReviewRequired: true,
    freshReviewerLifecycleLockRequired: true,
    freshActivationPlanRequired: true,
    freshCutoverSafetyEvidenceRequired: true,
    freshOwnerActivationAuthorizationRequired: true,
    freshActivationChangeContractRequired: true,
    postActivationReleaseVerifyRequired: true,
    incidentClosureTreatedAsReleaseAuthorization: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    releaseStillBlocked: true,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    goLiveAuthorized: false,
    transactionAuthorized: false,
  };
}

function packetFixture() {
  const p46 = p46Fixture();
  return createFreshReactivationIndependentReviewHandoff({
    p46,
    reviewerDesignation: {
      designationId: 'fresh-reviewer-designation:p48-001',
      designatedByRef: p46.ownerActorRef,
      reviewerRef: 'reviewer:p48-independent',
      reviewerDisplayName: 'Independent Reviewer P48',
      designatedAt: '2026-09-10T12:05:00.000Z',
      designationSourceRef: 'governance:p48-reviewer-designation',
      designationArtifactSha256: '7'.repeat(64),
    },
    reviewRequestId: 'fresh-review-request:p48-001',
    requestedAt: '2026-09-10T12:10:00.000Z',
  });
}

function registryFixture({ reviewerSubjectRef = 'reviewer:p48-independent', purpose = PURPOSE, activeFrom = '2026-09-01T00:00:00.000Z', activeUntil = '2026-12-31T23:59:59.000Z' } = {}) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyPem = String(publicKey.export({ type: 'spki', format: 'pem' })).trim();
  const registry = {
    registryId: 'fresh-reviewer-registry:p48',
    governanceArtifactSha256: '8'.repeat(64),
    reviewers: [{
      reviewerId: 'fresh-reviewer-id:p48',
      reviewerSubjectRef,
      publicKeyPem,
      publicKeySha256: hashText(publicKeyPem),
      governanceEvidenceRef: 'governance:fresh-reviewer:p48',
      activeFrom,
      activeUntil,
      allowedPurpose: purpose,
    }],
  };
  const normalized = normalizeReviewerRegistry(registry);
  return { registry, expectedHash: normalized.reviewerRegistryHashSha256, privateKey };
}

function attestationFixture(decision = DECISION.APPROVE) {
  return {
    reviewRequestId: 'fresh-review-request:p48-001',
    decisionId: `fresh-review-decision:${decision}`,
    reviewerId: 'fresh-reviewer-id:p48',
    actorRef: 'reviewer:p48-independent',
    decision,
    decisionSourceRef: 'review-decision:p48',
    decisionArtifactSha256: '9'.repeat(64),
    reviewEvidenceRef: 'review-evidence:p48',
    reviewEvidenceSha256: 'b'.repeat(64),
    decidedAt: '2026-09-10T12:15:00.000Z',
    rationaleRef: 'rationale:fresh-review:p48',
    signatureAlgorithm: 'RSA-SHA256',
  };
}

function sign(packet, registry, attestation) {
  const prepared = prepareFreshReactivationReviewAttestation({
    packet,
    reviewerRegistry: registry.registry,
    expectedReviewerRegistryHashSha256: registry.expectedHash,
    attestation,
  });
  assert.strictEqual(prepared.status, STATUS.READY_FOR_EXTERNAL_FRESH_REVIEW_SIGNATURE);
  const signatureBase64 = crypto.sign(
    'RSA-SHA256',
    Buffer.from(stableStringify(prepared.signingPayload), 'utf8'),
    registry.privateKey,
  ).toString('base64');
  return { prepared, signed: { ...prepared.attestationWithoutSignature, signatureBase64 } };
}

(() => {
  const packet = packetFixture();
  const registry = registryFixture();
  const approval = sign(packet, registry, attestationFixture());
  const approved = verifyFreshReactivationReviewAttestation({
    packet,
    reviewerRegistry: registry.registry,
    expectedReviewerRegistryHashSha256: registry.expectedHash,
    attestation: approval.signed,
  });
  assert.strictEqual(approved.status, STATUS.FRESH_REACTIVATION_REVIEW_APPROVED_CRYPTOGRAPHICALLY_VERIFIED);
  assert.strictEqual(approved.verified, true);
  assert.strictEqual(approved.freshReviewAccepted, true);
  assert.strictEqual(approved.reviewerIdentityCryptographicallyVerified, true);
  assert.strictEqual(approved.reviewerTrustRootVerified, true);
  assert.strictEqual(approved.reviewAttestationSignatureVerified, true);
  assert.strictEqual(approved.freshReviewerLifecycleLockRequired, true);
  assert.strictEqual(approved.reactivationAuthorized, false);
  assert.strictEqual(approved.releaseAuthorized, false);

  const rejection = sign(packet, registry, attestationFixture(DECISION.REJECT));
  const rejected = verifyFreshReactivationReviewAttestation({
    packet,
    reviewerRegistry: registry.registry,
    expectedReviewerRegistryHashSha256: registry.expectedHash,
    attestation: rejection.signed,
  });
  assert.strictEqual(rejected.status, STATUS.FRESH_REACTIVATION_REVIEW_REJECTED_CYCLE_BLOCKED);
  assert.strictEqual(rejected.freshReviewRejected, true);
  assert.strictEqual(rejected.cycleBlockedByReview, true);
  assert.strictEqual(rejected.reactivationAuthorized, false);

  const packetTamper = JSON.parse(JSON.stringify(packet));
  packetTamper.releaseArtifactSha256 = 'c'.repeat(64);
  const tampered = prepareFreshReactivationReviewAttestation({
    packet: packetTamper,
    reviewerRegistry: registry.registry,
    expectedReviewerRegistryHashSha256: registry.expectedHash,
    attestation: attestationFixture(),
  });
  assert.strictEqual(tampered.status, STATUS.HOLD_FRESH_REACTIVATION_REVIEW_PACKET);
  assert(tampered.blockers.includes('P47_REVIEW_PACKET_HASH_MISMATCH'));

  const badTrust = prepareFreshReactivationReviewAttestation({
    packet,
    reviewerRegistry: registry.registry,
    expectedReviewerRegistryHashSha256: '0'.repeat(64),
    attestation: attestationFixture(),
  });
  assert.strictEqual(badTrust.status, STATUS.HOLD_FRESH_REACTIVATION_REVIEW_TRUST_ROOT);
  assert(badTrust.blockers.includes('FRESH_REVIEWER_REGISTRY_HASH_MISMATCH'));

  const unknownReviewer = prepareFreshReactivationReviewAttestation({
    packet,
    reviewerRegistry: registry.registry,
    expectedReviewerRegistryHashSha256: registry.expectedHash,
    attestation: { ...attestationFixture(), reviewerId: 'unknown' },
  });
  assert.strictEqual(unknownReviewer.status, STATUS.HOLD_FRESH_REACTIVATION_REVIEW_ATTESTATION);
  assert(unknownReviewer.blockers.includes('REVIEWER_NOT_IN_FRESH_TRUST_REGISTRY'));

  const wrongSubjectRegistry = registryFixture({ reviewerSubjectRef: 'reviewer:other' });
  const wrongSubject = prepareFreshReactivationReviewAttestation({
    packet,
    reviewerRegistry: wrongSubjectRegistry.registry,
    expectedReviewerRegistryHashSha256: wrongSubjectRegistry.expectedHash,
    attestation: attestationFixture(),
  });
  assert.strictEqual(wrongSubject.status, STATUS.HOLD_FRESH_REACTIVATION_REVIEW_ATTESTATION);
  assert(wrongSubject.blockers.includes('FRESH_REVIEWER_SUBJECT_SCOPE_MISMATCH'));

  const wrongPurposeRegistry = registryFixture({ purpose: 'OTHER_PURPOSE' });
  const wrongPurpose = prepareFreshReactivationReviewAttestation({
    packet,
    reviewerRegistry: wrongPurposeRegistry.registry,
    expectedReviewerRegistryHashSha256: wrongPurposeRegistry.expectedHash,
    attestation: attestationFixture(),
  });
  assert.strictEqual(wrongPurpose.status, STATUS.HOLD_FRESH_REACTIVATION_REVIEW_ATTESTATION);
  assert(wrongPurpose.blockers.includes('FRESH_REVIEWER_PURPOSE_NOT_ALLOWED'));

  const expiredRegistry = registryFixture({ activeUntil: '2026-09-10T12:14:59.000Z' });
  const expired = prepareFreshReactivationReviewAttestation({
    packet,
    reviewerRegistry: expiredRegistry.registry,
    expectedReviewerRegistryHashSha256: expiredRegistry.expectedHash,
    attestation: attestationFixture(),
  });
  assert.strictEqual(expired.status, STATUS.HOLD_FRESH_REACTIVATION_REVIEW_ATTESTATION);
  assert(expired.blockers.includes('FRESH_REVIEWER_OUTSIDE_ACTIVE_PERIOD'));

  const early = prepareFreshReactivationReviewAttestation({
    packet,
    reviewerRegistry: registry.registry,
    expectedReviewerRegistryHashSha256: registry.expectedHash,
    attestation: { ...attestationFixture(), decidedAt: '2026-09-10T12:09:59.000Z' },
  });
  assert.strictEqual(early.status, STATUS.HOLD_FRESH_REACTIVATION_REVIEW_ATTESTATION);
  assert(early.blockers.includes('FRESH_REVIEW_DECISION_PRECEDES_REVIEW_REQUEST'));

  const wrongActor = prepareFreshReactivationReviewAttestation({
    packet,
    reviewerRegistry: registry.registry,
    expectedReviewerRegistryHashSha256: registry.expectedHash,
    attestation: { ...attestationFixture(), actorRef: 'reviewer:wrong' },
  });
  assert.strictEqual(wrongActor.status, STATUS.HOLD_FRESH_REACTIVATION_REVIEW_ATTESTATION);
  assert(wrongActor.blockers.includes('REVIEWER_ACTOR_MUST_MATCH_P47_DESIGNATION'));

  const badSignature = verifyFreshReactivationReviewAttestation({
    packet,
    reviewerRegistry: registry.registry,
    expectedReviewerRegistryHashSha256: registry.expectedHash,
    attestation: { ...approval.signed, signatureBase64: Buffer.from('invalid').toString('base64') },
  });
  assert.strictEqual(badSignature.status, STATUS.HOLD_FRESH_REACTIVATION_REVIEW_ATTESTATION);
  assert(badSignature.blockers.includes('FRESH_REVIEW_SIGNATURE_INVALID'));

  const tamperedEvidence = verifyFreshReactivationReviewAttestation({
    packet,
    reviewerRegistry: registry.registry,
    expectedReviewerRegistryHashSha256: registry.expectedHash,
    attestation: { ...approval.signed, reviewEvidenceSha256: 'd'.repeat(64) },
  });
  assert.strictEqual(tamperedEvidence.status, STATUS.HOLD_FRESH_REACTIVATION_REVIEW_ATTESTATION);
  assert(tamperedEvidence.blockers.includes('FRESH_REVIEW_SIGNATURE_INVALID'));

  const authorityEscalation = verifyFreshReactivationReviewAttestation({
    packet,
    reviewerRegistry: registry.registry,
    expectedReviewerRegistryHashSha256: registry.expectedHash,
    attestation: approval.signed,
    releaseAuthorized: true,
  });
  assert.strictEqual(authorityEscalation.status, STATUS.HOLD_FRESH_REACTIVATION_REVIEW_ATTESTATION);
  assert(authorityEscalation.blockers.includes('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED'));

  const privateKey = prepareFreshReactivationReviewAttestation({
    packet,
    reviewerRegistry: registry.registry,
    expectedReviewerRegistryHashSha256: registry.expectedHash,
    attestation: attestationFixture(),
    privateKeyPem: 'forbidden',
  });
  assert.strictEqual(privateKey.status, STATUS.HOLD_FRESH_REACTIVATION_REVIEW_ATTESTATION);
  assert(privateKey.blockers.includes('PRIVATE_SIGNING_KEY_INPUT_REJECTED'));

  const cli = path.join(__dirname, '..', '..', 'tools', 'fresh-reactivation-review-attestation.js');
  const cliPrivateKey = spawnSync(process.execPath, [cli, '--private-key', 'forbidden'], { encoding: 'utf8' });
  assert.strictEqual(cliPrivateKey.status, 1);
  assert(cliPrivateKey.stderr.includes('private signing key argument rejected'));

  const cliDuplicate = spawnSync(process.execPath, [cli, '--mode', 'prepare', '--mode', 'verify'], { encoding: 'utf8' });
  assert.strictEqual(cliDuplicate.status, 1);
  assert(cliDuplicate.stderr.includes('duplicate argument'));

  console.log('P48 fresh reactivation review attestation: PASS');
})();
