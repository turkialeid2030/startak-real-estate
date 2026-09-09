'use strict';

const assert = require('assert');
const crypto = require('crypto');
const { createOidcBearerAuthenticator } = require('../../src/security/oidc-bearer-authenticator');
const { createCanonicalWorkspacePersistence } = require('../../src/runtime/canonical-workspace-persistence');
const { createCanonicalWorkspaceRuntime } = require('../../src/runtime/canonical-workspace-runtime');
const { createAuthenticatedCanonicalWorkspaceService } = require('../../src/runtime/authenticated-canonical-workspace-service');

const NOW = 1_800_000_000;
const ISSUER = 'https://issuer.example/';
const AUDIENCE = 'startak-real-estate-api';
const KID = 'service-test-key';

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = publicKey.export({ format: 'jwk' });
const jwks = { keys: [{ ...jwk, kid: KID, alg: 'RS256', use: 'sig' }] };

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function token({ sub = 'analyst-1', tenantId = 'tenant-a', roles = ['ANALYST'] } = {}) {
  const header = encodeJson({ alg: 'RS256', typ: 'JWT', kid: KID });
  const payload = encodeJson({
    iss: ISSUER,
    aud: AUDIENCE,
    sub,
    tenant_id: tenantId,
    roles,
    iat: NOW - 10,
    nbf: NOW - 10,
    exp: NOW + 300,
  });
  const signingInput = `${header}.${payload}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput, 'ascii'), privateKey).toString('base64url');
  return `${signingInput}.${signature}`;
}

function memoryAtomicProvider() {
  const values = new Map();
  return {
    values,
    providerName() { return 'AuthenticatedWorkspaceMemoryProvider'; },
    async get(key) { return values.has(key) ? values.get(key) : null; },
    async compareAndSet(key, expectedRaw, nextRaw) {
      const current = values.has(key) ? values.get(key) : null;
      if (current !== expectedRaw) return false;
      values.set(key, nextRaw);
      return true;
    },
  };
}

function workspace(actorId = 'analyst-1') {
  return Object.freeze({
    schemaVersion: 1,
    workspaceId: 'WS-AUTH-001',
    projectId: 'PROJECT-AUTH-001',
    caseId: 'CASE-AUTH-001',
    status: 'CASE_ASSEMBLED',
    attribution: Object.freeze({ actorId, actorRole: 'ANALYST', source: 'IN_APP' }),
    executableCase: Object.freeze({ projectId: 'PROJECT-AUTH-001', caseId: 'CASE-AUTH-001' }),
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
  let checks = 0;
  async function check(fn) { await fn(); checks++; }

  const jwksProvider = Object.freeze({
    async getJwks() { return jwks; },
  });
  const authenticator = createOidcBearerAuthenticator({
    issuer: ISSUER,
    audience: AUDIENCE,
    jwksProvider,
    clockToleranceSeconds: 0,
    maxTokenAgeSeconds: 600,
  });
  const provider = memoryAtomicProvider();
  const persistence = createCanonicalWorkspacePersistence({
    storageProvider: provider,
    now: () => '2026-09-09T12:30:00Z',
  });
  const runtime = createCanonicalWorkspaceRuntime({ persistence });
  const service = createAuthenticatedCanonicalWorkspaceService({
    authenticator,
    runtime,
    requiredTenantId: 'tenant-a',
  });

  const analystToken = token();
  const viewerToken = token({ sub: 'viewer-1', roles: ['VIEWER'] });
  const otherTenantToken = token({ sub: 'analyst-2', tenantId: 'tenant-b', roles: ['ANALYST'] });

  await check(async () => assert.strictEqual(service.requiredTenantId, 'tenant-a'));
  await check(async () => assert.strictEqual(service.authority.releaseAuthorized, false));
  await check(async () => assert.strictEqual(service.authority.mergeAuthorized, false));
  await check(async () => assert.strictEqual(service.authority.deploymentAuthorized, false));
  await check(async () => assert.strictEqual(service.authority.transactionAuthorized, false));
  await check(async () => assert.strictEqual(service.authority.productionAuthenticationValidated, false));
  await check(async () => assert.strictEqual(service.authority.productionPersistenceValidated, false));

  const saved = await service.saveWorkspace({
    authorizationHeader: `Bearer ${analystToken}`,
    workspace: workspace(),
    expectedVersion: 0,
    operationId: 'AUTH-SAVE-001',
    occurredAt: '2026-09-09T12:30:00Z',
    nowEpochSeconds: NOW,
  });
  await check(async () => assert.strictEqual(saved.status, 'OK'));
  await check(async () => assert.strictEqual(saved.data.version, 1));
  await check(async () => assert.strictEqual(saved.data.tenantId, 'tenant-a'));
  await check(async () => assert.strictEqual(saved.data.updatedBy, 'analyst-1'));
  await check(async () => assert.strictEqual(saved.authority.transactionAuthorized, false));

  const loaded = await service.loadWorkspace({
    authorizationHeader: `Bearer ${analystToken}`,
    workspaceId: 'WS-AUTH-001',
    nowEpochSeconds: NOW,
  });
  await check(async () => assert.strictEqual(loaded.status, 'OK'));
  await check(async () => assert.strictEqual(loaded.data.version, 1));
  await check(async () => assert.strictEqual(loaded.data.workspace.workspaceId, 'WS-AUTH-001'));

  await check(async () => assert.rejects(
    service.loadWorkspace({ authorizationHeader: 'Basic invalid', workspaceId: 'WS-AUTH-001', nowEpochSeconds: NOW }),
    (error) => error && error.code === 'AUTHENTICATION_REQUIRED' && !error.message.includes(analystToken),
  ));

  await check(async () => assert.rejects(
    service.loadWorkspace({ authorizationHeader: `Bearer ${otherTenantToken}`, workspaceId: 'WS-AUTH-001', nowEpochSeconds: NOW }),
    (error) => error && error.code === 'AUTHENTICATION_REQUIRED',
  ));

  await check(async () => assert.rejects(
    service.saveWorkspace({
      authorizationHeader: `Bearer ${viewerToken}`,
      workspace: workspace('viewer-1'),
      expectedVersion: 1,
      operationId: 'VIEWER-SPOOF-001',
      occurredAt: '2026-09-09T12:31:00Z',
      nowEpochSeconds: NOW,
      identityContext: { identity: { actorId: 'admin-forged', tenantId: 'tenant-a', roles: ['ADMIN'] } },
      actorId: 'admin-forged',
      tenantId: 'tenant-a',
    }),
    (error) => error && error.code === 'ROLE_NOT_AUTHORIZED',
  ));

  await check(async () => assert.rejects(
    service.saveWorkspace({
      authorizationHeader: `Bearer ${analystToken}`,
      workspace: workspace('forged-actor'),
      expectedVersion: 1,
      operationId: 'ATTRIBUTION-SPOOF-001',
      occurredAt: '2026-09-09T12:32:00Z',
      nowEpochSeconds: NOW,
    }),
    (error) => error && error.code === 'WORKSPACE_ATTRIBUTION_MISMATCH',
  ));

  await check(async () => assert.ok([...provider.values.keys()].every((key) => key.includes('tenant-a'))));

  console.log(`AUTHENTICATED_CANONICAL_WORKSPACE_SERVICE_V1: PASS (${checks} checks)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
