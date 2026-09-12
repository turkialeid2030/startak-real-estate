'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { sha256 } = require('../../src/standards/standards-registry');
const {
  DECISION_TYPE,
  createReleaseDecisionSigningPayload,
  createHumanReleaseAuthorityDecisionPacket,
  normalizeReleaseAuthorityRegistry,
} = require('../../src/standards/human-release-authority-deployment-decision');
const { SEMANTICS } = require('../../src/qualification/production-packet-top-level-contract');
const { stableStringify } = require('../../src/qualification/e2g-release-authority-decision-intake');
const {
  STATUS,
  evaluateMainMergeProductionGovernance,
} = require('../../src/qualification/main-merge-production-governance-gate');
const cli = require('../../tools/main-merge-production-governance-gate');

const policy = JSON.parse(fs.readFileSync(path.join(__dirname, '../../governance/e2g-human-release-authority-deployment-decision-policy-2026-09-08.json'), 'utf8'));
const SOURCE_COMMIT = '1'.repeat(40);

function rsaAuthority(authorityId, subject, allowedDecisionTypes) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).trim();
  return {
    privateKey,
    record: {
      authorityId,
      authoritySubjectRef: subject,
      allowedDecisionTypes,
      publicKeyPem,
      publicKeySha256: sha256(publicKeyPem),
      governanceEvidenceRef: `governance:${authorityId}`,
      activeFrom: '2026-01-01T00:00:00Z',
      activeUntil: '2027-01-01T00:00:00Z',
    },
  };
}

function makeE2fPacket() {
  const releaseCandidate = {
    releaseCandidateId: 'startak-main-integration-rc-001',
    sourceCommitSha: SOURCE_COMMIT,
    artifactSha256: '2'.repeat(64),
    environmentRef: 'cloudflare-pages:production:startak-real-estate',
    environmentConfigSha256: '3'.repeat(64),
    upstreamEvidencePacketHashSha256: '4'.repeat(64),
  };
  const core = {
    schemaVersion: 1,
    validationPacketId: 'e2f-main-integration-001',
    upstreamEvidencePacketId: 'e2e-main-integration-001',
    upstreamEvidencePacketHashSha256: '4'.repeat(64),
    policyId: 'STARTAK-E2F-PRODUCTION-VALIDATION-2026-09-08',
    releaseCandidate,
    trustedVerifierRegistryId: 'trusted-e2f-registry-001',
    trustedVerifierRegistryHashSha256: '5'.repeat(64),
    validations: [
      { validationId: 'v1', validationType: 'EXTERNAL_CONFORMANCE_AUTHENTICITY', result: 'VERIFIED' },
      { validationId: 'v2', validationType: 'PRODUCTION_SECURITY_VALIDATION', result: 'VERIFIED' },
      { validationId: 'v3', validationType: 'PRODUCTION_PERFORMANCE_VALIDATION', result: 'VERIFIED' },
      { validationId: 'v4', validationType: 'PRODUCTION_RESILIENCE_VALIDATION', result: 'VERIFIED' },
    ],
    preparedByRef: 'external-validation:operator',
    preparedAt: '2026-09-12T12:00:00Z',
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
    semantics: SEMANTICS.E2F,
  };
}

function makeFixture() {
  const release = rsaAuthority('release-authority', 'subject:release', [DECISION_TYPE.RELEASE_APPROVAL]);
  const merge = rsaAuthority('merge-authority', 'subject:merge', [DECISION_TYPE.MERGE_APPROVAL]);
  const deploy = rsaAuthority('deployment-authority', 'subject:deployment', [DECISION_TYPE.DEPLOYMENT_APPROVAL]);
  const registry = {
    registryId: 'startak-main-merge-release-authority-registry',
    governanceArtifactSha256: 'a'.repeat(64),
    authorities: [release.record, merge.record, deploy.record],
  };
  const normalizedRegistry = normalizeReleaseAuthorityRegistry(registry);
  const e2f = makeE2fPacket();
  const authorityByType = new Map([
    [DECISION_TYPE.RELEASE_APPROVAL, release],
    [DECISION_TYPE.MERGE_APPROVAL, merge],
    [DECISION_TYPE.DEPLOYMENT_APPROVAL, deploy],
  ]);
  const decisions = Object.values(DECISION_TYPE).map((decisionType, index) => {
    const authority = authorityByType.get(decisionType);
    const unsigned = {
      decisionId: `decision-${index + 1}`,
      decisionType,
      releaseCandidateId: e2f.releaseCandidate.releaseCandidateId,
      validationPacketHashSha256: e2f.validationPacketHashSha256,
      sourceCommitSha: e2f.releaseCandidate.sourceCommitSha,
      artifactSha256: e2f.releaseCandidate.artifactSha256,
      environmentRef: e2f.releaseCandidate.environmentRef,
      environmentConfigSha256: e2f.releaseCandidate.environmentConfigSha256,
      authorityId: authority.record.authorityId,
      decisionSourceRef: `board:${decisionType.toLowerCase()}`,
      decisionArtifactSha256: String(index + 6).repeat(64).slice(0, 64),
      decidedAt: `2026-09-12T12:1${index}:00Z`,
      expiresAt: '2026-09-13T12:00:00Z',
      result: 'APPROVE',
      rationaleRef: `board:rationale:${index + 1}`,
      signatureAlgorithm: 'RSA-SHA256',
    };
    const payload = createReleaseDecisionSigningPayload(unsigned, policy);
    return {
      ...unsigned,
      signatureBase64: crypto.sign('RSA-SHA256', Buffer.from(stableStringify(payload), 'utf8'), authority.privateKey).toString('base64'),
    };
  });
  const e2g = createHumanReleaseAuthorityDecisionPacket({
    decisionPacketId: 'e2g-main-integration-001',
    upstreamValidationPacket: e2f,
    policy,
    releaseAuthorityRegistry: registry,
    expectedReleaseAuthorityRegistryHashSha256: normalizedRegistry.registryHashSha256,
    decisions,
    preparedByRef: 'release-governance:operator',
    preparedAt: '2026-09-12T12:30:00Z',
  });
  assert.strictEqual(e2g.status, 'HUMAN_RELEASE_DECISIONS_COMPLETE_PENDING_EXECUTION');
  return { e2f, e2g, registry, registryHash: normalizedRegistry.registryHashSha256 };
}

function evaluate(fixture, overrides = {}) {
  return evaluateMainMergeProductionGovernance({
    e2fValidationPacket: fixture.e2f,
    expectedE2fValidationPacketHashSha256: fixture.e2f.validationPacketHashSha256,
    expectedE2fVerifierRegistryHashSha256: fixture.e2f.trustedVerifierRegistryHashSha256,
    e2gDecisionPacket: fixture.e2g,
    expectedE2gDecisionPacketHashSha256: fixture.e2g.decisionPacketHashSha256,
    releaseAuthorityRegistry: fixture.registry,
    expectedReleaseAuthorityRegistryHashSha256: fixture.registryHash,
    e2gPolicy: policy,
    expectedReleaseSourceCommitSha: SOURCE_COMMIT,
    ...overrides,
  });
}

(function validGovernancePasses() {
  const result = evaluate(makeFixture());
  assert.strictEqual(result.status, STATUS.MAIN_MERGE_GOVERNANCE_VERIFIED_PENDING_GITHUB_MERGE);
  assert.strictEqual(result.verified, true);
  assert.strictEqual(result.observed.sourceCommitSha, SOURCE_COMMIT);
  assert.strictEqual(result.authority.mergeExecutedByGate, false);
  assert.strictEqual(result.authority.deploymentExecutedByGate, false);
})();

(function e2fPinMismatchFailsClosed() {
  const fixture = makeFixture();
  const result = evaluate(fixture, { expectedE2fValidationPacketHashSha256: 'f'.repeat(64) });
  assert.strictEqual(result.status, STATUS.HOLD_MAIN_MERGE_GOVERNANCE);
  assert(result.blockers.includes('E2F_PACKET_PIN_MISMATCH'));
})();

(function e2fRegistryPinMismatchFailsClosed() {
  const fixture = makeFixture();
  const result = evaluate(fixture, { expectedE2fVerifierRegistryHashSha256: 'e'.repeat(64) });
  assert.strictEqual(result.status, STATUS.HOLD_MAIN_MERGE_GOVERNANCE);
  assert(result.blockers.includes('E2F_VERIFIER_REGISTRY_PIN_MISMATCH'));
})();

(function sourceCommitMismatchFailsClosed() {
  const fixture = makeFixture();
  const result = evaluate(fixture, { expectedReleaseSourceCommitSha: '9'.repeat(40) });
  assert.strictEqual(result.status, STATUS.HOLD_MAIN_MERGE_GOVERNANCE);
  assert(result.blockers.includes('E2F_RELEASE_SOURCE_COMMIT_MISMATCH'));
  assert(result.blockers.includes('E2G_RELEASE_SOURCE_COMMIT_MISMATCH'));
})();

(function tamperedSignatureWithRehashedPacketStillFails() {
  const fixture = makeFixture();
  const tampered = JSON.parse(JSON.stringify(fixture.e2g));
  tampered.decisions[0].signatureBase64 = Buffer.from('tampered-signature').toString('base64');
  const core = {
    schemaVersion: tampered.schemaVersion,
    decisionPacketId: tampered.decisionPacketId,
    upstreamValidationPacketId: tampered.upstreamValidationPacketId,
    upstreamValidationPacketHashSha256: tampered.upstreamValidationPacketHashSha256,
    policyId: tampered.policyId,
    releaseCandidate: tampered.releaseCandidate,
    releaseAuthorityRegistryId: tampered.releaseAuthorityRegistryId,
    releaseAuthorityRegistryHashSha256: tampered.releaseAuthorityRegistryHashSha256,
    decisions: tampered.decisions,
    preparedByRef: tampered.preparedByRef,
    preparedAt: tampered.preparedAt,
  };
  tampered.decisionPacketHashSha256 = sha256(core);
  const result = evaluate(fixture, {
    e2gDecisionPacket: tampered,
    expectedE2gDecisionPacketHashSha256: tampered.decisionPacketHashSha256,
  });
  assert.strictEqual(result.status, STATUS.HOLD_MAIN_MERGE_GOVERNANCE);
  assert(result.blockers.includes('E2G_HUMAN_RELEASE_DECISIONS_NOT_COMPLETE'));
})();

(function authorityRegistryPinMismatchFails() {
  const fixture = makeFixture();
  const result = evaluate(fixture, { expectedReleaseAuthorityRegistryHashSha256: 'd'.repeat(64) });
  assert.strictEqual(result.status, STATUS.HOLD_MAIN_MERGE_GOVERNANCE);
  assert(result.blockers.includes('E2G_RELEASE_AUTHORITY_REGISTRY_PIN_MISMATCH'));
})();

(function cliEnvironmentPassesAndMissingInputFails() {
  const fixture = makeFixture();
  const env = {
    STARTAK_E2F_PACKET_B64: Buffer.from(JSON.stringify(fixture.e2f)).toString('base64'),
    STARTAK_E2F_PACKET_PIN_SHA256: fixture.e2f.validationPacketHashSha256,
    STARTAK_E2F_VERIFIER_REGISTRY_PIN_SHA256: fixture.e2f.trustedVerifierRegistryHashSha256,
    STARTAK_E2G_PACKET_B64: Buffer.from(JSON.stringify(fixture.e2g)).toString('base64'),
    STARTAK_E2G_PACKET_PIN_SHA256: fixture.e2g.decisionPacketHashSha256,
    STARTAK_E2G_RELEASE_AUTHORITY_REGISTRY_B64: Buffer.from(JSON.stringify(fixture.registry)).toString('base64'),
    STARTAK_E2G_RELEASE_AUTHORITY_REGISTRY_PIN_SHA256: fixture.registryHash,
    STARTAK_EXPECTED_RELEASE_SOURCE_COMMIT_SHA: SOURCE_COMMIT,
  };
  const result = cli.evaluateFromEnvironment(env);
  assert.strictEqual(result.verified, true);
  assert.throws(() => cli.evaluateFromEnvironment({}), /STARTAK_E2F_PACKET_B64 is required/);

  const script = path.join(__dirname, '../../tools/main-merge-production-governance-gate.js');
  const run = spawnSync(process.execPath, [script], { env: { ...process.env, ...env }, encoding: 'utf8' });
  assert.strictEqual(run.status, 0, run.stderr);
  assert(run.stdout.includes('MAIN_MERGE_GOVERNANCE_VERIFIED=true'));
})();

console.log('MAIN_MERGE_PRODUCTION_GOVERNANCE_GATE_TESTS=PASS');
