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

  const loaded = await runtime.loadWorkspace({ identityContext: analyst, workspaceId: 'WS-001' });
  await check(async () => assert.strictEqual(loaded.version, 1));
  await check(async () => assert.strictEqual(loaded.workspace.workspaceId, 'WS-001'));

  const otherTenantResult = await runtime.loadWorkspace({ identityContext: otherTenant, workspaceId: 'WS-001' });
  await check(async () => assert.strictEqual(otherTenantResult, null));
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