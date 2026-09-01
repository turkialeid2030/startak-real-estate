'use strict';

const { IDENTITY_STATUS } = require('./verified-identity-context.js');
const { VERIFICATION_STATUS } = require('./runtime-rls-verification.js');

const SECURITY_READINESS_STATUS = Object.freeze({
  READY_FOR_INDEPENDENT_SECURITY_REVIEW: 'READY_FOR_INDEPENDENT_SECURITY_REVIEW',
  HOLD_IDENTITY_EVIDENCE: 'HOLD_IDENTITY_EVIDENCE',
  HOLD_RLS_EVIDENCE: 'HOLD_RLS_EVIDENCE',
  HOLD_AUTHORIZATION_EVIDENCE: 'HOLD_AUTHORIZATION_EVIDENCE',
  HOLD_AUDIT_EVIDENCE: 'HOLD_AUDIT_EVIDENCE',
  HOLD_SCOPE_MISMATCH: 'HOLD_SCOPE_MISMATCH',
});

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function requireScope(scope) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) throw new TypeError('scope is required');
  const environment = String(scope.environment || '').trim();
  const tenantId = String(scope.tenantId || '').trim();
  const targetDatabaseRef = String(scope.targetDatabaseRef || '').trim();
  if (!environment || !tenantId || !targetDatabaseRef) throw new TypeError('scope requires environment, tenantId, and targetDatabaseRef');
  return Object.freeze({ environment, tenantId, targetDatabaseRef });
}

function evidenceArray(value, field) {
  if (!Array.isArray(value) || value.length === 0) throw new TypeError(`${field} must be a non-empty array`);
  return Object.freeze(value.map((item, index) => {
    if (!nonEmpty(item)) throw new TypeError(`${field}[${index}] must be a non-empty string`);
    return item.trim();
  }));
}

function buildSecurityReadinessAssessment({
  scope,
  identityAssessment,
  rlsAssessment,
  authorizationEvidence,
  auditEvidence,
} = {}) {
  const normalizedScope = requireScope(scope);

  if (!identityAssessment || typeof identityAssessment !== 'object') throw new TypeError('identityAssessment is required');
  if (!rlsAssessment || typeof rlsAssessment !== 'object') throw new TypeError('rlsAssessment is required');
  if (!authorizationEvidence || typeof authorizationEvidence !== 'object') throw new TypeError('authorizationEvidence is required');
  if (!auditEvidence || typeof auditEvidence !== 'object') throw new TypeError('auditEvidence is required');

  const authorizationRefs = evidenceArray(authorizationEvidence.evidenceRefs, 'authorizationEvidence.evidenceRefs');
  const auditRefs = evidenceArray(auditEvidence.evidenceRefs, 'auditEvidence.evidenceRefs');

  let status = SECURITY_READINESS_STATUS.READY_FOR_INDEPENDENT_SECURITY_REVIEW;
  const reasonCodes = [];

  const identityTenantId = identityAssessment.identity?.tenantId || identityAssessment.identity?.tenant_id || null;
  if (identityAssessment.status !== IDENTITY_STATUS.VERIFIED_CONTEXT || identityAssessment.authorizationReady !== true) {
    status = SECURITY_READINESS_STATUS.HOLD_IDENTITY_EVIDENCE;
    reasonCodes.push('IDENTITY_CONTEXT_NOT_VERIFIED');
  } else if (identityTenantId !== normalizedScope.tenantId) {
    status = SECURITY_READINESS_STATUS.HOLD_SCOPE_MISMATCH;
    reasonCodes.push('IDENTITY_TENANT_SCOPE_MISMATCH');
  } else if (rlsAssessment.environment !== normalizedScope.environment || rlsAssessment.targetDatabaseRef !== normalizedScope.targetDatabaseRef) {
    status = SECURITY_READINESS_STATUS.HOLD_SCOPE_MISMATCH;
    reasonCodes.push('RLS_SCOPE_MISMATCH');
  } else if (rlsAssessment.status !== VERIFICATION_STATUS.VERIFICATION_EVIDENCE_COMPLETE) {
    status = SECURITY_READINESS_STATUS.HOLD_RLS_EVIDENCE;
    reasonCodes.push(`RLS_${String(rlsAssessment.status || 'UNKNOWN')}`);
  } else if (authorizationEvidence.sameTenantAllowed !== true || authorizationEvidence.crossTenantDenied !== true || authorizationEvidence.unknownActionDenied !== true) {
    status = SECURITY_READINESS_STATUS.HOLD_AUTHORIZATION_EVIDENCE;
    reasonCodes.push('AUTHORIZATION_POLICY_RUNTIME_EVIDENCE_INCOMPLETE');
  } else if (auditEvidence.allowRecorded !== true || auditEvidence.denyRecorded !== true || auditEvidence.sensitiveMetadataFiltered !== true) {
    status = SECURITY_READINESS_STATUS.HOLD_AUDIT_EVIDENCE;
    reasonCodes.push('SECURITY_AUDIT_RUNTIME_EVIDENCE_INCOMPLETE');
  }

  return Object.freeze({
    status,
    scope: normalizedScope,
    reasonCodes: Object.freeze(reasonCodes),
    evidence: Object.freeze({
      identityVerificationRef: identityAssessment.identity?.verificationRef || null,
      rlsEvidenceRefs: Object.freeze([...(rlsAssessment.evidenceRefs || [])]),
      authorizationEvidenceRefs: authorizationRefs,
      auditEvidenceRefs: auditRefs,
    }),
    gates: Object.freeze({
      identityReady: identityAssessment.status === IDENTITY_STATUS.VERIFIED_CONTEXT && identityAssessment.authorizationReady === true,
      rlsReady: rlsAssessment.status === VERIFICATION_STATUS.VERIFICATION_EVIDENCE_COMPLETE,
      authorizationReady: authorizationEvidence.sameTenantAllowed === true && authorizationEvidence.crossTenantDenied === true && authorizationEvidence.unknownActionDenied === true,
      auditReady: auditEvidence.allowRecorded === true && auditEvidence.denyRecorded === true && auditEvidence.sensitiveMetadataFiltered === true,
    }),
    productionSecurityVerifiedByThisModule: false,
    independentSecurityReviewRequired: true,
    penetrationTestingPerformedHere: false,
    oidcJwtVerificationPerformedHere: false,
    databaseTestsExecutedHere: false,
    transactionAuthorized: false,
    semantics: 'READY_FOR_INDEPENDENT_SECURITY_REVIEW means only that supplied identity, RLS/IDOR, authorization, and audit evidence passed this deterministic composition gate for the same declared scope. It is not a production security certification, penetration test, OIDC/JWT verification, or database execution result.',
  });
}

module.exports = {
  SECURITY_READINESS_STATUS,
  buildSecurityReadinessAssessment,
};
