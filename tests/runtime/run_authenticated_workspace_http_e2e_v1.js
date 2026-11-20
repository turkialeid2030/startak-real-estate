'use strict';

// Synthetic loopback integration only: real RS256 verification -> HTTP -> RBAC ->
// tenant/owner-scoped canonical persistence. NO live IdP, database or user data.
const assert = require('assert');
const crypto = require('crypto');
const { createOidcBearerAuthenticator } = require('../../src/security/oidc-bearer-authenticator');
const { createCanonicalWorkspacePersistence } = require('../../src/runtime/canonical-workspace-persistence');
const { createCanonicalWorkspaceRuntime } = require('../../src/runtime/canonical-workspace-runtime');
const { createAuthenticatedCanonicalWorkspaceService } = require('../../src/runtime/authenticated-canonical-workspace-service');
const { createNodeHttpServer } = require('../../src/server/canonical-workspace-http-api');

const ISSUER = 'https://startak-integration.invalid/';
const AUDIENCE = 'startak-integration-ci';
const KID = 'synthetic-rsa-key';
const NOW = Math.floor(Date.now() / 1000);
const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const impostorKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });

function b64Json(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}
function signToken({ sub = 'owner-a', tenantId = 'tenant-a', roles = ['ANALYST'], expired = false,
  audience = AUDIENCE, signingKey = keys.privateKey } = {}) {
  const header = b64Json({ alg: 'RS256', typ: 'JWT', kid: KID });
  const payload = b64Json({
    sub, tenant_id: tenantId, roles, iss: ISSUER, aud: audience,
    iat: expired ? NOW - 1800 : NOW - 10,
    nbf: expired ? NOW - 1800 : NOW - 10,
    exp: expired ? NOW - 600 : NOW + 600,
  });
  const signed = header + '.' + payload;
  return signed + '.' + crypto.sign('RSA-SHA256', Buffer.from(signed, 'ascii'), signingKey).toString('base64url');
}
function workspace(actorId, id = 'WS-E2E-001') {
  return {
    schemaVersion: 1, workspaceId: id, projectId: 'PROJECT-E2E-001',
    caseId: 'CASE-E2E-001', status: 'CASE_ASSEMBLED',
    attribution: { actorId, actorRole: 'ANALYST', source: 'IN_APP' },
    executableCase: { projectId: 'PROJECT-E2E-001', caseId: 'CASE-E2E-001' },
    authority: {
      operatingMode: 'UNLICENSED_DECISION_SUPPORT',
      professionalReportExternalIssuanceAuthorized: false,
      releaseAuthorized: false, mergeAuthorized: false,
      deploymentAuthorized: false, transactionAuthorized: false,
    },
  };
}
function createAtomicMemoryProvider() {
  const values = new Map();
  return {
    values,
    providerName() { return 'SyntheticTenantSeparatedAtomicMemory'; },
    async get(key) { return values.has(key) ? values.get(key) : null; },
    async compareAndSet(key, expectedRaw, nextRaw) {
      const current = values.has(key) ? values.get(key) : null;
      if (current !== expectedRaw) return false;
      values.set(key, nextRaw);
      return true;
    },
  };
}
async function main() {
  const provider = createAtomicMemoryProvider();
  const jwksProvider = {
    async getJwks() {
      return { keys: [{ ...keys.publicKey.export({ format: 'jwk' }), alg: 'RS256', use: 'sig', kid: KID }] };
    },
  };
  const authenticator = createOidcBearerAuthenticator({
    issuer: ISSUER, audience: AUDIENCE, jwksProvider,
    clockToleranceSeconds: 0, maxTokenAgeSeconds: 600,
  });
  const persistence = createCanonicalWorkspacePersistence({ storageProvider: provider });
  const runtime = createCanonicalWorkspaceRuntime({ persistence });
  const service = createAuthenticatedCanonicalWorkspaceService({ authenticator, runtime });
  const server = createNodeHttpServer({
    service, allowedOrigins: ['https://app.startak.example'],
    requestIdFactory: () => 'CI-LOOPBACK-REQ',
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const base = 'http://127.0.0.1:' + server.address().port;
  const path = '/v1/workspaces/WS-E2E-001';
  const a = signToken();
  const b = signToken({ sub: 'owner-b', tenantId: 'tenant-b' });
  const peer = signToken({ sub: 'peer-a', roles: ['ANALYST'] });
  const admin = signToken({ sub: 'admin-a', roles: ['ADMIN'] });
  const viewer = signToken({ sub: 'viewer-a', roles: ['VIEWER'] });
  let checks = 0;
  async function check(label, run) {
    await run();
    checks++;
    console.log(label + ': PASS');
  }
  async function req({ token, method = 'GET', body, origin, route = path } = {}) {
    const headers = {};
    if (token) headers.authorization = 'Bearer ' + token;
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (origin) headers.origin = origin;
    const res = await fetch(base + route, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await res.json();
    return { code: res.status, headers: res.headers, body: payload };
  }
  function savePayload(actorId, operationId, overrides = {}, expectedVersion = 0) {
    return { workspace: { ...workspace(actorId), ...overrides }, expectedVersion, operationId };
  }
  try {
    await check('HTTP-JWT-E2E-01-health-nonproduction', async () => {
      const r = await req({ route: '/healthz' });
      assert.strictEqual(r.code, 200);
      assert.strictEqual(r.body.productionQualified, false);
      assert.strictEqual(r.body.authority.deploymentAuthorized, false);
    });
    await check('HTTP-JWT-E2E-02-no-token', async () => {
      const r = await req();
      assert.strictEqual(r.code, 401);
      assert.strictEqual(r.body.error.code, 'AUTHENTICATION_REQUIRED');
    });
    await check('HTTP-JWT-E2E-03-tenant-a-write', async () => {
      const r = await req({ token: a, method: 'PUT', body: savePayload('owner-a', 'A-CREATE') });
      assert.strictEqual(r.code, 200);
      assert.strictEqual(r.body.data.tenantId, 'tenant-a');
      assert.strictEqual(r.body.data.ownerActorId, 'owner-a');
      assert.strictEqual(r.body.data.version, 1);
    });
    await check('HTTP-JWT-E2E-04-owner-read', async () => {
      const r = await req({ token: a });
      assert.strictEqual(r.code, 200);
      assert.strictEqual(r.body.data.workspace.caseId, 'CASE-E2E-001');
    });
    await check('HTTP-JWT-E2E-05-peer-read-masked', async () => {
      const r = await req({ token: peer });
      assert.strictEqual(r.code, 404);
      assert.strictEqual(r.body.error.code, 'WORKSPACE_NOT_FOUND');
      assert.ok(!JSON.stringify(r.body).includes('owner-a'));
    });
    await check('HTTP-JWT-E2E-06-peer-write-masked', async () => {
      const r = await req({ token: peer, method: 'PUT', body: savePayload('peer-a', 'PEER-WRITE', {}, 1) });
      assert.strictEqual(r.code, 404);
      assert.strictEqual(r.body.error.code, 'WORKSPACE_NOT_FOUND');
    });
    await check('HTTP-JWT-E2E-07-in-tenant-admin-read', async () => {
      const r = await req({ token: admin });
      assert.strictEqual(r.code, 200);
      assert.strictEqual(r.body.data.ownerActorId, 'owner-a');
    });
    await check('HTTP-JWT-E2E-08-other-tenant-does-not-read-a', async () => {
      const r = await req({ token: b });
      assert.strictEqual(r.code, 404);
    });
    await check('HTTP-JWT-E2E-09-tenant-b-separate-write', async () => {
      const r = await req({ token: b, method: 'PUT', body: savePayload('owner-b', 'B-CREATE') });
      assert.strictEqual(r.code, 200);
      assert.strictEqual(r.body.data.ownerActorId, 'owner-b');
      assert.strictEqual(r.body.data.tenantId, 'tenant-b');
    });
    await check('HTTP-JWT-E2E-10-tenant-b-separate-read', async () => {
      const r = await req({ token: b });
      assert.strictEqual(r.code, 200);
      assert.strictEqual(r.body.data.ownerActorId, 'owner-b');
    });
    await check('HTTP-JWT-E2E-11-tenant-a-isolated-after-b-write', async () => {
      const r = await req({ token: a });
      assert.strictEqual(r.code, 200);
      assert.strictEqual(r.body.data.ownerActorId, 'owner-a');
    });
    await check('HTTP-JWT-E2E-12-viewer-cannot-save', async () => {
      const r = await req({ token: viewer, method: 'PUT', body: savePayload('viewer-a', 'VIEWER-SAVE', {}, 1) });
      assert.strictEqual(r.code, 403);
      assert.strictEqual(r.body.error.code, 'FORBIDDEN');
    });
    await check('HTTP-JWT-E2E-13-invalid-signature', async () => {
      const r = await req({ token: signToken({ signingKey: impostorKeys.privateKey }) });
      assert.strictEqual(r.code, 401);
    });
    await check('HTTP-JWT-E2E-14-expired-token', async () => {
      const r = await req({ token: signToken({ expired: true }) });
      assert.strictEqual(r.code, 401);
    });
    await check('HTTP-JWT-E2E-15-invalid-audience', async () => {
      const r = await req({ token: signToken({ audience: 'foreign-app' }) });
      assert.strictEqual(r.code, 401);
    });
    await check('HTTP-JWT-E2E-16-reject-caller-tenant-override', async () => {
      const r = await req({
        token: a, method: 'PUT',
        body: savePayload('owner-a', 'FORGED-TENANT', { tenantId: 'tenant-b' }, 1),
      });
      assert.strictEqual(r.code, 400);
      assert.strictEqual(r.body.error.code, 'WORKSPACE_TENANT_SCOPE_MISMATCH');
    });
    await check('HTTP-JWT-E2E-17-reject-embedded-case-identity', async () => {
      const r = await req({
        token: a, method: 'PUT',
        body: savePayload('owner-a', 'FORGED-CASE', {
          executableCase: { projectId: 'PROJECT-E2E-001', caseId: 'OTHER-ASSET' },
        }, 1),
      });
      assert.strictEqual(r.code, 400);
      assert.strictEqual(r.body.error.code, 'WORKSPACE_RESOURCE_IDENTITY_MISMATCH');
    });
    await check('HTTP-JWT-E2E-18-reject-authorization-in-body', async () => {
      const r = await req({
        token: a, method: 'PUT',
        body: { ...savePayload('owner-a', 'FORGED-ACTOR', {}, 1), actorId: 'admin-a' },
      });
      assert.strictEqual(r.code, 400);
    });
    await check('HTTP-JWT-E2E-19-reject-caller-authority', async () => {
      const r = await req({
        token: a, method: 'PUT',
        body: savePayload('owner-a', 'FORGED-AUTH', {
          authority: { ...workspace('owner-a').authority, releaseAuthorized: true },
        }, 1),
      });
      assert.strictEqual(r.code, 400);
      assert.strictEqual(r.body.error.code, 'WORKSPACE_AUTHORITY_INVARIANT_VIOLATION');
    });
    await check('HTTP-JWT-E2E-20-denied-updates-left-original-intact', async () => {
      const aRecord = await req({ token: a });
      const bRecord = await req({ token: b });
      assert.strictEqual(aRecord.code, 200);
      assert.strictEqual(bRecord.code, 200);
      assert.strictEqual(aRecord.body.data.version, 1);
      assert.strictEqual(bRecord.body.data.version, 1);
      assert.strictEqual(aRecord.body.data.history.length, 1);
      assert.strictEqual(bRecord.body.data.history.length, 1);
      assert.strictEqual(aRecord.body.authority.productionAuthenticationValidated, false);
    });
    console.log('AUTHENTICATED_WORKSPACE_HTTP_E2E_V1: PASS (' + checks + ' synthetic loopback checks; NO LIVE IdP/DB)');
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
