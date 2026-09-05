'use strict';

const {
  INTEGRATION_OPERATION,
  INTEGRATION_WRITE_TARGET,
} = require('./integration-envelope');

const WRITE_LIFECYCLE_STATUS = Object.freeze({
  PROPOSED: 'PROPOSED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  COMMITTED: 'COMMITTED',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function requireString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function normalizeIsoTimestamp(value, field) {
  requireString(value, field);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return date.toISOString();
}

function normalizeSha256(value, field) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new TypeError(`${field} must be a 64-character SHA-256 hex digest`);
  }
  return value.toLowerCase();
}

function normalizeRefs(value, field) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value)) throw new TypeError(`${field} must be an array`);
  return Object.freeze([...new Set(value.map((item) => requireString(String(item), field)))]);
}

function assertWriteEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') throw new TypeError('envelope must be an object');
  if (envelope.operation !== INTEGRATION_OPERATION.PROPOSE_WRITE) {
    const error = new Error('Write lifecycle requires a PROPOSE_WRITE integration envelope');
    error.code = 'PROPOSE_WRITE_ENVELOPE_REQUIRED';
    throw error;
  }
  if (!Object.values(INTEGRATION_WRITE_TARGET).includes(envelope.writeTarget)) {
    const error = new Error('Write lifecycle requires a supported writeTarget');
    error.code = 'SUPPORTED_WRITE_TARGET_REQUIRED';
    throw error;
  }
  if (envelope.humanApprovalRequired !== true || envelope.directWriteAuthorized !== false) {
    const error = new Error('Write envelope must remain human-approved and non-direct');
    error.code = 'WRITE_ENVELOPE_GOVERNANCE_INVALID';
    throw error;
  }
}

function createWriteProposal({
  proposalId,
  envelope,
  targetPath,
  proposedValueHashSha256,
  reason,
  evidenceRefs = [],
  proposedAt,
  proposedBy,
  correlationId,
} = {}) {
  assertWriteEnvelope(envelope);

  return deepFreeze({
    schemaVersion: 1,
    proposalId: requireString(proposalId, 'proposalId'),
    status: WRITE_LIFECYCLE_STATUS.PROPOSED,
    caseId: requireString(envelope.caseId, 'envelope.caseId'),
    projectId: requireString(envelope.projectId, 'envelope.projectId'),
    adapterId: requireString(envelope.adapterId, 'envelope.adapterId'),
    sourceSystem: requireString(envelope.sourceSystem, 'envelope.sourceSystem'),
    sourceObjectId: requireString(envelope.sourceObjectId, 'envelope.sourceObjectId'),
    writeTarget: envelope.writeTarget,
    targetPath: requireString(targetPath, 'targetPath'),
    proposedValueHashSha256: normalizeSha256(proposedValueHashSha256, 'proposedValueHashSha256'),
    reason: requireString(reason, 'reason'),
    evidenceRefs: normalizeRefs(evidenceRefs, 'evidenceRefs'),
    proposedAt: normalizeIsoTimestamp(proposedAt, 'proposedAt'),
    proposedBy: requireString(proposedBy, 'proposedBy'),
    correlationId: requireString(correlationId, 'correlationId'),
    approval: null,
    commit: null,
    eligibleForGovernedCommit: false,
    directWriteAuthorized: false,
    transactionAuthorized: false,
  });
}

function approveWriteProposal({ proposal, approvalId, approvedBy, approvedAt, approvalReason } = {}) {
  if (!proposal || proposal.status !== WRITE_LIFECYCLE_STATUS.PROPOSED) {
    const error = new Error('Only PROPOSED writes can be approved');
    error.code = 'WRITE_NOT_PROPOSED';
    throw error;
  }

  return deepFreeze({
    ...proposal,
    status: WRITE_LIFECYCLE_STATUS.APPROVED,
    approval: {
      approvalId: requireString(approvalId, 'approvalId'),
      actorType: 'HUMAN',
      approvedBy: requireString(approvedBy, 'approvedBy'),
      approvedAt: normalizeIsoTimestamp(approvedAt, 'approvedAt'),
      approvalReason: requireString(approvalReason, 'approvalReason'),
    },
    eligibleForGovernedCommit: true,
    directWriteAuthorized: false,
    transactionAuthorized: false,
  });
}

function rejectWriteProposal({ proposal, rejectionId, rejectedBy, rejectedAt, rejectionReason } = {}) {
  if (!proposal || proposal.status !== WRITE_LIFECYCLE_STATUS.PROPOSED) {
    const error = new Error('Only PROPOSED writes can be rejected');
    error.code = 'WRITE_NOT_PROPOSED';
    throw error;
  }

  return deepFreeze({
    ...proposal,
    status: WRITE_LIFECYCLE_STATUS.REJECTED,
    approval: {
      rejectionId: requireString(rejectionId, 'rejectionId'),
      actorType: 'HUMAN',
      rejectedBy: requireString(rejectedBy, 'rejectedBy'),
      rejectedAt: normalizeIsoTimestamp(rejectedAt, 'rejectedAt'),
      rejectionReason: requireString(rejectionReason, 'rejectionReason'),
    },
    eligibleForGovernedCommit: false,
    directWriteAuthorized: false,
    transactionAuthorized: false,
  });
}

function recordGovernedWriteCommit({
  approvedProposal,
  commitId,
  committedBy,
  committedAt,
  priorStateHashSha256,
  newStateHashSha256,
  auditEventId,
} = {}) {
  if (!approvedProposal || approvedProposal.status !== WRITE_LIFECYCLE_STATUS.APPROVED || approvedProposal.eligibleForGovernedCommit !== true) {
    const error = new Error('Only APPROVED writes are eligible for governed commit recording');
    error.code = 'APPROVED_WRITE_REQUIRED';
    throw error;
  }

  return deepFreeze({
    ...approvedProposal,
    status: WRITE_LIFECYCLE_STATUS.COMMITTED,
    commit: {
      commitId: requireString(commitId, 'commitId'),
      committedBy: requireString(committedBy, 'committedBy'),
      committedAt: normalizeIsoTimestamp(committedAt, 'committedAt'),
      priorStateHashSha256: normalizeSha256(priorStateHashSha256, 'priorStateHashSha256'),
      newStateHashSha256: normalizeSha256(newStateHashSha256, 'newStateHashSha256'),
      auditEventId: requireString(auditEventId, 'auditEventId'),
    },
    eligibleForGovernedCommit: false,
    directWriteAuthorized: false,
    transactionAuthorized: false,
    semantics: 'COMMITTED records that a separately governed writer applied an approved canonical change. This lifecycle object never writes external systems, deterministic outputs, decision-control state, or final investment decisions itself.',
  });
}

module.exports = {
  WRITE_LIFECYCLE_STATUS,
  createWriteProposal,
  approveWriteProposal,
  rejectWriteProposal,
  recordGovernedWriteCommit,
};