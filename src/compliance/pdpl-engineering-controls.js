'use strict';

const PDPL_ENGINEERING_STATUS = Object.freeze({
  ENGINEERING_CONTROLS_PRESENT: 'ENGINEERING_CONTROLS_PRESENT',
  HOLD_MISSING_ENGINEERING_CONTROLS: 'HOLD_MISSING_ENGINEERING_CONTROLS',
  HOLD_CROSS_BORDER_REVIEW: 'HOLD_CROSS_BORDER_REVIEW',
});

const REQUIRED_CONTROL_KEYS = Object.freeze([
  'tenantIsolation',
  'leastPrivilege',
  'retentionPolicyDefined',
  'deletionSupported',
  'sensitiveDataRedaction',
  'auditLogging',
  'encryptionAtRest',
  'encryptionInTransit',
  'controllerProcessorRoleRecorded',
  'purposeBound',
  'dataMinimized',
]);

function evaluatePdplEngineeringControls({
  controls = {},
  evidenceRefs = {},
  crossBorderTransfer = false,
  crossBorderReviewEvidenceRef = null,
} = {}) {
  const missingControls = REQUIRED_CONTROL_KEYS.filter((key) => controls?.[key] !== true);
  const missingEvidence = REQUIRED_CONTROL_KEYS.filter((key) => typeof evidenceRefs?.[key] !== 'string' || evidenceRefs[key].trim() === '');

  const base = {
    schemaVersion: 1,
    framework: 'SAUDI_PDPL_ENGINEERING_BOUNDARY',
    requiredControls: REQUIRED_CONTROL_KEYS,
    controls: Object.freeze({ ...controls }),
    evidenceRefs: Object.freeze({ ...evidenceRefs }),
    crossBorderTransfer: Boolean(crossBorderTransfer),
    legalComplianceEstablished: false,
    legalApprovalEstablished: false,
    humanLegalReviewRequired: true,
    transactionAuthorized: false,
  };

  if (missingControls.length || missingEvidence.length) {
    return Object.freeze({
      ...base,
      status: PDPL_ENGINEERING_STATUS.HOLD_MISSING_ENGINEERING_CONTROLS,
      missingControls: Object.freeze(missingControls),
      missingEvidence: Object.freeze(missingEvidence),
      reasons: Object.freeze(['PDPL_ENGINEERING_EVIDENCE_INCOMPLETE']),
      readyForEngineeringReleaseGate: false,
    });
  }

  if (crossBorderTransfer && (typeof crossBorderReviewEvidenceRef !== 'string' || crossBorderReviewEvidenceRef.trim() === '')) {
    return Object.freeze({
      ...base,
      status: PDPL_ENGINEERING_STATUS.HOLD_CROSS_BORDER_REVIEW,
      missingControls: Object.freeze([]),
      missingEvidence: Object.freeze(['crossBorderReviewEvidenceRef']),
      reasons: Object.freeze(['CROSS_BORDER_TRANSFER_REQUIRES_REVIEW_EVIDENCE']),
      readyForEngineeringReleaseGate: false,
    });
  }

  return Object.freeze({
    ...base,
    status: PDPL_ENGINEERING_STATUS.ENGINEERING_CONTROLS_PRESENT,
    missingControls: Object.freeze([]),
    missingEvidence: Object.freeze([]),
    crossBorderReviewEvidenceRef: crossBorderTransfer ? crossBorderReviewEvidenceRef.trim() : null,
    reasons: Object.freeze([]),
    readyForEngineeringReleaseGate: true,
    semantics: 'PASS means the enumerated engineering controls and evidence references are present. It does not establish Saudi PDPL legal compliance, controller/processor legal classification, or cross-border transfer lawfulness.',
  });
}

module.exports = {
  PDPL_ENGINEERING_STATUS,
  REQUIRED_CONTROL_KEYS,
  evaluatePdplEngineeringControls,
};
