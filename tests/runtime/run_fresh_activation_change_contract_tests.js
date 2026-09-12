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
const {
  freshManifestCore,
  p50PlanCore,
  createFreshCompositeRegistryCandidate,
} = require('../../src/qualification/fresh-composite-registry-candidate');
const { STATUS: P55_STATUS } = require('../../src/qualification/fresh-composite-cutover-safety-guard');
const {
  PURPOSE,
  DECISION,
  p55SafetyCore,
  normalizeFreshOwnerAuthorityRegistry,
  createFreshOwnerSigningPayload,
} = require('../../src/qualification/fresh-owner-activation-authorization');
const {
  STATUS,
  createFreshActivationChangeContract,
} = require('../../src/qualification/fresh-activation-change-contract');
const { parseArgs } = require('../../tools/fresh-activation-change-contract');

const hashText = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const hashObject = (value) => hashText(stableStringify(value));
const h = (char) => char.repeat(64);

function activationPlanFixture(currentHash) {
  const manifest = {
    schemaVersion: 1,
    baselineId: 'fresh-reactivation:cycle:p57',
    baselineType: 'QUALIFIED_GIT_COMMIT_AND_RELEASE_ARTIFACT',
    cycleId: 'cycle:p57',
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
    activationChangeId: 'activation:p57',
    cycleId: manifest.cycleId,
    freshReactivationGovernanceCycleHashSha256: manifest.freshReactivationGovernanceCycleHashSha256,
    preparedByRef: 'owner:p57',
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

function safetyGuardFixture(plan, candidate, currentHash) {
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
    freshCompositeRegistryCandidateHashSha256: candidate.freshCompositeRegistryCandidateHashSha256,
    candidateRegistryHashSha256: candidate.candidateRegistryHashSha256,
    candidateRegistryContentSha256: candidate.candidateRegistryContentSha256,
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
  const candidate = createFreshCompositeRegistryCandidate({ activationPlan: plan, currentRegistry });
  const guard = safetyGuardFixture(plan, candidate, current.registryHashSha256);

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
  const authorityRegistry = {
    schemaVersion: 1,
    purpose: PURPOSE,
    authorities: [{
      authorityId: 'owner-authority:p57',
      actorRef: plan.preparedByRef,
      publicKeyPem,
      publicKeySha256: hashText(String(publicKeyPem).trim()),
      governanceEvidenceRef: 'governance:owner:p57',
      activeFrom: '2026-09-10T00:00:00.000Z',
      activeUntil: '2026-09-11T00:00:00.000Z',
      allowedPurpose: PURPOSE,
    }],
  };
  const normalizedRegistry = normalizeFreshOwnerAuthorityRegistry(authorityRegistry);
  const unsignedDecision = {
    decisionId: 'decision:p57',
    authorityId: 'owner-authority:p57',
    actorRef: plan.preparedByRef,
    decision: DECISION,
    decisionSourceRef: 'decision-source:p57',
    decisionArtifactSha256: h('e'),
    decidedAt: '2026-09-10T12:30:00.000Z',
    rationaleRef: 'rationale:p57',
    signatureAlgorithm: 'RSA-SHA256',
  };
  const signingPayload = createFreshOwnerSigningPayload({ safetyGuard: guard, activationPlan: plan, decision: unsignedDecision });
  const signatureBase64 = crypto.sign('RSA-SHA256', Buffer.from(stableStringify(signingPayload), 'utf8'), privateKey).toString('base64');
  const signedOwnerDecision = { ...unsignedDecision, signatureBase64 };

  const input = {
    currentRegistry,
    activationPlan: plan,
    freshCompositeCandidate: candidate,
    safetyGuard: guard,
    freshOwnerAuthorityRegistry: authorityRegistry,
    expectedFreshOwnerAuthorityRegistryHashSha256: normalizedRegistry.ownerAuthorityRegistryHashSha256,
    signedOwnerDecision,
    contractId: 'contract:p57',
    preparedByRef: plan.preparedByRef,
    preparedAt: '2026-09-10T12:45:00.000Z',
  };

  const success = createFreshActivationChangeContract(input);
  assert.strictEqual(success.status, STATUS.FRESH_ACTIVATION_CHANGE_CONTRACT_READY_OWNER_AUTH_VERIFIED_NOT_APPLIED);
  assert.strictEqual(success.verified, true);
  assert.strictEqual(success.ownerActivationAuthorizationVerified, true);
  assert.strictEqual(success.ownerSignatureVerified, true);
  assert.strictEqual(success.activationAuthorizationEvidenceBound, true);
  assert.strictEqual(success.proposedRegistryContent, candidate.proposedRegistryContent);
  assert.strictEqual(success.proposedRegistryHashSha256, candidate.candidateRegistryHashSha256);
  assert.strictEqual(success.rollbackRegistryHashSha256, current.registryHashSha256);
  assert.strictEqual(success.rollbackRestoresExactCurrentLogicalRegistry, true);
  assert.strictEqual(success.actualRegistryMutationPerformed, false);
  assert.strictEqual(success.activationAuthorized, false);
  assert.strictEqual(success.activationApplied, false);
  assert.strictEqual(success.releaseAuthorized, false);

  const deterministic = createFreshActivationChangeContract(input);
  assert.strictEqual(deterministic.freshActivationChangeContractHashSha256, success.freshActivationChangeContractHashSha256);

  const badSignature = createFreshActivationChangeContract({ ...input, signedOwnerDecision: { ...unsignedDecision, signatureBase64: Buffer.from('bad').toString('base64') } });
  assert(badSignature.blockers.includes('FRESH_OWNER_SIGNATURE_INVALID'));

  const tamperedCandidate = { ...candidate, candidateRegistryHashSha256: h('f') };
  const candidateResult = createFreshActivationChangeContract({ ...input, freshCompositeCandidate: tamperedCandidate });
  assert(candidateResult.blockers.some((code) => code.startsWith('P51_')));

  const wrongOwner = createFreshActivationChangeContract({ ...input, preparedByRef: 'owner:other' });
  assert(wrongOwner.blockers.includes('FRESH_ACTIVATION_CONTRACT_MUST_BE_PREPARED_BY_CYCLE_OWNER'));

  const early = createFreshActivationChangeContract({ ...input, preparedAt: '2026-09-10T12:15:00.000Z' });
  assert(early.blockers.includes('FRESH_ACTIVATION_CONTRACT_PRECEDES_VERIFIED_OWNER_DECISION'));

  const guardTamper = { ...guard, candidateRegistryContentSha256: h('0') };
  const guardResult = createFreshActivationChangeContract({ ...input, safetyGuard: guardTamper });
  assert(guardResult.blockers.some((code) => code.includes('P55_')));

  const privateKeyResult = createFreshActivationChangeContract({ ...input, privateKeyPem: 'forbidden' });
  assert(privateKeyResult.blockers.includes('PRIVATE_SIGNING_KEY_INPUT_REJECTED'));

  assert.throws(() => parseArgs(['--private-key', 'secret']), /private signing key argument rejected/);
  assert.throws(() => parseArgs(['--candidate', 'a.json', '--candidate', 'b.json']), /duplicate argument/);
  assert.throws(() => parseArgs(['--unknown', 'x']), /unknown argument/);

  console.log('P57 fresh activation change contract: PASS');
})();
