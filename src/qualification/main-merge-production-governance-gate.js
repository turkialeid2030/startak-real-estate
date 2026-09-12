'use strict';

const { sha256 } = require('../standards/standards-registry');
const {
  E2G_STATUS,
  normalizeReleaseAuthorityRegistry,
  createHumanReleaseAuthorityDecisionPacket,
} = require('../standards/human-release-authority-deployment-decision');
const {
  E2F_STATUS,
  verifyExternalConformanceProductionValidationPacketIntegrity,
} = require('../standards/external-conformance-production-validation');
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
  e2fValidationPacket,
  expectedE2fValidationPacketHashSha256,
  expectedE2fVerifierRegistryHashSha256,
  e2gDecisionPacket,
  expectedE2gDecisionPacketHashSha256,
  releaseAuthorityRegistry,
  expectedReleaseAuthorityRegistryHashSha256,
  e2gPolicy,
  expectedReleaseSourceCommitSha,
} = {}) {
  const blockers = [];
  const observed = {};

  let e2fPin;
  let e2fRegistryPin;
  let e2gPin;
  let authorityRegistryPin;
  let expectedCommit;
  try {
    e2fPin = digest(expectedE2fValidationPacketHashSha256, 'expectedE2fValidationPacketHashSha256');
    e2fRegistryPin = digest(expectedE2fVerifierRegistryHashSha256, 'expectedE2fVerifierRegistryHashSha256');
    e2gPin = digest(expectedE2gDecisionPacketHashSha256, 'expectedE2gDecisionPacketHashSha256');
    authorityRegistryPin = digest(expectedReleaseAuthorityRegistryHashSha256, 'expectedReleaseAuthorityRegistryHashSha256');
    expectedCommit = commitSha(expectedReleaseSourceCommitSha, 'expectedReleaseSourceCommitSha');
  } catch (error) {
    return hold([error.message]);
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

  let rebuilt;
  try {
    rebuilt = createHumanReleaseAuthorityDecisionPacket({
      decisionPacketId: e2gDecisionPacket.decisionPacketId,
      upstreamValidationPacket: e2fValidationPacket,
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

  if (rebuilt.status !== E2G_STATUS.HUMAN_RELEASE_DECISIONS_COMPLETE_PENDING_EXECUTION
    || rebuilt.releaseAuthorized !== true
    || rebuilt.mergeAuthorized !== true
    || rebuilt.deploymentAuthorized !== true) {
    return hold(['E2G_HUMAN_RELEASE_DECISIONS_NOT_COMPLETE'], observed);
  }
  if (rebuilt.decisionPacketHashSha256 !== e2gPin) {
    return hold(['E2G_REBUILT_PACKET_HASH_MISMATCH'], observed);
  }
  if (!stableEqual(rebuilt, e2gDecisionPacket)) {
    return hold(['E2G_SUPPLIED_PACKET_DIFFERS_FROM_CRYPTOGRAPHIC_REBUILD'], observed);
  }

  observed.releaseCandidateId = rebuilt.releaseCandidate.releaseCandidateId;
  observed.sourceCommitSha = rebuilt.releaseCandidate.sourceCommitSha;
  observed.artifactSha256 = rebuilt.releaseCandidate.artifactSha256;
  observed.environmentRef = rebuilt.releaseCandidate.environmentRef;
  observed.environmentConfigSha256 = rebuilt.releaseCandidate.environmentConfigSha256;
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
    semantics: 'This gate proves that the exact pull-request source commit is bound to a completed independently pinned E2F validation packet and a cryptographically rebuilt E2G packet containing separate valid human RELEASE, MERGE and DEPLOYMENT approvals. It does not itself merge, deploy, activate production, establish professional authority, authorize transactions, or establish go-live readiness.',
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
