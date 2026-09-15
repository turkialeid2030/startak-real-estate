'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { sha256 } = require('../../src/standards/standards-registry');
const { DECISION_TYPE } = require('../../src/standards/human-release-authority-deployment-decision');
const {
  STATUS,
  prepareReleaseAuthorityRegistryIntake,
  prepareReleaseDecisionSigningRequest,
} = require('../../src/qualification/e2g-release-authority-decision-intake');
const tool = require('../../tools/e2g-release-authority-decision-intake');

const policy = JSON.parse(fs.readFileSync(path.join(__dirname, '../../governance/e2g-human-release-authority-deployment-decision-policy-2026-09-08.json'), 'utf8'));

function keyPair() {
  const { publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).trim();
  return { publicKeyPem, publicKeySha256: sha256(publicKeyPem) };
}

const releaseKey = keyPair();
const mergeKey = keyPair();
const deployKey = keyPair();

function authority(authorityId, subject, types, key) {
  return {
    authorityId,
    authoritySubjectRef: subject,
    allowedDecisionTypes: types,
    publicKeyPem: key.publicKeyPem,
    publicKeySha256: key.publicKeySha256,
    governanceEvidenceRef: `governance:${authorityId}`,
    activeFrom: '2026-01-01T00:00:00Z',
    activeUntil: '2027-01-01T00:00:00Z',
  };
}

function registry() {
  return {
    registryId: 'startak-e2g-release-authority-registry-v1',
    governanceArtifactSha256: 'a'.repeat(64),
    authorities: [
      authority('release-authority-001', 'subject:release', [DECISION_TYPE.RELEASE_APPROVAL], releaseKey),
      authority('merge-authority-001', 'subject:merge', [DECISION_TYPE.MERGE_APPROVAL], mergeKey),
      authority('deployment-authority-001', 'subject:deployment', [DECISION_TYPE.DEPLOYMENT_APPROVAL], deployKey),
    ],
  };
}

function e2fPacket() {
  const releaseCandidate = {
    releaseCandidateId: 'startak-production-rc-001',
    sourceCommitSha: '1'.repeat(40),
    artifactSha256: '2'.repeat(64),
    environmentRef: 'cloudflare-pages:production:startak-real-estate',
    environmentConfigSha256: '3'.repeat(64),
    upstreamEvidencePacketHashSha256: '4'.repeat(64),
  };
  const core = {
    schemaVersion: 1,
    validationPacketId: 'e2f-production-validation-001',
    upstreamEvidencePacketId: 'e2e-implementation-evidence-001',
    upstreamEvidencePacketHashSha256: '4'.repeat(64),
    policyId: 'STARTAK-E2F-SYNTHETIC-FIXTURE',
    releaseCandidate,
    trustedVerifierRegistryId: 'synthetic-e2f-verifier-registry',
    trustedVerifierRegistryHashSha256: '5'.repeat(64),
    validations: [],
    preparedByRef: 'test:fixture',
    preparedAt: '2026-09-11T16:30:00Z',
  };
  return {
    ...core,
    status: 'EXTERNAL_CONFORMANCE_AND_PRODUCTION_VALIDATION_COMPLETE_PENDING_RELEASE_AUTHORITY',
    blockers: [],
    validationPacketHashSha256: sha256(core),
    externalConformanceEvidenceAuthenticityValidated: true,
    productionSecurityValidated: true,
    productionPerformanceValidated: true,
    productionResilienceValidated: true,
    productionValidationComplete: true,
    humanReleaseAuthorityRequired: true,
    formalStandardsConformanceEstablished: false,
    standardsOrRulesActivated: false,
    saudiProfessionalLicensingEstablished: false,
    certifiedValuationAuthorityEstablished: false,
    externalIssuanceAuthorized: false,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    transactionAuthorized: false,
  };
}

function unsignedDecision(upstream, overrides = {}) {
  return {
    decisionId: 'release-decision-001',
    decisionType: DECISION_TYPE.RELEASE_APPROVAL,
    releaseCandidateId: upstream.releaseCandidate.releaseCandidateId,
    validationPacketHashSha256: upstream.validationPacketHashSha256,
    sourceCommitSha: upstream.releaseCandidate.sourceCommitSha,
    artifactSha256: upstream.releaseCandidate.artifactSha256,
    environmentRef: upstream.releaseCandidate.environmentRef,
    environmentConfigSha256: upstream.releaseCandidate.environmentConfigSha256,
    authorityId: 'release-authority-001',
    decisionSourceRef: 'board:release-decision-001',
    decisionArtifactSha256: '6'.repeat(64),
    decidedAt: '2026-09-11T17:00:00Z',
    expiresAt: '2026-09-12T17:00:00Z',
    result: 'APPROVE',
    rationaleRef: 'board:rationale-001',
    signatureAlgorithm: 'RSA-SHA256',
    ...overrides,
  };
}

(function testRegistryReady() {
  const result = prepareReleaseAuthorityRegistryIntake({ registry: registry() });
  assert.strictEqual(result.status, STATUS.READY_FOR_E2G_RELEASE_AUTHORITY_TRUST_ROOT_PINNING);
  assert.strictEqual(result.registryHashSha256, result.outOfBandPinValue);
  assert.strictEqual(result.allRequiredDecisionTypesCovered, true);
  assert.strictEqual(result.mergeDeploymentSubjectSeparationSatisfied, true);
  assert.strictEqual(result.authority.releaseAuthorized, false);
  assert.strictEqual(result.authority.privateSigningKeyAccepted, false);
})();

(function testRegistryCoverageHold() {
  const value = registry();
  value.authorities = value.authorities.filter((item) => item.authorityId !== 'deployment-authority-001');
  const result = prepareReleaseAuthorityRegistryIntake({ registry: value });
  assert.strictEqual(result.status, STATUS.HOLD_RELEASE_AUTHORITY_COVERAGE);
  assert(result.blockers.includes('RELEASE_AUTHORITY_COVERAGE_MISSING:DEPLOYMENT_APPROVAL'));
})();

(function testRegistryActorSeparationHold() {
  const value = registry();
  value.authorities[2].authoritySubjectRef = 'subject:merge';
  const result = prepareReleaseAuthorityRegistryIntake({ registry: value });
  assert.strictEqual(result.status, STATUS.HOLD_RELEASE_AUTHORITY_SEPARATION);
  assert(result.blockers.includes('MERGE_DEPLOYMENT_AUTHORITY_SUBJECT_CONFLICT:subject:merge'));
})();

(function testSecretMaterialRejected() {
  const value = registry();
  value.privateKeyPem = '-----BEGIN PRIVATE KEY-----\nforbidden\n-----END PRIVATE KEY-----';
  const result = prepareReleaseAuthorityRegistryIntake({ registry: value });
  assert.strictEqual(result.status, STATUS.HOLD_INVALID_RELEASE_AUTHORITY_REGISTRY);
  assert(result.blockers[0].startsWith('FORBIDDEN_SECRET_MATERIAL:'));
})();

(function testSigningRequestReadyAndDeterministic() {
  const upstream = e2fPacket();
  const proposed = registry();
  const intake = prepareReleaseAuthorityRegistryIntake({ registry: proposed });
  const input = {
    policy,
    upstreamValidationPacket: upstream,
    releaseAuthorityRegistry: proposed,
    expectedReleaseAuthorityRegistryHashSha256: intake.registryHashSha256,
    decision: unsignedDecision(upstream),
  };
  const first = prepareReleaseDecisionSigningRequest(input);
  const second = prepareReleaseDecisionSigningRequest(input);
  assert.strictEqual(first.status, STATUS.READY_FOR_EXTERNAL_HUMAN_RSA_SHA256_SIGNATURE);
  assert.strictEqual(first.signingPayloadHashSha256, second.signingPayloadHashSha256);
  assert.strictEqual(first.signingPayloadCanonicalUtf8, second.signingPayloadCanonicalUtf8);
  assert.strictEqual(Buffer.from(first.signingPayloadBase64, 'base64').toString('utf8'), first.signingPayloadCanonicalUtf8);
  assert.strictEqual(first.expectedSignatureAlgorithm, 'RSA-SHA256');
  assert.strictEqual(first.signatureStillRequired, true);
  assert.strictEqual(first.authority.humanDecisionAccepted, false);
  assert.strictEqual(first.authority.releaseAuthorized, false);
})();

(function testPinnedHashMismatchHold() {
  const upstream = e2fPacket();
  const result = prepareReleaseDecisionSigningRequest({
    policy,
    upstreamValidationPacket: upstream,
    releaseAuthorityRegistry: registry(),
    expectedReleaseAuthorityRegistryHashSha256: 'f'.repeat(64),
    decision: unsignedDecision(upstream),
  });
  assert.strictEqual(result.status, STATUS.HOLD_E2G_RELEASE_AUTHORITY_ROOT);
  assert(result.blockers.includes('RELEASE_AUTHORITY_REGISTRY_HASH_MISMATCH'));
})();

(function testTamperedE2fHold() {
  const upstream = e2fPacket();
  upstream.releaseCandidate = { ...upstream.releaseCandidate, sourceCommitSha: '9'.repeat(40) };
  const intake = prepareReleaseAuthorityRegistryIntake({ registry: registry() });
  const result = prepareReleaseDecisionSigningRequest({
    policy,
    upstreamValidationPacket: upstream,
    releaseAuthorityRegistry: registry(),
    expectedReleaseAuthorityRegistryHashSha256: intake.registryHashSha256,
    decision: unsignedDecision(upstream),
  });
  assert.strictEqual(result.status, STATUS.HOLD_E2F_VALIDATION_PACKET);
})();

(function testWrongAuthorityTypeHold() {
  const upstream = e2fPacket();
  const proposed = registry();
  const intake = prepareReleaseAuthorityRegistryIntake({ registry: proposed });
  const result = prepareReleaseDecisionSigningRequest({
    policy,
    upstreamValidationPacket: upstream,
    releaseAuthorityRegistry: proposed,
    expectedReleaseAuthorityRegistryHashSha256: intake.registryHashSha256,
    decision: unsignedDecision(upstream, { authorityId: 'merge-authority-001' }),
  });
  assert.strictEqual(result.status, STATUS.HOLD_E2G_DECISION_SIGNING_REQUEST);
  assert(result.blockers.some((item) => item.startsWith('DECISION_AUTHORITY_TYPE_NOT_ALLOWED:')));
})();

(function testCandidateBindingMismatchHold() {
  const upstream = e2fPacket();
  const proposed = registry();
  const intake = prepareReleaseAuthorityRegistryIntake({ registry: proposed });
  const result = prepareReleaseDecisionSigningRequest({
    policy,
    upstreamValidationPacket: upstream,
    releaseAuthorityRegistry: proposed,
    expectedReleaseAuthorityRegistryHashSha256: intake.registryHashSha256,
    decision: unsignedDecision(upstream, { artifactSha256: '8'.repeat(64) }),
  });
  assert.strictEqual(result.status, STATUS.HOLD_E2G_DECISION_SIGNING_REQUEST);
  assert(result.blockers.includes('DECISION_ARTIFACT_HASH_MISMATCH'));
})();

(function testPreSignedDecisionRejected() {
  const upstream = e2fPacket();
  const proposed = registry();
  const intake = prepareReleaseAuthorityRegistryIntake({ registry: proposed });
  const result = prepareReleaseDecisionSigningRequest({
    policy,
    upstreamValidationPacket: upstream,
    releaseAuthorityRegistry: proposed,
    expectedReleaseAuthorityRegistryHashSha256: intake.registryHashSha256,
    decision: unsignedDecision(upstream, { signatureBase64: 'ZmFrZQ==' }),
  });
  assert.strictEqual(result.status, STATUS.HOLD_E2G_DECISION_SIGNING_REQUEST);
  assert(result.blockers.includes('SIGNED_DECISION_NOT_ACCEPTED_BY_SIGNING_REQUEST_INTAKE'));
})();

(function testCliParserAndFileHardening() {
  assert.throws(() => tool.parseArgs(['registry', '--registry', 'a.json', '--registry', 'b.json']), /duplicate argument/);
  assert.throws(() => tool.parseArgs(['registry', '--registry', 'a.json', '--unknown', 'x']), /unknown argument/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'startak-e2g-intake-'));
  const target = path.join(dir, 'target.json');
  const link = path.join(dir, 'link.json');
  fs.writeFileSync(target, '{}');
  fs.symlinkSync(target, link);
  assert.throws(() => tool.readBoundedRegularJson(link), /symlink input is not allowed/);
  fs.rmSync(dir, { recursive: true, force: true });
})();

(function testCliRegistryAndDecisionModes() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'startak-e2g-cli-'));
  const proposed = registry();
  const upstream = e2fPacket();
  const intake = prepareReleaseAuthorityRegistryIntake({ registry: proposed });
  const registryPath = path.join(dir, 'registry.json');
  const policyPath = path.join(dir, 'policy.json');
  const upstreamPath = path.join(dir, 'upstream.json');
  const decisionPath = path.join(dir, 'decision.json');
  const registryOut = path.join(dir, 'registry-out.json');
  const decisionOut = path.join(dir, 'decision-out.json');
  fs.writeFileSync(registryPath, JSON.stringify(proposed));
  fs.writeFileSync(policyPath, JSON.stringify(policy));
  fs.writeFileSync(upstreamPath, JSON.stringify(upstream));
  fs.writeFileSync(decisionPath, JSON.stringify(unsignedDecision(upstream)));

  const script = path.join(__dirname, '../../tools/e2g-release-authority-decision-intake.js');
  const registryRun = spawnSync(process.execPath, [script, 'registry', '--registry', registryPath, '--out', registryOut], { encoding: 'utf8' });
  assert.strictEqual(registryRun.status, 0, registryRun.stderr);
  const registryResult = JSON.parse(fs.readFileSync(registryOut, 'utf8'));
  assert.strictEqual(registryResult.status, STATUS.READY_FOR_E2G_RELEASE_AUTHORITY_TRUST_ROOT_PINNING);
  assert.strictEqual(fs.statSync(registryOut).mode & 0o777, 0o600);

  const decisionRun = spawnSync(process.execPath, [
    script, 'decision', '--policy', policyPath, '--upstream', upstreamPath, '--registry', registryPath,
    '--expected-registry-sha', intake.registryHashSha256, '--decision', decisionPath, '--out', decisionOut,
  ], { encoding: 'utf8' });
  assert.strictEqual(decisionRun.status, 0, decisionRun.stderr);
  const decisionResult = JSON.parse(fs.readFileSync(decisionOut, 'utf8'));
  assert.strictEqual(decisionResult.status, STATUS.READY_FOR_EXTERNAL_HUMAN_RSA_SHA256_SIGNATURE);
  assert.strictEqual(fs.statSync(decisionOut).mode & 0o777, 0o600);
  assert.strictEqual(decisionResult.authority.releaseAuthorized, false);
  fs.rmSync(dir, { recursive: true, force: true });
})();

console.log('E2G_RELEASE_AUTHORITY_DECISION_INTAKE_TESTS=PASS');
