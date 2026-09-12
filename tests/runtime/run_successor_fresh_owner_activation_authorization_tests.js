'use strict';

const assert = require('assert');
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
const { successorManifestCore, p68PlanCore } = require('../../src/qualification/successor-fresh-composite-registry-candidate');
const { STATUS: P71_STATUS } = require('../../src/qualification/successor-fresh-composite-shadow-release-gate');
const { p71ShadowCore, runSuccessorFreshCompositeCutoverRehearsal } = require('../../src/qualification/successor-fresh-composite-cutover-rehearsal');
const { evaluateSuccessorFreshCompositeCutoverSafetyGuard } = require('../../src/qualification/successor-fresh-composite-cutover-safety-guard');
const {
  PURPOSE,
  DECISION,
  STATUS,
  normalizeSuccessorFreshOwnerAuthorityRegistry,
  prepareSuccessorFreshOwnerActivationAuthorization,
  verifySuccessorFreshOwnerActivationAuthorization,
} = require('../../src/qualification/successor-fresh-owner-activation-authorization');
const { parseArgs } = require('../../tools/successor-fresh-owner-activation-authorization');

function sha256Text(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }
function sha256Object(value) { return sha256Text(stableStringify(value)); }
function h(label) { return sha256Text(`p74:${label}`); }
function authorityFalse() { return Object.fromEntries(Object.keys(AUTHORITY).map((key) => [key, false])); }

function buildPacket(currentRegistry, currentRegistryContent) {
  const observed = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  const designation = {
    schemaVersion: 1,
    designationId: 'successor-designation-p74',
    cycleId: 'successor-cycle-009',
    successorFreshReactivationGovernanceCycleHashSha256: h('cycle'),
    designatedByRef: 'owner:successor-p74',
    reviewerRef: 'reviewer:successor-independent-p74',
    reviewerDisplayName: 'Successor Independent Reviewer P74',
    designatedAt: '2026-09-10T21:40:00.000Z',
    designationSourceRef: 'governance://successor-reviewer-designation/p74',
    designationArtifactSha256: h('designation-artifact'),
  };
  designation.successorFreshReviewerDesignationHashSha256 = sha256Object(designationCore(designation));
  const core = {
    schemaVersion: 1,
    reviewRequestId: 'successor-review-request-p74',
    requestedAt: '2026-09-10T21:41:00.000Z',
    cycleId: designation.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: designation.successorFreshReactivationGovernanceCycleHashSha256,
    ownerActorRef: designation.designatedByRef,
    currentAuthoritativeMode: 'LEGACY_FILE_SHA256',
    currentRegistryHashSha256: observed.registryHashSha256,
    currentRegistryContentSha256: sha256Text(currentRegistryContent),
    requestedTargetMode: 'GOVERNED_COMPOSITE_BASELINE',
    qualifiedSourceCommitSha: 'a'.repeat(40),
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
    reviewChecklist: Object.freeze(['CONFIRM_SUCCESSOR_P74_SCOPE']),
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
    lockId: 'successor-reviewer-lock-p74',
    lockOperatorRef: 'governance-operator:successor-p74',
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
    reviewDecisionId: 'successor-review-approve-p74',
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
    activationChangeId: 'successor-activation-change-p74',
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
  const currentRegistryContent = fs.readFileSync('config/governance/canonical-baseline.json', 'utf8');
  const currentRegistry = JSON.parse(currentRegistryContent);
  const successorReviewPacket = buildPacket(currentRegistry, currentRegistryContent);
  const reviewerLifecycle = buildLifecycle(successorReviewPacket);
  const activationPlan = buildActivationPlan(successorReviewPacket, reviewerLifecycle);
  const successorFreshShadowEvaluation = buildShadow(successorReviewPacket, reviewerLifecycle, activationPlan);
  const successorFreshRehearsalResult = runSuccessorFreshCompositeCutoverRehearsal({
    currentRegistry,
    currentRegistryContent,
    successorFreshShadowEvaluation,
    rehearsalId: 'successor-cutover-rehearsal-p74',
    preparedByRef: 'operator:successor-rehearsal-p74',
    preparedAt: '2026-09-10T21:55:00.000Z',
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
  assert.strictEqual(safetyGuard.verified, true);

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).trim();
  const authorityRegistryInput = {
    schemaVersion: 1,
    purpose: PURPOSE,
    cycleId: activationPlan.cycleId,
    authorities: [{
      authorityId: 'successor-owner-authority-p74',
      actorRef: activationPlan.preparedByRef,
      publicKeyPem,
      publicKeySha256: sha256Text(publicKeyPem),
      governanceEvidenceRef: 'governance://successor-owner-authority/p74',
      activeFrom: '2026-09-10T21:00:00.000Z',
      activeUntil: null,
      allowedPurpose: PURPOSE,
      allowedCycleId: activationPlan.cycleId,
    }],
  };
  const authorityRegistry = normalizeSuccessorFreshOwnerAuthorityRegistry(authorityRegistryInput, activationPlan.cycleId);
  const decision = {
    decisionId: 'successor-owner-decision-p74',
    authorityId: 'successor-owner-authority-p74',
    actorRef: activationPlan.preparedByRef,
    decision: DECISION,
    decisionSourceRef: 'governance://successor-owner-decision/p74',
    decisionArtifactSha256: h('owner-decision-artifact'),
    decidedAt: '2026-09-10T22:10:00.000Z',
    rationaleRef: 'governance://successor-owner-rationale/p74',
    signatureAlgorithm: 'RSA-SHA256',
  };
  const input = {
    safetyGuard,
    currentRegistry,
    currentRegistryContent,
    successorReviewPacket,
    reviewerLifecycle,
    activationPlan,
    successorFreshShadowEvaluation,
    successorFreshRehearsalResult,
    successorFreshOwnerAuthorityRegistry: authorityRegistryInput,
    expectedSuccessorFreshOwnerAuthorityRegistryHashSha256: authorityRegistry.successorOwnerAuthorityRegistryHashSha256,
    decision,
  };

  const prepared = prepareSuccessorFreshOwnerActivationAuthorization(input);
  assert.strictEqual(prepared.status, STATUS.READY_FOR_EXTERNAL_SUCCESSOR_FRESH_OWNER_SIGNATURE);
  assert.strictEqual(prepared.verified, true);
  assert.strictEqual(prepared.externalSigningRequired, true);
  assert.strictEqual(prepared.repositorySigningPerformed, false);
  assert.strictEqual(prepared.privateSigningKeyAccepted, false);
  assert.strictEqual(prepared.predecessorFreshOwnerAuthorizationReusable, false);
  assert.strictEqual(prepared.ownerTrustRootVerified, true);
  assert.strictEqual(prepared.ownerActivationAuthorizationVerified, false);
  assert.strictEqual(prepared.activationAuthorized, false);
  assert.strictEqual(prepared.activationApplied, false);
  assert.strictEqual(prepared.releaseStillBlocked, true);
  assert.strictEqual(prepared.signingPayload.proposedRegistrySchemaVersion, 4);
  assert.strictEqual(prepared.signingPayload.successorFreshCutoverSafetyGuardHashSha256, safetyGuard.successorFreshCutoverSafetyGuardHashSha256);
  for (const key of Object.keys(AUTHORITY)) assert.strictEqual(prepared[key], false);

  const signatureBase64 = crypto.sign(
    'RSA-SHA256',
    Buffer.from(stableStringify(prepared.signingPayload), 'utf8'),
    privateKey,
  ).toString('base64');
  const verified = verifySuccessorFreshOwnerActivationAuthorization({
    ...input,
    decision: { ...decision, signatureBase64 },
  });
  assert.strictEqual(verified.status, STATUS.SUCCESSOR_FRESH_OWNER_ACTIVATION_AUTHORIZATION_CRYPTOGRAPHICALLY_VERIFIED_NOT_APPLIED);
  assert.strictEqual(verified.verified, true);
  assert.strictEqual(verified.ownerIdentityCryptographicallyVerified, true);
  assert.strictEqual(verified.ownerTrustRootVerified, true);
  assert.strictEqual(verified.ownerSignatureVerified, true);
  assert.strictEqual(verified.ownerActivationAuthorizationVerified, true);
  assert.strictEqual(verified.activationAuthorized, false);
  assert.strictEqual(verified.activationApplied, false);
  assert.strictEqual(verified.reactivationAuthorized, false);
  assert.strictEqual(verified.releaseStillBlocked, true);
  assert.match(verified.verifiedSuccessorFreshOwnerAuthorizationRecordHashSha256, /^[a-f0-9]{64}$/);
  assert.match(verified.verifiedOwnerAuthorizationRecord.signatureSha256, /^[a-f0-9]{64}$/);
  for (const key of Object.keys(AUTHORITY)) assert.strictEqual(verified[key], false);

  const invalidSignature = verifySuccessorFreshOwnerActivationAuthorization({
    ...input,
    decision: { ...decision, signatureBase64: Buffer.alloc(256, 7).toString('base64') },
  });
  assert.strictEqual(invalidSignature.status, STATUS.HOLD_SUCCESSOR_FRESH_OWNER_ACTIVATION_AUTHORIZATION);
  assert(invalidSignature.blockers.includes('SUCCESSOR_FRESH_OWNER_SIGNATURE_INVALID'));

  const invalidEncoding = verifySuccessorFreshOwnerActivationAuthorization({
    ...input,
    decision: { ...decision, signatureBase64: 'not-base64!' },
  });
  assert.strictEqual(invalidEncoding.status, STATUS.HOLD_SUCCESSOR_FRESH_OWNER_ACTIVATION_AUTHORIZATION);
  assert(invalidEncoding.blockers.includes('SUCCESSOR_FRESH_OWNER_SIGNATURE_ENCODING_INVALID'));

  const wrongRegistryHash = prepareSuccessorFreshOwnerActivationAuthorization({
    ...input,
    expectedSuccessorFreshOwnerAuthorityRegistryHashSha256: h('wrong-registry-hash'),
  });
  assert.strictEqual(wrongRegistryHash.status, STATUS.HOLD_SUCCESSOR_FRESH_OWNER_ACTIVATION_AUTHORIZATION);
  assert(wrongRegistryHash.blockers.includes('SUCCESSOR_FRESH_OWNER_AUTHORITY_REGISTRY_HASH_MISMATCH'));

  const wrongCycleRegistry = JSON.parse(JSON.stringify(authorityRegistryInput));
  wrongCycleRegistry.cycleId = 'different-successor-cycle';
  wrongCycleRegistry.authorities[0].allowedCycleId = 'different-successor-cycle';
  const wrongCycle = prepareSuccessorFreshOwnerActivationAuthorization({ ...input, successorFreshOwnerAuthorityRegistry: wrongCycleRegistry });
  assert.strictEqual(wrongCycle.status, STATUS.HOLD_SUCCESSOR_FRESH_OWNER_ACTIVATION_AUTHORIZATION);
  assert(wrongCycle.blockers.includes('SUCCESSOR_FRESH_OWNER_AUTHORITY_REGISTRY_CYCLE_MISMATCH'));

  const tamperedSafety = JSON.parse(JSON.stringify(safetyGuard));
  tamperedSafety.successorFreshCutoverSafetyGuardHashSha256 = h('tampered-safety');
  const badSafety = prepareSuccessorFreshOwnerActivationAuthorization({ ...input, safetyGuard: tamperedSafety });
  assert.strictEqual(badSafety.status, STATUS.HOLD_SUCCESSOR_FRESH_OWNER_ACTIVATION_AUTHORIZATION);
  assert(badSafety.blockers.includes('P73_SUCCESSOR_FRESH_CUTOVER_SAFETY_HASH_MISMATCH'));

  const rawDrift = prepareSuccessorFreshOwnerActivationAuthorization({ ...input, currentRegistryContent: `${currentRegistryContent} ` });
  assert.strictEqual(rawDrift.status, STATUS.HOLD_SUCCESSOR_FRESH_OWNER_ACTIVATION_AUTHORIZATION);
  assert(rawDrift.blockers.some((x) => /CONTENT/.test(x)));

  const wrongActor = prepareSuccessorFreshOwnerActivationAuthorization({ ...input, decision: { ...decision, actorRef: 'owner:wrong' } });
  assert.strictEqual(wrongActor.status, STATUS.HOLD_SUCCESSOR_FRESH_OWNER_ACTIVATION_AUTHORIZATION);
  assert(wrongActor.blockers.includes('SUCCESSOR_FRESH_ACTIVATION_MUST_BE_AUTHORIZED_BY_CYCLE_OWNER'));

  const staleDecision = prepareSuccessorFreshOwnerActivationAuthorization({ ...input, decision: { ...decision, decidedAt: '2026-09-10T21:52:00.000Z' } });
  assert.strictEqual(staleDecision.status, STATUS.HOLD_SUCCESSOR_FRESH_OWNER_ACTIVATION_AUTHORIZATION);
  assert(staleDecision.blockers.includes('SUCCESSOR_FRESH_OWNER_DECISION_PRECEDES_CUTOVER_REHEARSAL'));

  const predecessorReuse = prepareSuccessorFreshOwnerActivationAuthorization({
    ...input,
    verifiedFreshOwnerAuthorizationRecordHashSha256: h('old-p56-owner-auth'),
  });
  assert.strictEqual(predecessorReuse.status, STATUS.HOLD_SUCCESSOR_FRESH_OWNER_ACTIVATION_AUTHORIZATION);
  assert(predecessorReuse.blockers.some((x) => x.startsWith('PREDECESSOR_FRESH_OWNER_AUTHORIZATION_REUSE_NOT_ALLOWED:')));

  const escalated = prepareSuccessorFreshOwnerActivationAuthorization({ ...input, releaseAuthorized: true });
  assert.strictEqual(escalated.status, STATUS.HOLD_SUCCESSOR_FRESH_OWNER_ACTIVATION_AUTHORIZATION);
  assert(escalated.blockers.includes('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED'));

  const keyMaterial = prepareSuccessorFreshOwnerActivationAuthorization({ ...input, nested: { privateKeyPem: 'forbidden' } });
  assert.strictEqual(keyMaterial.status, STATUS.HOLD_SUCCESSOR_FRESH_OWNER_ACTIVATION_AUTHORIZATION);
  assert(keyMaterial.blockers.some((x) => x.startsWith('PRIVATE_SIGNING_KEY_MATERIAL_REJECTED:')));

  assert.throws(() => parseArgs(['--mode', 'prepare', '--mode', 'verify']), /duplicate argument/);
  assert.throws(() => parseArgs(['--unknown', 'x']), /unknown argument/);
  assert.throws(() => parseArgs(['--private-key', 'key.pem']), /private or secret key argument rejected/);
  assert.throws(() => parseArgs(['--mode', 'sign']), /missing required argument|mode must be prepare or verify/);

  process.stdout.write('P74 successor fresh owner activation authorization tests passed\n');
})();
