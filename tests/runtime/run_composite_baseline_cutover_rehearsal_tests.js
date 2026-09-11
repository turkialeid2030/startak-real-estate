'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  MODE,
  STATUS: P32_STATUS,
  evaluateCurrentCanonicalBaselineRegistry,
  stableStringify,
} = require('../../src/qualification/canonical-baseline-registry');
const {
  STATUS: P34_STATUS,
} = require('../../src/qualification/governed-composite-baseline-evidence-verifier');
const {
  STATUS: P36_STATUS,
  evaluateCompositeBaselineShadow,
} = require('../../src/qualification/composite-baseline-shadow-release-gate');
const {
  STATUS: P37_STATUS,
  runCompositeBaselineCutoverRehearsal,
} = require('../../src/qualification/composite-baseline-cutover-rehearsal');

const ROOT = path.join(__dirname, '..', '..');
const currentRegistry = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'governance', 'canonical-baseline.json'), 'utf8'));

function sha256Object(value) {
  return crypto.createHash('sha256').update(stableStringify(value), 'utf8').digest('hex');
}

function shadowFixture() {
  const current = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  const legacy = currentRegistry.legacyBaseline.expectedSha256;
  const manifest = {
    schemaVersion: 1,
    baselineId: 'canonical-rebaseline:p37-fixture',
    baselineType: 'QUALIFIED_GIT_COMMIT_AND_RELEASE_ARTIFACT',
    qualifiedSourceCommitSha: 'a'.repeat(40),
    releaseArtifactSha256: 'b'.repeat(64),
    environmentConfigSha256: 'c'.repeat(64),
    supersedesLegacyCanonicalSha256: legacy,
    governanceDecisionHashSha256: 'd'.repeat(64),
    reviewerLockHashSha256: 'e'.repeat(64),
  };
  const manifestHash = sha256Object(manifest);
  const candidateCore = {
    schemaVersion: 1,
    requestedMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    supersedesMode: MODE.LEGACY_FILE_SHA256,
    supersedesLegacyCanonicalSha256: legacy,
    successorBaselineManifest: manifest,
    successorBaselineManifestHashSha256: manifestHash,
    activationPlanHashSha256: 'f'.repeat(64),
    targetPath: 'config/governance/canonical-baseline.json',
  };
  const candidate = {
    ...candidateCore,
    status: P32_STATUS.COMPOSITE_REGISTRY_CANDIDATE_READY_FOR_EXPLICIT_CODE_CHANGE,
    candidateRegistryHashSha256: sha256Object(candidateCore),
    explicitActivationChangeRequired: true,
    candidateOnly: true,
    activationApplied: false,
    canonicalBaselineChanged: false,
    legacyCanonicalEvidenceClosed: false,
    existingE2iCanonicalEvidenceSatisfied: false,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    goLiveAuthorized: false,
    transactionAuthorized: false,
  };
  const evidenceCore = {
    schemaVersion: 1,
    verificationId: 'p37-shadow-evidence',
    verifiedByRef: 'operator:p37-test',
    verifiedAt: '2026-09-10T07:00:00.000Z',
    currentRegistryHashSha256: current.registryHashSha256,
    candidateRegistryHashSha256: candidate.candidateRegistryHashSha256,
    activationPlanHashSha256: candidate.activationPlanHashSha256,
    successorBaselineManifestHashSha256: candidate.successorBaselineManifestHashSha256,
    observedQualifiedSourceCommitSha: manifest.qualifiedSourceCommitSha,
    observedReleaseArtifactSha256: manifest.releaseArtifactSha256,
    observedEnvironmentConfigSha256: manifest.environmentConfigSha256,
  };
  const evidence = {
    ...evidenceCore,
    status: P34_STATUS.COMPOSITE_BASELINE_EVIDENCE_VERIFIED_CANDIDATE_ONLY,
    compositeEvidenceHashSha256: sha256Object(evidenceCore),
    blockers: [],
    rawReleaseArtifactSerialized: false,
    rawEnvironmentConfigSerialized: false,
    candidateOnly: true,
    activationApplied: false,
    explicitActivationCodeChangeRequired: true,
    independentReviewerEvidenceStillExternallyRequiredForRealActivation: true,
    postActivationReleaseVerifyRequired: true,
    productionEvidenceEstablishedHere: false,
    canonicalBaselineChanged: false,
    legacyCanonicalEvidenceClosed: false,
    existingE2iCanonicalEvidenceSatisfied: false,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    goLiveAuthorized: false,
    transactionAuthorized: false,
  };
  return evaluateCompositeBaselineShadow({ currentRegistry, compositeCandidate: candidate, compositeEvidence: evidence });
}

(function run() {
  const shadow = shadowFixture();
  assert.strictEqual(shadow.status, P36_STATUS.SHADOW_COMPOSITE_BASELINE_MATCH_NOT_ACTIVE);

  const input = {
    currentRegistry,
    shadowEvaluation: shadow,
    rehearsalId: 'cutover-rehearsal-001',
    preparedByRef: 'owner:turki',
    preparedAt: '2026-09-10T07:10:00+00:00',
  };
  const pass = runCompositeBaselineCutoverRehearsal(input);
  assert.strictEqual(pass.status, P37_STATUS.CUTOVER_REHEARSAL_COMPLETED_NO_ACTIVATION);
  assert.strictEqual(pass.cutoverSimulated, true);
  assert.strictEqual(pass.rollbackSimulated, true);
  assert.strictEqual(pass.rollbackRestoresExactAuthoritativeRegistry, true);
  assert.strictEqual(pass.transitions.length, 3);
  assert.strictEqual(pass.transitions[0].mode, MODE.LEGACY_FILE_SHA256);
  assert.strictEqual(pass.transitions[1].mode, MODE.GOVERNED_COMPOSITE_BASELINE);
  assert.strictEqual(pass.transitions[2].mode, MODE.LEGACY_FILE_SHA256);
  assert.strictEqual(pass.transitions[0].registryHashSha256, pass.transitions[2].registryHashSha256);
  assert.strictEqual(pass.actualRegistryMutationPerformed, false);
  assert.strictEqual(pass.actualReleaseGateModeChanged, false);
  assert.strictEqual(pass.actualDeploymentMutationPerformed, false);
  assert.strictEqual(pass.activationApplied, false);
  assert.strictEqual(pass.releaseAuthorized, false);
  assert.strictEqual(pass.mergeAuthorized, false);
  assert.strictEqual(pass.deploymentAuthorized, false);
  assert.strictEqual(pass.goLiveAuthorized, false);
  assert.strictEqual(pass.transactionAuthorized, false);

  const deterministic = runCompositeBaselineCutoverRehearsal(input);
  assert.strictEqual(deterministic.rehearsalHashSha256, pass.rehearsalHashSha256);

  const noShadow = runCompositeBaselineCutoverRehearsal({ ...input, shadowEvaluation: null });
  assert.strictEqual(noShadow.status, P37_STATUS.HOLD_CUTOVER_REHEARSAL);
  assert(noShadow.blockers.includes('P36_SHADOW_MATCH_REQUIRED'));

  const tamperedShadow = JSON.parse(JSON.stringify(shadow));
  tamperedShadow.candidateRegistryHashSha256 = '9'.repeat(64);
  const tamperHold = runCompositeBaselineCutoverRehearsal({ ...input, shadowEvaluation: tamperedShadow });
  assert.strictEqual(tamperHold.status, P37_STATUS.HOLD_CUTOVER_REHEARSAL);
  assert(tamperHold.blockers.includes('P36_SHADOW_EVALUATION_HASH_MISMATCH'));

  const escalatedShadow = { ...shadow, releaseAuthorized: true };
  const authorityHold = runCompositeBaselineCutoverRehearsal({ ...input, shadowEvaluation: escalatedShadow });
  assert.strictEqual(authorityHold.status, P37_STATUS.HOLD_CUTOVER_REHEARSAL);
  assert(authorityHold.blockers.includes('P36_SHADOW_AUTHORITY_BOUNDARY_INVALID'));

  const driftedRegistry = JSON.parse(JSON.stringify(currentRegistry));
  driftedRegistry.activeMode = MODE.GOVERNED_COMPOSITE_BASELINE;
  const registryHold = runCompositeBaselineCutoverRehearsal({ ...input, currentRegistry: driftedRegistry });
  assert.strictEqual(registryHold.status, P37_STATUS.HOLD_CUTOVER_REHEARSAL);
  assert(registryHold.blockers.includes('CURRENT_LEGACY_BASELINE_REGISTRY_NOT_CONFIRMED'));

  const badMeta = runCompositeBaselineCutoverRehearsal({ ...input, rehearsalId: '', preparedAt: 'not-a-date' });
  assert.strictEqual(badMeta.status, P37_STATUS.HOLD_CUTOVER_REHEARSAL);

  const serialized = JSON.stringify(pass);
  assert(!serialized.includes('privateKey'));
  assert(!serialized.includes('password'));
  assert(!serialized.includes('token'));

  console.log('P37 composite baseline cutover rehearsal: PASS');
})();
