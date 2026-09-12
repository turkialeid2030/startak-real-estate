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
const {
  VALIDATION_TYPE,
  VALIDATION_RESULT,
  createValidationSigningPayload,
  createExternalConformanceProductionValidationPacket,
} = require('../../src/standards/external-conformance-production-validation');
const {
  normalizeTrustedVerifierRegistry,
} = require('../../src/standards/external-authority-validation');
const {
  E2E_STATUS,
} = require('../../src/standards/rule-implementation-conformance-evidence');
const { SEMANTICS } = require('../../src/qualification/production-packet-top-level-contract');
const { stableStringify } = require('../../src/qualification/e2g-release-authority-decision-intake');
const {
  STATUS,
  evaluateMainMergeProductionGovernance,
} = require('../../src/qualification/main-merge-production-governance-gate');
const cli = require('../../tools/main-merge-production-governance-gate');

const e2fPolicy = JSON.parse(fs.readFileSync(path.join(__dirname, '../../governance/e2f-external-conformance-production-validation-policy-2026-09-08.json'), 'utf8'));
const e2gPolicy = JSON.parse(fs.readFileSync(path.join(__dirname, '../../governance/e2g-human-release-authority-deployment-decision-policy-2026-09-08.json'), 'utf8'));
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

function rsaVerifier(verifierId, subject) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).trim();
  return {
    privateKey,
    record: {
      verifierId,
      verifierSubjectRef: subject,
      authorityClass: 'EXTERNAL_PRODUCTION_VALIDATOR',
      publicKeyPem,
      publicKeySha256: sha256(publicKeyPem),
      governanceEvidenceRef: `governance:${verifierId}`,
      activeFrom: '2026-01-01T00:00:00Z',
      activeUntil: '2027-01-01T00:00:00Z',
    },
  };
}

function makeE2ePacket() {
  const core = {
    schemaVersion: 1,
    evidencePacketId: 'e2e-main-integration-001',
    upstreamProposalId: 'e2d-main-integration-001',
    upstreamProposalHashSha256: 'a'.repeat(64),
    policyId: 'STARTAK-E2E-TEST-POLICY',
    implementationEvidence: [
      { implementationId: 'implementation-1', implementedByRef: 'subject:implementation' },
    ],
    conformanceEvidence: [
      { conformanceId: 'conformance-1', verifiedByRef: 'subject:conformance' },
    ],
    missingImplementationEvidence: [],
    missingConformanceEvidence: [],
    preparedByRef: 'engineering:e2e-evidence-operator',
    preparedAt: '2026-09-12T11:30:00Z',
  };
  return {
    ...core,
    status: E2E_STATUS.RULE_IMPLEMENTATION_EVIDENCE_READY_FOR_EXTERNAL_CONFORMANCE_VALIDATION,
    blockers: [],
    evidencePacketHashSha256: sha256(core),
    implementationEvidenceComplete: true,
    conformanceEvidenceComplete: true,
    independentConformanceEvidenceRecorded: true,
    externalConformanceValidationRequired: true,
    formalStandardsConformanceEstablished: false,
    standardsOrRulesActivated: false,
    legalConclusionEstablished: false,
    professionalApplicabilityEstablished: false,
    saudiProfessionalLicensingEstablished: false,
    certifiedValuationAuthorityEstablished: false,
    externalIssuanceAuthorized: false,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    transactionAuthorized: false,
  };
}

function e2fCore(packet) {
  return {
    schemaVersion: packet.schemaVersion,
    validationPacketId: packet.validationPacketId,
    upstreamEvidencePacketId: packet.upstreamEvidencePacketId,
    upstreamEvidencePacketHashSha256: packet.upstreamEvidencePacketHashSha256,
    policyId: packet.policyId,
    releaseCandidate: packet.releaseCandidate,
    trustedVerifierRegistryId: packet.trustedVerifierRegistryId,
    trustedVerifierRegistryHashSha256: packet.trustedVerifierRegistryHashSha256,
    validations: packet.validations,
    preparedByRef: packet.preparedByRef,
    preparedAt: packet.preparedAt,
  };
}

function makeE2fFixture(e2e) {
  const verifier = rsaVerifier('external-e2f-verifier', 'subject:external-e2f-verifier');
  const registry = {
    schemaVersion: 1,
    registryId: 'trusted-e2f-registry-001',
    status: 'EXTERNALLY_GOVERNED',
    governanceOwnerRef: 'governance:e2f-external-validation',
    verifiers: [verifier.record],
  };
  const normalizedRegistry = normalizeTrustedVerifierRegistry(registry);
  const releaseCandidate = {
    releaseCandidateId: 'startak-main-integration-rc-001',
    sourceCommitSha: SOURCE_COMMIT,
    artifactSha256: '2'.repeat(64),
    environmentRef: 'cloudflare-pages:production:startak-real-estate',
    environmentConfigSha256: '3'.repeat(64),
    upstreamEvidencePacketHashSha256: e2e.evidencePacketHashSha256,
  };
  const validationTypes = [
    VALIDATION_TYPE.EXTERNAL_CONFORMANCE_AUTHENTICITY,
    VALIDATION_TYPE.PRODUCTION_SECURITY_VALIDATION,
    VALIDATION_TYPE.PRODUCTION_PERFORMANCE_VALIDATION,
    VALIDATION_TYPE.PRODUCTION_RESILIENCE_VALIDATION,
  ];
  const validations = validationTypes.map((validationType, index) => {
    const isExternal = validationType === VALIDATION_TYPE.EXTERNAL_CONFORMANCE_AUTHENTICITY;
    const unsigned = {
      validationId: `e2f-validation-${index + 1}`,
      validationType,
      targetRef: isExternal ? e2e.evidencePacketId : releaseCandidate.releaseCandidateId,
      subjectArtifactSha256: isExternal ? e2e.evidencePacketHashSha256 : releaseCandidate.artifactSha256,
      environmentRef: isExternal ? null : releaseCandidate.environmentRef,
      environmentConfigSha256: isExternal ? null : releaseCandidate.environmentConfigSha256,
      releaseCandidateCommitSha: isExternal ? null : releaseCandidate.sourceCommitSha,
      verifierId: verifier.record.verifierId,
      verificationSourceRef: `external-validation:${validationType.toLowerCase()}`,
      verificationArtifactSha256: String(index + 6).repeat(64).slice(0, 64),
      verifiedAt: `2026-09-12T11:4${index}:00Z`,
      expiresAt: '2026-09-13T12:00:00Z',
      result: VALIDATION_RESULT.VERIFIED,
      signatureAlgorithm: 'RSA-SHA256',
    };
    const payload = createValidationSigningPayload(unsigned, e2fPolicy);
    return {
      ...unsigned,
      signatureBase64: crypto.sign('RSA-SHA256', Buffer.from(stableStringify(payload), 'utf8'), verifier.privateKey).toString('base64'),
    };
  });
  const e2f = createExternalConformanceProductionValidationPacket({
    validationPacketId: 'e2f-main-integration-001',
    upstreamEvidencePacket: e2e,
    policy: e2fPolicy,
    releaseCandidate,
    trustedVerifierRegistry: registry,
    expectedTrustedRegistryHashSha256: normalizedRegistry.registryHashSha256,
    validations,
    preparedByRef: 'external-validation:operator',
    preparedAt: '2026-09-12T12:00:00Z',
  });
  assert.strictEqual(e2f.status, 'EXTERNAL_CONFORMANCE_AND_PRODUCTION_VALIDATION_COMPLETE_PENDING_RELEASE_AUTHORITY');
  assert.strictEqual(e2f.productionValidationComplete, true);
  return { e2f, registry, registryHash: normalizedRegistry.registryHashSha256 };
}

function makeReleaseAuthorityFixture() {
  const release = rsaAuthority('release-authority', 'subject:release', [DECISION_TYPE.RELEASE_APPROVAL]);
  const merge = rsaAuthority('merge-authority', 'subject:merge', [DECISION_TYPE.MERGE_APPROVAL]);
  const deploy = rsaAuthority('deployment-authority', 'subject:deployment', [DECISION_TYPE.DEPLOYMENT_APPROVAL]);
  const registry = {
    registryId: 'startak-main-merge-release-authority-registry',
    governanceArtifactSha256: 'b'.repeat(64),
    authorities: [release.record, merge.record, deploy.record],
  };
  const normalizedRegistry = normalizeReleaseAuthorityRegistry(registry);
  return {
    release,
    merge,
    deploy,
    registry,
    registryHash: normalizedRegistry.registryHashSha256,
  };
}

function buildE2g(e2f, authorityFixture) {
  const authorityByType = new Map([
    [DECISION_TYPE.RELEASE_APPROVAL, authorityFixture.release],
    [DECISION_TYPE.MERGE_APPROVAL, authorityFixture.merge],
    [DECISION_TYPE.DEPLOYMENT_APPROVAL, authorityFixture.deploy],
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
      decisionArtifactSha256: String(index + 9).repeat(64).slice(0, 64),
      decidedAt: `2026-09-12T12:1${index}:00Z`,
      expiresAt: '2026-09-13T12:00:00Z',
      result: 'APPROVE',
      rationaleRef: `board:rationale:${index + 1}`,
      signatureAlgorithm: 'RSA-SHA256',
    };
    const payload = createReleaseDecisionSigningPayload(unsigned, e2gPolicy);
    return {
      ...unsigned,
      signatureBase64: crypto.sign('RSA-SHA256', Buffer.from(stableStringify(payload), 'utf8'), authority.privateKey).toString('base64'),
    };
  });
  const e2g = createHumanReleaseAuthorityDecisionPacket({
    decisionPacketId: 'e2g-main-integration-001',
    upstreamValidationPacket: e2f,
    policy: e2gPolicy,
    releaseAuthorityRegistry: authorityFixture.registry,
    expectedReleaseAuthorityRegistryHashSha256: authorityFixture.registryHash,
    decisions,
    preparedByRef: 'release-governance:operator',
    preparedAt: '2026-09-12T12:30:00Z',
  });
  assert.strictEqual(e2g.status, 'HUMAN_RELEASE_DECISIONS_COMPLETE_PENDING_EXECUTION');
  return e2g;
}

function makeFixture() {
  const e2e = makeE2ePacket();
  const e2fFixture = makeE2fFixture(e2e);
  const authorityFixture = makeReleaseAuthorityFixture();
  const e2g = buildE2g(e2fFixture.e2f, authorityFixture);
  return {
    e2e,
    e2f: e2fFixture.e2f,
    e2fRegistry: e2fFixture.registry,
    e2fRegistryHash: e2fFixture.registryHash,
    e2g,
    authorityFixture,
    registry: authorityFixture.registry,
    registryHash: authorityFixture.registryHash,
  };
}

function evaluate(fixture, overrides = {}) {
  return evaluateMainMergeProductionGovernance({
    e2eEvidencePacket: fixture.e2e,
    expectedE2eEvidencePacketHashSha256: fixture.e2e.evidencePacketHashSha256,
    e2fValidationPacket: fixture.e2f,
    expectedE2fValidationPacketHashSha256: fixture.e2f.validationPacketHashSha256,
    trustedE2fVerifierRegistry: fixture.e2fRegistry,
    expectedE2fVerifierRegistryHashSha256: fixture.e2fRegistryHash,
    e2fPolicy,
    e2gDecisionPacket: fixture.e2g,
    expectedE2gDecisionPacketHashSha256: fixture.e2g.decisionPacketHashSha256,
    releaseAuthorityRegistry: fixture.registry,
    expectedReleaseAuthorityRegistryHashSha256: fixture.registryHash,
    e2gPolicy,
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

(function e2ePinMismatchFailsClosed() {
  const fixture = makeFixture();
  const result = evaluate(fixture, { expectedE2eEvidencePacketHashSha256: 'f'.repeat(64) });
  assert.strictEqual(result.status, STATUS.HOLD_MAIN_MERGE_GOVERNANCE);
  assert(result.blockers.includes('E2E_PACKET_PIN_MISMATCH'));
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

(function tamperedE2fSignatureWithRehashedPacketStillFails() {
  const fixture = makeFixture();
  const tampered = JSON.parse(JSON.stringify(fixture.e2f));
  tampered.validations[0].signatureBase64 = Buffer.from('tampered-e2f-signature').toString('base64');
  tampered.validationPacketHashSha256 = sha256(e2fCore(tampered));
  const e2gForTampered = buildE2g(tampered, fixture.authorityFixture);
  const result = evaluate(fixture, {
    e2fValidationPacket: tampered,
    expectedE2fValidationPacketHashSha256: tampered.validationPacketHashSha256,
    e2gDecisionPacket: e2gForTampered,
    expectedE2gDecisionPacketHashSha256: e2gForTampered.decisionPacketHashSha256,
  });
  assert.strictEqual(result.status, STATUS.HOLD_MAIN_MERGE_GOVERNANCE);
  assert(result.blockers.includes('E2F_CRYPTOGRAPHIC_VALIDATION_NOT_COMPLETE'));
})();

(function tamperedE2gSignatureWithRehashedPacketStillFails() {
  const fixture = makeFixture();
  const tampered = JSON.parse(JSON.stringify(fixture.e2g));
  tampered.decisions[0].signatureBase64 = Buffer.from('tampered-e2g-signature').toString('base64');
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
    STARTAK_E2E_PACKET_B64: Buffer.from(JSON.stringify(fixture.e2e)).toString('base64'),
    STARTAK_E2E_PACKET_PIN_SHA256: fixture.e2e.evidencePacketHashSha256,
    STARTAK_E2F_PACKET_B64: Buffer.from(JSON.stringify(fixture.e2f)).toString('base64'),
    STARTAK_E2F_PACKET_PIN_SHA256: fixture.e2f.validationPacketHashSha256,
    STARTAK_E2F_VERIFIER_REGISTRY_B64: Buffer.from(JSON.stringify(fixture.e2fRegistry)).toString('base64'),
    STARTAK_E2F_VERIFIER_REGISTRY_PIN_SHA256: fixture.e2fRegistryHash,
    STARTAK_E2G_PACKET_B64: Buffer.from(JSON.stringify(fixture.e2g)).toString('base64'),
    STARTAK_E2G_PACKET_PIN_SHA256: fixture.e2g.decisionPacketHashSha256,
    STARTAK_E2G_RELEASE_AUTHORITY_REGISTRY_B64: Buffer.from(JSON.stringify(fixture.registry)).toString('base64'),
    STARTAK_E2G_RELEASE_AUTHORITY_REGISTRY_PIN_SHA256: fixture.registryHash,
    STARTAK_EXPECTED_RELEASE_SOURCE_COMMIT_SHA: SOURCE_COMMIT,
  };
  const result = cli.evaluateFromEnvironment(env);
  assert.strictEqual(result.verified, true);
  assert.throws(() => cli.evaluateFromEnvironment({}), /STARTAK_E2E_PACKET_B64 is required/);

  const script = path.join(__dirname, '../../tools/main-merge-production-governance-gate.js');
  const run = spawnSync(process.execPath, [script], { env: { ...process.env, ...env }, encoding: 'utf8' });
  assert.strictEqual(run.status, 0, run.stderr);
  assert(run.stdout.includes('MAIN_MERGE_GOVERNANCE_VERIFIED=true'));
})();

console.log('MAIN_MERGE_PRODUCTION_GOVERNANCE_GATE_TESTS=PASS');
