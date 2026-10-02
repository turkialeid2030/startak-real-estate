'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  validateCandidate,
  validateReviewRequest,
  buildHandoffSummary,
} = require('../../tools/c36-rollback-evidence-handoff');

const ROOT = path.join(__dirname, '..', '..');
const candidatePath = path.join(ROOT, 'release', 'evidence', 'c36-rollback-candidate-evidence.json');
const reviewPath = path.join(ROOT, 'release', 'evidence', 'c36-rollback-independent-review-request.json');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectThrow(fn, expectedFragment) {
  let thrown = null;
  try { fn(); } catch (error) { thrown = error; }
  if (!thrown) throw new Error(`EXPECTED_THROW:${expectedFragment}`);
  if (!String(thrown.message).includes(expectedFragment)) throw new Error(`WRONG_ERROR:${thrown.message}`);
}

const candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
const reviewRequest = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
const candidateHash = crypto.createHash('sha256').update(fs.readFileSync(candidatePath)).digest('hex');

validateCandidate(candidate);
validateReviewRequest(reviewRequest);

const summary = buildHandoffSummary({ candidate, reviewRequest, candidateArtifactSha256: candidateHash });
if (summary.executionEvidencePersisted !== true) throw new Error('C36_EXECUTION_EVIDENCE_NOT_PERSISTED');
if (summary.independentReviewerAssigned !== false || summary.independentReviewAccepted !== false) throw new Error('C36_FALSE_REVIEW_ASSIGNMENT');
if (summary.evidenceSatisfied !== false) throw new Error('C36_FALSE_EVIDENCE_SATISFACTION');
if (summary.c30EvidenceStatus !== 'NOT_SUPPLIED_PENDING_INDEPENDENT_REVIEW') throw new Error('C36_FALSE_C30_STATUS');
if (summary.handoffState !== 'DURABLE_CANDIDATE_EVIDENCE_READY_FOR_INDEPENDENT_REVIEW') throw new Error('C36_HANDOFF_STATE_INVALID');

const badHead = clone(candidate);
badHead.candidateHeadSha = '0'.repeat(40);
expectThrow(() => validateCandidate(badHead), 'C36_CANDIDATE_HEAD_SHA_INVALID');

const badRollback = clone(candidate);
badRollback.rollbackPointSha = '1'.repeat(40);
expectThrow(() => validateCandidate(badRollback), 'C36_ROLLBACK_POINT_SHA_INVALID');

const badRun = clone(candidate);
badRun.sourceRunId = 1;
expectThrow(() => validateCandidate(badRun), 'C36_SOURCE_RUN_ID_INVALID');

const badDuration = clone(candidate);
badDuration.rollbackVerifySeconds = 999;
expectThrow(() => validateCandidate(badDuration), 'C36_ROLLBACK_DURATION_INVALID');

const falseReviewer = clone(candidate);
falseReviewer.independentReviewerRef = 'engineering:self';
expectThrow(() => validateCandidate(falseReviewer), 'C36_FALSE_INDEPENDENT_REVIEW');

const falseAccept = clone(candidate);
falseAccept.independentReviewAccepted = true;
expectThrow(() => validateCandidate(falseAccept), 'C36_FALSE_INDEPENDENT_REVIEW');

const falseAuthority = clone(candidate);
falseAuthority.deploymentAuthorized = true;
expectThrow(() => validateCandidate(falseAuthority), 'C36_CANDIDATE_AUTHORITY_ESCALATION:deploymentAuthorized');

const reviewWithInventedReviewer = clone(reviewRequest);
reviewWithInventedReviewer.independentReviewerRef = 'reviewer:invented';
expectThrow(() => validateReviewRequest(reviewWithInventedReviewer), 'C36_REVIEW_FIELD_MUST_REMAIN_BLANK:independentReviewerRef');

const reviewWithDecision = clone(reviewRequest);
reviewWithDecision.reviewDecision = 'APPROVE';
expectThrow(() => validateReviewRequest(reviewWithDecision), 'C36_REVIEW_FIELD_MUST_REMAIN_BLANK:reviewDecision');

const reviewWithEvidenceSatisfied = clone(reviewRequest);
reviewWithEvidenceSatisfied.evidenceSatisfied = true;
expectThrow(() => validateReviewRequest(reviewWithEvidenceSatisfied), 'C36_REVIEW_FALSE_APPROVAL_STATE');

expectThrow(() => buildHandoffSummary({ candidate, reviewRequest, candidateArtifactSha256: 'bad' }), 'C36_CANDIDATE_ARTIFACT_HASH_INVALID');

console.log('C36_ROLLBACK_EVIDENCE_HANDOFF=PASS');
console.log(`C36_CANDIDATE_ARTIFACT_SHA256=${candidateHash}`);
console.log('C36_EXECUTION_EVIDENCE_PERSISTED=1');
console.log('C36_INDEPENDENT_REVIEW_ACCEPTED=0');
console.log('C36_C30_ROLLBACK_GATE=NOT_SUPPLIED_PENDING_INDEPENDENT_REVIEW');
console.log('C36_AUTHORITY_SEPARATION=PASS');
