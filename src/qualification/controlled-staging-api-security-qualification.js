'use strict';

const crypto = require('crypto');
const {
  STAGING_QUALIFICATION_STATUS,
} = require('./controlled-staging-postgres-qualification');

const API_SECURITY_STATUS = Object.freeze({
  HOLD_POSTGRES_QUALIFICATION: 'HOLD_POSTGRES_QUALIFICATION',
  HOLD_API_EXECUTION: 'HOLD_API_EXECUTION',
  HOLD_API_IDOR_BOLA: 'HOLD_API_IDOR_BOLA',
  HOLD_ADMIN_APPLICATION_PATH: 'HOLD_ADMIN_APPLICATION_PATH',
  STAGING_API_SECURITY_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED: 'STAGING_API_SECURITY_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED',
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
});

const ALLOWED_ENVIRONMENTS = Object.freeze(['staging', 'preproduction']);
const WORKSPACE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function normalizeEnvironment(value) {
  const normalized = requiredString(value, 'environment').toLowerCase();
  if (!ALLOWED_ENVIRONMENTS.includes(normalized)) {
    throw new TypeError(`environment must be one of: ${ALLOWED_ENVIRONMENTS.join(', ')}`);
  }
  return normalized;
}

function normalizeWorkspaceId(value) {
  const normalized = requiredString(value, 'workspaceId');
  if (normalized.length > 128 || !WORKSPACE_ID_RE.test(normalized)) {
    throw new TypeError('workspaceId must be a bounded opaque workspace identifier');
  }
  return normalized;
}

function normalizeApiBaseUrl(value) {
  const raw = requiredString(value, 'apiBaseUrl');
  let url;
  try {
    url = new URL(raw);
  } catch (_) {
    throw new TypeError('apiBaseUrl must be a valid URL');
  }
  if (url.protocol !== 'https:') throw new TypeError('apiBaseUrl must use https');
  if (url.username || url.password || url.search || url.hash) {
    throw new TypeError('apiBaseUrl must not contain credentials, query, or fragment');
  }
  const pathname = url.pathname.replace(/\/+$/, '');
  url.pathname = pathname || '/';
  return url.toString().replace(/\/$/, '');
}

function requiredBearerHeader(value, field) {
  const normalized = requiredString(value, field);
  if (!/^Bearer\s+\S+$/i.test(normalized)) throw new TypeError(`${field} must be a Bearer authorization header`);
  return normalized;
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function normalizeResponse(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('requestExecutor must return an object');
  const statusCode = Number(value.statusCode);
  if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
    throw new TypeError('requestExecutor response statusCode must be an HTTP status');
  }
  const body = value.body && typeof value.body === 'object' && !Array.isArray(value.body)
    ? value.body
    : null;
  return { statusCode, body };
}

function extractWorkspaceId(body) {
  const direct = body?.data?.workspaceId;
  const nested = body?.data?.workspace?.workspaceId;
  if (typeof nested === 'string' && nested.trim()) return nested.trim();
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  return null;
}

function responseHasData(body) {
  return Boolean(body && Object.prototype.hasOwnProperty.call(body, 'data') && body.data != null);
}

function sanitizeErrorCode(error) {
  const code = typeof error?.code === 'string' ? error.code.trim() : '';
  return code && /^[A-Z0-9_:-]{1,80}$/.test(code) ? code : 'UNEXPECTED_ERROR';
}

function buildEvidenceRef(prefix, core) {
  return `${prefix}:sha256:${sha256(JSON.stringify(core))}`;
}

async function defaultRequestExecutor({ url, authorizationHeader } = {}) {
  if (typeof globalThis.fetch !== 'function') throw new Error('FETCH_NOT_AVAILABLE');
  const headers = { accept: 'application/json' };
  if (authorizationHeader) headers.authorization = authorizationHeader;
  const response = await globalThis.fetch(url, {
    method: 'GET',
    headers,
    redirect: 'error',
    cache: 'no-store',
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch (_) { body = null; }
  }
  return { statusCode: response.status, body };
}

function buildResult({
  status,
  environment,
  targetApiRef,
  targetDatabaseRef,
  workspaceId,
  postgresQualificationRef,
  apiEvidence,
  adminApplicationPathEvidence,
}) {
  const evidenceCore = {
    schemaVersion: 1,
    status,
    environment,
    targetApiRef,
    targetDatabaseRef,
    workspaceId,
    postgresQualificationRef,
    apiEvidenceRef: apiEvidence?.evidenceRef || null,
    adminApplicationPathEvidenceRef: adminApplicationPathEvidence?.evidenceRef || null,
  };
  return freeze({
    ...evidenceCore,
    apiEvidence: apiEvidence || null,
    adminApplicationPathEvidence: adminApplicationPathEvidence || null,
    bundleHashSha256: sha256(JSON.stringify(evidenceCore)),
    productionQualified: false,
    authority: AUTHORITY,
    semantics: 'This controlled staging/preproduction qualification exercises read-only API object-isolation checks and an authenticated ADMIN-only application inspection path. It does not perform destructive testing, certify database owner/admin governance, replace penetration testing, establish production security, or authorize release, merge, deployment, go-live, or transactions.',
  });
}

function createControlledStagingApiSecurityQualification({
  requestExecutor = defaultRequestExecutor,
  adminInspector,
} = {}) {
  if (typeof requestExecutor !== 'function') throw new TypeError('requestExecutor must be a function');
  if (typeof adminInspector !== 'function') throw new TypeError('adminInspector must be a function');

  return async function qualify({
    postgresQualification,
    environment,
    targetApiRef,
    targetDatabaseRef,
    apiBaseUrl,
    workspaceId,
    tenantAAuthorizationHeader,
    tenantBAuthorizationHeader,
    adminAuthorizationHeader,
    nonAdminAuthorizationHeader,
    testedAt = new Date().toISOString(),
    operationId = 'p15-admin-path-probe',
  } = {}) {
    const env = normalizeEnvironment(environment);
    const apiRef = requiredString(targetApiRef, 'targetApiRef');
    const databaseRef = requiredString(targetDatabaseRef, 'targetDatabaseRef');
    const baseUrl = normalizeApiBaseUrl(apiBaseUrl);
    const wsId = normalizeWorkspaceId(workspaceId);
    const tenantAHeader = requiredBearerHeader(tenantAAuthorizationHeader, 'tenantAAuthorizationHeader');
    const tenantBHeader = requiredBearerHeader(tenantBAuthorizationHeader, 'tenantBAuthorizationHeader');
    const adminHeader = requiredBearerHeader(adminAuthorizationHeader, 'adminAuthorizationHeader');
    const nonAdminHeader = requiredBearerHeader(nonAdminAuthorizationHeader, 'nonAdminAuthorizationHeader');
    const timestamp = requiredString(testedAt, 'testedAt');
    const opId = requiredString(operationId, 'operationId');

    const postgresComplete = Boolean(
      postgresQualification
      && postgresQualification.status === STAGING_QUALIFICATION_STATUS.STAGING_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED
      && postgresQualification.environment === env
      && postgresQualification.targetDatabaseRef === databaseRef,
    );
    const postgresQualificationRef = postgresQualification?.evidenceBundle?.bundleHashSha256
      ? `sha256:${postgresQualification.evidenceBundle.bundleHashSha256}`
      : null;

    if (!postgresComplete) {
      return buildResult({
        status: API_SECURITY_STATUS.HOLD_POSTGRES_QUALIFICATION,
        environment: env,
        targetApiRef: apiRef,
        targetDatabaseRef: databaseRef,
        workspaceId: wsId,
        postgresQualificationRef,
        apiEvidence: null,
        adminApplicationPathEvidence: null,
      });
    }

    const url = `${baseUrl}/v1/workspaces/${encodeURIComponent(wsId)}`;
    let tenantAResponse;
    let tenantBResponse;
    let unauthenticatedResponse;
    try {
      tenantAResponse = normalizeResponse(await requestExecutor({ url, authorizationHeader: tenantAHeader, scenario: 'TENANT_A_READ' }));
      tenantBResponse = normalizeResponse(await requestExecutor({ url, authorizationHeader: tenantBHeader, scenario: 'CROSS_TENANT_READ' }));
      unauthenticatedResponse = normalizeResponse(await requestExecutor({ url, authorizationHeader: null, scenario: 'UNAUTHENTICATED_READ' }));
    } catch (_) {
      return buildResult({
        status: API_SECURITY_STATUS.HOLD_API_EXECUTION,
        environment: env,
        targetApiRef: apiRef,
        targetDatabaseRef: databaseRef,
        workspaceId: wsId,
        postgresQualificationRef,
        apiEvidence: null,
        adminApplicationPathEvidence: null,
      });
    }

    const apiChecks = {
      tenantAReadAllowed: tenantAResponse.statusCode === 200 && extractWorkspaceId(tenantAResponse.body) === wsId,
      crossTenantReadDenied: [403, 404].includes(tenantBResponse.statusCode) && !responseHasData(tenantBResponse.body),
      unauthenticatedReadDenied: unauthenticatedResponse.statusCode === 401 && !responseHasData(unauthenticatedResponse.body),
      objectReferenceNotDisclosedCrossTenant: !responseHasData(tenantBResponse.body),
    };
    const apiCore = {
      schemaVersion: 1,
      environment: env,
      targetApiRef: apiRef,
      workspaceId: wsId,
      testedAt: timestamp,
      checks: apiChecks,
      observedStatusCodes: {
        tenantA: tenantAResponse.statusCode,
        crossTenant: tenantBResponse.statusCode,
        unauthenticated: unauthenticatedResponse.statusCode,
      },
    };
    const apiEvidence = freeze({
      ...apiCore,
      evidenceRef: buildEvidenceRef('api-idor-bola', apiCore),
      productionSecurityVerifiedByThisModule: false,
    });

    if (!Object.values(apiChecks).every(Boolean)) {
      return buildResult({
        status: API_SECURITY_STATUS.HOLD_API_IDOR_BOLA,
        environment: env,
        targetApiRef: apiRef,
        targetDatabaseRef: databaseRef,
        workspaceId: wsId,
        postgresQualificationRef,
        apiEvidence,
        adminApplicationPathEvidence: null,
      });
    }

    let adminAllowed = false;
    let nonAdminDenied = false;
    let adminScopeMatched = false;
    let adminFailureCode = null;
    let nonAdminFailureCode = null;

    try {
      const adminResult = await adminInspector({
        authorizationHeader: adminHeader,
        workspaceId: wsId,
        operationId: `${opId}:admin`,
        occurredAt: timestamp,
      });
      adminAllowed = Boolean(adminResult && adminResult.readOnly === true && adminResult.secretsExposed === false);
      adminScopeMatched = Boolean(adminResult?.scope?.workspaceId === wsId && adminResult?.scope?.tenantId);
    } catch (error) {
      adminFailureCode = sanitizeErrorCode(error);
    }

    try {
      await adminInspector({
        authorizationHeader: nonAdminHeader,
        workspaceId: wsId,
        operationId: `${opId}:non-admin`,
        occurredAt: timestamp,
      });
    } catch (error) {
      nonAdminFailureCode = sanitizeErrorCode(error);
      nonAdminDenied = ['ROLE_NOT_AUTHORIZED', 'ACTION_NOT_IN_POLICY', 'FORBIDDEN'].includes(nonAdminFailureCode);
    }

    const adminChecks = {
      adminReadOnlyInspectionAllowed: adminAllowed,
      adminScopeMatchesWorkspace: adminScopeMatched,
      nonAdminInspectionDenied: nonAdminDenied,
      privilegedApplicationPathDoesNotClaimProduction: true,
    };
    const adminCore = {
      schemaVersion: 1,
      environment: env,
      targetApiRef: apiRef,
      targetDatabaseRef: databaseRef,
      workspaceId: wsId,
      testedAt: timestamp,
      checks: adminChecks,
      adminFailureCode,
      nonAdminFailureCode,
      ownerOrAdminApplicationPathTested: true,
      databaseOwnerOrBypassRlsPathTestedHere: false,
    };
    const adminApplicationPathEvidence = freeze({
      ...adminCore,
      evidenceRef: buildEvidenceRef('admin-application-path', adminCore),
      productionSecurityVerifiedByThisModule: false,
    });

    const status = Object.values(adminChecks).every(Boolean)
      ? API_SECURITY_STATUS.STAGING_API_SECURITY_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED
      : API_SECURITY_STATUS.HOLD_ADMIN_APPLICATION_PATH;

    return buildResult({
      status,
      environment: env,
      targetApiRef: apiRef,
      targetDatabaseRef: databaseRef,
      workspaceId: wsId,
      postgresQualificationRef,
      apiEvidence,
      adminApplicationPathEvidence,
    });
  };
}

module.exports = {
  API_SECURITY_STATUS,
  AUTHORITY,
  ALLOWED_ENVIRONMENTS,
  defaultRequestExecutor,
  createControlledStagingApiSecurityQualification,
};
