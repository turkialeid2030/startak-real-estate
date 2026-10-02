'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DESIGNATION_PATH = path.join(ROOT, 'release/evidence/c37-rollback-reviewer-designation.json');
const PAYLOAD_PATH = path.join(ROOT, 'release/evidence/c37-rollback-independent-review-payload.json');
const CANDIDATE_PATH = path.join(ROOT, 'release/evidence/c36-rollback-candidate-evidence.json');

const EXPECTED = Object.freeze({
  ownerRef: 'github:turkialeid2030',
  ownerDecision: 'APPROVE_SAID_FOR_ROLLBACK_REVIEW',
  ownerDecisionIssue: 592,
  reviewerRef: 'human:said',
  reviewerId: 'reviewer-said-2026-09-17',
  reviewerPublicKeySha256: '0af393bd7c091106c3b16e493b4f99d39570c77675c9c5dee175d5a7727ebbc1',
  reviewerAuthorityIssue: 254,
  evidenceId: 'ROLLBACK_OPERATIONAL_VERIFICATION',
  reviewPurpose: 'INDEPENDENT_OPERATIONAL_ROLLBACK_REHEARSAL_ACCEPTANCE',
  candidateHeadSha: '2f066168f6cdca672d668ff5367ab250fe5cb907',
  rollbackPointSha: 'ba617ef387843b6916bb8da0bf08b16e0922260f',
  c36QualifiedHeadSha: 'fe63dcc441cc8c8d665430a63e126fbe814aac13',
  candidateArtifactSha256: '4475f40dcbc5d6b2b2edfc1a6584686b6c7f7c29afab1861b4f16ece1ad52409',
  sourceRehearsalReportSha256: 'a0ba299578af8577de23a467bd3f7e410c636b85fa92e8b107ce73ed1498fe76',
  sourceWorkflowRunId: 37046492311,
  sourceWorkflowJobId: 110969106434,
});

const AUTHORITY_KEYS = Object.freeze([
  'releaseDecisionAuthorized',
  'canonicalBaselineActivationAuthorized',
  'mergeAuthorized',
  'deploymentAuthorized',
  'commercialGoLiveAuthorized',
  'transactionAuthority',
  'approvalAuthorized',
  'publicAiAuthorized',
]);

function fail(code) {
  const err = new Error(code);
  err.code = code;
  throw err;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function assertEqual(actual, expected, code) {
  if (actual !== expected) fail(code);
}

function assertNoAuthorityEscalation(record, prefix) {
  for (const key of AUTHORITY_KEYS) {
    if (record[key] !== false) fail(`${prefix}_AUTHORITY_ESCALATION:${key}`);
  }
}

function validateDesignation(d) {
  assertEqual(d.schemaVersion, 1, 'C37_DESIGNATION_SCHEMA_INVALID');
  assertEqual(d.scope, 'C37_ROLLBACK_INDEPENDENT_REVIEWER_DESIGNATION', 'C37_DESIGNATION_SCOPE_INVALID');
  assertEqual(d.ownerDecision, EXPECTED.ownerDecision, 'C37_OWNER_DECISION_INVALID');
  assertEqual(d.ownerRef, EXPECTED.ownerRef, 'C37_OWNER_REF_INVALID');
  assertEqual(d.ownerDecisionIssue, EXPECTED.ownerDecisionIssue, 'C37_OWNER_DECISION_ISSUE_INVALID');
  if (!d.ownerDecisionRecordedAt || Number.isNaN(Date.parse(d.ownerDecisionRecordedAt))) fail('C37_OWNER_DECISION_TIME_INVALID');
  assertEqual(d.evidenceId, EXPECTED.evidenceId, 'C37_EVIDENCE_ID_INVALID');
  assertEqual(d.candidateHeadSha, EXPECTED.candidateHeadSha, 'C37_CANDIDATE_HEAD_INVALID');
  assertEqual(d.c36QualifiedHeadSha, EXPECTED.c36QualifiedHeadSha, 'C37_C36_HEAD_INVALID');
  assertEqual(d.candidateArtifactPath, 'release/evidence/c36-rollback-candidate-evidence.json', 'C37_CANDIDATE_PATH_INVALID');
  assertEqual(d.candidateArtifactSha256, EXPECTED.candidateArtifactSha256, 'C37_CANDIDATE_HASH_DECLARATION_INVALID');
  assertEqual(d.sourceRehearsalReportSha256, EXPECTED.sourceRehearsalReportSha256, 'C37_SOURCE_REPORT_HASH_INVALID');
  assertEqual(d.reviewPurpose, EXPECTED.reviewPurpose, 'C37_REVIEW_PURPOSE_INVALID');
  assertEqual(d.reviewerRef, EXPECTED.reviewerRef, 'C37_REVIEWER_REF_INVALID');
  assertEqual(d.reviewerId, EXPECTED.reviewerId, 'C37_REVIEWER_ID_INVALID');
  assertEqual(d.reviewerAuthorityIssue, EXPECTED.reviewerAuthorityIssue, 'C37_REVIEWER_AUTHORITY_INVALID');
  assertEqual(d.reviewerCurrentPublicKeySha256, EXPECTED.reviewerPublicKeySha256, 'C37_REVIEWER_KEY_FINGERPRINT_INVALID');
  if (d.reviewerIsOwner !== false || d.reviewerRef === d.ownerRef) fail('C37_REVIEWER_NOT_INDEPENDENT_FROM_OWNER');
  assertEqual(d.designationStatus, 'REVIEWER_DESIGNATED_AWAITING_SUBSTANTIVE_REVIEW', 'C37_DESIGNATION_STATUS_INVALID');
  if (d.reviewDecision !== null || d.reviewedAt !== null || d.signedArtifactRef !== null || d.signedArtifactSha256 !== null) {
    fail('C37_FALSE_REVIEW_COMPLETION');
  }
  if (d.independentReviewAccepted !== false || d.evidenceSatisfied !== false) fail('C37_FALSE_EVIDENCE_ACCEPTANCE');
  assertEqual(d.c30EvidenceStatus, 'NOT_SUPPLIED_PENDING_INDEPENDENT_REVIEW', 'C37_C30_GATE_ESCALATED');
  assertNoAuthorityEscalation(d, 'C37_DESIGNATION');
}

function validatePayload(p) {
  assertEqual(p.schemaVersion, 1, 'C37_PAYLOAD_SCHEMA_INVALID');
  assertEqual(p.scope, 'C37_ROLLBACK_INDEPENDENT_REVIEW_PAYLOAD', 'C37_PAYLOAD_SCOPE_INVALID');
  assertEqual(p.reviewPurpose, EXPECTED.reviewPurpose, 'C37_PAYLOAD_PURPOSE_INVALID');
  assertEqual(p.evidenceId, EXPECTED.evidenceId, 'C37_PAYLOAD_EVIDENCE_ID_INVALID');
  assertEqual(p.reviewerRef, EXPECTED.reviewerRef, 'C37_PAYLOAD_REVIEWER_REF_INVALID');
  assertEqual(p.reviewerId, EXPECTED.reviewerId, 'C37_PAYLOAD_REVIEWER_ID_INVALID');
  assertEqual(p.reviewerCurrentPublicKeySha256, EXPECTED.reviewerPublicKeySha256, 'C37_PAYLOAD_KEY_FINGERPRINT_INVALID');
  assertEqual(p.ownerDesignationIssue, EXPECTED.ownerDecisionIssue, 'C37_PAYLOAD_OWNER_ISSUE_INVALID');
  assertEqual(p.candidateHeadSha, EXPECTED.candidateHeadSha, 'C37_PAYLOAD_CANDIDATE_HEAD_INVALID');
  assertEqual(p.rollbackPointSha, EXPECTED.rollbackPointSha, 'C37_PAYLOAD_ROLLBACK_POINT_INVALID');
  assertEqual(p.c36QualifiedHeadSha, EXPECTED.c36QualifiedHeadSha, 'C37_PAYLOAD_C36_HEAD_INVALID');
  assertEqual(p.candidateArtifactSha256, EXPECTED.candidateArtifactSha256, 'C37_PAYLOAD_CANDIDATE_HASH_INVALID');
  assertEqual(p.sourceRehearsalReportSha256, EXPECTED.sourceRehearsalReportSha256, 'C37_PAYLOAD_SOURCE_HASH_INVALID');
  assertEqual(p.sourceWorkflowRunId, EXPECTED.sourceWorkflowRunId, 'C37_PAYLOAD_RUN_ID_INVALID');
  assertEqual(p.sourceWorkflowJobId, EXPECTED.sourceWorkflowJobId, 'C37_PAYLOAD_JOB_ID_INVALID');
  if (!p.executionWindow || p.executionWindow.startedAt !== '2026-10-02T18:19:43Z' || p.executionWindow.completedAt !== '2026-10-02T18:24:20Z') {
    fail('C37_PAYLOAD_EXECUTION_WINDOW_INVALID');
  }
  const obs = p.observedVerification || {};
  for (const key of ['targetBeforeRollback', 'rollbackPoint', 'targetAfterRestore']) {
    if (obs[key] !== 'PASS') fail(`C37_PAYLOAD_OBSERVED_RESULT_INVALID:${key}`);
  }
  if (obs.targetBeforeRollbackSeconds !== 86 || obs.rollbackPointSeconds !== 85 || obs.targetAfterRestoreSeconds !== 85) {
    fail('C37_PAYLOAD_OBSERVED_TIMING_INVALID');
  }
  if (!Array.isArray(p.reviewQuestions) || p.reviewQuestions.length !== 5) fail('C37_PAYLOAD_REVIEW_QUESTIONS_INVALID');
  const ids = new Set();
  for (const q of p.reviewQuestions) {
    if (!q || typeof q.id !== 'string' || !q.id || ids.has(q.id)) fail('C37_PAYLOAD_REVIEW_QUESTION_ID_INVALID');
    ids.add(q.id);
    if (typeof q.questionAr !== 'string' || !q.questionAr.trim()) fail(`C37_PAYLOAD_REVIEW_QUESTION_TEXT_INVALID:${q.id}`);
    if (q.answer !== null || q.reviewerNote !== null) fail(`C37_PAYLOAD_PREPOPULATED_REVIEW_RESPONSE:${q.id}`);
  }
  if (p.reviewDecision !== null || p.reasonCode !== null || p.reviewedAt !== null || p.signatureBase64 !== null || p.signedArtifactSha256 !== null) {
    fail('C37_PAYLOAD_FALSE_REVIEW_COMPLETION');
  }
  assertEqual(p.signatureAlgorithmExpected, 'RSA-SHA256', 'C37_PAYLOAD_SIGNATURE_ALGORITHM_INVALID');
  if (p.payloadIsApproval !== false || p.independentReviewAccepted !== false || p.evidenceSatisfied !== false) {
    fail('C37_PAYLOAD_FALSE_APPROVAL');
  }
  assertEqual(p.c30EvidenceStatus, 'NOT_SUPPLIED_PENDING_INDEPENDENT_REVIEW', 'C37_PAYLOAD_C30_GATE_ESCALATED');
  assertNoAuthorityEscalation(p, 'C37_PAYLOAD');
}

function validate() {
  const designation = readJson(DESIGNATION_PATH);
  const payload = readJson(PAYLOAD_PATH);
  validateDesignation(designation);
  validatePayload(payload);

  const actualCandidateSha = sha256File(CANDIDATE_PATH);
  assertEqual(actualCandidateSha, EXPECTED.candidateArtifactSha256, 'C37_CANDIDATE_ARTIFACT_HASH_MISMATCH');

  return {
    schemaVersion: 1,
    scope: 'C37_ROLLBACK_REVIEWER_DESIGNATION_SUMMARY',
    ownerDecisionRecorded: true,
    ownerDecision: EXPECTED.ownerDecision,
    reviewerDesignated: true,
    reviewerRef: EXPECTED.reviewerRef,
    reviewerId: EXPECTED.reviewerId,
    reviewerIndependentFromOwner: true,
    reviewerPublicKeySha256: EXPECTED.reviewerPublicKeySha256,
    candidateArtifactIntegrityVerified: true,
    candidateArtifactSha256: actualCandidateSha,
    reviewPayloadPrepared: true,
    substantiveReviewCompleted: false,
    independentReviewAccepted: false,
    evidenceSatisfied: false,
    c30EvidenceStatus: 'NOT_SUPPLIED_PENDING_INDEPENDENT_REVIEW',
    handoffState: 'REVIEWER_DESIGNATED_REVIEW_PAYLOAD_READY_AWAITING_HUMAN_REVIEW',
    releaseDecisionAuthorized: false,
    canonicalBaselineActivationAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    commercialGoLiveAuthorized: false,
    transactionAuthority: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    designationArtifactSha256: sha256File(DESIGNATION_PATH),
    reviewPayloadSha256: sha256File(PAYLOAD_PATH),
  };
}

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(validate(), null, 2)}\n`);
}

module.exports = { validate, validateDesignation, validatePayload, EXPECTED, AUTHORITY_KEYS };
