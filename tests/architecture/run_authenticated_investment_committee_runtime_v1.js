'use strict';

const assert = require('assert');
const { createVerifiedIdentityContext } = require('../../src/security/verified-identity-context');
const { createCanonicalWorkspacePersistence } = require('../../src/runtime/canonical-workspace-persistence');
const { createCanonicalWorkspaceRuntime } = require('../../src/runtime/canonical-workspace-runtime');
const { createAuthenticatedCanonicalWorkspaceService } = require('../../src/runtime/authenticated-canonical-workspace-service');
const { createAuthenticatedDecisionIntelligenceService } = require('../../src/runtime/authenticated-decision-intelligence-service');
const { createAuthenticatedInvestmentCommitteeService } = require('../../src/runtime/authenticated-investment-committee-service');
const { AI_ROLE, AI_STAGE_STATUS } = require('../../src/decision-intelligence/ai-expert-orchestrator');
const { buildDecisionActionRegister } = require('../../src/decision-actions');
const {
  IC_DECISION,
  MEMBER_VOTE,
  createCommitteePolicy,
} = require('../../src/investment-committee');

const NOW = 1_800_000_000;

function identityContext({ sub, tenantId = 'tenant-a', roles }) {
  return createVerifiedIdentityContext({
    claims: {
      sub,
      tenant_id: tenantId,
      roles,
      iss: 'https://issuer.example/',
      aud: 'startak-real-estate-api',
      exp: NOW + 300,
    },
    tokenVerificationEvidence: { verified: true, verificationRef: `IC-${sub}` },
    requiredTenantId: tenantId,
    nowEpochSeconds: NOW,
  });
}

function authenticator() {
  const identities = {
    'Bearer analyst-token': identityContext({ sub: 'analyst-1', roles: ['ANALYST'] }),
    'Bearer ic-token': identityContext({ sub: 'member-1', roles: ['IC_MEMBER'] }),
  };
  return Object.freeze({
    async authenticate({ authorizationHeader, requiredTenantId }) {
      const context = identities[authorizationHeader];
      if (!context) return { authorizationReady: false, identityContext: null };
      if (requiredTenantId && context.identity.tenantId !== requiredTenantId) {
        return { authorizationReady: false, identityContext: null };
      }
      return { authorizationReady: true, identityContext: context };
    },
  });
}

function atomicMemoryProvider() {
  const values = new Map();
  return {
    values,
    providerName() { return 'InvestmentCommitteeMemoryProvider'; },
    async get(key) { return values.has(key) ? values.get(key) : null; },
    async compareAndSet(key, expectedRaw, nextRaw) {
      const current = values.has(key) ? values.get(key) : null;
      if (current !== expectedRaw) return false;
      values.set(key, nextRaw);
      return true;
    },
  };
}

function canonicalWorkspace() {
  return Object.freeze({
    schemaVersion: 1,
    workspaceId: 'WS-IC-001',
    projectId: 'PROJECT-IC-001',
    caseId: 'CASE-IC-001',
    status: 'CASE_ASSEMBLED',
    attribution: Object.freeze({ actorId: 'analyst-1', actorRole: 'ANALYST', source: 'IN_APP' }),
    executableCase: Object.freeze({ projectId: 'PROJECT-IC-001', caseId: 'CASE-IC-001' }),
    authority: Object.freeze({
      operatingMode: 'UNLICENSED_DECISION_SUPPORT',
      professionalReportExternalIssuanceAuthorized: false,
      releaseAuthorized: false,
      mergeAuthorized: false,
      deploymentAuthorized: false,
      transactionAuthorized: false,
    }),
  });
}

function analyticalArtifacts({ includeAi = true } = {}) {
  const caseId = 'CASE-IC-001';
  const projectId = 'PROJECT-IC-001';
  return {
    studyOrchestration: { caseId, projectId, status: 'READY_FOR_AI_AND_HUMAN_REVIEW' },
    decisionQuality: {
      caseId,
      projectId,
      status: 'READY_FOR_HUMAN_REVIEW',
      reliability: { overallReliability: 'HIGH' },
      dueDiligence: { nextBestAction: 'VERIFY_SOURCE_DOCUMENTS' },
      requiredActions: [],
    },
    evidenceRecords: [{
      caseId,
      projectId,
      id: 'E-IC-1',
      domain: 'LEGAL',
      label: 'Title evidence',
      sourceRef: 'DOC-IC-1',
      status: 'CURRENT',
      verified: true,
      stale: false,
      conflict: false,
    }],
    assumptionRecords: [{
      caseId,
      projectId,
      id: 'A-IC-1',
      domain: 'MARKET',
      label: 'Rent growth',
      valueDisplay: '2%',
      basis: 'Scenario assumption',
      material: true,
      sensitivityRequired: true,
      approved: true,
      evidenceRefs: ['E-IC-1'],
    }],
    aiOutputs: includeAi
      ? [AI_ROLE.ANALYST, AI_ROLE.CHALLENGER, AI_ROLE.SYNTHESIZER].map((role) => ({
        caseId,
        projectId,
        role,
        status: AI_STAGE_STATUS.OUTPUT_ACCEPTED,
        narrative: `${role} bounded narrative`,
        citedEvidenceRefs: ['E-IC-1'],
        uncertainties: [],
        disagreements: [],
        diligenceSuggestions: [],
      }))
      : [],
  };
}

function controlGate() {
  return Object.freeze({
    caseId: 'CASE-IC-001',
    projectId: 'PROJECT-IC-001',
    status: 'READY_FOR_ANALYTICAL_UNDERWRITING',
  });
}

async function main() {
  let checks = 0;
  async function check(fn) { await fn(); checks++; }

  const auth = authenticator();
  const provider = atomicMemoryProvider();
  const persistence = createCanonicalWorkspacePersistence({
    storageProvider: provider,
    now: () => '2026-09-09T15:00:00Z',
  });
  const runtime = createCanonicalWorkspaceRuntime({ persistence });
  const workspaceService = createAuthenticatedCanonicalWorkspaceService({
    authenticator: auth,
    runtime,
    requiredTenantId: 'tenant-a',
  });
  const decisionIntelligenceService = createAuthenticatedDecisionIntelligenceService({ workspaceService });
  const icService = createAuthenticatedInvestmentCommitteeService({
    authenticator: auth,
    workspaceService,
    decisionIntelligenceService,
    requiredTenantId: 'tenant-a',
  });

  await workspaceService.saveWorkspace({
    authorizationHeader: 'Bearer analyst-token',
    workspace: canonicalWorkspace(),
    expectedVersion: 0,
    operationId: 'IC-WORKSPACE-SAVE-001',
    occurredAt: '2026-09-09T15:00:00Z',
    nowEpochSeconds: NOW,
  });

  const committeePolicy = createCommitteePolicy({
    policyId: 'IC-POLICY-1',
    version: 1,
    committeeMemberIds: ['member-1', 'member-2', 'member-3'],
    quorum: 2,
    minVotesForApproval: 2,
    chairMemberId: 'member-1',
    requireConflictDeclaration: true,
  });
  const actionRegister = buildDecisionActionRegister({
    caseId: 'CASE-IC-001',
    projectId: 'PROJECT-IC-001',
    actions: [],
  });

  const prepared = await icService.prepareCommitteeCase({
    authorizationHeader: 'Bearer analyst-token',
    workspaceId: 'WS-IC-001',
    nowEpochSeconds: NOW,
    ...analyticalArtifacts(),
    actionRegister,
    controlGate: controlGate(),
    committeePolicy,
    preparedAt: '2026-09-09T15:01:00Z',
  });

  await check(async () => assert.strictEqual(prepared.status, 'READY_FOR_HUMAN_COMMITTEE'));
  await check(async () => assert.strictEqual(prepared.preparedBy, 'analyst-1'));
  await check(async () => assert.strictEqual(prepared.sourceContext.workspaceVersion, 1));
  await check(async () => assert.strictEqual(prepared.sourceContext.tenantId, 'tenant-a'));
  await check(async () => assert.strictEqual(prepared.dossier.readyForHumanCommittee, true));
  await check(async () => assert.strictEqual(prepared.committeeCase.status, 'READY_FOR_COMMITTEE'));
  await check(async () => assert.strictEqual(prepared.committeeCase.preparedBy, 'analyst-1'));
  await check(async () => assert.strictEqual(prepared.runtimeState.committeeCasePersisted, false));
  await check(async () => assert.strictEqual(prepared.authority.aiVotePermitted, false));
  await check(async () => assert.strictEqual(prepared.authority.transactionAuthorized, false));

  const held = await icService.prepareCommitteeCase({
    authorizationHeader: 'Bearer analyst-token',
    workspaceId: 'WS-IC-001',
    nowEpochSeconds: NOW,
    ...analyticalArtifacts({ includeAi: false }),
    actionRegister,
    controlGate: controlGate(),
    committeePolicy,
    preparedAt: '2026-09-09T15:02:00Z',
  });
  await check(async () => assert.strictEqual(held.status, 'HOLD_DOSSIER'));
  await check(async () => assert.strictEqual(held.committeeCase, null));

  await check(async () => assert.rejects(
    icService.prepareCommitteeCase({
      authorizationHeader: 'Bearer analyst-token',
      workspaceId: 'WS-IC-001',
      nowEpochSeconds: NOW,
      ...analyticalArtifacts(),
      actionRegister,
      controlGate: controlGate(),
      committeePolicy,
      preparedAt: '2026-09-09T15:03:00Z',
      preparedBy: 'forged-user',
    }),
    (error) => error && error.code === 'CALLER_AUTHORITY_OVERRIDE_NOT_ALLOWED',
  ));

  const attendance = [
    { memberId: 'member-1', present: true, conflictDeclared: false },
    { memberId: 'member-2', present: true, conflictDeclared: false },
    { memberId: 'member-3', present: false, conflictDeclared: false },
  ];
  const votes = [
    { memberId: 'member-1', vote: MEMBER_VOTE.FOR },
    { memberId: 'member-2', vote: MEMBER_VOTE.FOR },
  ];

  await check(async () => assert.rejects(
    icService.recordHumanDecision({
      authorizationHeader: 'Bearer analyst-token',
      workspaceId: 'WS-IC-001',
      nowEpochSeconds: NOW,
      preparedPackage: prepared,
      committeePolicy,
      attendance,
      votes,
      decision: IC_DECISION.APPROVE,
      rationale: 'Human committee approval after review.',
      decidedAt: '2026-09-09T15:10:00Z',
      dossierRef: 'DOSSIER-IC-001',
      recordedAt: '2026-09-09T15:11:00Z',
    }),
    (error) => error && error.code === 'ROLE_NOT_AUTHORIZED',
  ));

  const recorded = await icService.recordHumanDecision({
    authorizationHeader: 'Bearer ic-token',
    workspaceId: 'WS-IC-001',
    nowEpochSeconds: NOW,
    preparedPackage: prepared,
    committeePolicy,
    attendance,
    votes,
    decision: IC_DECISION.APPROVE,
    rationale: 'Human committee approval after review.',
    decidedAt: '2026-09-09T15:10:00Z',
    dossierRef: 'DOSSIER-IC-001',
    recordedAt: '2026-09-09T15:11:00Z',
  });

  await check(async () => assert.strictEqual(recorded.status, 'HUMAN_DECISION_RECORDED'));
  await check(async () => assert.strictEqual(recorded.recordedBy, 'member-1'));
  await check(async () => assert.strictEqual(recorded.committeeDecision.humanDecision, true));
  await check(async () => assert.strictEqual(recorded.committeeDecision.automatedDecision, false));
  await check(async () => assert.strictEqual(recorded.decisionRecord.status, 'RECORDED'));
  await check(async () => assert.strictEqual(recorded.decisionRecord.recordedBy, 'member-1'));
  await check(async () => assert.strictEqual(recorded.decisionRecord.transactionAuthorized, false));
  await check(async () => assert.strictEqual(recorded.runtimeState.decisionRecordPersisted, false));
  await check(async () => assert.strictEqual(recorded.runtimeState.individualVoterAuthenticationValidatedHere, false));
  await check(async () => assert.strictEqual(recorded.authority.humanDecisionConfirmed, true));
  await check(async () => assert.strictEqual(recorded.authority.decisionActionAuthorized, false));
  await check(async () => assert.strictEqual(recorded.authority.executionActionCreated, false));
  await check(async () => assert.strictEqual(recorded.authority.transactionAuthorized, false));

  await check(async () => assert.rejects(
    icService.recordHumanDecision({
      authorizationHeader: 'Bearer ic-token',
      workspaceId: 'WS-IC-001',
      nowEpochSeconds: NOW,
      preparedPackage: prepared,
      committeePolicy,
      attendance,
      votes,
      decision: IC_DECISION.APPROVE,
      rationale: 'Human committee approval after review.',
      decidedAt: '2026-09-09T15:10:00Z',
      dossierRef: 'DOSSIER-IC-001',
      recordedAt: '2026-09-09T15:11:00Z',
      recordedBy: 'forged-recorder',
    }),
    (error) => error && error.code === 'CALLER_AUTHORITY_OVERRIDE_NOT_ALLOWED',
  ));

  await workspaceService.saveWorkspace({
    authorizationHeader: 'Bearer analyst-token',
    workspace: canonicalWorkspace(),
    expectedVersion: 1,
    operationId: 'IC-WORKSPACE-SAVE-002',
    occurredAt: '2026-09-09T15:20:00Z',
    nowEpochSeconds: NOW,
  });

  await check(async () => assert.rejects(
    icService.recordHumanDecision({
      authorizationHeader: 'Bearer ic-token',
      workspaceId: 'WS-IC-001',
      nowEpochSeconds: NOW,
      preparedPackage: prepared,
      committeePolicy,
      attendance,
      votes,
      decision: IC_DECISION.APPROVE,
      rationale: 'Stale committee package must not be recorded.',
      decidedAt: '2026-09-09T15:21:00Z',
      dossierRef: 'DOSSIER-IC-001',
      recordedAt: '2026-09-09T15:22:00Z',
    }),
    (error) => error && error.code === 'COMMITTEE_PACKAGE_STALE_WORKSPACE_VERSION',
  ));

  await check(async () => assert.ok([...provider.values.keys()].every((key) => key.includes('tenant-a'))));

  console.log(`AUTHENTICATED_INVESTMENT_COMMITTEE_RUNTIME_V1: PASS (${checks} checks)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
