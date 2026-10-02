'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const { buildExecutionSummary } = require(path.join(ROOT, 'tools', 'c35-owner-execution-plan.js'));

function json(file) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mustThrow(fn, contains) {
  assert.throws(fn, (error) => error && String(error.message).includes(contains));
}

const plan = json('release/evidence/c35-owner-execution-plan.json');
const acquisitionMap = json('release/evidence/c32-evidence-acquisition-map.json');
const ownerRegister = json('release/evidence/c34-single-accountable-owner-register.json');

const current = buildExecutionSummary({ plan, acquisitionMap, ownerRegister });
assert.strictEqual(current.totalRequiredItems, 13);
assert.strictEqual(current.accountableOwnerAssignedCount, 13);
assert.strictEqual(current.evidenceSatisfiedCount, 0);
assert.strictEqual(current.reviewerRequiredCount, 3);
assert.strictEqual(current.realInputRequiredCount, 8);
assert.strictEqual(current.preparedNotExecutedCount, 1);
assert.strictEqual(current.executionScheduledCount, 1);
assert.strictEqual(current.candidateEvidencePendingReviewCount, 0);
assert.strictEqual(current.programState, 'OWNER_EXECUTION_READY_REAL_EVIDENCE_REQUIRED');
assert.strictEqual(current.rollbackCandidateEvidenceIsFinalAuthorization, false);
assert.strictEqual(current.ownerAssignmentIsIndependentReview, false);
for (const key of [
  'releaseDecisionAuthorized',
  'canonicalBaselineActivationAuthorized',
  'mergeAuthorized',
  'deploymentAuthorized',
  'commercialGoLiveAuthorized',
  'transactionAuthority',
  'approvalAuthorized',
  'publicAiAuthorized',
]) assert.strictEqual(current[key], false, key);

const selfVerify = clone(plan);
selfVerify.items[0].ownerSelfVerificationAllowed = true;
mustThrow(() => buildExecutionSummary({ plan: selfVerify, acquisitionMap, ownerRegister }), 'C35_SELF_VERIFICATION_PROHIBITION_REQUIRED');

const falseEvidence = clone(plan);
falseEvidence.evidenceSatisfiedCount = 1;
mustThrow(() => buildExecutionSummary({ plan: falseEvidence, acquisitionMap, ownerRegister }), 'C35_FALSE_EVIDENCE_SATISFACTION');

const wrongIssue = clone(plan);
wrongIssue.items[0].issueNumber = 999999;
mustThrow(() => buildExecutionSummary({ plan: wrongIssue, acquisitionMap, ownerRegister }), 'C35_ISSUE_NUMBER_MISMATCH');

const wrongRollbackState = clone(plan);
wrongRollbackState.items.find((item) => item.requestKey === 'C30:ROLLBACK_OPERATIONAL_VERIFICATION').currentState = 'REAL_INPUT_REQUIRED';
mustThrow(() => buildExecutionSummary({ plan: wrongRollbackState, acquisitionMap, ownerRegister }), 'C35_ROLLBACK_EXECUTION_STATE_INVALID');

const authorityEscalation = clone(plan);
authorityEscalation.deploymentAuthorized = true;
mustThrow(() => buildExecutionSummary({ plan: authorityEscalation, acquisitionMap, ownerRegister }), 'C35_AUTHORITY_ESCALATION:deploymentAuthorized');

const executedCandidate = clone(plan);
executedCandidate.items.find((item) => item.requestKey === 'C30:ROLLBACK_OPERATIONAL_VERIFICATION').currentState = 'EXECUTED_CANDIDATE_EVIDENCE_PENDING_REVIEW';
const executed = buildExecutionSummary({ plan: executedCandidate, acquisitionMap, ownerRegister });
assert.strictEqual(executed.candidateEvidencePendingReviewCount, 1);
assert.strictEqual(executed.executionScheduledCount, 0);
assert.strictEqual(executed.evidenceSatisfiedCount, 0);
assert.strictEqual(executed.releaseDecisionAuthorized, false);
assert.strictEqual(executed.deploymentAuthorized, false);
assert.strictEqual(executed.programState, 'OWNER_EXECUTION_IN_PROGRESS_CANDIDATE_EVIDENCE_PENDING_REVIEW');

console.log('C35_OWNER_EXECUTION_PLAN=PASS');
console.log('C35_ACCOUNTABLE_OWNER_ASSIGNED=13');
console.log('C35_REAL_EVIDENCE_SATISFIED=0');
console.log('C35_ROLLBACK_EXECUTION_SCHEDULED=1');
console.log('C35_AUTHORITY_SEPARATION=PASS');
