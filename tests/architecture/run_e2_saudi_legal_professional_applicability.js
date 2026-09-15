'use strict';

const assert = require('assert');
const matrix = require('../../governance/saudi-legal-professional-applicability-candidates-2026-09-08.json');
const valuationEvidence = require('../../governance/official-valuation-standards-source-evidence-2026-09-08.json');
const saudiEvidence = require('../../governance/official-saudi-regulatory-source-evidence-2026-09-08.json');
const contextEvidence = require('../../governance/saudi-regulatory-context-source-evidence-2026-09-08.json');
const phase2Evidence = require('../../governance/official-standards-and-licensing-source-evidence-phase2-2026-09-08.json');
const {
  APPLICABILITY_PACKET_STATUS,
  REVIEW_DISPOSITION,
  conditionMatches,
  candidateTriggered,
  buildEvidenceIndex,
  validateCandidateMatrix,
  createSaudiApplicabilityReviewPacket,
  verifyApplicabilityPacketIntegrity,
  recordHumanReviewDisposition,
} = require('../../src/standards/saudi-legal-professional-applicability');

let checks = 0;
function check(fn) { fn(); checks += 1; }

const registers = [valuationEvidence, saudiEvidence, contextEvidence, phase2Evidence];
const evidenceIndex = buildEvidenceIndex(registers);

check(() => assert.strictEqual(matrix.matrixId, 'STARTAK-E2-SAUDI-LEGAL-PROFESSIONAL-APPLICABILITY-CANDIDATES-2026-09-08'));
check(() => assert.strictEqual(matrix.operatingMode, 'UNLICENSED_DECISION_SUPPORT'));
check(() => assert.strictEqual(matrix.status, 'CANDIDATE_MATRIX_READY_FOR_SAUDI_LEGAL_PROFESSIONAL_REVIEW'));
check(() => assert.strictEqual(matrix.sourceConvergenceHead, 'b8601d14c8acb914839f7cc293d8be14f81bd592'));
check(() => assert.strictEqual(matrix.candidates.length, 16));
check(() => assert.strictEqual(matrix.candidates.every((x) => x.candidateState === 'UNDER_REVIEW'), true));
check(() => assert.strictEqual(matrix.candidates.every((x) => x.activationAuthorized === false), true));
check(() => assert.strictEqual(matrix.automaticApplicabilityConclusionAllowed, false));
check(() => assert.strictEqual(matrix.automaticLegalConclusionAllowed, false));
check(() => assert.strictEqual(matrix.automaticProfessionalConclusionAllowed, false));
check(() => assert.strictEqual(matrix.automaticRuleActivationAllowed, false));

check(() => assert.strictEqual(evidenceIndex.size, 4));
check(() => assert.strictEqual(evidenceIndex.get(valuationEvidence.evidenceRegisterId).has('IVSC-IVS-2025-EFFECTIVE'), true));
check(() => assert.strictEqual(evidenceIndex.get(saudiEvidence.evidenceRegisterId).has('REGA-REAL-ESTATE-BROKERAGE-LAW-ACTIVE'), true));
check(() => assert.strictEqual(evidenceIndex.get(contextEvidence.evidenceRegisterId).has('SAMA-COLLATERAL-VALUATION-2026-01-11'), true));
check(() => assert.strictEqual(evidenceIndex.get(phase2Evidence.evidenceRegisterId).has('TAQEEM-PROFESSIONAL-LICENSE-ISSUANCE-CURRENT'), true));

const matrixValidation = validateCandidateMatrix(matrix, evidenceIndex);
check(() => assert.strictEqual(matrixValidation.valid, true));
check(() => assert.deepStrictEqual(matrixValidation.blockers, []));

check(() => assert.strictEqual(conditionMatches({ a: true }, { field: 'a', equals: true }), true));
check(() => assert.strictEqual(conditionMatches({ a: 'X' }, { field: 'a', in: ['X', 'Y'] }), true));
check(() => assert.strictEqual(conditionMatches({ a: 'Z' }, { field: 'a', in: ['X', 'Y'] }), false));
check(() => assert.strictEqual(candidateTriggered({ serviceModel: 'BROKERAGE' }, matrix.candidates[0]), true));
check(() => assert.strictEqual(candidateTriggered({ serviceModel: 'INTERNAL_DECISION_SUPPORT' }, matrix.candidates[0]), false));

const noTriggerContext = {
  serviceModel: 'INTERNAL_DECISION_SUPPORT',
  professionalValuationRequested: false,
  professionalReportRequested: false,
  capitalMarketsContext: null,
  financingRegulatoryContext: null,
  collateralValuationContext: false,
  financialReportingPurpose: false,
  reportingFramework: null,
  transactionContext: null,
  personalDataProcessed: false,
  crossBorderPersonalDataProcessing: false,
  realEstateContributionContext: false,
  measurementStandardRequested: null,
  costFrameworkRequested: null,
  comparativeProfessionalReference: null,
  ricsContextRequested: false,
};

const noTriggerPacket = createSaudiApplicabilityReviewPacket({
  reviewPacketId: 'E2-PACKET-NONE',
  caseContext: noTriggerContext,
  candidateMatrix: matrix,
  evidenceRegisters: registers,
  preparedByRef: 'internal-engineering-review',
  preparedAt: '2026-09-08T12:50:00+03:00',
});
check(() => assert.strictEqual(noTriggerPacket.status, APPLICABILITY_PACKET_STATUS.NO_APPLICABILITY_CANDIDATES_TRIGGERED));
check(() => assert.strictEqual(noTriggerPacket.triggeredCandidates.length, 0));
check(() => assert.strictEqual(verifyApplicabilityPacketIntegrity(noTriggerPacket), true));
check(() => assert.strictEqual(noTriggerPacket.automaticApplicabilityConclusionPerformed, false));
check(() => assert.strictEqual(noTriggerPacket.legalConclusionEstablished, false));
check(() => assert.strictEqual(noTriggerPacket.professionalApplicabilityEstablished, false));
check(() => assert.strictEqual(noTriggerPacket.mergeAuthorized, false));
check(() => assert.strictEqual(noTriggerPacket.deploymentAuthorized, false));
check(() => assert.strictEqual(noTriggerPacket.transactionAuthorized, false));

const allTriggerContext = {
  serviceModel: 'REAL_ESTATE_SERVICE',
  professionalValuationRequested: true,
  professionalReportRequested: true,
  capitalMarketsContext: 'CMA_REAL_ESTATE_FUND',
  financingRegulatoryContext: 'SAMA_SUPERVISED_ENTITY',
  collateralValuationContext: true,
  financialReportingPurpose: true,
  reportingFramework: 'IFRS_13',
  transactionContext: 'REAL_ESTATE_TRANSFER',
  personalDataProcessed: true,
  crossBorderPersonalDataProcessing: true,
  realEstateContributionContext: true,
  measurementStandardRequested: 'IPMS_ALL_BUILDINGS',
  costFrameworkRequested: 'ICMS_3',
  comparativeProfessionalReference: 'APPRAISAL_INSTITUTE',
  ricsContextRequested: true,
};

const allPacket = createSaudiApplicabilityReviewPacket({
  reviewPacketId: 'E2-PACKET-ALL',
  caseContext: allTriggerContext,
  candidateMatrix: matrix,
  evidenceRegisters: registers,
  preparedByRef: 'internal-engineering-review',
  preparedAt: '2026-09-08T12:51:00+03:00',
});
check(() => assert.strictEqual(allPacket.status, APPLICABILITY_PACKET_STATUS.READY_FOR_SAUDI_LEGAL_PROFESSIONAL_REVIEW));
check(() => assert.strictEqual(allPacket.triggeredCandidates.length, 16));
check(() => assert.strictEqual(new Set(allPacket.triggeredCandidates.map((x) => x.candidateId)).size, 16));
check(() => assert.strictEqual(allPacket.triggeredCandidates.every((x) => x.activationAuthorized === false), true));
check(() => assert.strictEqual(allPacket.triggeredCandidates.every((x) => x.reviewDisposition === null), true));
check(() => assert.strictEqual(allPacket.triggeredCandidates.every((x) => x.externalAuthorityValidated === false), true));
check(() => assert.strictEqual(verifyApplicabilityPacketIntegrity(allPacket), true));
check(() => assert.strictEqual(allPacket.humanSaudiLegalReviewRequired, true));
check(() => assert.strictEqual(allPacket.humanProfessionalReviewRequired, true));
check(() => assert.strictEqual(allPacket.humanAccountingReviewRequired, true));
check(() => assert.strictEqual(allPacket.humanTaxReviewRequired, true));
check(() => assert.strictEqual(allPacket.humanDataGovernanceReviewRequired, true));
check(() => assert.strictEqual(allPacket.externalAuthorityValidationRequired, true));
check(() => assert.strictEqual(allPacket.automaticLegalConclusionPerformed, false));
check(() => assert.strictEqual(allPacket.automaticProfessionalConclusionPerformed, false));
check(() => assert.strictEqual(allPacket.standardsOrRulesActivated, false));
check(() => assert.strictEqual(allPacket.formalStandardsConformanceEstablished, false));
check(() => assert.strictEqual(allPacket.saudiProfessionalLicensingEstablished, false));
check(() => assert.strictEqual(allPacket.reviewerCredentialsVerified, false));
check(() => assert.strictEqual(allPacket.pdplComplianceEstablished, false));
check(() => assert.strictEqual(allPacket.taxComplianceEstablished, false));
check(() => assert.strictEqual(allPacket.financialReportingComplianceEstablished, false));
check(() => assert.strictEqual(allPacket.certifiedValuationAuthorityEstablished, false));
check(() => assert.strictEqual(allPacket.externalIssuanceAuthorized, false));
check(() => assert.strictEqual(allPacket.releaseAuthorized, false));
check(() => assert.strictEqual(allPacket.mergeAuthorized, false));
check(() => assert.strictEqual(allPacket.deploymentAuthorized, false));
check(() => assert.strictEqual(allPacket.transactionAuthorized, false));

const expectedIds = [
  'E2-REGA-SERVICE-LICENSING-001',
  'E2-TAQEEM-PROFESSIONAL-VALUATION-002',
  'E2-IVS-TAQEEM-STANDARDS-003',
  'E2-TAQEEM-REPORT-QA-004',
  'E2-CMA-REAL-ESTATE-FUND-005',
  'E2-SAMA-SUPERVISED-VALUATION-006',
  'E2-SAMA-COLLATERAL-007',
  'E2-SOCPA-IFRS13-008',
  'E2-ZATCA-RETT-009',
  'E2-SDAIA-PDPL-010',
  'E2-SDAIA-CROSS-BORDER-011',
  'E2-REGA-CONTRIBUTIONS-012',
  'E2-IPMS-MEASUREMENT-013',
  'E2-ICMS-COST-014',
  'E2-APPRAISAL-INSTITUTE-REFERENCE-015',
  'E2-RICS-REFERENCE-016',
];
expectedIds.forEach((id) => check(() => assert.strictEqual(allPacket.triggeredCandidates.some((x) => x.candidateId === id), true)));

// A single-context human disposition remains evidence only and cannot create authority.
const contributionOnlyContext = { ...noTriggerContext, realEstateContributionContext: true };
const contributionPacket = createSaudiApplicabilityReviewPacket({
  reviewPacketId: 'E2-PACKET-CONTRIBUTION',
  caseContext: contributionOnlyContext,
  candidateMatrix: matrix,
  evidenceRegisters: registers,
  preparedByRef: 'internal-engineering-review',
  preparedAt: '2026-09-08T12:52:00+03:00',
});
check(() => assert.strictEqual(contributionPacket.triggeredCandidates.length, 1));
check(() => assert.strictEqual(contributionPacket.triggeredCandidates[0].candidateId, 'E2-REGA-CONTRIBUTIONS-012'));
const contributionReviewed = recordHumanReviewDisposition(contributionPacket, {
  candidateId: 'E2-REGA-CONTRIBUTIONS-012',
  disposition: REVIEW_DISPOSITION.CONDITIONAL,
  reviewerRef: 'external-reviewer-claim-001',
  reviewerAuthorityClaim: 'SAUDI_LEGAL_AND_PROFESSIONAL_REVIEWER',
  evidenceRef: 'review-evidence-placeholder-001',
  reviewedAt: '2026-09-08T13:00:00+03:00',
});
check(() => assert.strictEqual(contributionReviewed.status, APPLICABILITY_PACKET_STATUS.HUMAN_REVIEW_DISPOSITIONS_RECORDED_PENDING_AUTHORITY_VALIDATION));
check(() => assert.strictEqual(contributionReviewed.humanReviewDispositionRecorded, true));
check(() => assert.strictEqual(contributionReviewed.allTriggeredCandidateDispositionsRecorded, true));
check(() => assert.strictEqual(contributionReviewed.reviewerAuthorityClaimVerified, false));
check(() => assert.strictEqual(contributionReviewed.triggeredCandidates[0].reviewDisposition, REVIEW_DISPOSITION.CONDITIONAL));
check(() => assert.strictEqual(contributionReviewed.triggeredCandidates[0].externalAuthorityValidated, false));
check(() => assert.strictEqual(contributionReviewed.triggeredCandidates[0].activationAuthorized, false));
check(() => assert.strictEqual(verifyApplicabilityPacketIntegrity(contributionReviewed), true));
check(() => assert.strictEqual(contributionReviewed.legalConclusionEstablished, false));
check(() => assert.strictEqual(contributionReviewed.professionalApplicabilityEstablished, false));
check(() => assert.strictEqual(contributionReviewed.mergeAuthorized, false));
check(() => assert.strictEqual(contributionReviewed.deploymentAuthorized, false));
check(() => assert.strictEqual(contributionReviewed.transactionAuthorized, false));

// Missing/tampered evidence fails closed.
const incompleteRegisters = registers.filter((x) => x.evidenceRegisterId !== phase2Evidence.evidenceRegisterId);
const held = createSaudiApplicabilityReviewPacket({
  reviewPacketId: 'E2-PACKET-HELD',
  caseContext: allTriggerContext,
  candidateMatrix: matrix,
  evidenceRegisters: incompleteRegisters,
  preparedByRef: 'internal-engineering-review',
  preparedAt: '2026-09-08T12:55:00+03:00',
});
check(() => assert.strictEqual(held.status, APPLICABILITY_PACKET_STATUS.HOLD_SOURCE_EVIDENCE));
check(() => assert.strictEqual(held.blockers.some((x) => x.startsWith('SOURCE_REGISTER_NOT_FOUND:')), true));
check(() => assert.strictEqual(held.triggeredCandidates.length, 0));
check(() => assert.strictEqual(held.packetHashSha256, null));
check(() => assert.strictEqual(held.legalConclusionEstablished, false));
check(() => assert.strictEqual(held.transactionAuthorized, false));

const unsafeMatrix = JSON.parse(JSON.stringify(matrix));
unsafeMatrix.candidates[0].activationAuthorized = true;
const unsafeValidation = validateCandidateMatrix(unsafeMatrix, evidenceIndex);
check(() => assert.strictEqual(unsafeValidation.valid, false));
check(() => assert.strictEqual(unsafeValidation.blockers.some((x) => x.startsWith('CANDIDATE_ACTIVATION_MUST_BE_FALSE:')), true));

const tamperedPacket = JSON.parse(JSON.stringify(allPacket));
tamperedPacket.caseContext.transactionContext = null;
check(() => assert.strictEqual(verifyApplicabilityPacketIntegrity(tamperedPacket), false));

check(() => assert.throws(() => recordHumanReviewDisposition(contributionPacket, {
  candidateId: 'E2-REGA-CONTRIBUTIONS-012',
  disposition: REVIEW_DISPOSITION.APPLICABLE,
  reviewerRef: 'reviewer',
  reviewerAuthorityClaim: 'claim',
  evidenceRef: 'evidence',
  reviewedAt: '2026-09-08T12:00:00+03:00',
}), /REVIEW_BEFORE_PACKET_PREPARATION/));

check(() => assert.throws(() => recordHumanReviewDisposition(contributionPacket, {
  candidateId: 'E2-CMA-REAL-ESTATE-FUND-005',
  disposition: REVIEW_DISPOSITION.HOLD,
  reviewerRef: 'reviewer',
  reviewerAuthorityClaim: 'claim',
  evidenceRef: 'evidence',
  reviewedAt: '2026-09-08T13:00:00+03:00',
}), /CANDIDATE_NOT_TRIGGERED/));

// No evidence or candidate layer may silently establish authority.
const serialized = JSON.stringify({ matrix, allPacket, contributionReviewed, held });
check(() => assert.strictEqual(serialized.includes('"activationAuthorized":true'), false));
check(() => assert.strictEqual(serialized.includes('"legalConclusionEstablished":true'), false));
check(() => assert.strictEqual(serialized.includes('"professionalApplicabilityEstablished":true'), false));
check(() => assert.strictEqual(serialized.includes('"mergeAuthorized":true'), false));
check(() => assert.strictEqual(serialized.includes('"deploymentAuthorized":true'), false));
check(() => assert.strictEqual(serialized.includes('"transactionAuthorized":true'), false));

console.log(`E2_SAUDI_LEGAL_PROFESSIONAL_APPLICABILITY=PASS checks=${checks}`);
