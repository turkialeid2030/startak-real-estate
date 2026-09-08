'use strict';

const { sha256 } = require('./standards-registry');

const APPLICABILITY_PACKET_STATUS = Object.freeze({
  HOLD_SOURCE_EVIDENCE: 'HOLD_SOURCE_EVIDENCE',
  NO_APPLICABILITY_CANDIDATES_TRIGGERED: 'NO_APPLICABILITY_CANDIDATES_TRIGGERED',
  READY_FOR_SAUDI_LEGAL_PROFESSIONAL_REVIEW: 'READY_FOR_SAUDI_LEGAL_PROFESSIONAL_REVIEW',
  HUMAN_REVIEW_DISPOSITIONS_RECORDED_PENDING_AUTHORITY_VALIDATION: 'HUMAN_REVIEW_DISPOSITIONS_RECORDED_PENDING_AUTHORITY_VALIDATION',
});

const REVIEW_DISPOSITION = Object.freeze({
  APPLICABLE: 'APPLICABLE',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  CONDITIONAL: 'CONDITIONAL',
  HOLD: 'HOLD',
});

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertNonEmpty(value, field) {
  if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`);
}

function iso(value, field) {
  assertNonEmpty(value, field);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return parsed.toISOString();
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function getPath(obj, field) {
  return String(field).split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function conditionMatches(context, condition) {
  if (!condition || typeof condition !== 'object') throw new TypeError('trigger condition must be an object');
  assertNonEmpty(condition.field, 'condition.field');
  const value = getPath(context, condition.field);
  const hasEquals = Object.prototype.hasOwnProperty.call(condition, 'equals');
  const hasIn = Object.prototype.hasOwnProperty.call(condition, 'in');
  if (hasEquals === hasIn) throw new TypeError(`condition for ${condition.field} must specify exactly one of equals or in`);
  if (hasEquals) return value === condition.equals;
  if (!Array.isArray(condition.in) || condition.in.length === 0) throw new TypeError(`condition.in for ${condition.field} must be a non-empty array`);
  return condition.in.includes(value);
}

function candidateTriggered(context, candidate) {
  const all = candidate?.trigger?.all;
  if (!Array.isArray(all) || all.length === 0) throw new TypeError(`candidate ${candidate?.candidateId || 'UNKNOWN'} trigger.all must be non-empty`);
  return all.every((condition) => conditionMatches(context, condition));
}

function buildEvidenceIndex(registers) {
  if (!Array.isArray(registers)) throw new TypeError('registers must be an array');
  const index = new Map();
  for (const register of registers) {
    assertNonEmpty(register?.evidenceRegisterId, 'register.evidenceRegisterId');
    if (index.has(register.evidenceRegisterId)) throw new TypeError(`DUPLICATE_EVIDENCE_REGISTER:${register.evidenceRegisterId}`);
    const ids = new Set();
    if (!Array.isArray(register.records)) throw new TypeError(`register.records must be an array:${register.evidenceRegisterId}`);
    for (const record of register.records) {
      assertNonEmpty(record?.recordId, 'record.recordId');
      if (ids.has(record.recordId)) throw new TypeError(`DUPLICATE_EVIDENCE_RECORD:${register.evidenceRegisterId}:${record.recordId}`);
      ids.add(record.recordId);
    }
    index.set(register.evidenceRegisterId, ids);
  }
  return index;
}

function validateCandidateMatrix(matrix, evidenceIndex) {
  if (!matrix || typeof matrix !== 'object') throw new TypeError('candidateMatrix must be an object');
  assertNonEmpty(matrix.matrixId, 'candidateMatrix.matrixId');
  if (matrix.operatingMode !== 'UNLICENSED_DECISION_SUPPORT') throw new TypeError('E2_OPERATING_MODE_MUST_REMAIN_UNLICENSED_DECISION_SUPPORT');
  if (!Array.isArray(matrix.candidates) || matrix.candidates.length === 0) throw new TypeError('candidateMatrix.candidates must be non-empty');
  if (!(evidenceIndex instanceof Map)) throw new TypeError('evidenceIndex must be a Map');

  const blockers = [];
  const seenCandidates = new Set();
  for (const candidate of matrix.candidates) {
    assertNonEmpty(candidate?.candidateId, 'candidate.candidateId');
    assertNonEmpty(candidate?.domain, 'candidate.domain');
    assertNonEmpty(candidate?.reviewClass, 'candidate.reviewClass');
    assertNonEmpty(candidate?.questionForReviewer, 'candidate.questionForReviewer');
    assertNonEmpty(candidate?.nonConclusion, 'candidate.nonConclusion');
    if (seenCandidates.has(candidate.candidateId)) blockers.push(`DUPLICATE_CANDIDATE:${candidate.candidateId}`);
    seenCandidates.add(candidate.candidateId);
    if (candidate.candidateState !== 'UNDER_REVIEW') blockers.push(`CANDIDATE_NOT_UNDER_REVIEW:${candidate.candidateId}:${candidate.candidateState}`);
    if (candidate.activationAuthorized !== false) blockers.push(`CANDIDATE_ACTIVATION_MUST_BE_FALSE:${candidate.candidateId}`);
    candidateTriggered({}, candidate); // validates trigger schema without asserting a match
    if (!Array.isArray(candidate.sourceEvidenceRefs) || candidate.sourceEvidenceRefs.length === 0) {
      blockers.push(`SOURCE_EVIDENCE_REQUIRED:${candidate.candidateId}`);
      continue;
    }
    for (const ref of candidate.sourceEvidenceRefs) {
      const registerRecords = evidenceIndex.get(ref?.registerId);
      if (!registerRecords) {
        blockers.push(`SOURCE_REGISTER_NOT_FOUND:${candidate.candidateId}:${ref?.registerId || 'MISSING'}`);
        continue;
      }
      if (!registerRecords.has(ref.recordId)) blockers.push(`SOURCE_RECORD_NOT_FOUND:${candidate.candidateId}:${ref.registerId}:${ref.recordId || 'MISSING'}`);
    }
  }

  const boundary = matrix.authorityBoundary || {};
  for (const [key, value] of Object.entries(boundary)) {
    if (value !== false) blockers.push(`AUTHORITY_BOUNDARY_MUST_REMAIN_FALSE:${key}`);
  }
  for (const field of [
    'automaticApplicabilityConclusionAllowed',
    'automaticLegalConclusionAllowed',
    'automaticProfessionalConclusionAllowed',
    'automaticRuleActivationAllowed',
  ]) {
    if (matrix[field] !== false) blockers.push(`AUTOMATION_AUTHORITY_MUST_REMAIN_FALSE:${field}`);
  }

  return deepFreeze({ valid: blockers.length === 0, blockers: Object.freeze(blockers) });
}

function authorityBoundary() {
  return deepFreeze({
    automaticApplicabilityConclusionPerformed: false,
    automaticLegalConclusionPerformed: false,
    automaticProfessionalConclusionPerformed: false,
    standardsOrRulesActivated: false,
    legalConclusionEstablished: false,
    professionalApplicabilityEstablished: false,
    formalStandardsConformanceEstablished: false,
    saudiProfessionalLicensingEstablished: false,
    reviewerCredentialsVerified: false,
    reviewerIndependenceVerified: false,
    pdplComplianceEstablished: false,
    taxComplianceEstablished: false,
    financialReportingComplianceEstablished: false,
    certifiedValuationAuthorityEstablished: false,
    externalIssuanceAuthorized: false,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    transactionAuthorized: false,
  });
}

function hold(packetId, matrixId, blockers, preparedByRef, preparedAtIso) {
  return deepFreeze({
    schemaVersion: 1,
    reviewPacketId: packetId,
    matrixId,
    status: APPLICABILITY_PACKET_STATUS.HOLD_SOURCE_EVIDENCE,
    blockers: Object.freeze([...blockers]),
    triggeredCandidates: Object.freeze([]),
    preparedByRef,
    preparedAt: preparedAtIso,
    packetHashSha256: null,
    ...authorityBoundary(),
  });
}

function createSaudiApplicabilityReviewPacket({
  reviewPacketId,
  caseContext,
  candidateMatrix,
  evidenceRegisters,
  preparedByRef,
  preparedAt,
} = {}) {
  assertNonEmpty(reviewPacketId, 'reviewPacketId');
  assertNonEmpty(preparedByRef, 'preparedByRef');
  if (!caseContext || typeof caseContext !== 'object' || Array.isArray(caseContext)) throw new TypeError('caseContext must be an object');
  const preparedAtIso = iso(preparedAt, 'preparedAt');
  const evidenceIndex = buildEvidenceIndex(evidenceRegisters);
  const validation = validateCandidateMatrix(candidateMatrix, evidenceIndex);
  if (!validation.valid) return hold(reviewPacketId.trim(), candidateMatrix?.matrixId || null, validation.blockers, preparedByRef.trim(), preparedAtIso);

  const triggered = candidateMatrix.candidates
    .filter((candidate) => candidateTriggered(caseContext, candidate))
    .map((candidate) => deepFreeze({
      candidateId: candidate.candidateId,
      domain: candidate.domain,
      reviewClass: candidate.reviewClass,
      candidateState: candidate.candidateState,
      sourceEvidenceRefs: candidate.sourceEvidenceRefs,
      questionForReviewer: candidate.questionForReviewer,
      nonConclusion: candidate.nonConclusion,
      activationAuthorized: false,
      reviewDisposition: null,
      humanReviewEvidenceRef: null,
      externalAuthorityValidated: false,
    }));

  const core = {
    schemaVersion: 1,
    reviewPacketId: reviewPacketId.trim(),
    matrixId: candidateMatrix.matrixId,
    sourceConvergenceHead: candidateMatrix.sourceConvergenceHead || null,
    caseContext,
    triggeredCandidates: triggered,
    preparedByRef: preparedByRef.trim(),
    preparedAt: preparedAtIso,
  };
  const status = triggered.length === 0
    ? APPLICABILITY_PACKET_STATUS.NO_APPLICABILITY_CANDIDATES_TRIGGERED
    : APPLICABILITY_PACKET_STATUS.READY_FOR_SAUDI_LEGAL_PROFESSIONAL_REVIEW;

  return deepFreeze({
    ...core,
    status,
    blockers: Object.freeze([]),
    packetHashSha256: sha256(core),
    humanSaudiLegalReviewRequired: triggered.some((candidate) => candidate.reviewClass.includes('LEGAL')),
    humanProfessionalReviewRequired: triggered.some((candidate) => candidate.reviewClass.includes('PROFESSIONAL')),
    humanAccountingReviewRequired: triggered.some((candidate) => candidate.reviewClass.includes('ACCOUNTING')),
    humanTaxReviewRequired: triggered.some((candidate) => candidate.reviewClass.includes('TAX')),
    humanDataGovernanceReviewRequired: triggered.some((candidate) => candidate.reviewClass.includes('DATA')),
    externalAuthorityValidationRequired: triggered.length > 0,
    ...authorityBoundary(),
    semantics: 'E2 creates deterministic source-backed applicability candidates for human Saudi legal/professional review. A triggered candidate is a review question, not a legal conclusion, professional opinion, compliance claim, credential validation, standards activation, certified valuation or transaction authority.',
  });
}

function verifyApplicabilityPacketIntegrity(packet) {
  if (!packet || packet.status === APPLICABILITY_PACKET_STATUS.HOLD_SOURCE_EVIDENCE) return false;
  if (!/^[a-f0-9]{64}$/i.test(String(packet.packetHashSha256 || ''))) return false;
  const core = {
    schemaVersion: packet.schemaVersion,
    reviewPacketId: packet.reviewPacketId,
    matrixId: packet.matrixId,
    sourceConvergenceHead: packet.sourceConvergenceHead,
    caseContext: packet.caseContext,
    triggeredCandidates: packet.triggeredCandidates,
    preparedByRef: packet.preparedByRef,
    preparedAt: packet.preparedAt,
  };
  return sha256(core) === packet.packetHashSha256.toLowerCase();
}

function recordHumanReviewDisposition(packet, {
  candidateId,
  disposition,
  reviewerRef,
  reviewerAuthorityClaim,
  evidenceRef,
  reviewedAt,
} = {}) {
  if (!verifyApplicabilityPacketIntegrity(packet)) throw new TypeError('APPLICABILITY_PACKET_INTEGRITY_FAILED');
  assertNonEmpty(candidateId, 'candidateId');
  assertNonEmpty(reviewerRef, 'reviewerRef');
  assertNonEmpty(reviewerAuthorityClaim, 'reviewerAuthorityClaim');
  assertNonEmpty(evidenceRef, 'evidenceRef');
  if (!Object.values(REVIEW_DISPOSITION).includes(disposition)) throw new TypeError('review disposition is invalid');
  const reviewedAtIso = iso(reviewedAt, 'reviewedAt');
  if (Date.parse(reviewedAtIso) < Date.parse(packet.preparedAt)) throw new TypeError('REVIEW_BEFORE_PACKET_PREPARATION');
  const found = packet.triggeredCandidates.find((candidate) => candidate.candidateId === candidateId);
  if (!found) throw new TypeError(`CANDIDATE_NOT_TRIGGERED:${candidateId}`);

  const updatedCandidates = packet.triggeredCandidates.map((candidate) => candidate.candidateId === candidateId
    ? deepFreeze({
      ...candidate,
      reviewDisposition: disposition,
      reviewerRef: reviewerRef.trim(),
      reviewerAuthorityClaim: reviewerAuthorityClaim.trim(),
      humanReviewEvidenceRef: evidenceRef.trim(),
      reviewedAt: reviewedAtIso,
      externalAuthorityValidated: false,
      activationAuthorized: false,
    })
    : candidate);

  const core = {
    schemaVersion: packet.schemaVersion,
    reviewPacketId: packet.reviewPacketId,
    matrixId: packet.matrixId,
    sourceConvergenceHead: packet.sourceConvergenceHead,
    caseContext: packet.caseContext,
    triggeredCandidates: updatedCandidates,
    preparedByRef: packet.preparedByRef,
    preparedAt: packet.preparedAt,
  };
  const allRecorded = updatedCandidates.every((candidate) => candidate.reviewDisposition !== null);

  return deepFreeze({
    ...core,
    status: allRecorded
      ? APPLICABILITY_PACKET_STATUS.HUMAN_REVIEW_DISPOSITIONS_RECORDED_PENDING_AUTHORITY_VALIDATION
      : APPLICABILITY_PACKET_STATUS.READY_FOR_SAUDI_LEGAL_PROFESSIONAL_REVIEW,
    blockers: Object.freeze([]),
    packetHashSha256: sha256(core),
    humanReviewDispositionRecorded: true,
    allTriggeredCandidateDispositionsRecorded: allRecorded,
    externalAuthorityValidationRequired: true,
    reviewerAuthorityClaimVerified: false,
    ...authorityBoundary(),
    semantics: 'A human review disposition has been recorded as evidence only. The system does not verify the reviewer authority claim, transform the disposition into a legal conclusion, activate a rule, establish professional licensing or authorize production/transaction activity.',
  });
}

module.exports = {
  APPLICABILITY_PACKET_STATUS,
  REVIEW_DISPOSITION,
  conditionMatches,
  candidateTriggered,
  buildEvidenceIndex,
  validateCandidateMatrix,
  createSaudiApplicabilityReviewPacket,
  verifyApplicabilityPacketIntegrity,
  recordHumanReviewDisposition,
};
