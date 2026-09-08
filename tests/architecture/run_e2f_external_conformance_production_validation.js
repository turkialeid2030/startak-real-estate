'use strict';

const assert = require('assert');
const crypto = require('crypto');
const policy = require('../../governance/e2f-external-conformance-production-validation-policy-2026-09-08.json');
const { sha256 } = require('../../src/standards/standards-registry');
const {
  E2E_STATUS,
  verifyRuleImplementationConformanceEvidencePacketIntegrity,
} = require('../../src/standards/rule-implementation-conformance-evidence');
const { normalizeTrustedVerifierRegistry } = require('../../src/standards/external-authority-validation');
const {
  E2F_STATUS,
  VALIDATION_TYPE,
  VALIDATION_RESULT,
  validatePolicy,
  normalizeReleaseCandidate,
  createValidationSigningPayload,
  createExternalConformanceProductionValidationPacket,
  verifyExternalConformanceProductionValidationPacketIntegrity,
} = require('../../src/standards/external-conformance-production-validation');

let checks = 0;
function check(fn) { fn(); checks += 1; }
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
const h = (char) => char.repeat(64);
const c = (char) => char.repeat(40);

check(() => assert.strictEqual(policy.policyId, 'STARTAK-E2F-EXTERNAL-CONFORMANCE-PRODUCTION-VALIDATION-POLICY-2026-09-08'));
check(() => assert.strictEqual(policy.operatingMode, 'UNLICENSED_DECISION_SUPPORT'));
check(() => assert.strictEqual(policy.productionTrustedVerifierRegistryConfigured, false));
check(() => assert.strictEqual(policy.productionExternalConformanceEvidencePresent, false));
check(() => assert.strictEqual(policy.productionSecurityValidationEvidencePresent, false));
check(() => assert.strictEqual(policy.productionPerformanceValidationEvidencePresent, false));
check(() => assert.strictEqual(policy.productionResilienceValidationEvidencePresent, false));
check(() => assert.strictEqual(policy.formalStandardsConformanceAutoEstablished, false));
check(() => assert.strictEqual(policy.automaticRuleActivationAllowed, false));
check(() => assert.strictEqual(policy.automaticReleaseAllowed, false));
check(() => assert.strictEqual(policy.automaticDeploymentAllowed, false));
check(() => assert.strictEqual(validatePolicy(policy), true));
check(() => assert.deepStrictEqual(new Set(policy.requiredValidationTypes), new Set(Object.values(VALIDATION_TYPE))));

const upstreamCore = {
  schemaVersion: 1,
  evidencePacketId: 'E2F-UPSTREAM-E2E-PACKET',
  upstreamProposalId: 'E2F-UPSTREAM-E2D-PROPOSAL',
  upstreamProposalHashSha256: h('1'),
  policyId: 'STARTAK-E2E-TEST-UPSTREAM-POLICY',
  implementationEvidence: Object.freeze([Object.freeze({
    implementationId: 'IMPL-E2F-001',
    candidateId: 'E2-TAQEEM-REPORT-QA-004',
    ruleSetId: 'RULESET-E2F',
    implementedRuleRefs: Object.freeze(['RULE-A']),
    sourceCommitSha: c('2'),
    codeArtifactSha256: h('2'),
    implementationEvidenceRef: 'impl-evidence',
    implementedByRef: 'implementation-actor-e2f',
    implementedAt: '2026-09-08T11:20:00.000Z',
    implementationRecordHashSha256: h('3'),
  })]),
  conformanceEvidence: Object.freeze([Object.freeze({
    conformanceId: 'CONF-E2F-001',
    candidateId: 'E2-TAQEEM-REPORT-QA-004',
    ruleSetId: 'RULESET-E2F',
    testedRuleRefs: Object.freeze(['RULE-A']),
    testSuiteRef: 'conformance-suite-e2f',
    testArtifactSha256: h('4'),
    conformanceEvidenceRef: 'conformance-evidence-e2f',
    conformanceArtifactSha256: h('5'),
    verifiedByRef: 'conformance-actor-e2f',
    verifiedAt: '2026-09-08T11:21:00.000Z',
    result: 'PASS',
    conformanceRecordHashSha256: h('6'),
  })]),
  missingImplementationEvidence: Object.freeze([]),
  missingConformanceEvidence: Object.freeze([]),
  preparedByRef: 'e2e-preparer',
  preparedAt: '2026-09-08T11:22:00.000Z',
};
const upstream = Object.freeze({
  ...upstreamCore,
  status: E2E_STATUS.RULE_IMPLEMENTATION_EVIDENCE_READY_FOR_EXTERNAL_CONFORMANCE_VALIDATION,
  blockers: Object.freeze([]),
  evidencePacketHashSha256: sha256(upstreamCore),
  implementationEvidenceComplete: true,
  conformanceEvidenceComplete: true,
  independentConformanceEvidenceRecorded: true,
  externalConformanceValidationRequired: true,
  formalStandardsConformanceEstablished: false,
  standardsOrRulesActivated: false,
  releaseAuthorized: false,
  deploymentAuthorized: false,
  transactionAuthorized: false,
});
check(() => assert.strictEqual(verifyRuleImplementationConformanceEvidencePacketIntegrity(upstream), true));

const releaseCandidate = {
  releaseCandidateId: 'STARTAK-RC-E2F-001',
  sourceCommitSha: c('7'),
  artifactSha256: h('7'),
  environmentRef: 'production-candidate-environment-e2f',
  environmentConfigSha256: h('8'),
  upstreamEvidencePacketHashSha256: upstream.evidencePacketHashSha256,
};
const normalizedRelease = normalizeReleaseCandidate(releaseCandidate, upstream);
check(() => assert.strictEqual(normalizedRelease.releaseCandidateId, 'STARTAK-RC-E2F-001'));
check(() => assert.strictEqual(normalizedRelease.upstreamEvidencePacketHashSha256, upstream.evidencePacketHashSha256));

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).trim();
function registryForSubject(subjectRef) {
  return {
    registryId: `E2F-TRUST-REGISTRY-${subjectRef}`,
    status: 'EXTERNALLY_GOVERNED',
    governanceOwnerRef: 'e2f-external-governance-owner',
    verifiers: [{
      verifierId: 'e2f-external-verifier',
      verifierSubjectRef: subjectRef,
      authorityClass: 'EXTERNAL_CONFORMANCE_PRODUCTION_VALIDATION_PROVIDER',
      publicKeyPem,
      publicKeySha256: sha256(publicKeyPem),
      governanceEvidenceRef: 'e2f-external-governance-evidence',
      activeFrom: '2026-01-01T00:00:00+03:00',
      activeUntil: '2026-12-31T23:59:59+03:00',
    }],
  };
}
const registryInput = registryForSubject('independent-external-validator-e2f');
const registry = normalizeTrustedVerifierRegistry(registryInput);
check(() => assert.strictEqual(/^[a-f0-9]{64}$/.test(registry.registryHashSha256), true));

function sign(raw) {
  const payload = createValidationSigningPayload(raw, policy);
  return {
    ...raw,
    signatureBase64: crypto.sign('RSA-SHA256', Buffer.from(stableStringify(payload), 'utf8'), privateKey).toString('base64'),
  };
}
function externalConformance(result = VALIDATION_RESULT.VERIFIED) {
  return sign({
    validationId: `VAL-EXTERNAL-CONFORMANCE-${result}`,
    validationType: VALIDATION_TYPE.EXTERNAL_CONFORMANCE_AUTHENTICITY,
    targetRef: upstream.evidencePacketId,
    subjectArtifactSha256: upstream.evidencePacketHashSha256,
    verifierId: 'e2f-external-verifier',
    verificationSourceRef: 'external-conformance-authentication-source',
    verificationArtifactSha256: sha256(`external-conformance-${result}`),
    verifiedAt: '2026-09-08T11:30:00.000Z',
    expiresAt: '2026-12-31T20:59:59.000Z',
    result,
    signatureAlgorithm: 'RSA-SHA256',
  });
}
function productionValidation(type, suffix, result = VALIDATION_RESULT.VERIFIED) {
  return sign({
    validationId: `VAL-${suffix}-${result}`,
    validationType: type,
    targetRef: releaseCandidate.releaseCandidateId,
    subjectArtifactSha256: releaseCandidate.artifactSha256,
    environmentRef: releaseCandidate.environmentRef,
    environmentConfigSha256: releaseCandidate.environmentConfigSha256,
    releaseCandidateCommitSha: releaseCandidate.sourceCommitSha,
    verifierId: 'e2f-external-verifier',
    verificationSourceRef: `external-${suffix.toLowerCase()}-validation-source`,
    verificationArtifactSha256: sha256(`${suffix}-${result}`),
    verifiedAt: '2026-09-08T11:31:00.000Z',
    expiresAt: '2026-12-31T20:59:59.000Z',
    result,
    signatureAlgorithm: 'RSA-SHA256',
  });
}

function packet(validations, overrides = {}) {
  return createExternalConformanceProductionValidationPacket({
    validationPacketId: overrides.validationPacketId || 'E2F-VALIDATION-PACKET',
    upstreamEvidencePacket: overrides.upstreamEvidencePacket || upstream,
    policy,
    releaseCandidate: overrides.releaseCandidate || releaseCandidate,
    trustedVerifierRegistry: overrides.trustedVerifierRegistry || registryInput,
    expectedTrustedRegistryHashSha256: overrides.expectedTrustedRegistryHashSha256 || registry.registryHashSha256,
    validations,
    preparedByRef: 'e2f-preparer',
    preparedAt: '2026-09-08T11:40:00.000Z',
  });
}

const empty = packet([]);
check(() => assert.strictEqual(empty.status, E2F_STATUS.WAITING_FOR_EXTERNAL_CONFORMANCE_VALIDATION));
check(() => assert.strictEqual(empty.externalConformanceEvidenceAuthenticityValidated, false));
check(() => assert.strictEqual(empty.productionSecurityValidated, false));
check(() => assert.strictEqual(empty.productionPerformanceValidated, false));
check(() => assert.strictEqual(empty.productionResilienceValidated, false));
check(() => assert.strictEqual(verifyExternalConformanceProductionValidationPacketIntegrity(empty), true));

const conf = externalConformance();
const security = productionValidation(VALIDATION_TYPE.PRODUCTION_SECURITY_VALIDATION, 'SECURITY');
const performance = productionValidation(VALIDATION_TYPE.PRODUCTION_PERFORMANCE_VALIDATION, 'PERFORMANCE');
const resilience = productionValidation(VALIDATION_TYPE.PRODUCTION_RESILIENCE_VALIDATION, 'RESILIENCE');

const waitingSecurity = packet([conf], { validationPacketId: 'E2F-WAIT-SECURITY' });
check(() => assert.strictEqual(waitingSecurity.status, E2F_STATUS.WAITING_FOR_PRODUCTION_SECURITY_VALIDATION));
check(() => assert.strictEqual(waitingSecurity.externalConformanceEvidenceAuthenticityValidated, true));
check(() => assert.strictEqual(waitingSecurity.productionSecurityValidated, false));

const waitingPerformance = packet([conf, security], { validationPacketId: 'E2F-WAIT-PERFORMANCE' });
check(() => assert.strictEqual(waitingPerformance.status, E2F_STATUS.WAITING_FOR_PRODUCTION_PERFORMANCE_VALIDATION));
check(() => assert.strictEqual(waitingPerformance.productionSecurityValidated, true));
check(() => assert.strictEqual(waitingPerformance.productionPerformanceValidated, false));

const waitingResilience = packet([conf, security, performance], { validationPacketId: 'E2F-WAIT-RESILIENCE' });
check(() => assert.strictEqual(waitingResilience.status, E2F_STATUS.WAITING_FOR_PRODUCTION_RESILIENCE_VALIDATION));
check(() => assert.strictEqual(waitingResilience.productionPerformanceValidated, true));
check(() => assert.strictEqual(waitingResilience.productionResilienceValidated, false));

const complete = packet([conf, security, performance, resilience], { validationPacketId: 'E2F-COMPLETE' });
check(() => assert.strictEqual(complete.status, E2F_STATUS.EXTERNAL_CONFORMANCE_AND_PRODUCTION_VALIDATION_COMPLETE_PENDING_RELEASE_AUTHORITY));
check(() => assert.strictEqual(complete.externalConformanceEvidenceAuthenticityValidated, true));
check(() => assert.strictEqual(complete.productionSecurityValidated, true));
check(() => assert.strictEqual(complete.productionPerformanceValidated, true));
check(() => assert.strictEqual(complete.productionResilienceValidated, true));
check(() => assert.strictEqual(complete.productionValidationComplete, true));
check(() => assert.strictEqual(complete.humanReleaseAuthorityRequired, true));
check(() => assert.strictEqual(complete.formalStandardsConformanceEstablished, false));
check(() => assert.strictEqual(complete.standardsOrRulesActivated, false));
check(() => assert.strictEqual(complete.saudiProfessionalLicensingEstablished, false));
check(() => assert.strictEqual(complete.certifiedValuationAuthorityEstablished, false));
check(() => assert.strictEqual(complete.externalIssuanceAuthorized, false));
check(() => assert.strictEqual(complete.releaseAuthorized, false));
check(() => assert.strictEqual(complete.mergeAuthorized, false));
check(() => assert.strictEqual(complete.deploymentAuthorized, false));
check(() => assert.strictEqual(complete.transactionAuthorized, false));
check(() => assert.strictEqual(verifyExternalConformanceProductionValidationPacketIntegrity(complete), true));

// Pinned trust-root mismatch fails closed.
const wrongTrust = packet([], { validationPacketId: 'E2F-WRONG-TRUST', expectedTrustedRegistryHashSha256: h('9') });
check(() => assert.strictEqual(wrongTrust.status, E2F_STATUS.HOLD_TRUST_ROOT));
check(() => assert.strictEqual(wrongTrust.blockers.includes('TRUSTED_VERIFIER_REGISTRY_HASH_MISMATCH'), true));

// Production validation is bound to the exact environment configuration.
const badEnvironment = sign({
  ...security,
  validationId: 'VAL-SECURITY-BAD-ENV',
  environmentConfigSha256: h('a'),
  signatureBase64: undefined,
});
const heldEnvironment = packet([conf, badEnvironment], { validationPacketId: 'E2F-BAD-ENV' });
check(() => assert.strictEqual(heldEnvironment.status, E2F_STATUS.HOLD_VALIDATION_INTEGRITY));
check(() => assert.strictEqual(heldEnvironment.blockers.includes('PRODUCTION_VALIDATION_ENV_CONFIG_HASH_MISMATCH:VAL-SECURITY-BAD-ENV'), true));

// Signature/content tampering fails closed.
const tampered = JSON.parse(JSON.stringify(conf));
tampered.subjectArtifactSha256 = h('b');
const heldTamper = packet([tampered], { validationPacketId: 'E2F-TAMPERED' });
check(() => assert.strictEqual(heldTamper.status, E2F_STATUS.HOLD_VALIDATION_INTEGRITY));
check(() => assert.strictEqual(heldTamper.blockers.some((x) => x.startsWith('EXTERNAL_CONFORMANCE_HASH_MISMATCH:') || x.startsWith('VALIDATION_SIGNATURE_INVALID:')), true));

// A validly signed REJECTED result is blocking.
const rejected = packet([externalConformance(VALIDATION_RESULT.REJECTED)], { validationPacketId: 'E2F-REJECTED' });
check(() => assert.strictEqual(rejected.status, E2F_STATUS.HOLD_EXTERNAL_VALIDATION_REJECTED));
check(() => assert.strictEqual(rejected.blockers.some((x) => x.startsWith('EXTERNAL_VALIDATION_REJECTED:')), true));
check(() => assert.strictEqual(rejected.productionValidationComplete, false));

// INCONCLUSIVE never counts as VERIFIED.
const inconclusive = packet([externalConformance(VALIDATION_RESULT.INCONCLUSIVE)], { validationPacketId: 'E2F-INCONCLUSIVE' });
check(() => assert.strictEqual(inconclusive.status, E2F_STATUS.WAITING_FOR_EXTERNAL_CONFORMANCE_VALIDATION));
check(() => assert.strictEqual(inconclusive.externalConformanceEvidenceAuthenticityValidated, false));

// Implementation actor may not act as external production validator.
const implementationRegistryInput = registryForSubject('implementation-actor-e2f');
const implementationRegistry = normalizeTrustedVerifierRegistry(implementationRegistryInput);
const heldImplementationActor = createExternalConformanceProductionValidationPacket({
  validationPacketId: 'E2F-IMPLEMENTATION-ACTOR',
  upstreamEvidencePacket: upstream,
  policy,
  releaseCandidate,
  trustedVerifierRegistry: implementationRegistryInput,
  expectedTrustedRegistryHashSha256: implementationRegistry.registryHashSha256,
  validations: [security],
  preparedByRef: 'e2f-preparer',
  preparedAt: '2026-09-08T11:40:00.000Z',
});
check(() => assert.strictEqual(heldImplementationActor.status, E2F_STATUS.HOLD_VALIDATION_INTEGRITY));
check(() => assert.strictEqual(heldImplementationActor.blockers.some((x) => x.startsWith('IMPLEMENTATION_ACTOR_EXTERNAL_VALIDATION_PROHIBITED:')), true));

// Original conformance actor may not self-authenticate its own conformance evidence.
const conformanceRegistryInput = registryForSubject('conformance-actor-e2f');
const conformanceRegistry = normalizeTrustedVerifierRegistry(conformanceRegistryInput);
const heldConformanceActor = createExternalConformanceProductionValidationPacket({
  validationPacketId: 'E2F-CONFORMANCE-ACTOR',
  upstreamEvidencePacket: upstream,
  policy,
  releaseCandidate,
  trustedVerifierRegistry: conformanceRegistryInput,
  expectedTrustedRegistryHashSha256: conformanceRegistry.registryHashSha256,
  validations: [conf],
  preparedByRef: 'e2f-preparer',
  preparedAt: '2026-09-08T11:40:00.000Z',
});
check(() => assert.strictEqual(heldConformanceActor.status, E2F_STATUS.HOLD_VALIDATION_INTEGRITY));
check(() => assert.strictEqual(heldConformanceActor.blockers.some((x) => x.startsWith('CONFORMANCE_ACTOR_SELF_AUTHENTICATION_PROHIBITED:')), true));

// Release candidate must chain to the exact E2E packet hash.
const badReleaseCandidate = { ...releaseCandidate, upstreamEvidencePacketHashSha256: h('c') };
const heldReleaseChain = packet([], { validationPacketId: 'E2F-BAD-RELEASE-CHAIN', releaseCandidate: badReleaseCandidate });
check(() => assert.strictEqual(heldReleaseChain.status, E2F_STATUS.HOLD_VALIDATION_INTEGRITY));
check(() => assert.strictEqual(heldReleaseChain.blockers.includes('RELEASE_CANDIDATE_UPSTREAM_EVIDENCE_HASH_MISMATCH'), true));

// Tampered E2E upstream fails closed.
const tamperedUpstream = JSON.parse(JSON.stringify(upstream));
tamperedUpstream.conformanceEvidence[0].result = 'FAIL';
const heldUpstream = packet([], { validationPacketId: 'E2F-TAMPERED-UPSTREAM', upstreamEvidencePacket: tamperedUpstream });
check(() => assert.strictEqual(heldUpstream.status, E2F_STATUS.HOLD_E2E_EVIDENCE_PACKET));
check(() => assert.strictEqual(heldUpstream.transactionAuthorized, false));

// Completed packet tampering is detectable.
const tamperedPacket = JSON.parse(JSON.stringify(complete));
tamperedPacket.releaseCandidate.artifactSha256 = h('d');
check(() => assert.strictEqual(verifyExternalConformanceProductionValidationPacketIntegrity(tamperedPacket), false));

console.log(`E2F_EXTERNAL_CONFORMANCE_PRODUCTION_VALIDATION=PASS checks=${checks}`);
