'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CANDIDATE_PATH = path.join(ROOT, 'release', 'evidence', 'c36-rollback-candidate-evidence.json');
const REVIEW_REQUEST_PATH = path.join(ROOT, 'release', 'evidence', 'c36-rollback-independent-review-request.json');

const EXPECTED = Object.freeze({
  evidenceId: 'ROLLBACK_OPERATIONAL_VERIFICATION',
  c35ControlHeadSha: 'bc64c4556d74b5d662a578c89c7fefa4a979eb7e',
  candidateHeadSha: '2f066168f6cdca672d668ff5367ab250fe5cb907',
  rollbackPointSha: 'ba617ef387843b6916bb8da0bf08b16e0922260f',
  sourceRunId: 37046492311,
  sourceJobId: 110969106434,
  sourceReportSha256: 'a0ba299578af8577de23a467bd3f7e410c636b85fa92e8b107ce73ed1498fe76',
  startedAt: '2026-10-02T18:19:43Z',
  completedAt: '2026-10-02T18:24:20Z',
  targetSeconds: 86,
  rollbackSeconds: 85,
  restoreSeconds: 85,
});

const FALSE_AUTHORITY_FIELDS = Object.freeze([
  'releaseDecisionAuthorized',
  'mergeAuthorized',
  'deploymentAuthorized',
  'commercialGoLiveAuthorized',
  'transactionAuthority',
  'approvalAuthorized',
  'publicAiAuthorized',
]);

function readJson(filePath) {
  const resolved = path.resolve(filePath);
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink()) throw new Error('C36_SYMLINK_INPUT_REJECTED');
  if (!stat.isFile()) throw new Error('C36_INPUT_NOT_REGULAR_FILE');
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function assertExact(actual, expected, code) {
  if (actual !== expected) throw new Error(code);
}

function assertAuthorityFalse(record, fields, prefix) {
  for (const key of fields) {
    if (record[key] !== false) throw new Error(`${prefix}_AUTHORITY_ESCALATION:${key}`);
  }
}

function validateCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('C36_CANDIDATE_REQUIRED');
  assertExact(candidate.schemaVersion, 1, 'C36_CANDIDATE_SCHEMA_VERSION_INVALID');
  assertExact(candidate.scope, 'C36_ROLLBACK_CANDIDATE_EVIDENCE', 'C36_CANDIDATE_SCOPE_INVALID');
  assertExact(candidate.evidenceId, EXPECTED.evidenceId, 'C36_EVIDENCE_ID_INVALID');
  assertExact(candidate.sourceType, 'REAL_EXECUTED_CONTROLLED_NON_PRODUCTION_ROLLBACK_REHEARSAL', 'C36_SOURCE_TYPE_INVALID');
  assertExact(candidate.sourceWorkflowName, 'C35 Owner Execution Wave Verify', 'C36_WORKFLOW_NAME_INVALID');
  assertExact(candidate.sourceWorkflowRunNumber, 1, 'C36_WORKFLOW_RUN_NUMBER_INVALID');
  assertExact(candidate.sourceRunId, EXPECTED.sourceRunId, 'C36_SOURCE_RUN_ID_INVALID');
  assertExact(candidate.sourceJobId, EXPECTED.sourceJobId, 'C36_SOURCE_JOB_ID_INVALID');
  assertExact(candidate.sourceRunUrl, `https://github.com/turkialeid2030/startak-real-estate/actions/runs/${EXPECTED.sourceRunId}`, 'C36_SOURCE_RUN_URL_INVALID');
  assertExact(candidate.sourceJobUrl, `https://github.com/turkialeid2030/startak-real-estate/actions/runs/${EXPECTED.sourceRunId}/job/${EXPECTED.sourceJobId}`, 'C36_SOURCE_JOB_URL_INVALID');
  assertExact(candidate.c35ControlHeadSha, EXPECTED.c35ControlHeadSha, 'C36_CONTROL_HEAD_SHA_INVALID');
  assertExact(candidate.candidateHeadSha, EXPECTED.candidateHeadSha, 'C36_CANDIDATE_HEAD_SHA_INVALID');
  assertExact(candidate.rollbackPointSha, EXPECTED.rollbackPointSha, 'C36_ROLLBACK_POINT_SHA_INVALID');
  assertExact(candidate.environment, 'github-actions:ubuntu-24.04:controlled-non-production-source-build-rehearsal', 'C36_ENVIRONMENT_INVALID');
  assertExact(candidate.startedAt, EXPECTED.startedAt, 'C36_STARTED_AT_INVALID');
  assertExact(candidate.completedAt, EXPECTED.completedAt, 'C36_COMPLETED_AT_INVALID');
  assertExact(candidate.targetBaselineVerifySeconds, EXPECTED.targetSeconds, 'C36_TARGET_DURATION_INVALID');
  assertExact(candidate.rollbackVerifySeconds, EXPECTED.rollbackSeconds, 'C36_ROLLBACK_DURATION_INVALID');
  assertExact(candidate.targetRestoreVerifySeconds, EXPECTED.restoreSeconds, 'C36_RESTORE_DURATION_INVALID');
  if (candidate.targetBuildAndReleaseVerifyPassed !== true || candidate.rollbackBuildAndReleaseVerifyPassed !== true || candidate.targetRestoreBuildAndReleaseVerifyPassed !== true) {
    throw new Error('C36_STAGE_PASS_STATE_INVALID');
  }
  assertExact(candidate.sourceRehearsalReportSha256, EXPECTED.sourceReportSha256, 'C36_SOURCE_REPORT_HASH_INVALID');
  assertExact(candidate.evidenceState, 'EXECUTED_CANDIDATE_EVIDENCE_PENDING_INDEPENDENT_REVIEW', 'C36_EVIDENCE_STATE_INVALID');
  if (candidate.independentReviewerRef !== null || candidate.independentReviewDecision !== null || candidate.independentReviewAccepted !== false) {
    throw new Error('C36_FALSE_INDEPENDENT_REVIEW');
  }
  assertExact(candidate.c30EvidenceStatus, 'NOT_SUPPLIED_PENDING_INDEPENDENT_REVIEW', 'C36_C30_STATUS_INVALID');
  if (candidate.canonicalBaselineActivationAuthorized !== false) throw new Error('C36_CANONICAL_AUTHORITY_ESCALATION');
  assertAuthorityFalse(candidate, FALSE_AUTHORITY_FIELDS, 'C36_CANDIDATE');
  return candidate;
}

function validateReviewRequest(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('C36_REVIEW_REQUEST_REQUIRED');
  assertExact(request.schemaVersion, 1, 'C36_REVIEW_SCHEMA_VERSION_INVALID');
  assertExact(request.scope, 'C36_ROLLBACK_INDEPENDENT_REVIEW_REQUEST', 'C36_REVIEW_SCOPE_INVALID');
  assertExact(request.evidenceId, EXPECTED.evidenceId, 'C36_REVIEW_EVIDENCE_ID_INVALID');
  assertExact(request.candidateArtifactPath, 'release/evidence/c36-rollback-candidate-evidence.json', 'C36_REVIEW_CANDIDATE_PATH_INVALID');
  assertExact(request.candidateHeadSha, EXPECTED.candidateHeadSha, 'C36_REVIEW_CANDIDATE_SHA_INVALID');
  assertExact(request.sourceRehearsalReportSha256, EXPECTED.sourceReportSha256, 'C36_REVIEW_SOURCE_HASH_INVALID');
  assertExact(request.requestStatus, 'REVIEWER_REQUIRED', 'C36_REVIEW_STATUS_INVALID');
  assertExact(request.reviewPurpose, 'INDEPENDENT_OPERATIONAL_ROLLBACK_REHEARSAL_ACCEPTANCE', 'C36_REVIEW_PURPOSE_INVALID');
  if (!Array.isArray(request.minimumReviewQuestions) || request.minimumReviewQuestions.length < 5) throw new Error('C36_REVIEW_QUESTIONS_INCOMPLETE');
  const blankFields = ['independentReviewerRef','reviewerAuthorityRef','reviewDecision','reviewedAt','signedArtifactRef','signedArtifactSha256','reasonCode'];
  for (const key of blankFields) if (request[key] !== null) throw new Error(`C36_REVIEW_FIELD_MUST_REMAIN_BLANK:${key}`);
  if (request.requestIsApproval !== false || request.evidenceSatisfied !== false) throw new Error('C36_REVIEW_FALSE_APPROVAL_STATE');
  assertAuthorityFalse(request, FALSE_AUTHORITY_FIELDS, 'C36_REVIEW');
  return request;
}

function buildHandoffSummary({ candidate, reviewRequest, candidateArtifactSha256 }) {
  validateCandidate(candidate);
  validateReviewRequest(reviewRequest);
  if (!/^[a-f0-9]{64}$/.test(candidateArtifactSha256)) throw new Error('C36_CANDIDATE_ARTIFACT_HASH_INVALID');
  return Object.freeze({
    schemaVersion: 1,
    scope: 'C36_ROLLBACK_EVIDENCE_HANDOFF_SUMMARY',
    evidenceId: EXPECTED.evidenceId,
    candidateHeadSha: EXPECTED.candidateHeadSha,
    rollbackPointSha: EXPECTED.rollbackPointSha,
    sourceRunId: EXPECTED.sourceRunId,
    sourceJobId: EXPECTED.sourceJobId,
    sourceRehearsalReportSha256: EXPECTED.sourceReportSha256,
    candidateArtifactSha256,
    executionEvidencePersisted: true,
    independentReviewerAssigned: false,
    independentReviewAccepted: false,
    evidenceSatisfied: false,
    c30EvidenceStatus: 'NOT_SUPPLIED_PENDING_INDEPENDENT_REVIEW',
    handoffState: 'DURABLE_CANDIDATE_EVIDENCE_READY_FOR_INDEPENDENT_REVIEW',
    releaseDecisionAuthorized: false,
    canonicalBaselineActivationAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    commercialGoLiveAuthorized: false,
    transactionAuthority: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
  });
}

function runCli() {
  const candidate = readJson(CANDIDATE_PATH);
  const reviewRequest = readJson(REVIEW_REQUEST_PATH);
  const result = buildHandoffSummary({
    candidate,
    reviewRequest,
    candidateArtifactSha256: sha256File(CANDIDATE_PATH),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}

if (require.main === module) {
  try { runCli(); } catch (error) {
    console.error(`C36_ROLLBACK_EVIDENCE_HANDOFF=FAIL ${error.message}`);
    process.exit(1);
  }
}

module.exports = Object.freeze({
  EXPECTED,
  FALSE_AUTHORITY_FIELDS,
  validateCandidate,
  validateReviewRequest,
  buildHandoffSummary,
  runCli,
});
