'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { AUTHORITY, stableStringify } = require('../../src/qualification/canonical-baseline-registry');
const { STATUS: P62_STATUS } = require('../../src/qualification/fresh-post-rollback-verification-incident-closeout');
const {
  PURPOSE,
  DECISION,
  STATUS,
  p62PacketCore,
  normalizeFreshIncidentAuthorityRegistry,
  createFreshIncidentCloseoutSigningPayload,
  prepareFreshIncidentCloseoutSigningPackage,
  verifyFreshHumanIncidentCloseoutDecision,
} = require('../../src/qualification/fresh-human-incident-closeout-decision');
const { parseArgs, safeReadJson } = require('../../tools/fresh-human-incident-closeout-decision');

const hashText = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const hashObject = (value) => hashText(stableStringify(value));
const h = (char) => char.repeat(64);

function p62Fixture() {
  const core = {
    schemaVersion: 1,
    incidentId: 'incident:p63',
    incidentRef: 'incident-ref:p63',
    closeoutPreparedByRef: 'preparer:p63',
    closeoutPreparedAt: '2026-09-10T17:00:00.000Z',
    cycleId: 'cycle:p63-failed',
    freshReactivationGovernanceCycleHashSha256: h('1'),
    freshActivationChangeContractHashSha256: h('2'),
    activationExecutionReceiptHashSha256: h('3'),
    rollbackTriggerHashSha256: h('4'),
    rollbackExecutionReceiptHashSha256: h('5'),
    restoredLegacyRegistryHashSha256: h('6'),
    restoredLegacyRegistryContentSha256: h('7'),
    postRollbackReleaseVerifyEvidenceHashSha256: h('8'),
    postRollbackReleaseVerifyRunId: 'run:p63-post-rollback',
    postRollbackReleaseVerifySourceCommitSha: 'a'.repeat(40),
    postRollbackReleaseVerifyCompletedAt: '2026-09-10T16:55:00.000Z',
    rollbackReasonCodes: ['POST_ACTIVATION_RELEASE_VERIFY_RESULT_NOT_PASS'],
  };
  const packetHash = hashObject(core);
  const packet = {
    ...core,
    incidentCloseoutPacketHashSha256: packetHash,
    restoredExactP57LegacyRegistry: true,
    postRollbackReleaseVerifyEvidenceConsistent: true,
    incidentCloseoutReady: true,
    incidentClosed: false,
    humanIncidentCloseoutRequired: true,
    automaticIncidentCloseoutPerformed: false,
    failedFreshActivationCycleReusable: false,
    releaseStillBlocked: true,
    reactivationAllowed: false,
    reactivationRequiresNewGovernanceCycle: true,
    ...AUTHORITY,
  };
  assert.strictEqual(hashObject(p62PacketCore(packet)), packetHash);
  return {
    schemaVersion: 1,
    status: P62_STATUS.FRESH_POST_ROLLBACK_RELEASE_VERIFY_EVIDENCE_CONSISTENT_INCIDENT_CLOSEOUT_READY,
    verified: true,
    blockers: [],
    postRollbackVerificationHashSha256: packetHash,
    postRollbackVerificationPassed: true,
    restoredExactP57LegacyRegistry: true,
    rollbackTriggerVerified: true,
    rollbackExecutionVerified: true,
    postRollbackReleaseVerifyEvidenceConsistent: true,
    releaseVerifyEvidenceHashSha256: core.postRollbackReleaseVerifyEvidenceHashSha256,
    releaseVerifyEvidenceAuthenticityVerifiedHere: false,
    productionEvidenceEstablishedHere: false,
    incidentCloseoutReady: true,
    incidentClosed: false,
    humanIncidentCloseoutRequired: true,
    automaticIncidentCloseoutPerformed: false,
    incidentCloseoutPacket: packet,
    incidentCloseoutPacketHashSha256: packetHash,
    failedFreshActivationCycleReusable: false,
    reactivationAllowed: false,
    reactivationRequiresNewGovernanceCycle: true,
    releaseStillBlocked: true,
    existingReleaseGovernanceStillRequired: true,
    ...AUTHORITY,
  };
}

function closeDecision(p62, overrides = {}) {
  return {
    incidentId: p62.incidentCloseoutPacket.incidentId,
    incidentRef: p62.incidentCloseoutPacket.incidentRef,
    cycleId: p62.incidentCloseoutPacket.cycleId,
    incidentCloseoutPacketHashSha256: p62.incidentCloseoutPacketHashSha256,
    decisionId: 'decision:p63-close',
    incidentAuthorityId: 'incident-authority:p63',
    actorRef: 'incident-owner:p63',
    decision: DECISION.CLOSE_INCIDENT,
    decisionSourceRef: 'decision-source:p63',
    decisionArtifactSha256: h('9'),
    decidedAt: '2026-09-10T17:15:00.000Z',
    rationaleRef: 'rationale:p63',
    rootCauseAnalysisRef: 'rca:p63',
    rootCauseAnalysisSha256: h('b'),
    correctivePreventiveActionRef: 'capa:p63',
    correctivePreventiveActionSha256: h('c'),
    signatureAlgorithm: 'RSA-SHA256',
    ...overrides,
  };
}

function buildAuthority(actorRef = 'incident-owner:p63', activeUntil = '2026-09-11T00:00:00.000Z') {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyPem = String(publicKey.export({ type: 'spki', format: 'pem' })).trim();
  const registry = {
    schemaVersion: 1,
    registryId: 'fresh-incident-authority-registry:p63',
    governanceArtifactSha256: h('d'),
    authorities: [{
      incidentAuthorityId: 'incident-authority:p63',
      actorRef,
      publicKeyPem,
      publicKeySha256: hashText(publicKeyPem),
      governanceEvidenceRef: 'governance:p63-incident-authority',
      activeFrom: '2026-09-10T00:00:00.000Z',
      activeUntil,
      allowedPurpose: PURPOSE,
    }],
  };
  const normalized = normalizeFreshIncidentAuthorityRegistry(registry);
  return { privateKey, registry, registryHash: normalized.incidentAuthorityRegistryHashSha256 };
}

function signDecision(p62, decision, privateKey) {
  const payload = createFreshIncidentCloseoutSigningPayload({ p62, decision });
  return {
    ...decision,
    signatureBase64: crypto.sign('RSA-SHA256', Buffer.from(stableStringify(payload), 'utf8'), privateKey).toString('base64'),
  };
}

(() => {
  const p62 = p62Fixture();
  const authority = buildAuthority();
  const unsignedClose = closeDecision(p62);
  const signingPackage = prepareFreshIncidentCloseoutSigningPackage({ p62, decision: unsignedClose });
  assert.strictEqual(signingPackage.status, STATUS.READY_FOR_EXTERNAL_FRESH_INCIDENT_AUTHORITY_SIGNATURE);
  assert.strictEqual(signingPackage.verified, true);
  assert.strictEqual(signingPackage.externalSignatureRequired, true);
  assert.strictEqual(signingPackage.privateSigningKeyAccepted, false);
  assert.strictEqual(signingPackage.reactivationAllowed, false);

  const signedClose = signDecision(p62, unsignedClose, authority.privateKey);
  const closed = verifyFreshHumanIncidentCloseoutDecision({
    p62,
    incidentAuthorityRegistry: authority.registry,
    expectedIncidentAuthorityRegistryHashSha256: authority.registryHash,
    signedDecision: signedClose,
  });
  assert.strictEqual(closed.status, STATUS.FRESH_INCIDENT_CLOSED_BY_VERIFIED_HUMAN_DECISION_GOVERNANCE_RESET_REACTIVATION_BLOCKED);
  assert.strictEqual(closed.verified, true);
  assert.strictEqual(closed.incidentClosed, true);
  assert.strictEqual(closed.humanIncidentCloseoutDecisionVerified, true);
  assert.strictEqual(closed.incidentCloseoutSignatureVerified, true);
  assert.strictEqual(closed.governanceResetReady, true);
  assert.strictEqual(closed.governanceResetRecord.failedFreshActivationCycleArchived, true);
  assert.strictEqual(closed.failedFreshActivationCycleReusable, false);
  assert.strictEqual(closed.previousFreshOwnerAuthorizationReusable, false);
  assert.strictEqual(closed.previousFreshReviewerApprovalReusable, false);
  assert.strictEqual(closed.previousFreshActivationPlanReusable, false);
  assert.strictEqual(closed.previousFreshActivationContractReusable, false);
  assert.strictEqual(closed.reactivationAllowed, false);
  assert.strictEqual(closed.newGovernanceCycleRequired, true);
  assert.strictEqual(closed.releaseAuthorized, false);
  assert.match(closed.verifiedFreshIncidentCloseoutDecisionRecordHashSha256, /^[a-f0-9]{64}$/);
  assert.match(closed.governanceResetRecordHashSha256, /^[a-f0-9]{64}$/);

  const closedAgain = verifyFreshHumanIncidentCloseoutDecision({ p62, incidentAuthorityRegistry: authority.registry, expectedIncidentAuthorityRegistryHashSha256: authority.registryHash, signedDecision: signedClose });
  assert.strictEqual(closedAgain.verifiedFreshIncidentCloseoutDecisionRecordHashSha256, closed.verifiedFreshIncidentCloseoutDecisionRecordHashSha256);
  assert.strictEqual(closedAgain.governanceResetRecordHashSha256, closed.governanceResetRecordHashSha256);

  const keepDecision = closeDecision(p62, {
    decisionId: 'decision:p63-keep',
    decision: DECISION.KEEP_INCIDENT_OPEN,
    rootCauseAnalysisRef: undefined,
    rootCauseAnalysisSha256: undefined,
    correctivePreventiveActionRef: undefined,
    correctivePreventiveActionSha256: undefined,
  });
  const signedKeep = signDecision(p62, keepDecision, authority.privateKey);
  const kept = verifyFreshHumanIncidentCloseoutDecision({ p62, incidentAuthorityRegistry: authority.registry, expectedIncidentAuthorityRegistryHashSha256: authority.registryHash, signedDecision: signedKeep });
  assert.strictEqual(kept.status, STATUS.FRESH_INCIDENT_REMAINS_OPEN_HUMAN_DECISION_VERIFIED);
  assert.strictEqual(kept.incidentClosed, false);
  assert.strictEqual(kept.governanceResetReady, false);
  assert.strictEqual(kept.reactivationAllowed, false);

  const badSignature = verifyFreshHumanIncidentCloseoutDecision({ p62, incidentAuthorityRegistry: authority.registry, expectedIncidentAuthorityRegistryHashSha256: authority.registryHash, signedDecision: { ...signedClose, signatureBase64: Buffer.from('bad').toString('base64') } });
  assert.strictEqual(badSignature.status, STATUS.HOLD_FRESH_INCIDENT_CLOSEOUT_ATTESTATION);
  assert(badSignature.blockers.includes('FRESH_INCIDENT_CLOSEOUT_SIGNATURE_INVALID'));

  const wrongTrustRoot = verifyFreshHumanIncidentCloseoutDecision({ p62, incidentAuthorityRegistry: authority.registry, expectedIncidentAuthorityRegistryHashSha256: h('e'), signedDecision: signedClose });
  assert.strictEqual(wrongTrustRoot.status, STATUS.HOLD_FRESH_INCIDENT_CLOSEOUT_TRUST_ROOT);
  assert(wrongTrustRoot.blockers.includes('FRESH_INCIDENT_AUTHORITY_REGISTRY_HASH_MISMATCH'));

  const expired = buildAuthority('incident-owner:p63', '2026-09-10T17:10:00.000Z');
  const signedExpired = signDecision(p62, unsignedClose, expired.privateKey);
  const expiredResult = verifyFreshHumanIncidentCloseoutDecision({ p62, incidentAuthorityRegistry: expired.registry, expectedIncidentAuthorityRegistryHashSha256: expired.registryHash, signedDecision: signedExpired });
  assert(expiredResult.blockers.includes('FRESH_INCIDENT_AUTHORITY_EXPIRED'));

  const sameActorDecision = closeDecision(p62, { actorRef: p62.incidentCloseoutPacket.closeoutPreparedByRef });
  const sameActorPackage = prepareFreshIncidentCloseoutSigningPackage({ p62, decision: sameActorDecision });
  assert(sameActorPackage.blockers.includes('CLOSEOUT_PREPARER_AND_APPROVING_ACTOR_MUST_DIFFER'));

  const missingRca = prepareFreshIncidentCloseoutSigningPackage({ p62, decision: closeDecision(p62, { rootCauseAnalysisRef: undefined }) });
  assert(missingRca.blockers.some((code) => code.includes('rootCauseAnalysisRef')));

  const tamperedP62 = JSON.parse(JSON.stringify(p62));
  tamperedP62.incidentCloseoutPacket.rollbackReasonCodes = ['TAMPERED'];
  const tampered = prepareFreshIncidentCloseoutSigningPackage({ p62: tamperedP62, decision: unsignedClose });
  assert(tampered.blockers.includes('P62_FRESH_INCIDENT_CLOSEOUT_PACKET_HASH_MISMATCH'));

  const escalation = verifyFreshHumanIncidentCloseoutDecision({ p62, incidentAuthorityRegistry: authority.registry, expectedIncidentAuthorityRegistryHashSha256: authority.registryHash, signedDecision: signedClose, releaseAuthorized: true });
  assert(escalation.blockers.includes('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED'));

  const secret = verifyFreshHumanIncidentCloseoutDecision({ p62, incidentAuthorityRegistry: authority.registry, expectedIncidentAuthorityRegistryHashSha256: authority.registryHash, signedDecision: { ...signedClose, privateKeyPem: 'forbidden' } });
  assert(secret.blockers.some((code) => code.startsWith('PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED')));

  assert.throws(() => parseArgs(['--private-key', 'x']), /private or secret signing key argument rejected|unknown argument/);
  assert.throws(() => parseArgs(['--mode', 'verify', '--mode', 'prepare', '--p62', 'a', '--decision', 'b']), /duplicate argument/);
  assert.throws(() => parseArgs(['--unknown', 'x']), /unknown argument/);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p63-'));
  const target = path.join(tmp, 'p62.json');
  const link = path.join(tmp, 'p62-link.json');
  fs.writeFileSync(target, JSON.stringify(p62));
  fs.symlinkSync(target, link);
  assert.throws(() => safeReadJson(link, 'p62'), /must not be a symlink/);
  fs.rmSync(tmp, { recursive: true, force: true });

  process.stdout.write('fresh human incident closeout decision tests passed\n');
})();
