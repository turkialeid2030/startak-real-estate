'use strict';

const assert = require('assert');
const crypto = require('crypto');
const { MODE, AUTHORITY, stableStringify } = require('../../src/qualification/canonical-baseline-registry');
const { STATUS: P64_STATUS } = require('../../src/qualification/successor-fresh-reactivation-governance-cycle');
const {
  p64CycleCore,
  createSuccessorFreshIndependentReviewHandoff,
} = require('../../src/qualification/successor-fresh-independent-review-handoff');
const {
  PURPOSE,
  DECISION,
  STATUS,
  normalizeSuccessorReviewerRegistry,
  createSuccessorFreshReviewSigningPayload,
  prepareSuccessorFreshReviewAttestation,
  verifySuccessorFreshReviewAttestation,
} = require('../../src/qualification/successor-fresh-review-attestation');

const hashText = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const hashObject = (value) => hashText(stableStringify(value));
const h = (char) => char.repeat(64);

function p64Fixture() {
  const core = {
    schemaVersion: 1,
    cycleKind: 'SUCCESSOR_FRESH_REACTIVATION_AFTER_FRESH_INCIDENT',
    cycleId: 'cycle:p66-successor',
    ownerActorRef: 'owner:p66',
    preparedAt: '2026-09-10T19:00:00.000Z',
    currentAuthoritativeMode: MODE.LEGACY_FILE_SHA256,
    currentRegistryHashSha256: h('1'),
    currentRegistryContentSha256: h('2'),
    requestedTargetMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    qualifiedSourceCommitSha: 'a'.repeat(40),
    releaseArtifactSha256: h('3'),
    environmentConfigSha256: h('4'),
    cycleRationaleRef: 'rationale:p66',
    cycleEvidenceArtifactSha256: h('5'),
    predecessorIncidentCloseoutPacketHashSha256: h('6'),
    predecessorHumanDecisionRecordHashSha256: h('7'),
    predecessorGovernanceResetRecordHashSha256: h('8'),
    predecessorRootCauseAnalysisSha256: h('9'),
    predecessorCorrectivePreventiveActionSha256: h('b'),
  };
  const cycleHash = hashObject(core);
  const p64 = {
    ...core,
    status: P64_STATUS.SUCCESSOR_FRESH_REACTIVATION_GOVERNANCE_CYCLE_OPEN_NOT_AUTHORIZED,
    verified: true,
    blockers: [],
    successorFreshReactivationGovernanceCycleHashSha256: cycleHash,
    successorFreshGovernanceCycleOpened: true,
    predecessorP63Reverified: true,
    predecessorFailedFreshCycleHistoricalOnly: true,
    predecessorFreshReviewerArtifactsAccepted: false,
    predecessorFreshOwnerAuthorizationAccepted: false,
    predecessorFreshActivationPlanAccepted: false,
    predecessorFreshActivationContractAccepted: false,
    predecessorFreshRollbackEvidenceAcceptedAsAuthority: false,
    freshIndependentReviewerDesignationRequired: true,
    freshIndependentReviewRequired: true,
    freshReviewerLifecycleLockRequired: true,
    freshActivationPlanRequired: true,
    freshShadowEvidenceRequired: true,
    freshCutoverRehearsalRequired: true,
    freshCutoverSafetyEvidenceRequired: true,
    freshOwnerActivationAuthorizationRequired: true,
    freshActivationChangeContractRequired: true,
    postActivationReleaseVerifyRequired: true,
    incidentClosureTreatedAsReleaseAuthorization: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    releaseStillBlocked: true,
    ...AUTHORITY,
  };
  assert.strictEqual(hashObject(p64CycleCore(p64)), cycleHash);
  return p64;
}

function packetFixture() {
  const p64 = p64Fixture();
  const packet = createSuccessorFreshIndependentReviewHandoff({
    p64,
    reviewerDesignation: {
      designationId: 'designation:p66',
      designatedByRef: p64.ownerActorRef,
      reviewerRef: 'reviewer:p66',
      reviewerDisplayName: 'Successor Reviewer P66',
      designatedAt: '2026-09-10T19:05:00.000Z',
      designationSourceRef: 'designation-source:p66',
      designationArtifactSha256: h('c'),
    },
    reviewRequestId: 'review-request:p66',
    requestedAt: '2026-09-10T19:10:00.000Z',
  });
  assert.strictEqual(packet.verified, true);
  return packet;
}

function registryFixture(subjectRef = 'reviewer:p66', overrides = {}) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyPem = String(publicKey.export({ type: 'spki', format: 'pem' })).trim();
  const registry = {
    schemaVersion: 1,
    registryId: 'successor-reviewer-registry:p66',
    governanceArtifactSha256: h('d'),
    reviewers: [{
      reviewerId: 'reviewer-id:p66',
      reviewerSubjectRef: subjectRef,
      publicKeyPem,
      publicKeySha256: hashText(publicKeyPem),
      governanceEvidenceRef: 'governance:reviewer:p66',
      activeFrom: '2026-09-10T00:00:00.000Z',
      activeUntil: '2026-09-11T00:00:00.000Z',
      allowedPurpose: PURPOSE,
      ...overrides,
    }],
  };
  return { privateKey, registry, hash: normalizeSuccessorReviewerRegistry(registry).successorReviewerRegistryHashSha256 };
}

function attestation(packet, decision = DECISION.APPROVE, overrides = {}) {
  return {
    reviewRequestId: packet.reviewRequestId,
    reviewPacketHashSha256: packet.successorFreshReviewPacketHashSha256,
    decisionId: `decision:p66:${decision}`,
    reviewerId: 'reviewer-id:p66',
    actorRef: packet.independentReviewerRef,
    decision,
    decisionSourceRef: 'decision-source:p66',
    decisionArtifactSha256: h('e'),
    reviewEvidenceRef: 'review-evidence:p66',
    reviewEvidenceSha256: h('f'),
    decidedAt: '2026-09-10T19:15:00.000Z',
    rationaleRef: 'rationale:review:p66',
    signatureAlgorithm: 'RSA-SHA256',
    ...overrides,
  };
}

function sign(packet, unsigned, privateKey) {
  const payload = createSuccessorFreshReviewSigningPayload({ packet, attestation: unsigned });
  return { ...unsigned, signatureBase64: crypto.sign('RSA-SHA256', Buffer.from(stableStringify(payload), 'utf8'), privateKey).toString('base64') };
}

(() => {
  const packet = packetFixture();
  const trust = registryFixture();
  const unsigned = attestation(packet);
  const prepared = prepareSuccessorFreshReviewAttestation({ packet, reviewerRegistry: trust.registry, expectedReviewerRegistryHashSha256: trust.hash, attestation: unsigned });
  assert.strictEqual(prepared.status, STATUS.READY_FOR_EXTERNAL_SUCCESSOR_FRESH_REVIEW_SIGNATURE);
  assert.strictEqual(prepared.verified, true);
  assert.strictEqual(prepared.externalSignatureRequired, true);
  assert.strictEqual(prepared.privateSigningKeyAccepted, false);
  assert.strictEqual(prepared.successorFreshReviewAccepted, false);
  assert.strictEqual(prepared.reactivationAuthorized, false);

  const signed = sign(packet, unsigned, trust.privateKey);
  const approved = verifySuccessorFreshReviewAttestation({ packet, reviewerRegistry: trust.registry, expectedReviewerRegistryHashSha256: trust.hash, attestation: signed });
  assert.strictEqual(approved.status, STATUS.SUCCESSOR_FRESH_REVIEW_APPROVED_CRYPTOGRAPHICALLY_VERIFIED);
  assert.strictEqual(approved.verified, true);
  assert.strictEqual(approved.successorFreshReviewAccepted, true);
  assert.strictEqual(approved.successorFreshReviewRejected, false);
  assert.strictEqual(approved.cycleBlockedByReview, false);
  assert.strictEqual(approved.reviewerIdentityCryptographicallyVerified, true);
  assert.strictEqual(approved.reviewerTrustRootVerified, true);
  assert.strictEqual(approved.reviewAttestationSignatureVerified, true);
  assert.strictEqual(approved.successorFreshReviewerLifecycleLockRequired, true);
  assert.strictEqual(approved.successorFreshActivationPlanRequired, true);
  assert.strictEqual(approved.reactivationAuthorized, false);
  assert.strictEqual(approved.releaseAuthorized, false);
  assert.match(approved.verifiedSuccessorFreshReviewRecordHashSha256, /^[a-f0-9]{64}$/);

  const again = verifySuccessorFreshReviewAttestation({ packet, reviewerRegistry: trust.registry, expectedReviewerRegistryHashSha256: trust.hash, attestation: signed });
  assert.strictEqual(again.verifiedSuccessorFreshReviewRecordHashSha256, approved.verifiedSuccessorFreshReviewRecordHashSha256);

  const rejectUnsigned = attestation(packet, DECISION.REJECT);
  const rejected = verifySuccessorFreshReviewAttestation({ packet, reviewerRegistry: trust.registry, expectedReviewerRegistryHashSha256: trust.hash, attestation: sign(packet, rejectUnsigned, trust.privateKey) });
  assert.strictEqual(rejected.status, STATUS.SUCCESSOR_FRESH_REVIEW_REJECTED_CYCLE_BLOCKED);
  assert.strictEqual(rejected.successorFreshReviewAccepted, false);
  assert.strictEqual(rejected.successorFreshReviewRejected, true);
  assert.strictEqual(rejected.cycleBlockedByReview, true);
  assert.strictEqual(rejected.successorFreshReviewerLifecycleLockRequired, false);
  assert.strictEqual(rejected.successorFreshActivationPlanRequired, false);

  const badSignature = verifySuccessorFreshReviewAttestation({ packet, reviewerRegistry: trust.registry, expectedReviewerRegistryHashSha256: trust.hash, attestation: { ...signed, signatureBase64: Buffer.from('bad').toString('base64') } });
  assert(badSignature.blockers.includes('SUCCESSOR_FRESH_REVIEW_SIGNATURE_INVALID'));

  const wrongHash = verifySuccessorFreshReviewAttestation({ packet, reviewerRegistry: trust.registry, expectedReviewerRegistryHashSha256: h('0'), attestation: signed });
  assert(wrongHash.blockers.includes('SUCCESSOR_FRESH_REVIEWER_REGISTRY_HASH_MISMATCH'));

  const wrongSubject = registryFixture('reviewer:other');
  const wrongSubjectSigned = sign(packet, unsigned, wrongSubject.privateKey);
  const subjectFailure = verifySuccessorFreshReviewAttestation({ packet, reviewerRegistry: wrongSubject.registry, expectedReviewerRegistryHashSha256: wrongSubject.hash, attestation: wrongSubjectSigned });
  assert(subjectFailure.blockers.includes('SUCCESSOR_FRESH_REVIEWER_SUBJECT_SCOPE_MISMATCH'));

  const expiredTrust = registryFixture('reviewer:p66', { activeUntil: '2026-09-10T19:14:00.000Z' });
  const expiredSigned = sign(packet, unsigned, expiredTrust.privateKey);
  const expired = verifySuccessorFreshReviewAttestation({ packet, reviewerRegistry: expiredTrust.registry, expectedReviewerRegistryHashSha256: expiredTrust.hash, attestation: expiredSigned });
  assert(expired.blockers.includes('SUCCESSOR_FRESH_REVIEWER_OUTSIDE_ACTIVE_PERIOD'));

  const early = prepareSuccessorFreshReviewAttestation({ packet, reviewerRegistry: trust.registry, expectedReviewerRegistryHashSha256: trust.hash, attestation: attestation(packet, DECISION.APPROVE, { decidedAt: '2026-09-10T19:09:59.000Z' }) });
  assert(early.blockers.includes('SUCCESSOR_FRESH_REVIEW_DECISION_PRECEDES_REVIEW_REQUEST'));

  const tamperedPacket = JSON.parse(JSON.stringify(packet));
  tamperedPacket.environmentConfigSha256 = h('0');
  const tampered = prepareSuccessorFreshReviewAttestation({ packet: tamperedPacket, reviewerRegistry: trust.registry, expectedReviewerRegistryHashSha256: trust.hash, attestation: unsigned });
  assert(tampered.blockers.includes('P65_SUCCESSOR_FRESH_REVIEW_PACKET_HASH_MISMATCH'));

  const escalation = verifySuccessorFreshReviewAttestation({ packet, reviewerRegistry: trust.registry, expectedReviewerRegistryHashSha256: trust.hash, attestation: signed, releaseAuthorized: true });
  assert(escalation.blockers.includes('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED'));

  const secret = verifySuccessorFreshReviewAttestation({ packet, reviewerRegistry: trust.registry, expectedReviewerRegistryHashSha256: trust.hash, attestation: { ...signed, privateKeyPem: 'forbidden' } });
  assert(secret.blockers.some((code) => code.startsWith('PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED')));

  process.stdout.write('successor fresh review attestation tests passed\n');
})();
