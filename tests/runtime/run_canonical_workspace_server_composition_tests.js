'use strict';

const assert = require('assert');
const {
  TENANT_ROUTING_MODE,
  COMPOSITION_STATUS,
  normalizeConfig,
  createCanonicalWorkspaceServerRuntime,
} = require('../../src/server/canonical-workspace-server-composition');

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

function baseConfig(overrides = {}) {
  return {
    issuer: 'https://id.example.test/',
    audience: 'startak-api',
    jwksUri: 'https://id.example.test/.well-known/jwks.json',
    tenantRoutingMode: TENANT_ROUTING_MODE.TOKEN_CLAIM,
    allowedOrigins: ['https://app.example.test'],
    postgres: {
      schemaName: 'public',
      tableName: 'canonical_workspaces',
      tenantSetting: 'app.tenant_id',
    },
    ...overrides,
  };
}

function goodJwksFetch() {
  return async () => ({
    ok: true,
    status: 200,
    headers: { get: (name) => String(name).toLowerCase() === 'content-type' ? 'application/json' : null },
    text: async () => JSON.stringify({
      keys: [{ kid: 'test-key', kty: 'RSA', alg: 'RS256', use: 'sig', n: 'AQAB', e: 'AQAB' }],
    }),
  });
}

function createPool({ fail = false } = {}) {
  const state = { connects: 0, releases: 0, queries: [] };
  return {
    state,
    async connect() {
      state.connects += 1;
      if (fail) throw new Error('database secret should never leave probe');
      return {
        async query(sql, params) {
          state.queries.push({ sql, params });
          if (sql === 'SELECT 1 AS readiness_check') return { rowCount: 1, rows: [{ readiness_check: 1 }] };
          throw new Error('unexpected SQL in composition test');
        },
        release() { state.releases += 1; },
      };
    },
  };
}

async function withServer(runtime, fn) {
  await new Promise((resolve, reject) => {
    runtime.server.once('error', reject);
    runtime.server.listen(0, '127.0.0.1', resolve);
  });
  const address = runtime.server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve, reject) => runtime.server.close((error) => error ? reject(error) : resolve()));
  }
}

(async () => {
  await test('PRODUCTIZATION-P11-01', async () => {
    const normalized = normalizeConfig(baseConfig());
    assert.strictEqual(normalized.tenantRoutingMode, TENANT_ROUTING_MODE.TOKEN_CLAIM);
    assert.strictEqual(normalized.requiredTenantId, null);
    assert.strictEqual(normalized.postgres.tableName, 'canonical_workspaces');
    assert.ok(Object.isFrozen(normalized));
    assert.ok(Object.isFrozen(normalized.postgres));
  });

  await test('PRODUCTIZATION-P11-02', async () => {
    const runtime = createCanonicalWorkspaceServerRuntime({
      config: baseConfig({
        tenantRoutingMode: TENANT_ROUTING_MODE.PINNED_TENANT,
        requiredTenantId: 'tenant-1',
      }),
      pool: createPool(),
      fetchImpl: goodJwksFetch(),
      requestIdFactory: () => 'req-p11',
    });
    assert.strictEqual(runtime.status, COMPOSITION_STATUS.COMPOSED_NOT_PRODUCTION_QUALIFIED);
    assert.strictEqual(runtime.service.requiredTenantId, 'tenant-1');
    assert.strictEqual(runtime.configuration.tenantRoutingMode, TENANT_ROUTING_MODE.PINNED_TENANT);
    assert.strictEqual(runtime.configuration.requiredTenantId, 'tenant-1');
    assert.strictEqual(runtime.authority.productionAuthenticationValidated, false);
    assert.strictEqual(runtime.authority.productionPersistenceValidated, false);
    assert.strictEqual(runtime.externalQualificationRequired, true);
  });

  await test('PRODUCTIZATION-P11-03', async () => {
    assert.throws(
      () => normalizeConfig(baseConfig({ requiredTenantId: 'forged-tenant' })),
      /only allowed with PINNED_TENANT/,
    );
    assert.throws(
      () => normalizeConfig(baseConfig({ tenantRoutingMode: TENANT_ROUTING_MODE.PINNED_TENANT })),
      /requiredTenantId/,
    );
    assert.throws(
      () => normalizeConfig(baseConfig({ tenantRoutingMode: 'AMBIENT_REQUEST_HEADER' })),
      /tenantRoutingMode/,
    );
  });

  await test('PRODUCTIZATION-P11-04', async () => {
    const pool = createPool();
    const runtime = createCanonicalWorkspaceServerRuntime({
      config: baseConfig(),
      pool,
      fetchImpl: goodJwksFetch(),
    });
    const probe = await runtime.probeDependencies();
    assert.strictEqual(probe.status, COMPOSITION_STATUS.DEPENDENCIES_REACHABLE_NOT_PRODUCTION_QUALIFIED);
    assert.strictEqual(probe.ready, true);
    assert.strictEqual(probe.checks.jwksReachable, true);
    assert.strictEqual(probe.checks.databaseReachable, true);
    assert.strictEqual(probe.checks.rlsRuntimeVerified, false);
    assert.strictEqual(probe.checks.crossTenantIdorVerified, false);
    assert.strictEqual(probe.productionQualified, false);
    assert.strictEqual(probe.authority.deploymentAuthorized, false);
    assert.strictEqual(pool.state.connects, 1);
    assert.strictEqual(pool.state.releases, 1);
    assert.deepStrictEqual(pool.state.queries.map((entry) => entry.sql), ['SELECT 1 AS readiness_check']);
  });

  await test('PRODUCTIZATION-P11-05', async () => {
    const runtime = createCanonicalWorkspaceServerRuntime({
      config: baseConfig(),
      pool: createPool(),
      fetchImpl: async () => { throw new Error('jwks infrastructure secret'); },
    });
    const probe = await runtime.probeDependencies();
    assert.strictEqual(probe.status, COMPOSITION_STATUS.HOLD_EXTERNAL_DEPENDENCIES);
    assert.strictEqual(probe.ready, false);
    assert.strictEqual(probe.checks.jwksReachable, false);
    assert.strictEqual(probe.checks.databaseReachable, true);
    assert.ok(!JSON.stringify(probe).includes('infrastructure secret'));
  });

  await test('PRODUCTIZATION-P11-06', async () => {
    const runtime = createCanonicalWorkspaceServerRuntime({
      config: baseConfig(),
      pool: createPool({ fail: true }),
      fetchImpl: goodJwksFetch(),
    });
    const probe = await runtime.probeDependencies();
    assert.strictEqual(probe.status, COMPOSITION_STATUS.HOLD_EXTERNAL_DEPENDENCIES);
    assert.strictEqual(probe.ready, false);
    assert.strictEqual(probe.checks.jwksReachable, true);
    assert.strictEqual(probe.checks.databaseReachable, false);
    assert.ok(!JSON.stringify(probe).includes('database secret'));
  });

  await test('PRODUCTIZATION-P11-07', async () => {
    const runtime = createCanonicalWorkspaceServerRuntime({
      config: baseConfig(),
      pool: createPool(),
      fetchImpl: goodJwksFetch(),
      requestIdFactory: () => 'req-p11-http',
    });
    await withServer(runtime, async (baseUrl) => {
      const healthResponse = await fetch(`${baseUrl}/healthz`);
      const health = await healthResponse.json();
      assert.strictEqual(healthResponse.status, 200);
      assert.strictEqual(health.status, 'LIVE');
      assert.strictEqual(health.productionQualified, false);
      assert.strictEqual(healthResponse.headers.get('x-request-id'), 'req-p11-http');

      const workspaceResponse = await fetch(`${baseUrl}/v1/workspaces/workspace-1`);
      const workspace = await workspaceResponse.json();
      assert.strictEqual(workspaceResponse.status, 401);
      assert.strictEqual(workspace.error.code, 'AUTHENTICATION_REQUIRED');
      assert.strictEqual(workspace.authority.productionAuthenticationValidated, false);
      assert.strictEqual(workspace.authority.productionPersistenceValidated, false);
    });
  });

  await test('PRODUCTIZATION-P11-08', async () => {
    const pool = createPool();
    const runtime = createCanonicalWorkspaceServerRuntime({
      config: baseConfig(),
      pool,
      fetchImpl: goodJwksFetch(),
    });
    const serializedConfiguration = JSON.stringify(runtime.configuration);
    assert.ok(!serializedConfiguration.includes('password'));
    assert.ok(!serializedConfiguration.includes('connectionString'));
    assert.ok(!serializedConfiguration.includes('token'));
    assert.ok(!serializedConfiguration.includes('secret'));
    assert.strictEqual(runtime.components.storageProvider.capabilities.serverSideOnly, true);
    assert.strictEqual(runtime.components.storageProvider.capabilities.transactionScopedTenantContext, true);
    assert.strictEqual(runtime.components.storageProvider.capabilities.productionPersistenceValidated, false);
    assert.strictEqual(runtime.components.authenticator.capabilities.cryptographicJwtVerification, true);
    assert.strictEqual(runtime.components.authenticator.capabilities.productionAuthenticationValidated, false);
  });

  const failed = results.filter((entry) => entry[1] !== 'PASS');
  console.log(`PRODUCTIZATION_P11_SERVER_COMPOSITION_RESULT=${failed.length === 0 ? 'PASS' : 'FAIL'} ${results.filter((entry) => entry[1] === 'PASS').length}/${results.length}`);
  if (failed.length > 0) process.exit(1);
})().catch((error) => {
  console.error('PRODUCTIZATION_P11_SERVER_COMPOSITION_FATAL', error && error.stack ? error.stack : error);
  process.exit(1);
});
