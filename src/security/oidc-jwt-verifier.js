'use strict';

const crypto = require('crypto');
const { createVerifiedIdentityContext } = require('./verified-identity-context');

const JWT_VERIFICATION_STATUS = Object.freeze({
  VERIFIED_JWT: 'VERIFIED_JWT',
  HOLD_TOKEN_FORMAT: 'HOLD_TOKEN_FORMAT',
  HOLD_HEADER: 'HOLD_HEADER',
  HOLD_ALGORITHM: 'HOLD_ALGORITHM',
  HOLD_SIGNING_KEY: 'HOLD_SIGNING_KEY',
  HOLD_SIGNATURE: 'HOLD_SIGNATURE',
  HOLD_ISSUER: 'HOLD_ISSUER',
  HOLD_AUDIENCE: 'HOLD_AUDIENCE',
  HOLD_AUTHORIZED_PARTY: 'HOLD_AUTHORIZED_PARTY',
  HOLD_EXPIRY: 'HOLD_EXPIRY',
  HOLD_NOT_BEFORE: 'HOLD_NOT_BEFORE',
  HOLD_ISSUED_AT: 'HOLD_ISSUED_AT',
  HOLD_MAX_TOKEN_AGE: 'HOLD_MAX_TOKEN_AGE',
  HOLD_IDENTITY_CONTEXT: 'HOLD_IDENTITY_CONTEXT',
});

const SUPPORTED_ALGORITHMS = Object.freeze(['RS256']);
const MAX_COMPACT_JWT_BYTES = 64 * 1024;
const MAX_SEGMENT_BYTES = 48 * 1024;

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
    cryptographicVerificationPerformedHere: false,
    productionAuthenticationValidated: false,
    transactionAuthorized: false,
    ...metadata,
  });
}

function decodeJsonSegment(segment, field) {
  if (typeof segment !== 'string' || segment === '' || segment.length > MAX_SEGMENT_BYTES) {
    throw new Error(`INVALID_${field.toUpperCase()}_SEGMENT`);
  }
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) throw new Error(`INVALID_${field.toUpperCase()}_ENCODING`);
  let text;
  try {
    text = Buffer.from(segment, 'base64url').toString('utf8');
  } catch (_) {
    throw new Error(`INVALID_${field.toUpperCase()}_ENCODING`);
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (_) {
    throw new Error(`INVALID_${field.toUpperCase()}_JSON`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`INVALID_${field.toUpperCase()}_OBJECT`);
  return parsed;
}

function normalizeAllowedAlgorithms(value) {
  const algorithms = value == null ? ['RS256'] : value;
  if (!Array.isArray(algorithms) || algorithms.length === 0) throw new TypeError('allowedAlgorithms must be a non-empty array');
  const normalized = [...new Set(algorithms.map((algorithm, index) => requiredString(algorithm, `allowedAlgorithms[${index}]`)))];
  for (const algorithm of normalized) {
    if (!SUPPORTED_ALGORITHMS.includes(algorithm)) throw new TypeError(`unsupported JWT algorithm: ${algorithm}`);
  }
  return normalized;
}

function audienceIncludes(claimAudience, requiredAudience) {
  if (typeof claimAudience === 'string') return claimAudience === requiredAudience;
  return Array.isArray(claimAudience) && claimAudience.some((value) => value === requiredAudience);
}

function selectSigningKey(jwks, header) {
  if (!jwks || typeof jwks !== 'object' || !Array.isArray(jwks.keys)) return null;
  const candidates = jwks.keys.filter((key) => {
    if (!key || typeof key !== 'object' || Array.isArray(key)) return false;
    if (key.kid !== header.kid) return false;
    if (key.kty !== 'RSA') return false;
    if (key.alg && key.alg !== header.alg) return false;
    if (key.use && key.use !== 'sig') return false;
    if (Array.isArray(key.key_ops) && !key.key_ops.includes('verify')) return false;
    if (key.d) return false;
    return true;
  });
  return candidates.length === 1 ? candidates[0] : null;
}

function verifyRs256(signingInput, signature, jwk) {
  let publicKey;
  try {
    publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  } catch (_) {
    return false;
  }
  try {
    return crypto.verify('RSA-SHA256', Buffer.from(signingInput, 'ascii'), publicKey, signature);
  } catch (_) {
    return false;
  }
}

function numericDate(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Cryptographically verifies a compact OIDC/JWT access token against a trusted JWKS
 * document supplied by the server-side trust layer. Only RS256 is supported in this
 * version to keep the accepted algorithm surface explicit and fail-closed.
 *
 * This function does not discover or fetch the issuer/JWKS endpoint, validate TLS,
 * check token revocation, validate user sessions, enforce MFA, or prove production
 * IdP configuration. Those controls remain external qualification requirements.
 */
function verifyOidcJwt({
  token,
  issuer,
  audience,
  jwks,
  requiredTenantId,
  allowedAlgorithms,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
  clockToleranceSeconds = 60,
  maxTokenAgeSeconds,
} = {}) {
  const expectedIssuer = requiredString(issuer, 'issuer');
  const expectedAudience = requiredString(audience, 'audience');
  const algorithms = normalizeAllowedAlgorithms(allowedAlgorithms);
  if (!Number.isFinite(nowEpochSeconds)) throw new TypeError('nowEpochSeconds must be finite');
  if (!Number.isFinite(clockToleranceSeconds) || clockToleranceSeconds < 0 || clockToleranceSeconds > 300) {
    throw new TypeError('clockToleranceSeconds must be between 0 and 300');
  }
  if (maxTokenAgeSeconds != null && (!Number.isFinite(maxTokenAgeSeconds) || maxTokenAgeSeconds <= 0)) {
    throw new TypeError('maxTokenAgeSeconds must be a positive number when provided');
  }

  if (typeof token !== 'string' || token.length === 0 || Buffer.byteLength(token, 'utf8') > MAX_COMPACT_JWT_BYTES) {
    return hold(JWT_VERIFICATION_STATUS.HOLD_TOKEN_FORMAT, 'COMPACT_JWT_REQUIRED');
  }
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => part === '')) {
    return hold(JWT_VERIFICATION_STATUS.HOLD_TOKEN_FORMAT, 'COMPACT_JWT_THREE_SEGMENTS_REQUIRED');
  }

  let header;
  let claims;
  try {
    header = decodeJsonSegment(parts[0], 'header');
    claims = decodeJsonSegment(parts[1], 'payload');
  } catch (error) {
    return hold(JWT_VERIFICATION_STATUS.HOLD_TOKEN_FORMAT, error.message || 'JWT_DECODE_FAILED');
  }

  if (!algorithms.includes(header.alg)) {
    return hold(JWT_VERIFICATION_STATUS.HOLD_ALGORITHM, 'JWT_ALGORITHM_NOT_ALLOWED');
  }
  if (typeof header.kid !== 'string' || header.kid.trim() === '') {
    return hold(JWT_VERIFICATION_STATUS.HOLD_HEADER, 'JWT_KID_REQUIRED');
  }
  if (header.crit != null) {
    return hold(JWT_VERIFICATION_STATUS.HOLD_HEADER, 'JWT_CRITICAL_HEADERS_NOT_SUPPORTED');
  }

  const jwk = selectSigningKey(jwks, header);
  if (!jwk) return hold(JWT_VERIFICATION_STATUS.HOLD_SIGNING_KEY, 'UNIQUE_TRUSTED_SIGNING_KEY_REQUIRED');

  let signature;
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(parts[2])) throw new Error('bad signature encoding');
    signature = Buffer.from(parts[2], 'base64url');
  } catch (_) {
    return hold(JWT_VERIFICATION_STATUS.HOLD_SIGNATURE, 'JWT_SIGNATURE_ENCODING_INVALID');
  }
  const signingInput = `${parts[0]}.${parts[1]}`;
  if (!verifyRs256(signingInput, signature, jwk)) {
    return hold(JWT_VERIFICATION_STATUS.HOLD_SIGNATURE, 'JWT_SIGNATURE_INVALID');
  }

  if (claims.iss !== expectedIssuer) {
    return hold(JWT_VERIFICATION_STATUS.HOLD_ISSUER, 'JWT_ISSUER_MISMATCH', { cryptographicVerificationPerformedHere: true });
  }
  if (!audienceIncludes(claims.aud, expectedAudience)) {
    return hold(JWT_VERIFICATION_STATUS.HOLD_AUDIENCE, 'JWT_AUDIENCE_MISMATCH', { cryptographicVerificationPerformedHere: true });
  }
  if (Array.isArray(claims.aud) && claims.aud.length > 1 && claims.azp !== expectedAudience) {
    return hold(JWT_VERIFICATION_STATUS.HOLD_AUTHORIZED_PARTY, 'JWT_AZP_REQUIRED_FOR_MULTIPLE_AUDIENCES', { cryptographicVerificationPerformedHere: true });
  }

  const exp = numericDate(claims.exp);
  if (exp == null || exp <= nowEpochSeconds - clockToleranceSeconds) {
    return hold(JWT_VERIFICATION_STATUS.HOLD_EXPIRY, 'JWT_EXPIRED_OR_EXP_INVALID', { cryptographicVerificationPerformedHere: true });
  }
  const nbf = claims.nbf == null ? null : numericDate(claims.nbf);
  if (claims.nbf != null && nbf == null) {
    return hold(JWT_VERIFICATION_STATUS.HOLD_NOT_BEFORE, 'JWT_NBF_INVALID', { cryptographicVerificationPerformedHere: true });
  }
  if (nbf != null && nbf > nowEpochSeconds + clockToleranceSeconds) {
    return hold(JWT_VERIFICATION_STATUS.HOLD_NOT_BEFORE, 'JWT_NOT_YET_VALID', { cryptographicVerificationPerformedHere: true });
  }
  const iat = claims.iat == null ? null : numericDate(claims.iat);
  if (claims.iat != null && iat == null) {
    return hold(JWT_VERIFICATION_STATUS.HOLD_ISSUED_AT, 'JWT_IAT_INVALID', { cryptographicVerificationPerformedHere: true });
  }
  if (iat != null && iat > nowEpochSeconds + clockToleranceSeconds) {
    return hold(JWT_VERIFICATION_STATUS.HOLD_ISSUED_AT, 'JWT_IAT_IN_FUTURE', { cryptographicVerificationPerformedHere: true });
  }
  if (maxTokenAgeSeconds != null) {
    if (iat == null || nowEpochSeconds - iat > maxTokenAgeSeconds + clockToleranceSeconds) {
      return hold(JWT_VERIFICATION_STATUS.HOLD_MAX_TOKEN_AGE, 'JWT_MAX_TOKEN_AGE_EXCEEDED', { cryptographicVerificationPerformedHere: true });
    }
  }

  const tokenDigest = crypto.createHash('sha256').update(token, 'utf8').digest('hex');
  const identityContext = createVerifiedIdentityContext({
    claims,
    requiredTenantId,
    nowEpochSeconds: nowEpochSeconds - clockToleranceSeconds,
    tokenVerificationEvidence: {
      verified: true,
      verificationRef: `sha256:${tokenDigest}`,
      algorithm: header.alg,
      keyId: header.kid,
      issuer: expectedIssuer,
      audience: expectedAudience,
    },
  });

  if (!identityContext || identityContext.authorizationReady !== true) {
    return hold(JWT_VERIFICATION_STATUS.HOLD_IDENTITY_CONTEXT, identityContext?.reasonCodes?.[0] || 'VERIFIED_CLAIMS_NOT_AUTHORIZATION_READY', {
      cryptographicVerificationPerformedHere: true,
      identityContext,
    });
  }

  return freeze({
    status: JWT_VERIFICATION_STATUS.VERIFIED_JWT,
    reasonCodes: [],
    identityContext,
    authorizationReady: true,
    tokenMetadata: {
      algorithm: header.alg,
      keyId: header.kid.trim(),
      tokenDigest: `sha256:${tokenDigest}`,
      issuer: expectedIssuer,
      audience: expectedAudience,
      expiresAt: exp,
      notBefore: nbf,
      issuedAt: iat,
    },
    cryptographicVerificationPerformedHere: true,
    issuerValidatedHere: true,
    audienceValidatedHere: true,
    expiryValidatedHere: true,
    productionAuthenticationValidated: false,
    requiresTrustedJwksDelivery: true,
    revocationCheckedHere: false,
    sessionPolicyValidatedHere: false,
    mfaPolicyValidatedHere: false,
    transactionAuthorized: false,
    semantics: 'The compact JWT signature and core issuer/audience/time claims were verified in this module against the supplied trusted JWKS. This is an application authentication boundary, not proof that the configured IdP, JWKS delivery, revocation, session, MFA, credential management, or production deployment controls have been independently validated.',
  });
}

module.exports = {
  JWT_VERIFICATION_STATUS,
  SUPPORTED_ALGORITHMS,
  verifyOidcJwt,
};
