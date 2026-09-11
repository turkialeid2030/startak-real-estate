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
const {
  STATUS,
  TARGET_PATH,
  createSuccessorFreshActivationChangeContract,
} = require('../../src/qualification/successor-fresh-activation-change-contract');
const { parseArgs } = require('../../tools/successor-fresh-activation-change-contract');

function sha256Text(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }
function sha256Bytes(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function sha256Object(value) { return sha256Text(stableStringify(value)); }
function h(label) { return sha256Text(`p75:${label}`); }
function authorityFalse() { return Object.fromEntries(Object.keys(AUTHORITY).map((key) => [key, false])); }

function buildPacket(currentRegistry, currentRegistryContent, releaseArtifactBytes, environmentConfigBytes) {
  const observed = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  const designation = {
    schemaVersion: 1,
    designationId: 'successor-designation-p75',
    cycleId: 'successor-cycle-010',
    successorFreshReactivationGovernanceCycleHashSha256: h('cycle'),
    designatedByRef: 'owner:successor-p75',
    reviewerRef: 'reviewer:successor-independent-p75',
    reviewerDisplayName: 'Successor Independent Reviewer P75',
    designatedAt: '2026-09-10T22:20:00.000Z',
    designationSourceRef: 'governance://successor-reviewer-designation/p75',
    designationArtifactSha256: h('designation-artifact'),
  };
  designation.successorFreshReviewerDesignationHashSha256 = sha256Object(designationCore(designation));
  const core = {
    schemaVersion: 1,
    reviewRequestId: 'successor-review-request-p75',
    requestedAt: '2026-09-10T22:21:00.000Z',
    cycleId: designation.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: designation.successorFreshReactivationGovernanceCycleHashSha256,
    ownerActorRef: designation.designatedByRef,
    currentAuthoritativeMode: 'LEGACY_FILE_SHA256',
    currentRegistryHashSha256: observed.registryHashSha256,
    currentRegistryContentSha256: sha256Text(currentRegistryContent),
    requestedTargetMode: 'GOVERNED_COMPOSITE_BASELINE',
    qualifiedSourceCommitSha: 'b'.repeat(40),
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
    reviewChecklist: Object.freeze(['CONFIRM_SUCCESSOR_P75_SCOPE']),
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
    lockId: 'successor-reviewer-lock-p75',
    lockOperatorRef: 'governance-operator:successor-p75',
    lockedAt: '2026-09-10T22:30:00.000Z',
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
    reviewDecisionId: 'successor-review-approve-p75',
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
    activationChangeId: 'successor-activation-change-p75',
    cycleId: packet.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: packet.successorFreshReactivationGovernanceCycleHashSha256,
    preparedByRef: packet.ownerActorRef,
    preparedAt: '2026-09-10T22:31:00.000Z',
    successorFreshReviewerLifecycleLockHashSha256: lifecycle.successorFreshReviewerLifecycleLockHashSha256,
    successorFreshBaselineManifest: manifest,
    successorFreshBaselineManifestHashSha256: manifestHash,
    targetActivationContract: {
      targetPath: TARGET_PATH,
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

(function run() {
  const currentRegistryContent = fs.readFileSync('config/governance/canonical-baseline.json', 'utf8');
  const currentRegistry = JSON.parse(currentRegistryContent);
  const releaseArtifactBytes = Buffer.from('p75-release-artifact\n', 'utf8');
  const environmentConfigBytes = Buffer.from('p75-environment-config\n', 'utf8');
  const successorReviewPacket = buildPacket(currentRegistry, currentRegistryContent, releaseArtifactBytes, environmentConfigBytes);
  const reviewerLifecycle = buildLifecycle(successorReviewPacket);
  const activationPlan = buildActivationPlan(successorReviewPacket, reviewerLifecycle);

  const successorFreshCompositeCandidate = createSuccessorFreshCompositeRegistryCandidate({
    activationPlan,
    currentRegistry,
    currentRegistryContent,
  });
  assert.strictEqual(successorFreshCompositeCandidate.verified, true);
  assert.strictEqual(successorFreshCompositeCandidate.proposedRegistry.schemaVersion, 4);

  const successorFreshCompositeEvidence = verifySuccessorFreshCompositeEvidence({
    candidate: successorFreshCompositeCandidate,
    activationPlan,
    currentRegistry,
    currentRegistryContent,
    observedSourceCommitSha: activationPlan.successorFreshBaselineManifest.qualifiedSourceCommitSha,
    releaseArtifactBytes,
    environmentConfigBytes,
    evidenceId: 'successor-evidence-p75',
    evidenceOperatorRef: 'operator:successor-evidence-p75',
    verifiedAt: '2026-09-10T22:34:00.000Z',
    releaseArtifactRef: 'artifact://successor/p75/release',
    environmentConfigRef: 'config://successor/p75/environment',
  });
  assert.strictEqual(successorFreshCompositeEvidence.verified, true);

  const successorFreshShadowEvaluation = evaluateSuccessorFreshCompositeShadow({
    currentRegistry,
    currentRegistryContent,
    successorFreshCompositeCandidate,
    successorFreshCompositeEvidence,
  });
  assert.strictEqual(successorFreshShadowEvaluation.verified, true);

  const successorFreshRehearsalResult = runSuccessorFreshCompositeCutoverRehearsal({
    currentRegistry,
    currentRegistryContent,
    successorFreshShadowEvaluation,
    rehearsalId: 'successor-cutover-rehearsal-p75',
    preparedByRef: 'operator:successor-rehearsal-p75',
    preparedAt: '2026-09-10T22:36:00.000Z',
  });
  assert.strictEqual(successorFreshRehearsalResult.verified, true);

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
  const successorFreshOwnerAuthorityRegistry = {
    schemaVersion: 1,
    purpose: PURPOSE,
    cycleId: activationPlan.cycleId,
    authorities: [{
      authorityId: 'successor-owner-authority-p75',
      actorRef: activationPlan.preparedByRef,
      publicKeyPem,
      publicKeySha256: sha256Text(publicKeyPem),
      governanceEvidenceRef: 'governance://successor-owner-authority/p75',
      activeFrom: '2026-09-10T22:00:00.000Z',
      activeUntil: null,
      allowedPurpose: PURPOSE,
      allowedCycleId: activationPlan.cycleId,
    }],
  };
  const normalizedRegistry = normalizeSuccessorFreshOwnerAuthorityRegistry(successorFreshOwnerAuthorityRegistry, activationPlan.cycleId);
  const unsignedDecision = {
    decisionId: 'successor-owner-decision-p75',
    authorityId: 'successor-owner-authority-p75',
    actorRef: activationPlan.preparedByRef,
    decision: DECISION,
    decisionSourceRef: 'governance://successor-owner-decision/p75',
    decisionArtifactSha256: h('owner-decision-artifact'),
    decidedAt: '2026-09-10T22:40:00.000Z',
    rationaleRef: 'governance://successor-owner-rationale/p75',
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
    decision: unsignedDecision,
  };
  const preparedOwner = prepareSuccessorFreshOwnerActivationAuthorization(p74Input);
  assert.strictEqual(preparedOwner.verified, true);
  const signatureBase64 = crypto.sign(
    'RSA-SHA256',
    Buffer.from(stableStringify(preparedOwner.signingPayload), 'utf8'),
    privateKey,
  ).toString('base64');
  const signedOwnerDecision = { ...unsignedDecision, signatureBase64 };

  const input = {
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
    contractId: 'successor-fresh-activation-contract-p75',
    preparedByRef: activationPlan.preparedByRef,
    preparedAt: '2026-09-10T22:42:00.000Z',
  };

  const result = createSuccessorFreshActivationChangeContract(input);
  assert.strictEqual(result.status, STATUS.SUCCESSOR_FRESH_ACTIVATION_CHANGE_CONTRACT_READY_OWNER_AUTH_VERIFIED_NOT_APPLIED);
  assert.strictEqual(result.verified, true);
  assert.strictEqual(result.targetPath, TARGET_PATH);
  assert.strictEqual(result.proposedRegistrySchemaVersion, 4);
  assert.strictEqual(result.proposedRegistry.schemaVersion, 4);
  assert.strictEqual(result.proposedRegistry.activeMode, 'GOVERNED_COMPOSITE_BASELINE');
  assert.strictEqual(result.proposedRegistryContent, successorFreshCompositeCandidate.proposedRegistryContent);
  assert.strictEqual(result.rollbackRegistryContent, currentRegistryContent);
  assert.strictEqual(result.rollbackRegistryHashSha256, evaluateCurrentCanonicalBaselineRegistry(currentRegistry).registryHashSha256);
  assert.strictEqual(result.rollbackRegistryContentSha256, sha256Text(currentRegistryContent));
  assert.strictEqual(result.rollbackRestoresExactCurrentLogicalRegistry, true);
  assert.strictEqual(result.rollbackRestoresExactCurrentRawRegistry, true);
  assert.strictEqual(result.ownerActivationAuthorizationVerified, true);
  assert.strictEqual(result.ownerSignatureVerified, true);
  assert.strictEqual(result.ownerTrustRootVerified, true);
  assert.strictEqual(result.activationAuthorizationEvidenceBound, true);
  assert.strictEqual(result.activationAuthorized, false);
  assert.strictEqual(result.activationApplied, false);
  assert.strictEqual(result.reactivationAuthorized, false);
  assert.strictEqual(result.currentBaselineMutationPerformed, false);
  assert.strictEqual(result.releaseStillBlocked, true);
  assert.match(result.successorFreshActivationChangeContractHashSha256, /^[a-f0-9]{64}$/);
  for (const key of Object.keys(AUTHORITY)) assert.strictEqual(result[key], false);
  assert.strictEqual(
    createSuccessorFreshActivationChangeContract(input).successorFreshActivationChangeContractHashSha256,
    result.successorFreshActivationChangeContractHashSha256,
  );

  const badSignature = createSuccessorFreshActivationChangeContract({
    ...input,
    signedOwnerDecision: { ...unsignedDecision, signatureBase64: Buffer.alloc(256, 3).toString('base64') },
  });
  assert.strictEqual(badSignature.status, STATUS.HOLD_SUCCESSOR_FRESH_ACTIVATION_CHANGE_CONTRACT);
  assert(badSignature.blockers.includes('SUCCESSOR_FRESH_OWNER_SIGNATURE_INVALID'));

  const tamperedCandidate = JSON.parse(JSON.stringify(successorFreshCompositeCandidate));
  tamperedCandidate.candidateRegistryContentSha256 = h('tampered-candidate-content');
  const badCandidate = createSuccessorFreshActivationChangeContract({ ...input, successorFreshCompositeCandidate: tamperedCandidate });
  assert.strictEqual(badCandidate.status, STATUS.HOLD_SUCCESSOR_FRESH_ACTIVATION_CHANGE_CONTRACT);
  assert(badCandidate.blockers.some((x) => /P69/.test(x)));

  const rawDrift = createSuccessorFreshActivationChangeContract({ ...input, currentRegistryContent: `${currentRegistryContent} ` });
  assert.strictEqual(rawDrift.status, STATUS.HOLD_SUCCESSOR_FRESH_ACTIVATION_CHANGE_CONTRACT);
  assert(rawDrift.blockers.some((x) => /CONTENT/.test(x)));

  const wrongPreparer = createSuccessorFreshActivationChangeContract({ ...input, preparedByRef: 'owner:wrong' });
  assert.strictEqual(wrongPreparer.status, STATUS.HOLD_SUCCESSOR_FRESH_ACTIVATION_CHANGE_CONTRACT);
  assert(wrongPreparer.blockers.includes('SUCCESSOR_FRESH_ACTIVATION_CONTRACT_MUST_BE_PREPARED_BY_CYCLE_OWNER'));

  const earlyContract = createSuccessorFreshActivationChangeContract({ ...input, preparedAt: '2026-09-10T22:39:00.000Z' });
  assert.strictEqual(earlyContract.status, STATUS.HOLD_SUCCESSOR_FRESH_ACTIVATION_CHANGE_CONTRACT);
  assert(earlyContract.blockers.includes('SUCCESSOR_FRESH_ACTIVATION_CONTRACT_PRECEDES_VERIFIED_OWNER_DECISION'));

  const escalated = createSuccessorFreshActivationChangeContract({ ...input, releaseAuthorized: true });
  assert.strictEqual(escalated.status, STATUS.HOLD_SUCCESSOR_FRESH_ACTIVATION_CHANGE_CONTRACT);
  assert(escalated.blockers.includes('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED'));

  const keyMaterial = createSuccessorFreshActivationChangeContract({ ...input, nested: { privateKeyPem: 'forbidden' } });
  assert.strictEqual(keyMaterial.status, STATUS.HOLD_SUCCESSOR_FRESH_ACTIVATION_CHANGE_CONTRACT);
  assert(keyMaterial.blockers.some((x) => x.startsWith('PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:')));

  assert.throws(() => parseArgs(['--candidate', 'a.json', '--candidate', 'b.json']), /duplicate argument/);
  assert.throws(() => parseArgs(['--unknown', 'x']), /unknown argument/);
  assert.throws(() => parseArgs(['--secret-key', 'key.pem']), /private or secret key argument rejected/);

  process.stdout.write('P75 successor fresh activation change contract tests passed\n');
})();
