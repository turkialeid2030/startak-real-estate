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
  STATUS: P57_STATUS,
  createFreshActivationChangeContract,
} = require('../../src/qualification/fresh-activation-change-contract');
const {
  STATUS,
  verifyFreshDualModeCanonicalRegistry,
} = require('../../src/qualification/fresh-dual-mode-canonical-registry-verifier');
const {
  parseArgs,
  requireFreshArgs,
} = require('../../tools/fresh-dual-mode-canonical-registry-verifier');

const hashText = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const hashObject = (value) => hashText(stableStringify(value));
const h = (char) => char.repeat(64);
const canonicalContent = (value) => `${JSON.stringify(value, null, 2)}\n`;

function activationPlanFixture(currentHash) {
  const manifest = {
    schemaVersion: 1,
    baselineId: 'fresh-reactivation:cycle:p58',
    baselineType: 'QUALIFIED_GIT_COMMIT_AND_RELEASE_ARTIFACT',
    cycleId: 'cycle:p58',
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
    activationChangeId: 'activation:p58',
    cycleId: manifest.cycleId,
    freshReactivationGovernanceCycleHashSha256: manifest.freshReactivationGovernanceCycleHashSha256,
    preparedByRef: 'owner:p58',
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

function buildFreshFixture() {
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
      authorityId: 'owner-authority:p58',
      actorRef: plan.preparedByRef,
      publicKeyPem,
      publicKeySha256: hashText(String(publicKeyPem).trim()),
      governanceEvidenceRef: 'governance:owner:p58',
      activeFrom: '2026-09-10T00:00:00.000Z',
      activeUntil: '2026-09-11T00:00:00.000Z',
      allowedPurpose: PURPOSE,
    }],
  };
  const normalizedRegistry = normalizeFreshOwnerAuthorityRegistry(authorityRegistry);
  const unsignedDecision = {
    decisionId: 'decision:p58',
    authorityId: 'owner-authority:p58',
    actorRef: plan.preparedByRef,
    decision: DECISION,
    decisionSourceRef: 'decision-source:p58',
    decisionArtifactSha256: h('e'),
    decidedAt: '2026-09-10T12:30:00.000Z',
    rationaleRef: 'rationale:p58',
    signatureAlgorithm: 'RSA-SHA256',
  };
  const signingPayload = createFreshOwnerSigningPayload({ safetyGuard: guard, activationPlan: plan, decision: unsignedDecision });
  const signatureBase64 = crypto.sign('RSA-SHA256', Buffer.from(stableStringify(signingPayload), 'utf8'), privateKey).toString('base64');
  const signedOwnerDecision = { ...unsignedDecision, signatureBase64 };
  const contract = createFreshActivationChangeContract({
    currentRegistry,
    activationPlan: plan,
    freshCompositeCandidate: candidate,
    safetyGuard: guard,
    freshOwnerAuthorityRegistry: authorityRegistry,
    expectedFreshOwnerAuthorityRegistryHashSha256: normalizedRegistry.ownerAuthorityRegistryHashSha256,
    signedOwnerDecision,
    contractId: 'contract:p58',
    preparedByRef: plan.preparedByRef,
    preparedAt: '2026-09-10T12:45:00.000Z',
  });
  assert.strictEqual(contract.status, P57_STATUS.FRESH_ACTIVATION_CHANGE_CONTRACT_READY_OWNER_AUTH_VERIFIED_NOT_APPLIED);
  return {
    plan,
    candidate,
    guard,
    authorityRegistry,
    expectedRegistryHash: normalizedRegistry.ownerAuthorityRegistryHashSha256,
    unsignedDecision,
    signedOwnerDecision,
    contract,
  };
}

(() => {
  const legacy = verifyFreshDualModeCanonicalRegistry({
    registry: currentRegistry,
    observedRegistryContent: canonicalContent(currentRegistry),
  });
  assert.strictEqual(legacy.status, STATUS.LEGACY_BASELINE_VERIFIED);
  assert.strictEqual(legacy.verified, true);
  assert.strictEqual(legacy.activeMode, MODE.LEGACY_FILE_SHA256);
  assert.strictEqual(legacy.observedRegistryContentVerified, true);
  assert.strictEqual(legacy.releaseAuthorized, false);

  const fixture = buildFreshFixture();
  const baseInput = {
    registry: fixture.contract.proposedRegistry,
    observedRegistryContent: fixture.contract.proposedRegistryContent,
    activationChangeContract: fixture.contract,
    activationPlan: fixture.plan,
    freshCompositeCandidate: fixture.candidate,
    safetyGuard: fixture.guard,
    freshOwnerAuthorityRegistry: fixture.authorityRegistry,
    expectedFreshOwnerAuthorityRegistryHashSha256: fixture.expectedRegistryHash,
    signedOwnerDecision: fixture.signedOwnerDecision,
  };

  const active = verifyFreshDualModeCanonicalRegistry(baseInput);
  assert.strictEqual(active.status, STATUS.FRESH_COMPOSITE_BASELINE_VERIFIED_WITH_FRESH_OWNER_AUTHORIZATION);
  assert.strictEqual(active.verified, true);
  assert.strictEqual(active.registrySchemaVersion, 3);
  assert.strictEqual(active.legacyBaselineVerified, true);
  assert.strictEqual(active.freshCompositeRegistryShapeVerified, true);
  assert.strictEqual(active.p51CandidateReverified, true);
  assert.strictEqual(active.p57ActivationChangeContractVerified, true);
  assert.strictEqual(active.freshOwnerAuthorizationReverified, true);
  assert.strictEqual(active.rollbackRegistryVerified, true);
  assert.strictEqual(active.observedRegistryContentVerified, true);
  assert.strictEqual(active.activationAppliedObserved, true);
  assert.strictEqual(active.activationAuthorizedByThisVerifier, false);
  assert.strictEqual(active.mutationPerformedByThisVerifier, false);
  assert.strictEqual(active.releaseAuthorized, false);

  const deterministic = verifyFreshDualModeCanonicalRegistry(baseInput);
  assert.strictEqual(deterministic.registryHashSha256, active.registryHashSha256);
  assert.strictEqual(deterministic.freshActivationChangeContractHashSha256, active.freshActivationChangeContractHashSha256);

  const missingContent = verifyFreshDualModeCanonicalRegistry({ ...baseInput, observedRegistryContent: undefined });
  assert(missingContent.blockers.includes('OBSERVED_ACTIVE_REGISTRY_CONTENT_REQUIRED'));

  const nonCanonicalContent = verifyFreshDualModeCanonicalRegistry({ ...baseInput, observedRegistryContent: `${fixture.contract.proposedRegistryContent} ` });
  assert(nonCanonicalContent.blockers.includes('OBSERVED_ACTIVE_REGISTRY_CONTENT_NOT_CANONICAL'));

  const extraFieldRegistry = JSON.parse(JSON.stringify(fixture.contract.proposedRegistry));
  extraFieldRegistry.unexpected = true;
  const extraField = verifyFreshDualModeCanonicalRegistry({ ...baseInput, registry: extraFieldRegistry, observedRegistryContent: canonicalContent(extraFieldRegistry) });
  assert(extraField.blockers.some((code) => code.includes('missing or unknown fields')));

  const escalatedRegistry = JSON.parse(JSON.stringify(fixture.contract.proposedRegistry));
  escalatedRegistry.releaseAuthorized = true;
  const escalation = verifyFreshDualModeCanonicalRegistry({ ...baseInput, registry: escalatedRegistry, observedRegistryContent: canonicalContent(escalatedRegistry) });
  assert(escalation.blockers.some((code) => code.includes('authority must remain false')));

  const tamperedContract = JSON.parse(JSON.stringify(fixture.contract));
  tamperedContract.ownerAuthorityRegistryHashSha256 = h('f');
  const contractTamper = verifyFreshDualModeCanonicalRegistry({ ...baseInput, activationChangeContract: tamperedContract });
  assert(contractTamper.blockers.includes('P57_ACTIVATION_CHANGE_CONTRACT_HASH_MISMATCH'));

  const badSignature = verifyFreshDualModeCanonicalRegistry({
    ...baseInput,
    signedOwnerDecision: { ...fixture.unsignedDecision, signatureBase64: Buffer.from('bad').toString('base64') },
  });
  assert(badSignature.blockers.includes('FRESH_OWNER_SIGNATURE_INVALID'));

  const driftedRegistry = JSON.parse(JSON.stringify(fixture.contract.proposedRegistry));
  driftedRegistry.governedCompositeBaseline.releaseArtifactSha256 = h('f');
  const drift = verifyFreshDualModeCanonicalRegistry({ ...baseInput, registry: driftedRegistry, observedRegistryContent: canonicalContent(driftedRegistry) });
  assert(drift.blockers.some((code) => code.startsWith('ACTIVE_REGISTRY_')));

  const badRollbackContract = JSON.parse(JSON.stringify(fixture.contract));
  badRollbackContract.rollbackRegistry.legacyBaseline.expectedSha256 = h('f');
  const rollbackDrift = verifyFreshDualModeCanonicalRegistry({ ...baseInput, activationChangeContract: badRollbackContract });
  assert(rollbackDrift.blockers.includes('P57_ROLLBACK_REGISTRY_NOT_VALID_LEGACY_BASELINE'));

  const privateKeyResult = verifyFreshDualModeCanonicalRegistry({
    ...baseInput,
    signedOwnerDecision: { ...fixture.signedOwnerDecision, privateKeyPem: 'forbidden' },
  });
  assert(privateKeyResult.blockers.some((code) => code.startsWith('PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED')));

  const parsedLegacyArgs = parseArgs(['--registry', 'registry.json']);
  assert.strictEqual(parsedLegacyArgs.registry, 'registry.json');
  assert.throws(() => parseArgs(['--registry', 'a.json', '--registry', 'b.json']), /duplicate argument/);
  assert.throws(() => parseArgs(['--private-key', 'secret']), /private or secret signing key argument rejected/);
  assert.throws(() => parseArgs(['--unknown', 'x']), /unknown argument/);
  assert.throws(() => requireFreshArgs({ registry: 'registry.json' }), /missing required argument for fresh composite mode/);

  console.log('P58 fresh dual-mode canonical registry verifier: PASS');
})();
