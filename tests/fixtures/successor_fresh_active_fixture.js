'use strict';

const fs = require('fs');
const crypto = require('crypto');
const {
  AUTHORITY,
  stableStringify,
  evaluateCurrentCanonicalBaselineRegistry,
} = require('../../src/qualification/canonical-baseline-registry');
const { STATUS: P65_STATUS } = require('../../src/qualification/successor-fresh-independent-review-handoff');
const { designationCore, reviewPacketCore } = require('../../src/qualification/successor-fresh-review-attestation');
const { STATUS: P67_STATUS } = require('../../src/qualification/successor-fresh-reviewer-lifecycle-lock');
const { STATUS: P68_STATUS, successorReviewerLockCore } = require('../../src/qualification/successor-fresh-activation-plan');
const {
  successorManifestCore,
  p68PlanCore,
  createSuccessorFreshCompositeRegistryCandidate,
} = require('../../src/qualification/successor-fresh-composite-registry-candidate');
const { verifySuccessorFreshCompositeEvidence } = require('../../src/qualification/successor-fresh-composite-evidence-verifier');
const { evaluateSuccessorFreshCompositeShadow } = require('../../src/qualification/successor-fresh-composite-shadow-release-gate');
const { runSuccessorFreshCompositeCutoverRehearsal } = require('../../src/qualification/successor-fresh-composite-cutover-rehearsal');
const { evaluateSuccessorFreshCompositeCutoverSafetyGuard } = require('../../src/qualification/successor-fresh-composite-cutover-safety-guard');
const {
  PURPOSE,
  DECISION,
  normalizeSuccessorFreshOwnerAuthorityRegistry,
  prepareSuccessorFreshOwnerActivationAuthorization,
} = require('../../src/qualification/successor-fresh-owner-activation-authorization');
const { createSuccessorFreshActivationChangeContract } = require('../../src/qualification/successor-fresh-activation-change-contract');

function sha256Text(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }
function sha256Bytes(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function sha256Object(value) { return sha256Text(stableStringify(value)); }
function h(label) { return sha256Text(`successor-active-fixture:${label}`); }
function authorityFalse() { return Object.fromEntries(Object.keys(AUTHORITY).map((key) => [key, false])); }

function buildPacket(currentRegistry, currentRegistryContent, releaseArtifactBytes, environmentConfigBytes) {
  const observed = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  const designation = {
    schemaVersion: 1,
    designationId: 'successor-designation-p76',
    cycleId: 'successor-cycle-011',
    successorFreshReactivationGovernanceCycleHashSha256: h('cycle'),
    designatedByRef: 'owner:successor-p76',
    reviewerRef: 'reviewer:successor-independent-p76',
    reviewerDisplayName: 'Successor Independent Reviewer P76',
    designatedAt: '2026-09-10T22:50:00.000Z',
    designationSourceRef: 'governance://successor-reviewer-designation/p76',
    designationArtifactSha256: h('designation-artifact'),
  };
  designation.successorFreshReviewerDesignationHashSha256 = sha256Object(designationCore(designation));
  const core = {
    schemaVersion: 1,
    reviewRequestId: 'successor-review-request-p76',
    requestedAt: '2026-09-10T22:51:00.000Z',
    cycleId: designation.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: designation.successorFreshReactivationGovernanceCycleHashSha256,
    ownerActorRef: designation.designatedByRef,
    currentAuthoritativeMode: 'LEGACY_FILE_SHA256',
    currentRegistryHashSha256: observed.registryHashSha256,
    currentRegistryContentSha256: sha256Text(currentRegistryContent),
    requestedTargetMode: 'GOVERNED_COMPOSITE_BASELINE',
    qualifiedSourceCommitSha: 'c'.repeat(40),
    releaseArtifactSha256: sha256Bytes(releaseArtifactBytes),
    environmentConfigSha256: sha256Bytes(environmentConfigBytes),
    cycleEvidenceArtifactSha256: h('cycle-evidence'),
    predecessorIncidentCloseoutPacketHashSha256: h('predecessor-closeout'),
    predecessorHumanDecisionRecordHashSha256: h('predecessor-human'),
    predecessorGovernanceResetRecordHashSha256: h('predecessor-reset'),
    predecessorRootCauseAnalysisSha256: h('predecessor-rca'),
    predecessorCorrectivePreventiveActionSha256: h('predecessor-capa'),
    successorFreshReviewerDesignationHashSha256: designation.successorFreshReviewerDesignationHashSha256,
    independentReviewerRef: designation.reviewerRef,
    reviewerDisplayName: designation.reviewerDisplayName,
    reviewChecklist: Object.freeze(['CONFIRM_SUCCESSOR_P76_SCOPE']),
  };
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
    lockId: 'successor-reviewer-lock-p76',
    lockOperatorRef: 'governance-operator:successor-p76',
    lockedAt: '2026-09-10T22:55:00.000Z',
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
    reviewDecisionId: 'successor-review-approve-p76',
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
    activationChangeId: 'successor-activation-change-p76',
    cycleId: packet.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: packet.successorFreshReactivationGovernanceCycleHashSha256,
    preparedByRef: packet.ownerActorRef,
    preparedAt: '2026-09-10T22:56:00.000Z',
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

function buildSuccessorFreshActiveFixture() {
  const currentRegistryContent = fs.readFileSync('config/governance/canonical-baseline.json', 'utf8');
  const currentRegistry = JSON.parse(currentRegistryContent);
  const releaseArtifactBytes = Buffer.from('p76-release-artifact\n', 'utf8');
  const environmentConfigBytes = Buffer.from('p76-environment-config\n', 'utf8');
  const successorReviewPacket = buildPacket(currentRegistry, currentRegistryContent, releaseArtifactBytes, environmentConfigBytes);
  const reviewerLifecycle = buildLifecycle(successorReviewPacket);
  const activationPlan = buildActivationPlan(successorReviewPacket, reviewerLifecycle);
  const successorFreshCompositeCandidate = createSuccessorFreshCompositeRegistryCandidate({ activationPlan, currentRegistry, currentRegistryContent });
  const successorFreshCompositeEvidence = verifySuccessorFreshCompositeEvidence({
    candidate: successorFreshCompositeCandidate,
    activationPlan,
    currentRegistry,
    currentRegistryContent,
    observedSourceCommitSha: activationPlan.successorFreshBaselineManifest.qualifiedSourceCommitSha,
    releaseArtifactBytes,
    environmentConfigBytes,
    evidenceId: 'successor-evidence-p76',
    evidenceOperatorRef: 'operator:successor-evidence-p76',
    verifiedAt: '2026-09-10T22:58:00.000Z',
    releaseArtifactRef: 'artifact://successor/p76/release',
    environmentConfigRef: 'config://successor/p76/environment',
  });
  const successorFreshShadowEvaluation = evaluateSuccessorFreshCompositeShadow({
    currentRegistry,
    currentRegistryContent,
    successorFreshCompositeCandidate,
    successorFreshCompositeEvidence,
  });
  const successorFreshRehearsalResult = runSuccessorFreshCompositeCutoverRehearsal({
    currentRegistry,
    currentRegistryContent,
    successorFreshShadowEvaluation,
    rehearsalId: 'successor-cutover-rehearsal-p76',
    preparedByRef: 'operator:successor-rehearsal-p76',
    preparedAt: '2026-09-10T23:00:00.000Z',
  });
  const safetyGuard = evaluateSuccessorFreshCompositeCutoverSafetyGuard({
    currentRegistry,
    currentRegistryContent,
    successorReviewPacket,
    reviewerLifecycle,
    activationPlan,
    successorFreshShadowEvaluation,
    successorFreshRehearsalResult,
  });

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).trim();
  const successorFreshOwnerAuthorityRegistry = {
    schemaVersion: 1,
    purpose: PURPOSE,
    cycleId: activationPlan.cycleId,
    authorities: [{
      authorityId: 'successor-owner-authority-p76',
      actorRef: activationPlan.preparedByRef,
      publicKeyPem,
      publicKeySha256: sha256Text(publicKeyPem),
      governanceEvidenceRef: 'governance://successor-owner-authority/p76',
      activeFrom: '2026-09-10T22:00:00.000Z',
      activeUntil: null,
      allowedPurpose: PURPOSE,
      allowedCycleId: activationPlan.cycleId,
    }],
  };
  const normalizedRegistry = normalizeSuccessorFreshOwnerAuthorityRegistry(successorFreshOwnerAuthorityRegistry, activationPlan.cycleId);
  const unsignedOwnerDecision = {
    decisionId: 'successor-owner-decision-p76',
    authorityId: 'successor-owner-authority-p76',
    actorRef: activationPlan.preparedByRef,
    decision: DECISION,
    decisionSourceRef: 'governance://successor-owner-decision/p76',
    decisionArtifactSha256: h('owner-decision-artifact'),
    decidedAt: '2026-09-10T23:05:00.000Z',
    rationaleRef: 'governance://successor-owner-rationale/p76',
    signatureAlgorithm: 'RSA-SHA256',
  };
  const p74Input = {
    safetyGuard,
    currentRegistry,
    currentRegistryContent,
    successorReviewPacket,
    reviewerLifecycle,
    activationPlan,
    successorFreshShadowEvaluation,
    successorFreshRehearsalResult,
    successorFreshOwnerAuthorityRegistry,
    expectedSuccessorFreshOwnerAuthorityRegistryHashSha256: normalizedRegistry.successorOwnerAuthorityRegistryHashSha256,
    decision: unsignedOwnerDecision,
  };
  const preparedOwner = prepareSuccessorFreshOwnerActivationAuthorization(p74Input);
  const signatureBase64 = crypto.sign('RSA-SHA256', Buffer.from(stableStringify(preparedOwner.signingPayload), 'utf8'), privateKey).toString('base64');
  const signedOwnerDecision = { ...unsignedOwnerDecision, signatureBase64 };

  const activationChangeContract = createSuccessorFreshActivationChangeContract({
    currentRegistry,
    currentRegistryContent,
    successorReviewPacket,
    reviewerLifecycle,
    activationPlan,
    successorFreshCompositeCandidate,
    successorFreshShadowEvaluation,
    successorFreshRehearsalResult,
    safetyGuard,
    successorFreshOwnerAuthorityRegistry,
    expectedSuccessorFreshOwnerAuthorityRegistryHashSha256: normalizedRegistry.successorOwnerAuthorityRegistryHashSha256,
    signedOwnerDecision,
    contractId: 'successor-fresh-activation-contract-p76',
    preparedByRef: activationPlan.preparedByRef,
    preparedAt: '2026-09-10T23:06:00.000Z',
  });

  return {
    currentRegistry,
    currentRegistryContent,
    successorReviewPacket,
    reviewerLifecycle,
    activationPlan,
    successorFreshCompositeCandidate,
    successorFreshCompositeEvidence,
    successorFreshShadowEvaluation,
    successorFreshRehearsalResult,
    safetyGuard,
    successorFreshOwnerAuthorityRegistry,
    expectedSuccessorFreshOwnerAuthorityRegistryHashSha256: normalizedRegistry.successorOwnerAuthorityRegistryHashSha256,
    signedOwnerDecision,
    activationChangeContract,
    activeRegistry: activationChangeContract.proposedRegistry,
    activeRegistryContent: activationChangeContract.proposedRegistryContent,
  };
}

module.exports = {
  sha256Text,
  sha256Object,
  buildSuccessorFreshActiveFixture,
};
