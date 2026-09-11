'use strict';

const IDENTITY_STATUS = Object.freeze({
  VERIFIED_CONTEXT: 'VERIFIED_CONTEXT',
  HOLD_TOKEN_VERIFICATION: 'HOLD_TOKEN_VERIFICATION',
  HOLD_REQUIRED_CLAIMS: 'HOLD_REQUIRED_CLAIMS',
  HOLD_TOKEN_EXPIRED: 'HOLD_TOKEN_EXPIRED',
  HOLD_TENANT_MEMBERSHIP: 'HOLD_TENANT_MEMBERSHIP',
});

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

function isVerifiedIdentityContext(context) {
  if (!context || typeof context !== 'object') return false;
  if (context.status !== IDENTITY_STATUS.VERIFIED_CONTEXT || context.authorizationReady !== true) return false;
  const identity = context.identity;
  if (!identity || typeof identity !== 'object') return false;
  const actorId = String(identity.actorId || '').trim();
  const subject = String(identity.subject || '').trim();
  const tenantId = String(identity.tenantId || '').trim();
  const roles = Array.isArray(identity.roles) ? identity.roles : [];
  if (!actorId || !subject || actorId !== subject || !tenantId || roles.length === 0) return false;
  return roles.every((role) => nonEmpty(role));
}

function requireVerifiedIdentityContext(context) {
  if (!isVerifiedIdentityContext(context)) {
    const error = new Error('VERIFIED_IDENTITY_CONTEXT_REQUIRED');
    error.code = 'VERIFIED_IDENTITY_CONTEXT_REQUIRED';
    throw error;
  }
  return context.identity;
}

/**
 * Builds an application identity context only from claims that an external/server-side
 * verifier has already cryptographically validated. This module does not verify JWTs,
 * signatures, issuers, JWKS, revocation, MFA, or sessions itself.
 *
 * The verified `sub` claim is the single principal source of truth. It is exposed as
 * both `subject` (OIDC terminology) and `actorId` (application authorization/audit
 * terminology) so downstream security code never needs caller-supplied actor metadata.
 */
function createVerifiedIdentityContext({
  claims,
  tokenVerificationEvidence,
  requiredTenantId,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
} = {}) {
  if (!tokenVerificationEvidence || tokenVerificationEvidence.verified !== true) {
    return freeze({
      status: IDENTITY_STATUS.HOLD_TOKEN_VERIFICATION,
      reasonCodes: ['SERVER_SIDE_TOKEN_VERIFICATION_NOT_PROVEN'],
      identity: null,
      authorizationReady: false,
      productionIdentityVerifiedByThisModule: false,
    });
  }

  if (!claims || typeof claims !== 'object' || Array.isArray(claims)) {
    return freeze({
      status: IDENTITY_STATUS.HOLD_REQUIRED_CLAIMS,
      reasonCodes: ['CLAIMS_OBJECT_REQUIRED'],
      identity: null,
      authorizationReady: false,
      productionIdentityVerifiedByThisModule: false,
    });
  }

  const subject = claims.sub;
  const tenantId = claims.tenant_id;
  const roles = claims.roles;
  const issuer = claims.iss;
  const audience = claims.aud;
  const expiresAt = claims.exp;

  const missing = [];
  if (!nonEmpty(subject)) missing.push('sub');
  if (!nonEmpty(tenantId)) missing.push('tenant_id');
  if (!Array.isArray(roles) || roles.length === 0 || roles.some((role) => !nonEmpty(role))) missing.push('roles');
  if (!nonEmpty(issuer)) missing.push('iss');
  if (!(nonEmpty(audience) || (Array.isArray(audience) && audience.length > 0 && audience.every(nonEmpty)))) missing.push('aud');
  if (!Number.isFinite(expiresAt)) missing.push('exp');

  if (missing.length) {
    return freeze({
      status: IDENTITY_STATUS.HOLD_REQUIRED_CLAIMS,
      reasonCodes: missing.map((key) => `MISSING_OR_INVALID_${key.toUpperCase()}`),
      identity: null,
      authorizationReady: false,
      productionIdentityVerifiedByThisModule: false,
    });
  }

  if (expiresAt <= nowEpochSeconds) {
    return freeze({
      status: IDENTITY_STATUS.HOLD_TOKEN_EXPIRED,
      reasonCodes: ['TOKEN_EXPIRED'],
      identity: null,
      authorizationReady: false,
      productionIdentityVerifiedByThisModule: false,
    });
  }

  if (nonEmpty(requiredTenantId) && tenantId !== requiredTenantId) {
    return freeze({
      status: IDENTITY_STATUS.HOLD_TENANT_MEMBERSHIP,
      reasonCodes: ['TOKEN_TENANT_DOES_NOT_MATCH_REQUIRED_TENANT'],
      identity: null,
      authorizationReady: false,
      productionIdentityVerifiedByThisModule: false,
    });
  }

  const canonicalActorId = subject.trim();
  const identity = freeze({
    actorId: canonicalActorId,
    subject: canonicalActorId,
    tenantId: tenantId.trim(),
    roles: [...new Set(roles.map((role) => role.trim()))].sort(),
    issuer: issuer.trim(),
    audience: Array.isArray(audience) ? [...audience] : audience,
    expiresAt,
    verificationRef: tokenVerificationEvidence.verificationRef || null,
  });

  return freeze({
    status: IDENTITY_STATUS.VERIFIED_CONTEXT,
    reasonCodes: [],
    identity,
    authorizationReady: true,
    productionIdentityVerifiedByThisModule: false,
    claimBoundary: {
      cryptographicVerificationPerformedHere: false,
      issuerValidationPerformedHere: false,
      audienceValidationPerformedHere: false,
      revocationCheckedHere: false,
      mfaCheckedHere: false,
      requiresTrustedServerVerifier: true,
    },
    semantics: 'This module only converts externally verified identity claims into an application context. The verified sub claim is the canonical actorId. Production OIDC/JWT validation, issuer/audience/JWKS/revocation/session/MFA controls must be implemented and evidenced by the trusted server identity layer.',
  });
}

module.exports = {
  IDENTITY_STATUS,
  createVerifiedIdentityContext,
  isVerifiedIdentityContext,
  requireVerifiedIdentityContext,
};