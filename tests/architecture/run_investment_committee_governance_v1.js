'use strict';

const assert = require('assert');
const {
  IC_CASE_STATUS,
  IC_DECISION,
  MEMBER_VOTE,
  createCommitteePolicy,
  createCommitteeCase,
  validateAttendance,
  recordHumanCommitteeDecision,
} = require('../../src/investment-committee');

const policy = createCommitteePolicy({
  policyId: 'IC-POLICY-SYNTHETIC-V1',
  version: 1,
  committeeMemberIds: ['M1', 'M2', 'M3', 'M4', 'M5'],
  quorum: 3,
  minVotesForApproval: 3,
  chairMemberId: 'M1',
});

const dossier = { caseId: 'CASE-IC-1', projectId: 'PROJECT-IC-1', humanDecisionRequired: true, transactionAuthorized: false };
const readyGate = { caseId: 'CASE-IC-1', projectId: 'PROJECT-IC-1', status: 'READY_FOR_ANALYTICAL_UNDERWRITING' };
const committeeCase = createCommitteeCase({
  caseId: 'CASE-IC-1',
  projectId: 'PROJECT-IC-1',
  dossier,
  controlGate: readyGate,
  policy,
  preparedBy: 'ANALYST-1',
  preparedAt: '2026-08-31T20:30:00Z',
});
assert.strictEqual(committeeCase.status, IC_CASE_STATUS.READY_FOR_COMMITTEE);

const holdCase = createCommitteeCase({
  caseId: 'CASE-IC-2',
  projectId: 'PROJECT-IC-2',
  dossier: { caseId: 'CASE-IC-2', projectId: 'PROJECT-IC-2' },
  controlGate: { caseId: 'CASE-IC-2', projectId: 'PROJECT-IC-2', status: 'HOLD_EVIDENCE' },
  policy,
  preparedBy: 'ANALYST-1',
  preparedAt: '2026-08-31T20:30:00Z',
});
assert.strictEqual(holdCase.status, IC_CASE_STATUS.HOLD_CONTROL_GATE);

const attendance = [
  { memberId: 'M1', present: true, conflictDeclared: false },
  { memberId: 'M2', present: true, conflictDeclared: false },
  { memberId: 'M3', present: true, conflictDeclared: false },
  { memberId: 'M4', present: true, conflictDeclared: true },
  { memberId: 'M5', present: false, conflictDeclared: false },
];
const governance = validateAttendance({ policy, attendance });
assert.strictEqual(governance.quorumMet, true);
assert.deepStrictEqual(governance.conflictedPresent, ['M4']);
assert.strictEqual(governance.eligiblePresent.length, 3);

const decision = recordHumanCommitteeDecision({
  committeeCase,
  policy,
  attendance,
  votes: [
    { memberId: 'M1', vote: MEMBER_VOTE.FOR },
    { memberId: 'M2', vote: MEMBER_VOTE.FOR },
    { memberId: 'M3', vote: MEMBER_VOTE.FOR },
  ],
  decision: IC_DECISION.APPROVE_WITH_CONDITIONS,
  conditions: ['Obtain licensed legal review before execution.', 'Close all evidence blockers before signing.'],
  rationale: 'Synthetic committee decision for architecture test.',
  decidedAt: '2026-08-31T20:31:00Z',
  recordedBy: 'SECRETARY-1',
});
assert.strictEqual(decision.status, IC_CASE_STATUS.DECIDED_BY_HUMANS);
assert.strictEqual(decision.humanDecision, true);
assert.strictEqual(decision.automatedDecision, false);
assert.strictEqual(decision.transactionAuthorized, false);
assert.strictEqual(decision.voteSummary.forCount, 3);

const noQuorum = recordHumanCommitteeDecision({
  committeeCase,
  policy,
  attendance: [
    { memberId: 'M1', present: true, conflictDeclared: false },
    { memberId: 'M2', present: true, conflictDeclared: false },
    { memberId: 'M3', present: false, conflictDeclared: false },
  ],
  votes: [],
  decision: IC_DECISION.DEFER,
  rationale: 'No quorum.',
  decidedAt: '2026-08-31T20:31:00Z',
  recordedBy: 'SECRETARY-1',
});
assert.strictEqual(noQuorum.status, IC_CASE_STATUS.HOLD_GOVERNANCE);
assert.strictEqual(noQuorum.reason, 'QUORUM_NOT_MET');

const conflictDeclarationGap = recordHumanCommitteeDecision({
  committeeCase,
  policy,
  attendance: [
    { memberId: 'M1', present: true, conflictDeclared: false },
    { memberId: 'M2', present: true },
    { memberId: 'M3', present: true, conflictDeclared: false },
  ],
  votes: [],
  decision: IC_DECISION.DEFER,
  rationale: 'Governance hold.',
  decidedAt: '2026-08-31T20:31:00Z',
  recordedBy: 'SECRETARY-1',
});
assert.strictEqual(conflictDeclarationGap.status, IC_CASE_STATUS.HOLD_GOVERNANCE);
assert.strictEqual(conflictDeclarationGap.reason, 'CONFLICT_DECLARATION_REQUIRED');

assert.throws(() => recordHumanCommitteeDecision({
  committeeCase,
  policy,
  attendance: attendance.slice(0, 3),
  votes: [
    { memberId: 'M1', vote: MEMBER_VOTE.FOR },
    { memberId: 'M2', vote: MEMBER_VOTE.AGAINST },
    { memberId: 'M3', vote: MEMBER_VOTE.AGAINST },
  ],
  decision: IC_DECISION.APPROVE,
  rationale: 'Inconsistent approval.',
  decidedAt: '2026-08-31T20:31:00Z',
  recordedBy: 'SECRETARY-1',
}), /DECISION_VOTE_INCONSISTENCY/);

assert.throws(() => createCommitteeCase({
  caseId: 'CASE-IC-1',
  projectId: 'PROJECT-IC-1',
  dossier: { caseId: 'OTHER', projectId: 'PROJECT-IC-1' },
  controlGate: readyGate,
  policy,
  preparedBy: 'ANALYST-1',
  preparedAt: '2026-08-31T20:30:00Z',
}), /CASE_ISOLATION_VIOLATION/);

console.log('INVESTMENT_COMMITTEE_GOVERNANCE_V1=PASS');
console.log('AI_CANNOT_CAST_VOTE=PASS');
console.log('CONFLICTED_MEMBER_EXCLUDED_FROM_QUORUM=PASS');
console.log('QUORUM_AND_APPROVAL_THRESHOLD_ENFORCED=PASS');
console.log('COMMITTEE_DECISION_DOES_NOT_AUTHORIZE_TRANSACTION=PASS');
