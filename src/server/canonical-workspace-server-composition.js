'use strict';

const { DEFAULT_MAX_BODY_BYTES, createNodeHttpServer } = require('./canonical-workspace-http-api');
const { createRemoteJwksProvider } = require('../security/remote-jwks-provider');
const { createOidcBearerAuthenticator } = require('../security/oidc-bearer-authenticator');
const { createPostgresCanonicalWorkspaceProvider } = require('../storage/postgres-canonical-workspace-provider');
const { createCanonicalWorkspacePersistence } = require('../runtime/canonical-workspace-persistence');
const { createCanonicalWorkspaceRuntime } = require('../runtime/canonical-workspace-runtime');
const { createAuthenticatedCanonicalWorkspaceService } = require('../runtime/authenticated-canonical-workspace-service');

const TENANT_ROUTING_MODE = Object.freeze({
  TOKEN_CLAIM: 'TOKEN_CLAIM',
  PINNED_TENANT: 'PINNED_TENANT',
});

const COMPOSITION_STATUS = Object.freeze({
  COMPOSED_NOT_PRODUCTION_QUALIFIED: 'COMPOSED_NOT_PRODUCTION_QUALIFIED',
  DEPENDENCIES_REACHABLE_NOT_PRODUCTION_QUALIFIED: 'DEPENDENCIES_REACHABLE_NOT_PRODUCTION_QUALIFIED',
  HOLD_EXTERNAL_DEPENDENCIES: 'HOLD_EXTERNAL_DEPENDENCIES',
});

const AUTHORITY = Object.freeze({
  releaseAuthorized: false,
  mergeAuthorized: false,
  deploymentAuthorized: false,
  goLiveAuthorized: false,
  transactionAuthorized: false,
  productionAuthenticationValidated: false,
  productionPersistenceValidated: false,
  productionSecurityValidated: false,
  productionPerformanceValidated: false,
});

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function optionalPositiveNumber(value, field, { min, max, integer = false } = {}) {
  if (value == null) return undefined;
  if (!Number.isFinite(value)) throw new TypeError(`${field} must be finite`);
  if (integer && !Number.isInteger(value)) throw new TypeError(`${field} must be an integer`);
  if (min != null && value < min) throw new TypeError(`${field} must be >= ${min}`);
  if (max != null && value > max) throw new TypeError(`${field} must be <= ${max}`);
  return value;
}

function normalizeConfig(config = {}) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new TypeError('config must be an object');

  const tenantRoutingMode = requiredString(config.tenantRoutingMode, 'config.tenantRoutingMode').toUpperCase();
  if (!Object.values(TENANT_ROUTING_MODE).includes(tenantRoutingMode)) {
    throw new TypeError(`config.tenantRoutingMode must be one of ${Object.values(TENANT_ROUTING_MODE).join(', ')}`);
  }

  let requiredTenantId = null;
  if (tenantRoutingMode === TENANT_ROUTING_MODE.PINNED_TENANT) {
    requiredTenantId = requiredString(config.requiredTenantId, 'config.requiredTenantId');
  } else if (config.requiredTenantId != null) {
    throw new TypeError('config.requiredTenantId is only allowed with PINNED_TENANT routing');
  }

  const allowedOrigins = config.allowedOrigins == null ? [] : config.allowedOrigins;
  if (!Array.isArray(allowedOrigins)) throw new TypeError('config.allowedOrigins must be an array');

  const postgres = config.postgres == null ? {} : config.postgres;
  if (!postgres || typeof postgres !== 'object' || Array.isArray(postgres)) throw new TypeError('config.postgres must be an object');

  const jwt = config.jwt == null ? {} : config.jwt;
  if (!jwt || typeof jwt !== 'object' || Array.isArray(jwt)) throw new TypeError('config.jwt must be an object');

  const maxBodyBytes = optionalPositiveNumber(config.maxBodyBytes, 'config.maxBodyBytes', {
    min: 1024,
    max: 10 * 1024 * 1024,
    integer: true,
  }) ?? DEFAULT_MAX_BODY_BYTES;

  const cacheTtlMs = optionalPositiveNumber(jwt.cacheTtlMs, 'config.jwt.cacheTtlMs', {
    min: 0,
    max: 24 * 60 * 60 * 1000,
  });
  const clockToleranceSeconds = optionalPositiveNumber(jwt.clockToleranceSeconds, 'config.jwt.clockToleranceSeconds', {
    min: 0,
    max: 300,
  });
  const maxTokenAgeSeconds = optionalPositiveNumber(jwt.maxTokenAgeSeconds, 'config.jwt.maxTokenAgeSeconds', {
    min: Number.MIN_VALUE,
  });

  const normalized = {
    issuer: requiredString(config.issuer, 'config.issuer'),
    audience: requiredString(config.audience, 'config.audience'),
    jwksUri: requiredString(config.jwksUri, 'config.jwksUri'),
    tenantRoutingMode,
    requiredTenantId,
    allowedOrigins: Object.freeze([...allowedOrigins]),
    maxBodyBytes,
    jwt: Object.freeze({
      cacheTtlMs,
      clockToleranceSeconds,
      maxTokenAgeSeconds,
    }),
    postgres: Object.freeze({
      schemaName: postgres.schemaName == null ? 'public' : requiredString(postgres.schemaName, 'config.postgres.schemaName'),
      tableName: postgres.tableName == null ? 'canonical_workspaces' : requiredString(postgres.tableName, 'config.postgres.tableName'),
      tenantSetting: postgres.tenantSetting == null ? 'app.tenant_id' : requiredString(postgres.tenantSetting, 'config.postgres.tenantSetting'),
    }),
  };

  return Object.freeze(normalized);
}

function assertPool(pool) {
  if (!pool || typeof pool.connect !== 'function') throw new TypeError('pool.connect is required');
  return pool;
}

async function probeDatabase(pool) {
  let client;
  try {
    client = await pool.connect();
    if (!client || typeof client.query !== 'function' || typeof client.release !== 'function') return false;
    const result = await client.query('SELECT 1 AS readiness_check');
    return Boolean(result && Array.isArray(result.rows) && result.rows[0] && Number(result.rows[0].readiness_check) === 1);
  } catch (_) {
    return false;
  } finally {
    if (client && typeof client.release === 'function') {
      try { client.release(); } catch (_) { /* operational evidence concern */ }
    }
  }
}

function createCanonicalWorkspaceServerRuntime({
  config,
  pool,
  fetchImpl = globalThis.fetch,
  requestIdFactory,
} = {}) {
  const normalizedConfig = normalizeConfig(config);
  const postgresPool = assertPool(pool);

  const jwksProvider = createRemoteJwksProvider({
    issuer: normalizedConfig.issuer,
    jwksUri: normalizedConfig.jwksUri,
    fetchImpl,
    ...(normalizedConfig.jwt.cacheTtlMs == null ? {} : { cacheTtlMs: normalizedConfig.jwt.cacheTtlMs }),
  });

  const authenticator = createOidcBearerAuthenticator({
    issuer: jwksProvider.issuer,
    audience: normalizedConfig.audience,
    jwksProvider,
    ...(normalizedConfig.jwt.clockToleranceSeconds == null ? {} : { clockToleranceSeconds: normalizedConfig.jwt.clockToleranceSeconds }),
    ...(normalizedConfig.jwt.maxTokenAgeSeconds == null ? {} : { maxTokenAgeSeconds: normalizedConfig.jwt.maxTokenAgeSeconds }),
  });

  const storageProvider = createPostgresCanonicalWorkspaceProvider({
    pool: postgresPool,
    schemaName: normalizedConfig.postgres.schemaName,
    tableName: normalizedConfig.postgres.tableName,
    tenantSetting: normalizedConfig.postgres.tenantSetting,
  });
  const persistence = createCanonicalWorkspacePersistence({ storageProvider });
  const runtime = createCanonicalWorkspaceRuntime({ persistence });
  const service = createAuthenticatedCanonicalWorkspaceService({
    authenticator,
    runtime,
    requiredTenantId: normalizedConfig.requiredTenantId || undefined,
  });
  const server = createNodeHttpServer({
    service,
    allowedOrigins: normalizedConfig.allowedOrigins,
    maxBodyBytes: normalizedConfig.maxBodyBytes,
    ...(requestIdFactory == null ? {} : { requestIdFactory }),
  });

  async function probeDependencies() {
    let jwksReachable = false;
    try {
      const jwks = await jwksProvider.getJwks({ forceRefresh: true });
      jwksReachable = Boolean(jwks && Array.isArray(jwks.keys) && jwks.keys.length > 0);
    } catch (_) {
      jwksReachable = false;
    }

    const databaseReachable = await probeDatabase(postgresPool);
    const ready = jwksReachable && databaseReachable;

    return Object.freeze({
      status: ready
        ? COMPOSITION_STATUS.DEPENDENCIES_REACHABLE_NOT_PRODUCTION_QUALIFIED
        : COMPOSITION_STATUS.HOLD_EXTERNAL_DEPENDENCIES,
      ready,
      checks: Object.freeze({
        jwksReachable,
        databaseReachable,
        rlsRuntimeVerified: false,
        crossTenantIdorVerified: false,
        durableAuditVerified: false,
        backupRestoreVerified: false,
        disasterRecoveryVerified: false,
        monitoringAlertingVerified: false,
      }),
      productionQualified: false,
      authority: AUTHORITY,
      semantics: 'Dependency reachability proves only that the configured JWKS endpoint returned a structurally valid public JWKS and that the injected PostgreSQL pool answered a basic SELECT. It does not verify RLS effectiveness, cross-tenant isolation, IdP registration, revocation/MFA, database migration state, backups, DR, monitoring, penetration testing, compliance, or production authorization.',
    });
  }

  return Object.freeze({
    status: COMPOSITION_STATUS.COMPOSED_NOT_PRODUCTION_QUALIFIED,
    server,
    service,
    probeDependencies,
    components: Object.freeze({
      jwksProvider,
      authenticator,
      storageProvider,
      persistence,
      runtime,
    }),
    configuration: Object.freeze({
      issuer: jwksProvider.issuer,
      audience: normalizedConfig.audience,
      jwksUri: jwksProvider.jwksUri,
      tenantRoutingMode: normalizedConfig.tenantRoutingMode,
      requiredTenantId: normalizedConfig.requiredTenantId,
      allowedOrigins: normalizedConfig.allowedOrigins,
      maxBodyBytes: normalizedConfig.maxBodyBytes,
      postgres: normalizedConfig.postgres,
    }),
    authority: AUTHORITY,
    externalQualificationRequired: true,
    semantics: 'This server-side composition wires the application HTTP boundary to pinned OIDC/JWKS verification and the PostgreSQL-compatible tenant-scoped canonical workspace provider. The PostgreSQL pool and network transport are injected by the host. Composition and reachability are not production qualification, deployment evidence, RLS/IDOR proof, or release/go-live authority.',
  });
}

module.exports = {
  TENANT_ROUTING_MODE,
  COMPOSITION_STATUS,
  AUTHORITY,
  normalizeConfig,
  createCanonicalWorkspaceServerRuntime,
};
