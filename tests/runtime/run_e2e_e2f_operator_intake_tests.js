'use strict';

const assert = require('assert');
const crypto = require('crypto');

const e2ePolicy = require('../../governance/e2e-rule-implementation-conformance-evidence-policy-2026-09-08.json');
const e2fPolicy = require('../../governance/e2f-external-conformance-production-validation-policy-2026-09-08.json');
const { sha256 } = require('../../src/standards/standards-registry');
const {
  E2D_STATUS,
  verifySubstantiveReviewActivationProposalIntegrity,
} = require('../../src/standards/substantive-review-activation-proposal');
const {
  E2E_STATUS,
  verifyRuleImplementationConformanceEvidencePacketIntegrity,
} = require('../../src/standards/rule-implementation-conformance-evidence');
const {
  E2F_STATUS,
  verifyValidationSignature,
  verifyExternalConformanceProductionValidationPacketIntegrity,
} = require('../../src/standards/external-conformance-production-validation');
const { normalizeTrustedVerifierRegistry } = require('../../src/standards/external-authority-validation');
const e2eIntake = require('../../tools/e2e-rule-implementation-conformance-intake');
const e2fIntake = require('../../tools/e2f-validation-intake');

let checks = 0;
function check(fn) { fn(); checks += 1; }
const h = (char) => char.repeat(64);

const FROZEN_SOURCE_SHA = 'e876208c19ffbddd0dacd2bf8fce24aba1e52b55';
const FROZEN_ARTIFACT_SHA = 'c3ddcd7b4a66fd58c271fb08b9e5a3efb5e4237f0015d3771e7ab9818412017f';
const FROZEN_ENV_REF = 'cloudflare-pages:startak-real-estate:production';
const FROZEN_ENV_SHA = '819183fb9f4fb09017c636d2d1d841dd086ac4ba4bbccd103dffbc4c5980bc73';

const activationProposal = Object.freeze({
  candidateId: 'E2-OPERATOR-INTAKE-TEST-001',
  domain: 'TEST_ONLY_OPERATOR_INTAKE',
  reviewClass: 'PROFESSIONAL_REVIEW',
  validatedHumanDisposition: 'APPLICABLE',
  reviewerRef: 'human:e2d-reviewer-test',
  humanReviewEvidenceRef: 'test-only-review-evidence',
  sourceEvidenceRefs: Object.freeze([]),
  proposedAction: 'PROPOSE_RULE_IMPLEMENTATION',
  ruleSetId: 'RULESET-OPERATOR-INTAKE-TEST',
  proposedRuleRefs: Object.freeze(['RULE-OPERATOR-INTAKE-A', 'RULE-OPERATOR-INTAKE-B']),
  implementationScopeRef: 'test-only-implementation-scope',
  mappingEvidenceRef: 'test-only-mapping-evidence',
  mappingArtifactSha256: h('a'),
  conditionsRef: null,
  mappedByRef: 'human:e2d-mapper-test',
  mappedAt: '2026-09-16T17:00:00.000Z',
  proposalOnly: true,
  activationAuthorized: false,
});

const upstreamCore = {
  schemaVersion: 1,
  proposalId: 'E2D-OPERATOR-INTAKE-TEST',
  applicabilityPacketId: 'E2-TEST',
  applicabilityPacketHashSha256: h('b'),
  externalEvidenceEnvelopeId: 'E2B-TEST',
  externalEvidenceEnvelopeHashSha256: h('c'),
  authorityValidationPacketId: 'E2C-TEST',
  authorityValidationPacketHashSha256: h('d'),
  policyId: 'TEST-ONLY-E2D-UPSTREAM-POLICY',
  activationProposals: Object.freeze([activationProposal]),
  exclusions: Object.freeze([]),
  preparedByRef: 'human:e2d-preparer-test',
  preparedAt: '2026-09-16T17:05:00.000Z',
};
const upstreamProposal = Object.freeze({
  ...upstreamCore,
  status: E2D_STATUS.ACTIVATION_PROPOSAL_READY_FOR_IMPLEMENTATION_GOVERNANCE,
  blockers: Object.freeze([]),
  proposalPacketHashSha256: sha256(upstreamCore),
  substantiveReviewDispositionChainValidated: true,
  activationProposalPrepared: true,
  implementationGovernanceRequired: true,
  standardsOrRulesActivated: false,
  formalStandardsConformanceEstablished: false,
  releaseAuthorized: false,
  deploymentAuthorized: false,
  transactionAuthorized: false,
});

check(() => assert.strictEqual(verifySubstantiveReviewActivationProposalIntegrity(upstreamProposal), true));

const implementationEvidence = [{
  implementationId: 'IMPL-OPERATOR-INTAKE-TEST-001',
  candidateId: activationProposal.candidateId,
  ruleSetId: activationProposal.ruleSetId,
  implementedRuleRefs: [...activationProposal.proposedRuleRefs],
  sourceCommitSha: FROZEN_SOURCE_SHA,
  codeArtifactSha256: FROZEN_ARTIFACT_SHA,
  implementationEvidenceRef: 'test-only-implementation-evidence',
  implementedByRef: 'human:implementation-engineer-test',
  implementedAt: '2026-09-16T17:10:00.000Z',
}];
const conformanceEvidence = [{
  conformanceId: 'CONF-OPERATOR-INTAKE-TEST-001',
  candidateId: activationProposal.candidateId,
  ruleSetId: activationProposal.ruleSetId,
  testedRuleRefs: [...activationProposal.proposedRuleRefs],
  testSuiteRef: 'tests/runtime/test-only-independent-conformance',
  testArtifactSha256: h('e'),
  conformanceEvidenceRef: 'test-only-independent-conformance-evidence',
  conformanceArtifactSha256: h('f'),
  verifiedByRef: 'human:e2e-conformance-reviewer-test',
  verifiedAt: '2026-09-16T17:20:00.000Z',
  result: 'PASS',
}];

const e2ePacket = e2eIntake.preparePacket({
  policy: e2ePolicy,
  upstreamProposal,
  implementationEvidence,
  conformanceEvidence,
  evidencePacketId: 'E2E-OPERATOR-INTAKE-TEST',
  preparedByRef: 'human:e2e-preparer-test',
  preparedAt: '2026-09-16T17:30:00.000Z',
  expectedSourceSha: FROZEN_SOURCE_SHA,
});

check(() => assert.strictEqual(e2ePacket.status, E2E_STATUS.RULE_IMPLEMENTATION_EVIDENCE_READY_FOR_EXTERNAL_CONFORMANCE_VALIDATION));
check(() => assert.strictEqual(verifyRuleImplementationConformanceEvidencePacketIntegrity(e2ePacket), true));
check(() => assert.strictEqual(e2ePacket.implementationEvidence[0].sourceCommitSha, FROZEN_SOURCE_SHA));
check(() => assert.throws(() => e2eIntake.preparePacket({
  policy: e2ePolicy,
  upstreamProposal,
  implementationEvidence,
  conformanceEvidence,
  evidencePacketId: 'E2E-OPERATOR-INTAKE-TEST-BAD-SOURCE',
  preparedByRef: 'human:e2e-preparer-test',
  preparedAt: '2026-09-16T17:30:00.000Z',
  expectedSourceSha: '1'.repeat(40),
}), /sourceCommitSha mismatch/));
check(() => assert.strictEqual(e2eIntake.containsPlaceholder({ x: '<REAL_EVIDENCE_REQUIRED>' }), true));

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const verifier = Object.freeze({
  verifierId: 'e2f-verifier-operator-intake-test',
  verifierSubjectRef: 'human:e2f-verifier-test',
  authorityClass: 'TEST_ONLY_EXTERNAL_HUMAN_VERIFIER',
  publicKeyPem: publicKey.trim(),
  publicKeySha256: sha256(publicKey.trim()),
  governanceEvidenceRef: 'test-only-governance-evidence',
  activeFrom: '2026-09-16T17:00:00.000Z',
});
const registry = {
  schemaVersion: 1,
  registryId: 'e2f-operator-intake-test-registry',
  status: 'EXTERNALLY_GOVERNED',
  governanceOwnerRef: 'human:test-governance-owner',
  verifiers: [verifier],
};
const normalizedRegistry = normalizeTrustedVerifierRegistry(registry);
check(() => assert.strictEqual(normalizedRegistry.verifiers[0].publicKeySha256, verifier.publicKeySha256));

const releaseCandidate = {
  releaseCandidateId: 'startak-real-estate-rc-2026-09-16-e876208c19ff',
  sourceCommitSha: FROZEN_SOURCE_SHA,
  artifactSha256: FROZEN_ARTIFACT_SHA,
  environmentRef: FROZEN_ENV_REF,
  environmentConfigSha256: FROZEN_ENV_SHA,
  upstreamEvidencePacketHashSha256: e2ePacket.evidencePacketHashSha256,
};

const validationTypes = [
  'EXTERNAL_CONFORMANCE_AUTHENTICITY',
  'PRODUCTION_SECURITY_VALIDATION',
  'PRODUCTION_PERFORMANCE_VALIDATION',
  'PRODUCTION_RESILIENCE_VALIDATION',
];

const signedValidations = validationTypes.map((validationType, index) => {
  const external = validationType === 'EXTERNAL_CONFORMANCE_AUTHENTICITY';
  const unsigned = {
    validationId: `E2F-OPERATOR-INTAKE-TEST-${index + 1}`,
    validationType,
    targetRef: external ? e2ePacket.evidencePacketId : releaseCandidate.releaseCandidateId,
    subjectArtifactSha256: external ? e2ePacket.evidencePacketHashSha256 : FROZEN_ARTIFACT_SHA,
    environmentRef: external ? null : FROZEN_ENV_REF,
    environmentConfigSha256: external ? null : FROZEN_ENV_SHA,
    releaseCandidateCommitSha: external ? null : FROZEN_SOURCE_SHA,
    verifierId: verifier.verifierId,
    verificationSourceRef: `test-only-verification-source-${index + 1}`,
    verificationArtifactSha256: String(index + 1).repeat(64),
    verifiedAt: `2026-09-16T17:${40 + index}:00.000Z`,
    expiresAt: null,
    result: 'VERIFIED',
    signatureAlgorithm: 'RSA-SHA256',
    signatureBase64: '',
  };
  const request = e2fIntake.prepareValidationSigningRequest({ policy: e2fPolicy, validation: unsigned });
  assert.strictEqual(request.status, e2fIntake.SIGNING_REQUEST_STATUS);
  assert.strictEqual(request.signingPayloadHashSha256, e2fIntake.sha256Utf8(request.signingBytesUtf8));
  const signatureBase64 = crypto.sign(
    'RSA-SHA256',
    Buffer.from(request.signingBytesUtf8, 'utf8'),
    privateKey,
  ).toString('base64');
  const signed = { ...unsigned, signatureBase64 };
  assert.strictEqual(verifyValidationSignature(signed, verifier, e2fPolicy), true);
  return signed;
});
checks += validationTypes.length * 3;

check(() => {
  const tampered = { ...signedValidations[1], targetRef: 'tampered-target' };
  assert.strictEqual(verifyValidationSignature(tampered, verifier, e2fPolicy), false);
});
check(() => assert.throws(() => e2fIntake.prepareValidationSigningRequest({
  policy: e2fPolicy,
  validation: { ...signedValidations[0], signatureBase64: '<ONLY_AFTER_GENUINE_SIGNATURE>' },
}), /placeholder|unsigned validation/i));

const e2fPacket = e2fIntake.prepareValidationPacket({
  policy: e2fPolicy,
  upstreamEvidencePacket: e2ePacket,
  releaseCandidate,
  trustedVerifierRegistry: registry,
  expectedTrustedRegistryHashSha256: normalizedRegistry.registryHashSha256,
  validations: signedValidations,
  validationPacketId: 'E2F-OPERATOR-INTAKE-TEST',
  preparedByRef: 'human:e2f-packet-preparer-test',
  preparedAt: '2026-09-16T18:00:00.000Z',
});

check(() => assert.strictEqual(e2fPacket.status, E2F_STATUS.EXTERNAL_CONFORMANCE_AND_PRODUCTION_VALIDATION_COMPLETE_PENDING_RELEASE_AUTHORITY));
check(() => assert.strictEqual(e2fPacket.productionValidationComplete, true));
check(() => assert.strictEqual(verifyExternalConformanceProductionValidationPacketIntegrity(e2fPacket), true));
check(() => assert.strictEqual(e2fPacket.releaseAuthorized, false));
check(() => assert.strictEqual(e2fPacket.mergeAuthorized, false));
check(() => assert.strictEqual(e2fPacket.deploymentAuthorized, false));
check(() => assert.strictEqual(e2fPacket.transactionAuthorized, false));

console.log(`E2E/E2F operator intake runtime tests passed: ${checks}`);
