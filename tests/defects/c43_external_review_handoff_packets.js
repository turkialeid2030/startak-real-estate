'use strict';

const { validate } = require('../../tools/c43-external-review-handoff-packets');

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

const r = validate();
assert(r.scope === 'C43_EXTERNAL_REVIEW_HANDOFF_PACKETS_SUMMARY', 'C43_SCOPE_INVALID');
assert(r.reviewCandidateHeadSha === 'db05999e5a3c995235ac290c256251ab1592072b', 'C43_CANDIDATE_INVALID');
assert(r.packetCount === 13, 'C43_PACKET_COUNT_INVALID');
assert(r.c30PacketCount === 8, 'C43_C30_PACKET_COUNT_INVALID');
assert(r.c31PacketCount === 5, 'C43_C31_PACKET_COUNT_INVALID');
assert(r.requestReadyCount === 6, 'C43_REQUEST_READY_COUNT_INVALID');
assert(r.blockedPendingExternalInputsCount === 7, 'C43_BLOCKED_INPUT_COUNT_INVALID');
assert(r.externalReceiptConfirmedCount === 0, 'C43_FALSE_EXTERNAL_RECEIPT');
assert(r.evidenceSatisfiedCount === 0, 'C43_FALSE_GATE_SATISFACTION');
assert(r.engineeringSelfApprovalAllowedCount === 0, 'C43_ENGINEERING_SELF_APPROVAL_INVALID');
assert(r.rollbackReviewerBound === true, 'C43_ROLLBACK_REVIEWER_INVALID');
assert(/^[0-9a-f]{64}$/.test(r.packetArtifactSha256), 'C43_PACKET_HASH_INVALID');
assert(r.releaseDecisionAuthorized === false, 'C43_RELEASE_AUTHORITY_ESCALATION');
assert(r.mergeAuthorized === false, 'C43_MERGE_AUTHORITY_ESCALATION');
assert(r.deploymentAuthorized === false, 'C43_DEPLOY_AUTHORITY_ESCALATION');
assert(r.commercialGoLiveAuthorized === false, 'C43_GO_LIVE_AUTHORITY_ESCALATION');
assert(r.publicAiAuthorized === false, 'C43_PUBLIC_AI_AUTHORITY_ESCALATION');
assert(r.decision === 'HANDOFF_PACKETS_READY_GOVERNING_GATES_REMAIN_HOLD', 'C43_DECISION_INVALID');

console.log('C43_EXTERNAL_REVIEW_HANDOFF_PACKETS=PASS');
console.log(`C43_REVIEW_CANDIDATE_SHA=${r.reviewCandidateHeadSha}`);
console.log(`C43_PACKET_COUNT=${r.packetCount}`);
console.log(`C43_C30_PACKET_COUNT=${r.c30PacketCount}`);
console.log(`C43_C31_PACKET_COUNT=${r.c31PacketCount}`);
console.log(`C43_REQUEST_READY_COUNT=${r.requestReadyCount}`);
console.log(`C43_BLOCKED_PENDING_EXTERNAL_INPUTS_COUNT=${r.blockedPendingExternalInputsCount}`);
console.log(`C43_EXTERNAL_RECEIPT_CONFIRMED_COUNT=${r.externalReceiptConfirmedCount}`);
console.log(`C43_EVIDENCE_SATISFIED_COUNT=${r.evidenceSatisfiedCount}`);
console.log(`C43_PACKET_ARTIFACT_SHA256=${r.packetArtifactSha256}`);
console.log('C43_AUTHORITY_POSTURE=FAIL_CLOSED');
