'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  EVIDENCE_TYPE,
} = require('../../src/standards/production-evidence-go-live-readiness');
const {
  STATUS,
  REQUIRED_EVIDENCE_TYPES,
  prepareReadinessVerifierRegistryIntake,
} = require('../../src/qualification/readiness-verifier-registry-intake-package');

const results = [];

function test(id, fn) {
  try {
    fn();
    results.push([id, 'PASS']);
    console.log(`${id} PASS`);
  } catch (error) {
    results.push([id, `FAIL: ${error.message}`]);
    console.log(`${id} FAIL: ${error.message}`);
  }
}

function publicMaterial() {
  const { publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).trim();
  const publicKeySha256 = crypto.createHash('sha256').update(publicKeyPem).digest('hex');
  return { publicKeyPem, publicKeySha256 };
}

const firstKey = publicMaterial();
const secondKey = publicMaterial();

function registry(overrides = {}) {
  const base = {
    registryId: 'startak-production-readiness-verifiers-v1',
    governanceArtifactSha256: 'a'.repeat(64),
    verifiers: [
      {
        verifierId: 'verifier-governance-01',
        verifierSubjectRef: 'external-subject:governance-01',
        allowedEvidenceTypes: [
          EVIDENCE_TYPE.CANONICAL_SOURCE_HASH_COMPARISON,
          EVIDENCE_TYPE.SAUDI_LEGAL_OPERATING_MODE_REVIEW,
          EVIDENCE_TYPE.PDPL_DATA_GOVERNANCE_REVIEW,
        ],
        publicKeyPem: firstKey.publicKeyPem,
        publicKeySha256: firstKey.publicKeySha256,
        governanceEvidenceRef: 'governance://readiness-verifier/governance-01',
        activeFrom: '2026-09-01T00:00:00.000Z',
        activeUntil: null,
      },
      {
        verifierId: 'verifier-operations-01',
        verifierSubjectRef: 'external-subject:operations-01',
        allowedEvidenceTypes: [
          EVIDENCE_TYPE.PROFESSIONAL_STANDARDS_SCOPE_REVIEW,
          EVIDENCE_TYPE.PRODUCTION_EXECUTION_CHAIN_CONFIRMATION,
          EVIDENCE_TYPE.OPERATING_MODE_CLAIMS_RESTRICTION_CONFIRMATION,
        ],
        publicKeyPem: secondKey.publicKeyPem,
        publicKeySha256: secondKey.publicKeySha256,
        governanceEvidenceRef: 'governance://readiness-verifier/operations-01',
        activeFrom: '2026-09-01T00:00:00.000Z',
        activeUntil: null,
      },
    ],
  };
  return { ...base, ...overrides };
}

test('READINESS-VERIFIER-INTAKE-01', () => {
  const result = prepareReadinessVerifierRegistryIntake({ registry: registry() });
  assert.strictEqual(result.status, STATUS.READY_FOR_OUT_OF_BAND_TRUST_ROOT_PINNING);
  assert.strictEqual(result.allRequiredEvidenceTypesCovered, true);
  assert.strictEqual(result.minimumDistinctVerifierSubjectsSatisfied, true);
  assert.strictEqual(result.outOfBandPinningStillRequired, true);
  assert.strictEqual(result.e2iAcceptancePending, true);
  assert.ok(/^[a-f0-9]{64}$/.test(result.registryHashSha256));
  assert.strictEqual(result.outOfBandPinValue, result.registryHashSha256);
  assert.deepStrictEqual([...result.requiredEvidenceTypes].sort(), [...REQUIRED_EVIDENCE_TYPES].sort());
});

test('READINESS-VERIFIER-INTAKE-02', () => {
  const first = prepareReadinessVerifierRegistryIntake({ registry: registry() });
  const second = prepareReadinessVerifierRegistryIntake({ registry: registry() });
  assert.strictEqual(first.registryHashSha256, second.registryHashSha256);
});

test('READINESS-VERIFIER-INTAKE-03', () => {
  const value = registry();
  value.verifiers[1] = {
    ...value.verifiers[1],
    allowedEvidenceTypes: value.verifiers[1].allowedEvidenceTypes.filter(
      (type) => type !== EVIDENCE_TYPE.OPERATING_MODE_CLAIMS_RESTRICTION_CONFIRMATION,
    ),
  };
  const result = prepareReadinessVerifierRegistryIntake({ registry: value });
  assert.strictEqual(result.status, STATUS.HOLD_READINESS_VERIFIER_COVERAGE);
  assert.ok(result.blockers.includes(`READINESS_VERIFIER_COVERAGE_MISSING:${EVIDENCE_TYPE.OPERATING_MODE_CLAIMS_RESTRICTION_CONFIRMATION}`));
});

test('READINESS-VERIFIER-INTAKE-04', () => {
  const value = registry();
  value.verifiers[1] = {
    ...value.verifiers[1],
    verifierSubjectRef: value.verifiers[0].verifierSubjectRef,
  };
  const result = prepareReadinessVerifierRegistryIntake({ registry: value });
  assert.strictEqual(result.status, STATUS.HOLD_READINESS_VERIFIER_SUBJECT_DIVERSITY);
});

test('READINESS-VERIFIER-INTAKE-05', () => {
  const value = registry();
  value.verifiers[0] = { ...value.verifiers[0], publicKeySha256: 'f'.repeat(64) };
  const result = prepareReadinessVerifierRegistryIntake({ registry: value });
  assert.strictEqual(result.status, STATUS.HOLD_INVALID_READINESS_VERIFIER_REGISTRY);
  assert.ok(result.blockers.some((item) => item.includes('READINESS_VERIFIER_PUBLIC_KEY_HASH_MISMATCH')));
});

test('READINESS-VERIFIER-INTAKE-06', () => {
  const value = registry();
  value.verifiers[0] = { ...value.verifiers[0], privateKeyPem: 'DO-NOT-ACCEPT' };
  const result = prepareReadinessVerifierRegistryIntake({ registry: value });
  assert.strictEqual(result.status, STATUS.HOLD_INVALID_READINESS_VERIFIER_REGISTRY);
  assert.ok(result.blockers.some((item) => item.includes('FORBIDDEN_SECRET_MATERIAL')));
});

test('READINESS-VERIFIER-INTAKE-07', () => {
  const result = prepareReadinessVerifierRegistryIntake({ registry: registry() });
  for (const flag of Object.values(result.authority)) assert.strictEqual(flag, false);
  assert.strictEqual(result.privateSigningKeyAccepted, false);
});

test('READINESS-VERIFIER-INTAKE-08', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'startak-readiness-verifier-intake-'));
  try {
    const inputPath = path.join(tempDir, 'registry.json');
    const outputPath = path.join(tempDir, 'result.json');
    fs.writeFileSync(inputPath, JSON.stringify(registry()), 'utf8');
    execFileSync(process.execPath, [
      path.join(__dirname, '../../tools/readiness-verifier-registry-intake-package.js'),
      '--registry', inputPath,
      '--out', outputPath,
    ], { stdio: 'pipe' });
    const output = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    assert.strictEqual(output.status, STATUS.READY_FOR_OUT_OF_BAND_TRUST_ROOT_PINNING);
    assert.strictEqual(fs.statSync(outputPath).mode & 0o777, 0o600);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('READINESS-VERIFIER-INTAKE-09', () => {
  const result = prepareReadinessVerifierRegistryIntake({ registry: null });
  assert.strictEqual(result.status, STATUS.HOLD_INVALID_READINESS_VERIFIER_REGISTRY);
  assert.strictEqual(result.registryHashSha256, null);
});

const failed = results.filter((entry) => entry[1] !== 'PASS');
console.log(`READINESS_VERIFIER_REGISTRY_INTAKE_RESULT=${failed.length === 0 ? 'PASS' : 'FAIL'} ${results.filter((entry) => entry[1] === 'PASS').length}/${results.length}`);
if (failed.length > 0) process.exit(1);
