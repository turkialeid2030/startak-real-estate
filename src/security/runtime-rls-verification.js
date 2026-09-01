'use strict';

const VERIFICATION_STATUS = Object.freeze({
  VERIFICATION_EVIDENCE_COMPLETE: 'VERIFICATION_EVIDENCE_COMPLETE',
  HOLD_RUNTIME_EVIDENCE: 'HOLD_RUNTIME_EVIDENCE',
  HOLD_CROSS_TENANT_FAILURE: 'HOLD_CROSS_TENANT_FAILURE',
  HOLD_PRIVILEGED_ROLE: 'HOLD_PRIVILEGED_ROLE',
  HOLD_CONTEXT_RESET: 'HOLD_CONTEXT_RESET',
  HOLD_FORCE_RLS: 'HOLD_FORCE_RLS',
});

const REQUIRED_RUNTIME_CHECKS = Object.freeze([
  'runtimeRoleIsSuperuser',
  'runtimeRoleBypassesRls',
  'forceRlsEnabled',
  'sameTenantCrudAllowed',
  'crossTenantCrudDenied',
  'missingTenantContextDenied',
  'tenantContextResetBetweenRequests',
  'privilegedPathSeparatelyTested',
]);

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function assertBoolean(value, field) {
  if (typeof value !== 'boolean') throw new TypeError(`${field} must be boolean`);
}

function normalizeEvidenceRefs(refs) {
  if (!Array.isArray(refs) || refs.length === 0) {
    throw new TypeError('evidenceRefs must be a non-empty array');
  }
  return Object.freeze(refs.map((ref, index) => requireNonEmptyString(ref, `evidenceRefs[${index}]`)));
}

function evaluateRuntimeRlsVerification(input = {}) {
  const testedAt = requireNonEmptyString(input.testedAt, 'testedAt');
  const environment = requireNonEmptyString(input.environment, 'environment');
  const targetDatabaseRef = requireNonEmptyString(input.targetDatabaseRef, 'targetDatabaseRef');
  const evidenceRefs = normalizeEvidenceRefs(input.evidenceRefs);
  const checks = input.checks;
  if (!checks || typeof checks !== 'object' || Array.isArray(checks)) {
    throw new TypeError('checks must be an object');
  }

  const missingChecks = REQUIRED_RUNTIME_CHECKS.filter((key) => !(key in checks));
  if (missingChecks.length > 0) {
    return Object.freeze({
      status: VERIFICATION_STATUS.HOLD_RUNTIME_EVIDENCE,
      testedAt,
      environment,
      targetDatabaseRef,
      evidenceRefs,
      missingChecks: Object.freeze(missingChecks),
      productionSecurityVerifiedByThisModule: false,
      semantics: 'Runtime security evidence is incomplete. This module only evaluates supplied evidence and does not execute database or network tests.',
    });
  }

  for (const key of REQUIRED_RUNTIME_CHECKS) assertBoolean(checks[key], `checks.${key}`);

  let status = VERIFICATION_STATUS.VERIFICATION_EVIDENCE_COMPLETE;
  if (checks.runtimeRoleIsSuperuser || checks.runtimeRoleBypassesRls) {
    status = VERIFICATION_STATUS.HOLD_PRIVILEGED_ROLE;
  } else if (!checks.forceRlsEnabled) {
    status = VERIFICATION_STATUS.HOLD_FORCE_RLS;
  } else if (!checks.crossTenantCrudDenied || !checks.missingTenantContextDenied || !checks.sameTenantCrudAllowed) {
    status = VERIFICATION_STATUS.HOLD_CROSS_TENANT_FAILURE;
  } else if (!checks.tenantContextResetBetweenRequests) {
    status = VERIFICATION_STATUS.HOLD_CONTEXT_RESET;
  } else if (!checks.privilegedPathSeparatelyTested) {
    status = VERIFICATION_STATUS.HOLD_RUNTIME_EVIDENCE;
  }

  return Object.freeze({
    status,
    testedAt,
    environment,
    targetDatabaseRef,
    evidenceRefs,
    checks: Object.freeze({ ...checks }),
    missingChecks: Object.freeze([]),
    productionSecurityVerifiedByThisModule: false,
    requiresIndependentRuntimeEvidence: true,
    transactionAuthorized: false,
    semantics: 'This deterministic evaluator does not connect to PostgreSQL or an API. VERIFICATION_EVIDENCE_COMPLETE means only that the caller supplied a complete passing evidence set for the required RLS/IDOR checks; it is not an independent production-security certification.',
  });
}

module.exports = {
  VERIFICATION_STATUS,
  REQUIRED_RUNTIME_CHECKS,
  evaluateRuntimeRlsVerification,
};
