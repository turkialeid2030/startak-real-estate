'use strict';

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_JWKS_BYTES = 256 * 1024;

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function validateHttpsUrl(value, field) {
  const text = requiredString(value, field);
  let url;
  try {
    url = new URL(text);
  } catch (_) {
    throw new TypeError(`${field} must be a valid URL`);
  }
  if (url.protocol !== 'https:') throw new TypeError(`${field} must use https`);
  if (url.username || url.password) throw new TypeError(`${field} must not contain credentials`);
  if (url.hash) throw new TypeError(`${field} must not contain a fragment`);
  return url.toString();
}

function normalizeJwks(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(value.keys)) {
    throw new Error('JWKS_DOCUMENT_INVALID');
  }
  const keys = value.keys.map((key, index) => {
    if (!key || typeof key !== 'object' || Array.isArray(key)) throw new Error(`JWKS_KEY_INVALID:${index}`);
    if (key.d) throw new Error(`JWKS_PRIVATE_KEY_MATERIAL_REJECTED:${index}`);
    if (typeof key.kid !== 'string' || key.kid.trim() === '') throw new Error(`JWKS_KID_REQUIRED:${index}`);
    return Object.freeze({ ...key });
  });
  if (keys.length === 0) throw new Error('JWKS_KEYS_REQUIRED');
  return Object.freeze({ keys: Object.freeze(keys) });
}

/**
 * Creates a pinned remote JWKS provider. The JWKS URI is configuration, not token-
 * controlled input. Redirects are rejected to avoid silently moving the trust root.
 * The provider validates transport shape and public-key-only JSON, then caches the
 * document for a bounded interval.
 *
 * This provider does not perform OIDC discovery, certificate pinning, revocation,
 * production secret management, or independent TLS/IdP qualification.
 */
function createRemoteJwksProvider({
  issuer,
  jwksUri,
  fetchImpl = globalThis.fetch,
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
  nowMs = () => Date.now(),
  maxJwksBytes = MAX_JWKS_BYTES,
} = {}) {
  const configuredIssuer = validateHttpsUrl(issuer, 'issuer');
  const configuredJwksUri = validateHttpsUrl(jwksUri, 'jwksUri');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  if (!Number.isFinite(cacheTtlMs) || cacheTtlMs < 0 || cacheTtlMs > 24 * 60 * 60 * 1000) {
    throw new TypeError('cacheTtlMs must be between 0 and 86400000');
  }
  if (typeof nowMs !== 'function') throw new TypeError('nowMs must be a function');
  if (!Number.isInteger(maxJwksBytes) || maxJwksBytes < 1024 || maxJwksBytes > 1024 * 1024) {
    throw new TypeError('maxJwksBytes must be an integer between 1024 and 1048576');
  }

  let cached = null;
  let cachedAt = 0;
  let inFlight = null;

  async function fetchJwks() {
    const response = await fetchImpl(configuredJwksUri, {
      method: 'GET',
      headers: { accept: 'application/json' },
      redirect: 'error',
      cache: 'no-store',
    });
    if (!response || response.ok !== true || response.status !== 200) throw new Error('JWKS_FETCH_FAILED');

    const contentType = typeof response.headers?.get === 'function'
      ? String(response.headers.get('content-type') || '').toLowerCase()
      : '';
    if (contentType && !contentType.includes('application/json') && !contentType.includes('+json')) {
      throw new Error('JWKS_CONTENT_TYPE_INVALID');
    }

    const text = await response.text();
    if (typeof text !== 'string' || text.length === 0) throw new Error('JWKS_EMPTY_RESPONSE');
    if (Buffer.byteLength(text, 'utf8') > maxJwksBytes) throw new Error('JWKS_RESPONSE_TOO_LARGE');

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (_) {
      throw new Error('JWKS_JSON_INVALID');
    }
    return normalizeJwks(parsed);
  }

  async function getJwks({ forceRefresh = false } = {}) {
    const current = Number(nowMs());
    if (!Number.isFinite(current)) throw new Error('JWKS_CLOCK_INVALID');
    if (!forceRefresh && cached && current - cachedAt < cacheTtlMs) return cached;
    if (!forceRefresh && inFlight) return inFlight;

    const request = fetchJwks()
      .then((jwks) => {
        cached = jwks;
        cachedAt = Number(nowMs());
        return jwks;
      })
      .finally(() => {
        if (inFlight === request) inFlight = null;
      });
    inFlight = request;
    return request;
  }

  function invalidate() {
    cached = null;
    cachedAt = 0;
    inFlight = null;
  }

  return Object.freeze({
    issuer: configuredIssuer,
    jwksUri: configuredJwksUri,
    getJwks,
    invalidate,
    capabilities: Object.freeze({
      pinnedJwksUri: true,
      redirectsAllowed: false,
      boundedCache: true,
      privateJwkMaterialRejected: true,
      productionJwksTrustValidated: false,
    }),
    semantics: 'JWKS is fetched only from the configured HTTPS URI with redirects rejected and bounded caching. This does not independently certify the issuer, TLS path, DNS, key lifecycle, revocation process, or production IdP configuration.',
  });
}

module.exports = {
  DEFAULT_CACHE_TTL_MS,
  MAX_JWKS_BYTES,
  createRemoteJwksProvider,
};
