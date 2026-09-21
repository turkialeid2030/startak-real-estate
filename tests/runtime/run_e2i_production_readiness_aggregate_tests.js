'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { sha256 } = require('../../src/standards/standards-registry');
const { E2H_STATUS } = require('../../src/standards/execution-attestation-post-deployment-closeout');
const {
  E2I_STATUS,
  EVIDENCE_TYPE,
  EVIDENCE_RESULT,
  normalizeReadinessVerifierRegistry,
  createReadinessEvidenceSigningPayload,
  verifyProductionEvidenceGoLiveReadinessPacketIntegrity,
} = require('../../src/standards/production-evidence-go-live-readiness');

const ROOT = path.join(__dirname, '../..');
const TOOL = path.join(ROOT, 'tools', 'e2i-production-readiness-aggregate.js');
const POLICY = JSON.parse(fs.readFileSync(path.join(ROOT, 'governance', 'e2i-production-evidence-go-live-readiness-policy-2026-09-08.json'), 'utf8'));
const FROZEN = Object.freeze({
  releaseCandidateId: 'startak-real-estate-rc-2026-09-16-e876208c19ff',
  sourceCommitSha: 'e876208c19ffbddd0dacd2bf8fce24aba1e52b55',
  artifactSha256: 'c3ddcd7b4a66fd58c271fb08b9e5a3efb5e4237f0015d3771e7ab9818412017f',
  environmentRef: 'cloudflare-pages:startak-real-estate:production',
  environmentConfigSha256: '819183fb9f4fb09017c636d2d1d841dd086ac4ba4bbccd103dffbc4c5980bc73',
});
const E2H_PREPARED_AT = '2026-09-21T09:00:00.000Z';
const VERIFIED_AT = '2026-09-21T10:00:00.000Z';
const E2I_PREPARED_AT = '2026-09-21T11:00:00.000Z';

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function rsaVerifier(verifierId, subjectRef, allowedEvidenceTypes) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).trim();
  return {
    privateKey,
    record: {
      verifierId,
      verifierSubjectRef: subjectRef,
      allowedEvidenceTypes,
      publicKeyPem,
      publicKeySha256: sha256(publicKeyPem),
      governanceEvidenceRef: `synthetic-ci:${verifierId}`,
      activeFrom: '2026-01-01T00:00:00.000Z',
      activeUntil: '2027-01-01T00:00:00.000Z',
    },
  };
}

function buildFixture() {
  const types = Object.values(EVIDENCE_TYPE);
  const verifierA = rsaVerifier('synthetic-verifier-a', 'synthetic-subject:a', types.slice(0, 3));
  const verifierB = rsaVerifier('synthetic-verifier-b', 'synthetic-subject:b', types.slice(3));
  const registry = {
    registryId: 'synthetic-e2i-readiness-verifier-registry',
    governanceArtifactSha256: 'a'.repeat(64),
    verifiers: [verifierA.record, verifierB.record],
  };
  const normalizedRegistry = normalizeReadinessVerifierRegistry(registry);

  const releaseCandidate = {
    ...FROZEN,
    upstreamEvidencePacketHashSha256: 'b'.repeat(64),
  };
  const closeoutCore = {
    schemaVersion: 1,
    closeoutPacketId: 'synthetic-e2h-closeout-001',
    upstreamDecisionPacketId: 'synthetic-e2g-decision-001',
    upstreamDecisionPacketHashSha256: 'c'.repeat(64),
    policyId: 'SYNTHETIC-E2H-CI-FIXTURE',
    releaseCandidate,
    executionAttestorRegistryId: 'synthetic-e2h-attestor-registry',
    executionAttestorRegistryHashSha256: 'd'.repeat(64),
    attestations: [],
    preparedByRef: 'synthetic-ci:test',
    preparedAt: E2H_PREPARED_AT,
  };
  const upstream = {
    ...closeoutCore,
    status: E2H_STATUS.EXECUTION_AND_POST_DEPLOYMENT_CLOSEOUT_COMPLETE,
    blockers: [],
    closeoutPacketHashSha256: sha256(closeoutCore),
    releaseAuthorized: true,
    mergeAuthorized: true,
    deploymentAuthorized: true,
    mergeExecuted: true,
    deploymentExecuted: true,
    postDeploymentSmokePassed: true,
    rollbackReadinessValidated: true,
    executionCloseoutComplete: true,
    formalStandardsConformanceEstablished: false,
    standardsOrRulesActivated: false,
    saudiProfessionalLicensingEstablished: false,
    certifiedValuationAuthorityEstablished: false,
    externalIssuanceAuthorized: false,
    transactionAuthorized: false,
  };

  const evidence = types.map((evidenceType, index) => {
    const verifier = index < 3 ? verifierA : verifierB;
    const base = {
      evidenceId: `synthetic-e2i-evidence-${index + 1}`,
      evidenceType,
      upstreamCloseoutPacketHashSha256: upstream.closeoutPacketHashSha256,
      releaseCandidateId: FROZEN.releaseCandidateId,
      sourceCommitSha: FROZEN.sourceCommitSha,
      artifactSha256: FROZEN.artifactSha256,
      environmentRef: FROZEN.environmentRef,
      environmentConfigSha256: FROZEN.environmentConfigSha256,
      verifierId: verifier.record.verifierId,
      sourceRef: `synthetic-ci:evidence:${index + 1}`,
      evidenceArtifactSha256: crypto.createHash('sha256').update(`synthetic-artifact-${index + 1}`).digest('hex'),
      verifiedAt: VERIFIED_AT,
      expiresAt: '2026-12-31T23:59:59.000Z',
      result: EVIDENCE_RESULT.VERIFIED,
      scopeRef: `synthetic-ci:e2i:${evidenceType}`,
      signatureAlgorithm: 'RSA-SHA256',
    };
    const payload = createReadinessEvidenceSigningPayload(base, POLICY);
    const signature = crypto.sign('RSA-SHA256', Buffer.from(stableStringify(payload), 'utf8'), verifier.privateKey);
    return { ...base, signatureBase64: signature.toString('base64') };
  });

  return { registry, registryHashSha256: normalizedRegistry.registryHashSha256, upstream, evidence };
}

function writeJson(dir, name, value) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return file;
}

function invoke(fixture, overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'startak-e2i-aggregate-'));
  const policyPath = writeJson(dir, 'policy.json', POLICY);
  const upstreamPath = writeJson(dir, 'upstream.json', overrides.upstream || fixture.upstream);
  const registryPath = writeJson(dir, 'registry.json', overrides.registry || fixture.registry);
  const evidencePath = writeJson(dir, 'evidence.json', overrides.evidence || fixture.evidence);
  const outputPath = path.join(dir, 'output.json');
  const result = spawnSync(process.execPath, [
    TOOL,
    '--packet-id', 'synthetic-e2i-readiness-packet-001',
    '--policy', policyPath,
    '--upstream', upstreamPath,
    '--registry', registryPath,
    '--expected-registry-sha256', overrides.expectedRegistrySha256 || fixture.registryHashSha256,
    '--evidence', evidencePath,
    '--prepared-by', 'synthetic-ci:test',
    '--prepared-at', E2I_PREPARED_AT,
    '--output', outputPath,
  ], { encoding: 'utf8' });
  const output = fs.existsSync(outputPath) ? JSON.parse(fs.readFileSync(outputPath, 'utf8')) : null;
  return { ...result, output };
}

const results = [];
function test(id, fn) {
  try {
    fn();
    results.push([id, 'PASS']);
    console.log(`${id} PASS`);
  } catch (error) {
    results.push([id, `FAIL: ${error.message}`]);
    console.error(`${id} FAIL: ${error.stack || error.message}`);
  }
}

test('E2I-AGGREGATE-01', () => {
  const fixture = buildFixture();
  const result = invoke(fixture);
  assert.strictEqual(result.status, 0, result.stderr);
  assert(result.output);
  assert.strictEqual(result.output.status, E2I_STATUS.GO_LIVE_READY_FOR_UNLICENSED_DECISION_SUPPORT);
  assert.strictEqual(result.output.goLiveReady, true);
  assert.strictEqual(result.output.goLiveOperatingMode, 'UNLICENSED_DECISION_SUPPORT');
  assert.strictEqual(result.output.architecturalStop, true);
  assert.strictEqual(result.output.transactionAuthorized, false);
  assert.strictEqual(verifyProductionEvidenceGoLiveReadinessPacketIntegrity(result.output), true);
});

test('E2I-AGGREGATE-02', () => {
  const fixture = buildFixture();
  const result = invoke(fixture, { expectedRegistrySha256: 'f'.repeat(64) });
  assert.strictEqual(result.status, 2, result.stderr);
  assert.strictEqual(result.output.status, E2I_STATUS.HOLD_READINESS_TRUST_ROOT);
  assert(result.output.blockers.includes('READINESS_VERIFIER_REGISTRY_HASH_MISMATCH'));
});

test('E2I-AGGREGATE-03', () => {
  const fixture = buildFixture();
  const result = invoke(fixture, { evidence: fixture.evidence.slice(0, 5) });
  assert.strictEqual(result.status, 2, result.stderr);
  assert.strictEqual(result.output.status, E2I_STATUS.WAITING_FOR_PRODUCTION_READINESS_EVIDENCE);
  assert.strictEqual(result.output.goLiveReady, false);
  assert.strictEqual(result.output.missingEvidenceTypes.length, 1);
});

test('E2I-AGGREGATE-04', () => {
  const fixture = buildFixture();
  const evidence = [...fixture.evidence];
  evidence[0] = { ...evidence[0], signatureBase64: Buffer.from('tampered').toString('base64') };
  const result = invoke(fixture, { evidence });
  assert.strictEqual(result.status, 2, result.stderr);
  assert.strictEqual(result.output.status, E2I_STATUS.HOLD_READINESS_EVIDENCE_INTEGRITY);
  assert(result.output.blockers.some((value) => value.startsWith('READINESS_EVIDENCE_SIGNATURE_INVALID:')));
});

test('E2I-AGGREGATE-05', () => {
  const fixture = buildFixture();
  const registry = { ...fixture.registry, privateKeyPem: 'synthetic-forbidden-material' };
  const result = invoke(fixture, { registry });
  assert.strictEqual(result.status, 65, result.stderr);
  assert.strictEqual(result.output, null);
  assert(result.stderr.includes('FORBIDDEN_SECRET_MATERIAL:registry.privateKeyPem'));
});

const failed = results.filter((entry) => entry[1] !== 'PASS');
console.log(`E2I_PRODUCTION_READINESS_AGGREGATE_RESULT=${failed.length === 0 ? 'PASS' : 'FAIL'} ${results.length - failed.length}/${results.length}`);
console.log('SYNTHETIC_FIXTURES_ONLY=true');
console.log('EXTERNAL_EVIDENCE_CREATED=false');
console.log('AUTHORITY_EFFECT=NONE');
if (failed.length) process.exit(1);
