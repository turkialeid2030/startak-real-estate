'use strict';

const assert = require('assert');
const crypto = require('crypto');
const currentRegistry = require('../../config/governance/canonical-baseline.json');
const {
  MODE,
  evaluateCurrentCanonicalBaselineRegistry,
  stableStringify,
} = require('../../src/qualification/canonical-baseline-registry');
const { STATUS: P50_STATUS } = require('../../src/qualification/fresh-reactivation-activation-plan');
const { freshManifestCore, p50PlanCore } = require('../../src/qualification/fresh-composite-registry-candidate');
const { STATUS: P55_STATUS } = require('../../src/qualification/fresh-composite-cutover-safety-guard');
const {
  PURPOSE,
  DECISION,
  STATUS,
  p55SafetyCore,
  normalizeFreshOwnerAuthorityRegistry,
  createFreshOwnerSigningPayload,
  prepareFreshOwnerActivationAuthorization,
  verifyFreshOwnerActivationAuthorization,
} = require('../../src/qualification/fresh-owner-activation-authorization');
const { parseArgs } = require('../../tools/fresh-owner-activation-authorization');

const hashText = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const hashObject = (value) => hashText(stableStringify(value));
const h = (char) => char.repeat(64);

function activationPlanFixture(currentHash) {
  const manifest = {
    schemaVersion: 1,
    baselineId: 'fresh-reactivation:cycle:p56',
    baselineType: 'QUALIFIED_GIT_COMMIT_AND_RELEASE_ARTIFACT',
    cycleId: 'cycle:p56',
    freshReactivationGovernanceCycleHashSha256: h('1'),
    qualifiedSourceCommitSha: 'a'.repeat(40),
    releaseArtifactSha256: h('2'),
    environmentConfigSha256: h('3'),
    expectedPriorRegistryHashSha256: currentHash,
    reviewPacketHashSha256: h('4'),
    freshReviewerDesignationHashSha256: h('5'),
    freshReviewerLifecycleLockHashSha256: h('6'),
    verifiedFreshReviewRecordHashSha256: h('7'),
  };
  const manifestHash = hashObject(freshManifestCore(manifest));
  const plan = {
    schemaVersion: 1,
    activationChangeId: 'activation:p56',
    cycleId: manifest.cycleId,
    freshReactivationGovernanceCycleHashSha256: manifest.freshReactivationGovernanceCycleHashSha256,
    preparedByRef: 'owner:p56',
    preparedAt: '2026-09-10T12:00:00.000Z',
    freshReviewerLifecycleLockHashSha256: manifest.freshReviewerLifecycleLockHashSha256,
    freshSuccessorBaselineManifest: manifest,
    freshSuccessorBaselineManifestHashSha256: manifestHash,
    targetActivationContract: {
      targetPath: 'config/governance/canonical-baseline.json',
      expectedPriorMode: MODE.LEGACY_FILE_SHA256,
      proposedMode: MODE.GOVERNED_COMPOSITE_BASELINE,
      expectedPriorRegistryHashSha256: currentHash,
      freshReactivationGovernanceCycleHashSha256: manifest.freshReactivationGovernanceCycleHashSha256,
      freshReviewerLifecycleLockHashSha256: manifest.freshReviewerLifecycleLockHashSha256,
    },
  };
  plan.freshActivationPlanHashSha256 = hashObject(p50PlanCore(plan));
  return {
    ...plan,
    status: P50_STATUS.FRESH_REACTIVATION_ACTIVATION_PLAN_READY_NOT_AUTHORIZED,
    verified: true,
    blockers: [],
    explicitActivationChangeRequired: true,
    activationAuthorized: false,
    activationApplied: false,
    automaticBaselineSwitchAllowed: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    priorActivationPlanReusable: false,
    priorOwnerAuthorizationReusable: false,
    priorActivationContractReusable: false,
    freshShadowEvidenceRequired: true,
    freshCutoverRehearsalRequired: true,
    freshCutoverSafetyEvidenceRequired: true,
    freshOwnerActivationAuthorizationRequired: true,
    freshActivationChangeContractRequired: true,
    postChangeReleaseVerifyRequired: true,
    releaseStillBlocked: true,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    goLiveAuthorized: false,
    transactionAuthorized: false,
  };
}

function safetyGuardFixture(plan, currentHash) {
  const guard = {
    schemaVersion: 1,
    authoritativeMode: MODE.LEGACY_FILE_SHA256,
    proposedMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    cycleId: plan.cycleId,
    freshReactivationGovernanceCycleHashSha256: plan.freshReactivationGovernanceCycleHashSha256,
    currentRegistryHashSha256: currentHash,
    freshReviewerLifecycleLockHashSha256: plan.freshReviewerLifecycleLockHashSha256,
    freshActivationPlanHashSha256: plan.freshActivationPlanHashSha256,
    freshSuccessorBaselineManifestHashSha256: plan.freshSuccessorBaselineManifestHashSha256,
    freshCompositeRegistryCandidateHashSha256: h('8'),
    candidateRegistryHashSha256: h('9'),
    candidateRegistryContentSha256: h('a'),
    freshCompositeEvidenceHashSha256: h('b'),
    freshShadowEvaluationHashSha256: h('c'),
    freshCutoverRehearsalHashSha256: h('d'),
  };
  guard.freshCutoverSafetyGuardHashSha256 = hashObject(p55SafetyCore(guard));
  return {
    ...guard,
    status: P55_STATUS.FRESH_CUTOVER_SAFETY_GUARD_SATISFIED_NOT_AUTHORIZED,
    verified: true,
    blockers: [],
    reviewerLockVerified: true,
    activationPlanVerified: true,
    shadowMatchVerified: true,
    rollbackRehearsalVerified: true,
    exactRollbackIdentityVerified: true,
    safetyPrerequisitesSatisfiedForFreshOwnerAuthorization: true,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    freshOwnerActivationAuthorizationRequired: true,
    freshActivationChangeContractRequired: true,
    controlledActivationExecutionRequired: true,
    postActivationReleaseVerifyRequired: true,
    releaseStillBlocked: true,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    goLiveAuthorized: false,
    transactionAuthorized: false,
  };
}

(() => {
  const current = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  const plan = activationPlanFixture(current.registryHashSha256);
  const guard = safetyGuardFixture(plan, current.registryHashSha256);
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
  const rawRegistry = {
    schemaVersion: 1,
    purpose: PURPOSE,
    authorities: [{
      authorityId: 'owner-authority:p56',
      actorRef: plan.preparedByRef,
      publicKeyPem,
      publicKeySha256: hashText(String(publicKeyPem).trim()),
      governanceEvidenceRef: 'governance:owner:p56',
      activeFrom: '2026-09-10T00:00:00.000Z',
      activeUntil: '2026-09-11T00:00:00.000Z',
      allowedPurpose: PURPOSE,
    }],
  };
  const normalizedRegistry = normalizeFreshOwnerAuthorityRegistry(rawRegistry);
  const unsignedDecision = {
    decisionId: 'decision:p56',
    authorityId: 'owner-authority:p56',
    actorRef: plan.preparedByRef,
    decision: DECISION,
    decisionSourceRef: 'decision-source:p56',
    decisionArtifactSha256: h('e'),
    decidedAt: '2026-09-10T12:30:00.000Z',
    rationaleRef: 'rationale:p56',
    signatureAlgorithm: 'RSA-SHA256',
  };
  const baseInput = {
    currentRegistry,
    safetyGuard: guard,
    activationPlan: plan,
    freshOwnerAuthorityRegistry: rawRegistry,
    expectedFreshOwnerAuthorityRegistryHashSha256: normalizedRegistry.ownerAuthorityRegistryHashSha256,
    decision: unsignedDecision,
  };

  const prepared = prepareFreshOwnerActivationAuthorization(baseInput);
  assert.strictEqual(prepared.status, STATUS.READY_FOR_EXTERNAL_FRESH_OWNER_SIGNATURE);
  assert.strictEqual(prepared.verified, true);
  assert.strictEqual(prepared.ownerTrustRootVerified, true);
  assert.strictEqual(prepared.ownerActivationAuthorizationVerified, false);
  assert.strictEqual(prepared.activationAuthorized, false);
  assert.strictEqual(prepared.releaseAuthorized, false);

  const payload = createFreshOwnerSigningPayload({ safetyGuard: guard, activationPlan: plan, decision: unsignedDecision });
  const signatureBase64 = crypto.sign('RSA-SHA256', Buffer.from(stableStringify(payload), 'utf8'), privateKey).toString('base64');
  const verified = verifyFreshOwnerActivationAuthorization({
    ...baseInput,
    decision: { ...unsignedDecision, signatureBase64 },
  });
  assert.strictEqual(verified.status, STATUS.FRESH_OWNER_ACTIVATION_AUTHORIZATION_CRYPTOGRAPHICALLY_VERIFIED_NOT_APPLIED);
  assert.strictEqual(verified.verified, true);
  assert.strictEqual(verified.ownerIdentityCryptographicallyVerified, true);
  assert.strictEqual(verified.ownerTrustRootVerified, true);
  assert.strictEqual(verified.ownerSignatureVerified, true);
  assert.strictEqual(verified.ownerActivationAuthorizationVerified, true);
  assert.strictEqual(verified.activationAuthorized, false);
  assert.strictEqual(verified.activationApplied, false);
  assert.strictEqual(verified.releaseAuthorized, false);

  const deterministic = verifyFreshOwnerActivationAuthorization({ ...baseInput, decision: { ...unsignedDecision, signatureBase64 } });
  assert.strictEqual(deterministic.verifiedFreshOwnerAuthorizationRecordHashSha256, verified.verifiedFreshOwnerAuthorizationRecordHashSha256);

  const badTrust = prepareFreshOwnerActivationAuthorization({ ...baseInput, expectedFreshOwnerAuthorityRegistryHashSha256: h('f') });
  assert(badTrust.blockers.includes('FRESH_OWNER_AUTHORITY_REGISTRY_HASH_MISMATCH'));

  const badActor = prepareFreshOwnerActivationAuthorization({ ...baseInput, decision: { ...unsignedDecision, actorRef: 'owner:other' } });
  assert(badActor.blockers.includes('FRESH_ACTIVATION_MUST_BE_AUTHORIZED_BY_CYCLE_OWNER'));

  const early = prepareFreshOwnerActivationAuthorization({ ...baseInput, decision: { ...unsignedDecision, decidedAt: '2026-09-10T11:00:00.000Z' } });
  assert(early.blockers.includes('FRESH_OWNER_DECISION_PRECEDES_ACTIVATION_PLAN'));

  const invalidSig = verifyFreshOwnerActivationAuthorization({ ...baseInput, decision: { ...unsignedDecision, signatureBase64: Buffer.from('invalid').toString('base64') } });
  assert(invalidSig.blockers.includes('FRESH_OWNER_SIGNATURE_INVALID'));

  const guardTamper = { ...guard, candidateRegistryHashSha256: h('0') };
  const guardResult = prepareFreshOwnerActivationAuthorization({ ...baseInput, safetyGuard: guardTamper });
  assert(guardResult.blockers.includes('P55_FRESH_CUTOVER_SAFETY_HASH_MISMATCH'));

  const privateKeyResult = prepareFreshOwnerActivationAuthorization({ ...baseInput, privateKeyPem: 'forbidden' });
  assert(privateKeyResult.blockers.some((code) => code.startsWith('PRIVATE_SIGNING_KEY_MATERIAL_REJECTED')));

  assert.throws(() => parseArgs(['--private-key', 'secret']), /private signing key argument rejected/);
  assert.throws(() => parseArgs(['--mode', 'prepare', '--mode', 'verify']), /duplicate argument/);
  assert.throws(() => parseArgs(['--unknown', 'x']), /unknown argument/);

  console.log('P56 fresh owner activation authorization: PASS');
})();
