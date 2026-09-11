'use strict';

const assert = require('assert');
const crypto = require('crypto');
const { createStandardsSnapshot } = require('../../src/standards');
const { ASSIGNMENT_STATE } = require('../../src/valuation-assignment');
const {
  REPORT_TYPE,
  REPORT_QA_STATUS,
  METHOD_DISPOSITION,
  UNCERTAINTY_STATUS,
  ARTIFACT_TYPE,
  createReportArtifactReference,
  createProfessionalReportContract,
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
} = require('../../src/reporting');

let checks = 0;
function check(fn) { fn(); checks += 1; }
function sha(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }

const assignment = {
  assignmentState: ASSIGNMENT_STATE.AUTHORIZED_FOR_ANALYSIS,
  caseId: 'CASE-W15B',
  valuationDate: '2026-09-01',
  engagementId: 'ENG-W15B',
  purposeCode: 'MARKET_VALUE',
  intendedUseCode: 'INTERNAL_DECISION_SUPPORT',
  basisOfValueCode: 'MARKET_VALUE',
  valuedPropertyInterestId: 'PI-W15B',
};
const snapshot = createStandardsSnapshot({
  standardsSnapshotId: 'SNAP-W15B', snapshotVersion: '1', createdAt: '2026-09-08T00:00:00Z', hashFn: sha,
  routerVersion: 'W7A_PURPOSE_ROUTER_V1', routerInputHash: sha('router'), standardRefs: [], ruleRefs: [], activationApprovalRefs: [],
  valuationDate: '2026-09-01', reportDate: '2026-09-08', engagementDate: '2026-09-07',
});
function ref(id, type) {
  return createReportArtifactReference({
    referenceId: id, artifactType: type, artifactId: `ART-${id}`, artifactHashSha256: sha(id),
    caseId: 'CASE-W15B', propertyRef: 'PROPERTY-W15B', asOfDate: '2026-09-01', evidenceRefs: [`E-${id}`],
  });
}
const property = ref('REF-PROPERTY', ARTIFACT_TYPE.PROPERTY_EVIDENCE_PACKET);
const inspection = ref('REF-INSPECTION', ARTIFACT_TYPE.INSPECTION_PACKET);
const measurement = ref('REF-MEASUREMENT', ARTIFACT_TYPE.MEASUREMENT_PACKET);
const dcf = ref('REF-DCF', ARTIFACT_TYPE.DCF_RESULT);
function makeReport(overrides = {}) {
  return createProfessionalReportContract({
    reportId: 'REPORT-W15B', reportVersion: '1', reportType: REPORT_TYPE.PROFESSIONAL_VALUATION_DRAFT,
    caseId: 'CASE-W15B', propertyRef: 'PROPERTY-W15B', reportDate: '2026-09-08', assignment,
    standardsSnapshot: snapshot, standardsHashFn: sha,
    artifactReferences: [property, inspection, measurement, dcf],
    requiredArtifactTypes: [ARTIFACT_TYPE.PROPERTY_EVIDENCE_PACKET, ARTIFACT_TYPE.INSPECTION_PACKET, ARTIFACT_TYPE.MEASUREMENT_PACKET],
    methodAssessments: [{ methodCode: 'DCF', disposition: METHOD_DISPOSITION.USED, rationale: 'Reviewed DCF result.', resultReferenceId: 'REF-DCF' }],
    assumptions: [], specialAssumptions: [], limitations: ['Internal draft only.'],
    uncertaintyDisclosure: { status: UNCERTAINTY_STATUS.NONE_IDENTIFIED, rationale: 'Synthetic test fixture.', evidenceRefs: ['E-U'] },
    preparer: { partyId: 'PREPARER-1', role: 'PREPARER', credentialRef: 'CRED-P' },
    reviewer: { partyId: 'REVIEWER-1', role: 'REVIEWER', credentialRef: 'CRED-R' },
    createdAt: '2026-09-08T00:10:00Z',
    ...overrides,
  });
}
const report = makeReport();
check(() => assert.strictEqual(report.qaStatus, REPORT_QA_STATUS.READY_FOR_INTERNAL_QA));

const critical = createReviewFinding({
  findingId: 'F-CRIT', topic: 'VALUATION_TRACE', severity: FINDING_SEVERITY.CRITICAL,
  description: 'Resolve a critical traceability finding before progression.', evidenceRefs: ['E-F1'],
  raisedBy: 'REVIEWER-1', raisedAt: '2026-09-08T01:00:00Z',
});
check(() => assert.strictEqual(critical.status, FINDING_STATUS.OPEN));
check(() => assert.strictEqual(verifyReviewFinding(critical).valid, true));
check(() => assert.ok(Object.isFrozen(critical)));

const session = createProfessionalReviewSession({
  reviewId: 'REVIEW-W15B-1', reviewLevel: REVIEW_LEVEL.PROFESSIONAL_REVIEW, report,
  reviewer: { partyId: 'REVIEWER-1', role: 'PROFESSIONAL_REVIEWER', credentialRef: 'CRED-R' },
  findings: [critical], startedAt: '2026-09-08T00:50:00Z',
});
check(() => assert.strictEqual(session.reviewState, REVIEW_STATE.HOLD_OPEN_FINDINGS));
check(() => assert.strictEqual(session.reportHashSha256, report.reportHashSha256));
check(() => assert.strictEqual(session.professionalReviewCompleted, false));
check(() => assert.strictEqual(session.independentReviewCompleted, false));
check(() => assert.strictEqual(session.credentialValidationPerformed, false));
check(() => assert.strictEqual(session.externalIssuanceAuthorized, false));
check(() => assert.strictEqual(session.certifiedValuationAuthorized, false));
check(() => assert.strictEqual(session.legalOpinionEstablished, false));
check(() => assert.strictEqual(session.transactionAuthorized, false));
check(() => assert.strictEqual(session.reportMutationPerformed, false));
check(() => assert.strictEqual(session.aiReviewApprovalPermitted, false));
check(() => assert.strictEqual(verifyProfessionalReviewSession(session).valid, true));
check(() => assert.ok(Object.isFrozen(session)));

const resolved = resolveReviewFinding({
  session, findingId: 'F-CRIT', resolutionText: 'Traceability evidence linked and reviewed.',
  resolutionEvidenceRefs: ['E-RESOLUTION'], resolvedBy: 'PREPARER-1', acceptedByReviewerId: 'REVIEWER-1',
  resolvedAt: '2026-09-08T01:20:00Z',
});
check(() => assert.strictEqual(resolved.findings[0].status, FINDING_STATUS.RESOLVED));
check(() => assert.strictEqual(resolved.findings[0].resolution.resolvedBy, 'PREPARER-1'));
check(() => assert.strictEqual(resolved.findings[0].resolution.acceptedByReviewerId, 'REVIEWER-1'));
check(() => assert.strictEqual(resolved.reviewState, REVIEW_STATE.OPEN));
check(() => assert.strictEqual(verifyProfessionalReviewSession(resolved).valid, true));

const approved = concludeProfessionalReview({
  session: resolved, decision: REVIEW_DECISION.APPROVE_NEXT_CONTROLLED_GATE,
  decidedBy: 'REVIEWER-1', decidedAt: '2026-09-08T01:30:00Z', rationale: 'All review findings are resolved.', evidenceRefs: ['E-DECISION'],
});
check(() => assert.strictEqual(approved.reviewState, REVIEW_STATE.READY_FOR_NEXT_CONTROLLED_GATE));
check(() => assert.strictEqual(approved.professionalReviewCompleted, true));
check(() => assert.strictEqual(approved.independentReviewCompleted, false));
check(() => assert.strictEqual(approved.externalIssuanceAuthorized, false));
check(() => assert.strictEqual(approved.certifiedValuationAuthorized, false));
check(() => assert.strictEqual(approved.transactionAuthorized, false));
check(() => assert.strictEqual(verifyProfessionalReviewSession(approved).valid, true));

const independent = createProfessionalReviewSession({
  reviewId: 'REVIEW-W15B-INDEPENDENT', reviewLevel: REVIEW_LEVEL.INDEPENDENT_REVIEW, report,
  reviewer: { partyId: 'INDEPENDENT-1', role: 'INDEPENDENT_REVIEWER', credentialRef: 'CRED-I' },
  independenceAttestation: true, independenceEvidenceRefs: ['E-INDEPENDENCE'], findings: [], startedAt: '2026-09-08T02:00:00Z',
});
check(() => assert.strictEqual(independent.reviewState, REVIEW_STATE.OPEN));
check(() => assert.strictEqual(independent.independenceAttestation, true));
const independentApproved = concludeProfessionalReview({
  session: independent, decision: REVIEW_DECISION.APPROVE_NEXT_CONTROLLED_GATE,
  decidedBy: 'INDEPENDENT-1', decidedAt: '2026-09-08T02:10:00Z', rationale: 'Independent review complete.', evidenceRefs: ['E-I-DECISION'],
});
check(() => assert.strictEqual(independentApproved.independentReviewCompleted, true));
check(() => assert.strictEqual(independentApproved.professionalReviewCompleted, true));
check(() => assert.strictEqual(independentApproved.externalIssuanceAuthorized, false));

check(() => assert.throws(() => createProfessionalReviewSession({
  reviewId: 'BAD-I-1', reviewLevel: REVIEW_LEVEL.INDEPENDENT_REVIEW, report,
  reviewer: { partyId: 'INDEPENDENT-2', role: 'INDEPENDENT' }, findings: [], startedAt: '2026-09-08T02:00:00Z',
}), /INDEPENDENT_REVIEW_ATTESTATION_REQUIRED/));
check(() => assert.throws(() => createProfessionalReviewSession({
  reviewId: 'BAD-I-2', reviewLevel: REVIEW_LEVEL.INDEPENDENT_REVIEW, report,
  reviewer: { partyId: 'PREPARER-1', role: 'INDEPENDENT' }, independenceAttestation: true,
  independenceEvidenceRefs: ['E-I'], findings: [], startedAt: '2026-09-08T02:00:00Z',
}), /INDEPENDENT_REVIEWER_CANNOT_BE_PREPARER/));
check(() => assert.throws(() => createProfessionalReviewSession({
  reviewId: 'BAD-I-3', reviewLevel: REVIEW_LEVEL.INDEPENDENT_REVIEW, report,
  reviewer: { partyId: 'INDEPENDENT-3', role: 'INDEPENDENT' }, independenceAttestation: true,
  independenceEvidenceRefs: [], findings: [], startedAt: '2026-09-08T02:00:00Z',
}), /INDEPENDENT_REVIEW_EVIDENCE_REQUIRED/));

const blockedReport = makeReport({ artifactReferences: [property, measurement, dcf] });
check(() => assert.strictEqual(blockedReport.qaStatus, REPORT_QA_STATUS.REPORT_BLOCKED));
check(() => assert.throws(() => createProfessionalReviewSession({
  reviewId: 'BLOCKED', reviewLevel: REVIEW_LEVEL.PROFESSIONAL_REVIEW, report: blockedReport,
  reviewer: { partyId: 'REVIEWER-1', role: 'REVIEWER' }, findings: [], startedAt: '2026-09-08T02:00:00Z',
}), /REVIEW_REPORT_NOT_READY_FOR_INTERNAL_QA/));
const tamperedReport = { ...report, reportDate: '2026-09-09' };
check(() => assert.throws(() => createProfessionalReviewSession({
  reviewId: 'TAMPERED', reviewLevel: REVIEW_LEVEL.PROFESSIONAL_REVIEW, report: tamperedReport,
  reviewer: { partyId: 'REVIEWER-1', role: 'REVIEWER' }, findings: [], startedAt: '2026-09-08T02:00:00Z',
}), /REVIEW_REPORT_INTEGRITY_FAILURE/));

const wrongRaiser = createReviewFinding({ findingId: 'WRONG', topic: 'X', severity: FINDING_SEVERITY.MINOR, description: 'x', raisedBy: 'OTHER', raisedAt: '2026-09-08T01:00:00Z' });
check(() => assert.throws(() => createProfessionalReviewSession({
  reviewId: 'WRONG-RAISER', reviewLevel: REVIEW_LEVEL.PROFESSIONAL_REVIEW, report,
  reviewer: { partyId: 'REVIEWER-1', role: 'REVIEWER' }, findings: [wrongRaiser], startedAt: '2026-09-08T00:50:00Z',
}), /REVIEW_FINDING_REVIEWER_MISMATCH/));
check(() => assert.throws(() => createProfessionalReviewSession({
  reviewId: 'DUP-F', reviewLevel: REVIEW_LEVEL.PROFESSIONAL_REVIEW, report,
  reviewer: { partyId: 'REVIEWER-1', role: 'REVIEWER' }, findings: [critical, critical], startedAt: '2026-09-08T00:50:00Z',
}), /DUPLICATE_REVIEW_FINDING/));
const tamperedFinding = { ...critical, topic: 'TAMPERED' };
check(() => assert.strictEqual(verifyReviewFinding(tamperedFinding).valid, false));
check(() => assert.throws(() => createProfessionalReviewSession({
  reviewId: 'BAD-F-HASH', reviewLevel: REVIEW_LEVEL.PROFESSIONAL_REVIEW, report,
  reviewer: { partyId: 'REVIEWER-1', role: 'REVIEWER' }, findings: [tamperedFinding], startedAt: '2026-09-08T00:50:00Z',
}), /REVIEW_FINDING_INTEGRITY_FAILURE/));

check(() => assert.throws(() => resolveReviewFinding({
  session, findingId: 'F-CRIT', resolutionText: 'x', resolvedBy: 'PREPARER-1', acceptedByReviewerId: 'OTHER', resolvedAt: '2026-09-08T01:20:00Z',
}), /FINDING_RESOLUTION_REVIEWER_ACCEPTANCE_REQUIRED/));
check(() => assert.throws(() => resolveReviewFinding({
  session, findingId: 'F-CRIT', resolutionText: 'x', resolvedBy: 'PREPARER-1', acceptedByReviewerId: 'REVIEWER-1', resolvedAt: '2026-09-08T00:40:00Z',
}), /FINDING_RESOLUTION_BEFORE_RAISED/));
check(() => assert.throws(() => resolveReviewFinding({
  session: resolved, findingId: 'F-CRIT', resolutionText: 'x', resolvedBy: 'PREPARER-1', acceptedByReviewerId: 'REVIEWER-1', resolvedAt: '2026-09-08T01:25:00Z',
}), /REVIEW_FINDING_ALREADY_RESOLVED/));
check(() => assert.throws(() => resolveReviewFinding({
  session, findingId: 'NOPE', resolutionText: 'x', resolvedBy: 'PREPARER-1', acceptedByReviewerId: 'REVIEWER-1', resolvedAt: '2026-09-08T01:25:00Z',
}), /REVIEW_FINDING_NOT_FOUND/));

check(() => assert.throws(() => concludeProfessionalReview({
  session, decision: REVIEW_DECISION.APPROVE_NEXT_CONTROLLED_GATE, decidedBy: 'REVIEWER-1', decidedAt: '2026-09-08T01:30:00Z', rationale: 'premature',
}), /OPEN_REVIEW_FINDINGS_BLOCK_APPROVAL/));
const held = concludeProfessionalReview({
  session, decision: REVIEW_DECISION.HOLD, decidedBy: 'REVIEWER-1', decidedAt: '2026-09-08T01:30:00Z', rationale: 'Critical finding remains open.',
});
check(() => assert.strictEqual(held.reviewState, REVIEW_STATE.HELD_BY_REVIEWER));
check(() => assert.strictEqual(held.professionalReviewCompleted, false));
check(() => assert.strictEqual(held.externalIssuanceAuthorized, false));
check(() => assert.throws(() => concludeProfessionalReview({
  session: resolved, decision: REVIEW_DECISION.APPROVE_NEXT_CONTROLLED_GATE, decidedBy: 'OTHER', decidedAt: '2026-09-08T01:30:00Z', rationale: 'x',
}), /REVIEW_DECISION_MUST_BE_BY_REVIEWER/));
check(() => assert.throws(() => concludeProfessionalReview({
  session: resolved, decision: REVIEW_DECISION.APPROVE_NEXT_CONTROLLED_GATE, decidedBy: 'REVIEWER-1', decidedAt: '2026-09-08T00:40:00Z', rationale: 'x',
}), /REVIEW_DECISION_BEFORE_START/));
check(() => assert.throws(() => concludeProfessionalReview({
  session: approved, decision: REVIEW_DECISION.HOLD, decidedBy: 'REVIEWER-1', decidedAt: '2026-09-08T02:00:00Z', rationale: 'x',
}), /REVIEW_ALREADY_CONCLUDED/));
check(() => assert.throws(() => resolveReviewFinding({
  session: approved, findingId: 'F-CRIT', resolutionText: 'x', resolvedBy: 'PREPARER-1', acceptedByReviewerId: 'REVIEWER-1', resolvedAt: '2026-09-08T02:00:00Z',
}), /REVIEW_ALREADY_CONCLUDED/));

const tamperedSession = { ...session, reviewState: REVIEW_STATE.OPEN };
check(() => assert.strictEqual(verifyProfessionalReviewSession(tamperedSession).valid, false));
check(() => assert.throws(() => concludeProfessionalReview({
  session: tamperedSession, decision: REVIEW_DECISION.HOLD, decidedBy: 'REVIEWER-1', decidedAt: '2026-09-08T02:00:00Z', rationale: 'x',
}), /REVIEW_SESSION_INTEGRITY_FAILURE/));

console.log(`WAVE_15B_PROFESSIONAL_REVIEW=PASS checks=${checks}`);
