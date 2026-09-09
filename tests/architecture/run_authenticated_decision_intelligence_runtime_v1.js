'use strict';

const assert = require('assert');
const { createVerifiedIdentityContext } = require('../../src/security/verified-identity-context');
const { createCanonicalWorkspacePersistence } = require('../../src/runtime/canonical-workspace-persistence');
const { createCanonicalWorkspaceRuntime } = require('../../src/runtime/canonical-workspace-runtime');
const { createAuthenticatedCanonicalWorkspaceService } = require('../../src/runtime/authenticated-canonical-workspace-service');
const { createAuthenticatedDecisionIntelligenceService } = require('../../src/runtime/authenticated-decision-intelligence-service');
const { AI_ROLE, AI_STAGE_STATUS } = require('../../src/decision-intelligence/ai-expert-orchestrator');

const NOW = 1_800_000_000;

function identityContext({ sub, tenantId, roles }) {
  return createVerifiedIdentityContext({
    claims: {
      sub,
      tenant_id: tenantId,
      roles,
      iss: 'https://issuer.example/',
      aud: 'startak-real-estate-api',
      exp: NOW + 300,
    },
    tokenVerificationEvidence: { verified: true, verificationRef: `TEST-${sub}` },
    requiredTenantId: tenantId,
    nowEpochSeconds: NOW,
  });
}

function authenticator() {
  return Object.freeze({
    async authenticate({ authorizationHeader, requiredTenantId }) {
      if (authorizationHeader !== 'Bearer analyst-token') {
        return { authorizationReady: false, identityContext: null };
      }
      const context = identityContext({ sub: 'analyst-1', tenantId: 'tenant-a', roles: ['ANALYST'] });
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
    providerName() { return 'DecisionIntelligenceMemoryProvider'; },
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
    workspaceId: 'WS-DI-001',
    projectId: 'PROJECT-DI-001',
    caseId: 'CASE-DI-001',
    status: 'CASE_ASSEMBLED',
    attribution: Object.freeze({ actorId: 'analyst-1', actorRole: 'ANALYST', source: 'IN_APP' }),
    executableCase: Object.freeze({ projectId: 'PROJECT-DI-001', caseId: 'CASE-DI-001' }),
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

function analyticalArtifacts(overrides = {}) {
  const caseId = overrides.caseId || 'CASE-DI-001';
  const projectId = overrides.projectId || 'PROJECT-DI-001';
  return {
    studyOrchestration: {
      caseId,
      projectId,
      status: 'READY_FOR_AI_AND_HUMAN_REVIEW',
    },
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
      id: 'E-1',
      domain: 'LEGAL',
      label: 'Title evidence',
      sourceRef: 'DOC-1',
      status: 'CURRENT',
      verified: true,
      stale: false,
      conflict: false,
    }],
    assumptionRecords: [{
      caseId,
      projectId,
      id: 'A-1',
      domain: 'MARKET',
      label: 'Rent growth',
      valueDisplay: '2%',
      basis: 'Scenario assumption',
      material: true,
      sensitivityRequired: true,
      approved: true,
      evidenceRefs: ['E-1'],
    }],
    aiOutputs: [AI_ROLE.ANALYST, AI_ROLE.CHALLENGER, AI_ROLE.SYNTHESIZER].map((role) => ({
      caseId,
      projectId,
      role,
      status: AI_STAGE_STATUS.OUTPUT_ACCEPTED,
      narrative: `${role} bounded narrative`,
      citedEvidenceRefs: ['E-1'],
      uncertainties: [],
      disagreements: [],
      diligenceSuggestions: [],
    })),
  };
}

async function main() {
  let checks = 0;
  async function check(fn) { await fn(); checks++; }

  const provider = atomicMemoryProvider();
  const persistence = createCanonicalWorkspacePersistence({
    storageProvider: provider,
    now: () => '2026-09-09T14:00:00Z',
  });
  const runtime = createCanonicalWorkspaceRuntime({ persistence });
  const workspaceService = createAuthenticatedCanonicalWorkspaceService({
    authenticator: authenticator(),
    runtime,
    requiredTenantId: 'tenant-a',
  });
  const service = createAuthenticatedDecisionIntelligenceService({ workspaceService });

  await workspaceService.saveWorkspace({
    authorizationHeader: 'Bearer analyst-token',
    workspace: canonicalWorkspace(),
    expectedVersion: 0,
    operationId: 'DI-WORKSPACE-SAVE-001',
    occurredAt: '2026-09-09T14:00:00Z',
    nowEpochSeconds: NOW,
  });

  const result = await service.projectWorkspace({
    authorizationHeader: 'Bearer analyst-token',
    workspaceId: 'WS-DI-001',
    nowEpochSeconds: NOW,
    ...analyticalArtifacts(),
  });

  await check(async () => assert.strictEqual(result.status, 'OK'));
  await check(async () => assert.strictEqual(result.sourceContext.workspaceId, 'WS-DI-001'));
  await check(async () => assert.strictEqual(result.sourceContext.workspaceVersion, 1));
  await check(async () => assert.strictEqual(result.sourceContext.tenantId, 'tenant-a'));
  await check(async () => assert.strictEqual(result.sourceContext.projectId, 'PROJECT-DI-001'));
  await check(async () => assert.strictEqual(result.sourceContext.caseId, 'CASE-DI-001'));
  await check(async () => assert.strictEqual(result.sourceContext.scopeDerivedFrom, 'AUTHENTICATED_CANONICAL_WORKSPACE'));
  await check(async () => assert.strictEqual(result.decisionIntelligence.status, 'READY_FOR_REVIEW'));
  await check(async () => assert.strictEqual(result.decisionIntelligence.projectId, 'PROJECT-DI-001'));
  await check(async () => assert.strictEqual(result.decisionIntelligence.caseId, 'CASE-DI-001'));
  await check(async () => assert.strictEqual(result.runtimeState.projectionPersisted, false));
  await check(async () => assert.strictEqual(result.runtimeState.liveDataValidated, false));
  await check(async () => assert.strictEqual(result.runtimeState.modelCallExecutedHere, false));
  await check(async () => assert.strictEqual(result.authority.humanDecisionRequired, true));
  await check(async () => assert.strictEqual(result.authority.releaseAuthorized, false));
  await check(async () => assert.strictEqual(result.authority.mergeAuthorized, false));
  await check(async () => assert.strictEqual(result.authority.deploymentAuthorized, false));
  await check(async () => assert.strictEqual(result.authority.transactionAuthorized, false));
  await check(async () => assert.ok(Object.isFrozen(result)));

  await check(async () => assert.rejects(
    service.projectWorkspace({
      authorizationHeader: 'Bearer analyst-token',
      workspaceId: 'WS-DI-001',
      nowEpochSeconds: NOW,
      caseId: 'FORGED-CASE',
      ...analyticalArtifacts(),
    }),
    (error) => error && error.code === 'CALLER_SCOPE_OVERRIDE_NOT_ALLOWED',
  ));

  await check(async () => assert.rejects(
    service.projectWorkspace({
      authorizationHeader: 'Bearer analyst-token',
      workspaceId: 'WS-DI-001',
      nowEpochSeconds: NOW,
      tenantId: 'tenant-b',
      ...analyticalArtifacts(),
    }),
    (error) => error && error.code === 'CALLER_SCOPE_OVERRIDE_NOT_ALLOWED',
  ));

  await check(async () => assert.rejects(
    service.projectWorkspace({
      authorizationHeader: 'Bearer analyst-token',
      workspaceId: 'WS-DI-001',
      nowEpochSeconds: NOW,
      ...analyticalArtifacts({ caseId: 'CASE-OTHER' }),
    }),
    /STUDYORCHESTRATION_SCOPE_MISMATCH/,
  ));

  await check(async () => assert.rejects(
    service.projectWorkspace({
      authorizationHeader: 'Bearer invalid',
      workspaceId: 'WS-DI-001',
      nowEpochSeconds: NOW,
      ...analyticalArtifacts(),
    }),
    (error) => error && error.code === 'AUTHENTICATION_REQUIRED',
  ));

  await check(async () => assert.rejects(
    service.projectWorkspace({
      authorizationHeader: 'Bearer analyst-token',
      workspaceId: 'WS-MISSING',
      nowEpochSeconds: NOW,
      ...analyticalArtifacts(),
    }),
    (error) => error && error.code === 'CANONICAL_WORKSPACE_NOT_FOUND',
  ));

  await check(async () => assert.ok([...provider.values.keys()].every((key) => key.includes('tenant-a'))));

  console.log(`AUTHENTICATED_DECISION_INTELLIGENCE_RUNTIME_V1: PASS (${checks} checks)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
