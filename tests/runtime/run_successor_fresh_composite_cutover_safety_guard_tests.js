'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const {
  AUTHORITY,
  stableStringify,
  evaluateCurrentCanonicalBaselineRegistry,
} = require('../../src/qualification/canonical-baseline-registry');
const { STATUS: P65_STATUS } = require('../../src/qualification/successor-fresh-independent-review-handoff');
const { designationCore, reviewPacketCore } = require('../../src/qualification/successor-fresh-review-attestation');
const { STATUS: P67_STATUS } = require('../../src/qualification/successor-fresh-reviewer-lifecycle-lock');
const { successorReviewerLockCore } = require('../../src/qualification/successor-fresh-activation-plan');
const { STATUS: P68_STATUS } = require('../../src/qualification/successor-fresh-activation-plan');
const { successorManifestCore, p68PlanCore } = require('../../src/qualification/successor-fresh-composite-registry-candidate');
const { STATUS: P71_STATUS } = require('../../src/qualification/successor-fresh-composite-shadow-release-gate');
const { p71ShadowCore, runSuccessorFreshCompositeCutoverRehearsal } = require('../../src/qualification/successor-fresh-composite-cutover-rehearsal');
const {
  STATUS,
  p72RehearsalCore,
  evaluateSuccessorFreshCompositeCutoverSafetyGuard,
} = require('../../src/qualification/successor-fresh-composite-cutover-safety-guard');
const { parseArgs } = require('../../tools/successor-fresh-composite-cutover-safety-guard');

function sha256Text(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }
function sha256Object(value) { return sha256Text(stableStringify(value)); }
function h(label) { return sha256Text(`p73:${label}`); }
function authorityFalse() { return Object.fromEntries(Object.keys(AUTHORITY).map((key) => [key, false])); }

function buildPacket() {
  const designation = {
    schemaVersion: 1,
    designationId: 'successor-designation-p73',
    cycleId: 'successor-cycle-008',
    successorFreshReactivationGovernanceCycleHashSha256: h('cycle'),
    designatedByRef: 'owner:successor-p73',
    reviewerRef: 'reviewer:successor-independent-p73',
    reviewerDisplayName: 'Successor Independent Reviewer P73',
    designatedAt: '2026-09-10T21:40:00.000Z',
    designationSourceRef: 'governance://successor-reviewer-designation/p73',
    designationArtifactSha256: h('designation-artifact'),
  };
  designation.successorFreshReviewerDesignationHashSha256 = sha256Object(designationCore(designation));
  const core = {
    schemaVersion: 1,
    reviewRequestId: 'successor-review-request-p73',
    requestedAt: '2026-09-10T21:41:00.000Z',
    cycleId: designation.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: designation.successorFreshReactivationGovernanceCycleHashSha256,
    ownerActorRef: designation.designatedByRef,
    currentAuthoritativeMode: 'LEGACY_FILE_SHA256',
    currentRegistryHashSha256: null,
    currentRegistryContentSha256: null,
    requestedTargetMode: 'GOVERNED_COMPOSITE_BASELINE',
    qualifiedSourceCommitSha: 'f'.repeat(40),
    releaseArtifactSha256: h('release-artifact'),
    environmentConfigSha256: h('environment-config'),
    cycleEvidenceArtifactSha256: h('cycle-evidence'),
    predecessorIncidentCloseoutPacketHashSha256: h('predecessor-closeout'),
    predecessorHumanDecisionRecordHashSha256: h('predecessor-human'),
    predecessorGovernanceResetRecordHashSha256: h('predecessor-reset'),
    predecessorRootCauseAnalysisSha256: h('predecessor-rca'),
    predecessorCorrectivePreventiveActionSha256: h('predecessor-capa'),
    successorFreshReviewerDesignationHashSha256: designation.successorFreshReviewerDesignationHashSha256,
    independentReviewerRef: designation.reviewerRef,
    reviewerDisplayName: designation.reviewerDisplayName,
    reviewChecklist: Object.freeze(['CONFIRM_SUCCESSOR_P73_SCOPE']),
  };
  return { core, designation };
}

function finalizePacket(currentRegistry, currentRegistryContent) {
  const { core, designation } = buildPacket();
  const observed = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  core.currentRegistryHashSha256 = observed.registryHashSha256;
  core.currentRegistryContentSha256 = sha256Text(currentRegistryContent);
  return {
    ...core,
    status: P65_STATUS.SUCCESSOR_FRESH_REVIEW_PACKET_READY_NOT_APPROVED,
    verified: true,
    blockers: Object.freeze([]),
    successorFreshReviewerDesignation: designation,
    successorFreshReviewPacketHashSha256: sha256Object(reviewPacketCore(core)),
    reviewPacketReady: true,
    successorFreshReviewerDesignated: true,
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
}

function buildLifecycle(packet) {
  const core = {
    schemaVersion: 1,
    lockId: 'successor-reviewer-lock-p73',
    lockOperatorRef: 'governance-operator:successor-p73',
    lockedAt: '2026-09-10T21:50:00.000Z',
    cycleId: packet.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: packet.successorFreshReactivationGovernanceCycleHashSha256,
    reviewRequestId: packet.reviewRequestId,
    successorFreshReviewPacketHashSha256: packet.successorFreshReviewPacketHashSha256,
    successorFreshReviewerDesignationHashSha256: packet.successorFreshReviewerDesignationHashSha256,
    reviewerRef: packet.independentReviewerRef,
    reviewerDisplayName: packet.reviewerDisplayName,
    successorReviewerRegistryHashSha256: h('reviewer-registry'),
    reviewerPublicKeySha256: h('reviewer-public-key'),
    verifiedSuccessorFreshReviewRecordHashSha256: h('verified-review-record'),
    reviewDecisionId: 'successor-review-approve-p73',
    reviewEvidenceSha256: h('review-evidence'),
    currentRegistryHashSha256: packet.currentRegistryHashSha256,
    currentRegistryContentSha256: packet.currentRegistryContentSha256,
    qualifiedSourceCommitSha: packet.qualifiedSourceCommitSha,
    releaseArtifactSha256: packet.releaseArtifactSha256,
    environmentConfigSha256: packet.environmentConfigSha256,
    cycleEvidenceArtifactSha256: packet.cycleEvidenceArtifactSha256,
    predecessorIncidentCloseoutPacketHashSha256: packet.predecessorIncidentCloseoutPacketHashSha256,
    predecessorHumanDecisionRecordHashSha256: packet.predecessorHumanDecisionRecordHashSha256,
    predecessorGovernanceResetRecordHashSha256: packet.predecessorGovernanceResetRecordHashSha256,
    predecessorRootCauseAnalysisSha256: packet.predecessorRootCauseAnalysisSha256,
    predecessorCorrectivePreventiveActionSha256: packet.predecessorCorrectivePreventiveActionSha256,
  };
  return {
    ...core,
    status: P67_STATUS.SUCCESSOR_FRESH_REVIEWER_LOCKED_BY_VERIFIED_REVIEW,
    verified: true,
    blockers: Object.freeze([]),
    successorFreshReviewerLifecycleLockHashSha256: sha256Object(successorReviewerLockCore(core)),
    successorFreshReviewerLifecycleLocked: true,
    reviewerReplacementAllowedNow: false,
    ownerMayReplaceReviewerBeforeVerifiedReview: false,
    acceptedVerifiedReviewFreezesReviewerReplacement: true,
    independentReviewCompleted: true,
    successorFreshReviewAccepted: true,
    p66ReviewRecomputed: true,
    reviewerIdentityCryptographicallyVerified: true,
    reviewerTrustRootVerified: true,
    reviewAttestationSignatureVerified: true,
    externalReviewArtifactContentVerifiedHere: false,
    predecessorReviewerAuthorityAccepted: false,
    predecessorActivationAuthorityAccepted: false,
    predecessorReviewerLifecycleLockReusable: false,
    predecessorReviewerApprovalReusable: false,
    successorFreshActivationPlanRequired: true,
    successorFreshShadowEvidenceRequired: true,
    successorFreshCutoverRehearsalRequired: true,
    successorFreshCutoverSafetyEvidenceRequired: true,
    successorFreshOwnerActivationAuthorizationRequired: true,
    successorFreshActivationChangeContractRequired: true,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    releaseStillBlocked: true,
    ...authorityFalse(),
  };
}

function buildActivationPlan(packet, lifecycle) {
  const manifest = {
    schemaVersion: 1,
    baselineId: `successor-fresh-reactivation:${packet.cycleId}`,
    baselineType: 'QUALIFIED_GIT_COMMIT_AND_RELEASE_ARTIFACT',
    cycleId: packet.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: packet.successorFreshReactivationGovernanceCycleHashSha256,
    qualifiedSourceCommitSha: packet.qualifiedSourceCommitSha,
    releaseArtifactSha256: packet.releaseArtifactSha256,
    environmentConfigSha256: packet.environmentConfigSha256,
    expectedPriorRegistryHashSha256: packet.currentRegistryHashSha256,
    expectedPriorRegistryContentSha256: packet.currentRegistryContentSha256,
    successorFreshReviewPacketHashSha256: packet.successorFreshReviewPacketHashSha256,
    successorFreshReviewerDesignationHashSha256: packet.successorFreshReviewerDesignationHashSha256,
    successorFreshReviewerLifecycleLockHashSha256: lifecycle.successorFreshReviewerLifecycleLockHashSha256,
    verifiedSuccessorFreshReviewRecordHashSha256: lifecycle.verifiedSuccessorFreshReviewRecordHashSha256,
    cycleEvidenceArtifactSha256: packet.cycleEvidenceArtifactSha256,
    predecessorIncidentCloseoutPacketHashSha256: packet.predecessorIncidentCloseoutPacketHashSha256,
    predecessorHumanDecisionRecordHashSha256: packet.predecessorHumanDecisionRecordHashSha256,
    predecessorGovernanceResetRecordHashSha256: packet.predecessorGovernanceResetRecordHashSha256,
    predecessorRootCauseAnalysisSha256: packet.predecessorRootCauseAnalysisSha256,
    predecessorCorrectivePreventiveActionSha256: packet.predecessorCorrectivePreventiveActionSha256,
  };
  const manifestHash = sha256Object(successorManifestCore(manifest));
  const core = {
    schemaVersion: 1,
    activationChangeId: 'successor-activation-change-p73',
    cycleId: packet.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: packet.successorFreshReactivationGovernanceCycleHashSha256,
    preparedByRef: packet.ownerActorRef,
    preparedAt: '2026-09-10T21:51:00.000Z',
    successorFreshReviewerLifecycleLockHashSha256: lifecycle.successorFreshReviewerLifecycleLockHashSha256,
    successorFreshBaselineManifest: manifest,
    successorFreshBaselineManifestHashSha256: manifestHash,
    targetActivationContract: {
      targetPath: 'config/governance/canonical-baseline.json',
      expectedPriorMode: 'LEGACY_FILE_SHA256',
      proposedMode: 'GOVERNED_COMPOSITE_BASELINE',
      expectedPriorRegistryHashSha256: packet.currentRegistryHashSha256,
      expectedPriorRegistryContentSha256: packet.currentRegistryContentSha256,
      successorFreshReactivationGovernanceCycleHashSha256: packet.successorFreshReactivationGovernanceCycleHashSha256,
      successorFreshReviewerLifecycleLockHashSha256: lifecycle.successorFreshReviewerLifecycleLockHashSha256,
    },
  };
  return {
    ...core,
    status: P68_STATUS.SUCCESSOR_FRESH_ACTIVATION_PLAN_READY_NOT_AUTHORIZED,
    verified: true,
    blockers: Object.freeze([]),
    successorFreshActivationPlanHashSha256: sha256Object(p68PlanCore(core)),
    explicitActivationChangeRequired: true,
    activationAuthorized: false,
    activationApplied: false,
    automaticBaselineSwitchAllowed: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    predecessorActivationPlanReusable: false,
    predecessorOwnerAuthorizationReusable: false,
    predecessorActivationContractReusable: false,
    successorFreshCompositeRegistryCandidateRequired: true,
    successorFreshShadowEvidenceRequired: true,
    successorFreshCutoverRehearsalRequired: true,
    successorFreshCutoverSafetyEvidenceRequired: true,
    successorFreshOwnerActivationAuthorizationRequired: true,
    successorFreshActivationChangeContractRequired: true,
    postChangeReleaseVerifyRequired: true,
    releaseStillBlocked: true,
    ...authorityFalse(),
  };
}

function buildShadow(packet, lifecycle, plan) {
  const core = {
    schemaVersion: 1,
    authoritativeMode: 'LEGACY_FILE_SHA256',
    shadowMode: 'GOVERNED_COMPOSITE_BASELINE',
    cycleId: packet.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: packet.successorFreshReactivationGovernanceCycleHashSha256,
    successorFreshReviewerLifecycleLockHashSha256: lifecycle.successorFreshReviewerLifecycleLockHashSha256,
    successorFreshActivationPlanHashSha256: plan.successorFreshActivationPlanHashSha256,
    successorFreshCompositeRegistryCandidateHashSha256: h('candidate-record'),
    currentRegistryHashSha256: packet.currentRegistryHashSha256,
    currentRegistryContentSha256: packet.currentRegistryContentSha256,
    candidateRegistryHashSha256: h('candidate-logical'),
    candidateRegistryContentSha256: h('candidate-content'),
    successorFreshCompositeEvidenceHashSha256: h('composite-evidence'),
    predecessorIncidentCloseoutPacketHashSha256: packet.predecessorIncidentCloseoutPacketHashSha256,
    predecessorHumanDecisionRecordHashSha256: packet.predecessorHumanDecisionRecordHashSha256,
    predecessorGovernanceResetRecordHashSha256: packet.predecessorGovernanceResetRecordHashSha256,
    predecessorRootCauseAnalysisSha256: packet.predecessorRootCauseAnalysisSha256,
    predecessorCorrectivePreventiveActionSha256: packet.predecessorCorrectivePreventiveActionSha256,
  };
  return {
    ...core,
    status: P71_STATUS.SUCCESSOR_FRESH_SHADOW_COMPOSITE_MATCH_NOT_ACTIVE,
    verified: true,
    blockers: Object.freeze([]),
    successorFreshShadowEvaluationHashSha256: sha256Object(p71ShadowCore(core)),
    shadowComparisonMatch: true,
    shadowOnly: true,
    candidateOnly: true,
    authoritativeBaselineRemainsLegacy: true,
    exactPriorRawRegistryVerified: true,
    activeRegistryChanged: false,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    successorFreshCutoverRehearsalRequired: true,
    successorFreshCutoverSafetyEvidenceRequired: true,
    successorFreshOwnerActivationAuthorizationRequired: true,
    successorFreshActivationChangeContractRequired: true,
    successorFreshModeVerifierRequired: true,
    postActivationReleaseVerifyRequired: true,
    releaseStillBlocked: true,
    ...authorityFalse(),
  };
}

(function run() {
  const registryPath = path.resolve('config/governance/canonical-baseline.json');
  const currentRegistryContent = fs.readFileSync(registryPath, 'utf8');
  const currentRegistry = JSON.parse(currentRegistryContent);
  const successorReviewPacket = finalizePacket(currentRegistry, currentRegistryContent);
  const reviewerLifecycle = buildLifecycle(successorReviewPacket);
  const activationPlan = buildActivationPlan(successorReviewPacket, reviewerLifecycle);
  const successorFreshShadowEvaluation = buildShadow(successorReviewPacket, reviewerLifecycle, activationPlan);
  const successorFreshRehearsalResult = runSuccessorFreshCompositeCutoverRehearsal({
    currentRegistry,
    currentRegistryContent,
    successorFreshShadowEvaluation,
    rehearsalId: 'successor-cutover-rehearsal-p73',
    preparedByRef: 'operator:successor-rehearsal-p73',
    preparedAt: '2026-09-10T21:55:00.000Z',
  });
  assert.match(successorFreshRehearsalResult.successorFreshCutoverRehearsalHashSha256, /^[a-f0-9]{64}$/);
  assert.strictEqual(sha256Object(p72RehearsalCore(successorFreshRehearsalResult)), successorFreshRehearsalResult.successorFreshCutoverRehearsalHashSha256);

  const input = {
    currentRegistry,
    currentRegistryContent,
    successorReviewPacket,
    reviewerLifecycle,
    activationPlan,
    successorFreshShadowEvaluation,
    successorFreshRehearsalResult,
  };
  const result = evaluateSuccessorFreshCompositeCutoverSafetyGuard(input);
  assert.strictEqual(result.status, STATUS.SUCCESSOR_FRESH_CUTOVER_SAFETY_GUARD_SATISFIED_NOT_AUTHORIZED);
  assert.strictEqual(result.verified, true);
  assert.strictEqual(result.reviewerLockVerified, true);
  assert.strictEqual(result.activationPlanVerified, true);
  assert.strictEqual(result.shadowMatchVerified, true);
  assert.strictEqual(result.rollbackRehearsalVerified, true);
  assert.strictEqual(result.exactRollbackLogicalIdentityVerified, true);
  assert.strictEqual(result.exactRollbackRawContentIdentityVerified, true);
  assert.strictEqual(result.safetyPrerequisitesSatisfiedForSuccessorFreshOwnerAuthorization, true);
  assert.strictEqual(result.activationAuthorized, false);
  assert.strictEqual(result.activationApplied, false);
  assert.strictEqual(result.reactivationAuthorized, false);
  assert.strictEqual(result.currentBaselineMutationPerformed, false);
  assert.strictEqual(result.releaseStillBlocked, true);
  assert.match(result.successorFreshCutoverSafetyGuardHashSha256, /^[a-f0-9]{64}$/);
  for (const key of Object.keys(AUTHORITY)) assert.strictEqual(result[key], false);
  assert.strictEqual(evaluateSuccessorFreshCompositeCutoverSafetyGuard(input).successorFreshCutoverSafetyGuardHashSha256, result.successorFreshCutoverSafetyGuardHashSha256);

  const rawDrift = evaluateSuccessorFreshCompositeCutoverSafetyGuard({ ...input, currentRegistryContent: `${currentRegistryContent} ` });
  assert.strictEqual(rawDrift.status, STATUS.HOLD_SUCCESSOR_FRESH_CUTOVER_SAFETY_GUARD);
  assert(rawDrift.blockers.some((x) => /CONTENT/.test(x)));

  const tamperedLifecycle = JSON.parse(JSON.stringify(reviewerLifecycle));
  tamperedLifecycle.successorFreshReviewerLifecycleLockHashSha256 = h('tampered-lock');
  const badLifecycle = evaluateSuccessorFreshCompositeCutoverSafetyGuard({ ...input, reviewerLifecycle: tamperedLifecycle });
  assert.strictEqual(badLifecycle.status, STATUS.HOLD_SUCCESSOR_FRESH_CUTOVER_SAFETY_GUARD);
  assert(badLifecycle.blockers.includes('P67_SUCCESSOR_REVIEWER_LIFECYCLE_LOCK_HASH_MISMATCH'));

  const tamperedPlan = JSON.parse(JSON.stringify(activationPlan));
  tamperedPlan.successorFreshActivationPlanHashSha256 = h('tampered-plan');
  const badPlan = evaluateSuccessorFreshCompositeCutoverSafetyGuard({ ...input, activationPlan: tamperedPlan });
  assert.strictEqual(badPlan.status, STATUS.HOLD_SUCCESSOR_FRESH_CUTOVER_SAFETY_GUARD);

  const tamperedShadow = JSON.parse(JSON.stringify(successorFreshShadowEvaluation));
  tamperedShadow.successorFreshShadowEvaluationHashSha256 = h('tampered-shadow');
  const badShadow = evaluateSuccessorFreshCompositeCutoverSafetyGuard({ ...input, successorFreshShadowEvaluation: tamperedShadow });
  assert.strictEqual(badShadow.status, STATUS.HOLD_SUCCESSOR_FRESH_CUTOVER_SAFETY_GUARD);
  assert(badShadow.blockers.includes('P71_SUCCESSOR_FRESH_SHADOW_HASH_MISMATCH'));

  const tamperedRehearsal = JSON.parse(JSON.stringify(successorFreshRehearsalResult));
  tamperedRehearsal.transitions[2].registryContentSha256 = h('wrong-rollback-content');
  const badRehearsal = evaluateSuccessorFreshCompositeCutoverSafetyGuard({ ...input, successorFreshRehearsalResult: tamperedRehearsal });
  assert.strictEqual(badRehearsal.status, STATUS.HOLD_SUCCESSOR_FRESH_CUTOVER_SAFETY_GUARD);
  assert(badRehearsal.blockers.includes('P72_SUCCESSOR_FRESH_REHEARSAL_HASH_MISMATCH'));
  assert(badRehearsal.blockers.includes('P72_EXACT_LOGICAL_AND_RAW_ROLLBACK_NOT_PROVEN'));

  const escalated = evaluateSuccessorFreshCompositeCutoverSafetyGuard({ ...input, activationAuthorized: true });
  assert.strictEqual(escalated.status, STATUS.HOLD_SUCCESSOR_FRESH_CUTOVER_SAFETY_GUARD);
  assert(escalated.blockers.includes('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED'));

  const keyMaterial = evaluateSuccessorFreshCompositeCutoverSafetyGuard({ ...input, nested: { privateKeyPem: 'forbidden' } });
  assert.strictEqual(keyMaterial.status, STATUS.HOLD_SUCCESSOR_FRESH_CUTOVER_SAFETY_GUARD);
  assert(keyMaterial.blockers.some((x) => x.startsWith('PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:')));

  assert.throws(() => parseArgs(['--shadow', 'a.json', '--shadow', 'b.json']), /duplicate argument/);
  assert.throws(() => parseArgs(['--unknown', 'x']), /unknown argument/);
  assert.throws(() => parseArgs(['--secret-key', 'secret.pem']), /private or secret key argument rejected/);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p73-safety-'));
  fs.rmSync(dir, { recursive: true, force: true });
  process.stdout.write('P73 successor fresh composite cutover safety guard tests passed\n');
})();
