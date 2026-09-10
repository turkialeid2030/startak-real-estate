'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
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
  STATUS: GATE_STATUS,
  verifyCanonicalBaselineRegistryFile,
} = require('../../tools/canonical-baseline-registry-gate');

const hashText = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const hashObject = (value) => hashText(stableStringify(value));
const h = (char) => char.repeat(64);
const canonicalContent = (value) => `${JSON.stringify(value, null, 2)}\n`;

function activationPlanFixture(currentHash) {
  const manifest = {
    schemaVersion: 1,
    baselineId: 'fresh-reactivation:cycle:p59',
    baselineType: 'QUALIFIED_GIT_COMMIT_AND_RELEASE_ARTIFACT',
    cycleId: 'cycle:p59',
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
    activationChangeId: 'activation:p59',
    cycleId: manifest.cycleId,
    freshReactivationGovernanceCycleHashSha256: manifest.freshReactivationGovernanceCycleHashSha256,
    preparedByRef: 'owner:p59',
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
      authorityId: 'owner-authority:p59',
      actorRef: plan.preparedByRef,
      publicKeyPem,
      publicKeySha256: hashText(String(publicKeyPem).trim()),
      governanceEvidenceRef: 'governance:owner:p59',
      activeFrom: '2026-09-10T00:00:00.000Z',
      activeUntil: '2026-09-11T00:00:00.000Z',
      allowedPurpose: PURPOSE,
    }],
  };
  const normalizedRegistry = normalizeFreshOwnerAuthorityRegistry(authorityRegistry);
  const unsignedDecision = {
    decisionId: 'decision:p59',
    authorityId: 'owner-authority:p59',
    actorRef: plan.preparedByRef,
    decision: DECISION,
    decisionSourceRef: 'decision-source:p59',
    decisionArtifactSha256: h('e'),
    decidedAt: '2026-09-10T12:30:00.000Z',
    rationaleRef: 'rationale:p59',
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
    contractId: 'contract:p59',
    preparedByRef: plan.preparedByRef,
    preparedAt: '2026-09-10T12:45:00.000Z',
  });
  assert.strictEqual(contract.status, P57_STATUS.FRESH_ACTIVATION_CHANGE_CONTRACT_READY_OWNER_AUTH_VERIFIED_NOT_APPLIED);
  return { plan, candidate, guard, authorityRegistry, normalizedRegistry, signedOwnerDecision, contract };
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, canonicalContent(value), 'utf8');
}

(() => {
  const legacy = verifyCanonicalBaselineRegistryFile({ env: {} });
  assert.strictEqual(legacy.status, GATE_STATUS.VERIFIED);
  assert.strictEqual(legacy.verified, true);
  assert.strictEqual(legacy.verificationMode, 'LEGACY_STRICT');
  assert.strictEqual(legacy.registrySchemaVersion, 1);
  assert.strictEqual(legacy.activationAuthorizationGrantedByGate, false);
  assert.strictEqual(legacy.releaseAuthorized, false);

  const fixture = buildFreshFixture();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'startak-p59-'));
  try {
    const paths = {
      registry: path.join(tempDir, 'registry.json'),
      contract: path.join(tempDir, 'contract.json'),
      plan: path.join(tempDir, 'plan.json'),
      candidate: path.join(tempDir, 'candidate.json'),
      safety: path.join(tempDir, 'safety.json'),
      authority: path.join(tempDir, 'authority.json'),
      decision: path.join(tempDir, 'decision.json'),
    };
    writeJson(paths.registry, fixture.contract.proposedRegistry);
    writeJson(paths.contract, fixture.contract);
    writeJson(paths.plan, fixture.plan);
    writeJson(paths.candidate, fixture.candidate);
    writeJson(paths.safety, fixture.guard);
    writeJson(paths.authority, fixture.authorityRegistry);
    writeJson(paths.decision, fixture.signedOwnerDecision);

    const env = {
      FRESH_CANONICAL_ACTIVATION_CONTRACT_PATH: paths.contract,
      FRESH_CANONICAL_ACTIVATION_PLAN_PATH: paths.plan,
      FRESH_CANONICAL_COMPOSITE_CANDIDATE_PATH: paths.candidate,
      FRESH_CANONICAL_CUTOVER_SAFETY_GUARD_PATH: paths.safety,
      FRESH_CANONICAL_OWNER_AUTHORITY_REGISTRY_PATH: paths.authority,
      EXPECTED_FRESH_CANONICAL_OWNER_AUTHORITY_REGISTRY_SHA256: fixture.normalizedRegistry.ownerAuthorityRegistryHashSha256,
      FRESH_CANONICAL_SIGNED_OWNER_DECISION_PATH: paths.decision,
    };

    const fresh = verifyCanonicalBaselineRegistryFile({ filePath: paths.registry, env });
    assert.strictEqual(fresh.status, GATE_STATUS.VERIFIED);
    assert.strictEqual(fresh.verified, true);
    assert.strictEqual(fresh.registrySchemaVersion, 3);
    assert.strictEqual(fresh.verificationMode, 'FRESH_GOVERNED_COMPOSITE_WITH_REVERIFIED_OWNER_AUTHORIZATION');
    assert.strictEqual(fresh.p57ActivationChangeContractVerified, true);
    assert.strictEqual(fresh.freshOwnerAuthorizationReverified, true);
    assert.strictEqual(fresh.rollbackRegistryVerified, true);
    assert.strictEqual(fresh.activationAuthorizationGrantedByGate, false);
    assert.strictEqual(fresh.activationAppliedObserved, true);
    assert.strictEqual(fresh.releaseAuthorized, false);

    const missingFresh = verifyCanonicalBaselineRegistryFile({ filePath: paths.registry, env: {} });
    assert.strictEqual(missingFresh.status, GATE_STATUS.REGISTRY_HOLD);
    assert.strictEqual(missingFresh.reasonCode, 'FRESH_COMPOSITE_BASELINE_ACTIVATION_EVIDENCE_REQUIRED');

    const partialFresh = verifyCanonicalBaselineRegistryFile({
      filePath: paths.registry,
      env: { FRESH_CANONICAL_ACTIVATION_CONTRACT_PATH: paths.contract },
    });
    assert.strictEqual(partialFresh.status, GATE_STATUS.REGISTRY_HOLD);
    assert.strictEqual(partialFresh.reasonCode, 'FRESH_COMPOSITE_BASELINE_ACTIVATION_EVIDENCE_REQUIRED');

    const badTrust = verifyCanonicalBaselineRegistryFile({
      filePath: paths.registry,
      env: { ...env, EXPECTED_FRESH_CANONICAL_OWNER_AUTHORITY_REGISTRY_SHA256: h('f') },
    });
    assert.strictEqual(badTrust.status, GATE_STATUS.REGISTRY_HOLD);
    assert.strictEqual(badTrust.reasonCode, 'FRESH_COMPOSITE_BASELINE_ACTIVATION_EVIDENCE_NOT_VERIFIED');
    assert(badTrust.blockers.includes('FRESH_OWNER_AUTHORITY_REGISTRY_HASH_MISMATCH'));

    const badDecision = { ...fixture.signedOwnerDecision, signatureBase64: Buffer.from('bad').toString('base64') };
    writeJson(paths.decision, badDecision);
    const badSignature = verifyCanonicalBaselineRegistryFile({ filePath: paths.registry, env });
    assert.strictEqual(badSignature.status, GATE_STATUS.REGISTRY_HOLD);
    assert(badSignature.blockers.includes('FRESH_OWNER_SIGNATURE_INVALID'));
    writeJson(paths.decision, fixture.signedOwnerDecision);

    fs.writeFileSync(paths.registry, JSON.stringify(fixture.contract.proposedRegistry), 'utf8');
    const rawDrift = verifyCanonicalBaselineRegistryFile({ filePath: paths.registry, env });
    assert.strictEqual(rawDrift.status, GATE_STATUS.REGISTRY_HOLD);
    assert(rawDrift.blockers.includes('OBSERVED_ACTIVE_REGISTRY_CONTENT_NOT_CANONICAL'));
    writeJson(paths.registry, fixture.contract.proposedRegistry);

    const schema2 = { ...fixture.contract.proposedRegistry, schemaVersion: 2 };
    writeJson(paths.registry, schema2);
    const historicalRoute = verifyCanonicalBaselineRegistryFile({ filePath: paths.registry, env: {} });
    assert.strictEqual(historicalRoute.status, GATE_STATUS.REGISTRY_HOLD);
    assert.strictEqual(historicalRoute.reasonCode, 'COMPOSITE_BASELINE_ACTIVATION_EVIDENCE_REQUIRED');

    const schema4 = { ...fixture.contract.proposedRegistry, schemaVersion: 4 };
    writeJson(paths.registry, schema4);
    const unsupported = verifyCanonicalBaselineRegistryFile({ filePath: paths.registry, env });
    assert.strictEqual(unsupported.status, GATE_STATUS.REGISTRY_HOLD);
    assert.strictEqual(unsupported.reasonCode, 'CANONICAL_BASELINE_COMPOSITE_SCHEMA_UNSUPPORTED');

    writeJson(paths.registry, fixture.contract.proposedRegistry);
    const symlinkPath = path.join(tempDir, 'registry-link.json');
    fs.symlinkSync(paths.registry, symlinkPath);
    const symlink = verifyCanonicalBaselineRegistryFile({ filePath: symlinkPath, env });
    assert.strictEqual(symlink.status, GATE_STATUS.MALFORMED);
    assert.strictEqual(symlink.reasonCode, 'CANONICAL_BASELINE_REGISTRY_SYMLINK_REJECTED');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  console.log('P59 fresh canonical registry release gate: PASS');
})();
