'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { sha256 } = require('../../src/standards/standards-registry');
const { ATTESTATION_TYPE } = require('../../src/standards/execution-attestation-post-deployment-closeout');
const {
  STATUS,
  prepareExecutionAttestorRegistryIntake,
  prepareExecutionAttestationSigningRequest,
} = require('../../src/qualification/e2h-execution-attestor-intake');
const tool = require('../../tools/e2h-execution-attestor-intake');

const policy = JSON.parse(fs.readFileSync(path.join(__dirname, '../../governance/e2h-execution-attestation-post-deployment-closeout-policy-2026-09-08.json'), 'utf8'));

function key() {
  const { publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).trim();
  return { publicKeyPem, publicKeySha256: sha256(publicKeyPem) };
}
const mergeKey = key(); const deployKey = key(); const smokeKey = key(); const rollbackKey = key();

function attestor(id, subject, types, k) {
  return { attestorId: id, attestorSubjectRef: subject, allowedAttestationTypes: types, publicKeyPem: k.publicKeyPem, publicKeySha256: k.publicKeySha256, governanceEvidenceRef: `governance:${id}`, activeFrom: '2026-01-01T00:00:00Z', activeUntil: '2027-01-01T00:00:00Z' };
}
function registry() {
  return {
    registryId: 'startak-e2h-execution-attestor-registry-v1',
    governanceArtifactSha256: 'a'.repeat(64),
    attestors: [
      attestor('merge-attestor-001', 'subject:merge-ops', [ATTESTATION_TYPE.MERGE_EXECUTION_ATTESTATION], mergeKey),
      attestor('deployment-attestor-001', 'subject:deployment-ops', [ATTESTATION_TYPE.DEPLOYMENT_EXECUTION_ATTESTATION], deployKey),
      attestor('smoke-attestor-001', 'subject:independent-qa', [ATTESTATION_TYPE.POST_DEPLOYMENT_SMOKE_VALIDATION], smokeKey),
      attestor('rollback-attestor-001', 'subject:recovery-ops', [ATTESTATION_TYPE.ROLLBACK_READINESS_VALIDATION], rollbackKey),
    ],
  };
}

function e2gPacket() {
  const releaseCandidate = { releaseCandidateId: 'startak-production-rc-001', sourceCommitSha: '1'.repeat(40), artifactSha256: '2'.repeat(64), environmentRef: 'cloudflare-pages:production:startak-real-estate', environmentConfigSha256: '3'.repeat(64), upstreamEvidencePacketHashSha256: '4'.repeat(64) };
  const core = {
    schemaVersion: 1,
    decisionPacketId: 'e2g-human-release-decisions-001',
    upstreamValidationPacketId: 'e2f-production-validation-001',
    upstreamValidationPacketHashSha256: '5'.repeat(64),
    policyId: 'STARTAK-E2G-SYNTHETIC-FIXTURE',
    releaseCandidate,
    releaseAuthorityRegistryId: 'synthetic-e2g-authority-registry',
    releaseAuthorityRegistryHashSha256: '6'.repeat(64),
    decisions: [],
    preparedByRef: 'test:fixture',
    preparedAt: '2026-09-11T17:00:00Z',
  };
  return {
    ...core,
    status: 'HUMAN_RELEASE_DECISIONS_COMPLETE_PENDING_EXECUTION',
    blockers: [],
    decisionPacketHashSha256: sha256(core),
    releaseAuthorized: true,
    mergeAuthorized: true,
    deploymentAuthorized: true,
    mergeExecuted: false,
    deploymentExecuted: false,
    postDecisionExecutionAttestationRequired: true,
    formalStandardsConformanceEstablished: false,
    standardsOrRulesActivated: false,
    saudiProfessionalLicensingEstablished: false,
    certifiedValuationAuthorityEstablished: false,
    externalIssuanceAuthorized: false,
    transactionAuthorized: false,
  };
}

function unsignedMergeAttestation(upstream, overrides = {}) {
  return {
    attestationId: 'merge-execution-attestation-001',
    attestationType: ATTESTATION_TYPE.MERGE_EXECUTION_ATTESTATION,
    decisionPacketHashSha256: upstream.decisionPacketHashSha256,
    releaseCandidateId: upstream.releaseCandidate.releaseCandidateId,
    approvedSourceCommitSha: upstream.releaseCandidate.sourceCommitSha,
    artifactSha256: upstream.releaseCandidate.artifactSha256,
    environmentRef: upstream.releaseCandidate.environmentRef,
    environmentConfigSha256: upstream.releaseCandidate.environmentConfigSha256,
    attestorId: 'merge-attestor-001',
    evidenceSourceRef: 'github:merge-execution:001',
    evidenceArtifactSha256: '7'.repeat(64),
    observedAt: '2026-09-11T17:30:00Z',
    expiresAt: '2026-09-12T17:30:00Z',
    result: 'VERIFIED',
    signatureAlgorithm: 'RSA-SHA256',
    targetBranchRef: 'refs/heads/main',
    resultingMergeCommitSha: '8'.repeat(40),
    ...overrides,
  };
}

(function registryReady() {
  const result = prepareExecutionAttestorRegistryIntake({ registry: registry() });
  assert.strictEqual(result.status, STATUS.READY_FOR_E2H_EXECUTION_ATTESTOR_TRUST_ROOT_PINNING);
  assert.strictEqual(result.registryHashSha256, result.outOfBandPinValue);
  assert.strictEqual(result.allRequiredAttestationTypesCovered, true);
  assert.strictEqual(result.deploymentSmokeSubjectSeparationSatisfied, true);
  assert.strictEqual(result.authority.deploymentExecuted, false);
})();

(function coverageHold() {
  const value = registry(); value.attestors.pop();
  const result = prepareExecutionAttestorRegistryIntake({ registry: value });
  assert.strictEqual(result.status, STATUS.HOLD_EXECUTION_ATTESTOR_COVERAGE);
  assert(result.blockers.includes('EXECUTION_ATTESTOR_COVERAGE_MISSING:ROLLBACK_READINESS_VALIDATION'));
})();

(function separationHold() {
  const value = registry(); value.attestors[2].attestorSubjectRef = 'subject:deployment-ops';
  const result = prepareExecutionAttestorRegistryIntake({ registry: value });
  assert.strictEqual(result.status, STATUS.HOLD_EXECUTION_ATTESTOR_SEPARATION);
  assert(result.blockers.includes('DEPLOYMENT_SMOKE_ATTESTOR_SUBJECT_CONFLICT:subject:deployment-ops'));
})();

(function secretRejected() {
  const value = registry(); value.secretToken = 'forbidden';
  const result = prepareExecutionAttestorRegistryIntake({ registry: value });
  assert.strictEqual(result.status, STATUS.HOLD_INVALID_EXECUTION_ATTESTOR_REGISTRY);
})();

(function signingRequestReady() {
  const upstream = e2gPacket(); const proposed = registry();
  const intake = prepareExecutionAttestorRegistryIntake({ registry: proposed });
  const input = { policy, upstreamDecisionPacket: upstream, executionAttestorRegistry: proposed, expectedExecutionAttestorRegistryHashSha256: intake.registryHashSha256, attestation: unsignedMergeAttestation(upstream) };
  const a = prepareExecutionAttestationSigningRequest(input); const b = prepareExecutionAttestationSigningRequest(input);
  assert.strictEqual(a.status, STATUS.READY_FOR_EXTERNAL_EXECUTION_RSA_SHA256_SIGNATURE);
  assert.strictEqual(a.signingPayloadHashSha256, b.signingPayloadHashSha256);
  assert.strictEqual(Buffer.from(a.signingPayloadBase64, 'base64').toString('utf8'), a.signingPayloadCanonicalUtf8);
  assert.strictEqual(a.signatureStillRequired, true);
  assert.strictEqual(a.authority.executionAttestationAccepted, false);
})();

(function badPinHold() {
  const upstream = e2gPacket();
  const result = prepareExecutionAttestationSigningRequest({ policy, upstreamDecisionPacket: upstream, executionAttestorRegistry: registry(), expectedExecutionAttestorRegistryHashSha256: 'f'.repeat(64), attestation: unsignedMergeAttestation(upstream) });
  assert.strictEqual(result.status, STATUS.HOLD_E2H_EXECUTION_ATTESTOR_ROOT);
})();

(function tamperedUpstreamHold() {
  const upstream = e2gPacket(); upstream.releaseCandidate = { ...upstream.releaseCandidate, artifactSha256: '9'.repeat(64) };
  const proposed = registry(); const intake = prepareExecutionAttestorRegistryIntake({ registry: proposed });
  const result = prepareExecutionAttestationSigningRequest({ policy, upstreamDecisionPacket: upstream, executionAttestorRegistry: proposed, expectedExecutionAttestorRegistryHashSha256: intake.registryHashSha256, attestation: unsignedMergeAttestation(upstream) });
  assert.strictEqual(result.status, STATUS.HOLD_E2G_DECISION_PACKET);
})();

(function wrongAttestorTypeHold() {
  const upstream = e2gPacket(); const proposed = registry(); const intake = prepareExecutionAttestorRegistryIntake({ registry: proposed });
  const result = prepareExecutionAttestationSigningRequest({ policy, upstreamDecisionPacket: upstream, executionAttestorRegistry: proposed, expectedExecutionAttestorRegistryHashSha256: intake.registryHashSha256, attestation: unsignedMergeAttestation(upstream, { attestorId: 'smoke-attestor-001' }) });
  assert.strictEqual(result.status, STATUS.HOLD_E2H_ATTESTATION_SIGNING_REQUEST);
  assert(result.blockers.some((x) => x.startsWith('EXECUTION_ATTESTOR_TYPE_NOT_ALLOWED:')));
})();

(function bindingMismatchHold() {
  const upstream = e2gPacket(); const proposed = registry(); const intake = prepareExecutionAttestorRegistryIntake({ registry: proposed });
  const result = prepareExecutionAttestationSigningRequest({ policy, upstreamDecisionPacket: upstream, executionAttestorRegistry: proposed, expectedExecutionAttestorRegistryHashSha256: intake.registryHashSha256, attestation: unsignedMergeAttestation(upstream, { artifactSha256: '0'.repeat(64) }) });
  assert.strictEqual(result.status, STATUS.HOLD_E2H_ATTESTATION_SIGNING_REQUEST);
  assert(result.blockers.includes('ATTESTATION_ARTIFACT_HASH_MISMATCH'));
})();

(function signedRejected() {
  const upstream = e2gPacket(); const proposed = registry(); const intake = prepareExecutionAttestorRegistryIntake({ registry: proposed });
  const result = prepareExecutionAttestationSigningRequest({ policy, upstreamDecisionPacket: upstream, executionAttestorRegistry: proposed, expectedExecutionAttestorRegistryHashSha256: intake.registryHashSha256, attestation: unsignedMergeAttestation(upstream, { signatureBase64: 'ZmFrZQ==' }) });
  assert.strictEqual(result.status, STATUS.HOLD_E2H_ATTESTATION_SIGNING_REQUEST);
  assert(result.blockers.includes('SIGNED_ATTESTATION_NOT_ACCEPTED_BY_SIGNING_REQUEST_INTAKE'));
})();

(function cliHardeningAndModes() {
  assert.throws(() => tool.parseArgs(['registry', '--registry', 'a', '--registry', 'b']), /duplicate argument/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'startak-e2h-'));
  const proposed = registry(); const upstream = e2gPacket(); const intake = prepareExecutionAttestorRegistryIntake({ registry: proposed });
  const files = { registry: path.join(dir, 'registry.json'), policy: path.join(dir, 'policy.json'), upstream: path.join(dir, 'upstream.json'), attestation: path.join(dir, 'attestation.json'), out1: path.join(dir, 'out1.json'), out2: path.join(dir, 'out2.json') };
  fs.writeFileSync(files.registry, JSON.stringify(proposed)); fs.writeFileSync(files.policy, JSON.stringify(policy)); fs.writeFileSync(files.upstream, JSON.stringify(upstream)); fs.writeFileSync(files.attestation, JSON.stringify(unsignedMergeAttestation(upstream)));
  const script = path.join(__dirname, '../../tools/e2h-execution-attestor-intake.js');
  const r1 = spawnSync(process.execPath, [script, 'registry', '--registry', files.registry, '--out', files.out1], { encoding: 'utf8' }); assert.strictEqual(r1.status, 0, r1.stderr);
  const r2 = spawnSync(process.execPath, [script, 'attestation', '--policy', files.policy, '--upstream', files.upstream, '--registry', files.registry, '--expected-registry-sha', intake.registryHashSha256, '--attestation', files.attestation, '--out', files.out2], { encoding: 'utf8' }); assert.strictEqual(r2.status, 0, r2.stderr);
  assert.strictEqual(JSON.parse(fs.readFileSync(files.out2, 'utf8')).status, STATUS.READY_FOR_EXTERNAL_EXECUTION_RSA_SHA256_SIGNATURE);
  assert.strictEqual(fs.statSync(files.out2).mode & 0o777, 0o600);
  const link = path.join(dir, 'link.json'); fs.symlinkSync(files.registry, link); assert.throws(() => tool.readBoundedRegularJson(link), /symlink input/);
  fs.rmSync(dir, { recursive: true, force: true });
})();

console.log('E2H_EXECUTION_ATTESTOR_INTAKE_TESTS=PASS');
