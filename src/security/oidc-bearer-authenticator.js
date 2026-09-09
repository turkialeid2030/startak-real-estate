'use strict';

const { verifyOidcJwt } = require('./oidc-jwt-verifier');

const AUTHENTICATION_STATUS = Object.freeze({
  AUTHENTICATED: 'AUTHENTICATED',
  HOLD_AUTHORIZATION_HEADER: 'HOLD_AUTHORIZATION_HEADER',
  HOLD_JWKS: 'HOLD_JWKS',
  HOLD_TOKEN_VERIFICATION: 'HOLD_TOKEN_VERIFICATION',
});

const MAX_AUTHORIZATION_HEADER_BYTES = 96 * 1024;

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

function hold(status, reasonCode, metadata = {}) {
  return freeze({
    status,
    reasonCodes: [reasonCode],
    identityContext: null,
    authorizationReady: false,
    productionAuthenticationValidated: false,
    transactionAuthorized: false,
    ...metadata,
  });
}

function extractBearerToken(value) {
  if (typeof value !== 'string' || value.length === 0 || Buffer.byteLength(value, 'utf8') > MAX_AUTHORIZATION_HEADER_BYTES) return null;
  const match = /^Bearer ([A-Za-z0-9_.-]+)$/i.exec(value.trim());
  if (!match) return null;
  return match[1];
}

/**
 * Server-side bearer authentication boundary. The caller supplies configured issuer,
 * audience and a trusted JWKS provider; token-controlled values never select an issuer
 * or JWKS endpoint. A successful result contains the same verified identity context
 * consumed by tenant/RBAC/canonical-workspace runtime code.
 */
function createOidcBearerAuthenticator({
  issuer,
  audience,
  jwksProvider,
  allowedAlgorithms = ['RS256'],
  clockToleranceSeconds = 60,
  maxTokenAgeSeconds,
} = {}) {
  const configuredIssuer = requiredString(issuer, 'issuer');
  const configuredAudience = requiredString(audience, 'audience');
  if (!jwksProvider || typeof jwksProvider.getJwks !== 'function') throw new TypeError('jwksProvider.getJwks is required');

  async function authenticate({
    authorizationHeader,
    requiredTenantId,
    nowEpochSeconds = Math.floor(Date.now() / 1000),
    forceJwksRefresh = false,
  } = {}) {
    const token = extractBearerToken(authorizationHeader);
    if (!token) return hold(AUTHENTICATION_STATUS.HOLD_AUTHORIZATION_HEADER, 'VALID_BEARER_AUTHORIZATION_HEADER_REQUIRED');

    let jwks;
    try {
      jwks = await jwksProvider.getJwks({ forceRefresh: Boolean(forceJwksRefresh) });
    } catch (_) {
      return hold(AUTHENTICATION_STATUS.HOLD_JWKS, 'TRUSTED_JWKS_UNAVAILABLE');
    }

    const verification = verifyOidcJwt({
      token,
      issuer: configuredIssuer,
      audience: configuredAudience,
      jwks,
      requiredTenantId,
      allowedAlgorithms,
      nowEpochSeconds,
      clockToleranceSeconds,
      maxTokenAgeSeconds,
    });

    if (!verification || verification.authorizationReady !== true) {
      return hold(AUTHENTICATION_STATUS.HOLD_TOKEN_VERIFICATION, verification?.reasonCodes?.[0] || 'JWT_VERIFICATION_FAILED', {
        tokenVerificationStatus: verification?.status || null,
        cryptographicVerificationPerformedHere: Boolean(verification?.cryptographicVerificationPerformedHere),
      });
    }

    return freeze({
      status: AUTHENTICATION_STATUS.AUTHENTICATED,
      reasonCodes: [],
      identityContext: verification.identityContext,
      authorizationReady: true,
      tokenMetadata: verification.tokenMetadata,
      cryptographicVerificationPerformedHere: true,
      trustedJwksUsed: true,
      issuerValidatedHere: true,
      audienceValidatedHere: true,
      expiryValidatedHere: true,
      productionAuthenticationValidated: false,
      externalControlsRequired: Object.freeze([
        'PRODUCTION_IDP_CONFIGURATION',
        'JWKS_TLS_DNS_KEY_LIFECYCLE_EVIDENCE',
        'REVOCATION_OR_SESSION_INVALIDATION_POLICY',
        'MFA_POLICY_WHERE_REQUIRED',
        'CREDENTIAL_SECRET_MANAGEMENT',
        'PENTEST_AND_RUNTIME_SECURITY_EVIDENCE',
      ]),
      transactionAuthorized: false,
      semantics: 'Authentication is cryptographically enforced at this application boundary using the configured issuer/audience and trusted JWKS provider. Production authentication remains unvalidated until real IdP configuration and external runtime/security controls are evidenced.',
    });
  }

  return Object.freeze({
    authenticate,
    issuer: configuredIssuer,
    audience: configuredAudience,
    capabilities: Object.freeze({
      bearerOnly: true,
      issuerPinnedByConfiguration: true,
      audiencePinnedByConfiguration: true,
      jwksProviderRequired: true,
      cryptographicJwtVerification: true,
      productionAuthenticationValidated: false,
    }),
  });
}

module.exports = {
  AUTHENTICATION_STATUS,
  MAX_AUTHORIZATION_HEADER_BYTES,
  extractBearerToken,
  createOidcBearerAuthenticator,
};
