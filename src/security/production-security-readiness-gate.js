'use strict';

const { SECURITY_READINESS_STATUS } = require('./security-readiness-orchestrator.js');
const { IDENTITY_RUNTIME_STATUS } = require('./runtime-identity-verification.js');

const PRODUCTION_SECURITY_STATUS = Object.freeze({
  READY_FOR_INDEPENDENT_SECURITY_REVIEW: 'READY_FOR_INDEPENDENT_SECURITY_REVIEW',
  HOLD_BASE_SECURITY_READINESS: 'HOLD_BASE_SECURITY_READINESS',
  HOLD_RUNTIME_IDENTITY_EVIDENCE: 'HOLD_RUNTIME_IDENTITY_EVIDENCE',
  HOLD_IDENTITY_SCOPE_MISMATCH: 'HOLD_IDENTITY_SCOPE_MISMATCH',
});

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function normalizeExpectedIdentityScope(scope) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) throw new TypeError('expectedIdentityScope is required');
  return Object.freeze({
    environment: requiredString(scope.environment, 'expectedIdentityScope.environment'),
    identityProviderRef: requiredString(scope.identityProviderRef, 'expectedIdentityScope.identityProviderRef'),
    issuer: requiredString(scope.issuer, 'expectedIdentityScope.issuer'),
    audience: requiredString(scope.audience, 'expectedIdentityScope.audience'),
  });
}

function buildProductionSecurityReadinessGate({
  baseSecurityAssessment,
  runtimeIdentityAssessment,
  expectedIdentityScope,
} = {}) {
  if (!baseSecurityAssessment || typeof baseSecurityAssessment !== 'object') throw new TypeError('baseSecurityAssessment is required');
  if (!runtimeIdentityAssessment || typeof runtimeIdentityAssessment !== 'object') throw new TypeError('runtimeIdentityAssessment is required');
  const expected = normalizeExpectedIdentityScope(expectedIdentityScope);

  let status = PRODUCTION_SECURITY_STATUS.READY_FOR_INDEPENDENT_SECURITY_REVIEW;
  const reasonCodes = [];

  if (baseSecurityAssessment.status !== SECURITY_READINESS_STATUS.READY_FOR_INDEPENDENT_SECURITY_REVIEW) {
    status = PRODUCTION_SECURITY_STATUS.HOLD_BASE_SECURITY_READINESS;
    reasonCodes.push(`BASE_SECURITY_${String(baseSecurityAssessment.status || 'UNKNOWN')}`);
  } else if (runtimeIdentityAssessment.environment !== expected.environment ||
      runtimeIdentityAssessment.identityProviderRef !== expected.identityProviderRef ||
      runtimeIdentityAssessment.issuer !== expected.issuer ||
      runtimeIdentityAssessment.audience !== expected.audience) {
    status = PRODUCTION_SECURITY_STATUS.HOLD_IDENTITY_SCOPE_MISMATCH;
    reasonCodes.push('RUNTIME_IDENTITY_SCOPE_MISMATCH');
  } else if (runtimeIdentityAssessment.status !== IDENTITY_RUNTIME_STATUS.VERIFICATION_EVIDENCE_COMPLETE) {
    status = PRODUCTION_SECURITY_STATUS.HOLD_RUNTIME_IDENTITY_EVIDENCE;
    reasonCodes.push(`IDENTITY_RUNTIME_${String(runtimeIdentityAssessment.status || 'UNKNOWN')}`);
  }

  return Object.freeze({
    status,
    reasonCodes: Object.freeze(reasonCodes),
    expectedIdentityScope: expected,
    evidence: Object.freeze({
      baseSecurityStatus: baseSecurityAssessment.status || null,
      runtimeIdentityStatus: runtimeIdentityAssessment.status || null,
      runtimeIdentityEvidenceRefs: Object.freeze([...(runtimeIdentityAssessment.evidenceRefs || [])]),
    }),
    gates: Object.freeze({
      baseSecurityReady: baseSecurityAssessment.status === SECURITY_READINESS_STATUS.READY_FOR_INDEPENDENT_SECURITY_REVIEW,
      runtimeIdentityReady: runtimeIdentityAssessment.status === IDENTITY_RUNTIME_STATUS.VERIFICATION_EVIDENCE_COMPLETE,
      identityScopeMatches:
        runtimeIdentityAssessment.environment === expected.environment &&
        runtimeIdentityAssessment.identityProviderRef === expected.identityProviderRef &&
        runtimeIdentityAssessment.issuer === expected.issuer &&
        runtimeIdentityAssessment.audience === expected.audience,
    }),
    productionSecurityVerifiedByThisModule: false,
    productionIdentityVerifiedByThisModule: false,
    independentSecurityReviewRequired: true,
    penetrationTestingPerformedHere: false,
    tokenVerificationExecutedHere: false,
    databaseTestsExecutedHere: false,
    transactionAuthorized: false,
    semantics: 'READY_FOR_INDEPENDENT_SECURITY_REVIEW means the caller-supplied base security readiness and runtime identity evidence passed this deterministic composition gate for the declared scope. It is not a production security certification, penetration test, token verification result, or database execution result.',
  });
}

module.exports = {
  PRODUCTION_SECURITY_STATUS,
  buildProductionSecurityReadinessGate,
};
