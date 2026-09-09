'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  EXPECTED_CANONICAL_SHA256,
  CANONICAL_SOURCE_STATUS,
} = require('../../tools/canonical-source-evidence');
const {
  OPERATOR_STATUS,
  prepareExternalCanonicalEvidence,
} = require('../../src/qualification/external-canonical-evidence-operator');
const {
  parseArgs,
  readContext,
} = require('../../tools/prepare-external-canonical-evidence');

const H64 = 'a'.repeat(64);
const H64B = 'b'.repeat(64);
const C40 = 'c'.repeat(40);

function context(overrides = {}) {
  return {
    evidenceId: 'canonical-evidence-001',
    upstreamCloseoutPacketHashSha256: H64,
    releaseCandidateId: 'rc-001',
    sourceCommitSha: C40,
    artifactSha256: H64B,
    environmentRef: 'staging-evidence-environment',
    environmentConfigSha256: 'd'.repeat(64),
    verifierId: 'external-readiness-verifier-01',
    sourceRef: 'controlled://canonical-original/source-artifact',
    evidenceArtifactSha256: 'e'.repeat(64),
    verifiedAt: '2026-09-09T17:30:00Z',
    expiresAt: '2026-09-16T17:30:00Z',
    scopeRef: 'startak-real-estate/canonical-source',
    ...overrides,
  };
}

const verifiedEvaluator = () => Object.freeze({
  status: CANONICAL_SOURCE_STATUS.VERIFIED,
  evaluated: true,
  verified: true,
  sourcePathProvided: true,
  expectedSha256: EXPECTED_CANONICAL_SHA256,
  computedSha256: EXPECTED_CANONICAL_SHA256,
  reasonCode: null,
});

// 1. Strict verified evidence produces the existing P22 signing package, not a signature.
{
  const result = prepareExternalCanonicalEvidence({
    sourcePath: '/externally-controlled/canonical-original.bin',
    context: context(),
    evidenceEvaluator: verifiedEvaluator,
  });
  assert.strictEqual(result.status, OPERATOR_STATUS.READY_FOR_EXTERNAL_READINESS_VERIFIER_SIGNATURE);
  assert.strictEqual(result.canonicalSourceEvidence.verified, true);
  assert.strictEqual(result.signingPackage.status, 'READY_FOR_EXTERNAL_READINESS_VERIFIER_SIGNATURE');
  assert.strictEqual(result.signingPackage.externalEvidenceBlockerClosed, false);
  assert.strictEqual(result.privateSigningKeyAccepted, false);
  assert.strictEqual(result.e2iAcceptancePending, true);
  assert.strictEqual(result.authority.releaseAuthorized, false);
  assert.strictEqual(result.authority.mergeAuthorized, false);
  assert.strictEqual(result.authority.deploymentAuthorized, false);
  assert.strictEqual(result.authority.goLiveAuthorized, false);
  assert.strictEqual(result.authority.transactionAuthorized, false);
  assert(!JSON.stringify(result).includes('/externally-controlled/canonical-original.bin'));
}

// 2. Missing strict evidence holds and never invokes the package builder.
{
  let packageCalled = false;
  const result = prepareExternalCanonicalEvidence({
    sourcePath: '/missing/canonical-original.bin',
    context: context(),
    evidenceEvaluator: () => ({
      status: CANONICAL_SOURCE_STATUS.MISSING_REQUIRED,
      evaluated: false,
      verified: false,
      sourcePathProvided: true,
      expectedSha256: EXPECTED_CANONICAL_SHA256,
      computedSha256: null,
      reasonCode: 'CANONICAL_SOURCE_FILE_REQUIRED_BUT_UNAVAILABLE',
    }),
    packageBuilder: () => { packageCalled = true; throw new Error('must not run'); },
  });
  assert.strictEqual(result.status, OPERATOR_STATUS.HOLD_CANONICAL_SOURCE_EVIDENCE);
  assert.strictEqual(result.signingPackage, null);
  assert.strictEqual(packageCalled, false);
  assert.strictEqual(result.authority.canonicalExternalSourceBlockerClosed, false);
}

// 3. Hash mismatch remains visible as a digest/reason but raw source path is minimized.
{
  const sensitivePath = '/secret/mount/client/canonical-original.bin';
  const result = prepareExternalCanonicalEvidence({
    sourcePath: sensitivePath,
    context: context(),
    evidenceEvaluator: () => ({
      status: CANONICAL_SOURCE_STATUS.MISMATCH,
      evaluated: true,
      verified: false,
      sourcePathProvided: true,
      expectedSha256: EXPECTED_CANONICAL_SHA256,
      computedSha256: 'f'.repeat(64),
      reasonCode: 'CANONICAL_SOURCE_HASH_MISMATCH',
    }),
  });
  const serialized = JSON.stringify(result);
  assert.strictEqual(result.status, OPERATOR_STATUS.HOLD_CANONICAL_SOURCE_EVIDENCE);
  assert.strictEqual(result.canonicalSourceEvidence.computedSha256, 'f'.repeat(64));
  assert(!serialized.includes(sensitivePath));
  assert(!serialized.includes('/secret/mount'));
}

// 4. Context must be an object; caller authority injection is not propagated because only P22 fields are selected.
{
  assert.throws(() => prepareExternalCanonicalEvidence({ sourcePath: '/x', context: null }), /context must be an object/);
  const result = prepareExternalCanonicalEvidence({
    sourcePath: '/x',
    context: context({ releaseAuthorized: true, privateKeyPem: 'DO-NOT-PROPAGATE' }),
    evidenceEvaluator: verifiedEvaluator,
  });
  const serialized = JSON.stringify(result);
  assert.strictEqual(result.authority.releaseAuthorized, false);
  assert(!serialized.includes('DO-NOT-PROPAGATE'));
  assert(!serialized.includes('privateKeyPem'));
}

// 5. CLI argument parser is narrow.
{
  assert.deepStrictEqual(parseArgs(['--source', 'a', '--context', 'b']), { source: 'a', context: 'b' });
  assert.throws(() => parseArgs(['--source', 'a', '--context', 'b', '--private-key', 'x']), /UNKNOWN_ARGUMENT/);
  assert.throws(() => parseArgs(['--source', 'a']), /SOURCE_AND_CONTEXT_REQUIRED/);
}

// 6. Context-file reader rejects secret/unknown fields.
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'startak-canonical-context-'));
  try {
    const validPath = path.join(dir, 'valid.json');
    fs.writeFileSync(validPath, JSON.stringify(context()));
    assert.strictEqual(readContext(validPath).releaseCandidateId, 'rc-001');

    const secretPath = path.join(dir, 'secret.json');
    fs.writeFileSync(secretPath, JSON.stringify({ ...context(), bearerToken: 'secret-token-value' }));
    assert.throws(() => readContext(secretPath), /CONTEXT_FIELD_NOT_ALLOWED:bearerToken/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// 7. Real CLI missing-source path fails closed with exit 2 and never prints the raw source path.
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'startak-canonical-cli-'));
  try {
    const contextPath = path.join(dir, 'context.json');
    const sourcePath = path.join(dir, 'sensitive-canonical-original.bin');
    fs.writeFileSync(contextPath, JSON.stringify(context()));
    const run = spawnSync(process.execPath, [
      path.join(__dirname, '../../tools/prepare-external-canonical-evidence.js'),
      '--source', sourcePath,
      '--context', contextPath,
    ], { encoding: 'utf8' });
    assert.strictEqual(run.status, 2);
    assert(run.stdout.includes('HOLD_CANONICAL_SOURCE_EVIDENCE'));
    assert(!run.stdout.includes(sourcePath));
    assert(!run.stderr.includes(sourcePath));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

console.log('external canonical evidence operator tests: PASS');
