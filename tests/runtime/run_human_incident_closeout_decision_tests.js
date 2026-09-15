'use strict';

const assert = require('assert');
const crypto = require('crypto');
const path = require('path');
const { spawnSync } = require('child_process');
const { stableStringify } = require('../../src/qualification/canonical-baseline-registry');
const { STATUS: P44_STATUS } = require('../../src/qualification/post-rollback-canonical-baseline-verification');
const {
  PURPOSE,
  DECISION,
  STATUS,
  normalizeIncidentAuthorityRegistry,
  prepareHumanIncidentCloseoutDecision,
  verifyHumanIncidentCloseoutDecision,
} = require('../../src/qualification/human-incident-closeout-decision');

const hashText = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const hashObject = (value) => hashText(stableStringify(value));

function p44Fixture() {
  const core = {
    schemaVersion: 1,
    incidentId: 'incident:p45-test',
    incidentRef: 'incident-system:p45-test',
    closeoutPreparedByRef: 'operator:test',
    closeoutPreparedAt: '2026-09-10T10:00:00.000Z',
    activationChangeContractHashSha256: '1'.repeat(64),
    activationExecutionReceiptHashSha256: '2'.repeat(64),
    rollbackTriggerHashSha256: '3'.repeat(64),
    rollbackExecutionReceiptHashSha256: '4'.repeat(64),
    restoredLegacyRegistryHashSha256: '5'.repeat(64),
    postRollbackReleaseVerifyEvidenceHashSha256: '6'.repeat(64),
    postRollbackReleaseVerifyRunId: 'release-verify:p45-post-rollback',
    postRollbackReleaseVerifySourceCommitSha: 'a'.repeat(40),
    postRollbackReleaseVerifyCompletedAt: '2026-09-10T09:55:00.000Z',
  };
  const packetHash = hashObject(core);
  const incidentCloseoutPacket = {
    ...core,
    incidentCloseoutPacketHashSha256: packetHash,
    restoredExactP39LegacyRegistry: true,
    postRollbackReleaseVerifyEvidenceConsistent: true,
    incidentCloseoutReady: true,
    incidentClosed: false,
    humanIncidentCloseoutRequired: true,
    automaticIncidentCloseoutPerformed: false,
    releaseStillBlocked: true,
    reactivationAllowed: false,
    reactivationRequiresNewGovernanceCycle: true,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    goLiveAuthorized: false,
    transactionAuthorized: false,
  };
  return {
    schemaVersion: 1,
    status: P44_STATUS.POST_ROLLBACK_RELEASE_VERIFY_EVIDENCE_CONSISTENT_INCIDENT_CLOSEOUT_READY,
    verified: true,
    blockers: [],
    postRollbackVerificationHashSha256: packetHash,
    postRollbackVerificationPassed: true,
    restoredExactP39LegacyRegistry: true,
    rollbackExecutionVerified: true,
    rollbackTriggerVerified: true,
    postRollbackReleaseVerifyEvidenceConsistent: true,
    releaseVerifyEvidenceAuthenticityVerifiedHere: false,
    incidentCloseoutReady: true,
    incidentClosed: false,
    humanIncidentCloseoutRequired: true,
    automaticIncidentCloseoutPerformed: false,
    incidentCloseoutPacket,
    incidentCloseoutPacketHashSha256: packetHash,
    reactivationAllowed: false,
    reactivationRequiresNewGovernanceCycle: true,
    releaseStillBlocked: true,
    existingReleaseGovernanceStillRequired: true,
    productionEvidenceEstablishedHere: false,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    goLiveAuthorized: false,
    transactionAuthorized: false,
  };
}

function authorityFixture({ actorRef = 'incident-authority:test', purpose = PURPOSE, activeFrom = '2026-09-01T00:00:00.000Z', activeUntil = '2026-12-31T23:59:59.000Z' } = {}) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyPem = String(publicKey.export({ type: 'spki', format: 'pem' })).trim();
  const registry = {
    registryId: 'incident-authority-registry:p45-test',
    governanceArtifactSha256: '7'.repeat(64),
    authorities: [{
      incidentAuthorityId: 'incident-authority-id:test',
      actorRef,
      publicKeyPem,
      publicKeySha256: hashText(publicKeyPem),
      governanceEvidenceRef: 'governance:incident-closeout-authority',
      activeFrom,
      activeUntil,
      allowedPurpose: purpose,
    }],
  };
  const normalized = normalizeIncidentAuthorityRegistry(registry);
  return { registry, expectedHash: normalized.registryHashSha256, privateKey, actorRef };
}

function decisionFixture({ decision = DECISION.CLOSE_INCIDENT, actorRef = 'incident-authority:test', incidentAuthorityId = 'incident-authority-id:test', decidedAt = '2026-09-10T10:05:00.000Z' } = {}) {
  const base = {
    incidentId: 'incident:p45-test',
    incidentRef: 'incident-system:p45-test',
    decisionId: `incident-closeout-decision:${decision}`,
    incidentAuthorityId,
    actorRef,
    decision,
    decisionSourceRef: 'decision:incident-closeout',
    decisionArtifactSha256: '8'.repeat(64),
    decidedAt,
    rationaleRef: 'rationale:incident-closeout',
    signatureAlgorithm: 'RSA-SHA256',
  };
  if (decision === DECISION.CLOSE_INCIDENT) {
    return {
      ...base,
      rootCauseAnalysisRef: 'incident:rca:p45-test',
      rootCauseAnalysisSha256: '9'.repeat(64),
      correctivePreventiveActionRef: 'incident:capa:p45-test',
      correctivePreventiveActionSha256: 'b'.repeat(64),
    };
  }
  return base;
}

function signDecision({ p44, auth, decision }) {
  const prepared = prepareHumanIncidentCloseoutDecision({
    p44,
    incidentAuthorityRegistry: auth.registry,
    expectedIncidentAuthorityRegistryHashSha256: auth.expectedHash,
    decision,
  });
  assert.strictEqual(prepared.status, STATUS.READY_FOR_EXTERNAL_INCIDENT_AUTHORITY_SIGNATURE);
  const signatureBase64 = crypto.sign(
    'RSA-SHA256',
    Buffer.from(stableStringify(prepared.signingPayload), 'utf8'),
    auth.privateKey,
  ).toString('base64');
  return { prepared, attestation: { ...prepared.attestationWithoutSignature, signatureBase64 } };
}

(() => {
  const p44 = p44Fixture();
  const auth = authorityFixture();
  const closeDecision = { ...decisionFixture(), incidentCloseoutPacketHashSha256: p44.incidentCloseoutPacketHashSha256 };
  const signedClose = signDecision({ p44, auth, decision: closeDecision });

  const closed = verifyHumanIncidentCloseoutDecision({
    p44,
    incidentAuthorityRegistry: auth.registry,
    expectedIncidentAuthorityRegistryHashSha256: auth.expectedHash,
    attestation: signedClose.attestation,
  });
  assert.strictEqual(closed.status, STATUS.INCIDENT_CLOSED_BY_VERIFIED_HUMAN_DECISION_REACTIVATION_BLOCKED);
  assert.strictEqual(closed.verified, true);
  assert.strictEqual(closed.incidentClosed, true);
  assert.strictEqual(closed.humanIncidentCloseoutDecisionVerified, true);
  assert.strictEqual(closed.incidentCloseoutSignatureVerified, true);
  assert.strictEqual(closed.reactivationAllowed, false);
  assert.strictEqual(closed.previousActivationAuthorizationReusable, false);
  assert.strictEqual(closed.previousReviewerApprovalReusable, false);
  assert.strictEqual(closed.newGovernanceCycleRequired, true);
  assert.strictEqual(closed.releaseAuthorized, false);
  assert.strictEqual(closed.governanceResetRecord.previousActivationCycleHistoricalOnly, true);

  const keepDecision = decisionFixture({ decision: DECISION.KEEP_INCIDENT_OPEN });
  const signedKeep = signDecision({ p44, auth, decision: keepDecision });
  const keptOpen = verifyHumanIncidentCloseoutDecision({
    p44,
    incidentAuthorityRegistry: auth.registry,
    expectedIncidentAuthorityRegistryHashSha256: auth.expectedHash,
    attestation: signedKeep.attestation,
  });
  assert.strictEqual(keptOpen.status, STATUS.INCIDENT_REMAINS_OPEN_HUMAN_DECISION_VERIFIED);
  assert.strictEqual(keptOpen.incidentClosed, false);
  assert.strictEqual(keptOpen.releaseStillBlocked, true);

  const tamperedP44 = JSON.parse(JSON.stringify(p44));
  tamperedP44.incidentCloseoutPacket.incidentRef = 'incident-system:tampered';
  const tamperedP44Result = prepareHumanIncidentCloseoutDecision({
    p44: tamperedP44,
    incidentAuthorityRegistry: auth.registry,
    expectedIncidentAuthorityRegistryHashSha256: auth.expectedHash,
    decision: closeDecision,
  });
  assert.strictEqual(tamperedP44Result.status, STATUS.HOLD_P44_CLOSEOUT_PACKET);
  assert(tamperedP44Result.blockers.includes('P44_INCIDENT_CLOSEOUT_PACKET_HASH_MISMATCH'));

  const notReady = { ...p44, status: P44_STATUS.POST_ROLLBACK_VERIFICATION_FAILED_INCIDENT_OPEN };
  assert.strictEqual(prepareHumanIncidentCloseoutDecision({
    p44: notReady,
    incidentAuthorityRegistry: auth.registry,
    expectedIncidentAuthorityRegistryHashSha256: auth.expectedHash,
    decision: closeDecision,
  }).status, STATUS.HOLD_P44_CLOSEOUT_PACKET);

  const incidentMismatch = prepareHumanIncidentCloseoutDecision({
    p44,
    incidentAuthorityRegistry: auth.registry,
    expectedIncidentAuthorityRegistryHashSha256: auth.expectedHash,
    decision: { ...closeDecision, incidentId: 'incident:wrong' },
  });
  assert.strictEqual(incidentMismatch.status, STATUS.HOLD_INCIDENT_CLOSEOUT_ATTESTATION);
  assert(incidentMismatch.blockers.includes('INCIDENT_ID_MISMATCH'));

  const badTrustRoot = prepareHumanIncidentCloseoutDecision({
    p44,
    incidentAuthorityRegistry: auth.registry,
    expectedIncidentAuthorityRegistryHashSha256: '0'.repeat(64),
    decision: closeDecision,
  });
  assert.strictEqual(badTrustRoot.status, STATUS.HOLD_INCIDENT_CLOSEOUT_TRUST_ROOT);
  assert(badTrustRoot.blockers.includes('INCIDENT_AUTHORITY_REGISTRY_HASH_MISMATCH'));

  const unknownAuthority = prepareHumanIncidentCloseoutDecision({
    p44,
    incidentAuthorityRegistry: auth.registry,
    expectedIncidentAuthorityRegistryHashSha256: auth.expectedHash,
    decision: { ...closeDecision, incidentAuthorityId: 'unknown-authority' },
  });
  assert.strictEqual(unknownAuthority.status, STATUS.HOLD_INCIDENT_CLOSEOUT_ATTESTATION);
  assert(unknownAuthority.blockers.includes('INCIDENT_AUTHORITY_NOT_IN_TRUSTED_REGISTRY'));

  const expiredAuth = authorityFixture({ activeUntil: '2026-09-09T23:59:59.000Z' });
  const expired = prepareHumanIncidentCloseoutDecision({
    p44,
    incidentAuthorityRegistry: expiredAuth.registry,
    expectedIncidentAuthorityRegistryHashSha256: expiredAuth.expectedHash,
    decision: { ...closeDecision, actorRef: expiredAuth.actorRef },
  });
  assert.strictEqual(expired.status, STATUS.HOLD_INCIDENT_CLOSEOUT_ATTESTATION);
  assert(expired.blockers.includes('INCIDENT_AUTHORITY_OUTSIDE_ACTIVE_PERIOD'));

  const wrongPurposeAuth = authorityFixture({ purpose: 'OTHER_PURPOSE' });
  const wrongPurpose = prepareHumanIncidentCloseoutDecision({
    p44,
    incidentAuthorityRegistry: wrongPurposeAuth.registry,
    expectedIncidentAuthorityRegistryHashSha256: wrongPurposeAuth.expectedHash,
    decision: { ...closeDecision, actorRef: wrongPurposeAuth.actorRef },
  });
  assert.strictEqual(wrongPurpose.status, STATUS.HOLD_INCIDENT_CLOSEOUT_ATTESTATION);
  assert(wrongPurpose.blockers.includes('INCIDENT_AUTHORITY_PURPOSE_NOT_ALLOWED'));

  const invalidSignature = verifyHumanIncidentCloseoutDecision({
    p44,
    incidentAuthorityRegistry: auth.registry,
    expectedIncidentAuthorityRegistryHashSha256: auth.expectedHash,
    attestation: { ...signedClose.attestation, signatureBase64: Buffer.from('invalid').toString('base64') },
  });
  assert.strictEqual(invalidSignature.status, STATUS.HOLD_INCIDENT_CLOSEOUT_ATTESTATION);
  assert(invalidSignature.blockers.includes('INCIDENT_CLOSEOUT_SIGNATURE_INVALID'));

  const tooEarly = prepareHumanIncidentCloseoutDecision({
    p44,
    incidentAuthorityRegistry: auth.registry,
    expectedIncidentAuthorityRegistryHashSha256: auth.expectedHash,
    decision: { ...closeDecision, decidedAt: '2026-09-10T09:59:59.000Z' },
  });
  assert.strictEqual(tooEarly.status, STATUS.HOLD_INCIDENT_CLOSEOUT_ATTESTATION);
  assert(tooEarly.blockers.includes('INCIDENT_CLOSEOUT_DECISION_PRECEDES_P44_PREPARATION'));

  const sameActor = prepareHumanIncidentCloseoutDecision({
    p44,
    incidentAuthorityRegistry: auth.registry,
    expectedIncidentAuthorityRegistryHashSha256: auth.expectedHash,
    decision: { ...closeDecision, actorRef: 'operator:test' },
  });
  assert.strictEqual(sameActor.status, STATUS.HOLD_INCIDENT_CLOSEOUT_ATTESTATION);
  assert(sameActor.blockers.includes('CLOSEOUT_PREPARER_AND_APPROVING_ACTOR_MUST_DIFFER'));

  const missingRca = { ...closeDecision };
  delete missingRca.rootCauseAnalysisRef;
  assert.strictEqual(prepareHumanIncidentCloseoutDecision({
    p44,
    incidentAuthorityRegistry: auth.registry,
    expectedIncidentAuthorityRegistryHashSha256: auth.expectedHash,
    decision: missingRca,
  }).status, STATUS.HOLD_INCIDENT_CLOSEOUT_ATTESTATION);

  const missingCapa = { ...closeDecision };
  delete missingCapa.correctivePreventiveActionSha256;
  assert.strictEqual(prepareHumanIncidentCloseoutDecision({
    p44,
    incidentAuthorityRegistry: auth.registry,
    expectedIncidentAuthorityRegistryHashSha256: auth.expectedHash,
    decision: missingCapa,
  }).status, STATUS.HOLD_INCIDENT_CLOSEOUT_ATTESTATION);

  const tamperedRca = verifyHumanIncidentCloseoutDecision({
    p44,
    incidentAuthorityRegistry: auth.registry,
    expectedIncidentAuthorityRegistryHashSha256: auth.expectedHash,
    attestation: { ...signedClose.attestation, rootCauseAnalysisSha256: 'c'.repeat(64) },
  });
  assert.strictEqual(tamperedRca.status, STATUS.HOLD_INCIDENT_CLOSEOUT_ATTESTATION);
  assert(tamperedRca.blockers.includes('INCIDENT_CLOSEOUT_SIGNATURE_INVALID'));

  const authorityEscalation = verifyHumanIncidentCloseoutDecision({
    p44,
    incidentAuthorityRegistry: auth.registry,
    expectedIncidentAuthorityRegistryHashSha256: auth.expectedHash,
    attestation: signedClose.attestation,
    releaseAuthorized: true,
  });
  assert.strictEqual(authorityEscalation.status, STATUS.HOLD_INCIDENT_CLOSEOUT_ATTESTATION);
  assert(authorityEscalation.blockers.includes('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED'));

  const privateKeyRejected = prepareHumanIncidentCloseoutDecision({
    p44,
    incidentAuthorityRegistry: auth.registry,
    expectedIncidentAuthorityRegistryHashSha256: auth.expectedHash,
    decision: closeDecision,
    privateKeyPem: 'forbidden',
  });
  assert.strictEqual(privateKeyRejected.status, STATUS.HOLD_INCIDENT_CLOSEOUT_ATTESTATION);
  assert(privateKeyRejected.blockers.includes('PRIVATE_SIGNING_KEY_INPUT_REJECTED'));

  const reuseAttempt = verifyHumanIncidentCloseoutDecision({
    p44,
    incidentAuthorityRegistry: auth.registry,
    expectedIncidentAuthorityRegistryHashSha256: auth.expectedHash,
    attestation: signedClose.attestation,
    reactivationAllowed: true,
  });
  assert.strictEqual(reuseAttempt.status, STATUS.HOLD_INCIDENT_CLOSEOUT_ATTESTATION);
  assert(reuseAttempt.blockers.includes('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED'));

  const cli = path.join(__dirname, '..', '..', 'tools', 'human-incident-closeout-decision.js');
  const cliPrivateKey = spawnSync(process.execPath, [cli, '--private-key', 'forbidden'], { encoding: 'utf8' });
  assert.strictEqual(cliPrivateKey.status, 1);
  assert(cliPrivateKey.stderr.includes('private signing key argument rejected'));

  const cliDuplicate = spawnSync(process.execPath, [cli, '--mode', 'prepare', '--mode', 'verify'], { encoding: 'utf8' });
  assert.strictEqual(cliDuplicate.status, 1);
  assert(cliDuplicate.stderr.includes('duplicate argument'));

  console.log('P45 human incident closeout decision and governance reset: PASS');
})();
