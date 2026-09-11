'use strict';

const assert = require('assert');
const {
  createVerifiedIdentityContext,
} = require('../../src/security/verified-identity-context');
const {
  OPERATIONS_STATUS,
  EVIDENCE_STATE,
  createAuthenticatedOperationsService,
} = require('../../src/runtime/authenticated-operations-service');

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

function verifiedIdentity({ actorId = 'user-1', tenantId = 'tenant-a', roles = ['ADMIN'] } = {}) {
  return createVerifiedIdentityContext({
    claims: {
      sub: actorId,
      tenant_id: tenantId,
      roles,
      iss: 'https://identity.example.test',
      aud: 'startak-real-estate',
      exp: 4_000_000_000,
    },
    tokenVerificationEvidence: {
      verified: true,
      verificationRef: 'test-verifier',
    },
    nowEpochSeconds: 1_000,
  });
}

function createHarness({
  identityContext = verifiedIdentity(),
  envelopeTenantId = 'tenant-a',
  persistenceCapabilities = {},
  requiredTenantId,
} = {}) {
  const calls = {
    authenticate: [],
    loadWorkspace: [],
  };

  const authenticator = {
    async authenticate(args) {
      calls.authenticate.push(args);
      return {
        authorizationReady: true,
        identityContext,
      };
    },
  };

  const workspaceService = {
    async loadWorkspace(args) {
      calls.loadWorkspace.push(args);
      return {
        status: 'OK',
        data: {
          schemaVersion: 1,
          tenantId: envelopeTenantId,
          workspaceId: args.workspaceId,
          version: 3,
          workspace: {
            workspaceId: args.workspaceId,
            projectId: 'project-1',
            caseId: 'case-1',
          },
          history: [],
        },
      };
    },
  };

  return {
    calls,
    service: createAuthenticatedOperationsService({
      authenticator,
      workspaceService,
      requiredTenantId,
      persistenceCapabilities,
    }),
  };
}

async function expectRejectCode(promiseFactory, code) {
  await assert.rejects(
    promiseFactory,
    (error) => error && error.code === code,
    `expected rejection code ${code}`,
  );
}

(async () => {
  await test('PRODUCTIZATION-P8-01', async () => {
    assert.throws(
      () => createAuthenticatedOperationsService(),
      /authenticator\.authenticate is required/,
    );
  });

  await test('PRODUCTIZATION-P8-02', async () => {
    const { service, calls } = createHarness({
      persistenceCapabilities: {
        atomicCompareAndSet: true,
        tenantKeyIsolation: true,
        structuredTenantScope: true,
        externalDatabaseDeploymentRequired: false,
        productionPersistenceValidated: true,
        connectionString: 'postgres://must-not-leak',
        password: 'must-not-leak',
        jwtSecret: 'must-not-leak',
      },
      requiredTenantId: 'tenant-a',
    });

    const result = await service.inspectWorkspace({
      authorizationHeader: 'Bearer test-token',
      workspaceId: 'workspace-1',
      operationId: 'operation-1',
      occurredAt: '2026-09-09T12:00:00.000Z',
      nowEpochSeconds: 2_000,
    });

    assert.strictEqual(result.status, OPERATIONS_STATUS.HOLD_EXTERNAL_PRODUCTION_EVIDENCE);
    assert.strictEqual(result.scope.workspaceId, 'workspace-1');
    assert.strictEqual(result.scope.workspaceVersion, 3);
    assert.strictEqual(result.scope.tenantId, 'tenant-a');
    assert.strictEqual(result.scope.scopeDerivedFrom, 'AUTHENTICATED_CANONICAL_WORKSPACE');
    assert.strictEqual(result.operator.actorId, 'user-1');
    assert.strictEqual(result.operator.authorizationBasis, 'VERIFIED_IDENTITY_AND_ADMIN_RBAC');
    assert.strictEqual(result.authentication.productionAuthenticationValidated, false);
    assert.strictEqual(result.persistence.productionPersistenceValidated, false);
    assert.strictEqual(result.persistence.evidenceState, EVIDENCE_STATE.EXTERNAL_EVIDENCE_REQUIRED);
    assert.strictEqual(result.operationalEvidence.evidenceState, EVIDENCE_STATE.EXTERNAL_EVIDENCE_REQUIRED);
    assert.strictEqual(result.audit.persisted, false);
    assert.strictEqual(result.audit.event.actorId, 'user-1');
    assert.strictEqual(result.audit.event.tenantId, 'tenant-a');
    assert.strictEqual(result.audit.event.action, 'INSPECT_OPERATIONS');
    assert.strictEqual(result.audit.event.resourceId, 'workspace-1');
    assert.strictEqual(result.audit.event.decision, 'ALLOW');
    assert.strictEqual(result.readOnly, true);
    assert.strictEqual(result.secretsExposed, false);

    for (const key of [
      'releaseAuthorized',
      'mergeAuthorized',
      'deploymentAuthorized',
      'transactionAuthorized',
      'productionAuthenticationValidated',
      'productionPersistenceValidated',
    ]) {
      assert.strictEqual(result.authority[key], false, `${key} must remain false`);
    }

    const serialized = JSON.stringify(result);
    for (const forbidden of ['postgres://must-not-leak', 'must-not-leak', 'connectionString', 'jwtSecret', 'password']) {
      assert.strictEqual(serialized.includes(forbidden), false, `forbidden operational data leaked: ${forbidden}`);
    }

    assert.strictEqual(calls.authenticate.length, 1);
    assert.strictEqual(calls.authenticate[0].requiredTenantId, 'tenant-a');
    assert.strictEqual(calls.loadWorkspace.length, 1);
    assert.deepStrictEqual(calls.loadWorkspace[0], {
      authorizationHeader: 'Bearer test-token',
      workspaceId: 'workspace-1',
      nowEpochSeconds: 2_000,
    });
  });

  await test('PRODUCTIZATION-P8-03', async () => {
    const { service, calls } = createHarness({
      identityContext: verifiedIdentity({ roles: ['ANALYST'] }),
    });
    await expectRejectCode(
      () => service.inspectWorkspace({
        authorizationHeader: 'Bearer analyst-token',
        workspaceId: 'workspace-1',
        operationId: 'operation-2',
        occurredAt: '2026-09-09T12:01:00.000Z',
      }),
      'ROLE_NOT_AUTHORIZED',
    );
    assert.strictEqual(calls.loadWorkspace.length, 0, 'workspace must not load before ADMIN authorization');
  });

  await test('PRODUCTIZATION-P8-04', async () => {
    const overrides = [
      ['tenantId', 'attacker-tenant'],
      ['actorId', 'attacker'],
      ['roles', ['ADMIN']],
      ['identityContext', verifiedIdentity({ actorId: 'attacker' })],
    ];
    for (const [field, value] of overrides) {
      const { service, calls } = createHarness();
      await expectRejectCode(
        () => service.inspectWorkspace({
          authorizationHeader: 'Bearer test-token',
          workspaceId: 'workspace-1',
          operationId: `operation-override-${field}`,
          occurredAt: '2026-09-09T12:02:00.000Z',
          [field]: value,
        }),
        'CALLER_OPERATIONS_AUTHORITY_OVERRIDE_NOT_ALLOWED',
      );
      assert.strictEqual(calls.authenticate.length, 0, `${field} override must fail before authentication/runtime work`);
      assert.strictEqual(calls.loadWorkspace.length, 0, `${field} override must fail before workspace access`);
    }
  });

  await test('PRODUCTIZATION-P8-05', async () => {
    const authorityFields = [
      'productionAuthenticationValidated',
      'productionPersistenceValidated',
      'releaseAuthorized',
      'mergeAuthorized',
      'deploymentAuthorized',
      'transactionAuthorized',
    ];
    for (const field of authorityFields) {
      const { service } = createHarness();
      await expectRejectCode(
        () => service.inspectWorkspace({
          authorizationHeader: 'Bearer test-token',
          workspaceId: 'workspace-1',
          operationId: `operation-authority-${field}`,
          occurredAt: '2026-09-09T12:03:00.000Z',
          [field]: true,
        }),
        'CALLER_OPERATIONS_AUTHORITY_OVERRIDE_NOT_ALLOWED',
      );
    }
  });

  await test('PRODUCTIZATION-P8-06', async () => {
    const { service } = createHarness({
      persistenceCapabilities: {
        atomicCompareAndSet: true,
        tenantKeyIsolation: true,
        structuredTenantScope: true,
        externalDatabaseDeploymentRequired: false,
        productionPersistenceValidated: true,
        provider: { secret: 'must-not-leak' },
        cookie: 'must-not-leak',
        jwks: { privateKey: 'must-not-leak' },
      },
    });

    assert.deepStrictEqual(Object.keys(service.persistenceCapabilities).sort(), [
      'atomicCompareAndSet',
      'evidenceState',
      'externalDatabaseDeploymentRequired',
      'productionPersistenceValidated',
      'structuredTenantScope',
      'tenantKeyIsolation',
    ].sort());
    assert.strictEqual(service.persistenceCapabilities.productionPersistenceValidated, false);
    assert.strictEqual(service.persistenceCapabilities.externalDatabaseDeploymentRequired, true);
    assert.strictEqual(JSON.stringify(service).includes('must-not-leak'), false);
  });

  await test('PRODUCTIZATION-P8-07', async () => {
    const { service } = createHarness({ envelopeTenantId: 'tenant-b' });
    await expectRejectCode(
      () => service.inspectWorkspace({
        authorizationHeader: 'Bearer test-token',
        workspaceId: 'workspace-1',
        operationId: 'operation-tenant-mismatch',
        occurredAt: '2026-09-09T12:04:00.000Z',
      }),
      'AUTHENTICATED_TENANT_SCOPE_MISMATCH',
    );
  });

  await test('PRODUCTIZATION-P8-08', async () => {
    const { service } = createHarness({ identityContext: { authorizationReady: false } });
    await expectRejectCode(
      () => service.inspectWorkspace({
        authorizationHeader: 'Bearer invalid-token',
        workspaceId: 'workspace-1',
        operationId: 'operation-invalid-identity',
        occurredAt: '2026-09-09T12:05:00.000Z',
      }),
      'VERIFIED_IDENTITY_CONTEXT_REQUIRED',
    );
  });

  await test('PRODUCTIZATION-P8-09', async () => {
    const { service } = createHarness();
    assert.deepStrictEqual(
      Object.keys(service).sort(),
      ['authority', 'inspectWorkspace', 'persistenceCapabilities', 'policy', 'requiredTenantId', 'semantics'].sort(),
    );
    assert.strictEqual(typeof service.saveWorkspace, 'undefined');
    assert.strictEqual(typeof service.deleteWorkspace, 'undefined');
    assert.strictEqual(typeof service.updateWorkspace, 'undefined');
    assert.strictEqual(Object.isFrozen(service), true);
  });

  const failed = results.filter((row) => row[1] !== 'PASS');
  console.log('');
  console.log('AUTHENTICATED_OPERATIONS_TEST_CASES=' + results.length);
  console.log('AUTHENTICATED_OPERATIONS_TESTS=' + (failed.length === 0 ? 'PASS' : 'FAIL'));
  process.exitCode = failed.length === 0 ? 0 : 1;
})();
