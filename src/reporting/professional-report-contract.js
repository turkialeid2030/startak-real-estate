'use strict';

const crypto = require('crypto');
const { verifyStandardsSnapshot } = require('../standards');
const { ASSIGNMENT_STATE } = require('../valuation-assignment');

const REPORT_TYPE = Object.freeze({
  INTERNAL_VALUATION_DRAFT: 'INTERNAL_VALUATION_DRAFT',
  PROFESSIONAL_VALUATION_DRAFT: 'PROFESSIONAL_VALUATION_DRAFT',
  FINANCIAL_REPORTING_HANDOFF: 'FINANCIAL_REPORTING_HANDOFF',
});

const REPORT_QA_STATUS = Object.freeze({
  REPORT_BLOCKED: 'REPORT_BLOCKED',
  READY_FOR_INTERNAL_QA: 'READY_FOR_INTERNAL_QA',
});

const METHOD_DISPOSITION = Object.freeze({
  USED: 'USED',
  NOT_USED: 'NOT_USED',
});

const UNCERTAINTY_STATUS = Object.freeze({
  NONE_IDENTIFIED: 'NONE_IDENTIFIED',
  MATERIAL_UNCERTAINTY: 'MATERIAL_UNCERTAINTY',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
});

const ARTIFACT_TYPE = Object.freeze({
  PROPERTY_EVIDENCE_PACKET: 'PROPERTY_EVIDENCE_PACKET',
  INSPECTION_PACKET: 'INSPECTION_PACKET',
  MEASUREMENT_PACKET: 'MEASUREMENT_PACKET',
  PLANNING_HBU_PACKET: 'PLANNING_HBU_PACKET',
  MARKET_EVIDENCE_PACKET: 'MARKET_EVIDENCE_PACKET',
  LEASE_INCOME_PACKET: 'LEASE_INCOME_PACKET',
  METHOD_INPUT_PACKET: 'METHOD_INPUT_PACKET',
  ESG_PACKET: 'ESG_PACKET',
  COST_APPROACH_RESULT: 'COST_APPROACH_RESULT',
  LAND_VALUATION_RESULT: 'LAND_VALUATION_RESULT',
  DEVELOPMENT_RESULT: 'DEVELOPMENT_RESULT',
  INCOME_NOI_RESULT: 'INCOME_NOI_RESULT',
  DIRECT_CAP_RESULT: 'DIRECT_CAP_RESULT',
  DCF_RESULT: 'DCF_RESULT',
  SPECIALIZED_ASSET_PACKET: 'SPECIALIZED_ASSET_PACKET',
  FINANCIAL_REPORTING_DISCLOSURE_PACKET: 'FINANCIAL_REPORTING_DISCLOSURE_PACKET',
  OTHER: 'OTHER',
});

const TAQEEM_REPORT_QA_STATUS = 'UNDER_REVIEW_OFFICIAL_SOURCE_VERIFICATION_REQUIRED';
const OPERATING_MODE = 'UNLICENSED_DECISION_SUPPORT';

function canonicalize(value) {
  if (value === null || value === undefined) return value === undefined ? null : value;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((acc, key) => {
    acc[key] = canonicalize(value[key]);
    return acc;
  }, {});
}

function hashObject(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} is required`);
  return value.trim();
}

function assertSha(value, field) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new TypeError(`${field} must be a 64-character SHA-256 hex digest`);
  }
  return value.toLowerCase();
}

function realIsoDate(value, field) {
  requiredString(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError(`${field} must be YYYY-MM-DD`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new TypeError(`${field} must be a real ISO date`);
  }
  return value;
}

function isoTime(value, field) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return parsed.toISOString();
}

function createReportArtifactReference(input) {
  const artifactType = requiredString(input?.artifactType, 'artifactType');
  if (!Object.values(ARTIFACT_TYPE).includes(artifactType)) throw new TypeError('artifactType is invalid');
  const core = {
    referenceId: requiredString(input.referenceId, 'referenceId'),
    artifactType,
    artifactId: requiredString(input.artifactId, 'artifactId'),
    artifactHashSha256: assertSha(input.artifactHashSha256, 'artifactHashSha256'),
    caseId: requiredString(input.caseId, 'caseId'),
    propertyRef: requiredString(input.propertyRef, 'propertyRef'),
    asOfDate: realIsoDate(input.asOfDate, 'asOfDate'),
    evidenceRefs: Array.isArray(input.evidenceRefs) ? [...input.evidenceRefs].map((v) => requiredString(v, 'evidenceRef')) : [],
  };
  return deepFreeze({ ...core, referenceHashSha256: hashObject(core) });
}

function verifyReportArtifactReference(reference) {
  if (!reference || typeof reference !== 'object') return deepFreeze({ valid: false, reason: 'REFERENCE_REQUIRED' });
  const { referenceHashSha256, ...core } = reference;
  try {
    const expected = assertSha(referenceHashSha256, 'referenceHashSha256');
    return deepFreeze({ valid: hashObject(core) === expected, reason: hashObject(core) === expected ? null : 'REFERENCE_HASH_MISMATCH' });
  } catch (error) {
    return deepFreeze({ valid: false, reason: 'REFERENCE_HASH_INVALID' });
  }
}

function normalizeMethodAssessment(row, artifactIds) {
  const methodCode = requiredString(row?.methodCode, 'methodCode');
  const disposition = requiredString(row?.disposition, 'disposition');
  if (!Object.values(METHOD_DISPOSITION).includes(disposition)) throw new TypeError('method disposition is invalid');
  const rationale = requiredString(row.rationale, 'method rationale');
  const resultReferenceId = row.resultReferenceId == null ? null : requiredString(row.resultReferenceId, 'resultReferenceId');
  if (disposition === METHOD_DISPOSITION.USED && !resultReferenceId) throw new TypeError('USED method requires resultReferenceId');
  if (disposition === METHOD_DISPOSITION.NOT_USED && resultReferenceId) throw new TypeError('NOT_USED method cannot carry resultReferenceId');
  if (resultReferenceId && !artifactIds.has(resultReferenceId)) throw new TypeError(`UNKNOWN_METHOD_RESULT_REFERENCE:${resultReferenceId}`);
  return deepFreeze({ methodCode, disposition, rationale, resultReferenceId });
}

function normalizeUncertainty(value) {
  if (!value || typeof value !== 'object') return null;
  const status = requiredString(value.status, 'uncertainty.status');
  if (!Object.values(UNCERTAINTY_STATUS).includes(status)) throw new TypeError('uncertainty.status is invalid');
  return deepFreeze({
    status,
    rationale: requiredString(value.rationale, 'uncertainty.rationale'),
    evidenceRefs: Array.isArray(value.evidenceRefs) ? [...value.evidenceRefs].map((v) => requiredString(v, 'uncertainty evidenceRef')) : [],
  });
}

function normalizePerson(value, field) {
  if (!value || typeof value !== 'object') return null;
  return deepFreeze({
    partyId: requiredString(value.partyId, `${field}.partyId`),
    role: requiredString(value.role, `${field}.role`),
    credentialRef: value.credentialRef == null ? null : requiredString(value.credentialRef, `${field}.credentialRef`),
  });
}

function computeCriticalGaps({
  artifactReferences,
  requiredArtifactTypes,
  methodAssessments,
  uncertaintyDisclosure,
  preparer,
  reviewer,
  reportType,
}) {
  const gaps = [];
  const presentTypes = new Set(artifactReferences.map((r) => r.artifactType));
  for (const type of requiredArtifactTypes) {
    if (!presentTypes.has(type)) gaps.push(`MISSING_REQUIRED_ARTIFACT:${type}`);
  }
  if (methodAssessments.length === 0) gaps.push('METHODS_CONSIDERED_REQUIRED');
  if (!methodAssessments.some((m) => m.disposition === METHOD_DISPOSITION.USED)) gaps.push('AT_LEAST_ONE_USED_METHOD_REQUIRED');
  if (!uncertaintyDisclosure) gaps.push('UNCERTAINTY_DISCLOSURE_REQUIRED');
  if (!preparer) gaps.push('PREPARER_REQUIRED');
  if (!reviewer) gaps.push('REVIEWER_REQUIRED');
  if (reportType === REPORT_TYPE.FINANCIAL_REPORTING_HANDOFF
      && !presentTypes.has(ARTIFACT_TYPE.FINANCIAL_REPORTING_DISCLOSURE_PACKET)) {
    gaps.push('FINANCIAL_REPORTING_DISCLOSURE_PACKET_REQUIRED');
  }
  return gaps.sort();
}

function createProfessionalReportContract(input) {
  if (!input || typeof input !== 'object') throw new TypeError('input is required');
  const reportType = requiredString(input.reportType, 'reportType');
  if (!Object.values(REPORT_TYPE).includes(reportType)) throw new TypeError('reportType is invalid');
  const caseId = requiredString(input.caseId, 'caseId');
  const propertyRef = requiredString(input.propertyRef, 'propertyRef');
  const reportDate = realIsoDate(input.reportDate, 'reportDate');

  const assignment = input.assignment;
  if (!assignment || typeof assignment !== 'object') throw new TypeError('assignment is required');
  if (assignment.assignmentState !== ASSIGNMENT_STATE.AUTHORIZED_FOR_ANALYSIS) {
    throw new Error('REPORT_ASSIGNMENT_NOT_AUTHORIZED_FOR_ANALYSIS');
  }
  if (assignment.caseId !== caseId) throw new Error('REPORT_ASSIGNMENT_CASE_MISMATCH');
  realIsoDate(assignment.valuationDate, 'assignment.valuationDate');
  if (reportDate < assignment.valuationDate) throw new Error('REPORT_DATE_BEFORE_VALUATION_DATE');

  const standardsSnapshot = input.standardsSnapshot;
  if (!standardsSnapshot || typeof standardsSnapshot !== 'object') throw new TypeError('standardsSnapshot is required');
  if (typeof input.standardsHashFn !== 'function') throw new TypeError('standardsHashFn is required');
  const snapshotVerification = verifyStandardsSnapshot(standardsSnapshot, input.standardsHashFn);
  if (!snapshotVerification.valid) throw new Error('REPORT_STANDARDS_SNAPSHOT_INTEGRITY_FAILURE');
  if (standardsSnapshot.valuationDate && standardsSnapshot.valuationDate !== assignment.valuationDate) {
    throw new Error('REPORT_STANDARDS_SNAPSHOT_VALUATION_DATE_MISMATCH');
  }

  const artifactReferences = Array.isArray(input.artifactReferences) ? [...input.artifactReferences] : [];
  const refIds = new Set();
  for (const ref of artifactReferences) {
    if (!verifyReportArtifactReference(ref).valid) throw new Error(`REPORT_ARTIFACT_REFERENCE_INTEGRITY_FAILURE:${ref?.referenceId || 'UNKNOWN'}`);
    if (ref.caseId !== caseId || ref.propertyRef !== propertyRef) throw new Error(`REPORT_ARTIFACT_SCOPE_MISMATCH:${ref.referenceId}`);
    if (refIds.has(ref.referenceId)) throw new Error(`DUPLICATE_REPORT_ARTIFACT_REFERENCE:${ref.referenceId}`);
    refIds.add(ref.referenceId);
  }

  const requiredArtifactTypes = Array.isArray(input.requiredArtifactTypes) ? [...new Set(input.requiredArtifactTypes)] : [];
  for (const type of requiredArtifactTypes) {
    if (!Object.values(ARTIFACT_TYPE).includes(type)) throw new TypeError(`requiredArtifactType is invalid: ${type}`);
  }

  const methodAssessments = (Array.isArray(input.methodAssessments) ? input.methodAssessments : [])
    .map((row) => normalizeMethodAssessment(row, refIds));
  const methodCodes = new Set();
  for (const row of methodAssessments) {
    if (methodCodes.has(row.methodCode)) throw new Error(`DUPLICATE_METHOD_ASSESSMENT:${row.methodCode}`);
    methodCodes.add(row.methodCode);
  }

  const assumptions = Array.isArray(input.assumptions) ? [...input.assumptions].map((v) => requiredString(v, 'assumption')) : [];
  const specialAssumptions = Array.isArray(input.specialAssumptions) ? [...input.specialAssumptions].map((v) => requiredString(v, 'specialAssumption')) : [];
  const limitations = Array.isArray(input.limitations) ? [...input.limitations].map((v) => requiredString(v, 'limitation')) : [];
  const uncertaintyDisclosure = normalizeUncertainty(input.uncertaintyDisclosure);
  const preparer = normalizePerson(input.preparer, 'preparer');
  const reviewer = normalizePerson(input.reviewer, 'reviewer');

  const criticalGaps = computeCriticalGaps({
    artifactReferences,
    requiredArtifactTypes,
    methodAssessments,
    uncertaintyDisclosure,
    preparer,
    reviewer,
    reportType,
  });

  const core = {
    schemaVersion: 1,
    reportId: requiredString(input.reportId, 'reportId'),
    reportVersion: requiredString(input.reportVersion, 'reportVersion'),
    reportType,
    caseId,
    propertyRef,
    engagementId: requiredString(assignment.engagementId, 'assignment.engagementId'),
    purposeCode: requiredString(assignment.purposeCode, 'assignment.purposeCode'),
    intendedUseCode: requiredString(assignment.intendedUseCode, 'assignment.intendedUseCode'),
    basisOfValueCode: requiredString(assignment.basisOfValueCode, 'assignment.basisOfValueCode'),
    valuedPropertyInterestId: requiredString(assignment.valuedPropertyInterestId, 'assignment.valuedPropertyInterestId'),
    valuationDate: assignment.valuationDate,
    reportDate,
    assignmentState: assignment.assignmentState,
    standardsSnapshotId: requiredString(standardsSnapshot.standardsSnapshotId, 'standardsSnapshot.standardsSnapshotId'),
    standardsSnapshotHash: assertSha(standardsSnapshot.snapshotHash, 'standardsSnapshot.snapshotHash'),
    artifactReferences: artifactReferences.map((r) => ({ ...r })),
    requiredArtifactTypes,
    methodAssessments: methodAssessments.map((m) => ({ ...m })),
    assumptions,
    specialAssumptions,
    limitations,
    uncertaintyDisclosure,
    preparer,
    reviewer,
    criticalGaps,
    qaStatus: criticalGaps.length === 0 ? REPORT_QA_STATUS.READY_FOR_INTERNAL_QA : REPORT_QA_STATUS.REPORT_BLOCKED,
    taqeemReportQaStatus: TAQEEM_REPORT_QA_STATUS,
    taqeemConformanceClaimEstablished: false,
    ivsConformanceClaimEstablished: false,
    ricsConformanceClaimEstablished: false,
    credentialValidationPerformed: false,
    professionalReviewerApprovalEstablished: false,
    operatingMode: OPERATING_MODE,
    professionalValuationAuthorized: false,
    certifiedValuationAuthorized: false,
    externalIssuanceAuthorized: false,
    legalOpinionEstablished: false,
    transactionAuthorized: false,
    canonicalValuationArithmeticPerformed: false,
    aiGeneratedProfessionalConclusion: false,
    createdAt: isoTime(input.createdAt || Date.now(), 'createdAt'),
  };
  return deepFreeze({ ...core, reportHashSha256: hashObject(core) });
}

function verifyProfessionalReportContract(report) {
  if (!report || typeof report !== 'object') return deepFreeze({ valid: false, reason: 'REPORT_REQUIRED' });
  const { reportHashSha256, ...core } = report;
  try {
    const expected = assertSha(reportHashSha256, 'reportHashSha256');
    const computed = hashObject(core);
    return deepFreeze({ valid: computed === expected, expectedHash: expected, computedHash: computed });
  } catch (error) {
    return deepFreeze({ valid: false, reason: 'REPORT_HASH_INVALID' });
  }
}

function assessProfessionalReportQa(report) {
  const integrity = verifyProfessionalReportContract(report);
  if (!integrity.valid) {
    return deepFreeze({
      qaStatus: REPORT_QA_STATUS.REPORT_BLOCKED,
      blockingCodes: ['REPORT_INTEGRITY_FAILURE'],
      externalIssuanceAuthorized: false,
      certifiedValuationAuthorized: false,
      transactionAuthorized: false,
    });
  }
  return deepFreeze({
    qaStatus: report.criticalGaps.length === 0 ? REPORT_QA_STATUS.READY_FOR_INTERNAL_QA : REPORT_QA_STATUS.REPORT_BLOCKED,
    blockingCodes: [...report.criticalGaps],
    taqeemReportQaStatus: TAQEEM_REPORT_QA_STATUS,
    professionalReviewRequired: true,
    externalIssuanceAuthorized: false,
    certifiedValuationAuthorized: false,
    legalOpinionEstablished: false,
    transactionAuthorized: false,
  });
}

module.exports = {
  REPORT_TYPE,
  REPORT_QA_STATUS,
  METHOD_DISPOSITION,
  UNCERTAINTY_STATUS,
  ARTIFACT_TYPE,
  TAQEEM_REPORT_QA_STATUS,
  createReportArtifactReference,
  verifyReportArtifactReference,
  createProfessionalReportContract,
  verifyProfessionalReportContract,
  assessProfessionalReportQa,
};
