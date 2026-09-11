'use strict';

const {
  E2F_STATUS,
  VALIDATION_TYPE,
  VALIDATION_RESULT,
} = require('../standards/external-conformance-production-validation');
const {
  E2G_STATUS,
  DECISION_TYPE,
  DECISION_RESULT,
} = require('../standards/human-release-authority-deployment-decision');
const {
  E2H_STATUS,
  ATTESTATION_TYPE,
  ATTESTATION_RESULT,
} = require('../standards/execution-attestation-post-deployment-closeout');
const {
  E2I_STATUS,
  EVIDENCE_TYPE,
  EVIDENCE_RESULT,
} = require('../standards/production-evidence-go-live-readiness');

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function emptyBlockers(packet) {
  return Array.isArray(packet?.blockers) && packet.blockers.length === 0;
}

function allFalse(packet, fields) {
  return fields.every((field) => packet?.[field] === false);
}

function uniqueBy(records, field) {
  if (!Array.isArray(records)) return false;
  const values = records.map((record) => record?.[field]);
  return values.every((value) => typeof value === 'string' && value.length > 0)
    && new Set(values).size === values.length;
}

function sameStringSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  const a = [...left].sort();
  const b = [...right].sort();
  return a.every((value, index) => value === b[index]);
}

function hasResult(records, typeField, type, result) {
  return Array.isArray(records) && records.some((record) => record?.[typeField] === type && record?.result === result);
}

function verifyE2fDerivedStateIntegrity(packet) {
  if (!isObject(packet) || !Array.isArray(packet.validations) || !emptyBlockers(packet)) return false;
  if (!uniqueBy(packet.validations, 'validationId') || !uniqueBy(packet.validations, 'validationType')) return false;
  if (packet.validations.some((record) => record?.result === VALIDATION_RESULT.REJECTED)) return false;

  const external = hasResult(packet.validations, 'validationType', VALIDATION_TYPE.EXTERNAL_CONFORMANCE_AUTHENTICITY, VALIDATION_RESULT.VERIFIED);
  const security = hasResult(packet.validations, 'validationType', VALIDATION_TYPE.PRODUCTION_SECURITY_VALIDATION, VALIDATION_RESULT.VERIFIED);
  const performance = hasResult(packet.validations, 'validationType', VALIDATION_TYPE.PRODUCTION_PERFORMANCE_VALIDATION, VALIDATION_RESULT.VERIFIED);
  const resilience = hasResult(packet.validations, 'validationType', VALIDATION_TYPE.PRODUCTION_RESILIENCE_VALIDATION, VALIDATION_RESULT.VERIFIED);
  const complete = external && security && performance && resilience;
  const expectedStatus = !external
    ? E2F_STATUS.WAITING_FOR_EXTERNAL_CONFORMANCE_VALIDATION
    : !security
      ? E2F_STATUS.WAITING_FOR_PRODUCTION_SECURITY_VALIDATION
      : !performance
        ? E2F_STATUS.WAITING_FOR_PRODUCTION_PERFORMANCE_VALIDATION
        : !resilience
          ? E2F_STATUS.WAITING_FOR_PRODUCTION_RESILIENCE_VALIDATION
          : E2F_STATUS.EXTERNAL_CONFORMANCE_AND_PRODUCTION_VALIDATION_COMPLETE_PENDING_RELEASE_AUTHORITY;

  return packet.status === expectedStatus
    && packet.externalConformanceEvidenceAuthenticityValidated === external
    && packet.productionSecurityValidated === security
    && packet.productionPerformanceValidated === performance
    && packet.productionResilienceValidated === resilience
    && packet.productionValidationComplete === complete
    && packet.humanReleaseAuthorityRequired === true
    && allFalse(packet, [
      'formalStandardsConformanceEstablished',
      'standardsOrRulesActivated',
      'saudiProfessionalLicensingEstablished',
      'certifiedValuationAuthorityEstablished',
      'externalIssuanceAuthorized',
      'releaseAuthorized',
      'mergeAuthorized',
      'deploymentAuthorized',
      'transactionAuthorized',
    ]);
}

function verifyE2gDerivedStateIntegrity(packet) {
  if (!isObject(packet) || !Array.isArray(packet.decisions) || !emptyBlockers(packet)) return false;
  if (!uniqueBy(packet.decisions, 'decisionId') || !uniqueBy(packet.decisions, 'decisionType')) return false;
  if (packet.decisions.some((record) => record?.result !== DECISION_RESULT.APPROVE)) return false;

  const releaseApproved = hasResult(packet.decisions, 'decisionType', DECISION_TYPE.RELEASE_APPROVAL, DECISION_RESULT.APPROVE);
  const mergeApproved = releaseApproved && hasResult(packet.decisions, 'decisionType', DECISION_TYPE.MERGE_APPROVAL, DECISION_RESULT.APPROVE);
  const deploymentApproved = mergeApproved && hasResult(packet.decisions, 'decisionType', DECISION_TYPE.DEPLOYMENT_APPROVAL, DECISION_RESULT.APPROVE);
  const expectedStatus = !releaseApproved
    ? E2G_STATUS.WAITING_FOR_RELEASE_APPROVAL
    : !mergeApproved
      ? E2G_STATUS.WAITING_FOR_MERGE_APPROVAL
      : !deploymentApproved
        ? E2G_STATUS.WAITING_FOR_DEPLOYMENT_APPROVAL
        : E2G_STATUS.HUMAN_RELEASE_DECISIONS_COMPLETE_PENDING_EXECUTION;

  return packet.status === expectedStatus
    && packet.releaseAuthorized === releaseApproved
    && packet.mergeAuthorized === mergeApproved
    && packet.deploymentAuthorized === deploymentApproved
    && packet.mergeExecuted === false
    && packet.deploymentExecuted === false
    && packet.postDecisionExecutionAttestationRequired === true
    && allFalse(packet, [
      'formalStandardsConformanceEstablished',
      'standardsOrRulesActivated',
      'saudiProfessionalLicensingEstablished',
      'certifiedValuationAuthorityEstablished',
      'externalIssuanceAuthorized',
      'transactionAuthorized',
    ]);
}

function verifyE2hDerivedStateIntegrity(packet) {
  if (!isObject(packet) || !Array.isArray(packet.attestations) || !emptyBlockers(packet)) return false;
  if (!uniqueBy(packet.attestations, 'attestationId') || !uniqueBy(packet.attestations, 'attestationType')) return false;
  if (packet.attestations.some((record) => record?.result === ATTESTATION_RESULT.REJECTED)) return false;

  const mergeAtt = packet.attestations.find((record) => record?.attestationType === ATTESTATION_TYPE.MERGE_EXECUTION_ATTESTATION) || null;
  const deployAtt = packet.attestations.find((record) => record?.attestationType === ATTESTATION_TYPE.DEPLOYMENT_EXECUTION_ATTESTATION) || null;
  const smokeAtt = packet.attestations.find((record) => record?.attestationType === ATTESTATION_TYPE.POST_DEPLOYMENT_SMOKE_VALIDATION) || null;
  const rollbackAtt = packet.attestations.find((record) => record?.attestationType === ATTESTATION_TYPE.ROLLBACK_READINESS_VALIDATION) || null;

  const mergeExecuted = mergeAtt?.result === ATTESTATION_RESULT.VERIFIED;
  const deploymentExecuted = mergeExecuted && deployAtt?.result === ATTESTATION_RESULT.VERIFIED;
  const smokePassed = deploymentExecuted && smokeAtt?.result === ATTESTATION_RESULT.VERIFIED;
  const rollbackReady = deploymentExecuted && rollbackAtt?.result === ATTESTATION_RESULT.VERIFIED;
  const complete = mergeExecuted && deploymentExecuted && smokePassed && rollbackReady;

  if (deployAtt?.result === ATTESTATION_RESULT.VERIFIED) {
    if (!mergeExecuted) return false;
    if (deployAtt.resultingMergeCommitSha !== mergeAtt.resultingMergeCommitSha) return false;
  }
  if (smokeAtt?.result === ATTESTATION_RESULT.VERIFIED) {
    if (!deploymentExecuted || smokeAtt.deploymentId !== deployAtt.deploymentId) return false;
  }
  if (rollbackAtt?.result === ATTESTATION_RESULT.VERIFIED) {
    if (!deploymentExecuted || rollbackAtt.deploymentId !== deployAtt.deploymentId) return false;
  }

  const expectedStatus = !mergeExecuted
    ? E2H_STATUS.WAITING_FOR_MERGE_EXECUTION
    : !deploymentExecuted
      ? E2H_STATUS.WAITING_FOR_DEPLOYMENT_EXECUTION
      : !smokePassed
        ? E2H_STATUS.WAITING_FOR_POST_DEPLOYMENT_SMOKE
        : !rollbackReady
          ? E2H_STATUS.WAITING_FOR_ROLLBACK_READINESS
          : E2H_STATUS.EXECUTION_AND_POST_DEPLOYMENT_CLOSEOUT_COMPLETE;

  return packet.status === expectedStatus
    && packet.releaseAuthorized === true
    && packet.mergeAuthorized === true
    && packet.deploymentAuthorized === true
    && packet.mergeExecuted === mergeExecuted
    && packet.deploymentExecuted === deploymentExecuted
    && packet.postDeploymentSmokePassed === smokePassed
    && packet.rollbackReadinessValidated === rollbackReady
    && packet.executionCloseoutComplete === complete
    && allFalse(packet, [
      'formalStandardsConformanceEstablished',
      'standardsOrRulesActivated',
      'saudiProfessionalLicensingEstablished',
      'certifiedValuationAuthorityEstablished',
      'externalIssuanceAuthorized',
      'transactionAuthorized',
    ]);
}

function verifyE2iDerivedStateIntegrity(packet) {
  if (!isObject(packet) || !Array.isArray(packet.readinessEvidence) || !emptyBlockers(packet)) return false;
  if (!uniqueBy(packet.readinessEvidence, 'evidenceId') || !uniqueBy(packet.readinessEvidence, 'evidenceType')) return false;
  if (packet.readinessEvidence.some((record) => record?.result === EVIDENCE_RESULT.REJECTED)) return false;

  const requiredTypes = Object.values(EVIDENCE_TYPE);
  const verifiedTypes = new Set(
    packet.readinessEvidence
      .filter((record) => record?.result === EVIDENCE_RESULT.VERIFIED)
      .map((record) => record.evidenceType),
  );
  const missing = requiredTypes.filter((type) => !verifiedTypes.has(type));
  const goLiveReady = missing.length === 0;
  const expectedStatus = goLiveReady
    ? E2I_STATUS.GO_LIVE_READY_FOR_UNLICENSED_DECISION_SUPPORT
    : E2I_STATUS.WAITING_FOR_PRODUCTION_READINESS_EVIDENCE;

  return packet.status === expectedStatus
    && packet.goLiveReady === goLiveReady
    && sameStringSet(packet.missingEvidenceTypes, missing)
    && packet.goLiveOperatingMode === 'UNLICENSED_DECISION_SUPPORT'
    && packet.noFurtherInternalGateCanSubstituteForExternalEvidence === true
    && packet.architecturalStop === true
    && allFalse(packet, [
      'formalStandardsConformanceEstablished',
      'standardsOrRulesActivated',
      'saudiProfessionalLicensingEstablished',
      'certifiedValuationAuthorityEstablished',
      'externalProfessionalValuationIssuanceAuthorized',
      'transactionAuthorized',
    ]);
}

module.exports = {
  verifyE2fDerivedStateIntegrity,
  verifyE2gDerivedStateIntegrity,
  verifyE2hDerivedStateIntegrity,
  verifyE2iDerivedStateIntegrity,
};
