'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { sha256 } = require('../../src/standards/standards-registry');
const { EVIDENCE_TYPE } = require('../../src/standards/production-evidence-go-live-readiness');
const {
  STATUS,
  prepareReadinessVerifierRegistryOperationalIntake,
  prepareReadinessEvidenceSigningRequest,
} = require('../../src/qualification/e2i-readiness-evidence-intake');
const tool = require('../../tools/e2i-readiness-evidence-intake');

const policy = JSON.parse(fs.readFileSync(path.join(__dirname, '../../governance/e2i-production-evidence-go-live-readiness-policy-2026-09-08.json'), 'utf8'));

function rsaKey() {
  const { publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).trim();
  return { publicKeyPem, publicKeySha256: sha256(publicKeyPem) };
}

function ecKey() {
  const { publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).trim();
  return { publicKeyPem, publicKeySha256: sha256(publicKeyPem) };
}

const complianceKey = rsaKey();
const productionKey = rsaKey();

function verifier(verifierId, subject, types, key) {
  return {
    verifierId,
    verifierSubjectRef: subject,
    allowedEvidenceTypes: types,
    publicKeyPem: key.publicKeyPem,
    publicKeySha256: key.publicKeySha256,
    governanceEvidenceRef: `governance:${verifierId}`,
    activeFrom: '2026-01-01T00:00:00Z',
    activeUntil: '2027-01-01T00:00:00Z',
  };
}

function registry() {
  return {
    registryId: 'startak-e2i-readiness-verifier-registry-v1',
    governanceArtifactSha256: 'a'.repeat(64),
    verifiers: [
      verifier(
        'compliance-verifier-001',
        'subject:independent-compliance',
        [
          EVIDENCE_TYPE.SAUDI_LEGAL_OPERATING_MODE_REVIEW,
          EVIDENCE_TYPE.PDPL_DATA_GOVERNANCE_REVIEW,
          EVIDENCE_TYPE.PROFESSIONAL_STANDARDS_SCOPE_REVIEW,
          EVIDENCE_TYPE.OPERATING_MODE_CLAIMS_RESTRICTION_CONFIRMATION,
        ],
        complianceKey,
      ),
      verifier(
        'production-verifier-001',
        'subject:independent-production-assurance',
        [
          EVIDENCE_TYPE.CANONICAL_SOURCE_HASH_COMPARISON,
          EVIDENCE_TYPE.PRODUCTION_EXECUTION_CHAIN_CONFIRMATION,
        ],
        productionKey,
      ),
    ],
  };
}

function e2hPacket() {
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
    closeoutPacketId: 'e2h-production-closeout-001',
    upstreamDecisionPacketId: 'e2g-human-release-decisions-001',
    upstreamDecisionPacketHashSha256: '5'.repeat(64),
    policyId: 'STARTAK-E2H-SYNTHETIC-FIXTURE',
    releaseCandidate,
    executionAttestorRegistryId: 'synthetic-e2h-attestor-registry',
    executionAttestorRegistryHashSha256: '6'.repeat(64),
    attestations: [],
    preparedByRef: 'test:fixture',
    preparedAt: '2026-09-11T18:00:00Z',
  };
  return {
    ...core,
    status: 'EXECUTION_AND_POST_DEPLOYMENT_CLOSEOUT_COMPLETE',
    blockers: [],
    closeoutPacketHashSha256: sha256(core),
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
}

function unsignedEvidence(upstream, overrides = {}) {
  return {
    evidenceId: 'e2i-legal-readiness-evidence-001',
    evidenceType: EVIDENCE_TYPE.SAUDI_LEGAL_OPERATING_MODE_REVIEW,
    upstreamCloseoutPacketHashSha256: upstream.closeoutPacketHashSha256,
    releaseCandidateId: upstream.releaseCandidate.releaseCandidateId,
    sourceCommitSha: upstream.releaseCandidate.sourceCommitSha,
    artifactSha256: upstream.releaseCandidate.artifactSha256,
    environmentRef: upstream.releaseCandidate.environmentRef,
    environmentConfigSha256: upstream.releaseCandidate.environmentConfigSha256,
    verifierId: 'compliance-verifier-001',
    sourceRef: 'external:legal-review:001',
    evidenceArtifactSha256: '7'.repeat(64),
    verifiedAt: '2026-09-11T18:30:00Z',
    expiresAt: '2026-10-11T18:30:00Z',
    result: 'VERIFIED',
    scopeRef: 'scope:startak-production-rc-001:legal-operating-mode',
    signatureAlgorithm: 'RSA-SHA256',
    ...overrides,
  };
}

(function testRegistryReady() {
  const result = prepareReadinessVerifierRegistryOperationalIntake({ registry: registry() });
  assert.strictEqual(result.status, STATUS.READY_FOR_E2I_READINESS_VERIFIER_TRUST_ROOT_PINNING);
  assert.strictEqual(result.registryHashSha256, result.outOfBandPinValue);
  assert.strictEqual(result.allRequiredEvidenceTypesCovered, true);
  assert.strictEqual(result.minimumDistinctVerifierSubjectsSatisfied, true);
  assert.strictEqual(result.rsaSha256VerifierKeysSatisfied, true);
  assert.strictEqual(result.authority.goLiveReady, false);
  assert.strictEqual(result.authority.privateSigningKeyAccepted, false);
})();

(function testNonRsaRegistryHold() {
  const value = registry();
  const bad = ecKey();
  value.verifiers[0].publicKeyPem = bad.publicKeyPem;
  value.verifiers[0].publicKeySha256 = bad.publicKeySha256;
  const result = prepareReadinessVerifierRegistryOperationalIntake({ registry: value });
  assert.strictEqual(result.status, STATUS.HOLD_READINESS_VERIFIER_RSA_REQUIREMENTS);
  assert(result.blockers.some((item) => item.startsWith('READINESS_VERIFIER_PUBLIC_KEY_MUST_BE_RSA:')));
})();

(function testSecretMaterialRejected() {
  const value = registry();
  value.privateKeyPem = '-----BEGIN PRIVATE KEY-----\nforbidden\n-----END PRIVATE KEY-----';
  const result = prepareReadinessVerifierRegistryOperationalIntake({ registry: value });
  assert.strictEqual(result.status, STATUS.HOLD_INVALID_READINESS_VERIFIER_REGISTRY);
  assert(result.blockers[0].startsWith('FORBIDDEN_SECRET_MATERIAL:'));
})();

(function testSigningRequestReadyAndDeterministic() {
  const upstream = e2hPacket();
  const proposed = registry();
  const intake = prepareReadinessVerifierRegistryOperationalIntake({ registry: proposed });
  const input = {
    policy,
    upstreamCloseoutPacket: upstream,
    readinessVerifierRegistry: proposed,
    expectedReadinessVerifierRegistryHashSha256: intake.registryHashSha256,
    evidence: unsignedEvidence(upstream),
  };
  const first = prepareReadinessEvidenceSigningRequest(input);
  const second = prepareReadinessEvidenceSigningRequest(input);
  assert.strictEqual(first.status, STATUS.READY_FOR_EXTERNAL_READINESS_RSA_SHA256_SIGNATURE);
  assert.strictEqual(first.signingPayloadHashSha256, second.signingPayloadHashSha256);
  assert.strictEqual(first.signingPayloadCanonicalUtf8, second.signingPayloadCanonicalUtf8);
  assert.strictEqual(Buffer.from(first.signingPayloadBase64, 'base64').toString('utf8'), first.signingPayloadCanonicalUtf8);
  assert.strictEqual(first.expectedSignatureAlgorithm, 'RSA-SHA256');
  assert.strictEqual(first.signatureStillRequired, true);
  assert.strictEqual(first.architecturalStopStillEnforced, true);
  assert.strictEqual(first.authority.readinessEvidenceAccepted, false);
  assert.strictEqual(first.authority.goLiveReady, false);
})();

(function testPinnedHashMismatchHold() {
  const upstream = e2hPacket();
  const result = prepareReadinessEvidenceSigningRequest({
    policy,
    upstreamCloseoutPacket: upstream,
    readinessVerifierRegistry: registry(),
    expectedReadinessVerifierRegistryHashSha256: 'f'.repeat(64),
    evidence: unsignedEvidence(upstream),
  });
  assert.strictEqual(result.status, STATUS.HOLD_E2I_READINESS_VERIFIER_ROOT);
  assert(result.blockers.includes('READINESS_VERIFIER_REGISTRY_HASH_MISMATCH'));
})();

(function testTamperedE2hHold() {
  const upstream = e2hPacket();
  upstream.releaseCandidate = { ...upstream.releaseCandidate, artifactSha256: '9'.repeat(64) };
  const proposed = registry();
  const intake = prepareReadinessVerifierRegistryOperationalIntake({ registry: proposed });
  const result = prepareReadinessEvidenceSigningRequest({
    policy,
    upstreamCloseoutPacket: upstream,
    readinessVerifierRegistry: proposed,
    expectedReadinessVerifierRegistryHashSha256: intake.registryHashSha256,
    evidence: unsignedEvidence(upstream),
  });
  assert.strictEqual(result.status, STATUS.HOLD_E2H_CLOSEOUT_PACKET);
})();

(function testWrongVerifierTypeHold() {
  const upstream = e2hPacket();
  const proposed = registry();
  const intake = prepareReadinessVerifierRegistryOperationalIntake({ registry: proposed });
  const result = prepareReadinessEvidenceSigningRequest({
    policy,
    upstreamCloseoutPacket: upstream,
    readinessVerifierRegistry: proposed,
    expectedReadinessVerifierRegistryHashSha256: intake.registryHashSha256,
    evidence: unsignedEvidence(upstream, { verifierId: 'production-verifier-001' }),
  });
  assert.strictEqual(result.status, STATUS.HOLD_E2I_READINESS_EVIDENCE_SIGNING_REQUEST);
  assert(result.blockers.some((item) => item.startsWith('READINESS_VERIFIER_TYPE_NOT_ALLOWED:')));
})();

(function testBindingMismatchHold() {
  const upstream = e2hPacket();
  const proposed = registry();
  const intake = prepareReadinessVerifierRegistryOperationalIntake({ registry: proposed });
  const result = prepareReadinessEvidenceSigningRequest({
    policy,
    upstreamCloseoutPacket: upstream,
    readinessVerifierRegistry: proposed,
    expectedReadinessVerifierRegistryHashSha256: intake.registryHashSha256,
    evidence: unsignedEvidence(upstream, { environmentConfigSha256: '8'.repeat(64) }),
  });
  assert.strictEqual(result.status, STATUS.HOLD_E2I_READINESS_EVIDENCE_SIGNING_REQUEST);
  assert(result.blockers.includes('READINESS_ENV_CONFIG_HASH_MISMATCH'));
})();

(function testEvidenceBeforeCloseoutHold() {
  const upstream = e2hPacket();
  const proposed = registry();
  const intake = prepareReadinessVerifierRegistryOperationalIntake({ registry: proposed });
  const result = prepareReadinessEvidenceSigningRequest({
    policy,
    upstreamCloseoutPacket: upstream,
    readinessVerifierRegistry: proposed,
    expectedReadinessVerifierRegistryHashSha256: intake.registryHashSha256,
    evidence: unsignedEvidence(upstream, { verifiedAt: '2026-09-11T17:59:59Z' }),
  });
  assert.strictEqual(result.status, STATUS.HOLD_E2I_READINESS_EVIDENCE_SIGNING_REQUEST);
  assert(result.blockers.includes('READINESS_EVIDENCE_BEFORE_E2H_CLOSEOUT'));
})();

(function testPreSignedEvidenceRejected() {
  const upstream = e2hPacket();
  const proposed = registry();
  const intake = prepareReadinessVerifierRegistryOperationalIntake({ registry: proposed });
  const result = prepareReadinessEvidenceSigningRequest({
    policy,
    upstreamCloseoutPacket: upstream,
    readinessVerifierRegistry: proposed,
    expectedReadinessVerifierRegistryHashSha256: intake.registryHashSha256,
    evidence: unsignedEvidence(upstream, { signatureBase64: 'ZmFrZQ==' }),
  });
  assert.strictEqual(result.status, STATUS.HOLD_E2I_READINESS_EVIDENCE_SIGNING_REQUEST);
  assert(result.blockers.includes('SIGNED_READINESS_EVIDENCE_NOT_ACCEPTED_BY_SIGNING_REQUEST_INTAKE'));
})();

(function testCliParserAndModes() {
  assert.throws(() => tool.parseArgs(['registry', '--registry', 'a.json', '--registry', 'b.json']), /duplicate argument/);
  assert.throws(() => tool.parseArgs(['evidence', '--registry', 'a.json', '--unknown', 'x']), /unknown argument/);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'startak-e2i-intake-'));
  const proposed = registry();
  const upstream = e2hPacket();
  const intake = prepareReadinessVerifierRegistryOperationalIntake({ registry: proposed });
  const paths = {
    registry: path.join(dir, 'registry.json'),
    policy: path.join(dir, 'policy.json'),
    upstream: path.join(dir, 'upstream.json'),
    evidence: path.join(dir, 'evidence.json'),
    registryOut: path.join(dir, 'registry-out.json'),
    evidenceOut: path.join(dir, 'evidence-out.json'),
  };
  fs.writeFileSync(paths.registry, JSON.stringify(proposed));
  fs.writeFileSync(paths.policy, JSON.stringify(policy));
  fs.writeFileSync(paths.upstream, JSON.stringify(upstream));
  fs.writeFileSync(paths.evidence, JSON.stringify(unsignedEvidence(upstream)));

  const script = path.join(__dirname, '../../tools/e2i-readiness-evidence-intake.js');
  const r1 = spawnSync(process.execPath, [script, 'registry', '--registry', paths.registry, '--out', paths.registryOut], { encoding: 'utf8' });
  assert.strictEqual(r1.status, 0, r1.stderr);
  assert.strictEqual(JSON.parse(fs.readFileSync(paths.registryOut, 'utf8')).status, STATUS.READY_FOR_E2I_READINESS_VERIFIER_TRUST_ROOT_PINNING);

  const r2 = spawnSync(process.execPath, [
    script, 'evidence', '--policy', paths.policy, '--upstream', paths.upstream, '--registry', paths.registry,
    '--expected-registry-sha', intake.registryHashSha256, '--evidence', paths.evidence, '--out', paths.evidenceOut,
  ], { encoding: 'utf8' });
  assert.strictEqual(r2.status, 0, r2.stderr);
  const output = JSON.parse(fs.readFileSync(paths.evidenceOut, 'utf8'));
  assert.strictEqual(output.status, STATUS.READY_FOR_EXTERNAL_READINESS_RSA_SHA256_SIGNATURE);
  assert.strictEqual(fs.statSync(paths.evidenceOut).mode & 0o777, 0o600);

  const link = path.join(dir, 'link.json');
  fs.symlinkSync(paths.registry, link);
  assert.throws(() => tool.readBoundedRegularJson(link), /symlink input is not allowed/);
  fs.rmSync(dir, { recursive: true, force: true });
})();

console.log('E2I_READINESS_EVIDENCE_INTAKE_TESTS=PASS');
