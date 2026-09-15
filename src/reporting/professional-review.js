'use strict';

const crypto = require('crypto');
const { REPORT_QA_STATUS, verifyProfessionalReportContract } = require('./professional-report-contract');

const REVIEW_LEVEL = Object.freeze({
  INTERNAL_QA: 'INTERNAL_QA',
  PROFESSIONAL_REVIEW: 'PROFESSIONAL_REVIEW',
  INDEPENDENT_REVIEW: 'INDEPENDENT_REVIEW',
});

const FINDING_SEVERITY = Object.freeze({
  CRITICAL: 'CRITICAL',
  MAJOR: 'MAJOR',
  MINOR: 'MINOR',
  OBSERVATION: 'OBSERVATION',
});

const FINDING_STATUS = Object.freeze({
  OPEN: 'OPEN',
  RESOLVED: 'RESOLVED',
});

const REVIEW_DECISION = Object.freeze({
  HOLD: 'HOLD',
  APPROVE_NEXT_CONTROLLED_GATE: 'APPROVE_NEXT_CONTROLLED_GATE',
});

const REVIEW_STATE = Object.freeze({
  OPEN: 'OPEN',
  HOLD_OPEN_FINDINGS: 'HOLD_OPEN_FINDINGS',
  HELD_BY_REVIEWER: 'HELD_BY_REVIEWER',
  READY_FOR_NEXT_CONTROLLED_GATE: 'READY_FOR_NEXT_CONTROLLED_GATE',
});

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

function isoTime(value, field) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return parsed.toISOString();
}

function createReviewFinding(input) {
  const severity = requiredString(input?.severity, 'severity');
  if (!Object.values(FINDING_SEVERITY).includes(severity)) throw new TypeError('severity is invalid');
  const core = {
    findingId: requiredString(input.findingId, 'findingId'),
    topic: requiredString(input.topic, 'topic'),
    severity,
    description: requiredString(input.description, 'description'),
    evidenceRefs: Array.isArray(input.evidenceRefs) ? [...input.evidenceRefs].map((v) => requiredString(v, 'evidenceRef')) : [],
    raisedBy: requiredString(input.raisedBy, 'raisedBy'),
    raisedAt: isoTime(input.raisedAt || Date.now(), 'raisedAt'),
    status: FINDING_STATUS.OPEN,
    resolution: null,
  };
  return deepFreeze({ ...core, findingHashSha256: hashObject(core) });
}

function verifyReviewFinding(finding) {
  if (!finding || typeof finding !== 'object') return deepFreeze({ valid: false, reason: 'FINDING_REQUIRED' });
  const { findingHashSha256, ...core } = finding;
  if (typeof findingHashSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(findingHashSha256)) {
    return deepFreeze({ valid: false, reason: 'FINDING_HASH_INVALID' });
  }
  const computedHash = hashObject(core);
  return deepFreeze({ valid: computedHash === findingHashSha256.toLowerCase(), computedHash });
}

function openFindingsState(findings) {
  const open = findings.filter((finding) => finding.status === FINDING_STATUS.OPEN);
  return open.length > 0 ? REVIEW_STATE.HOLD_OPEN_FINDINGS : REVIEW_STATE.OPEN;
}

function buildSessionCore(input) {
  return {
    schemaVersion: 1,
    reviewId: input.reviewId,
    reviewLevel: input.reviewLevel,
    caseId: input.caseId,
    propertyRef: input.propertyRef,
    reportId: input.reportId,
    reportHashSha256: input.reportHashSha256,
    reviewer: input.reviewer,
    independenceAttestation: input.independenceAttestation,
    independenceEvidenceRefs: input.independenceEvidenceRefs,
    credentialValidationPerformed: false,
    findings: input.findings,
    reviewState: input.reviewState,
    conclusion: input.conclusion,
    startedAt: input.startedAt,
    professionalReviewCompleted: input.professionalReviewCompleted,
    independentReviewCompleted: input.independentReviewCompleted,
    externalIssuanceAuthorized: false,
    certifiedValuationAuthorized: false,
    legalOpinionEstablished: false,
    transactionAuthorized: false,
    reportMutationPerformed: false,
    aiReviewApprovalPermitted: false,
  };
}

function createProfessionalReviewSession(input) {
  if (!input || typeof input !== 'object') throw new TypeError('input is required');
  const report = input.report;
  const reportVerification = verifyProfessionalReportContract(report);
  if (!reportVerification.valid) throw new Error('REVIEW_REPORT_INTEGRITY_FAILURE');
  if (report.qaStatus !== REPORT_QA_STATUS.READY_FOR_INTERNAL_QA) throw new Error('REVIEW_REPORT_NOT_READY_FOR_INTERNAL_QA');

  const reviewLevel = requiredString(input.reviewLevel, 'reviewLevel');
  if (!Object.values(REVIEW_LEVEL).includes(reviewLevel)) throw new TypeError('reviewLevel is invalid');
  const reviewer = {
    partyId: requiredString(input.reviewer?.partyId, 'reviewer.partyId'),
    role: requiredString(input.reviewer?.role, 'reviewer.role'),
    credentialRef: input.reviewer?.credentialRef == null ? null : requiredString(input.reviewer.credentialRef, 'reviewer.credentialRef'),
  };
  const independenceAttestation = input.independenceAttestation === true;
  const independenceEvidenceRefs = Array.isArray(input.independenceEvidenceRefs)
    ? [...input.independenceEvidenceRefs].map((v) => requiredString(v, 'independenceEvidenceRef')) : [];
  if (reviewLevel === REVIEW_LEVEL.INDEPENDENT_REVIEW) {
    if (!independenceAttestation) throw new Error('INDEPENDENT_REVIEW_ATTESTATION_REQUIRED');
    if (reviewer.partyId === report.preparer?.partyId) throw new Error('INDEPENDENT_REVIEWER_CANNOT_BE_PREPARER');
    if (independenceEvidenceRefs.length === 0) throw new Error('INDEPENDENT_REVIEW_EVIDENCE_REQUIRED');
  }

  const findings = Array.isArray(input.findings) ? [...input.findings] : [];
  const findingIds = new Set();
  for (const finding of findings) {
    if (!verifyReviewFinding(finding).valid) throw new Error(`REVIEW_FINDING_INTEGRITY_FAILURE:${finding?.findingId || 'UNKNOWN'}`);
    if (finding.raisedBy !== reviewer.partyId) throw new Error(`REVIEW_FINDING_REVIEWER_MISMATCH:${finding.findingId}`);
    if (findingIds.has(finding.findingId)) throw new Error(`DUPLICATE_REVIEW_FINDING:${finding.findingId}`);
    findingIds.add(finding.findingId);
  }

  const core = buildSessionCore({
    reviewId: requiredString(input.reviewId, 'reviewId'),
    reviewLevel,
    caseId: report.caseId,
    propertyRef: report.propertyRef,
    reportId: report.reportId,
    reportHashSha256: report.reportHashSha256,
    reviewer,
    independenceAttestation,
    independenceEvidenceRefs,
    findings: findings.map((finding) => ({ ...finding })),
    reviewState: openFindingsState(findings),
    conclusion: null,
    startedAt: isoTime(input.startedAt || Date.now(), 'startedAt'),
    professionalReviewCompleted: false,
    independentReviewCompleted: false,
  });
  return deepFreeze({ ...core, reviewHashSha256: hashObject(core) });
}

function verifyProfessionalReviewSession(session) {
  if (!session || typeof session !== 'object') return deepFreeze({ valid: false, reason: 'REVIEW_SESSION_REQUIRED' });
  const { reviewHashSha256, ...core } = session;
  if (typeof reviewHashSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(reviewHashSha256)) {
    return deepFreeze({ valid: false, reason: 'REVIEW_HASH_INVALID' });
  }
  const computedHash = hashObject(core);
  return deepFreeze({ valid: computedHash === reviewHashSha256.toLowerCase(), computedHash });
}

function resolveReviewFinding(input) {
  const session = input?.session;
  if (!verifyProfessionalReviewSession(session).valid) throw new Error('REVIEW_SESSION_INTEGRITY_FAILURE');
  if (session.conclusion) throw new Error('REVIEW_ALREADY_CONCLUDED');
  const findingId = requiredString(input.findingId, 'findingId');
  const index = session.findings.findIndex((finding) => finding.findingId === findingId);
  if (index < 0) throw new Error(`REVIEW_FINDING_NOT_FOUND:${findingId}`);
  const finding = session.findings[index];
  if (finding.status !== FINDING_STATUS.OPEN) throw new Error(`REVIEW_FINDING_ALREADY_RESOLVED:${findingId}`);
  const acceptedByReviewerId = requiredString(input.acceptedByReviewerId, 'acceptedByReviewerId');
  if (acceptedByReviewerId !== session.reviewer.partyId) throw new Error('FINDING_RESOLUTION_REVIEWER_ACCEPTANCE_REQUIRED');
  const resolvedAt = isoTime(input.resolvedAt || Date.now(), 'resolvedAt');
  if (resolvedAt < finding.raisedAt) throw new Error('FINDING_RESOLUTION_BEFORE_RAISED');
  const resolution = {
    resolutionText: requiredString(input.resolutionText, 'resolutionText'),
    resolutionEvidenceRefs: Array.isArray(input.resolutionEvidenceRefs)
      ? [...input.resolutionEvidenceRefs].map((v) => requiredString(v, 'resolutionEvidenceRef')) : [],
    resolvedBy: requiredString(input.resolvedBy, 'resolvedBy'),
    acceptedByReviewerId,
    resolvedAt,
  };
  const resolvedCore = { ...finding, status: FINDING_STATUS.RESOLVED, resolution };
  delete resolvedCore.findingHashSha256;
  const resolvedFinding = { ...resolvedCore, findingHashSha256: hashObject(resolvedCore) };
  const findings = session.findings.map((item, i) => (i === index ? resolvedFinding : { ...item }));
  const core = buildSessionCore({
    ...session,
    findings,
    reviewState: openFindingsState(findings),
    conclusion: null,
    professionalReviewCompleted: false,
    independentReviewCompleted: false,
  });
  return deepFreeze({ ...core, reviewHashSha256: hashObject(core) });
}

function concludeProfessionalReview(input) {
  const session = input?.session;
  if (!verifyProfessionalReviewSession(session).valid) throw new Error('REVIEW_SESSION_INTEGRITY_FAILURE');
  if (session.conclusion) throw new Error('REVIEW_ALREADY_CONCLUDED');
  const decision = requiredString(input.decision, 'decision');
  if (!Object.values(REVIEW_DECISION).includes(decision)) throw new TypeError('decision is invalid');
  const decidedBy = requiredString(input.decidedBy, 'decidedBy');
  if (decidedBy !== session.reviewer.partyId) throw new Error('REVIEW_DECISION_MUST_BE_BY_REVIEWER');
  const decidedAt = isoTime(input.decidedAt || Date.now(), 'decidedAt');
  if (decidedAt < session.startedAt) throw new Error('REVIEW_DECISION_BEFORE_START');
  const openFindings = session.findings.filter((finding) => finding.status === FINDING_STATUS.OPEN);
  if (decision === REVIEW_DECISION.APPROVE_NEXT_CONTROLLED_GATE && openFindings.length > 0) {
    throw new Error('OPEN_REVIEW_FINDINGS_BLOCK_APPROVAL');
  }
  const conclusion = {
    decision,
    rationale: requiredString(input.rationale, 'rationale'),
    evidenceRefs: Array.isArray(input.evidenceRefs) ? [...input.evidenceRefs].map((v) => requiredString(v, 'decision evidenceRef')) : [],
    decidedBy,
    decidedAt,
  };
  const approved = decision === REVIEW_DECISION.APPROVE_NEXT_CONTROLLED_GATE;
  const core = buildSessionCore({
    ...session,
    findings: session.findings.map((finding) => ({ ...finding })),
    reviewState: approved ? REVIEW_STATE.READY_FOR_NEXT_CONTROLLED_GATE : REVIEW_STATE.HELD_BY_REVIEWER,
    conclusion,
    professionalReviewCompleted: approved,
    independentReviewCompleted: approved && session.reviewLevel === REVIEW_LEVEL.INDEPENDENT_REVIEW,
  });
  return deepFreeze({ ...core, reviewHashSha256: hashObject(core) });
}

module.exports = {
  REVIEW_LEVEL,
  FINDING_SEVERITY,
  FINDING_STATUS,
  REVIEW_DECISION,
  REVIEW_STATE,
  createReviewFinding,
  verifyReviewFinding,
  createProfessionalReviewSession,
  verifyProfessionalReviewSession,
  resolveReviewFinding,
  concludeProfessionalReview,
};
