'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  validate,
  validateDesignation,
  validatePayload,
} = require('../../tools/c37-rollback-reviewer-designation');

const ROOT = path.resolve(__dirname, '../..');
const designation = JSON.parse(fs.readFileSync(path.join(ROOT, 'release/evidence/c37-rollback-reviewer-designation.json'), 'utf8'));
const payload = JSON.parse(fs.readFileSync(path.join(ROOT, 'release/evidence/c37-rollback-independent-review-payload.json'), 'utf8'));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectThrow(fn, fragment) {
  let thrown = null;
  try {
    fn();
  } catch (err) {
    thrown = err;
  }
  assert(thrown, `Expected error containing ${fragment}`);
  assert(String(thrown.message).includes(fragment), `Expected ${fragment}, got ${thrown.message}`);
}

const result = validate();
assert.strictEqual(result.ownerDecisionRecorded, true);
assert.strictEqual(result.reviewerDesignated, true);
assert.strictEqual(result.reviewerIndependentFromOwner, true);
assert.strictEqual(result.candidateArtifactIntegrityVerified, true);
assert.strictEqual(result.reviewPayloadPrepared, true);
assert.strictEqual(result.substantiveReviewCompleted, false);
assert.strictEqual(result.independentReviewAccepted, false);
assert.strictEqual(result.evidenceSatisfied, false);
assert.strictEqual(result.c30EvidenceStatus, 'NOT_SUPPLIED_PENDING_INDEPENDENT_REVIEW');
assert.strictEqual(result.handoffState, 'REVIEWER_DESIGNATED_REVIEW_PAYLOAD_READY_AWAITING_HUMAN_REVIEW');

{
  const mutated = clone(designation);
  mutated.reviewerRef = mutated.ownerRef;
  mutated.reviewerIsOwner = true;
  expectThrow(() => validateDesignation(mutated), 'C37_REVIEWER_REF_INVALID');
}

{
  const mutated = clone(designation);
  mutated.reviewDecision = 'APPROVE';
  expectThrow(() => validateDesignation(mutated), 'C37_FALSE_REVIEW_COMPLETION');
}

{
  const mutated = clone(designation);
  mutated.independentReviewAccepted = true;
  expectThrow(() => validateDesignation(mutated), 'C37_FALSE_EVIDENCE_ACCEPTANCE');
}

{
  const mutated = clone(designation);
  mutated.mergeAuthorized = true;
  expectThrow(() => validateDesignation(mutated), 'C37_DESIGNATION_AUTHORITY_ESCALATION:mergeAuthorized');
}

{
  const mutated = clone(designation);
  mutated.candidateArtifactSha256 = '0'.repeat(64);
  expectThrow(() => validateDesignation(mutated), 'C37_CANDIDATE_HASH_DECLARATION_INVALID');
}

{
  const mutated = clone(payload);
  mutated.reviewQuestions[0].answer = 'YES';
  expectThrow(() => validatePayload(mutated), 'C37_PAYLOAD_PREPOPULATED_REVIEW_RESPONSE:Q1_EXECUTION_REALITY');
}

{
  const mutated = clone(payload);
  mutated.signatureBase64 = 'fabricated-signature';
  expectThrow(() => validatePayload(mutated), 'C37_PAYLOAD_FALSE_REVIEW_COMPLETION');
}

{
  const mutated = clone(payload);
  mutated.reviewDecision = 'APPROVE';
  expectThrow(() => validatePayload(mutated), 'C37_PAYLOAD_FALSE_REVIEW_COMPLETION');
}

{
  const mutated = clone(payload);
  mutated.deploymentAuthorized = true;
  expectThrow(() => validatePayload(mutated), 'C37_PAYLOAD_AUTHORITY_ESCALATION:deploymentAuthorized');
}

{
  const mutated = clone(payload);
  mutated.sourceWorkflowRunId = 1;
  expectThrow(() => validatePayload(mutated), 'C37_PAYLOAD_RUN_ID_INVALID');
}

console.log('C37_ROLLBACK_REVIEWER_DESIGNATION=PASS');
console.log(`C37_REVIEWER_REF=${result.reviewerRef}`);
console.log(`C37_REVIEWER_INDEPENDENT_FROM_OWNER=${result.reviewerIndependentFromOwner ? 1 : 0}`);
console.log(`C37_CANDIDATE_ARTIFACT_INTEGRITY=${result.candidateArtifactIntegrityVerified ? 'PASS' : 'FAIL'}`);
console.log(`C37_SUBSTANTIVE_REVIEW_COMPLETED=${result.substantiveReviewCompleted ? 1 : 0}`);
console.log(`C37_C30_ROLLBACK_GATE=${result.c30EvidenceStatus}`);
console.log('C37_AUTHORITY_SEPARATION=PASS');
