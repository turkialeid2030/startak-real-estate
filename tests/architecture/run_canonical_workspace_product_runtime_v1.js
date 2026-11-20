'use strict';

const assert = require('assert');
const { createVerifiedIdentityContext } = require('../../src/security/verified-identity-context');
const { createCanonicalWorkspacePersistence } = require('../../src/runtime/canonical-workspace-persistence');
const { createCanonicalWorkspaceRuntime } = require('../../src/runtime/canonical-workspace-runtime');

let checks = 0;
async function check(fn) { await fn(); checks++; }

function identityContext({ sub, tenantId, roles }) {
  return createVerifiedIdentityContext({
    claims: {
      sub,
      tenant_id: tenantId,
      roles,
      iss: 'https://id.example.test/',
      aud: 'startak-real-estate',
      exp: 2000003600,
    },
    tokenVerificationEvidence: { verified: true, verificationRef: `VERIFY-${sub}` },
    requiredTenantId: tenantId,
    nowEpochSeconds: 2000000000,
  });
}

function createAtomicMemoryProvider() {
  const values = new Map();
  let forceConflict = false;
  return {
    values,
    setForceConflict(value) { forceConflict = Boolean(value); },
    providerName() { return 'AtomicMemoryTestProvider'; },
    async get(key) { return values.has(key) ? values.get(key) : null; },
    async compareAndSet(key, expectedRaw, nextRaw) {
      if (forceConflict) return false;
      const current = values.has(key) ? values.get(key) : null;
      if (current !== expectedRaw) return false;
      values.set(key, nextRaw);
      return true;
    },
  };
}

function canonicalWorkspace(actorId = 'user-1') {
  return Object.freeze({
    schemaVersion: 1,
    workspaceId: 'WS-001',
    projectId: 'PROJECT-001',
    caseId: 'CASE-001',
    status: 'CASE_ASSEMBLED',
    attribution: Object.freeze({ actorId, actorRole: 'ANALYST', source: 'IN_APP' }),
    executableCase: Object.freeze({ projectId: 'PROJECT-001', caseId: 'CASE-001' }),
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

async function main() {
  const provider = createAtomicMemoryProvider();
  const persistence = createCanonicalWorkspacePersistence({
    storageProvider: provider,
    now: () => '2026-09-09T12:00:00Z',
  });
  const runtime = createCanonicalWorkspaceRuntime({ persistence });

  const analyst = identityContext({ sub: 'user-1', tenantId: 'tenant-a', roles: ['ANALYST'] });
  const viewer = identityContext({ sub: 'viewer-1', tenantId: 'tenant-a', roles: ['VIEWER'] });
  const otherTenant = identityContext({ sub: 'user-2', tenantId: 'tenant-b', roles: ['ANALYST'] });
  const workspace = canonicalWorkspace();

  await check(async () => assert.strictEqual(persistence.capabilities.atomicCompareAndSet, true));
  await check(async () => assert.strictEqual(persistence.capabilities.productionPersistenceValidated, false));
  await check(async () => assert.strictEqual(runtime.authority.productionAuthenticationValidated, false));
  await check(async () => assert.strictEqual(runtime.authority.productionPersistenceValidated, false));
  await check(async () => assert.strictEqual(runtime.authority.releaseAuthorized, false));
  await check(async () => assert.strictEqual(runtime.authority.mergeAuthorized, false));
  await check(async () => assert.strictEqual(runtime.authority.deploymentAuthorized, false));
  await check(async () => assert.strictEqual(runtime.authority.transactionAuthorized, false));

  // Same-tenant ADMIN and object-owner checks cannot be bypassed by a
  // caller-provided JSON object that imitates the verifier's identity format.
  const fakeAdminContext = {
    ...analyst,
    identity: {
      ...analyst.identity,
      actorId: 'forged-tenant-admin',
      subject: 'forged-tenant-admin',
      roles: ['ADMIN'],
    },
  };
  await check(async () => assert.rejects(
    runtime.loadWorkspace({ identityContext: fakeAdminContext, workspaceId: 'WS-001' }),
    (error) => error.code === 'VERIFIED_IDENTITY_CONTEXT_REQUIRED',
  ));
  await check(async () => assert.rejects(
    runtime.saveWorkspace({
      identityContext: fakeAdminContext,
      workspace: canonicalWorkspace('forged-tenant-admin'),
      expectedVersion: 0,
      operationId: 'SPOOF-ADMIN-WRITE',
      occurredAt: '2026-09-09T11:59:59Z',
    }),
    (error) => error.code === 'VERIFIED_IDENTITY_CONTEXT_REQUIRED',
  ));

  const storedV1 = await runtime.saveWorkspace({
    identityContext: analyst,
    workspace,
    expectedVersion: 0,
    operationId: 'OP-001',
    occurredAt: '2026-09-09T12:00:00Z',
  });
  await check(async () => assert.strictEqual(storedV1.version, 1));
  await check(async () => assert.strictEqual(storedV1.tenantId, 'tenant-a'));
  await check(async () => assert.strictEqual(storedV1.updatedBy, 'user-1'));
  await check(async () => assert.strictEqual(storedV1.history.length, 1));
  await check(async () => assert.strictEqual(storedV1.history[0].actorId, 'user-1'));
  await check(async () => assert.strictEqual(storedV1.history[0].tenantId, 'tenant-a'));
  await check(async () => assert.strictEqual(storedV1.history[0].action, 'SAVE_WORKSPACE'));
  await check(async () => assert.strictEqual(storedV1.authority.transactionAuthorized, false));
  await check(async () => assert.ok(Object.isFrozen(storedV1)));

  // Source identity within a case must match the workspace scope. An inner
  // project/case mismatch is not a harmless display difference: downstream
  // decision reports can otherwise attribute one asset's figures to another.
  await check(async () => assert.rejects(
    runtime.saveWorkspace({
      identityContext: analyst,
      workspace: {
        ...workspace,
        executableCase: { ...workspace.executableCase, projectId: 'PROJECT-FORGED' },
      },
      expectedVersion: 1,
      operationId: 'OP-FORGED-INNER-PROJECT',
    }),
    (error) => error.code === 'WORKSPACE_RESOURCE_IDENTITY_MISMATCH',
  ));
  await check(async () => assert.rejects(
    persistence.save({
      identityContext: analyst,
      workspace: {
        ...workspace,
        executableCase: { ...workspace.executableCase, caseId: 'CASE-FORGED' },
      },
      expectedVersion: 1,
      operationId: 'OP-FORGED-INNER-CASE',
    }),
    (error) => error.code === 'WORKSPACE_RESOURCE_IDENTITY_MISMATCH',
  ));
  // Persisted data is independently checked on read. A corrupt inner case
  // cannot silently flow to reviewers, even if the outer tenant/workspace
  // and record ownership still match the current user.
  const originalKey = [...provider.values.keys()].find((key) => key.endsWith(':WS-001'));
  const intactRaw = provider.values.get(originalKey);
  const corrupted = JSON.parse(intactRaw);
  corrupted.workspace = {
    ...corrupted.workspace,
    executableCase: { ...corrupted.workspace.executableCase, caseId: 'CASE-OTHER-ASSET' },
  };
  provider.values.set(originalKey, JSON.stringify(corrupted));
  await check(async () => assert.rejects(
    runtime.loadWorkspace({ identityContext: analyst, workspaceId: 'WS-001' }),
    (error) => error.code === 'WORKSPACE_PERSISTENCE_CORRUPT_RECORD',
  ));
  await check(async () => assert.rejects(
    runtime.saveWorkspace({
      identityContext: analyst,
      workspace,
      expectedVersion: 1,
      operationId: 'OP-CORRUPT-SOURCE-SAVE',
    }),
    (error) => error.code === 'WORKSPACE_PERSISTENCE_CORRUPT_RECORD',
  ));
  provider.values.set(originalKey, intactRaw);
  await check(async () => assert.strictEqual(
    (await runtime.loadWorkspace({ identityContext: analyst, workspaceId: 'WS-001' })).version,
    1,
  ));

  // The persistence API is also exposed to trusted internal integrations.
  // Such direct callers must never bypass the JWT-derived tenant boundary.
  await check(async () => assert.rejects(
    persistence.save({
      identityContext: analyst,
      workspace: { ...workspace, tenantId: 'tenant-b' },
      expectedVersion: 1,
      operationId: 'DIRECT-FORGED-TENANT',
    }),
    (error) => error.code === 'WORKSPACE_TENANT_SCOPE_MISMATCH',
  ));
  await check(async () => assert.rejects(
    persistence.save({
      identityContext: analyst,
      workspace: { ...workspace, tenantId: null },
      expectedVersion: 1,
      operationId: 'DIRECT-NULL-TENANT',
    }),
    (error) => error.code === 'WORKSPACE_TENANT_SCOPE_MISMATCH',
  ));
  const directValid = await persistence.save({
    identityContext: analyst,
    workspace: { ...workspace, workspaceId: 'WS-DIRECT-CONSISTENT', tenantId: 'tenant-a' },
    expectedVersion: 0,
    operationId: 'DIRECT-MATCHED-TENANT',
  });
  await check(async () => assert.strictEqual(directValid.tenantId, 'tenant-a'));
  await check(async () => assert.strictEqual(
    (await runtime.loadWorkspace({
      identityContext: analyst, workspaceId: 'WS-DIRECT-CONSISTENT',
    })).workspace.tenantId,
    'tenant-a',
  ));
  const foreignNested = JSON.parse(intactRaw);
  foreignNested.workspace = { ...foreignNested.workspace, tenantId: 'tenant-b' };
  provider.values.set(originalKey, JSON.stringify(foreignNested));
  await check(async () => assert.rejects(
    persistence.load({ identityContext: analyst, workspaceId: 'WS-001' }),
    (error) => error.code === 'WORKSPACE_PERSISTENCE_CORRUPT_RECORD',
  ));
  await check(async () => assert.rejects(
    persistence.save({
      identityContext: analyst,
      workspace,
      expectedVersion: 1,
      operationId: 'DIRECT-FORGED-STORED-TENANT',
    }),
    (error) => error.code === 'WORKSPACE_PERSISTENCE_CORRUPT_RECORD',
  ));
  provider.values.set(originalKey, intactRaw);

  // A direct persistence caller must not create an apparent professional
  // issuance or release approval by bypassing the runtime validation.
  await check(async () => assert.rejects(
    persistence.save({
      identityContext: analyst,
      workspace: {
        ...workspace,
        authority: { ...workspace.authority, releaseAuthorized: true },
      },
      expectedVersion: 1,
      operationId: 'DIRECT-FORGED-RELEASE',
    }),
    (error) => error.code === 'WORKSPACE_AUTHORITY_INVARIANT_VIOLATION',
  ));
  await check(async () => assert.rejects(
    persistence.save({
      identityContext: analyst,
      workspace: {
        ...workspace,
        authority: { ...workspace.authority, professionalReportExternalIssuanceAuthorized: true },
      },
      expectedVersion: 1,
      operationId: 'DIRECT-FORGED-VALUATION-ISSUANCE',
    }),
    (error) => error.code === 'WORKSPACE_AUTHORITY_INVARIANT_VIOLATION',
  ));
  const elevatedStoredEnvelope = JSON.parse(intactRaw);
  elevatedStoredEnvelope.workspace = {
    ...elevatedStoredEnvelope.workspace,
    authority: { ...elevatedStoredEnvelope.workspace.authority, transactionAuthorized: true },
  };
  provider.values.set(originalKey, JSON.stringify(elevatedStoredEnvelope));
  await check(async () => assert.rejects(
    persistence.load({ identityContext: analyst, workspaceId: 'WS-001' }),
    (error) => error.code === 'WORKSPACE_PERSISTENCE_CORRUPT_RECORD',
  ));
  await check(async () => assert.rejects(
    persistence.save({
      identityContext: analyst,
      workspace,
      expectedVersion: 1,
      operationId: 'DIRECT-CORRUPT-RELEASE-UPDATE',
    }),
    (error) => error.code === 'WORKSPACE_PERSISTENCE_CORRUPT_RECORD',
  ));
  provider.values.set(originalKey, intactRaw);

  const loaded = await runtime.loadWorkspace({ identityContext: analyst, workspaceId: 'WS-001' });
  await check(async () => assert.strictEqual(loaded.version, 1));
  await check(async () => assert.strictEqual(loaded.workspace.workspaceId, 'WS-001'));

  const otherTenantResult = await runtime.loadWorkspace({ identityContext: otherTenant, workspaceId: 'WS-001' });
  await check(async () => assert.strictEqual(otherTenantResult, null));
  await check(async () => assert.strictEqual(storedV1.ownerActorId, 'user-1'));
  const peer = identityContext({ sub: 'peer-analyst', tenantId: 'tenant-a', roles: ['ANALYST'] });
  const admin = identityContext({ sub: 'tenant-admin', tenantId: 'tenant-a', roles: ['ADMIN'] });
  const downgradedOwner = identityContext({ sub: 'user-1', tenantId: 'tenant-a', roles: ['VIEWER'] });

  await check(async () => assert.rejects(
    runtime.loadWorkspace({ identityContext: peer, workspaceId: 'WS-001' }),
    (e) => e.code === 'WORKSPACE_RECORD_ACCESS_DENIED',
  ));
  await check(async () => assert.strictEqual(
    (await runtime.loadWorkspace({ identityContext: downgradedOwner, workspaceId: 'WS-001' })).ownerActorId, 'user-1',
  ));
  await check(async () => assert.strictEqual(
    (await runtime.loadWorkspace({ identityContext: admin, workspaceId: 'WS-001' })).ownerActorId, 'user-1',
  ));

  // An old unowned envelope cannot be assigned to whoever happens to request
  // it first. Quarantine non-admin access until an authorized backfill.
  const legacyWorkspaceId = 'WS-LEGACY-001';
  const legacyKey = [...provider.values.keys()][0].replace(/WS-001$/, legacyWorkspaceId);
  provider.values.set(legacyKey, JSON.stringify({
    schemaVersion: 1, version: 1, tenantId: 'tenant-a',
    workspaceId: legacyWorkspaceId,
    workspace: { ...workspace, workspaceId: legacyWorkspaceId },
    history: [],
  }));
  await check(async () => assert.rejects(
    runtime.loadWorkspace({ identityContext: analyst, workspaceId: legacyWorkspaceId }),
    (e) => e.code === 'WORKSPACE_RECORD_ACCESS_DENIED',
  ));
  await check(async () => assert.strictEqual(
    (await runtime.loadWorkspace({ identityContext: admin, workspaceId: legacyWorkspaceId })).ownerActorId, undefined,
  ));

  // An explicitly server-wired reviewer may READ exactly one record, but
  // never derive a WRITE grant from that access, even with ANALYST role.
  const delegatedPersistence = createCanonicalWorkspacePersistence({
    storageProvider: provider,
    trustedRecordGrantResolver: async (scope) => ({
      // Synthetic grant record echoes the strictly verified tuple; a live
      // resolver must independently retrieve and validate the actual assignment.
      ...scope,
      allowed: scope.tenantId === 'tenant-a'
        && scope.workspaceId === 'WS-001'
        && scope.ownerActorId === 'user-1'
        && scope.actorId === 'reviewer-1'
        && scope.action === 'READ'
        && scope.roles.includes('IC_MEMBER'),
      grantRef: 'SYNTHETIC-REVIEW-ASSIGNMENT-001',
    }),
  });
  const delegatedRuntime = createCanonicalWorkspaceRuntime({ persistence: delegatedPersistence });
  const reviewer = identityContext({
    sub: 'reviewer-1', tenantId: 'tenant-a', roles: ['IC_MEMBER', 'ANALYST'],
  });
  await check(async () => assert.strictEqual(
    (await delegatedRuntime.loadWorkspace({ identityContext: reviewer, workspaceId: 'WS-001' })).ownerActorId,
    'user-1',
  ));
  await check(async () => assert.rejects(
    delegatedRuntime.saveWorkspace({
      identityContext: reviewer,
      workspace: canonicalWorkspace('reviewer-1'),
      expectedVersion: 1,
      operationId: 'REVIEWER-WRITE-FORGED',
      occurredAt: '2026-09-09T12:12:00Z',
    }),
    (e) => e.code === 'WORKSPACE_RECORD_ACCESS_DENIED',
  ));
  await check(async () => assert.rejects(
    delegatedRuntime.loadWorkspace({ identityContext: reviewer, workspaceId: legacyWorkspaceId }),
    (e) => e.code === 'WORKSPACE_RECORD_ACCESS_DENIED',
  ));

  // Explicit negative regression for a misconfigured trusted resolver:
  // reviewer READ grants must NEVER escalate to WRITE even if the resolver
  // mistakenly says allowed=true for every requested action.
  const observedResolverActions = [];
  const permissiveReviewPersistence = createCanonicalWorkspacePersistence({
    storageProvider: provider,
    trustedRecordGrantResolver: async (scope) => {
      observedResolverActions.push(scope.action);
      return { allowed: true, grantRef: 'SYNTHETIC-MISCONFIGURED-REVIEWER-GRANT' };
    },
  });
  const permissiveReviewRuntime = createCanonicalWorkspaceRuntime({
    persistence: permissiveReviewPersistence,
  });
  await check(async () => assert.rejects(
    permissiveReviewRuntime.saveWorkspace({
      identityContext: reviewer,
      workspace: canonicalWorkspace('reviewer-1'),
      expectedVersion: 1,
      operationId: 'REVIEWER-WRITE-OVERPERMISSIVE-GRANT',
      occurredAt: '2026-09-09T12:13:00Z',
    }),
    (e) => e.code === 'WORKSPACE_RECORD_ACCESS_DENIED',
  ));
  await check(async () => assert.deepStrictEqual(observedResolverActions, []));
  await check(async () => assert.rejects(
    permissiveReviewRuntime.loadWorkspace({
      identityContext: reviewer,
      workspaceId: 'WS-001',
    }),
    (e) => e.code === 'WORKSPACE_RECORD_ACCESS_DENIED',
  ));
  // Even a signed, explicit allow response is rejected when it names a
  // different workspace. The grant's target tuple must exactly match.
  const wrongScopePersistence = createCanonicalWorkspacePersistence({
    storageProvider: provider,
    trustedRecordGrantResolver: async (scope) => ({
      ...scope,
      workspaceId: 'WS-OTHER-CASE',
      allowed: true,
      grantRef: 'SYNTHETIC-OTHER-WORKSPACE-GRANT',
    }),
  });
  const wrongScopeRuntime = createCanonicalWorkspaceRuntime({
    persistence: wrongScopePersistence,
  });
  await check(async () => assert.rejects(
    wrongScopeRuntime.loadWorkspace({
      identityContext: reviewer,
      workspaceId: 'WS-001',
    }),
    (e) => e.code === 'WORKSPACE_RECORD_ACCESS_DENIED',
  ));

  await check(async () => assert.strictEqual(
    (await runtime.loadWorkspace({ identityContext: analyst, workspaceId: 'WS-001' })).version,
    1,
  ));

  await check(async () => assert.ok([...provider.values.keys()].every((key) => key.includes('tenant-a'))));

  await check(async () => assert.rejects(
    runtime.saveWorkspace({
      identityContext: analyst,
      workspace,
      expectedVersion: 0,
      operationId: 'OP-STALE',
      occurredAt: '2026-09-09T12:01:00Z',
    }),
    (error) => error && error.code === 'WORKSPACE_VERSION_CONFLICT',
  ));

  await check(async () => assert.rejects(
    runtime.saveWorkspace({
      identityContext: viewer,
      workspace: canonicalWorkspace('viewer-1'),
      expectedVersion: 1,
      operationId: 'OP-VIEWER',
      occurredAt: '2026-09-09T12:02:00Z',
    }),
    (error) => error && error.code === 'ROLE_NOT_AUTHORIZED',
  ));

  await check(async () => assert.rejects(
    runtime.saveWorkspace({
      identityContext: analyst,
      workspace: canonicalWorkspace('forged-user'),
      expectedVersion: 1,
      operationId: 'OP-FORGED-ATTRIBUTION',
      occurredAt: '2026-09-09T12:03:00Z',
    }),
    (error) => error && error.code === 'WORKSPACE_ATTRIBUTION_MISMATCH',
  ));

  const forgedIdentity = {
    ...analyst,
    identity: { ...analyst.identity, actorId: 'forged-user', subject: 'user-1' },
  };
  await check(async () => assert.rejects(
    runtime.loadWorkspace({ identityContext: forgedIdentity, workspaceId: 'WS-001' }),
    (error) => error && error.code === 'VERIFIED_IDENTITY_CONTEXT_REQUIRED',
  ));

  const elevatedWorkspace = {
    ...workspace,
    authority: { ...workspace.authority, transactionAuthorized: true },
  };
  await check(async () => assert.rejects(
    runtime.saveWorkspace({
      identityContext: analyst,
      workspace: elevatedWorkspace,
      expectedVersion: 1,
      operationId: 'OP-AUTHORITY',
      occurredAt: '2026-09-09T12:04:00Z',
    }),
    (error) => error && error.code === 'WORKSPACE_AUTHORITY_INVARIANT_VIOLATION',
  ));

  provider.setForceConflict(true);
  await check(async () => assert.rejects(
    runtime.saveWorkspace({
      identityContext: analyst,
      workspace,
      expectedVersion: 1,
      operationId: 'OP-CONCURRENT',
      occurredAt: '2026-09-09T12:05:00Z',
    }),
    (error) => error && error.code === 'WORKSPACE_CONCURRENT_WRITE_CONFLICT',
  ));
  provider.setForceConflict(false);

  const nonAtomicPersistence = createCanonicalWorkspacePersistence({
    storageProvider: {
      providerName() { return 'LegacyNonAtomicProvider'; },
      async get() { return null; },
      async set() {},
    },
  });
  const nonAtomicRuntime = createCanonicalWorkspaceRuntime({ persistence: nonAtomicPersistence });
  await check(async () => assert.rejects(
    nonAtomicRuntime.saveWorkspace({
      identityContext: analyst,
      workspace,
      expectedVersion: 0,
      operationId: 'OP-NON-ATOMIC',
      occurredAt: '2026-09-09T12:06:00Z',
    }),
    (error) => error && error.code === 'ATOMIC_PERSISTENCE_REQUIRED',
  ));

  console.log(`CANONICAL_WORKSPACE_PRODUCT_RUNTIME_V1: PASS (${checks} checks)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});