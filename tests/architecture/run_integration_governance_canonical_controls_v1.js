'use strict';

const assert = require('assert');
const {
  INTEGRATION_OPERATION,
  INTEGRATION_WRITE_TARGET,
  createIntegrationEnvelope,
} = require('../../src/integration-governance/integration-envelope');
const {
  SOURCE_CLASS,
  SOURCE_VERIFICATION_STATUS,
  DATA_QUALITY_STATUS,
  createCanonicalSourceMetadata,
} = require('../../src/integration-governance/canonical-source-metadata');
const {
  AUDIT_EVENT_TYPE,
  AUDIT_ACTOR_TYPE,
  createIntegrationAuditEvent,
} = require('../../src/integration-governance/audit-event');
const {
  createAdapterPermissionPolicy,
  evaluateAdapterPermission,
} = require('../../src/integration-governance/adapter-permission-policy');
const {
  WRITE_LIFECYCLE_STATUS,
  createWriteProposal,
  approveWriteProposal,
  rejectWriteProposal,
  recordGovernedWriteCommit,
} = require('../../src/integration-governance/write-lifecycle');

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const SHA_C = 'c'.repeat(64);

function proposedCanonicalWriteEnvelope(overrides = {}) {
  return createIntegrationEnvelope({
    adapterId: 'adapter.spreadsheet.v1',
    operation: INTEGRATION_OPERATION.PROPOSE_WRITE,
    caseId: 'CASE-IA-2-001',
    projectId: 'PROJECT-IA-2-001',
    sourceSystem: 'CONTROLLED_SPREADSHEET',
    sourceObjectId: 'WORKBOOK-001',
    sourceVersion: 'v1',
    observedAt: '2026-09-05T10:00:00Z',
    payload: { caseId: 'CASE-IA-2-001', projectId: 'PROJECT-IA-2-001', field: 'financial.opex' },
    contentHashSha256: SHA_A,
    requestedBy: 'user:tester',
    writeTarget: INTEGRATION_WRITE_TARGET.CANONICAL_INPUT,
    ...overrides,
  });
}

(function testCanonicalSourceMetadataIsScopedAndImmutable() {
  const source = createCanonicalSourceMetadata({
    metadataId: 'SRCMETA-001',
    caseId: 'CASE-IA-2-001',
    projectId: 'PROJECT-IA-2-001',
    semanticKey: 'property.title.deedNumber',
    sourceClass: SOURCE_CLASS.OFFICIAL_PRIMARY,
    sourceSystem: 'OFFICIAL_REGISTRY',
    sourceObjectId: 'DEED-001',
    sourceVersion: '2026-09-05',
    sourceRef: 'REGISTRY:DEED-001',
    evidenceRefs: ['EV-1', 'EV-1', 'EV-2'],
    observedAt: '2026-09-05T10:00:00Z',
    effectiveDate: '2026-09-05T00:00:00Z',
    contentHashSha256: SHA_A,
    verificationStatus: SOURCE_VERIFICATION_STATUS.VERIFIED,
    dataQualityStatus: DATA_QUALITY_STATUS.QUALIFIED,
    authorityScope: 'OWNERSHIP_IDENTITY_ONLY',
    createdAt: '2026-09-05T10:01:00Z',
    createdBy: 'human:reviewer-1',
  });

  assert.strictEqual(source.authoritativeForDecision, true);
  assert.strictEqual(source.transactionAuthorized, false);
  assert.deepStrictEqual(source.evidenceRefs, ['EV-1', 'EV-2']);
  assert.strictEqual(Object.isFrozen(source), true);
})();

(function testAiInterpretationCannotBecomeVerifiedAuthority() {
  assert.throws(() => createCanonicalSourceMetadata({
    metadataId: 'SRCMETA-AI-001',
    caseId: 'CASE-IA-2-001',
    projectId: 'PROJECT-IA-2-001',
    semanticKey: 'ai.summary',
    sourceClass: SOURCE_CLASS.AI_INTERPRETATION,
    sourceSystem: 'OPENAI',
    sourceObjectId: 'AI-OUT-001',
    sourceVersion: 'v1',
    sourceRef: 'AI:AI-OUT-001',
    observedAt: '2026-09-05T10:00:00Z',
    verificationStatus: SOURCE_VERIFICATION_STATUS.VERIFIED,
    dataQualityStatus: DATA_QUALITY_STATUS.QUALIFIED,
    authorityScope: 'NARRATIVE_ONLY',
    createdAt: '2026-09-05T10:01:00Z',
    createdBy: 'service:ai',
  }), (error) => error.code === 'AI_SOURCE_CANNOT_BE_VERIFIED_AUTHORITY');
})();

(function testSystemCalculatedRequiresDerivationReference() {
  assert.throws(() => createCanonicalSourceMetadata({
    metadataId: 'SRCMETA-CALC-001',
    caseId: 'CASE-IA-2-001',
    projectId: 'PROJECT-IA-2-001',
    semanticKey: 'financial.irr',
    sourceClass: SOURCE_CLASS.SYSTEM_CALCULATED,
    sourceSystem: 'STARTAK_FINANCIAL_ENGINE',
    sourceObjectId: 'CALC-001',
    sourceVersion: 'engine-v1',
    sourceRef: 'CALC:001',
    observedAt: '2026-09-05T10:00:00Z',
    verificationStatus: SOURCE_VERIFICATION_STATUS.NOT_VERIFIED,
    dataQualityStatus: DATA_QUALITY_STATUS.QUALIFIED,
    authorityScope: 'DETERMINISTIC_OUTPUT',
    createdAt: '2026-09-05T10:01:00Z',
    createdBy: 'system:financial-engine',
  }), (error) => error.code === 'DERIVATION_REFERENCE_REQUIRED');
})();

(function testAdapterPermissionAllowsOnlyExplicitProposedWriteTarget() {
  const envelope = proposedCanonicalWriteEnvelope();
  const policy = createAdapterPermissionPolicy({
    policyId: 'POLICY-001',
    adapterId: 'adapter.spreadsheet.v1',
    allowedOperations: [INTEGRATION_OPERATION.READ, INTEGRATION_OPERATION.PROPOSE_WRITE],
    allowedReadDomains: ['financial'],
    allowedWriteTargets: [INTEGRATION_WRITE_TARGET.CANONICAL_INPUT],
    allowedSourceSystems: ['CONTROLLED_SPREADSHEET'],
    caseScope: 'CASE-IA-2-001',
    projectScope: 'PROJECT-IA-2-001',
  });

  const decision = evaluateAdapterPermission({ policy, envelope });
  assert.strictEqual(decision.allowed, true);
  assert.strictEqual(decision.humanApprovalStillRequired, true);
  assert.strictEqual(decision.directWriteAuthorized, false);
  assert.strictEqual(decision.transactionAuthorized, false);
})();

(function testAdapterPermissionFailsClosedOnWrongSourceSystem() {
  const envelope = proposedCanonicalWriteEnvelope({ sourceSystem: 'UNAPPROVED_SOURCE' });
  const policy = createAdapterPermissionPolicy({
    policyId: 'POLICY-002',
    adapterId: 'adapter.spreadsheet.v1',
    allowedOperations: [INTEGRATION_OPERATION.PROPOSE_WRITE],
    allowedWriteTargets: [INTEGRATION_WRITE_TARGET.CANONICAL_INPUT],
    allowedSourceSystems: ['CONTROLLED_SPREADSHEET'],
  });

  const decision = evaluateAdapterPermission({ policy, envelope });
  assert.strictEqual(decision.allowed, false);
  assert.ok(decision.reasonCodes.includes('SOURCE_SYSTEM_NOT_ALLOWED'));
})();

(function testWriteLifecycleRequiresHumanApprovalBeforeCommit() {
  const envelope = proposedCanonicalWriteEnvelope();
  const proposal = createWriteProposal({
    proposalId: 'WRITE-001',
    envelope,
    targetPath: 'financial.opex',
    proposedValueHashSha256: SHA_B,
    reason: 'Controlled spreadsheet import candidate.',
    evidenceRefs: ['EV-OPEX-1'],
    proposedAt: '2026-09-05T10:02:00Z',
    proposedBy: 'user:tester',
    correlationId: 'CORR-001',
  });

  assert.strictEqual(proposal.status, WRITE_LIFECYCLE_STATUS.PROPOSED);
  assert.strictEqual(proposal.eligibleForGovernedCommit, false);
  assert.throws(() => recordGovernedWriteCommit({
    approvedProposal: proposal,
    commitId: 'COMMIT-INVALID',
    committedBy: 'service:canonical-writer',
    committedAt: '2026-09-05T10:03:00Z',
    priorStateHashSha256: SHA_A,
    newStateHashSha256: SHA_B,
    auditEventId: 'AUDIT-INVALID',
  }), (error) => error.code === 'APPROVED_WRITE_REQUIRED');

  const approved = approveWriteProposal({
    proposal,
    approvalId: 'APPROVAL-001',
    approvedBy: 'human:investment-analyst',
    approvedAt: '2026-09-05T10:04:00Z',
    approvalReason: 'Evidence and import diff reviewed.',
  });

  assert.strictEqual(approved.status, WRITE_LIFECYCLE_STATUS.APPROVED);
  assert.strictEqual(approved.approval.actorType, 'HUMAN');
  assert.strictEqual(approved.eligibleForGovernedCommit, true);
  assert.strictEqual(approved.directWriteAuthorized, false);

  const committed = recordGovernedWriteCommit({
    approvedProposal: approved,
    commitId: 'COMMIT-001',
    committedBy: 'service:canonical-writer',
    committedAt: '2026-09-05T10:05:00Z',
    priorStateHashSha256: SHA_A,
    newStateHashSha256: SHA_B,
    auditEventId: 'AUDIT-003',
  });

  assert.strictEqual(committed.status, WRITE_LIFECYCLE_STATUS.COMMITTED);
  assert.strictEqual(committed.transactionAuthorized, false);
  assert.strictEqual(committed.directWriteAuthorized, false);
})();

(function testRejectedWriteCannotBeCommitted() {
  const proposal = createWriteProposal({
    proposalId: 'WRITE-002',
    envelope: proposedCanonicalWriteEnvelope(),
    targetPath: 'financial.opex',
    proposedValueHashSha256: SHA_C,
    reason: 'Deliberate rejection test.',
    proposedAt: '2026-09-05T11:00:00Z',
    proposedBy: 'user:tester',
    correlationId: 'CORR-002',
  });

  const rejected = rejectWriteProposal({
    proposal,
    rejectionId: 'REJECTION-001',
    rejectedBy: 'human:reviewer',
    rejectedAt: '2026-09-05T11:01:00Z',
    rejectionReason: 'Source evidence does not support proposed value.',
  });

  assert.strictEqual(rejected.status, WRITE_LIFECYCLE_STATUS.REJECTED);
  assert.throws(() => recordGovernedWriteCommit({
    approvedProposal: rejected,
    commitId: 'COMMIT-002',
    committedBy: 'service:canonical-writer',
    committedAt: '2026-09-05T11:02:00Z',
    priorStateHashSha256: SHA_A,
    newStateHashSha256: SHA_C,
    auditEventId: 'AUDIT-004',
  }), (error) => error.code === 'APPROVED_WRITE_REQUIRED');
})();

(function testApprovalAuditRequiresHumanActor() {
  assert.throws(() => createIntegrationAuditEvent({
    eventId: 'AUDIT-001',
    eventType: AUDIT_EVENT_TYPE.WRITE_APPROVED,
    occurredAt: '2026-09-05T12:00:00Z',
    actorType: AUDIT_ACTOR_TYPE.SERVICE,
    actorId: 'service:auto-approver',
    caseId: 'CASE-IA-2-001',
    projectId: 'PROJECT-IA-2-001',
    action: 'APPROVE_CANONICAL_WRITE',
    reasonCode: 'TEST',
    correlationId: 'CORR-003',
    schemaVersionRef: 'integration-write-v1',
  }), (error) => error.code === 'HUMAN_AUDIT_ACTOR_REQUIRED');
})();

(function testHumanApprovalAuditIsImmutable() {
  const event = createIntegrationAuditEvent({
    eventId: 'AUDIT-002',
    eventType: AUDIT_EVENT_TYPE.WRITE_APPROVED,
    occurredAt: '2026-09-05T12:00:00Z',
    actorType: AUDIT_ACTOR_TYPE.HUMAN,
    actorId: 'human:reviewer',
    caseId: 'CASE-IA-2-001',
    projectId: 'PROJECT-IA-2-001',
    action: 'APPROVE_CANONICAL_WRITE',
    reasonCode: 'EVIDENCE_REVIEW_COMPLETE',
    correlationId: 'CORR-004',
    adapterId: 'adapter.spreadsheet.v1',
    sourceRefs: ['WORKBOOK-001'],
    evidenceRefs: ['EV-OPEX-1'],
    priorStateHashSha256: SHA_A,
    newStateHashSha256: SHA_B,
    schemaVersionRef: 'integration-write-v1',
    metadata: { targetPath: 'financial.opex' },
  });

  assert.strictEqual(Object.isFrozen(event), true);
  assert.strictEqual(Object.isFrozen(event.metadata), true);
  assert.strictEqual(event.transactionAuthorized, false);
})();

console.log('run_integration_governance_canonical_controls_v1: PASS');