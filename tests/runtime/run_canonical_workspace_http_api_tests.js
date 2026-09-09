'use strict';

const assert = require('assert');
const {
  createNodeHttpServer,
} = require('../../src/server/canonical-workspace-http-api');

const results = [];

async function test(id, fn) {
  try {
    await fn();
    results.push([id, 'PASS']);
    console.log(id + ' PASS');
  } catch (error) {
    results.push([id, 'FAIL: ' + error.message]);
    console.log(id + ' FAIL: ' + error.message);
  }
}

function coded(code, message = code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function createService() {
  const calls = [];
  return {
    calls,
    async loadWorkspace({ authorizationHeader, workspaceId }) {
      calls.push({ method: 'load', authorizationHeader, workspaceId });
      if (authorizationHeader !== 'Bearer good-token') throw coded('AUTHENTICATION_REQUIRED', 'do-not-leak-token-details');
      if (workspaceId === 'missing') return { status: 'OK', data: null };
      if (workspaceId === 'forbidden') throw coded('ROLE_NOT_AUTHORIZED', 'ROLE_NOT_AUTHORIZED: analyst details');
      if (workspaceId === 'explode') throw new Error('database password=super-secret');
      return {
        status: 'OK',
        data: {
          schemaVersion: 1,
          workspaceId,
          projectId: 'project-1',
          caseId: 'case-1',
        },
      };
    },
    async saveWorkspace({ authorizationHeader, workspace, expectedVersion, operationId, occurredAt }) {
      calls.push({ method: 'save', authorizationHeader, workspace, expectedVersion, operationId, occurredAt });
      if (authorizationHeader !== 'Bearer good-token') throw coded('AUTHENTICATION_REQUIRED');
      if (operationId === 'conflict') throw coded('WORKSPACE_VERSION_CONFLICT');
      return {
        status: 'OK',
        data: {
          schemaVersion: 1,
          workspaceId: workspace.workspaceId,
          version: expectedVersion + 1,
          workspace,
        },
      };
    },
  };
}

async function withServer(options, fn) {
  const server = createNodeHttpServer(options);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function json(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

(async () => {
  const service = createService();

  await withServer({
    service,
    allowedOrigins: ['https://app.startak.example', 'http://localhost:4173'],
    requestIdFactory: () => 'req-fixed',
  }, async (baseUrl) => {
    await test('PRODUCTIZATION-P10-01', async () => {
      const response = await fetch(`${baseUrl}/healthz`);
      const body = await json(response);
      assert.strictEqual(response.status, 200);
      assert.strictEqual(body.status, 'LIVE');
      assert.strictEqual(body.productionQualified, false);
      assert.strictEqual(body.authority.releaseAuthorized, false);
      assert.strictEqual(body.authority.deploymentAuthorized, false);
      assert.strictEqual(body.authority.transactionAuthorized, false);
      assert.strictEqual(response.headers.get('cache-control'), 'no-store');
      assert.strictEqual(response.headers.get('x-content-type-options'), 'nosniff');
      assert.strictEqual(response.headers.get('x-request-id'), 'req-fixed');
    });

    await test('PRODUCTIZATION-P10-02', async () => {
      const response = await fetch(`${baseUrl}/v1/workspaces/workspace-1`);
      const body = await json(response);
      assert.strictEqual(response.status, 401);
      assert.strictEqual(body.error.code, 'AUTHENTICATION_REQUIRED');
      assert.strictEqual(response.headers.get('www-authenticate'), 'Bearer');
      assert.ok(!JSON.stringify(body).includes('do-not-leak-token-details'));
    });

    await test('PRODUCTIZATION-P10-03', async () => {
      const response = await fetch(`${baseUrl}/v1/workspaces/workspace-1`, {
        headers: { authorization: 'Bearer good-token' },
      });
      const body = await json(response);
      assert.strictEqual(response.status, 200);
      assert.strictEqual(body.data.workspaceId, 'workspace-1');
      assert.strictEqual(body.authority.productionAuthenticationValidated, false);
      assert.strictEqual(body.authority.productionPersistenceValidated, false);
      assert.ok(!JSON.stringify(body).includes('good-token'));
      const call = service.calls.find((entry) => entry.method === 'load' && entry.workspaceId === 'workspace-1');
      assert.strictEqual(call.authorizationHeader, 'Bearer good-token');
    });

    await test('PRODUCTIZATION-P10-04', async () => {
      const response = await fetch(`${baseUrl}/v1/workspaces/missing`, {
        headers: { authorization: 'Bearer good-token' },
      });
      const body = await json(response);
      assert.strictEqual(response.status, 404);
      assert.strictEqual(body.error.code, 'WORKSPACE_NOT_FOUND');
    });

    await test('PRODUCTIZATION-P10-05', async () => {
      const response = await fetch(`${baseUrl}/v1/workspaces/forbidden`, {
        headers: { authorization: 'Bearer good-token' },
      });
      const body = await json(response);
      assert.strictEqual(response.status, 403);
      assert.strictEqual(body.error.code, 'FORBIDDEN');
      assert.ok(!JSON.stringify(body).includes('analyst details'));
    });

    await test('PRODUCTIZATION-P10-06', async () => {
      const response = await fetch(`${baseUrl}/v1/workspaces/workspace-1`, {
        method: 'PUT',
        headers: {
          authorization: 'Bearer good-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          workspace: { workspaceId: 'other-workspace' },
          expectedVersion: 0,
          operationId: 'op-1',
        }),
      });
      const body = await json(response);
      assert.strictEqual(response.status, 400);
      assert.strictEqual(body.error.code, 'WORKSPACE_ROUTE_BODY_MISMATCH');
    });

    await test('PRODUCTIZATION-P10-07', async () => {
      const before = service.calls.length;
      const response = await fetch(`${baseUrl}/v1/workspaces/workspace-1`, {
        method: 'PUT',
        headers: {
          authorization: 'Bearer good-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          workspace: { workspaceId: 'workspace-1' },
          expectedVersion: 0,
          operationId: 'op-2',
          actorId: 'forged-admin',
          tenantId: 'other-tenant',
        }),
      });
      const body = await json(response);
      assert.strictEqual(response.status, 400);
      assert.strictEqual(body.error.code, 'INVALID_REQUEST_BODY');
      assert.strictEqual(service.calls.length, before);
    });

    await test('PRODUCTIZATION-P10-08', async () => {
      const response = await fetch(`${baseUrl}/v1/workspaces/workspace-1`, {
        method: 'PUT',
        headers: {
          authorization: 'Bearer good-token',
          'content-type': 'text/plain',
        },
        body: '{}',
      });
      const body = await json(response);
      assert.strictEqual(response.status, 415);
      assert.strictEqual(body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
    });

    await test('PRODUCTIZATION-P10-09', async () => {
      const response = await fetch(`${baseUrl}/v1/workspaces/workspace-1`, {
        method: 'PUT',
        headers: {
          authorization: 'Bearer good-token',
          'content-type': 'application/json',
        },
        body: '{bad json',
      });
      const body = await json(response);
      assert.strictEqual(response.status, 400);
      assert.strictEqual(body.error.code, 'INVALID_JSON_BODY');
    });

    await test('PRODUCTIZATION-P10-10', async () => {
      const response = await fetch(`${baseUrl}/v1/workspaces/workspace-1`, {
        method: 'PUT',
        headers: {
          authorization: 'Bearer good-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          workspace: {
            schemaVersion: 1,
            workspaceId: 'workspace-1',
            projectId: 'project-1',
            caseId: 'case-1',
          },
          expectedVersion: 2,
          operationId: 'conflict',
        }),
      });
      const body = await json(response);
      assert.strictEqual(response.status, 409);
      assert.strictEqual(body.error.code, 'WORKSPACE_VERSION_CONFLICT');
    });

    await test('PRODUCTIZATION-P10-11', async () => {
      const response = await fetch(`${baseUrl}/v1/workspaces/explode`, {
        headers: { authorization: 'Bearer good-token' },
      });
      const body = await json(response);
      assert.strictEqual(response.status, 500);
      assert.strictEqual(body.error.code, 'INTERNAL_ERROR');
      assert.ok(!JSON.stringify(body).includes('super-secret'));
      assert.ok(!JSON.stringify(body).includes('database password'));
    });

    await test('PRODUCTIZATION-P10-12', async () => {
      const response = await fetch(`${baseUrl}/v1/workspaces/workspace-1`, {
        headers: {
          authorization: 'Bearer good-token',
          origin: 'https://app.startak.example',
        },
      });
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.headers.get('access-control-allow-origin'), 'https://app.startak.example');
      assert.strictEqual(response.headers.get('vary'), 'Origin');
    });

    await test('PRODUCTIZATION-P10-13', async () => {
      const response = await fetch(`${baseUrl}/v1/workspaces/workspace-1`, {
        headers: {
          authorization: 'Bearer good-token',
          origin: 'https://evil.example',
        },
      });
      const body = await json(response);
      assert.strictEqual(response.status, 403);
      assert.strictEqual(body.error.code, 'ORIGIN_NOT_ALLOWED');
      assert.strictEqual(response.headers.get('access-control-allow-origin'), null);
    });

    await test('PRODUCTIZATION-P10-14', async () => {
      const response = await fetch(`${baseUrl}/v1/workspaces/workspace-1`, {
        method: 'OPTIONS',
        headers: { origin: 'https://app.startak.example' },
      });
      assert.strictEqual(response.status, 204);
      assert.strictEqual(response.headers.get('access-control-allow-origin'), 'https://app.startak.example');
      assert.strictEqual(response.headers.get('access-control-allow-methods'), 'GET, PUT, OPTIONS');
      assert.strictEqual(response.headers.get('access-control-allow-headers'), 'authorization, content-type');
    });

    await test('PRODUCTIZATION-P10-15', async () => {
      const response = await fetch(`${baseUrl}/v1/workspaces/workspace-1`, {
        method: 'DELETE',
        headers: { authorization: 'Bearer good-token' },
      });
      const body = await json(response);
      assert.strictEqual(response.status, 405);
      assert.strictEqual(body.error.code, 'METHOD_NOT_ALLOWED');
      assert.strictEqual(response.headers.get('allow'), 'GET, PUT, OPTIONS');
    });
  });

  const sizeService = createService();
  await withServer({ service: sizeService, maxBodyBytes: 1024 }, async (baseUrl) => {
    await test('PRODUCTIZATION-P10-16', async () => {
      const oversized = 'x'.repeat(2048);
      const response = await fetch(`${baseUrl}/v1/workspaces/workspace-1`, {
        method: 'PUT',
        headers: {
          authorization: 'Bearer good-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          workspace: { workspaceId: 'workspace-1', note: oversized },
          expectedVersion: 0,
          operationId: 'op-large',
        }),
      });
      const body = await json(response);
      assert.strictEqual(response.status, 413);
      assert.strictEqual(body.error.code, 'REQUEST_BODY_TOO_LARGE');
      assert.strictEqual(sizeService.calls.length, 0);
    });
  });

  const failed = results.filter((entry) => entry[1] !== 'PASS');
  console.log(`PRODUCTIZATION_P10_HTTP_API_RESULT=${failed.length === 0 ? 'PASS' : 'FAIL'} ${results.filter((entry) => entry[1] === 'PASS').length}/${results.length}`);
  if (failed.length > 0) process.exit(1);
})().catch((error) => {
  console.error('PRODUCTIZATION_P10_HTTP_API_FATAL', error && error.stack ? error.stack : error);
  process.exit(1);
});
