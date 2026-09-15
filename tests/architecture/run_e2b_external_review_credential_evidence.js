'use strict';

const assert = require('assert');
const requirements = require('../../governance/e2b-external-review-evidence-requirements-2026-09-08.json');
const matrix = require('../../governance/saudi-legal-professional-applicability-candidates-2026-09-08.json');
const valuationEvidence = require('../../governance/official-valuation-standards-source-evidence-2026-09-08.json');
const saudiEvidence = require('../../governance/official-saudi-regulatory-source-evidence-2026-09-08.json');
const contextEvidence = require('../../governance/saudi-regulatory-context-source-evidence-2026-09-08.json');
const phase2Evidence = require('../../governance/official-standards-and-licensing-source-evidence-phase2-2026-09-08.json');
const {
  createSaudiApplicabilityReviewPacket,
  verifyApplicabilityPacketIntegrity,
} = require('../../src/standards/saudi-legal-professional-applicability');
const {
  E2B_STATUS,
  validateRequirements,
  normalizeReviewEvidence,
  normalizeCredentialEvidence,
  requiredClassesForCandidate,
  createExternalReviewCredentialEvidenceEnvelope,
  verifyExternalEvidenceEnvelopeIntegrity,
} = require('../../src/standards/external-review-credential-evidence');

let checks = 0;
function check(fn) { fn(); checks += 1; }

const registers = [valuationEvidence, saudiEvidence, contextEvidence, phase2Evidence];
const h = (char) => char.repeat(64);

check(() => assert.strictEqual(requirements.requirementsId, 'STARTAK-E2B-EXTERNAL-REVIEW-CREDENTIAL-EVIDENCE-REQUIREMENTS-2026-09-08'));
check(() => assert.strictEqual(requirements.operatingMode, 'UNLICENSED_DECISION_SUPPORT'));
check(() => assert.strictEqual(requirements.status, 'EVIDENCE_INTAKE_REQUIREMENTS_DEFINED'));
check(() => assert.strictEqual(requirements.maximumInternalStatus, 'READY_FOR_EXTERNAL_AUTHORITY_VALIDATION'));
check(() => assert.strictEqual(requirements.credentialEvidenceRequiredForEveryReviewer, true));
check(() => assert.strictEqual(requirements.evidenceTruthAutoValidationAllowed, false));
check(() => assert.strictEqual(requirements.credentialAuthenticityAutoValidationAllowed, false));
check(() => assert.strictEqual(requirements.reviewerAuthorityAutoValidationAllowed, false));
check(() => assert.strictEqual(requirements.automaticRuleActivationAllowed, false));
check(() => assert.strictEqual(validateRequirements(requirements), true));

const candidateById = new Map(matrix.candidates.map((candidate) => [candidate.candidateId, candidate]));
check(() => assert.deepStrictEqual(requiredClassesForCandidate(candidateById.get('E2-ZATCA-RETT-009'), requirements), ['TAX_REVIEW', 'LEGAL_REVIEW']));
check(() => assert.deepStrictEqual(requiredClassesForCandidate(candidateById.get('E2-SDAIA-PDPL-010'), requirements), ['DATA_GOVERNANCE_REVIEW', 'LEGAL_REVIEW']));
check(() => assert.deepStrictEqual(requiredClassesForCandidate(candidateById.get('E2-APPRAISAL-INSTITUTE-REFERENCE-015'), requirements), ['REFERENCE_CONFIRMATION']));

const context = {
  serviceModel: 'INTERNAL_DECISION_SUPPORT',
  professionalValuationRequested: false,
  professionalReportRequested: false,
  capitalMarketsContext: null,
  financingRegulatoryContext: null,
  collateralValuationContext: false,
  financialReportingPurpose: false,
  reportingFramework: null,
  transactionContext: 'REAL_ESTATE_TRANSFER',
  personalDataProcessed: true,
  crossBorderPersonalDataProcessing: false,
  realEstateContributionContext: false,
  measurementStandardRequested: null,
  costFrameworkRequested: null,
  comparativeProfessionalReference: null,
  ricsContextRequested: false,
};

const applicabilityPacket = createSaudiApplicabilityReviewPacket({
  reviewPacketId: 'E2B-SOURCE-PACKET',
  caseContext: context,
  candidateMatrix: matrix,
  evidenceRegisters: registers,
  preparedByRef: 'internal-engineering-review',
  preparedAt: '2026-09-08T13:00:00+03:00',
});
check(() => assert.strictEqual(verifyApplicabilityPacketIntegrity(applicabilityPacket), true));
check(() => assert.strictEqual(applicabilityPacket.triggeredCandidates.length, 2));
check(() => assert.strictEqual(applicabilityPacket.triggeredCandidates.some((x) => x.candidateId === 'E2-ZATCA-RETT-009'), true));
check(() => assert.strictEqual(applicabilityPacket.triggeredCandidates.some((x) => x.candidateId === 'E2-SDAIA-PDPL-010'), true));

const waitingReviews = createExternalReviewCredentialEvidenceEnvelope({
  envelopeId: 'E2B-ENVELOPE-EMPTY',
  applicabilityPacket,
  requirements,
  reviewEvidence: [],
  credentialEvidence: [],
  preparedByRef: 'e2b-preparer',
  preparedAt: '2026-09-08T13:20:00+03:00',
});
check(() => assert.strictEqual(waitingReviews.status, E2B_STATUS.WAITING_FOR_EXTERNAL_REVIEW_EVIDENCE));
check(() => assert.strictEqual(waitingReviews.reviewEvidenceCompletenessEstablished, false));
check(() => assert.strictEqual(waitingReviews.credentialEvidenceCompletenessEstablished, false));
check(() => assert.strictEqual(waitingReviews.missingReviewEvidence.length, 4));
check(() => assert.strictEqual(waitingReviews.missingReviewEvidence.includes('E2-ZATCA-RETT-009:TAX_REVIEW'), true));
check(() => assert.strictEqual(waitingReviews.missingReviewEvidence.includes('E2-ZATCA-RETT-009:LEGAL_REVIEW'), true));
check(() => assert.strictEqual(waitingReviews.missingReviewEvidence.includes('E2-SDAIA-PDPL-010:DATA_GOVERNANCE_REVIEW'), true));
check(() => assert.strictEqual(waitingReviews.missingReviewEvidence.includes('E2-SDAIA-PDPL-010:LEGAL_REVIEW'), true));
check(() => assert.strictEqual(verifyExternalEvidenceEnvelopeIntegrity(waitingReviews), true));

const reviewEvidence = [
  {
    evidenceId: 'REV-TAX-001',
    candidateId: 'E2-ZATCA-RETT-009',
    evidenceClass: 'TAX_REVIEW',
    reviewerRef: 'reviewer-tax-001',
    issuerOrFirmRef: 'tax-firm-001',
    artifactId: 'tax-review-artifact',
    artifactSha256: h('a'),
    scopeRef: 'scope-zatca-rett',
    issuedAt: '2026-09-08T13:01:00+03:00',
    receivedAt: '2026-09-08T13:05:00+03:00',
    reviewerIndependenceClaim: true,
  },
  {
    evidenceId: 'REV-LEGAL-RETT-001',
    candidateId: 'E2-ZATCA-RETT-009',
    evidenceClass: 'LEGAL_REVIEW',
    reviewerRef: 'reviewer-legal-001',
    issuerOrFirmRef: 'legal-firm-001',
    artifactId: 'legal-rett-artifact',
    artifactSha256: h('b'),
    scopeRef: 'scope-zatca-rett-legal',
    issuedAt: '2026-09-08T13:02:00+03:00',
    receivedAt: '2026-09-08T13:06:00+03:00',
    reviewerIndependenceClaim: true,
  },
  {
    evidenceId: 'REV-DATA-001',
    candidateId: 'E2-SDAIA-PDPL-010',
    evidenceClass: 'DATA_GOVERNANCE_REVIEW',
    reviewerRef: 'reviewer-data-001',
    issuerOrFirmRef: 'data-firm-001',
    artifactId: 'data-review-artifact',
    artifactSha256: h('c'),
    scopeRef: 'scope-pdpl-data',
    issuedAt: '2026-09-08T13:03:00+03:00',
    receivedAt: '2026-09-08T13:07:00+03:00',
    reviewerIndependenceClaim: true,
  },
  {
    evidenceId: 'REV-LEGAL-PDPL-001',
    candidateId: 'E2-SDAIA-PDPL-010',
    evidenceClass: 'LEGAL_REVIEW',
    reviewerRef: 'reviewer-legal-001',
    issuerOrFirmRef: 'legal-firm-001',
    artifactId: 'legal-pdpl-artifact',
    artifactSha256: h('d'),
    scopeRef: 'scope-pdpl-legal',
    issuedAt: '2026-09-08T13:04:00+03:00',
    receivedAt: '2026-09-08T13:08:00+03:00',
    reviewerIndependenceClaim: true,
  },
];

const normalizedReview = normalizeReviewEvidence(reviewEvidence[0], requirements);
check(() => assert.strictEqual(normalizedReview.artifactSha256, h('a')));
check(() => assert.strictEqual(normalizedReview.externalTruthValidated, false));
check(() => assert.strictEqual(normalizedReview.reviewerAuthorityValidated, false));
check(() => assert.strictEqual(/^[a-f0-9]{64}$/.test(normalizedReview.evidenceRecordHashSha256), true));

const waitingCredentials = createExternalReviewCredentialEvidenceEnvelope({
  envelopeId: 'E2B-ENVELOPE-REVIEWS',
  applicabilityPacket,
  requirements,
  reviewEvidence,
  credentialEvidence: [],
  preparedByRef: 'e2b-preparer',
  preparedAt: '2026-09-08T13:20:00+03:00',
});
check(() => assert.strictEqual(waitingCredentials.status, E2B_STATUS.WAITING_FOR_CREDENTIAL_EVIDENCE));
check(() => assert.strictEqual(waitingCredentials.reviewEvidenceCompletenessEstablished, true));
check(() => assert.strictEqual(waitingCredentials.credentialEvidenceCompletenessEstablished, false));
check(() => assert.deepStrictEqual(new Set(waitingCredentials.missingCredentialEvidenceForReviewers), new Set(['reviewer-tax-001', 'reviewer-legal-001', 'reviewer-data-001'])));
check(() => assert.strictEqual(verifyExternalEvidenceEnvelopeIntegrity(waitingCredentials), true));

const credentials = [
  {
    credentialEvidenceId: 'CRED-TAX-001',
    subjectReviewerRef: 'reviewer-tax-001',
    authorityRef: 'external-tax-authority-or-professional-register',
    credentialClass: 'TAX_REVIEWER_CREDENTIAL_EVIDENCE',
    artifactId: 'cred-tax-artifact',
    artifactSha256: h('e'),
    observedAt: '2026-09-08T13:09:00+03:00',
    verificationSourceRef: 'external-verification-source-tax',
    claimedValidFrom: '2026-01-01T00:00:00+03:00',
    claimedValidUntil: '2026-12-31T23:59:59+03:00'
  },
  {
    credentialEvidenceId: 'CRED-LEGAL-001',
    subjectReviewerRef: 'reviewer-legal-001',
    authorityRef: 'external-legal-authority-or-register',
    credentialClass: 'SAUDI_LEGAL_REVIEWER_CREDENTIAL_EVIDENCE',
    artifactId: 'cred-legal-artifact',
    artifactSha256: h('f'),
    observedAt: '2026-09-08T13:10:00+03:00',
    verificationSourceRef: 'external-verification-source-legal'
  },
  {
    credentialEvidenceId: 'CRED-DATA-001',
    subjectReviewerRef: 'reviewer-data-001',
    authorityRef: 'external-data-governance-professional-evidence',
    credentialClass: 'DATA_GOVERNANCE_REVIEWER_CREDENTIAL_EVIDENCE',
    artifactId: 'cred-data-artifact',
    artifactSha256: h('1'),
    observedAt: '2026-09-08T13:11:00+03:00',
    verificationSourceRef: 'external-verification-source-data'
  },
];

const normalizedCredential = normalizeCredentialEvidence(credentials[0], requirements);
check(() => assert.strictEqual(normalizedCredential.artifactSha256, h('e')));
check(() => assert.strictEqual(normalizedCredential.credentialAuthenticityValidated, false));
check(() => assert.strictEqual(normalizedCredential.reviewerAuthorityValidated, false));
check(() => assert.strictEqual(/^[a-f0-9]{64}$/.test(normalizedCredential.credentialRecordHashSha256), true));

const ready = createExternalReviewCredentialEvidenceEnvelope({
  envelopeId: 'E2B-ENVELOPE-READY',
  applicabilityPacket,
  requirements,
  reviewEvidence,
  credentialEvidence: credentials,
  preparedByRef: 'e2b-preparer',
  preparedAt: '2026-09-08T13:20:00+03:00',
});
check(() => assert.strictEqual(ready.status, E2B_STATUS.READY_FOR_EXTERNAL_AUTHORITY_VALIDATION));
check(() => assert.strictEqual(ready.reviewEvidenceCompletenessEstablished, true));
check(() => assert.strictEqual(ready.credentialEvidenceCompletenessEstablished, true));
check(() => assert.strictEqual(ready.missingReviewEvidence.length, 0));
check(() => assert.strictEqual(ready.missingCredentialEvidenceForReviewers.length, 0));
check(() => assert.strictEqual(ready.reviewEvidence.length, 4));
check(() => assert.strictEqual(ready.credentialEvidence.length, 3));
check(() => assert.strictEqual(verifyExternalEvidenceEnvelopeIntegrity(ready), true));
check(() => assert.strictEqual(ready.externalAuthorityValidationRequired, true));
check(() => assert.strictEqual(ready.externalReviewAuthenticityValidated, false));
check(() => assert.strictEqual(ready.credentialAuthenticityValidated, false));
check(() => assert.strictEqual(ready.reviewerAuthorityValidated, false));
check(() => assert.strictEqual(ready.reviewerCredentialsVerified, false));
check(() => assert.strictEqual(ready.reviewerIndependenceVerified, false));
check(() => assert.strictEqual(ready.legalConclusionEstablished, false));
check(() => assert.strictEqual(ready.professionalApplicabilityEstablished, false));
check(() => assert.strictEqual(ready.formalStandardsConformanceEstablished, false));
check(() => assert.strictEqual(ready.saudiProfessionalLicensingEstablished, false));
check(() => assert.strictEqual(ready.pdplComplianceEstablished, false));
check(() => assert.strictEqual(ready.taxComplianceEstablished, false));
check(() => assert.strictEqual(ready.financialReportingComplianceEstablished, false));
check(() => assert.strictEqual(ready.certifiedValuationAuthorityEstablished, false));
check(() => assert.strictEqual(ready.externalIssuanceAuthorized, false));
check(() => assert.strictEqual(ready.releaseAuthorized, false));
check(() => assert.strictEqual(ready.mergeAuthorized, false));
check(() => assert.strictEqual(ready.deploymentAuthorized, false));
check(() => assert.strictEqual(ready.transactionAuthorized, false));

// Tampering is detected.
const tampered = JSON.parse(JSON.stringify(ready));
tampered.reviewEvidence[0].artifactSha256 = h('9');
check(() => assert.strictEqual(verifyExternalEvidenceEnvelopeIntegrity(tampered), false));

// Invalid applicability packet fails closed.
const badApplicability = JSON.parse(JSON.stringify(applicabilityPacket));
badApplicability.caseContext.personalDataProcessed = false;
const heldApplicability = createExternalReviewCredentialEvidenceEnvelope({
  envelopeId: 'E2B-HOLD-APPLICABILITY',
  applicabilityPacket: badApplicability,
  requirements,
  reviewEvidence,
  credentialEvidence: credentials,
  preparedByRef: 'e2b-preparer',
  preparedAt: '2026-09-08T13:20:00+03:00',
});
check(() => assert.strictEqual(heldApplicability.status, E2B_STATUS.HOLD_APPLICABILITY_PACKET));
check(() => assert.strictEqual(heldApplicability.blockers.includes('E2_APPLICABILITY_PACKET_NOT_QUALIFIED'), true));
check(() => assert.strictEqual(heldApplicability.envelopeHashSha256, null));
check(() => assert.strictEqual(heldApplicability.transactionAuthorized, false));

// Malformed artifact hashes fail closed.
const malformedReview = JSON.parse(JSON.stringify(reviewEvidence));
malformedReview[0].artifactSha256 = 'not-a-hash';
const heldHash = createExternalReviewCredentialEvidenceEnvelope({
  envelopeId: 'E2B-HOLD-HASH',
  applicabilityPacket,
  requirements,
  reviewEvidence: malformedReview,
  credentialEvidence: credentials,
  preparedByRef: 'e2b-preparer',
  preparedAt: '2026-09-08T13:20:00+03:00',
});
check(() => assert.strictEqual(heldHash.status, E2B_STATUS.HOLD_EVIDENCE_INTEGRITY));
check(() => assert.strictEqual(heldHash.blockers.some((x) => x.includes('SHA-256')), true));

// Duplicate evidence IDs fail closed.
const duplicateReview = [...reviewEvidence, { ...reviewEvidence[0] }];
const heldDuplicate = createExternalReviewCredentialEvidenceEnvelope({
  envelopeId: 'E2B-HOLD-DUPLICATE',
  applicabilityPacket,
  requirements,
  reviewEvidence: duplicateReview,
  credentialEvidence: credentials,
  preparedByRef: 'e2b-preparer',
  preparedAt: '2026-09-08T13:20:00+03:00',
});
check(() => assert.strictEqual(heldDuplicate.status, E2B_STATUS.HOLD_EVIDENCE_INTEGRITY));
check(() => assert.strictEqual(heldDuplicate.blockers.some((x) => x.startsWith('DUPLICATE_REVIEW_EVIDENCE_ID:')), true));

// Evidence for a non-triggered candidate fails closed.
const wrongCandidateReview = [...reviewEvidence, {
  evidenceId: 'REV-WRONG-001',
  candidateId: 'E2-CMA-REAL-ESTATE-FUND-005',
  evidenceClass: 'LEGAL_REVIEW',
  reviewerRef: 'reviewer-legal-001',
  issuerOrFirmRef: 'legal-firm-001',
  artifactId: 'wrong-artifact',
  artifactSha256: h('2'),
  scopeRef: 'wrong-scope',
  issuedAt: '2026-09-08T13:01:00+03:00',
  receivedAt: '2026-09-08T13:02:00+03:00'
}];
const heldWrongCandidate = createExternalReviewCredentialEvidenceEnvelope({
  envelopeId: 'E2B-HOLD-WRONG-CANDIDATE',
  applicabilityPacket,
  requirements,
  reviewEvidence: wrongCandidateReview,
  credentialEvidence: credentials,
  preparedByRef: 'e2b-preparer',
  preparedAt: '2026-09-08T13:20:00+03:00',
});
check(() => assert.strictEqual(heldWrongCandidate.status, E2B_STATUS.HOLD_EVIDENCE_INTEGRITY));
check(() => assert.strictEqual(heldWrongCandidate.blockers.some((x) => x.startsWith('REVIEW_EVIDENCE_FOR_NON_TRIGGERED_CANDIDATE:')), true));

// Evidence chronology fails closed.
const futureReview = JSON.parse(JSON.stringify(reviewEvidence));
futureReview[0].receivedAt = '2026-09-08T14:00:00+03:00';
const heldFuture = createExternalReviewCredentialEvidenceEnvelope({
  envelopeId: 'E2B-HOLD-FUTURE',
  applicabilityPacket,
  requirements,
  reviewEvidence: futureReview,
  credentialEvidence: credentials,
  preparedByRef: 'e2b-preparer',
  preparedAt: '2026-09-08T13:20:00+03:00',
});
check(() => assert.strictEqual(heldFuture.status, E2B_STATUS.HOLD_EVIDENCE_INTEGRITY));
check(() => assert.strictEqual(heldFuture.blockers.some((x) => x.startsWith('REVIEW_EVIDENCE_RECEIVED_AFTER_ENVELOPE_PREPARATION:')), true));

// Invalid credential validity range fails closed.
const badCredentials = JSON.parse(JSON.stringify(credentials));
badCredentials[0].claimedValidFrom = '2027-01-01T00:00:00+03:00';
badCredentials[0].claimedValidUntil = '2026-01-01T00:00:00+03:00';
const heldCredential = createExternalReviewCredentialEvidenceEnvelope({
  envelopeId: 'E2B-HOLD-CREDENTIAL',
  applicabilityPacket,
  requirements,
  reviewEvidence,
  credentialEvidence: badCredentials,
  preparedByRef: 'e2b-preparer',
  preparedAt: '2026-09-08T13:20:00+03:00',
});
check(() => assert.strictEqual(heldCredential.status, E2B_STATUS.HOLD_EVIDENCE_INTEGRITY));
check(() => assert.strictEqual(heldCredential.blockers.some((x) => x.startsWith('CREDENTIAL_VALIDITY_RANGE_INVALID:')), true));

// Requirements cannot self-grant authority.
const unsafeRequirements = JSON.parse(JSON.stringify(requirements));
unsafeRequirements.reviewerAuthorityAutoValidationAllowed = true;
check(() => assert.throws(() => validateRequirements(unsafeRequirements), /E2B_AUTHORITY_FLAG_MUST_REMAIN_FALSE/));

const serialized = JSON.stringify({ requirements, ready, heldApplicability, heldHash, heldDuplicate, heldWrongCandidate, heldFuture, heldCredential });
check(() => assert.strictEqual(serialized.includes('"reviewerCredentialsVerified":true'), false));
check(() => assert.strictEqual(serialized.includes('"reviewerAuthorityValidated":true'), false));
check(() => assert.strictEqual(serialized.includes('"legalConclusionEstablished":true'), false));
check(() => assert.strictEqual(serialized.includes('"formalStandardsConformanceEstablished":true'), false));
check(() => assert.strictEqual(serialized.includes('"mergeAuthorized":true'), false));
check(() => assert.strictEqual(serialized.includes('"deploymentAuthorized":true'), false));
check(() => assert.strictEqual(serialized.includes('"transactionAuthorized":true'), false));

console.log(`E2B_EXTERNAL_REVIEW_CREDENTIAL_EVIDENCE=PASS checks=${checks}`);
