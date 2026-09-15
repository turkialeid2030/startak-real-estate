'use strict';

const assert = require('assert');
const crypto = require('crypto');
const path = require('path');
const { spawnSync } = require('child_process');
const currentRegistry = require('../../config/governance/canonical-baseline.json');
const { MODE, evaluateCurrentCanonicalBaselineRegistry, stableStringify } = require('../../src/qualification/canonical-baseline-registry');
const { PURPOSE, STATUS: P45_STATUS } = require('../../src/qualification/human-incident-closeout-decision');
const {
  STATUS,
  openFreshReactivationGovernanceCycle,
} = require('../../src/qualification/fresh-reactivation-governance-cycle');

const hashText = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const hashObject = (value) => hashText(stableStringify(value));

function p45ClosedFixture() {
  const registry = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  const decisionCore = {
    schemaVersion: 1,
    purpose: PURPOSE,
    incidentId: 'incident:p46-test',
    incidentRef: 'incident-system:p46-test',
    incidentCloseoutPacketHashSha256: '1'.repeat(64),
    incidentAuthorityRegistryHashSha256: '2'.repeat(64),
    incidentAuthorityId: 'incident-authority-id:test',
    incidentAuthorityActorRef: 'incident-authority:test',
    incidentAuthorityPublicKeySha256: '3'.repeat(64),
    decisionId: 'incident-closeout-decision:p46-test',
    decision: 'CLOSE_INCIDENT',
    decidedAt: '2026-09-10T11:00:00.000Z',
    decisionSourceRef: 'decision:p46-closeout',
    decisionArtifactSha256: '4'.repeat(64),
    rationaleRef: 'rationale:p46-closeout',
    rootCauseAnalysisRef: 'incident:rca:p46',
    rootCauseAnalysisSha256: '5'.repeat(64),
    correctivePreventiveActionRef: 'incident:capa:p46',
    correctivePreventiveActionSha256: '6'.repeat(64),
    signingPayloadHashSha256: '7'.repeat(64),
  };
  const humanDecisionRecord = {
    ...decisionCore,
    humanDecisionRecordHashSha256: hashObject(decisionCore),
    signatureAlgorithm: 'RSA-SHA256',
    incidentAuthorityIdentityCryptographicallyVerified: true,
    incidentAuthorityTrustRootVerified: true,
    incidentCloseoutSignatureVerified: true,
  };
  const resetCore = {
    schemaVersion: 1,
    incidentId: decisionCore.incidentId,
    incidentRef: decisionCore.incidentRef,
    incidentCloseoutPacketHashSha256: decisionCore.incidentCloseoutPacketHashSha256,
    humanDecisionRecordHashSha256: humanDecisionRecord.humanDecisionRecordHashSha256,
    historicalActivationChangeContractHashSha256: '8'.repeat(64),
    historicalActivationExecutionReceiptHashSha256: '9'.repeat(64),
    historicalRollbackTriggerHashSha256: 'a'.repeat(64),
    historicalRollbackExecutionReceiptHashSha256: 'b'.repeat(64),
    restoredLegacyRegistryHashSha256: registry.registryHashSha256,
    decision: 'CLOSE_INCIDENT',
    incidentClosed: true,
  };
  const governanceResetRecord = {
    ...resetCore,
    governanceResetRecordHashSha256: hashObject(resetCore),
    previousActivationCycleHistoricalOnly: true,
    previousActivationAuthorizationReusable: false,
    previousReviewerApprovalReusable: false,
    failedActivationCycleReusable: false,
    reactivationAllowed: false,
    newGovernanceCycleRequired: true,
    newActivationPlanRequired: true,
    newOwnerAuthorizationRequired: true,
    newIndependentReviewRequired: true,
    releaseStillBlocked: true,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    goLiveAuthorized: false,
    transactionAuthorized: false,
  };
  return {
    schemaVersion: 1,
    status: P45_STATUS.INCIDENT_CLOSED_BY_VERIFIED_HUMAN_DECISION_REACTIVATION_BLOCKED,
    verified: true,
    blockers: [],
    incidentId: decisionCore.incidentId,
    incidentRef: decisionCore.incidentRef,
    incidentCloseoutPacketHashSha256: decisionCore.incidentCloseoutPacketHashSha256,
    incidentAuthorityRegistryHashSha256: decisionCore.incidentAuthorityRegistryHashSha256,
    humanDecisionRecord,
    humanDecisionRecordHashSha256: humanDecisionRecord.humanDecisionRecordHashSha256,
    governanceResetRecord,
    governanceResetRecordHashSha256: governanceResetRecord.governanceResetRecordHashSha256,
    incidentClosed: true,
    humanIncidentCloseoutDecisionVerified: true,
    automaticIncidentCloseoutPerformed: false,
    incidentAuthorityIdentityCryptographicallyVerified: true,
    incidentAuthorityTrustRootVerified: true,
    incidentCloseoutSignatureVerified: true,
    externalIncidentArtifactContentVerifiedHere: false,
    reactivationAllowed: false,
    previousActivationAuthorizationReusable: false,
    previousReviewerApprovalReusable: false,
    failedActivationCycleReusable: false,
    historicalActivationCycleOnly: true,
    newGovernanceCycleRequired: true,
    newActivationPlanRequired: true,
    newOwnerAuthorizationRequired: true,
    newIndependentReviewRequired: true,
    releaseStillBlocked: true,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    goLiveAuthorized: false,
    transactionAuthorized: false,
  };
}

function scopeFixture() {
  return {
    cycleId: 'reactivation-cycle:p46-001',
    ownerActorRef: 'owner:p46',
    preparedAt: '2026-09-10T11:10:00.000Z',
    requestedTargetMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    qualifiedSourceCommitSha: 'c'.repeat(40),
    releaseArtifactSha256: 'd'.repeat(64),
    environmentConfigSha256: 'e'.repeat(64),
    cycleRationaleRef: 'rationale:fresh-reactivation:p46',
    cycleEvidenceArtifactSha256: 'f'.repeat(64),
  };
}

(() => {
  const p45 = p45ClosedFixture();
  const scope = scopeFixture();

  const success = openFreshReactivationGovernanceCycle({ p45, currentRegistry, cycleScope: scope });
  assert.strictEqual(success.status, STATUS.FRESH_REACTIVATION_GOVERNANCE_CYCLE_OPEN_NOT_AUTHORIZED);
  assert.strictEqual(success.verified, true);
  assert.strictEqual(success.freshGovernanceCycleOpened, true);
  assert.strictEqual(success.currentAuthoritativeMode, MODE.LEGACY_FILE_SHA256);
  assert.strictEqual(success.priorCycle.priorCycleHistoricalOnly, true);
  assert.strictEqual(success.priorCycle.priorAuthoritiesReusable, false);
  assert.strictEqual(success.priorReviewerApprovalAccepted, false);
  assert.strictEqual(success.priorActivationAuthorizationAccepted, false);
  assert.strictEqual(success.freshIndependentReviewRequired, true);
  assert.strictEqual(success.freshOwnerActivationAuthorizationRequired, true);
  assert.strictEqual(success.reactivationAuthorized, false);
  assert.strictEqual(success.releaseAuthorized, false);
  assert.strictEqual(success.currentBaselineMutationPerformed, false);

  const notClosed = { ...p45, status: P45_STATUS.INCIDENT_REMAINS_OPEN_HUMAN_DECISION_VERIFIED, incidentClosed: false };
  const blockedNotClosed = openFreshReactivationGovernanceCycle({ p45: notClosed, currentRegistry, cycleScope: scope });
  assert.strictEqual(blockedNotClosed.status, STATUS.HOLD_FRESH_REACTIVATION_GOVERNANCE_CYCLE);
  assert(blockedNotClosed.blockers.includes('P45_VERIFIED_HUMAN_INCIDENT_CLOSURE_REQUIRED'));

  const tamperedDecision = JSON.parse(JSON.stringify(p45));
  tamperedDecision.humanDecisionRecord.rationaleRef = 'tampered';
  const decisionTamper = openFreshReactivationGovernanceCycle({ p45: tamperedDecision, currentRegistry, cycleScope: scope });
  assert.strictEqual(decisionTamper.status, STATUS.HOLD_FRESH_REACTIVATION_GOVERNANCE_CYCLE);
  assert(decisionTamper.blockers.includes('P45_HUMAN_DECISION_RECORD_HASH_MISMATCH'));

  const tamperedReset = JSON.parse(JSON.stringify(p45));
  tamperedReset.governanceResetRecord.historicalRollbackTriggerHashSha256 = '0'.repeat(64);
  const resetTamper = openFreshReactivationGovernanceCycle({ p45: tamperedReset, currentRegistry, cycleScope: scope });
  assert.strictEqual(resetTamper.status, STATUS.HOLD_FRESH_REACTIVATION_GOVERNANCE_CYCLE);
  assert(resetTamper.blockers.includes('P45_GOVERNANCE_RESET_RECORD_HASH_MISMATCH'));

  const driftedRegistry = JSON.parse(JSON.stringify(currentRegistry));
  driftedRegistry.legacyBaseline.expectedSha256 = '0'.repeat(64);
  const drift = openFreshReactivationGovernanceCycle({ p45, currentRegistry: driftedRegistry, cycleScope: scope });
  assert.strictEqual(drift.status, STATUS.HOLD_FRESH_REACTIVATION_GOVERNANCE_CYCLE);

  const reusedReviewer = openFreshReactivationGovernanceCycle({
    p45,
    currentRegistry,
    cycleScope: { ...scope, reviewerLockHashSha256: '1'.repeat(64) },
  });
  assert.strictEqual(reusedReviewer.status, STATUS.HOLD_FRESH_REACTIVATION_GOVERNANCE_CYCLE);
  assert(reusedReviewer.blockers.some((item) => item.startsWith('PRIOR_GOVERNANCE_ARTIFACT_REUSE_NOT_ALLOWED')));

  const reusedAuthorization = openFreshReactivationGovernanceCycle({
    p45,
    currentRegistry,
    cycleScope: { ...scope, signedOwnerAuthorizationVerificationHashSha256: '2'.repeat(64) },
  });
  assert.strictEqual(reusedAuthorization.status, STATUS.HOLD_FRESH_REACTIVATION_GOVERNANCE_CYCLE);

  const authorityEscalation = openFreshReactivationGovernanceCycle({
    p45,
    currentRegistry,
    cycleScope: scope,
    releaseAuthorized: true,
  });
  assert.strictEqual(authorityEscalation.status, STATUS.HOLD_FRESH_REACTIVATION_GOVERNANCE_CYCLE);
  assert(authorityEscalation.blockers.includes('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED'));

  const targetMode = openFreshReactivationGovernanceCycle({
    p45,
    currentRegistry,
    cycleScope: { ...scope, requestedTargetMode: MODE.LEGACY_FILE_SHA256 },
  });
  assert.strictEqual(targetMode.status, STATUS.HOLD_FRESH_REACTIVATION_GOVERNANCE_CYCLE);
  assert(targetMode.blockers.includes('FRESH_CYCLE_TARGET_MODE_INVALID'));

  const badCommit = openFreshReactivationGovernanceCycle({
    p45,
    currentRegistry,
    cycleScope: { ...scope, qualifiedSourceCommitSha: 'short' },
  });
  assert.strictEqual(badCommit.status, STATUS.HOLD_FRESH_REACTIVATION_GOVERNANCE_CYCLE);

  const tooEarly = openFreshReactivationGovernanceCycle({
    p45,
    currentRegistry,
    cycleScope: { ...scope, preparedAt: '2026-09-10T10:59:00.000Z' },
  });
  assert.strictEqual(tooEarly.status, STATUS.HOLD_FRESH_REACTIVATION_GOVERNANCE_CYCLE);
  assert(tooEarly.blockers.includes('FRESH_CYCLE_PREPARATION_PRECEDES_INCIDENT_CLOSURE'));

  const privateKey = openFreshReactivationGovernanceCycle({
    p45,
    currentRegistry,
    cycleScope: { ...scope, privateKeyPem: 'forbidden' },
  });
  assert.strictEqual(privateKey.status, STATUS.HOLD_FRESH_REACTIVATION_GOVERNANCE_CYCLE);
  assert(privateKey.blockers.includes('PRIVATE_SIGNING_KEY_INPUT_REJECTED'));

  const cli = path.join(__dirname, '..', '..', 'tools', 'fresh-reactivation-governance-cycle.js');
  const cliPrivateKey = spawnSync(process.execPath, [cli, '--private-key', 'forbidden'], { encoding: 'utf8' });
  assert.strictEqual(cliPrivateKey.status, 1);
  assert(cliPrivateKey.stderr.includes('private signing key argument rejected'));

  const cliDuplicate = spawnSync(process.execPath, [cli, '--p45', 'a', '--p45', 'b'], { encoding: 'utf8' });
  assert.strictEqual(cliDuplicate.status, 1);
  assert(cliDuplicate.stderr.includes('duplicate argument'));

  console.log('P46 fresh reactivation governance cycle: PASS');
})();
