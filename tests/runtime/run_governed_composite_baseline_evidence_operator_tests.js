'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  createGovernedCompositeBaselineRegistryCandidate,
  stableStringify,
} = require('../../src/qualification/canonical-baseline-registry');
const { STATUS: P31_STATUS } = require('../../src/qualification/canonical-rebaseline-activation-plan');
const { sha256Bytes } = require('../../src/qualification/governed-composite-baseline-evidence-verifier');

const ROOT = path.join(__dirname, '..', '..');
const CLI = path.join(ROOT, 'tools', 'prepare-governed-composite-baseline-evidence.js');
const COMMIT = 'a'.repeat(40);
const LEGACY = 'ac0767d3f13c463259f401a5d7af06c1140ee780a9f86489eb17ad9d7c72dc71';
const ARTIFACT = Buffer.from('release-artifact-p35', 'utf8');
const ENVIRONMENT = Buffer.from('DATABASE_URL=p35-secret-must-not-leak\nFEATURE_FLAG=1', 'utf8');

function sha256Object(value) {
  return crypto.createHash('sha256').update(stableStringify(value), 'utf8').digest('hex');
}

function candidate() {
  const manifest = {
    schemaVersion: 1,
    baselineId: 'canonical-rebaseline:p35-fixture',
    baselineType: 'QUALIFIED_GIT_COMMIT_AND_RELEASE_ARTIFACT',
    qualifiedSourceCommitSha: COMMIT,
    releaseArtifactSha256: sha256Bytes(ARTIFACT, 'artifact'),
    environmentConfigSha256: sha256Bytes(ENVIRONMENT, 'environment'),
    supersedesLegacyCanonicalSha256: LEGACY,
    governanceDecisionHashSha256: 'b'.repeat(64),
    reviewerLockHashSha256: 'c'.repeat(64),
  };
  const activationPlan = {
    status: P31_STATUS.READY_FOR_EXPLICIT_BASELINE_ACTIVATION_CHANGE_PLAN,
    activationPlanHashSha256: 'd'.repeat(64),
    successorBaselineManifest: manifest,
    successorBaselineManifestHashSha256: sha256Object(manifest),
    targetActivationContract: {
      targetPath: 'config/governance/canonical-baseline.json',
      expectedPriorMode: 'LEGACY_FILE_SHA256',
      proposedMode: 'GOVERNED_COMPOSITE_BASELINE',
      expectedLegacyCanonicalSha256: LEGACY,
    },
    activationApplied: false,
    canonicalBaselineChanged: false,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    goLiveAuthorized: false,
    transactionAuthorized: false,
  };
  return createGovernedCompositeBaselineRegistryCandidate({ activationPlan });
}

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: ROOT, encoding: 'utf8' });
}

(function run() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p35-operator-'));
  try {
    const candidatePath = path.join(dir, 'candidate.json');
    const artifactPath = path.join(dir, 'artifact.bin');
    const environmentPath = path.join(dir, 'environment.conf');
    const outputPath = path.join(dir, 'evidence.json');
    fs.writeFileSync(candidatePath, JSON.stringify(candidate()), 'utf8');
    fs.writeFileSync(artifactPath, ARTIFACT);
    fs.writeFileSync(environmentPath, ENVIRONMENT);

    const baseArgs = [
      '--candidate', candidatePath,
      '--artifact', artifactPath,
      '--environment-config', environmentPath,
      '--commit', COMMIT,
      '--verification-id', 'p35-evidence-1',
      '--verified-by', 'engineering-verifier:p35',
      '--verified-at', '2026-09-10T06:40:00Z',
      '--output', outputPath,
    ];

    const good = runCli(baseArgs);
    assert.strictEqual(good.status, 0, `${good.stdout}\n${good.stderr}`);
    assert.match(good.stdout, /P35_COMPOSITE_EVIDENCE_OPERATOR_RESULT=PASS/);
    assert.strictEqual(good.stdout.includes('p35-secret-must-not-leak'), false);
    assert.strictEqual(good.stderr.includes('p35-secret-must-not-leak'), false);
    const evidenceText = fs.readFileSync(outputPath, 'utf8');
    const evidence = JSON.parse(evidenceText);
    assert.strictEqual(evidence.status, 'COMPOSITE_BASELINE_EVIDENCE_VERIFIED_CANDIDATE_ONLY');
    assert.strictEqual(evidence.activationApplied, false);
    assert.strictEqual(evidence.releaseAuthorized, false);
    assert.strictEqual(evidenceText.includes('p35-secret-must-not-leak'), false);

    fs.unlinkSync(outputPath);
    fs.writeFileSync(artifactPath, Buffer.from('wrong-artifact'));
    const mismatch = runCli(baseArgs);
    assert.strictEqual(mismatch.status, 2);
    assert.match(mismatch.stderr, /RELEASE_ARTIFACT_SHA256_MISMATCH/);
    assert.strictEqual(fs.existsSync(outputPath), false);
    assert.strictEqual(mismatch.stderr.includes('p35-secret-must-not-leak'), false);

    const privateKeyAttempt = runCli([...baseArgs, '--private-key', 'secret.pem']);
    assert.strictEqual(privateKeyAttempt.status, 1);
    assert.match(privateKeyAttempt.stderr, /UNKNOWN_ARGUMENT/);
    assert.strictEqual(privateKeyAttempt.stderr.includes('secret.pem'), false);

    const duplicate = runCli([...baseArgs, '--commit', COMMIT]);
    assert.strictEqual(duplicate.status, 1);
    assert.match(duplicate.stderr, /DUPLICATE_ARGUMENT/);

    console.log('governed composite baseline evidence operator tests: PASS');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
})();
