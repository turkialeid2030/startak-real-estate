'use strict';

const assert = require('assert');
const crypto = require('crypto');
const policy = require('../../governance/e2c-external-authority-validation-policy-2026-09-08.json');
const requirements = require('../../governance/e2b-external-review-evidence-requirements-2026-09-08.json');
const matrix = require('../../governance/saudi-legal-professional-applicability-candidates-2026-09-08.json');
const valuationEvidence = require('../../governance/official-valuation-standards-source-evidence-2026-09-08.json');
const saudiEvidence = require('../../governance/official-saudi-regulatory-source-evidence-2026-09-08.json');
const contextEvidence = require('../../governance/saudi-regulatory-context-source-evidence-2026-09-08.json');
const phase2Evidence = require('../../governance/official-standards-and-licensing-source-evidence-phase2-2026-09-08.json');
const { sha256 } = require('../../src/standards/standards-registry');
const {
  createSaudiApplicabilityReviewPacket,
  verifyApplicabilityPacketIntegrity,
} = require('../../src/standards/saudi-legal-professional-applicability');
const {
  E2B_STATUS,
  createExternalReviewCredentialEvidenceEnvelope,
  verifyExternalEvidenceEnvelopeIntegrity,
} = require('../../src/standards/external-review-credential-evidence');
const {
  E2C_STATUS,
  VALIDATION_TYPE,
  ATTESTATION_RESULT,
  validatePolicy,
  normalizeTrustedVerifierRegistry,
  createAttestationSigningPayload,
  createExternalAuthorityValidationPacket,
  verifyExternalAuthorityValidationPacketIntegrity,
} = require('../../src/standards/external-authority-validation');

let checks = 0;
function check(fn) { fn(); checks += 1; }

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const h = (char) => char.repeat(64);
const registers = [valuationEvidence, saudiEvidence, contextEvidence, phase2Evidence];

check(() => assert.strictEqual(policy.policyId, 'STARTAK-E2C-EXTERNAL-AUTHORITY-VALIDATION-POLICY-2026-09-08'));
check(() => assert.strictEqual(policy.operatingMode, 'UNLICENSED_DECISION_SUPPORT'));
check(() => assert.strictEqual(policy.status, 'ENGINEERING_GATE_DEFINED_PRODUCTION_TRUST_ROOT_NOT_CONFIGURED'));
check(() => assert.strictEqual(policy.trustedVerifierRegistryRequired, true));
check(() => assert.strictEqual(policy.trustedRegistryHashPinnedOutOfBandRequired, true));
check(() => assert.strictEqual(policy.callerDeclaredVerificationAccepted, false));
check(() => assert.strictEqual(policy.selfValidationAllowed, false));
check(() => assert.strictEqual(policy.productionTrustedVerifierRegistryConfigured, false));
check(() => assert.strictEqual(policy.productionExternalAttestationEvidencePresent, false));
check(() => assert.strictEqual(policy.automaticRuleActivationAllowed, false));
check(() => assert.strictEqual(validatePolicy(policy), true));
check(() => assert.deepStrictEqual(new Set(policy.requiredValidationTypes), new Set(Object.values(VALIDATION_TYPE))));

const applicabilityPacket = createSaudiApplicabilityReviewPacket({
  reviewPacketId: 'E2C-SOURCE-PACKET',
  caseContext: {
    serviceModel: 'INTERNAL_DECISION_SUPPORT',
    professionalValuationRequested: false,
    professionalReportRequested: false,
    capitalMarketsContext: null,
    financingRegulatoryContext: null,
    collateralValuationContext: false,
    financialReportingPurpose: false,
    reportingFramework: null,
    transactionContext: null,
    personalDataProcessed: true,
    crossBorderPersonalDataProcessing: false,
    realEstateContributionContext: false,
    measurementStandardRequested: null,
    costFrameworkRequested: null,
    comparativeProfessionalReference: null,
    ricsContextRequested: false,
  },
  candidateMatrix: matrix,
  evidenceRegisters: registers,
  preparedByRef: 'internal-engineering-review',
  preparedAt: '2026-09-08T13:30:00+03:00',
});
check(() => assert.strictEqual(verifyApplicabilityPacketIntegrity(applicabilityPacket), true));
check(() => assert.strictEqual(applicabilityPacket.triggeredCandidates.length, 1));
check(() => assert.strictEqual(applicabilityPacket.triggeredCandidates[0].candidateId, 'E2-SDAIA-PDPL-010'));

const reviewEvidence = [
  {
    evidenceId: 'REV-DATA-E2C-001',
    candidateId: 'E2-SDAIA-PDPL-010',
    evidenceClass: 'DATA_GOVERNANCE_REVIEW',
    reviewerRef: 'reviewer-data-e2c',
    issuerOrFirmRef: 'data-firm-e2c',
    artifactId: 'data-review-e2c-artifact',
    artifactSha256: h('a'),
    scopeRef: 'pdpl-data-scope',
    issuedAt: '2026-09-08T13:31:00+03:00',
    receivedAt: '2026-09-08T13:32:00+03:00',
  },
  {
    evidenceId: 'REV-LEGAL-E2C-001',
    candidateId: 'E2-SDAIA-PDPL-010',
    evidenceClass: 'LEGAL_REVIEW',
    reviewerRef: 'reviewer-legal-e2c',
    issuerOrFirmRef: 'legal-firm-e2c',
    artifactId: 'legal-review-e2c-artifact',
    artifactSha256: h('b'),
    scopeRef: 'pdpl-legal-scope',
    issuedAt: '2026-09-08T13:33:00+03:00',
    receivedAt: '2026-09-08T13:34:00+03:00',
  },
];

const credentialEvidence = [
  {
    credentialEvidenceId: 'CRED-DATA-E2C-001',
    subjectReviewerRef: 'reviewer-data-e2c',
    authorityRef: 'external-data-professional-register',
    credentialClass: 'DATA_GOVERNANCE_REVIEWER_CREDENTIAL_EVIDENCE',
    artifactId: 'cred-data-e2c-artifact',
    artifactSha256: h('c'),
    observedAt: '2026-09-08T13:35:00+03:00',
    verificationSourceRef: 'data-professional-register-source',
  },
  {
    credentialEvidenceId: 'CRED-LEGAL-E2C-001',
    subjectReviewerRef: 'reviewer-legal-e2c',
    authorityRef: 'external-legal-professional-register',
    credentialClass: 'SAUDI_LEGAL_REVIEWER_CREDENTIAL_EVIDENCE',
    artifactId: 'cred-legal-e2c-artifact',
    artifactSha256: h('d'),
    observedAt: '2026-09-08T13:36:00+03:00',
    verificationSourceRef: 'legal-professional-register-source',
  },
];

const envelope = createExternalReviewCredentialEvidenceEnvelope({
  envelopeId: 'E2C-UPSTREAM-E2B-ENVELOPE',
  applicabilityPacket,
  requirements,
  reviewEvidence,
  credentialEvidence,
  preparedByRef: 'e2b-preparer',
  preparedAt: '2026-09-08T13:38:00+03:00',
});
check(() => assert.strictEqual(envelope.status, E2B_STATUS.READY_FOR_EXTERNAL_AUTHORITY_VALIDATION));
check(() => assert.strictEqual(verifyExternalEvidenceEnvelopeIntegrity(envelope), true));
check(() => assert.strictEqual(envelope.reviewEvidence.length, 2));
check(() => assert.strictEqual(envelope.credentialEvidence.length, 2));

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).trim();
const registryInput = {
  registryId: 'E2C-TEST-EXTERNAL-TRUSTED-VERIFIERS',
  status: 'EXTERNALLY_GOVERNED',
  governanceOwnerRef: 'external-governance-owner-test-fixture',
  verifiers: [
    {
      verifierId: 'independent-verifier-001',
      verifierSubjectRef: 'independent-verifier-organization',
      authorityClass: 'EXTERNAL_AUTHORITY_VALIDATION_PROVIDER',
      publicKeyPem,
      publicKeySha256: sha256(publicKeyPem),
      governanceEvidenceRef: 'external-governance-evidence-fixture',
      activeFrom: '2026-01-01T00:00:00+03:00',
      activeUntil: '2026-12-31T23:59:59+03:00',
    },
  ],
};
const normalizedRegistry = normalizeTrustedVerifierRegistry(registryInput);
check(() => assert.strictEqual(normalizedRegistry.registryId, registryInput.registryId));
check(() => assert.strictEqual(/^[a-f0-9]{64}$/.test(normalizedRegistry.registryHashSha256), true));
check(() => assert.strictEqual(normalizedRegistry.verifiers.length, 1));

function signedAttestation({ id, type, targetRef, subjectHash, linkedCredentialEvidenceId = null, result = ATTESTATION_RESULT.VERIFIED, verifierId = 'independent-verifier-001' }) {
  const raw = {
    attestationId: id,
    validationType: type,
    targetRef,
    linkedCredentialEvidenceId,
    subjectArtifactSha256: subjectHash,
    result,
    verifierId,
    verificationSourceRef: `external-verification-source:${id}`,
    verificationArtifactSha256: sha256(`verification-artifact:${id}:${result}`),
    verifiedAt: '2026-09-08T13:39:00+03:00',
    expiresAt: '2026-12-31T23:59:59+03:00',
    signatureAlgorithm: 'RSA-SHA256',
  };
  const payload = createAttestationSigningPayload(raw, policy);
  const signatureBase64 = crypto.sign('RSA-SHA256', Buffer.from(stableStringify(payload), 'utf8'), privateKey).toString('base64');
  return { ...raw, signatureBase64 };
}

const reviewAttestations = [
  signedAttestation({ id: 'ATT-REV-DATA', type: VALIDATION_TYPE.REVIEW_EVIDENCE_AUTHENTICITY, targetRef: 'REV-DATA-E2C-001', subjectHash: h('a') }),
  signedAttestation({ id: 'ATT-REV-LEGAL', type: VALIDATION_TYPE.REVIEW_EVIDENCE_AUTHENTICITY, targetRef: 'REV-LEGAL-E2C-001', subjectHash: h('b') }),
];
const credentialAttestations = [
  signedAttestation({ id: 'ATT-CRED-DATA', type: VALIDATION_TYPE.CREDENTIAL_AUTHENTICITY, targetRef: 'CRED-DATA-E2C-001', subjectHash: h('c') }),
  signedAttestation({ id: 'ATT-CRED-LEGAL', type: VALIDATION_TYPE.CREDENTIAL_AUTHENTICITY, targetRef: 'CRED-LEGAL-E2C-001', subjectHash: h('d') }),
];
const authorityAttestations = [
  signedAttestation({ id: 'ATT-AUTH-DATA', type: VALIDATION_TYPE.REVIEWER_AUTHORITY, targetRef: 'reviewer-data-e2c', subjectHash: h('c'), linkedCredentialEvidenceId: 'CRED-DATA-E2C-001' }),
  signedAttestation({ id: 'ATT-AUTH-LEGAL', type: VALIDATION_TYPE.REVIEWER_AUTHORITY, targetRef: 'reviewer-legal-e2c', subjectHash: h('d'), linkedCredentialEvidenceId: 'CRED-LEGAL-E2C-001' }),
];
const independenceAttestations = [
  signedAttestation({ id: 'ATT-IND-DATA', type: VALIDATION_TYPE.REVIEWER_INDEPENDENCE, targetRef: 'reviewer-data-e2c', subjectHash: h('c'), linkedCredentialEvidenceId: 'CRED-DATA-E2C-001' }),
  signedAttestation({ id: 'ATT-IND-LEGAL', type: VALIDATION_TYPE.REVIEWER_INDEPENDENCE, targetRef: 'reviewer-legal-e2c', subjectHash: h('d'), linkedCredentialEvidenceId: 'CRED-LEGAL-E2C-001' }),
];

function packet(attestations, overrides = {}) {
  return createExternalAuthorityValidationPacket({
    validationPacketId: overrides.validationPacketId || 'E2C-VALIDATION-PACKET',
    externalEvidenceEnvelope: overrides.externalEvidenceEnvelope || envelope,
    policy,
    trustedVerifierRegistry: overrides.trustedVerifierRegistry || registryInput,
    expectedTrustedRegistryHashSha256: overrides.expectedTrustedRegistryHashSha256 || normalizedRegistry.registryHashSha256,
    attestations,
    preparedByRef: 'e2c-preparer',
    preparedAt: '2026-09-08T13:40:00+03:00',
  });
}

const waitingReview = packet([]);
check(() => assert.strictEqual(waitingReview.status, E2C_STATUS.WAITING_FOR_REVIEW_AUTHENTICITY_VALIDATION));
check(() => assert.strictEqual(waitingReview.externalReviewAuthenticityValidated, false));
check(() => assert.strictEqual(waitingReview.credentialAuthenticityValidated, false));
check(() => assert.strictEqual(waitingReview.reviewerAuthorityValidated, false));
check(() => assert.strictEqual(waitingReview.reviewerIndependenceVerified, false));
check(() => assert.strictEqual(waitingReview.missingReviewAuthenticity.length, 2));
check(() => assert.strictEqual(verifyExternalAuthorityValidationPacketIntegrity(waitingReview), true));

const waitingCredential = packet(reviewAttestations);
check(() => assert.strictEqual(waitingCredential.status, E2C_STATUS.WAITING_FOR_CREDENTIAL_AUTHENTICITY_VALIDATION));
check(() => assert.strictEqual(waitingCredential.externalReviewAuthenticityValidated, true));
check(() => assert.strictEqual(waitingCredential.credentialAuthenticityValidated, false));
check(() => assert.strictEqual(waitingCredential.missingReviewAuthenticity.length, 0));
check(() => assert.strictEqual(waitingCredential.missingCredentialAuthenticity.length, 2));

const waitingAuthority = packet([...reviewAttestations, ...credentialAttestations]);
check(() => assert.strictEqual(waitingAuthority.status, E2C_STATUS.WAITING_FOR_REVIEWER_AUTHORITY_VALIDATION));
check(() => assert.strictEqual(waitingAuthority.externalReviewAuthenticityValidated, true));
check(() => assert.strictEqual(waitingAuthority.credentialAuthenticityValidated, true));
check(() => assert.strictEqual(waitingAuthority.reviewerCredentialsVerified, false));
check(() => assert.strictEqual(waitingAuthority.missingReviewerAuthority.length, 2));

const waitingIndependence = packet([...reviewAttestations, ...credentialAttestations, ...authorityAttestations]);
check(() => assert.strictEqual(waitingIndependence.status, E2C_STATUS.WAITING_FOR_REVIEWER_INDEPENDENCE_VALIDATION));
check(() => assert.strictEqual(waitingIndependence.reviewerAuthorityValidated, true));
check(() => assert.strictEqual(waitingIndependence.reviewerCredentialsVerified, true));
check(() => assert.strictEqual(waitingIndependence.reviewerIndependenceVerified, false));
check(() => assert.strictEqual(waitingIndependence.missingReviewerIndependence.length, 2));

const complete = packet([...reviewAttestations, ...credentialAttestations, ...authorityAttestations, ...independenceAttestations]);
check(() => assert.strictEqual(complete.status, E2C_STATUS.AUTHORITY_VALIDATION_COMPLETE_PENDING_SUBSTANTIVE_REVIEW));
check(() => assert.strictEqual(complete.externalReviewAuthenticityValidated, true));
check(() => assert.strictEqual(complete.credentialAuthenticityValidated, true));
check(() => assert.strictEqual(complete.reviewerAuthorityValidated, true));
check(() => assert.strictEqual(complete.reviewerCredentialsVerified, true));
check(() => assert.strictEqual(complete.reviewerIndependenceVerified, true));
check(() => assert.strictEqual(complete.externalAuthorityValidationComplete, true));
check(() => assert.strictEqual(complete.legalConclusionEstablished, false));
check(() => assert.strictEqual(complete.professionalApplicabilityEstablished, false));
check(() => assert.strictEqual(complete.formalStandardsConformanceEstablished, false));
check(() => assert.strictEqual(complete.saudiProfessionalLicensingEstablished, false));
check(() => assert.strictEqual(complete.pdplComplianceEstablished, false));
check(() => assert.strictEqual(complete.taxComplianceEstablished, false));
check(() => assert.strictEqual(complete.financialReportingComplianceEstablished, false));
check(() => assert.strictEqual(complete.certifiedValuationAuthorityEstablished, false));
check(() => assert.strictEqual(complete.standardsOrRulesActivated, false));
check(() => assert.strictEqual(complete.externalIssuanceAuthorized, false));
check(() => assert.strictEqual(complete.releaseAuthorized, false));
check(() => assert.strictEqual(complete.mergeAuthorized, false));
check(() => assert.strictEqual(complete.deploymentAuthorized, false));
check(() => assert.strictEqual(complete.transactionAuthorized, false));
check(() => assert.strictEqual(verifyExternalAuthorityValidationPacketIntegrity(complete), true));

// Trust-root substitution fails closed.
const wrongTrustRoot = packet([], { expectedTrustedRegistryHashSha256: h('9'), validationPacketId: 'E2C-WRONG-TRUST-ROOT' });
check(() => assert.strictEqual(wrongTrustRoot.status, E2C_STATUS.HOLD_TRUST_ROOT));
check(() => assert.strictEqual(wrongTrustRoot.blockers.includes('TRUSTED_VERIFIER_REGISTRY_HASH_MISMATCH'), true));
check(() => assert.strictEqual(wrongTrustRoot.externalAuthorityValidationComplete, false));

// Signature tampering fails closed.
const tamperedSignature = JSON.parse(JSON.stringify(reviewAttestations));
tamperedSignature[0].subjectArtifactSha256 = h('f');
const heldTamper = packet(tamperedSignature, { validationPacketId: 'E2C-TAMPERED-ATTESTATION' });
check(() => assert.strictEqual(heldTamper.status, E2C_STATUS.HOLD_ATTESTATION_INTEGRITY));
check(() => assert.strictEqual(heldTamper.blockers.some((x) => x.includes('ATTESTATION_SUBJECT_HASH_MISMATCH') || x.includes('ATTESTATION_SIGNATURE_INVALID')), true));

// A cryptographically valid rejection is a blocking external result, never a success.
const rejectedAttestation = signedAttestation({
  id: 'ATT-REJECTED-DATA',
  type: VALIDATION_TYPE.REVIEW_EVIDENCE_AUTHENTICITY,
  targetRef: 'REV-DATA-E2C-001',
  subjectHash: h('a'),
  result: ATTESTATION_RESULT.REJECTED,
});
const heldRejected = packet([rejectedAttestation], { validationPacketId: 'E2C-REJECTED-EXTERNAL-RESULT' });
check(() => assert.strictEqual(heldRejected.status, E2C_STATUS.HOLD_EXTERNAL_VALIDATION_REJECTED));
check(() => assert.strictEqual(heldRejected.blockers.some((x) => x.startsWith('EXTERNAL_VALIDATION_REJECTED:')), true));
check(() => assert.strictEqual(heldRejected.externalReviewAuthenticityValidated, false));

// Inconclusive attestations are valid evidence but never count as VERIFIED.
const inconclusive = signedAttestation({
  id: 'ATT-INCONCLUSIVE-DATA',
  type: VALIDATION_TYPE.REVIEW_EVIDENCE_AUTHENTICITY,
  targetRef: 'REV-DATA-E2C-001',
  subjectHash: h('a'),
  result: ATTESTATION_RESULT.INCONCLUSIVE,
});
const waitingInconclusive = packet([inconclusive], { validationPacketId: 'E2C-INCONCLUSIVE' });
check(() => assert.strictEqual(waitingInconclusive.status, E2C_STATUS.WAITING_FOR_REVIEW_AUTHENTICITY_VALIDATION));
check(() => assert.strictEqual(waitingInconclusive.missingReviewAuthenticity.includes('REV-DATA-E2C-001'), true));

// Self-validation is rejected even with a valid signature and a pinned registry.
const selfRegistryInput = JSON.parse(JSON.stringify(registryInput));
selfRegistryInput.verifiers[0].verifierSubjectRef = 'reviewer-data-e2c';
const selfRegistry = normalizeTrustedVerifierRegistry(selfRegistryInput);
const selfHeld = createExternalAuthorityValidationPacket({
  validationPacketId: 'E2C-SELF-VALIDATION',
  externalEvidenceEnvelope: envelope,
  policy,
  trustedVerifierRegistry: selfRegistryInput,
  expectedTrustedRegistryHashSha256: selfRegistry.registryHashSha256,
  attestations: [reviewAttestations[0]],
  preparedByRef: 'e2c-preparer',
  preparedAt: '2026-09-08T13:40:00+03:00',
});
check(() => assert.strictEqual(selfHeld.status, E2C_STATUS.HOLD_ATTESTATION_INTEGRITY));
check(() => assert.strictEqual(selfHeld.blockers.some((x) => x.startsWith('SELF_VALIDATION_PROHIBITED:')), true));

// Tampered upstream envelope fails closed.
const tamperedEnvelope = JSON.parse(JSON.stringify(envelope));
tamperedEnvelope.reviewEvidence[0].artifactSha256 = h('8');
const heldEnvelope = packet([], { externalEvidenceEnvelope: tamperedEnvelope, validationPacketId: 'E2C-TAMPERED-UPSTREAM' });
check(() => assert.strictEqual(heldEnvelope.status, E2C_STATUS.HOLD_EXTERNAL_EVIDENCE_ENVELOPE));
check(() => assert.strictEqual(heldEnvelope.validationPacketHashSha256, null));
check(() => assert.strictEqual(heldEnvelope.transactionAuthorized, false));

// Completed packet tampering is detectable.
const tamperedPacket = JSON.parse(JSON.stringify(complete));
tamperedPacket.missingReviewerAuthority.push('invented-reviewer');
check(() => assert.strictEqual(verifyExternalAuthorityValidationPacketIntegrity(tamperedPacket), false));

console.log(`E2C_EXTERNAL_AUTHORITY_VALIDATION=PASS checks=${checks}`);
