'use strict';

const { validate } = require('../../tools/c42-external-gate-closure-control');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const result = validate();

assert(result.scope === 'C42_EXTERNAL_GATE_CLOSURE_CONTROL_SUMMARY', 'C42_SCOPE_SUMMARY_INVALID');
assert(result.gateCount === 13, 'C42_GATE_COUNT_INVALID');
assert(result.currentSatisfied === 0, 'C42_FALSE_SATISFACTION');
assert(result.blockingGateCount === 13, 'C42_ALL_GATES_MUST_REMAIN_BLOCKING');
assert(result.externalActionRequiredCount === 13, 'C42_EXTERNAL_ACTION_COUNT_INVALID');
assert(result.engineeringSelfSatisfiableCount === 0, 'C42_ENGINEERING_MUST_NOT_SELF_SATISFY_EXTERNAL_GATES');
assert(result.rollbackReviewerDesignated === true, 'C42_ROLLBACK_REVIEWER_NOT_DESIGNATED');
assert(result.uatPackPrepared === true, 'C42_UAT_PACK_NOT_PREPARED');
assert(result.canonicalSourceBytesSupplied === false, 'C42_CANONICAL_SOURCE_BYTES_FALSELY_SUPPLIED');
assert(result.releaseDecisionAuthorized === false, 'C42_RELEASE_AUTHORITY_ESCALATION');
assert(result.canonicalBaselineActivationAuthorized === false, 'C42_CANONICAL_ACTIVATION_ESCALATION');
assert(result.mergeAuthorized === false, 'C42_MERGE_AUTHORITY_ESCALATION');
assert(result.deploymentAuthorized === false, 'C42_DEPLOY_AUTHORITY_ESCALATION');
assert(result.commercialGoLiveAuthorized === false, 'C42_GO_LIVE_AUTHORITY_ESCALATION');
assert(result.transactionAuthority === false, 'C42_TRANSACTION_AUTHORITY_ESCALATION');
assert(result.approvalAuthorized === false, 'C42_APPROVAL_AUTHORITY_ESCALATION');
assert(result.publicAiAuthorized === false, 'C42_PUBLIC_AI_AUTHORITY_ESCALATION');
assert(result.decision === 'HOLD_EXTERNAL_EVIDENCE_AND_CANONICAL_INPUTS_REQUIRED', 'C42_DECISION_INVALID');

console.log('C42_EXTERNAL_GATE_CLOSURE_CONTROL=PASS');
console.log(`C42_GATE_COUNT=${result.gateCount}`);
console.log(`C42_BLOCKING_GATE_COUNT=${result.blockingGateCount}`);
console.log(`C42_EXTERNAL_ACTION_REQUIRED_COUNT=${result.externalActionRequiredCount}`);
console.log(`C42_ENGINEERING_SELF_SATISFIABLE_COUNT=${result.engineeringSelfSatisfiableCount}`);
console.log('C42_AUTHORITY_POSTURE=FAIL_CLOSED');
