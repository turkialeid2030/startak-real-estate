'use strict';

const IC_CASE_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  READY_FOR_COMMITTEE: 'READY_FOR_COMMITTEE',
  HOLD_CONTROL_GATE: 'HOLD_CONTROL_GATE',
  HOLD_GOVERNANCE: 'HOLD_GOVERNANCE',
  DECIDED_BY_HUMANS: 'DECIDED_BY_HUMANS',
});

const IC_DECISION = Object.freeze({
  APPROVE: 'APPROVE',
  APPROVE_WITH_CONDITIONS: 'APPROVE_WITH_CONDITIONS',
  DEFER: 'DEFER',
  REJECT: 'REJECT',
});

const MEMBER_VOTE = Object.freeze({
  FOR: 'FOR',
  AGAINST: 'AGAINST',
  ABSTAIN: 'ABSTAIN',
});

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function uniqueStrings(values, field) {
  if (!Array.isArray(values)) throw new TypeError(`${field} must be an array`);
  const normalized = values.map((value) => requiredString(value, field));
  if (new Set(normalized).size !== normalized.length) throw new Error(`${field} must not contain duplicates`);
  return normalized;
}

function createCommitteePolicy({
  policyId,
  version,
  committeeMemberIds,
  quorum,
  minVotesForApproval,
  chairMemberId = null,
  requireConflictDeclaration = true,
}) {
  requiredString(policyId, 'policyId');
  if (!Number.isInteger(version) || version < 1) throw new TypeError('version must be integer >= 1');
  const members = uniqueStrings(committeeMemberIds, 'committeeMemberIds');
  if (!Number.isInteger(quorum) || quorum < 1 || quorum > members.length) throw new RangeError('quorum must be between 1 and committee size');
  if (!Number.isInteger(minVotesForApproval) || minVotesForApproval < 1 || minVotesForApproval > quorum) throw new RangeError('minVotesForApproval must be between 1 and quorum');
  if (chairMemberId !== null && !members.includes(chairMemberId)) throw new Error('chairMemberId must be a committee member');
  return freeze({
    schemaVersion: 1,
    policyId,
    version,
    committeeMemberIds: members,
    quorum,
    minVotesForApproval,
    chairMemberId,
    requireConflictDeclaration: Boolean(requireConflictDeclaration),
  });
}

function createCommitteeCase({
  caseId,
  projectId,
  dossier,
  controlGate,
  policy,
  preparedBy,
  preparedAt,
}) {
  requiredString(caseId, 'caseId');
  requiredString(projectId, 'projectId');
  requiredString(preparedBy, 'preparedBy');
  requiredString(preparedAt, 'preparedAt');
  if (!dossier || typeof dossier !== 'object') throw new TypeError('dossier is required');
  if (!controlGate || typeof controlGate !== 'object') throw new TypeError('controlGate is required');
  if (!policy || typeof policy !== 'object') throw new TypeError('policy is required');
  if (dossier.caseId && dossier.caseId !== caseId) throw new Error('CASE_ISOLATION_VIOLATION: dossier case mismatch');
  if (controlGate.caseId && controlGate.caseId !== caseId) throw new Error('CASE_ISOLATION_VIOLATION: control gate case mismatch');
  if (dossier.projectId && dossier.projectId !== projectId) throw new Error('PROJECT_ISOLATION_VIOLATION: dossier project mismatch');

  const gateReady = controlGate.status === 'READY_FOR_ANALYTICAL_UNDERWRITING';
  return freeze({
    schemaVersion: 1,
    caseId,
    projectId,
    policyRef: { policyId: policy.policyId, version: policy.version },
    status: gateReady ? IC_CASE_STATUS.READY_FOR_COMMITTEE : IC_CASE_STATUS.HOLD_CONTROL_GATE,
    preparedBy,
    preparedAt,
    dossier,
    controlGate,
    governanceNote: 'The committee case is decision support only. No automated engine or AI may cast a vote or make the committee decision.',
  });
}

function validateAttendance({ policy, attendance }) {
  if (!Array.isArray(attendance)) throw new TypeError('attendance must be an array');
  const seen = new Set();
  const eligiblePresent = [];
  const conflictedPresent = [];
  const declarationGaps = [];

  for (const item of attendance) {
    if (!item || typeof item !== 'object') throw new TypeError('attendance item must be an object');
    requiredString(item.memberId, 'memberId');
    if (!policy.committeeMemberIds.includes(item.memberId)) throw new Error(`NON_MEMBER_ATTENDANCE: ${item.memberId}`);
    if (seen.has(item.memberId)) throw new Error(`DUPLICATE_ATTENDANCE: ${item.memberId}`);
    seen.add(item.memberId);
    if (policy.requireConflictDeclaration && typeof item.conflictDeclared !== 'boolean') declarationGaps.push(item.memberId);
    if (item.present !== true) continue;
    if (item.conflictDeclared === true) conflictedPresent.push(item.memberId);
    else eligiblePresent.push(item.memberId);
  }

  return freeze({
    eligiblePresent,
    conflictedPresent,
    declarationGaps,
    quorumMet: eligiblePresent.length >= policy.quorum,
  });
}

function recordHumanCommitteeDecision({
  committeeCase,
  policy,
  attendance,
  votes,
  decision,
  conditions = [],
  rationale,
  decidedAt,
  recordedBy,
}) {
  if (!committeeCase || committeeCase.status !== IC_CASE_STATUS.READY_FOR_COMMITTEE) {
    throw new Error('COMMITTEE_CASE_NOT_READY');
  }
  if (!Object.values(IC_DECISION).includes(decision)) throw new TypeError(`invalid committee decision: ${decision}`);
  requiredString(rationale, 'rationale');
  requiredString(decidedAt, 'decidedAt');
  requiredString(recordedBy, 'recordedBy');
  const governance = validateAttendance({ policy, attendance });
  if (governance.declarationGaps.length) return freeze({ status: IC_CASE_STATUS.HOLD_GOVERNANCE, reason: 'CONFLICT_DECLARATION_REQUIRED', governance });
  if (!governance.quorumMet) return freeze({ status: IC_CASE_STATUS.HOLD_GOVERNANCE, reason: 'QUORUM_NOT_MET', governance });
  if (!Array.isArray(votes)) throw new TypeError('votes must be an array');

  const voteByMember = new Map();
  for (const vote of votes) {
    if (!vote || typeof vote !== 'object') throw new TypeError('vote must be an object');
    requiredString(vote.memberId, 'vote.memberId');
    if (!governance.eligiblePresent.includes(vote.memberId)) throw new Error(`INELIGIBLE_VOTE: ${vote.memberId}`);
    if (!Object.values(MEMBER_VOTE).includes(vote.vote)) throw new TypeError(`invalid member vote: ${vote.vote}`);
    if (voteByMember.has(vote.memberId)) throw new Error(`DUPLICATE_VOTE: ${vote.memberId}`);
    voteByMember.set(vote.memberId, vote.vote);
  }

  for (const memberId of governance.eligiblePresent) {
    if (!voteByMember.has(memberId)) throw new Error(`MISSING_MEMBER_VOTE: ${memberId}`);
  }

  const forCount = [...voteByMember.values()].filter((value) => value === MEMBER_VOTE.FOR).length;
  const againstCount = [...voteByMember.values()].filter((value) => value === MEMBER_VOTE.AGAINST).length;
  const abstainCount = [...voteByMember.values()].filter((value) => value === MEMBER_VOTE.ABSTAIN).length;
  const approvalThresholdMet = forCount >= policy.minVotesForApproval;

  if ([IC_DECISION.APPROVE, IC_DECISION.APPROVE_WITH_CONDITIONS].includes(decision) && !approvalThresholdMet) {
    throw new Error('DECISION_VOTE_INCONSISTENCY: approval decision without required votes');
  }
  if (decision === IC_DECISION.APPROVE_WITH_CONDITIONS && (!Array.isArray(conditions) || conditions.length === 0)) {
    throw new Error('APPROVAL_CONDITIONS_REQUIRED');
  }

  return freeze({
    schemaVersion: 1,
    caseId: committeeCase.caseId,
    projectId: committeeCase.projectId,
    status: IC_CASE_STATUS.DECIDED_BY_HUMANS,
    decision,
    conditions: Array.isArray(conditions) ? conditions.map(String) : [],
    rationale,
    decidedAt,
    recordedBy,
    governance,
    voteSummary: { forCount, againstCount, abstainCount, approvalThresholdMet },
    humanDecision: true,
    automatedDecision: false,
    transactionAuthorized: false,
    executionNote: 'This record documents the human committee decision. Transaction execution, contracting, regulated professional opinions and delegated authorities remain separate controlled workflows.',
  });
}

module.exports = {
  IC_CASE_STATUS,
  IC_DECISION,
  MEMBER_VOTE,
  createCommitteePolicy,
  createCommitteeCase,
  validateAttendance,
  recordHumanCommitteeDecision,
};
