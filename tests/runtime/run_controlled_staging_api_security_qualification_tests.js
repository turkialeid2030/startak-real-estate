'use strict';

const assert = require('assert');
const {
  STAGING_QUALIFICATION_STATUS,
} = require('../../src/qualification/controlled-staging-postgres-qualification');
const {
  API_SECURITY_STATUS,
  createControlledStagingApiSecurityQualification,
} = require('../../src/qualification/controlled-staging-api-security-qualification');

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

function postgresQualification(overrides = {}) {
  return {
    status: STAGING_QUALIFICATION_STATUS.STAGING_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED,
    environment: 'staging',
    targetDatabaseRef: 'staging-db-ref',
    evidenceBundle: { bundleHashSha256: 'a'.repeat(64) },
    productionQualified: false,
    authority: { releaseAuthorized: false },
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  return {
    postgresQualification: postgresQualification(),
    environment: 'staging',
    targetApiRef: 'staging-api-ref',
    targetDatabaseRef: 'staging-db-ref',
    apiBaseUrl: 'https://staging.example.test',
    workspaceId: 'workspace-1',
    tenantAAuthorizationHeader: 'Bearer tenant-a-token',
    tenantBAuthorizationHeader: 'Bearer tenant-b-token',
    adminAuthorizationHeader: 'Bearer admin-token',
    nonAdminAuthorizationHeader: 'Bearer analyst-token',
    testedAt: '2026-09-09T15:50:00.000Z',
    operationId: 'p15-test',
    ...overrides,
  };
}

function successfulRequestExecutor(overrides = {}) {
  const calls = [];
  const executor = async (input) => {
    calls.push(input);
    if (input.scenario === 'TENANT_A_READ') {
      return overrides.tenantA || {
        statusCode: 200,
        body: { status: 'OK', data: { workspace: { workspaceId: 'workspace-1' }, tenantId: 'tenant-a' } },
      };
    }
    if (input.scenario === 'CROSS_TENANT_READ') {
      return overrides.crossTenant || { statusCode: 404, body: { error: { code: 'WORKSPACE_NOT_FOUND' } } };
    }
    if (input.scenario === 'UNAUTHENTICATED_READ') {
      return overrides.unauthenticated || { statusCode: 401, body: { error: { code: 'AUTHENTICATION_REQUIRED' } } };
    }
    throw new Error('unexpected scenario');
  };
  return { executor, calls };
}

function successfulAdminInspector(overrides = {}) {
  const calls = [];
  const inspector = async (input) => {
    calls.push(input);
    if (input.authorizationHeader === 'Bearer admin-token') {
      if (overrides.adminError) throw overrides.adminError;
      return overrides.adminResult || {
        status: 'HOLD_EXTERNAL_PRODUCTION_EVIDENCE',
        readOnly: true,
        secretsExposed: false,
        scope: { workspaceId: 'workspace-1', tenantId: 'tenant-a' },
      };
    }
    if (input.authorizationHeader === 'Bearer analyst-token') {
      if (overrides.nonAdminResult) return overrides.nonAdminResult;
      const error = new Error('ROLE_NOT_AUTHORIZED');
      error.code = overrides.nonAdminErrorCode || 'ROLE_NOT_AUTHORIZED';
      throw error;
    }
    throw new Error('unexpected authorization');
  };
  return { inspector, calls };
}

function assertAuthorityClosed(result) {
  assert.strictEqual(result.productionQualified, false);
  for (const value of Object.values(result.authority)) assert.strictEqual(value, false);
}

(async () => {
  await test('PRODUCTIZATION-P15-01', async () => {
    const { executor, calls: requestCalls } = successfulRequestExecutor();
    const { inspector, calls: adminCalls } = successfulAdminInspector();
    const qualify = createControlledStagingApiSecurityQualification({ requestExecutor: executor, adminInspector: inspector });
    const result = await qualify(baseInput());
    assert.strictEqual(result.status, API_SECURITY_STATUS.STAGING_API_SECURITY_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED);
    assert.strictEqual(requestCalls.length, 3);
    assert.strictEqual(adminCalls.length, 2);
    assert.strictEqual(result.apiEvidence.checks.tenantAReadAllowed, true);
    assert.strictEqual(result.apiEvidence.checks.crossTenantReadDenied, true);
    assert.strictEqual(result.apiEvidence.checks.unauthenticatedReadDenied, true);
    assert.strictEqual(result.adminApplicationPathEvidence.checks.adminReadOnlyInspectionAllowed, true);
    assert.strictEqual(result.adminApplicationPathEvidence.checks.nonAdminInspectionDenied, true);
    assert.strictEqual(result.adminApplicationPathEvidence.databaseOwnerOrBypassRlsPathTestedHere, false);
    assertAuthorityClosed(result);
  });

  await test('PRODUCTIZATION-P15-02', async () => {
    const { executor, calls } = successfulRequestExecutor();
    const { inspector } = successfulAdminInspector();
    const qualify = createControlledStagingApiSecurityQualification({ requestExecutor: executor, adminInspector: inspector });
    const result = await qualify(baseInput({
      postgresQualification: postgresQualification({ status: STAGING_QUALIFICATION_STATUS.HOLD_PRIVILEGED_PATH_EVIDENCE }),
    }));
    assert.strictEqual(result.status, API_SECURITY_STATUS.HOLD_POSTGRES_QUALIFICATION);
    assert.strictEqual(calls.length, 0);
    assert.strictEqual(result.apiEvidence, null);
  });

  await test('PRODUCTIZATION-P15-03', async () => {
    const { executor } = successfulRequestExecutor({
      crossTenant: { statusCode: 200, body: { data: { workspace: { workspaceId: 'workspace-1' }, secret: 'cross-tenant-leak' } } },
    });
    const { inspector, calls } = successfulAdminInspector();
    const qualify = createControlledStagingApiSecurityQualification({ requestExecutor: executor, adminInspector: inspector });
    const result = await qualify(baseInput());
    assert.strictEqual(result.status, API_SECURITY_STATUS.HOLD_API_IDOR_BOLA);
    assert.strictEqual(result.apiEvidence.checks.crossTenantReadDenied, false);
    assert.strictEqual(calls.length, 0);
    assert.ok(!JSON.stringify(result).includes('cross-tenant-leak'));
  });

  await test('PRODUCTIZATION-P15-04', async () => {
    const { executor } = successfulRequestExecutor({
      unauthenticated: { statusCode: 200, body: { data: { workspaceId: 'workspace-1' } } },
    });
    const { inspector } = successfulAdminInspector();
    const qualify = createControlledStagingApiSecurityQualification({ requestExecutor: executor, adminInspector: inspector });
    const result = await qualify(baseInput());
    assert.strictEqual(result.status, API_SECURITY_STATUS.HOLD_API_IDOR_BOLA);
    assert.strictEqual(result.apiEvidence.checks.unauthenticatedReadDenied, false);
  });

  await test('PRODUCTIZATION-P15-05', async () => {
    const executor = async () => { throw new Error('database host secret=must-not-leak'); };
    const { inspector } = successfulAdminInspector();
    const qualify = createControlledStagingApiSecurityQualification({ requestExecutor: executor, adminInspector: inspector });
    const result = await qualify(baseInput());
    assert.strictEqual(result.status, API_SECURITY_STATUS.HOLD_API_EXECUTION);
    assert.ok(!JSON.stringify(result).includes('must-not-leak'));
  });

  await test('PRODUCTIZATION-P15-06', async () => {
    const { executor } = successfulRequestExecutor();
    const { inspector } = successfulAdminInspector({
      nonAdminResult: {
        readOnly: true,
        secretsExposed: false,
        scope: { workspaceId: 'workspace-1', tenantId: 'tenant-a' },
      },
    });
    const qualify = createControlledStagingApiSecurityQualification({ requestExecutor: executor, adminInspector: inspector });
    const result = await qualify(baseInput());
    assert.strictEqual(result.status, API_SECURITY_STATUS.HOLD_ADMIN_APPLICATION_PATH);
    assert.strictEqual(result.adminApplicationPathEvidence.checks.nonAdminInspectionDenied, false);
  });

  await test('PRODUCTIZATION-P15-07', async () => {
    const { executor } = successfulRequestExecutor();
    const adminError = new Error('secret connection string must-not-leak');
    adminError.code = 'DB_ADMIN_INSPECTION_FAILED';
    const { inspector } = successfulAdminInspector({ adminError });
    const qualify = createControlledStagingApiSecurityQualification({ requestExecutor: executor, adminInspector: inspector });
    const result = await qualify(baseInput());
    assert.strictEqual(result.status, API_SECURITY_STATUS.HOLD_ADMIN_APPLICATION_PATH);
    assert.strictEqual(result.adminApplicationPathEvidence.adminFailureCode, 'DB_ADMIN_INSPECTION_FAILED');
    assert.ok(!JSON.stringify(result).includes('must-not-leak'));
  });

  await test('PRODUCTIZATION-P15-08', async () => {
    const { executor } = successfulRequestExecutor();
    const { inspector } = successfulAdminInspector();
    const qualify = createControlledStagingApiSecurityQualification({ requestExecutor: executor, adminInspector: inspector });
    await assert.rejects(
      () => qualify(baseInput({ environment: 'production' })),
      /environment must be one of/,
    );
    await assert.rejects(
      () => qualify(baseInput({ apiBaseUrl: 'http://staging.example.test' })),
      /apiBaseUrl must use https/,
    );
  });

  await test('PRODUCTIZATION-P15-09', async () => {
    const { executor } = successfulRequestExecutor();
    const { inspector } = successfulAdminInspector();
    const qualify = createControlledStagingApiSecurityQualification({ requestExecutor: executor, adminInspector: inspector });
    const input = baseInput();
    const first = await qualify(input);
    const second = await qualify(input);
    assert.strictEqual(first.bundleHashSha256.length, 64);
    assert.strictEqual(first.bundleHashSha256, second.bundleHashSha256);
    assert.ok(first.apiEvidence.evidenceRef.startsWith('api-idor-bola:sha256:'));
    assert.ok(first.adminApplicationPathEvidence.evidenceRef.startsWith('admin-application-path:sha256:'));
    assert.ok(!JSON.stringify(first).includes('tenant-a-token'));
    assert.ok(!JSON.stringify(first).includes('admin-token'));
  });

  const failed = results.filter((entry) => entry[1] !== 'PASS');
  console.log(`PRODUCTIZATION_P15_STAGING_API_SECURITY_QUALIFICATION_RESULT=${failed.length === 0 ? 'PASS' : 'FAIL'} ${results.filter((entry) => entry[1] === 'PASS').length}/${results.length}`);
  if (failed.length > 0) process.exit(1);
})().catch((error) => {
  console.error('PRODUCTIZATION_P15_STAGING_API_SECURITY_QUALIFICATION_FATAL', error && error.stack ? error.stack : error);
  process.exit(1);
});
