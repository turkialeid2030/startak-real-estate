'use strict';

const IDENTITY_RUNTIME_STATUS = Object.freeze({
  VERIFICATION_EVIDENCE_COMPLETE: 'VERIFICATION_EVIDENCE_COMPLETE',
  HOLD_RUNTIME_EVIDENCE: 'HOLD_RUNTIME_EVIDENCE',
  HOLD_SIGNATURE: 'HOLD_SIGNATURE',
  HOLD_ISSUER: 'HOLD_ISSUER',
  HOLD_AUDIENCE: 'HOLD_AUDIENCE',
  HOLD_EXPIRY: 'HOLD_EXPIRY',
  HOLD_JWKS_TRUST: 'HOLD_JWKS_TRUST',
  HOLD_TENANT_CLAIM: 'HOLD_TENANT_CLAIM',
  HOLD_SUBJECT_CLAIM: 'HOLD_SUBJECT_CLAIM',
  HOLD_SESSION_POLICY: 'HOLD_SESSION_POLICY',
  HOLD_MFA_POLICY: 'HOLD_MFA_POLICY',
});

const REQUIRED_CHECKS = Object.freeze([
  'signatureVerified',
  'issuerValidated',
  'audienceValidated',
  'expiryValidated',
  'jwksTrusted',
  'tenantClaimValidated',
  'subjectClaimValidated',
]);

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function evidenceRefs(value) {
  if (!Array.isArray(value) || value.length === 0) throw new TypeError('evidenceRefs must be a non-empty array');
  return Object.freeze(value.map((ref, index) => requiredString(ref, `evidenceRefs[${index}]`)));
}

function evaluateRuntimeIdentityVerification(input = {}) {
  const testedAt = requiredString(input.testedAt, 'testedAt');
  const environment = requiredString(input.environment, 'environment');
  const identityProviderRef = requiredString(input.identityProviderRef, 'identityProviderRef');
  const issuer = requiredString(input.issuer, 'issuer');
  const audience = requiredString(input.audience, 'audience');
  const refs = evidenceRefs(input.evidenceRefs);
  const checks = input.checks;
  if (!checks || typeof checks !== 'object' || Array.isArray(checks)) throw new TypeError('checks must be an object');

  const missingChecks = REQUIRED_CHECKS.filter((key) => typeof checks[key] !== 'boolean');
  const sessionPolicyRequired = Boolean(input.sessionPolicyRequired);
  const mfaPolicyRequired = Boolean(input.mfaPolicyRequired);
  if (sessionPolicyRequired && typeof checks.sessionInvalidationValidated !== 'boolean') missingChecks.push('sessionInvalidationValidated');
  if (mfaPolicyRequired && typeof checks.mfaValidated !== 'boolean') missingChecks.push('mfaValidated');

  if (missingChecks.length > 0) {
    return Object.freeze({
      status: IDENTITY_RUNTIME_STATUS.HOLD_RUNTIME_EVIDENCE,
      testedAt,
      environment,
      identityProviderRef,
      issuer,
      audience,
      evidenceRefs: refs,
      missingChecks: Object.freeze([...new Set(missingChecks)]),
      productionIdentityVerifiedByThisModule: false,
      requiresIndependentRuntimeEvidence: true,
      transactionAuthorized: false,
    });
  }

  let status = IDENTITY_RUNTIME_STATUS.VERIFICATION_EVIDENCE_COMPLETE;
  if (!checks.signatureVerified) status = IDENTITY_RUNTIME_STATUS.HOLD_SIGNATURE;
  else if (!checks.issuerValidated) status = IDENTITY_RUNTIME_STATUS.HOLD_ISSUER;
  else if (!checks.audienceValidated) status = IDENTITY_RUNTIME_STATUS.HOLD_AUDIENCE;
  else if (!checks.expiryValidated) status = IDENTITY_RUNTIME_STATUS.HOLD_EXPIRY;
  else if (!checks.jwksTrusted) status = IDENTITY_RUNTIME_STATUS.HOLD_JWKS_TRUST;
  else if (!checks.tenantClaimValidated) status = IDENTITY_RUNTIME_STATUS.HOLD_TENANT_CLAIM;
  else if (!checks.subjectClaimValidated) status = IDENTITY_RUNTIME_STATUS.HOLD_SUBJECT_CLAIM;
  else if (sessionPolicyRequired && !checks.sessionInvalidationValidated) status = IDENTITY_RUNTIME_STATUS.HOLD_SESSION_POLICY;
  else if (mfaPolicyRequired && !checks.mfaValidated) status = IDENTITY_RUNTIME_STATUS.HOLD_MFA_POLICY;

  return Object.freeze({
    status,
    testedAt,
    environment,
    identityProviderRef,
    issuer,
    audience,
    sessionPolicyRequired,
    mfaPolicyRequired,
    evidenceRefs: refs,
    checks: Object.freeze({ ...checks }),
    missingChecks: Object.freeze([]),
    productionIdentityVerifiedByThisModule: false,
    requiresIndependentRuntimeEvidence: true,
    tokenVerificationExecutedHere: false,
    jwksFetchedHere: false,
    revocationServiceCalledHere: false,
    transactionAuthorized: false,
    semantics: 'This deterministic module evaluates caller-supplied runtime identity verification evidence only. VERIFICATION_EVIDENCE_COMPLETE is not independent proof that OIDC/JWT verification, JWKS trust, session invalidation, or MFA controls operate correctly in production.',
  });
}

module.exports = {
  IDENTITY_RUNTIME_STATUS,
  REQUIRED_CHECKS,
  evaluateRuntimeIdentityVerification,
};
