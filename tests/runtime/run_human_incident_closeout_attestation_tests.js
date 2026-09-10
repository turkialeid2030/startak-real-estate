'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { stableStringify } = require('../../src/qualification/canonical-baseline-registry');
const { STATUS: P44_STATUS, AUTHORITY } = require('../../src/qualification/post-rollback-canonical-baseline-verification');
const {
  STATUS,
  DECISION,
  PURPOSE,
  normalizeCloseoutAuthorityRegistry,
  prepareHumanIncidentCloseoutAttestation,
  verifyHumanIncidentCloseoutAttestation,
} = require('../../src/qualification/human-incident-closeout-attestation');
const { parseArgs, run: runCli } = require('../../tools/human-incident-closeout-attestation');

const hashText = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const hashObject = (value) => hashText(stableStringify(value));

function p44Fixture() {
  const core = {
    schemaVersion: 1,
    incidentId: 'incident:p45-test',
    incidentRef: 'incident-ref:p45-test',
    closeoutPreparedByRef: 'operator:p44',
    closeoutPreparedAt: '2026-09-10T10:30:00.000Z',
    activationChangeContractHashSha256: '1'.repeat(64),
    activationExecutionReceiptHashSha256: '2'.repeat(64),
    rollbackTriggerHashSha256: '3'.repeat(64),
    rollbackExecutionReceiptHashSha256: '4'.repeat(64),
    restoredLegacyRegistryHashSha256: '5'.repeat(64),
    postRollbackReleaseVerifyEvidenceHashSha256: '6'.repeat(64),
    postRollbackReleaseVerifyRunId: 'release-verify:p45-test',
    postRollbackReleaseVerifySourceCommitSha: 'a'.repeat(40),
    postRollbackReleaseVerifyCompletedAt: '2026-09-10T10:25:00.000Z',
  };
  const packetHash = hashObject(core);
  const packet = {
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
    ...AUTHORITY,
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
    incidentCloseoutPacket: packet,
    incidentCloseoutPacketHashSha256: packetHash,
    reactivationAllowed: false,
    reactivationRequiresNewGovernanceCycle: true,
    releaseStillBlocked: true,
    existingReleaseGovernanceStillRequired: true,
    productionEvidenceEstablishedHere: false,
    ...AUTHORITY,
  };
}

function authorityFixture(actorRef = 'incident-manager:test') {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyPem = String(publicKey.export({ type: 'spki', format: 'pem' })).trim();
  const registry = {
    registryId: 'incident-closeout-authority-registry:p45-test',
    governanceArtifactSha256: '7'.repeat(64),
    authorities: [{
      authorityId: 'incident-closeout-authority:test',
      actorRef,
      publicKeyPem,
      publicKeySha256: hashText(publicKeyPem),
      governanceEvidenceRef: 'governance:incident-closeout-authority',
      activeFrom: '2026-09-01T00:00:00.000Z',
      activeUntil: '2026-12-31T23:59:59.000Z',
      allowedPurpose: PURPOSE,
    }],
  };
  const normalized = normalizeCloseoutAuthorityRegistry(registry);
  return { registry, expectedHash: normalized.registryHashSha256, privateKey, actorRef };
}

function decisionFixture(type = DECISION.CLOSE_INCIDENT, actorRef = 'incident-manager:test') {
  const base = {
    authorityId: 'incident-closeout-authority:test',
    actorRef,
    decisionId: `incident-closeout-decision:${type.toLowerCase()}`,
    decision: type,
    decisionSourceRef: 'decision-source:p45',
    decisionArtifactSha256: '8'.repeat(64),
    decidedAt: '2026-09-10T10:40:00.000Z',
    rationaleRef: 'rationale:p45',
    signatureAlgorithm: 'RSA-SHA256',
  };
  if (type === DECISION.CLOSE_INCIDENT) {
    return { ...base, rootCauseRef: 'root-cause:p45', correctiveActionRef: 'corrective-action:p45', lessonsLearnedRef: 'lessons:p45' };
  }
  if (type === DECISION.KEEP_INCIDENT_OPEN) return { ...base, nextReviewRef: 'next-review:p45' };
  return { ...base, escalationRef: 'escalation:p45' };
}

function externallySign(p44, auth, decision) {
  const prepared = prepareHumanIncidentCloseoutAttestation({
    p44,
    closeoutAuthorityRegistry: auth.registry,
    expectedCloseoutAuthorityRegistryHashSha256: auth.expectedHash,
    decision,
  });
  assert.strictEqual(prepared.status, STATUS.READY_FOR_EXTERNAL_INCIDENT_CLOSEOUT_SIGNATURE);
  const signatureBase64 = crypto.sign(
    'RSA-SHA256',
    Buffer.from(stableStringify(prepared.signingPayload), 'utf8'),
    auth.privateKey,
  ).toString('base64');
  return { prepared, attestation: { ...prepared.attestationWithoutSignature, signatureBase64 } };
}

(function runTests() {
  const p44 = p44Fixture();
  const auth = authorityFixture();
  const closeDecision = decisionFixture();
  const signed = externallySign(p44, auth, closeDecision);

  assert.strictEqual(signed.prepared.incidentClosed, false);
  assert.strictEqual(signed.prepared.reactivationAllowed, false);
  assert.strictEqual(signed.prepared.releaseAuthorized, false);
  assert.strictEqual(signed.prepared.privateSigningKeyAccepted, false);

  const verifiedClose = verifyHumanIncidentCloseoutAttestation({
    p44,
    closeoutAuthorityRegistry: auth.registry,
    expectedCloseoutAuthorityRegistryHashSha256: auth.expectedHash,
    attestation: signed.attestation,
  });
  assert.strictEqual(verifiedClose.status, STATUS.INCIDENT_CLOSED_REACTIVATION_REQUIRES_NEW_GOVERNANCE_CYCLE);
  assert.strictEqual(verifiedClose.verified, true);
  assert.strictEqual(verifiedClose.incidentClosed, true);
  assert.strictEqual(verifiedClose.reactivationAllowed, false);
  assert.strictEqual(verifiedClose.reactivationRequiresNewGovernanceCycle, true);
  assert.strictEqual(verifiedClose.failedActivationAuthorityCannotBeReusedForReactivation, true);
  assert.strictEqual(verifiedClose.releaseAuthorized, false);
  assert.strictEqual(verifiedClose.transactionAuthorized, false);

  const keep = externallySign(p44, auth, decisionFixture(DECISION.KEEP_INCIDENT_OPEN));
  const verifiedKeep = verifyHumanIncidentCloseoutAttestation({
    p44,
    closeoutAuthorityRegistry: auth.registry,
    expectedCloseoutAuthorityRegistryHashSha256: auth.expectedHash,
    attestation: keep.attestation,
  });
  assert.strictEqual(verifiedKeep.status, STATUS.INCIDENT_REMAINS_OPEN_BY_HUMAN_DECISION);
  assert.strictEqual(verifiedKeep.incidentClosed, false);
  assert.strictEqual(verifiedKeep.escalationRequired, false);

  const escalation = externallySign(p44, auth, decisionFixture(DECISION.ESCALATE_INCIDENT));
  const verifiedEscalation = verifyHumanIncidentCloseoutAttestation({
    p44,
    closeoutAuthorityRegistry: auth.registry,
    expectedCloseoutAuthorityRegistryHashSha256: auth.expectedHash,
    attestation: escalation.attestation,
  });
  assert.strictEqual(verifiedEscalation.status, STATUS.INCIDENT_REMAINS_OPEN_BY_HUMAN_DECISION);
  assert.strictEqual(verifiedEscalation.escalationRequired, true);

  const badTrust = prepareHumanIncidentCloseoutAttestation({
    p44,
    closeoutAuthorityRegistry: auth.registry,
    expectedCloseoutAuthorityRegistryHashSha256: '0'.repeat(64),
    decision: closeDecision,
  });
  assert.strictEqual(badTrust.status, STATUS.HOLD_INCIDENT_CLOSEOUT_ATTESTATION);
  assert(badTrust.blockers.includes('CLOSEOUT_AUTHORITY_REGISTRY_HASH_MISMATCH'));

  const badSignature = verifyHumanIncidentCloseoutAttestation({
    p44,
    closeoutAuthorityRegistry: auth.registry,
    expectedCloseoutAuthorityRegistryHashSha256: auth.expectedHash,
    attestation: { ...signed.attestation, signatureBase64: Buffer.from('invalid').toString('base64') },
  });
  assert.strictEqual(badSignature.status, STATUS.HOLD_INCIDENT_CLOSEOUT_ATTESTATION);
  assert(badSignature.blockers.includes('INCIDENT_CLOSEOUT_SIGNATURE_INVALID'));

  const tamperedP44 = JSON.parse(JSON.stringify(p44));
  tamperedP44.incidentCloseoutPacket.incidentRef = 'tampered';
  const tampered = prepareHumanIncidentCloseoutAttestation({
    p44: tamperedP44,
    closeoutAuthorityRegistry: auth.registry,
    expectedCloseoutAuthorityRegistryHashSha256: auth.expectedHash,
    decision: closeDecision,
  });
  assert.strictEqual(tampered.status, STATUS.HOLD_INCIDENT_CLOSEOUT_ATTESTATION);
  assert(tampered.blockers.includes('P44_INCIDENT_CLOSEOUT_PACKET_HASH_MISMATCH'));

  const earlyDecision = { ...closeDecision, decidedAt: '2026-09-10T10:20:00.000Z' };
  const early = prepareHumanIncidentCloseoutAttestation({
    p44,
    closeoutAuthorityRegistry: auth.registry,
    expectedCloseoutAuthorityRegistryHashSha256: auth.expectedHash,
    decision: earlyDecision,
  });
  assert.strictEqual(early.status, STATUS.HOLD_INCIDENT_CLOSEOUT_ATTESTATION);
  assert(early.blockers.includes('INCIDENT_CLOSEOUT_DECISION_PRECEDES_P44_CLOSEOUT_PACKET'));

  const incompleteClose = { ...closeDecision };
  delete incompleteClose.rootCauseRef;
  const incomplete = prepareHumanIncidentCloseoutAttestation({
    p44,
    closeoutAuthorityRegistry: auth.registry,
    expectedCloseoutAuthorityRegistryHashSha256: auth.expectedHash,
    decision: incompleteClose,
  });
  assert.strictEqual(incomplete.status, STATUS.HOLD_INCIDENT_CLOSEOUT_ATTESTATION);
  assert(incomplete.blockers.includes('CLOSE_INCIDENT_REQUIRES_ROOT_CAUSE_CORRECTIVE_ACTION_AND_LESSONS_REFS'));

  const secretAttempt = prepareHumanIncidentCloseoutAttestation({
    p44,
    closeoutAuthorityRegistry: auth.registry,
    expectedCloseoutAuthorityRegistryHashSha256: auth.expectedHash,
    decision: closeDecision,
    privateKeyPem: 'must-not-be-accepted',
  });
  assert.strictEqual(secretAttempt.status, STATUS.HOLD_INCIDENT_CLOSEOUT_ATTESTATION);
  assert(secretAttempt.blockers.some((value) => value.startsWith('PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:')));

  assert.throws(() => parseArgs(['--private-key', '/tmp/key.pem']), /private signing key argument rejected/);
  assert.throws(() => parseArgs(['--mode', 'prepare', '--unknown', 'x']), /unknown argument/);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'startak-p45-cli-'));
  try {
    const p44Path = path.join(dir, 'p44.json');
    const registryPath = path.join(dir, 'registry.json');
    const decisionPath = path.join(dir, 'decision.json');
    const outputPath = path.join(dir, 'output.json');
    fs.writeFileSync(p44Path, JSON.stringify(p44));
    fs.writeFileSync(registryPath, JSON.stringify(auth.registry));
    fs.writeFileSync(decisionPath, JSON.stringify(closeDecision));
    const code = runCli([
      '--mode', 'prepare',
      '--p44', p44Path,
      '--authority-registry', registryPath,
      '--expected-authority-registry-sha256', auth.expectedHash,
      '--decision', decisionPath,
      '--output', outputPath,
    ]);
    assert.strictEqual(code, 0);
    const result = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    assert.strictEqual(result.status, STATUS.READY_FOR_EXTERNAL_INCIDENT_CLOSEOUT_SIGNATURE);
    assert.strictEqual(result.privateSigningKeyAccepted, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  console.log('P45 human incident closeout attestation: PASS');
})();
