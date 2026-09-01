'use strict';

const { PRODUCTION_SECURITY_STATUS } = require('./production-security-readiness-gate.js');
const { ATTESTATION_STATUS } = require('./security-evidence-attestation.js');

const SECURITY_EVIDENCE_TRUST_STATUS = Object.freeze({
  READY_FOR_INDEPENDENT_SECURITY_REVIEW: 'READY_FOR_INDEPENDENT_SECURITY_REVIEW',
  HOLD_PRODUCTION_SECURITY_READINESS: 'HOLD_PRODUCTION_SECURITY_READINESS',
  HOLD_ATTESTATION_EVIDENCE: 'HOLD_ATTESTATION_EVIDENCE',
  HOLD_ATTESTATION_SCOPE_MISMATCH: 'HOLD_ATTESTATION_SCOPE_MISMATCH',
  HOLD_ATTESTATION_SET: 'HOLD_ATTESTATION_SET',
});

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function buildSecurityEvidenceTrustGate({
  productionSecurityAssessment,
  expectedEnvironment,
  requiredTargetRefs,
  attestations,
} = {}) {
  if (!productionSecurityAssessment || typeof productionSecurityAssessment !== 'object') {
    throw new TypeError('productionSecurityAssessment is required');
  }
  const environment = requiredString(expectedEnvironment, 'expectedEnvironment');
  if (!Array.isArray(requiredTargetRefs) || requiredTargetRefs.length === 0) {
    throw new TypeError('requiredTargetRefs must be a non-empty array');
  }
  const requiredTargets = Object.freeze([...new Set(requiredTargetRefs.map((value, index) => requiredString(value, `requiredTargetRefs[${index}]`)))]);
  if (!Array.isArray(attestations) || attestations.length === 0) throw new TypeError('attestations must be a non-empty array');

  let status = SECURITY_EVIDENCE_TRUST_STATUS.READY_FOR_INDEPENDENT_SECURITY_REVIEW;
  const reasonCodes = [];

  const byTarget = new Map();
  for (const [index, attestation] of attestations.entries()) {
    if (!attestation || typeof attestation !== 'object') throw new TypeError(`attestations[${index}] must be an object`);
    const targetRef = requiredString(attestation.targetRef, `attestations[${index}].targetRef`);
    if (byTarget.has(targetRef)) {
      status = SECURITY_EVIDENCE_TRUST_STATUS.HOLD_ATTESTATION_SET;
      reasonCodes.push(`DUPLICATE_ATTESTATION_TARGET:${targetRef}`);
      continue;
    }
    byTarget.set(targetRef, attestation);
  }

  if (productionSecurityAssessment.status !== PRODUCTION_SECURITY_STATUS.READY_FOR_INDEPENDENT_SECURITY_REVIEW) {
    status = SECURITY_EVIDENCE_TRUST_STATUS.HOLD_PRODUCTION_SECURITY_READINESS;
    reasonCodes.push(`PRODUCTION_SECURITY_${String(productionSecurityAssessment.status || 'UNKNOWN')}`);
  } else if (status === SECURITY_EVIDENCE_TRUST_STATUS.READY_FOR_INDEPENDENT_SECURITY_REVIEW) {
    const missingTargets = requiredTargets.filter((targetRef) => !byTarget.has(targetRef));
    if (missingTargets.length > 0) {
      status = SECURITY_EVIDENCE_TRUST_STATUS.HOLD_ATTESTATION_SET;
      reasonCodes.push(...missingTargets.map((targetRef) => `MISSING_ATTESTATION_TARGET:${targetRef}`));
    }
  }

  if (status === SECURITY_EVIDENCE_TRUST_STATUS.READY_FOR_INDEPENDENT_SECURITY_REVIEW) {
    for (const targetRef of requiredTargets) {
      const attestation = byTarget.get(targetRef);
      if (attestation.environment !== environment || attestation.targetRef !== targetRef) {
        status = SECURITY_EVIDENCE_TRUST_STATUS.HOLD_ATTESTATION_SCOPE_MISMATCH;
        reasonCodes.push(`ATTESTATION_SCOPE_MISMATCH:${targetRef}`);
        break;
      }
      if (attestation.status !== ATTESTATION_STATUS.ATTESTATION_EVIDENCE_COMPLETE) {
        status = SECURITY_EVIDENCE_TRUST_STATUS.HOLD_ATTESTATION_EVIDENCE;
        reasonCodes.push(`ATTESTATION_${String(attestation.status || 'UNKNOWN')}:${targetRef}`);
        break;
      }
    }
  }

  const evidenceSummaries = requiredTargets.map((targetRef) => {
    const attestation = byTarget.get(targetRef);
    return Object.freeze({
      targetRef,
      evidenceId: attestation?.evidenceId || null,
      status: attestation?.status || null,
      issuerRef: attestation?.issuerRef || null,
      contentHash: attestation?.contentHash || null,
      verifiedAt: attestation?.verifiedAt || null,
      assessedAt: attestation?.assessedAt || null,
    });
  });

  return Object.freeze({
    status,
    reasonCodes: Object.freeze(reasonCodes),
    expectedEnvironment: environment,
    requiredTargetRefs: requiredTargets,
    evidenceSummaries: Object.freeze(evidenceSummaries),
    gates: Object.freeze({
      productionSecurityReady: productionSecurityAssessment.status === PRODUCTION_SECURITY_STATUS.READY_FOR_INDEPENDENT_SECURITY_REVIEW,
      completeAttestationSet: requiredTargets.every((targetRef) => byTarget.has(targetRef)),
      allAttestationsTrusted: requiredTargets.every((targetRef) => byTarget.get(targetRef)?.status === ATTESTATION_STATUS.ATTESTATION_EVIDENCE_COMPLETE),
      allScopesMatch: requiredTargets.every((targetRef) => {
        const item = byTarget.get(targetRef);
        return item && item.environment === environment && item.targetRef === targetRef;
      }),
    }),
    productionSecurityVerifiedByThisModule: false,
    cryptographicEvidenceVerifiedByThisModule: false,
    independentSecurityReviewRequired: true,
    transactionAuthorized: false,
    semantics: 'READY_FOR_INDEPENDENT_SECURITY_REVIEW means only that the supplied production-security readiness result and the complete caller-supplied attestation set passed deterministic scope, coverage, and attestation-status checks. This module does not fetch evidence, verify digital signatures, establish issuer trust, perform penetration testing, or certify production security.',
  });
}

module.exports = {
  SECURITY_EVIDENCE_TRUST_STATUS,
  buildSecurityEvidenceTrustGate,
};
