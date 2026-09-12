'use strict';

const assert = require('assert');
const crypto = require('crypto');
const currentRegistry = require('../../config/governance/canonical-baseline.json');
const {
  MODE,
  AUTHORITY,
  stableStringify,
  evaluateCurrentCanonicalBaselineRegistry,
} = require('../../src/qualification/canonical-baseline-registry');
const { STATUS: P62_STATUS } = require('../../src/qualification/fresh-post-rollback-verification-incident-closeout');
const {
  PURPOSE,
  DECISION,
  p62PacketCore,
  normalizeFreshIncidentAuthorityRegistry,
  createFreshIncidentCloseoutSigningPayload,
  verifyFreshHumanIncidentCloseoutDecision,
} = require('../../src/qualification/fresh-human-incident-closeout-decision');
const {
  STATUS,
  openSuccessorFreshReactivationGovernanceCycle,
} = require('../../src/qualification/successor-fresh-reactivation-governance-cycle');

const hashText = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const hashObject = (value) => hashText(stableStringify(value));
const h = (char) => char.repeat(64);
const currentContent = `${JSON.stringify(currentRegistry, null, 2)}\n`;

function p62Fixture() {
  const observed = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  const core = {
    schemaVersion: 1,
    incidentId: 'incident:p64',
    incidentRef: 'incident-ref:p64',
    closeoutPreparedByRef: 'preparer:p64',
    closeoutPreparedAt: '2026-09-10T18:00:00.000Z',
    cycleId: 'cycle:p64-failed',
    freshReactivationGovernanceCycleHashSha256: h('1'),
    freshActivationChangeContractHashSha256: h('2'),
    activationExecutionReceiptHashSha256: h('3'),
    rollbackTriggerHashSha256: h('4'),
    rollbackExecutionReceiptHashSha256: h('5'),
    restoredLegacyRegistryHashSha256: observed.registryHashSha256,
    restoredLegacyRegistryContentSha256: hashText(currentContent),
    postRollbackReleaseVerifyEvidenceHashSha256: h('8'),
    postRollbackReleaseVerifyRunId: 'run:p64-post-rollback',
    postRollbackReleaseVerifySourceCommitSha: 'a'.repeat(40),
    postRollbackReleaseVerifyCompletedAt: '2026-09-10T17:55:00.000Z',
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

function authorityFixture() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyPem = String(publicKey.export({ type: 'spki', format: 'pem' })).trim();
  const registry = {
    schemaVersion: 1,
    registryId: 'fresh-incident-authority:p64',
    governanceArtifactSha256: h('d'),
    authorities: [{
      incidentAuthorityId: 'incident-authority:p64',
      actorRef: 'incident-owner:p64',
      publicKeyPem,
      publicKeySha256: hashText(publicKeyPem),
      governanceEvidenceRef: 'governance:p64',
      activeFrom: '2026-09-10T00:00:00.000Z',
      activeUntil: '2026-09-11T00:00:00.000Z',
      allowedPurpose: PURPOSE,
    }],
  };
  return { privateKey, registry, hash: normalizeFreshIncidentAuthorityRegistry(registry).incidentAuthorityRegistryHashSha256 };
}

function closeDecision(p62) {
  return {
    incidentId: p62.incidentCloseoutPacket.incidentId,
    incidentRef: p62.incidentCloseoutPacket.incidentRef,
    cycleId: p62.incidentCloseoutPacket.cycleId,
    incidentCloseoutPacketHashSha256: p62.incidentCloseoutPacketHashSha256,
    decisionId: 'decision:p64-close',
    incidentAuthorityId: 'incident-authority:p64',
    actorRef: 'incident-owner:p64',
    decision: DECISION.CLOSE_INCIDENT,
    decisionSourceRef: 'decision-source:p64',
    decisionArtifactSha256: h('9'),
    decidedAt: '2026-09-10T18:15:00.000Z',
    rationaleRef: 'rationale:p64',
    rootCauseAnalysisRef: 'rca:p64',
    rootCauseAnalysisSha256: h('b'),
    correctivePreventiveActionRef: 'capa:p64',
    correctivePreventiveActionSha256: h('c'),
    signatureAlgorithm: 'RSA-SHA256',
  };
}

function buildFixture() {
  const p62 = p62Fixture();
  const authority = authorityFixture();
  const unsignedDecision = closeDecision(p62);
  const payload = createFreshIncidentCloseoutSigningPayload({ p62, decision: unsignedDecision });
  const signedDecision = {
    ...unsignedDecision,
    signatureBase64: crypto.sign('RSA-SHA256', Buffer.from(stableStringify(payload), 'utf8'), authority.privateKey).toString('base64'),
  };
  const p63 = verifyFreshHumanIncidentCloseoutDecision({
    p62,
    incidentAuthorityRegistry: authority.registry,
    expectedIncidentAuthorityRegistryHashSha256: authority.hash,
    signedDecision,
  });
  assert.strictEqual(p63.incidentClosed, true);
  return { p62, authority, signedDecision, p63 };
}

function cycleScope(overrides = {}) {
  return {
    cycleId: 'cycle:p64-successor',
    ownerActorRef: 'owner:p64-successor',
    preparedAt: '2026-09-10T18:20:00.000Z',
    requestedTargetMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    qualifiedSourceCommitSha: 'f'.repeat(40),
    releaseArtifactSha256: h('e'),
    environmentConfigSha256: h('f'),
    cycleRationaleRef: 'rationale:successor:p64',
    cycleEvidenceArtifactSha256: h('a'),
    ...overrides,
  };
}

function baseInput(fixture, overrides = {}) {
  return {
    p62: fixture.p62,
    p63: fixture.p63,
    incidentAuthorityRegistry: fixture.authority.registry,
    expectedIncidentAuthorityRegistryHashSha256: fixture.authority.hash,
    signedIncidentDecision: fixture.signedDecision,
    currentRegistry,
    currentRegistryContent: currentContent,
    cycleScope: cycleScope(),
    ...overrides,
  };
}

(() => {
  const fixture = buildFixture();
  const opened = openSuccessorFreshReactivationGovernanceCycle(baseInput(fixture));
  assert.strictEqual(opened.status, STATUS.SUCCESSOR_FRESH_REACTIVATION_GOVERNANCE_CYCLE_OPEN_NOT_AUTHORIZED);
  assert.strictEqual(opened.verified, true);
  assert.strictEqual(opened.successorFreshGovernanceCycleOpened, true);
  assert.strictEqual(opened.predecessorP63Reverified, true);
  assert.strictEqual(opened.predecessorFailedFreshCycleHistoricalOnly, true);
  assert.strictEqual(opened.predecessorFreshReviewerArtifactsAccepted, false);
  assert.strictEqual(opened.predecessorFreshOwnerAuthorizationAccepted, false);
  assert.strictEqual(opened.predecessorFreshActivationPlanAccepted, false);
  assert.strictEqual(opened.predecessorFreshActivationContractAccepted, false);
  assert.strictEqual(opened.reactivationAuthorized, false);
  assert.strictEqual(opened.releaseAuthorized, false);
  assert.strictEqual(opened.currentBaselineMutationPerformed, false);
  assert.match(opened.successorFreshReactivationGovernanceCycleHashSha256, /^[a-f0-9]{64}$/);

  const deterministic = openSuccessorFreshReactivationGovernanceCycle(baseInput(fixture));
  assert.strictEqual(deterministic.successorFreshReactivationGovernanceCycleHashSha256, opened.successorFreshReactivationGovernanceCycleHashSha256);

  const sameCycle = openSuccessorFreshReactivationGovernanceCycle(baseInput(fixture, { cycleScope: cycleScope({ cycleId: fixture.p62.incidentCloseoutPacket.cycleId }) }));
  assert(sameCycle.blockers.includes('SUCCESSOR_FRESH_CYCLE_ID_MUST_DIFFER_FROM_FAILED_CYCLE'));

  const early = openSuccessorFreshReactivationGovernanceCycle(baseInput(fixture, { cycleScope: cycleScope({ preparedAt: '2026-09-10T18:14:59.000Z' }) }));
  assert(early.blockers.includes('SUCCESSOR_FRESH_CYCLE_PREPARATION_PRECEDES_INCIDENT_CLOSURE'));

  const contentDrift = openSuccessorFreshReactivationGovernanceCycle(baseInput(fixture, { currentRegistryContent: `${currentContent} ` }));
  assert(contentDrift.blockers.includes('CURRENT_LEGACY_REGISTRY_CONTENT_DOES_NOT_MATCH_P62_RESTORED_BASELINE'));

  const tamperedP63 = { ...fixture.p63, governanceResetRecordHashSha256: h('0') };
  const p63Tamper = openSuccessorFreshReactivationGovernanceCycle(baseInput(fixture, { p63: tamperedP63 }));
  assert(p63Tamper.blockers.includes('P63_GOVERNANCE_RESET_RECORD_HASH_MISMATCH'));

  const badSignature = openSuccessorFreshReactivationGovernanceCycle(baseInput(fixture, { signedIncidentDecision: { ...fixture.signedDecision, signatureBase64: Buffer.from('bad').toString('base64') } }));
  assert(badSignature.blockers.includes('P63_RECOMPUTATION_DID_NOT_CLOSE_INCIDENT'));

  const reuse = openSuccessorFreshReactivationGovernanceCycle(baseInput(fixture, { cycleScope: cycleScope({ nested: { freshActivationPlanHashSha256: h('1') } }) }));
  assert(reuse.blockers.some((code) => code.startsWith('PRIOR_FRESH_GOVERNANCE_ARTIFACT_REUSE_NOT_ALLOWED')));

  const escalation = openSuccessorFreshReactivationGovernanceCycle(baseInput(fixture, { releaseAuthorized: true }));
  assert(escalation.blockers.includes('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED'));

  const secret = openSuccessorFreshReactivationGovernanceCycle(baseInput(fixture, { privateKeyPem: 'forbidden' }));
  assert(secret.blockers.some((code) => code.startsWith('PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED')));

  process.stdout.write('successor fresh reactivation governance cycle tests passed\n');
})();
