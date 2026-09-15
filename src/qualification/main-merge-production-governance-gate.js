'use strict';

const { sha256 } = require('../standards/standards-registry');
const {
  E2G_STATUS,
  normalizeReleaseAuthorityRegistry,
  createHumanReleaseAuthorityDecisionPacket,
} = require('../standards/human-release-authority-deployment-decision');
const {
  E2F_STATUS,
  createExternalConformanceProductionValidationPacket,
  verifyExternalConformanceProductionValidationPacketIntegrity,
} = require('../standards/external-conformance-production-validation');
const {
  verifyRuleImplementationConformanceEvidencePacketIntegrity,
} = require('../standards/rule-implementation-conformance-evidence');
const {
  verifyE2fDerivedStateIntegrity,
  verifyE2gDerivedStateIntegrity,
} = require('./production-stage-derived-state-integrity');
const {
  verifyStageTopLevelContract,
} = require('./production-packet-top-level-contract');

const STATUS = Object.freeze({
  HOLD_MAIN_MERGE_GOVERNANCE: 'HOLD_MAIN_MERGE_GOVERNANCE',
  MAIN_MERGE_GOVERNANCE_VERIFIED_PENDING_GITHUB_MERGE: 'MAIN_MERGE_GOVERNANCE_VERIFIED_PENDING_GITHUB_MERGE',
});

const AUTHORITY = Object.freeze({
  releaseAuthorizedByGate: false,
  mergeAuthorizedByGate: false,
  deploymentAuthorizedByGate: false,
  mergeExecutedByGate: false,
  deploymentExecutedByGate: false,
  goLiveAuthorizedByGate: false,
  transactionAuthorizedByGate: false,
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function digest(value, field) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new TypeError(`${field} must be a SHA-256 hex digest`);
  }
  return value.toLowerCase();
}

function commitSha(value, field) {
  if (typeof value !== 'string' || !/^[a-f0-9]{40}$/i.test(value)) {
    throw new TypeError(`${field} must be a 40-character commit SHA`);
  }
  return value.toLowerCase();
}

function hold(blockers, observed = {}) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_MAIN_MERGE_GOVERNANCE,
    verified: false,
    blockers: Object.freeze([...blockers]),
    observed: deepFreeze({ ...observed }),
    githubMergeStillRequired: true,
    productionDeploymentStillSeparate: true,
    e2hExecutionEvidenceStillRequiredAfterDeployment: true,
    e2iExternalReadinessEvidenceStillRequiredAfterDeployment: true,
    authority: AUTHORITY,
  });
}

function stableEqual(left, right) {
  return sha256(left) === sha256(right);
}

function evaluateMainMergeProductionGovernance({
  e2eEvidencePacket,
  expectedE2eEvidencePacketHashSha256,
  e2fValidationPacket,
  expectedE2fValidationPacketHashSha256,
  trustedE2fVerifierRegistry,
  expectedE2fVerifierRegistryHashSha256,
  e2fPolicy,
  e2gDecisionPacket,
  expectedE2gDecisionPacketHashSha256,
  releaseAuthorityRegistry,
  expectedReleaseAuthorityRegistryHashSha256,
  e2gPolicy,
  expectedReleaseSourceCommitSha,
} = {}) {
  const blockers = [];
  const observed = {};

  let e2ePin;
  let e2fPin;
  let e2fRegistryPin;
  let e2gPin;
  let authorityRegistryPin;
  let expectedCommit;
  try {
    e2ePin = digest(expectedE2eEvidencePacketHashSha256, 'expectedE2eEvidencePacketHashSha256');
    e2fPin = digest(expectedE2fValidationPacketHashSha256, 'expectedE2fValidationPacketHashSha256');
    e2fRegistryPin = digest(expectedE2fVerifierRegistryHashSha256, 'expectedE2fVerifierRegistryHashSha256');
    e2gPin = digest(expectedE2gDecisionPacketHashSha256, 'expectedE2gDecisionPacketHashSha256');
    authorityRegistryPin = digest(expectedReleaseAuthorityRegistryHashSha256, 'expectedReleaseAuthorityRegistryHashSha256');
    expectedCommit = commitSha(expectedReleaseSourceCommitSha, 'expectedReleaseSourceCommitSha');
  } catch (error) {
    return hold([error.message]);
  }

  if (!e2eEvidencePacket || typeof e2eEvidencePacket !== 'object') {
    blockers.push('E2E_EVIDENCE_PACKET_REQUIRED');
  } else {
    observed.e2eEvidencePacketHashSha256 = e2eEvidencePacket.evidencePacketHashSha256 || null;
    if (!verifyRuleImplementationConformanceEvidencePacketIntegrity(e2eEvidencePacket)) blockers.push('E2E_PACKET_INTEGRITY_INVALID');
    if (String(e2eEvidencePacket.evidencePacketHashSha256 || '').toLowerCase() !== e2ePin) blockers.push('E2E_PACKET_PIN_MISMATCH');
  }

  if (!e2fValidationPacket || typeof e2fValidationPacket !== 'object') {
    blockers.push('E2F_VALIDATION_PACKET_REQUIRED');
  } else {
    observed.e2fValidationPacketHashSha256 = e2fValidationPacket.validationPacketHashSha256 || null;
    observed.e2fVerifierRegistryHashSha256 = e2fValidationPacket.trustedVerifierRegistryHashSha256 || null;
    if (!verifyStageTopLevelContract('E2F', e2fValidationPacket)) blockers.push('E2F_TOP_LEVEL_CONTRACT_INVALID');
    if (!verifyExternalConformanceProductionValidationPacketIntegrity(e2fValidationPacket)) blockers.push('E2F_PACKET_INTEGRITY_INVALID');
    if (!verifyE2fDerivedStateIntegrity(e2fValidationPacket)) blockers.push('E2F_DERIVED_STATE_INTEGRITY_INVALID');
    if (String(e2fValidationPacket.validationPacketHashSha256 || '').toLowerCase() !== e2fPin) blockers.push('E2F_PACKET_PIN_MISMATCH');
    if (String(e2fValidationPacket.trustedVerifierRegistryHashSha256 || '').toLowerCase() !== e2fRegistryPin) blockers.push('E2F_VERIFIER_REGISTRY_PIN_MISMATCH');
    if (e2fValidationPacket.status !== E2F_STATUS.EXTERNAL_CONFORMANCE_AND_PRODUCTION_VALIDATION_COMPLETE_PENDING_RELEASE_AUTHORITY
      || e2fValidationPacket.productionValidationComplete !== true) {
      blockers.push('E2F_PRODUCTION_VALIDATION_NOT_COMPLETE');
    }
    if (String(e2fValidationPacket.releaseCandidate?.sourceCommitSha || '').toLowerCase() !== expectedCommit) {
      blockers.push('E2F_RELEASE_SOURCE_COMMIT_MISMATCH');
    }
    if (e2eEvidencePacket && (e2fValidationPacket.upstreamEvidencePacketId !== e2eEvidencePacket.evidencePacketId
      || e2fValidationPacket.upstreamEvidencePacketHashSha256 !== e2eEvidencePacket.evidencePacketHashSha256
      || e2fValidationPacket.releaseCandidate?.upstreamEvidencePacketHashSha256 !== e2eEvidencePacket.evidencePacketHashSha256)) {
      blockers.push('E2F_UPSTREAM_E2E_BINDING_MISMATCH');
    }
  }

  let normalizedRegistry = null;
  try {
    normalizedRegistry = normalizeReleaseAuthorityRegistry(releaseAuthorityRegistry);
    observed.releaseAuthorityRegistryHashSha256 = normalizedRegistry.registryHashSha256;
    if (normalizedRegistry.registryHashSha256 !== authorityRegistryPin) blockers.push('E2G_RELEASE_AUTHORITY_REGISTRY_PIN_MISMATCH');
  } catch (error) {
    blockers.push(`E2G_RELEASE_AUTHORITY_REGISTRY_INVALID:${error.message}`);
  }

  if (!e2gDecisionPacket || typeof e2gDecisionPacket !== 'object') {
    blockers.push('E2G_DECISION_PACKET_REQUIRED');
  } else {
    observed.e2gDecisionPacketHashSha256 = e2gDecisionPacket.decisionPacketHashSha256 || null;
    if (!verifyStageTopLevelContract('E2G', e2gDecisionPacket)) blockers.push('E2G_TOP_LEVEL_CONTRACT_INVALID');
    if (!verifyE2gDerivedStateIntegrity(e2gDecisionPacket)) blockers.push('E2G_DERIVED_STATE_INTEGRITY_INVALID');
    if (String(e2gDecisionPacket.decisionPacketHashSha256 || '').toLowerCase() !== e2gPin) blockers.push('E2G_PACKET_PIN_MISMATCH');
    if (String(e2gDecisionPacket.releaseCandidate?.sourceCommitSha || '').toLowerCase() !== expectedCommit) blockers.push('E2G_RELEASE_SOURCE_COMMIT_MISMATCH');
    if (e2fValidationPacket && (e2gDecisionPacket.upstreamValidationPacketId !== e2fValidationPacket.validationPacketId
      || e2gDecisionPacket.upstreamValidationPacketHashSha256 !== e2fValidationPacket.validationPacketHashSha256)) {
      blockers.push('E2G_UPSTREAM_E2F_BINDING_MISMATCH');
    }
  }

  if (blockers.length > 0) return hold(blockers, observed);

  let rebuiltE2f;
  try {
    rebuiltE2f = createExternalConformanceProductionValidationPacket({
      validationPacketId: e2fValidationPacket.validationPacketId,
      upstreamEvidencePacket: e2eEvidencePacket,
      policy: e2fPolicy,
      releaseCandidate: e2fValidationPacket.releaseCandidate,
      trustedVerifierRegistry: trustedE2fVerifierRegistry,
      expectedTrustedRegistryHashSha256: e2fRegistryPin,
      validations: e2fValidationPacket.validations,
      preparedByRef: e2fValidationPacket.preparedByRef,
      preparedAt: e2fValidationPacket.preparedAt,
    });
  } catch (error) {
    return hold([`E2F_CRYPTOGRAPHIC_REBUILD_FAILED:${error.message}`], observed);
  }

  observed.rebuiltE2fStatus = rebuiltE2f.status || null;
  if (rebuiltE2f.status !== E2F_STATUS.EXTERNAL_CONFORMANCE_AND_PRODUCTION_VALIDATION_COMPLETE_PENDING_RELEASE_AUTHORITY
    || rebuiltE2f.productionValidationComplete !== true
    || rebuiltE2f.externalConformanceEvidenceAuthenticityValidated !== true
    || rebuiltE2f.productionSecurityValidated !== true
    || rebuiltE2f.productionPerformanceValidated !== true
    || rebuiltE2f.productionResilienceValidated !== true) {
    return hold(['E2F_CRYPTOGRAPHIC_VALIDATION_NOT_COMPLETE'], observed);
  }
  if (rebuiltE2f.validationPacketHashSha256 !== e2fPin) {
    return hold(['E2F_REBUILT_PACKET_HASH_MISMATCH'], observed);
  }
  if (!stableEqual(rebuiltE2f, e2fValidationPacket)) {
    return hold(['E2F_SUPPLIED_PACKET_DIFFERS_FROM_CRYPTOGRAPHIC_REBUILD'], observed);
  }

  let rebuiltE2g;
  try {
    rebuiltE2g = createHumanReleaseAuthorityDecisionPacket({
      decisionPacketId: e2gDecisionPacket.decisionPacketId,
      upstreamValidationPacket: rebuiltE2f,
      policy: e2gPolicy,
      releaseAuthorityRegistry,
      expectedReleaseAuthorityRegistryHashSha256: authorityRegistryPin,
      decisions: e2gDecisionPacket.decisions,
      preparedByRef: e2gDecisionPacket.preparedByRef,
      preparedAt: e2gDecisionPacket.preparedAt,
    });
  } catch (error) {
    return hold([`E2G_CRYPTOGRAPHIC_REBUILD_FAILED:${error.message}`], observed);
  }

  if (rebuiltE2g.status !== E2G_STATUS.HUMAN_RELEASE_DECISIONS_COMPLETE_PENDING_EXECUTION
    || rebuiltE2g.releaseAuthorized !== true
    || rebuiltE2g.mergeAuthorized !== true
    || rebuiltE2g.deploymentAuthorized !== true) {
    return hold(['E2G_HUMAN_RELEASE_DECISIONS_NOT_COMPLETE'], observed);
  }
  if (rebuiltE2g.decisionPacketHashSha256 !== e2gPin) {
    return hold(['E2G_REBUILT_PACKET_HASH_MISMATCH'], observed);
  }
  if (!stableEqual(rebuiltE2g, e2gDecisionPacket)) {
    return hold(['E2G_SUPPLIED_PACKET_DIFFERS_FROM_CRYPTOGRAPHIC_REBUILD'], observed);
  }

  observed.releaseCandidateId = rebuiltE2g.releaseCandidate.releaseCandidateId;
  observed.sourceCommitSha = rebuiltE2g.releaseCandidate.sourceCommitSha;
  observed.artifactSha256 = rebuiltE2g.releaseCandidate.artifactSha256;
  observed.environmentRef = rebuiltE2g.releaseCandidate.environmentRef;
  observed.environmentConfigSha256 = rebuiltE2g.releaseCandidate.environmentConfigSha256;
  observed.releaseAuthorized = true;
  observed.mergeAuthorized = true;
  observed.deploymentAuthorized = true;

  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.MAIN_MERGE_GOVERNANCE_VERIFIED_PENDING_GITHUB_MERGE,
    verified: true,
    blockers: Object.freeze([]),
    observed: deepFreeze(observed),
    githubMergeStillRequired: true,
    productionDeploymentStillSeparate: true,
    e2hExecutionEvidenceStillRequiredAfterDeployment: true,
    e2iExternalReadinessEvidenceStillRequiredAfterDeployment: true,
    authority: AUTHORITY,
    semantics: 'This gate independently verifies the exact upstream E2E packet pin, cryptographically rebuilds E2F from the full externally governed verifier registry and RSA-SHA256 validation signatures, then cryptographically rebuilds E2G from the full release-authority registry and separate valid human RELEASE, MERGE and DEPLOYMENT approvals, all bound to the exact pull-request source commit. It does not itself merge, deploy, activate production, establish professional authority, authorize transactions, or establish go-live readiness.',
  });
}

module.exports = {
  STATUS,
  AUTHORITY,
  digest,
  commitSha,
  stableEqual,
  evaluateMainMergeProductionGovernance,
};
