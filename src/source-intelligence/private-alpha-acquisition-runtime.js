'use strict';

const crypto = require('crypto');
const {
  ACCESS_MODE,
  ACQUISITION_METHOD,
  createPrivateAlphaAcquisitionPlan,
  validateAcquisitionExecutionSafety,
} = require('./private-alpha-acquisition-orchestrator');
const { sourceUrlMatchesProvider, getCanonicalSourceProvider } = require('./source-provider-registry');

const CAPABILITY = 'C53_PRIVATE_ALPHA_SOURCE_ACQUISITION_RUNTIME_V1';
const DEFAULT_MAX_BYTES = 15 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_REDIRECTS = 5;

const ALLOWED_CONTENT_TYPES = Object.freeze([
  'text/html',
  'text/plain',
  'text/csv',
  'application/json',
  'application/xml',
  'text/xml',
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
]);

class AcquisitionRuntimeError extends Error {
  constructor(code, message, details = {}) {
    super(message || code);
    this.name = 'AcquisitionRuntimeError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function sha256Bytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeContentType(value) {
  return String(value || '').split(';')[0].trim().toLowerCase();
}

function assertAllowedFinalUrl(provider, urlText) {
  if (!sourceUrlMatchesProvider(provider, urlText)) {
    throw new AcquisitionRuntimeError('C53_FINAL_URL_PROVIDER_MISMATCH', 'Final URL left the governed provider domain.', { finalUrl: urlText });
  }
}

function buildEvidence({ plan, method, sourceUrl, finalUrl, bytes, contentType, retrievedAt, metadata = {} }) {
  const artifactHashSha256 = sha256Bytes(bytes);
  const textLike = contentType.startsWith('text/') || ['application/json', 'application/xml'].includes(contentType);
  return Object.freeze({
    capability: CAPABILITY,
    operatingMode: 'PRIVATE_ALPHA',
    sourceProvider: plan.sourceProvider,
    sourceTier: plan.sourceTier,
    accessMode: plan.accessMode,
    acquisitionMethod: method,
    sourceUrl,
    finalUrl,
    retrievedAt,
    contentType,
    byteLength: bytes.length,
    artifactHashSha256,
    text: textLike ? bytes.toString('utf8') : null,
    artifactBase64: textLike ? null : bytes.toString('base64'),
    metadata: Object.freeze({ ...metadata }),
    provenance: Object.freeze({
      sourceUrl,
      finalUrl,
      retrievedAt,
      acquisitionMethod: method,
      artifactHashSha256,
      sourceProvider: plan.sourceProvider,
      handoff: 'C2N/C2S',
    }),
    rightsApprovalEstablished: false,
    commercialUseAuthorized: false,
    publicDeploymentAuthorized: false,
    transactionAuthorized: false,
    approvalAuthorized: false,
  });
}

async function readResponseBodyBounded(response, maxBytes) {
  const declared = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new AcquisitionRuntimeError('C53_ARTIFACT_TOO_LARGE', 'Declared response size exceeds configured limit.', { declared, maxBytes });
  }
  const ab = await response.arrayBuffer();
  const bytes = Buffer.from(ab);
  if (bytes.length > maxBytes) {
    throw new AcquisitionRuntimeError('C53_ARTIFACT_TOO_LARGE', 'Response size exceeds configured limit.', { actual: bytes.length, maxBytes });
  }
  return bytes;
}

async function fetchWithGovernedRedirects({ provider, url, fetchImpl, timeoutMs, maxRedirects, headers }) {
  let currentUrl = url;
  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    assertAllowedFinalUrl(provider, currentUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers,
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new AcquisitionRuntimeError('C53_FETCH_TIMEOUT', 'Source retrieval timed out.', { url: currentUrl, timeoutMs });
      }
      throw new AcquisitionRuntimeError('C53_FETCH_FAILED', 'Source retrieval failed.', { url: currentUrl, cause: error?.message || String(error) });
    } finally {
      clearTimeout(timer);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers?.get?.('location');
      if (!location) throw new AcquisitionRuntimeError('C53_REDIRECT_WITHOUT_LOCATION', 'Redirect had no Location header.');
      if (redirectCount === maxRedirects) throw new AcquisitionRuntimeError('C53_TOO_MANY_REDIRECTS', 'Redirect limit exceeded.');
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    if (!response.ok) {
      throw new AcquisitionRuntimeError('C53_HTTP_STATUS_REJECTED', `Source returned HTTP ${response.status}.`, { status: response.status, url: currentUrl });
    }
    return { response, finalUrl: currentUrl };
  }
  throw new AcquisitionRuntimeError('C53_TOO_MANY_REDIRECTS', 'Redirect limit exceeded.');
}

async function acquirePublicArtifact({
  sourceProvider,
  sourceUrl,
  method = ACQUISITION_METHOD.DIRECT_HTTPS_FETCH,
  contentHints = [],
  fetchImpl = globalThis.fetch,
  maxBytes = DEFAULT_MAX_BYTES,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxRedirects = DEFAULT_MAX_REDIRECTS,
  now = () => new Date().toISOString(),
} = {}) {
  if (typeof fetchImpl !== 'function') throw new AcquisitionRuntimeError('C53_FETCH_IMPLEMENTATION_REQUIRED');
  if (![ACQUISITION_METHOD.DIRECT_HTTPS_FETCH, ACQUISITION_METHOD.OFFICIAL_FILE_DOWNLOAD, ACQUISITION_METHOD.SITEMAP_RSS_DISCOVERY].includes(method)) {
    throw new AcquisitionRuntimeError('C53_PUBLIC_FETCH_METHOD_NOT_ALLOWED');
  }
  const accessMode = method === ACQUISITION_METHOD.OFFICIAL_FILE_DOWNLOAD ? ACCESS_MODE.DOCUMENT_OR_FILE : ACCESS_MODE.PUBLIC_WEB;
  const plan = createPrivateAlphaAcquisitionPlan({ sourceProvider, sourceUrl, accessMode, contentHints });
  if (!plan.ready || !plan.methods.includes(method)) {
    throw new AcquisitionRuntimeError('C53_ACQUISITION_PLAN_NOT_READY', 'Governed acquisition plan rejected source/method.', { blockers: plan.blockers });
  }
  const provider = getCanonicalSourceProvider(sourceProvider);
  const headers = Object.freeze({
    'user-agent': 'Startak-Private-Alpha/1.0 (+owner-only research)',
    accept: '*/*',
  });
  const { response, finalUrl } = await fetchWithGovernedRedirects({ provider, url: sourceUrl, fetchImpl, timeoutMs, maxRedirects, headers });
  const contentType = normalizeContentType(response.headers?.get?.('content-type')) || 'application/octet-stream';
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    throw new AcquisitionRuntimeError('C53_CONTENT_TYPE_NOT_ALLOWED', 'Response content type is outside the private-alpha acquisition allowlist.', { contentType });
  }
  const bytes = await readResponseBodyBounded(response, maxBytes);
  return buildEvidence({
    plan,
    method,
    sourceUrl,
    finalUrl,
    bytes,
    contentType,
    retrievedAt: now(),
    metadata: { httpStatus: response.status, apiUsed: false, credentialsSent: false },
  });
}

async function acquireWithBrowserAdapter({
  sourceProvider,
  sourceUrl,
  accessMode = ACCESS_MODE.PUBLIC_WEB,
  browserAdapter,
  userAuthorizedSession = false,
  maxBytes = DEFAULT_MAX_BYTES,
  now = () => new Date().toISOString(),
} = {}) {
  if (typeof browserAdapter !== 'function') throw new AcquisitionRuntimeError('C53_BROWSER_ADAPTER_REQUIRED');
  const method = accessMode === ACCESS_MODE.USER_AUTHENTICATED
    ? ACQUISITION_METHOD.USER_AUTHORIZED_BROWSER_SESSION
    : ACQUISITION_METHOD.PUBLIC_BROWSER_RENDER;
  const plan = createPrivateAlphaAcquisitionPlan({ sourceProvider, sourceUrl, accessMode });
  if (!plan.ready || !plan.methods.includes(method)) {
    throw new AcquisitionRuntimeError('C53_ACQUISITION_PLAN_NOT_READY', 'Governed browser acquisition plan rejected source/method.', { blockers: plan.blockers });
  }
  const safety = validateAcquisitionExecutionSafety({ accessMode, userAuthorizedSession });
  if (!safety.safe) throw new AcquisitionRuntimeError('C53_BROWSER_EXECUTION_UNSAFE', 'Browser acquisition safety contract failed.', { blockers: safety.blockers });

  const result = await browserAdapter(Object.freeze({
    sourceUrl,
    sourceProvider,
    userAuthorizedSession,
    captchaBypassAllowed: false,
    credentialBypassAllowed: false,
    accessControlEvasionAllowed: false,
    rateLimitEvasionAllowed: false,
  }));
  if (!result || typeof result !== 'object') throw new AcquisitionRuntimeError('C53_BROWSER_RESULT_REQUIRED');
  const provider = getCanonicalSourceProvider(sourceProvider);
  const finalUrl = result.finalUrl || sourceUrl;
  assertAllowedFinalUrl(provider, finalUrl);
  const postSafety = validateAcquisitionExecutionSafety({
    accessMode,
    userAuthorizedSession,
    credentialBypassUsed: result.credentialBypassUsed === true,
    captchaBypassUsed: result.captchaBypassUsed === true,
    accessControlEvasionUsed: result.accessControlEvasionUsed === true,
    rateLimitEvasionUsed: result.rateLimitEvasionUsed === true,
  });
  if (!postSafety.safe) throw new AcquisitionRuntimeError('C53_BROWSER_RESULT_UNSAFE', 'Browser adapter reported a forbidden bypass/evasion.', { blockers: postSafety.blockers });
  const bytes = Buffer.isBuffer(result.bytes) ? result.bytes : Buffer.from(String(result.html ?? result.text ?? ''), 'utf8');
  if (bytes.length > maxBytes) throw new AcquisitionRuntimeError('C53_ARTIFACT_TOO_LARGE', 'Browser artifact exceeds configured size.', { actual: bytes.length, maxBytes });
  return buildEvidence({
    plan,
    method,
    sourceUrl,
    finalUrl,
    bytes,
    contentType: normalizeContentType(result.contentType) || 'text/html',
    retrievedAt: now(),
    metadata: {
      browserRendered: true,
      apiUsed: false,
      authenticatedSession: accessMode === ACCESS_MODE.USER_AUTHENTICATED,
      userAuthorizedSession: accessMode === ACCESS_MODE.USER_AUTHENTICATED ? true : false,
    },
  });
}

function acquireManualArtifact({
  sourceProvider,
  sourceUrl,
  bytes,
  contentType = 'application/octet-stream',
  method = ACQUISITION_METHOD.MANUAL_UPLOAD,
  now = () => new Date().toISOString(),
  maxBytes = DEFAULT_MAX_BYTES,
} = {}) {
  if (![ACQUISITION_METHOD.MANUAL_UPLOAD, ACQUISITION_METHOD.MANUAL_ASSISTED_CAPTURE, ACQUISITION_METHOD.USER_AUTHORIZED_EXPORT].includes(method)) {
    throw new AcquisitionRuntimeError('C53_MANUAL_METHOD_NOT_ALLOWED');
  }
  const accessMode = method === ACQUISITION_METHOD.USER_AUTHORIZED_EXPORT ? ACCESS_MODE.USER_AUTHENTICATED : ACCESS_MODE.DOCUMENT_OR_FILE;
  const plan = createPrivateAlphaAcquisitionPlan({ sourceProvider, sourceUrl, accessMode });
  if (!plan.ready || !plan.methods.includes(method)) throw new AcquisitionRuntimeError('C53_ACQUISITION_PLAN_NOT_READY', 'Manual acquisition plan rejected source/method.', { blockers: plan.blockers });
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || '');
  if (!buffer.length) throw new AcquisitionRuntimeError('C53_EMPTY_ARTIFACT');
  if (buffer.length > maxBytes) throw new AcquisitionRuntimeError('C53_ARTIFACT_TOO_LARGE', 'Manual artifact exceeds configured size.', { actual: buffer.length, maxBytes });
  return buildEvidence({
    plan,
    method,
    sourceUrl,
    finalUrl: sourceUrl,
    bytes: buffer,
    contentType: normalizeContentType(contentType) || 'application/octet-stream',
    retrievedAt: now(),
    metadata: { manualOrUserExport: true, apiUsed: false },
  });
}

module.exports = Object.freeze({
  CAPABILITY,
  DEFAULT_MAX_BYTES,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_REDIRECTS,
  ALLOWED_CONTENT_TYPES,
  AcquisitionRuntimeError,
  acquirePublicArtifact,
  acquireWithBrowserAdapter,
  acquireManualArtifact,
  sha256Bytes,
});
