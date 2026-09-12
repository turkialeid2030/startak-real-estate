'use strict';

const {
  PRODUCTION_READINESS_STATUS,
} = require('../production-readiness/production-readiness-audit');
const {
  RELEASE_QUALIFICATION_STATUS,
  verifyIndependentReleaseQualification,
} = require('../qualification/independent-release-qualification');
const {
  INSTITUTIONAL_GO_LIVE_STATUS,
} = require('../production-readiness/institutional-go-live-gate');

const PRODUCTION_QUALIFICATION_STATUS = Object.freeze({
  READY_FOR_EXISTING_RELEASE_GOVERNANCE_REVIEW: 'READY_FOR_EXISTING_RELEASE_GOVERNANCE_REVIEW',
  HOLD_PRODUCTION_READINESS: 'HOLD_PRODUCTION_READINESS',
  HOLD_INDEPENDENT_RELEASE_QUALIFICATION: 'HOLD_INDEPENDENT_RELEASE_QUALIFICATION',
  HOLD_INSTITUTIONAL_GO_LIVE_REVIEW: 'HOLD_INSTITUTIONAL_GO_LIVE_REVIEW',
  HOLD_EVIDENCE_INTEGRITY: 'HOLD_EVIDENCE_INTEGRITY',
  HOLD_EVIDENCE_REFERENCES: 'HOLD_EVIDENCE_REFERENCES',
});

const NEXT_STEP = Object.freeze({
  COMPLETE_EXTERNAL_QUALIFICATION_EVIDENCE: 'COMPLETE_EXTERNAL_QUALIFICATION_EVIDENCE',
  EXISTING_RELEASE_GOVERNANCE_REVIEW: 'EXISTING_RELEASE_GOVERNANCE_REVIEW',
});

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

function fail(code, message = code) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function assertNoCallerAuthorityOverride({
  releaseAuthorized,
  mergeAuthorized,
  deploymentAuthorized,
  goLiveAuthorized,
  transactionAuthorized,
  productionAuthenticationValidated,
  productionPersistenceValidated,
  productionSecurityValidated,
  productionPerformanceValidated,
  legalApprovalEstablished,
  certifiedValuationEstablished,
} = {}) {
  if (
    releaseAuthorized != null
    || mergeAuthorized != null
    || deploymentAuthorized != null
    || goLiveAuthorized != null
    || transactionAuthorized != null
    || productionAuthenticationValidated != null
    || productionPersistenceValidated != null
    || productionSecurityValidated != null
    || productionPerformanceValidated != null
    || legalApprovalEstablished != null
    || certifiedValuationEstablished != null
  ) {
    fail('CALLER_PRODUCTION_QUALIFICATION_AUTHORITY_OVERRIDE_NOT_ALLOWED');
  }
}

function statusOf(value) {
  return value && typeof value === 'object' && nonEmptyString(value.status)
    ? value.status.trim()
    : null;
}

function normalizeEvidenceRefs(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return freeze({
    productionReadinessRef: nonEmptyString(input.productionReadinessRef) ? input.productionReadinessRef.trim() : null,
    independentReleaseQualificationRef: nonEmptyString(input.independentReleaseQualificationRef) ? input.independentReleaseQualificationRef.trim() : null,
    institutionalGoLiveRef: nonEmptyString(input.institutionalGoLiveRef) ? input.institutionalGoLiveRef.trim() : null,
  });
}

function productionReadinessReady(audit) {
  return Boolean(
    audit
    && typeof audit === 'object'
    && audit.status === PRODUCTION_READINESS_STATUS.READY_FOR_PRODUCTION_REVIEW
    && audit.readyForHumanProductionReview === true
    && audit.productionDeploymentAuthorized === false
    && audit.productionSecurityCertified === false
    && audit.legalApprovalEstablished === false
    && audit.humanApprovalRequired === true
    && audit.transactionAuthorized === false
  );
}

function independentReleaseState(qualification) {
  if (!qualification || typeof qualification !== 'object' || Array.isArray(qualification)) {
    return freeze({ ready: false, integrityValid: false, integrityReasonCode: 'QUALIFICATION_OBJECT_REQUIRED' });
  }

  const integrity = verifyIndependentReleaseQualification(qualification);
  const ready = Boolean(
    integrity.valid === true
    && qualification.status === RELEASE_QUALIFICATION_STATUS.READY_FOR_RELEASE_AUTHORITY_REVIEW
    && qualification.independentEngineeringReviewRecorded === true
    && qualification.humanReleaseAuthorityApprovalRequired === true
    && qualification.releaseAuthorized === false
    && qualification.mergeAuthorized === false
    && qualification.deploymentAuthorized === false
    && qualification.transactionAuthorized === false
  );

  return freeze({
    ready,
    integrityValid: integrity.valid === true,
    integrityReasonCode: integrity.reasonCode || null,
  });
}

function institutionalGoLiveReady(gate) {
  return Boolean(
    gate
    && typeof gate === 'object'
    && gate.status === INSTITUTIONAL_GO_LIVE_STATUS.READY_FOR_HUMAN_GO_LIVE_DECISION
    && gate.readyForHumanGoLiveDecision === true
    && gate.goLiveAuthorized === false
    && gate.productionDeploymentAuthorized === false
    && gate.productionSecurityCertified === false
    && gate.legalApprovalEstablished === false
    && gate.certifiedValuationEstablished === false
    && gate.humanApprovalRequired === true
    && gate.transactionAuthorized === false
  );
}

function buildResult({
  status,
  reasonCodes,
  productionReadinessAudit,
  independentReleaseQualification,
  institutionalGoLiveGate,
  evidenceRefs,
  independentReleaseIntegrity,
}) {
  const ready = status === PRODUCTION_QUALIFICATION_STATUS.READY_FOR_EXISTING_RELEASE_GOVERNANCE_REVIEW;
  return freeze({
    status,
    reasonCodes: [...reasonCodes],
    gates: {
      productionReadiness: {
        status: statusOf(productionReadinessAudit),
        ready: productionReadinessReady(productionReadinessAudit),
      },
      independentReleaseQualification: {
        status: statusOf(independentReleaseQualification),
        ready: independentReleaseIntegrity.ready,
        integrityValid: independentReleaseIntegrity.integrityValid,
        integrityReasonCode: independentReleaseIntegrity.integrityReasonCode,
      },
      institutionalGoLiveReview: {
        status: statusOf(institutionalGoLiveGate),
        ready: institutionalGoLiveReady(institutionalGoLiveGate),
      },
    },
    evidenceRefs,
    releaseGovernanceReviewEligible: ready,
    humanReleaseAuthorityApprovalRequired: true,
    nextStep: ready
      ? NEXT_STEP.EXISTING_RELEASE_GOVERNANCE_REVIEW
      : NEXT_STEP.COMPLETE_EXTERNAL_QUALIFICATION_EVIDENCE,
    evidenceBoundary: {
      productionEvidenceValidatedByThisService: false,
      productionReadinessProvenanceVerifiedByThisService: false,
      independentReleaseIntegrityVerified: independentReleaseIntegrity.integrityValid,
      institutionalEvidenceProvenanceVerifiedByThisService: false,
      productionAuthenticationValidated: false,
      productionPersistenceValidated: false,
      externalEvidenceRequired: true,
    },
    authority: {
      releaseAuthorized: false,
      mergeAuthorized: false,
      deploymentAuthorized: false,
      goLiveAuthorized: false,
      transactionAuthorized: false,
      productionAuthenticationValidated: false,
      productionPersistenceValidated: false,
      productionSecurityValidated: false,
      productionPerformanceValidated: false,
      legalApprovalEstablished: false,
      certifiedValuationEstablished: false,
    },
    semantics: ready
      ? 'READY_FOR_EXISTING_RELEASE_GOVERNANCE_REVIEW means the supplied canonical readiness, independent release qualification, and institutional go-live review outputs satisfy this deterministic composition boundary and have explicit evidence references. It authorizes only entry into the existing human release-governance review. It does not establish production evidence provenance, production authentication or persistence, security/performance validation, legal approval, certified valuation authority, release, merge, deployment, go-live, or transaction authority.'
      : 'HOLD means one or more prerequisite canonical qualification outputs, integrity checks, or evidence references are incomplete. This service does not create or substitute external production evidence and does not authorize release, merge, deployment, go-live, or transactions.',
  });
}

/**
 * Composes existing canonical qualification outputs into a single productization
 * handoff. Domain evidence is evaluated by the existing readiness/qualification
 * modules; this service deliberately does not duplicate those rules or treat a
 * caller-supplied object as proof that an external production control exists.
 */
function evaluateProductionQualification({
  productionReadinessAudit,
  independentReleaseQualification,
  institutionalGoLiveGate,
  evidenceRefs,
  releaseAuthorized,
  mergeAuthorized,
  deploymentAuthorized,
  goLiveAuthorized,
  transactionAuthorized,
  productionAuthenticationValidated,
  productionPersistenceValidated,
  productionSecurityValidated,
  productionPerformanceValidated,
  legalApprovalEstablished,
  certifiedValuationEstablished,
} = {}) {
  assertNoCallerAuthorityOverride({
    releaseAuthorized,
    mergeAuthorized,
    deploymentAuthorized,
    goLiveAuthorized,
    transactionAuthorized,
    productionAuthenticationValidated,
    productionPersistenceValidated,
    productionSecurityValidated,
    productionPerformanceValidated,
    legalApprovalEstablished,
    certifiedValuationEstablished,
  });

  const refs = normalizeEvidenceRefs(evidenceRefs);
  const releaseState = independentReleaseState(independentReleaseQualification);
  const reasons = [];

  let status = PRODUCTION_QUALIFICATION_STATUS.READY_FOR_EXISTING_RELEASE_GOVERNANCE_REVIEW;

  if (!productionReadinessReady(productionReadinessAudit)) {
    status = PRODUCTION_QUALIFICATION_STATUS.HOLD_PRODUCTION_READINESS;
    reasons.push(`PRODUCTION_READINESS_${statusOf(productionReadinessAudit) || 'MISSING_OR_INVALID'}`);
  } else if (!releaseState.integrityValid) {
    status = PRODUCTION_QUALIFICATION_STATUS.HOLD_EVIDENCE_INTEGRITY;
    reasons.push(`INDEPENDENT_RELEASE_${releaseState.integrityReasonCode || 'INTEGRITY_INVALID'}`);
  } else if (!releaseState.ready) {
    status = PRODUCTION_QUALIFICATION_STATUS.HOLD_INDEPENDENT_RELEASE_QUALIFICATION;
    reasons.push(`INDEPENDENT_RELEASE_${statusOf(independentReleaseQualification) || 'MISSING_OR_INVALID'}`);
  } else if (!institutionalGoLiveReady(institutionalGoLiveGate)) {
    status = PRODUCTION_QUALIFICATION_STATUS.HOLD_INSTITUTIONAL_GO_LIVE_REVIEW;
    reasons.push(`INSTITUTIONAL_GO_LIVE_${statusOf(institutionalGoLiveGate) || 'MISSING_OR_INVALID'}`);
  } else if (Object.values(refs).some((ref) => ref === null)) {
    status = PRODUCTION_QUALIFICATION_STATUS.HOLD_EVIDENCE_REFERENCES;
    reasons.push('CANONICAL_QUALIFICATION_EVIDENCE_REFERENCES_REQUIRED');
  }

  return buildResult({
    status,
    reasonCodes: reasons,
    productionReadinessAudit,
    independentReleaseQualification,
    institutionalGoLiveGate,
    evidenceRefs: refs,
    independentReleaseIntegrity: releaseState,
  });
}

module.exports = {
  PRODUCTION_QUALIFICATION_STATUS,
  NEXT_STEP,
  normalizeEvidenceRefs,
  evaluateProductionQualification,
};
