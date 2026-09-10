'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
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
  STATUS: TOOL_STATUS,
  evaluateCompositeBaselineShadowFromEnvironment,
} = require('../../tools/composite-baseline-shadow-release-gate');

const ROOT = path.join(__dirname, '..', '..');
const REGISTRY_PATH = path.join(ROOT, 'config', 'governance', 'canonical-baseline.json');
const currentRegistry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));

function sha256Object(value) {
  return crypto.createHash('sha256').update(stableStringify(value), 'utf8').digest('hex');
}

function fixture() {
  const current = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  const legacy = currentRegistry.legacyBaseline.expectedSha256;
  const manifest = {
    schemaVersion: 1,
    baselineId: 'canonical-rebaseline:test-proposal',
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
    verificationId: 'shadow-fixture-1',
    verifiedByRef: 'operator:test',
    verifiedAt: '2026-09-10T06:00:00.000Z',
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
  return { candidate, evidence };
}

(function run() {
  const { candidate, evidence } = fixture();

  const pass = evaluateCompositeBaselineShadow({ currentRegistry, compositeCandidate: candidate, compositeEvidence: evidence });
  assert.strictEqual(pass.status, P36_STATUS.SHADOW_COMPOSITE_BASELINE_MATCH_NOT_ACTIVE);
  assert.strictEqual(pass.shadowComparisonMatch, true);
  assert.strictEqual(pass.authoritativeMode, MODE.LEGACY_FILE_SHA256);
  assert.strictEqual(pass.shadowMode, MODE.GOVERNED_COMPOSITE_BASELINE);
  assert.strictEqual(pass.activationApplied, false);
  assert.strictEqual(pass.canonicalBaselineChanged, false);
  assert.strictEqual(pass.releaseAuthorized, false);
  assert.strictEqual(pass.mergeAuthorized, false);
  assert.strictEqual(pass.deploymentAuthorized, false);
  assert.strictEqual(pass.goLiveAuthorized, false);
  assert.strictEqual(pass.transactionAuthorized, false);

  const deterministic = evaluateCompositeBaselineShadow({ currentRegistry, compositeCandidate: candidate, compositeEvidence: evidence });
  assert.strictEqual(deterministic.shadowEvaluationHashSha256, pass.shadowEvaluationHashSha256);

  const badCandidate = JSON.parse(JSON.stringify(candidate));
  badCandidate.successorBaselineManifest.releaseArtifactSha256 = '9'.repeat(64);
  const candidateHold = evaluateCompositeBaselineShadow({ currentRegistry, compositeCandidate: badCandidate, compositeEvidence: evidence });
  assert.strictEqual(candidateHold.status, P36_STATUS.HOLD_COMPOSITE_BASELINE_SHADOW);
  assert(candidateHold.blockers.includes('P32_SUCCESSOR_MANIFEST_HASH_MISMATCH'));

  const badEvidence = { ...evidence, observedReleaseArtifactSha256: '8'.repeat(64) };
  const evidenceHold = evaluateCompositeBaselineShadow({ currentRegistry, compositeCandidate: candidate, compositeEvidence: badEvidence });
  assert.strictEqual(evidenceHold.status, P36_STATUS.HOLD_COMPOSITE_BASELINE_SHADOW);
  assert(evidenceHold.blockers.includes('P34_COMPOSITE_EVIDENCE_HASH_MISMATCH'));
  assert(evidenceHold.blockers.includes('SHADOW_RELEASE_ARTIFACT_MISMATCH'));

  const escalatedEvidence = { ...evidence, releaseAuthorized: true };
  const authorityHold = evaluateCompositeBaselineShadow({ currentRegistry, compositeCandidate: candidate, compositeEvidence: escalatedEvidence });
  assert.strictEqual(authorityHold.status, P36_STATUS.HOLD_COMPOSITE_BASELINE_SHADOW);
  assert(authorityHold.blockers.includes('P34_COMPOSITE_EVIDENCE_BOUNDARY_INVALID'));

  const driftedRegistry = JSON.parse(JSON.stringify(currentRegistry));
  driftedRegistry.activeMode = MODE.GOVERNED_COMPOSITE_BASELINE;
  const registryHold = evaluateCompositeBaselineShadow({ currentRegistry: driftedRegistry, compositeCandidate: candidate, compositeEvidence: evidence });
  assert.strictEqual(registryHold.status, P36_STATUS.HOLD_COMPOSITE_BASELINE_SHADOW);

  const absent = evaluateCompositeBaselineShadowFromEnvironment({ env: {} });
  assert.strictEqual(absent.status, TOOL_STATUS.NOT_EVALUATED);
  assert.strictEqual(absent.verified, false);

  const requiredAbsent = evaluateCompositeBaselineShadowFromEnvironment({ env: { REQUIRE_COMPOSITE_BASELINE_SHADOW: '1' } });
  assert.strictEqual(requiredAbsent.status, TOOL_STATUS.MISSING_REQUIRED);

  const partial = evaluateCompositeBaselineShadowFromEnvironment({ env: { COMPOSITE_BASELINE_SHADOW_CANDIDATE_PATH: '/tmp/only-candidate.json' } });
  assert.strictEqual(partial.status, TOOL_STATUS.HOLD);
  assert.strictEqual(partial.reasonCode, 'COMPOSITE_BASELINE_SHADOW_PARTIAL_INPUT');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'startak-p36-'));
  try {
    const candidatePath = path.join(dir, 'candidate.json');
    const evidencePath = path.join(dir, 'evidence.json');
    fs.writeFileSync(candidatePath, JSON.stringify(candidate));
    fs.writeFileSync(evidencePath, JSON.stringify(evidence));
    const toolPass = evaluateCompositeBaselineShadowFromEnvironment({
      env: {
        COMPOSITE_BASELINE_SHADOW_CANDIDATE_PATH: candidatePath,
        COMPOSITE_BASELINE_SHADOW_EVIDENCE_PATH: evidencePath,
        REQUIRE_COMPOSITE_BASELINE_SHADOW: '1',
      },
    });
    assert.strictEqual(toolPass.status, TOOL_STATUS.VERIFIED);
    assert.strictEqual(toolPass.verified, true);
    assert.strictEqual(toolPass.shadowComparisonMatch, true);
    const serialized = JSON.stringify(toolPass);
    assert(!serialized.includes(candidatePath));
    assert(!serialized.includes(evidencePath));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  console.log('P36 composite baseline shadow release gate: PASS');
})();
