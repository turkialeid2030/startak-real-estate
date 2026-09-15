'use strict';

const http = require('http');
const { randomUUID } = require('crypto');

const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;
const MAX_WORKSPACE_ID_LENGTH = 128;
const WORKSPACE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

const AUTHORITY = Object.freeze({
  releaseAuthorized: false,
  mergeAuthorized: false,
  deploymentAuthorized: false,
  goLiveAuthorized: false,
  transactionAuthorized: false,
  productionAuthenticationValidated: false,
  productionPersistenceValidated: false,
});

function fail(code, message = code) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function requiredService(service) {
  if (!service || typeof service.loadWorkspace !== 'function' || typeof service.saveWorkspace !== 'function') {
    throw new TypeError('service with loadWorkspace/saveWorkspace is required');
  }
  return service;
}

function normalizeMaxBodyBytes(value) {
  if (!Number.isInteger(value) || value < 1024 || value > 10 * 1024 * 1024) {
    throw new TypeError('maxBodyBytes must be an integer between 1024 and 10485760');
  }
  return value;
}

function normalizeOrigin(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty origin`);
  let url;
  try {
    url = new URL(value.trim());
  } catch (_) {
    throw new TypeError(`${field} must be a valid origin`);
  }
  if (!['https:', 'http:'].includes(url.protocol)) throw new TypeError(`${field} must use http or https`);
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new TypeError(`${field} must contain origin only`);
  }
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
    throw new TypeError(`${field} must use https except for loopback development origins`);
  }
  return url.origin;
}

function normalizeAllowedOrigins(values) {
  if (values == null) return Object.freeze([]);
  if (!Array.isArray(values)) throw new TypeError('allowedOrigins must be an array');
  const normalized = [...new Set(values.map((value, index) => normalizeOrigin(value, `allowedOrigins[${index}]`)))];
  if (normalized.includes('*')) throw new TypeError('wildcard CORS origin is not allowed');
  return Object.freeze(normalized);
}

function normalizeWorkspaceId(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_WORKSPACE_ID_LENGTH || !WORKSPACE_ID_RE.test(value)) {
    fail('INVALID_WORKSPACE_ID');
  }
  return value;
}

function parseWorkspaceRoute(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl || '/', 'http://startak.internal');
  } catch (_) {
    fail('INVALID_REQUEST_URL');
  }
  if (url.search) fail('QUERY_PARAMETERS_NOT_ALLOWED');
  const match = /^\/v1\/workspaces\/([^/]+)$/.exec(url.pathname);
  if (!match) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(match[1]);
  } catch (_) {
    fail('INVALID_WORKSPACE_ID');
  }
  return normalizeWorkspaceId(decoded);
}

function securityHeaders() {
  return {
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
  };
}

function writeJson(res, statusCode, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    ...securityHeaders(),
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload, 'utf8'),
    ...extraHeaders,
  });
  res.end(payload);
}

function classifyError(error) {
  const code = String(error?.code || '');
  if (code === 'AUTHENTICATION_REQUIRED') return { statusCode: 401, code };
  if (['ROLE_NOT_AUTHORIZED', 'ACTION_NOT_IN_POLICY', 'IDENTITY_MISSING'].includes(code)) {
    return { statusCode: 403, code: 'FORBIDDEN' };
  }
  if (['WORKSPACE_VERSION_CONFLICT', 'WORKSPACE_CONCURRENT_WRITE_CONFLICT'].includes(code)) {
    return { statusCode: 409, code };
  }
  if (code === 'WORKSPACE_NOT_FOUND') return { statusCode: 404, code };
  if (code === 'REQUEST_BODY_TOO_LARGE') return { statusCode: 413, code };
  if (code === 'UNSUPPORTED_MEDIA_TYPE') return { statusCode: 415, code };
  if (code === 'METHOD_NOT_ALLOWED') return { statusCode: 405, code };
  if (code === 'ORIGIN_NOT_ALLOWED') return { statusCode: 403, code };
  if (error instanceof SyntaxError || error instanceof TypeError || [
    'INVALID_JSON_BODY',
    'INVALID_REQUEST_BODY',
    'INVALID_WORKSPACE_ID',
    'INVALID_REQUEST_URL',
    'QUERY_PARAMETERS_NOT_ALLOWED',
    'WORKSPACE_ROUTE_BODY_MISMATCH',
  ].includes(code)) {
    return { statusCode: 400, code: code || 'BAD_REQUEST' };
  }
  return { statusCode: 500, code: 'INTERNAL_ERROR' };
}

function responseHeadersForOrigin(origin, allowedOrigins) {
  if (!origin) return {};
  if (!allowedOrigins.includes(origin)) fail('ORIGIN_NOT_ALLOWED');
  return {
    'access-control-allow-origin': origin,
    vary: 'Origin',
  };
}

function assertJsonContentType(req) {
  const raw = String(req.headers['content-type'] || '').toLowerCase();
  const mediaType = raw.split(';')[0].trim();
  if (mediaType !== 'application/json' && !mediaType.endsWith('+json')) fail('UNSUPPORTED_MEDIA_TYPE');
}

async function readJsonBody(req, maxBodyBytes) {
  const contentLength = req.headers['content-length'];
  if (contentLength != null) {
    const parsed = Number(contentLength);
    if (!Number.isFinite(parsed) || parsed < 0) fail('INVALID_REQUEST_BODY');
    if (parsed > maxBodyBytes) fail('REQUEST_BODY_TOO_LARGE');
  }

  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBodyBytes) fail('REQUEST_BODY_TOO_LARGE');
    chunks.push(buffer);
  }
  if (total === 0) fail('INVALID_JSON_BODY');

  let parsed;
  try {
    parsed = JSON.parse(Buffer.concat(chunks, total).toString('utf8'));
  } catch (_) {
    fail('INVALID_JSON_BODY');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail('INVALID_REQUEST_BODY');
  return parsed;
}

function validateSaveBody(body, workspaceId) {
  const allowed = new Set(['workspace', 'expectedVersion', 'operationId', 'occurredAt']);
  const unexpected = Object.keys(body).filter((key) => !allowed.has(key));
  if (unexpected.length > 0) fail('INVALID_REQUEST_BODY');
  if (!body.workspace || typeof body.workspace !== 'object' || Array.isArray(body.workspace)) fail('INVALID_REQUEST_BODY');
  if (body.workspace.workspaceId !== workspaceId) fail('WORKSPACE_ROUTE_BODY_MISMATCH');
  if (!Number.isInteger(body.expectedVersion) || body.expectedVersion < 0) fail('INVALID_REQUEST_BODY');
  if (typeof body.operationId !== 'string' || body.operationId.trim() === '') fail('INVALID_REQUEST_BODY');
  if (body.occurredAt != null && (typeof body.occurredAt !== 'string' || body.occurredAt.trim() === '')) fail('INVALID_REQUEST_BODY');
  return body;
}

function createCanonicalWorkspaceHttpHandler({
  service,
  allowedOrigins = [],
  maxBodyBytes = DEFAULT_MAX_BODY_BYTES,
  requestIdFactory = randomUUID,
} = {}) {
  const workspaceService = requiredService(service);
  const origins = normalizeAllowedOrigins(allowedOrigins);
  const bodyLimit = normalizeMaxBodyBytes(maxBodyBytes);
  if (typeof requestIdFactory !== 'function') throw new TypeError('requestIdFactory must be a function');

  return async function handle(req, res) {
    const requestId = String(requestIdFactory());
    const baseHeaders = { 'x-request-id': requestId };
    try {
      const origin = typeof req.headers.origin === 'string' ? normalizeOrigin(req.headers.origin, 'request origin') : null;
      const corsHeaders = responseHeadersForOrigin(origin, origins);

      if (req.method === 'OPTIONS') {
        if (!origin) fail('ORIGIN_NOT_ALLOWED');
        writeJson(res, 204, {}, {
          ...baseHeaders,
          ...corsHeaders,
          'access-control-allow-methods': 'GET, PUT, OPTIONS',
          'access-control-allow-headers': 'authorization, content-type',
          'access-control-max-age': '600',
        });
        return;
      }

      if (req.url === '/healthz' && req.method === 'GET') {
        writeJson(res, 200, {
          status: 'LIVE',
          service: 'canonical-workspace-http-api',
          productionQualified: false,
          authority: AUTHORITY,
        }, { ...baseHeaders, ...corsHeaders });
        return;
      }

      const workspaceId = parseWorkspaceRoute(req.url);
      if (!workspaceId) {
        writeJson(res, 404, { error: { code: 'NOT_FOUND', requestId } }, { ...baseHeaders, ...corsHeaders });
        return;
      }

      if (!['GET', 'PUT'].includes(req.method)) fail('METHOD_NOT_ALLOWED');
      const authorizationHeader = req.headers.authorization;

      if (req.method === 'GET') {
        const result = await workspaceService.loadWorkspace({ authorizationHeader, workspaceId });
        if (!result || result.data == null) fail('WORKSPACE_NOT_FOUND');
        writeJson(res, 200, {
          status: 'OK',
          data: result.data,
          authority: AUTHORITY,
        }, { ...baseHeaders, ...corsHeaders });
        return;
      }

      assertJsonContentType(req);
      const body = validateSaveBody(await readJsonBody(req, bodyLimit), workspaceId);
      const result = await workspaceService.saveWorkspace({
        authorizationHeader,
        workspace: body.workspace,
        expectedVersion: body.expectedVersion,
        operationId: body.operationId.trim(),
        occurredAt: body.occurredAt == null ? undefined : body.occurredAt.trim(),
      });
      writeJson(res, 200, {
        status: 'OK',
        data: result?.data ?? null,
        authority: AUTHORITY,
      }, { ...baseHeaders, ...corsHeaders });
    } catch (error) {
      const classified = classifyError(error);
      const headers = classified.statusCode === 401
        ? { ...baseHeaders, 'www-authenticate': 'Bearer' }
        : classified.statusCode === 405
          ? { ...baseHeaders, allow: 'GET, PUT, OPTIONS' }
          : baseHeaders;
      writeJson(res, classified.statusCode, {
        error: {
          code: classified.code,
          requestId,
        },
        authority: AUTHORITY,
      }, headers);
    }
  };
}

function createNodeHttpServer(options = {}) {
  const handler = createCanonicalWorkspaceHttpHandler(options);
  return http.createServer((req, res) => {
    handler(req, res).catch(() => {
      if (!res.headersSent) {
        writeJson(res, 500, { error: { code: 'INTERNAL_ERROR' }, authority: AUTHORITY });
      } else if (!res.writableEnded) {
        res.end();
      }
    });
  });
}

module.exports = {
  DEFAULT_MAX_BODY_BYTES,
  AUTHORITY,
  createCanonicalWorkspaceHttpHandler,
  createNodeHttpServer,
};
