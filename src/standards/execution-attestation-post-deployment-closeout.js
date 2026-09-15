'use strict';

const crypto = require('crypto');
const { sha256 } = require('./standards-registry');
const {
  E2G_STATUS,
  verifyHumanReleaseAuthorityDecisionPacketIntegrity,
} = require('./human-release-authority-deployment-decision');

const E2H_STATUS = Object.freeze({
  HOLD_E2G_DECISION_PACKET: 'HOLD_E2G_DECISION_PACKET',
  HOLD_EXECUTION_TRUST_ROOT: 'HOLD_EXECUTION_TRUST_ROOT',
  HOLD_EXECUTION_ATTESTATION_INTEGRITY: 'HOLD_EXECUTION_ATTESTATION_INTEGRITY',
  HOLD_EXECUTION_REJECTED: 'HOLD_EXECUTION_REJECTED',
  WAITING_FOR_MERGE_EXECUTION: 'WAITING_FOR_MERGE_EXECUTION',
  WAITING_FOR_DEPLOYMENT_EXECUTION: 'WAITING_FOR_DEPLOYMENT_EXECUTION',
  WAITING_FOR_POST_DEPLOYMENT_SMOKE: 'WAITING_FOR_POST_DEPLOYMENT_SMOKE',
  WAITING_FOR_ROLLBACK_READINESS: 'WAITING_FOR_ROLLBACK_READINESS',
  EXECUTION_AND_POST_DEPLOYMENT_CLOSEOUT_COMPLETE: 'EXECUTION_AND_POST_DEPLOYMENT_CLOSEOUT_COMPLETE',
});

const ATTESTATION_TYPE = Object.freeze({
  MERGE_EXECUTION_ATTESTATION: 'MERGE_EXECUTION_ATTESTATION',
  DEPLOYMENT_EXECUTION_ATTESTATION: 'DEPLOYMENT_EXECUTION_ATTESTATION',
  POST_DEPLOYMENT_SMOKE_VALIDATION: 'POST_DEPLOYMENT_SMOKE_VALIDATION',
  ROLLBACK_READINESS_VALIDATION: 'ROLLBACK_READINESS_VALIDATION',
});

const ATTESTATION_RESULT = Object.freeze({
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
  INCONCLUSIVE: 'INCONCLUSIVE',
});

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertNonEmpty(value, field) {
  if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`);
}

function iso(value, field) {
  assertNonEmpty(value, field);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return parsed.toISOString();
}

function digest(value, field) {
  assertNonEmpty(value, field);
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new TypeError(`${field} must be a SHA-256 hex digest`);
  return value.toLowerCase();
}

function commitSha(value, field) {
  assertNonEmpty(value, field);
  if (!/^[a-f0-9]{40}$/i.test(value)) throw new TypeError(`${field} must be a 40-character commit SHA`);
  return value.toLowerCase();
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function validatePolicy(policy) {
  if (!policy || typeof policy !== 'object') throw new TypeError('policy must be an object');
  assertNonEmpty(policy.policyId, 'policy.policyId');
  if (policy.operatingMode !== 'UNLICENSED_DECISION_SUPPORT') throw new TypeError('E2H_OPERATING_MODE_MUST_REMAIN_UNLICENSED_DECISION_SUPPORT');
  if (policy.requiredUpstreamStatus !== E2G_STATUS.HUMAN_RELEASE_DECISIONS_COMPLETE_PENDING_EXECUTION) throw new TypeError('E2H_REQUIRED_UPSTREAM_STATUS_INVALID');
  if (policy.trustedExecutionAttestorRegistryRequired !== true) throw new TypeError('E2H_EXECUTION_ATTESTOR_REGISTRY_REQUIRED');
  if (policy.trustedExecutionAttestorRegistryHashPinnedOutOfBandRequired !== true) throw new TypeError('E2H_OUT_OF_BAND_EXECUTION_TRUST_ROOT_REQUIRED');
  if (policy.deploymentRequiresVerifiedMergeExecution !== true) throw new TypeError('E2H_DEPLOYMENT_REQUIRES_VERIFIED_MERGE');
  if (policy.postDeploymentSmokeRequiresVerifiedDeployment !== true) throw new TypeError('E2H_SMOKE_REQUIRES_VERIFIED_DEPLOYMENT');
  if (policy.rollbackReadinessRequiredForCloseout !== true) throw new TypeError('E2H_ROLLBACK_READINESS_REQUIRED');
  if (policy.sameActorMayAttestDeploymentAndSmoke !== false) throw new TypeError('E2H_DEPLOYMENT_SMOKE_ACTOR_SEPARATION_REQUIRED');
  for (const field of ['callerDeclaredExecutionAccepted', 'automaticMergeExecutionAllowed', 'automaticDeploymentExecutionAllowed', 'automaticProfessionalAuthorityPromotionAllowed']) {
    if (policy[field] !== false) throw new TypeError(`E2H_AUTHORITY_FLAG_MUST_REMAIN_FALSE:${field}`);
  }
  if (!Array.isArray(policy.requiredAttestationTypes) || policy.requiredAttestationTypes.length === 0) throw new TypeError('policy.requiredAttestationTypes must be non-empty');
  for (const type of Object.values(ATTESTATION_TYPE)) {
    if (!policy.requiredAttestationTypes.includes(type)) throw new TypeError(`E2H_REQUIRED_ATTESTATION_TYPE_MISSING:${type}`);
  }
  if (!Array.isArray(policy.allowedAttestationResults) || policy.allowedAttestationResults.length === 0) throw new TypeError('policy.allowedAttestationResults must be non-empty');
  for (const result of Object.values(ATTESTATION_RESULT)) {
    if (!policy.allowedAttestationResults.includes(result)) throw new TypeError(`E2H_ALLOWED_ATTESTATION_RESULT_MISSING:${result}`);
  }
  if (!Array.isArray(policy.signatureAlgorithmsAllowed) || !policy.signatureAlgorithmsAllowed.includes('RSA-SHA256')) throw new TypeError('E2H_RSA_SHA256_MUST_BE_ALLOWED');
  if (!Array.isArray(policy.requiredUpstreamAuthorizationFlags) || policy.requiredUpstreamAuthorizationFlags.length === 0) throw new TypeError('policy.requiredUpstreamAuthorizationFlags must be non-empty');
  return true;
}

function normalizeExecutionAttestorRegistry(registry) {
  if (!registry || typeof registry !== 'object') throw new TypeError('executionAttestorRegistry must be an object');
  assertNonEmpty(registry.registryId, 'executionAttestorRegistry.registryId');
  assertNonEmpty(registry.governanceArtifactSha256, 'executionAttestorRegistry.governanceArtifactSha256');
  if (!Array.isArray(registry.attestors) || registry.attestors.length === 0) throw new TypeError('executionAttestorRegistry.attestors must be non-empty');
  const seen = new Set();
  const attestors = registry.attestors.map((record) => {
    for (const field of ['attestorId', 'attestorSubjectRef', 'publicKeyPem', 'publicKeySha256', 'governanceEvidenceRef', 'activeFrom']) {
      assertNonEmpty(record[field], `executionAttestor.${field}`);
    }
    if (seen.has(record.attestorId)) throw new TypeError(`DUPLICATE_EXECUTION_ATTESTOR_ID:${record.attestorId}`);
    seen.add(record.attestorId);
    if (!Array.isArray(record.allowedAttestationTypes) || record.allowedAttestationTypes.length === 0) throw new TypeError(`EXECUTION_ATTESTOR_TYPES_REQUIRED:${record.attestorId}`);
    for (const type of record.allowedAttestationTypes) {
      if (!Object.values(ATTESTATION_TYPE).includes(type)) throw new TypeError(`EXECUTION_ATTESTOR_TYPE_INVALID:${record.attestorId}:${type}`);
    }
    const publicKeySha256 = digest(record.publicKeySha256, 'executionAttestor.publicKeySha256');
    if (sha256(record.publicKeyPem.trim()) !== publicKeySha256) throw new TypeError(`EXECUTION_ATTESTOR_PUBLIC_KEY_HASH_MISMATCH:${record.attestorId}`);
    return deepFreeze({
      attestorId: record.attestorId.trim(),
      attestorSubjectRef: record.attestorSubjectRef.trim(),
      allowedAttestationTypes: Object.freeze([...record.allowedAttestationTypes]),
      publicKeyPem: record.publicKeyPem.trim(),
      publicKeySha256,
      governanceEvidenceRef: record.governanceEvidenceRef.trim(),
      activeFrom: iso(record.activeFrom, 'executionAttestor.activeFrom'),
      activeUntil: nonEmpty(record.activeUntil) ? iso(record.activeUntil, 'executionAttestor.activeUntil') : null,
    });
  });
  const core = {
    registryId: registry.registryId.trim(),
    governanceArtifactSha256: digest(registry.governanceArtifactSha256, 'executionAttestorRegistry.governanceArtifactSha256'),
    attestors,
  };
  return deepFreeze({ ...core, registryHashSha256: sha256(core) });
}

function createExecutionAttestationSigningPayload(record, policy) {
  if (!record || typeof record !== 'object') throw new TypeError('execution attestation record must be an object');
  for (const field of [
    'attestationId', 'attestationType', 'decisionPacketHashSha256', 'releaseCandidateId', 'approvedSourceCommitSha',
    'artifactSha256', 'environmentRef', 'environmentConfigSha256', 'attestorId', 'evidenceSourceRef',
    'evidenceArtifactSha256', 'observedAt', 'result', 'signatureAlgorithm',
  ]) assertNonEmpty(record[field], `attestation.${field}`);
  if (!policy.requiredAttestationTypes.includes(record.attestationType)) throw new TypeError(`ATTESTATION_TYPE_NOT_ALLOWED:${record.attestationType}`);
  if (!policy.allowedAttestationResults.includes(record.result)) throw new TypeError(`ATTESTATION_RESULT_NOT_ALLOWED:${record.result}`);
  if (!policy.signatureAlgorithmsAllowed.includes(record.signatureAlgorithm)) throw new TypeError(`ATTESTATION_SIGNATURE_ALGORITHM_NOT_ALLOWED:${record.signatureAlgorithm}`);

  const typeSpecific = {
    targetBranchRef: nonEmpty(record.targetBranchRef) ? record.targetBranchRef.trim() : null,
    resultingMergeCommitSha: nonEmpty(record.resultingMergeCommitSha) ? commitSha(record.resultingMergeCommitSha, 'attestation.resultingMergeCommitSha') : null,
    deploymentId: nonEmpty(record.deploymentId) ? record.deploymentId.trim() : null,
    checkSuiteRef: nonEmpty(record.checkSuiteRef) ? record.checkSuiteRef.trim() : null,
    rollbackPlanArtifactSha256: nonEmpty(record.rollbackPlanArtifactSha256) ? digest(record.rollbackPlanArtifactSha256, 'attestation.rollbackPlanArtifactSha256') : null,
    restorePointRef: nonEmpty(record.restorePointRef) ? record.restorePointRef.trim() : null,
  };

  if (record.attestationType === ATTESTATION_TYPE.MERGE_EXECUTION_ATTESTATION) {
    if (!typeSpecific.targetBranchRef || !typeSpecific.resultingMergeCommitSha) throw new TypeError('MERGE_ATTESTATION_REQUIRES_TARGET_BRANCH_AND_RESULTING_COMMIT');
  }
  if (record.attestationType === ATTESTATION_TYPE.DEPLOYMENT_EXECUTION_ATTESTATION) {
    if (!typeSpecific.resultingMergeCommitSha || !typeSpecific.deploymentId) throw new TypeError('DEPLOYMENT_ATTESTATION_REQUIRES_MERGE_COMMIT_AND_DEPLOYMENT_ID');
  }
  if (record.attestationType === ATTESTATION_TYPE.POST_DEPLOYMENT_SMOKE_VALIDATION) {
    if (!typeSpecific.deploymentId || !typeSpecific.checkSuiteRef) throw new TypeError('SMOKE_ATTESTATION_REQUIRES_DEPLOYMENT_ID_AND_CHECK_SUITE');
  }
  if (record.attestationType === ATTESTATION_TYPE.ROLLBACK_READINESS_VALIDATION) {
    if (!typeSpecific.deploymentId || !typeSpecific.rollbackPlanArtifactSha256 || !typeSpecific.restorePointRef) throw new TypeError('ROLLBACK_ATTESTATION_REQUIRES_DEPLOYMENT_ID_PLAN_HASH_AND_RESTORE_POINT');
  }

  return deepFreeze({
    attestationId: record.attestationId.trim(),
    attestationType: record.attestationType,
    decisionPacketHashSha256: digest(record.decisionPacketHashSha256, 'attestation.decisionPacketHashSha256'),
    releaseCandidateId: record.releaseCandidateId.trim(),
    approvedSourceCommitSha: commitSha(record.approvedSourceCommitSha, 'attestation.approvedSourceCommitSha'),
    artifactSha256: digest(record.artifactSha256, 'attestation.artifactSha256'),
    environmentRef: record.environmentRef.trim(),
    environmentConfigSha256: digest(record.environmentConfigSha256, 'attestation.environmentConfigSha256'),
    attestorId: record.attestorId.trim(),
    evidenceSourceRef: record.evidenceSourceRef.trim(),
    evidenceArtifactSha256: digest(record.evidenceArtifactSha256, 'attestation.evidenceArtifactSha256'),
    observedAt: iso(record.observedAt, 'attestation.observedAt'),
    expiresAt: nonEmpty(record.expiresAt) ? iso(record.expiresAt, 'attestation.expiresAt') : null,
    result: record.result,
    signatureAlgorithm: record.signatureAlgorithm,
    ...typeSpecific,
  });
}

function normalizeAttestation(record, policy) {
  const payload = createExecutionAttestationSigningPayload(record, policy);
  assertNonEmpty(record.signatureBase64, 'attestation.signatureBase64');
  const signature = Buffer.from(record.signatureBase64, 'base64');
  if (!signature.length) throw new TypeError(`ATTESTATION_SIGNATURE_BASE64_INVALID:${payload.attestationId}`);
  return deepFreeze({ ...payload, signatureBase64: record.signatureBase64.trim(), attestationPayloadHashSha256: sha256(payload) });
}

function verifyAttestationSignature(record, attestor, policy) {
  if (record.signatureAlgorithm !== 'RSA-SHA256') return false;
  try {
    const payload = createExecutionAttestationSigningPayload(record, policy);
    return crypto.verify('RSA-SHA256', Buffer.from(stableStringify(payload), 'utf8'), attestor.publicKeyPem, Buffer.from(record.signatureBase64, 'base64'));
  } catch (error) {
    return false;
  }
}

function professionalBoundary() {
  return deepFreeze({
    formalStandardsConformanceEstablished: false,
    standardsOrRulesActivated: false,
    saudiProfessionalLicensingEstablished: false,
    certifiedValuationAuthorityEstablished: false,
    externalIssuanceAuthorized: false,
    transactionAuthorized: false,
  });
}

function hold(status, closeoutPacketId, upstream, policy, blockers, preparedByRef, preparedAtIso, registryHash = null) {
  return deepFreeze({
    schemaVersion: 1,
    closeoutPacketId,
    upstreamDecisionPacketId: upstream?.decisionPacketId || null,
    upstreamDecisionPacketHashSha256: upstream?.decisionPacketHashSha256 || null,
    policyId: policy?.policyId || null,
    releaseCandidate: upstream?.releaseCandidate || null,
    executionAttestorRegistryHashSha256: registryHash,
    status,
    blockers: Object.freeze([...blockers]),
    attestations: Object.freeze([]),
    preparedByRef,
    preparedAt: preparedAtIso,
    closeoutPacketHashSha256: null,
    releaseAuthorized: upstream?.releaseAuthorized === true,
    mergeAuthorized: upstream?.mergeAuthorized === true,
    deploymentAuthorized: upstream?.deploymentAuthorized === true,
    mergeExecuted: false,
    deploymentExecuted: false,
    postDeploymentSmokePassed: false,
    rollbackReadinessValidated: false,
    ...professionalBoundary(),
  });
}

function isVerified(attestations, type) {
  return attestations.some((record) => record.attestationType === type && record.result === ATTESTATION_RESULT.VERIFIED);
}

function createExecutionPostDeploymentCloseoutPacket({
  closeoutPacketId,
  upstreamDecisionPacket,
  policy,
  executionAttestorRegistry,
  expectedExecutionAttestorRegistryHashSha256,
  attestations = [],
  preparedByRef,
  preparedAt,
} = {}) {
  assertNonEmpty(closeoutPacketId, 'closeoutPacketId');
  assertNonEmpty(preparedByRef, 'preparedByRef');
  const preparedAtIso = iso(preparedAt, 'preparedAt');
  validatePolicy(policy);

  const upstreamQualified = upstreamDecisionPacket?.status === E2G_STATUS.HUMAN_RELEASE_DECISIONS_COMPLETE_PENDING_EXECUTION
    && verifyHumanReleaseAuthorityDecisionPacketIntegrity(upstreamDecisionPacket)
    && policy.requiredUpstreamAuthorizationFlags.every((field) => upstreamDecisionPacket[field] === true);
  if (!upstreamQualified) return hold(E2H_STATUS.HOLD_E2G_DECISION_PACKET, closeoutPacketId.trim(), upstreamDecisionPacket, policy, ['E2G_HUMAN_RELEASE_DECISIONS_NOT_QUALIFIED'], preparedByRef.trim(), preparedAtIso);

  let registry;
  let expectedHash;
  try {
    registry = normalizeExecutionAttestorRegistry(executionAttestorRegistry);
    expectedHash = digest(expectedExecutionAttestorRegistryHashSha256, 'expectedExecutionAttestorRegistryHashSha256');
  } catch (error) {
    return hold(E2H_STATUS.HOLD_EXECUTION_TRUST_ROOT, closeoutPacketId.trim(), upstreamDecisionPacket, policy, [error.message], preparedByRef.trim(), preparedAtIso);
  }
  if (registry.registryHashSha256 !== expectedHash) return hold(E2H_STATUS.HOLD_EXECUTION_TRUST_ROOT, closeoutPacketId.trim(), upstreamDecisionPacket, policy, ['EXECUTION_ATTESTOR_REGISTRY_HASH_MISMATCH'], preparedByRef.trim(), preparedAtIso, registry.registryHashSha256);

  if (!Array.isArray(attestations)) throw new TypeError('attestations must be an array');
  let normalized;
  try {
    normalized = attestations.map((record) => normalizeAttestation(record, policy));
  } catch (error) {
    return hold(E2H_STATUS.HOLD_EXECUTION_ATTESTATION_INTEGRITY, closeoutPacketId.trim(), upstreamDecisionPacket, policy, [error.message], preparedByRef.trim(), preparedAtIso, registry.registryHashSha256);
  }

  const blockers = [];
  const seenIds = new Set();
  const seenTypes = new Set();
  const attestorById = new Map(registry.attestors.map((record) => [record.attestorId, record]));
  const release = upstreamDecisionPacket.releaseCandidate;

  for (const attestation of normalized) {
    if (seenIds.has(attestation.attestationId)) blockers.push(`DUPLICATE_ATTESTATION_ID:${attestation.attestationId}`);
    seenIds.add(attestation.attestationId);
    if (seenTypes.has(attestation.attestationType)) blockers.push(`DUPLICATE_ATTESTATION_TYPE:${attestation.attestationType}`);
    seenTypes.add(attestation.attestationType);
    const attestor = attestorById.get(attestation.attestorId);
    if (!attestor) {
      blockers.push(`EXECUTION_ATTESTOR_NOT_TRUSTED:${attestation.attestationId}:${attestation.attestorId}`);
      continue;
    }
    if (!attestor.allowedAttestationTypes.includes(attestation.attestationType)) blockers.push(`EXECUTION_ATTESTOR_TYPE_NOT_ALLOWED:${attestation.attestationId}:${attestation.attestorId}:${attestation.attestationType}`);
    if (Date.parse(attestation.observedAt) < Date.parse(attestor.activeFrom) || (attestor.activeUntil && Date.parse(attestation.observedAt) > Date.parse(attestor.activeUntil))) blockers.push(`EXECUTION_ATTESTOR_OUTSIDE_ACTIVE_PERIOD:${attestation.attestationId}`);
    if (Date.parse(attestation.observedAt) < Date.parse(upstreamDecisionPacket.preparedAt)) blockers.push(`ATTESTATION_BEFORE_E2G_DECISION_PACKET:${attestation.attestationId}`);
    if (Date.parse(attestation.observedAt) > Date.parse(preparedAtIso)) blockers.push(`ATTESTATION_AFTER_CLOSEOUT_PREPARATION:${attestation.attestationId}`);
    if (attestation.expiresAt && Date.parse(attestation.expiresAt) < Date.parse(attestation.observedAt)) blockers.push(`ATTESTATION_EXPIRY_BEFORE_OBSERVATION:${attestation.attestationId}`);
    if (attestation.expiresAt && Date.parse(attestation.expiresAt) < Date.parse(preparedAtIso)) blockers.push(`ATTESTATION_EXPIRED_AT_CLOSEOUT:${attestation.attestationId}`);
    if (attestation.decisionPacketHashSha256 !== upstreamDecisionPacket.decisionPacketHashSha256) blockers.push(`ATTESTATION_DECISION_PACKET_HASH_MISMATCH:${attestation.attestationId}`);
    if (attestation.releaseCandidateId !== release.releaseCandidateId) blockers.push(`ATTESTATION_RELEASE_CANDIDATE_MISMATCH:${attestation.attestationId}`);
    if (attestation.approvedSourceCommitSha !== release.sourceCommitSha) blockers.push(`ATTESTATION_SOURCE_COMMIT_MISMATCH:${attestation.attestationId}`);
    if (attestation.artifactSha256 !== release.artifactSha256) blockers.push(`ATTESTATION_ARTIFACT_HASH_MISMATCH:${attestation.attestationId}`);
    if (attestation.environmentRef !== release.environmentRef) blockers.push(`ATTESTATION_ENVIRONMENT_MISMATCH:${attestation.attestationId}`);
    if (attestation.environmentConfigSha256 !== release.environmentConfigSha256) blockers.push(`ATTESTATION_ENV_CONFIG_HASH_MISMATCH:${attestation.attestationId}`);
    if (!verifyAttestationSignature(attestation, attestor, policy)) blockers.push(`EXECUTION_ATTESTATION_SIGNATURE_INVALID:${attestation.attestationId}`);
  }

  const byType = new Map(normalized.map((record) => [record.attestationType, record]));
  const mergeAtt = byType.get(ATTESTATION_TYPE.MERGE_EXECUTION_ATTESTATION);
  const deployAtt = byType.get(ATTESTATION_TYPE.DEPLOYMENT_EXECUTION_ATTESTATION);
  const smokeAtt = byType.get(ATTESTATION_TYPE.POST_DEPLOYMENT_SMOKE_VALIDATION);
  const rollbackAtt = byType.get(ATTESTATION_TYPE.ROLLBACK_READINESS_VALIDATION);

  if (deployAtt && deployAtt.result === ATTESTATION_RESULT.VERIFIED) {
    if (!mergeAtt || mergeAtt.result !== ATTESTATION_RESULT.VERIFIED) blockers.push('DEPLOYMENT_EXECUTION_REQUIRES_VERIFIED_MERGE_EXECUTION');
    else if (deployAtt.resultingMergeCommitSha !== mergeAtt.resultingMergeCommitSha) blockers.push('DEPLOYMENT_MERGE_COMMIT_MISMATCH');
  }
  if (smokeAtt && smokeAtt.result === ATTESTATION_RESULT.VERIFIED) {
    if (!deployAtt || deployAtt.result !== ATTESTATION_RESULT.VERIFIED) blockers.push('POST_DEPLOYMENT_SMOKE_REQUIRES_VERIFIED_DEPLOYMENT');
    else if (smokeAtt.deploymentId !== deployAtt.deploymentId) blockers.push('POST_DEPLOYMENT_SMOKE_DEPLOYMENT_ID_MISMATCH');
  }
  if (rollbackAtt && rollbackAtt.result === ATTESTATION_RESULT.VERIFIED) {
    if (!deployAtt || deployAtt.result !== ATTESTATION_RESULT.VERIFIED) blockers.push('ROLLBACK_READINESS_REQUIRES_VERIFIED_DEPLOYMENT');
    else if (rollbackAtt.deploymentId !== deployAtt.deploymentId) blockers.push('ROLLBACK_DEPLOYMENT_ID_MISMATCH');
  }
  if (deployAtt && smokeAtt) {
    const deployActor = attestorById.get(deployAtt.attestorId)?.attestorSubjectRef;
    const smokeActor = attestorById.get(smokeAtt.attestorId)?.attestorSubjectRef;
    if (deployActor && smokeActor && deployActor === smokeActor) blockers.push('DEPLOYMENT_AND_SMOKE_SAME_ACTOR_PROHIBITED');
  }

  if (blockers.length) return hold(E2H_STATUS.HOLD_EXECUTION_ATTESTATION_INTEGRITY, closeoutPacketId.trim(), upstreamDecisionPacket, policy, blockers, preparedByRef.trim(), preparedAtIso, registry.registryHashSha256);

  const rejected = normalized.filter((record) => record.result === ATTESTATION_RESULT.REJECTED);
  if (rejected.length) return hold(E2H_STATUS.HOLD_EXECUTION_REJECTED, closeoutPacketId.trim(), upstreamDecisionPacket, policy, rejected.map((record) => `EXECUTION_ATTESTATION_REJECTED:${record.attestationType}:${record.attestationId}`), preparedByRef.trim(), preparedAtIso, registry.registryHashSha256);

  const mergeExecuted = isVerified(normalized, ATTESTATION_TYPE.MERGE_EXECUTION_ATTESTATION);
  const deploymentExecuted = mergeExecuted && isVerified(normalized, ATTESTATION_TYPE.DEPLOYMENT_EXECUTION_ATTESTATION);
  const smokePassed = deploymentExecuted && isVerified(normalized, ATTESTATION_TYPE.POST_DEPLOYMENT_SMOKE_VALIDATION);
  const rollbackReady = deploymentExecuted && isVerified(normalized, ATTESTATION_TYPE.ROLLBACK_READINESS_VALIDATION);
  const complete = mergeExecuted && deploymentExecuted && smokePassed && rollbackReady;

  const status = !mergeExecuted
    ? E2H_STATUS.WAITING_FOR_MERGE_EXECUTION
    : !deploymentExecuted
      ? E2H_STATUS.WAITING_FOR_DEPLOYMENT_EXECUTION
      : !smokePassed
        ? E2H_STATUS.WAITING_FOR_POST_DEPLOYMENT_SMOKE
        : !rollbackReady
          ? E2H_STATUS.WAITING_FOR_ROLLBACK_READINESS
          : E2H_STATUS.EXECUTION_AND_POST_DEPLOYMENT_CLOSEOUT_COMPLETE;

  const core = {
    schemaVersion: 1,
    closeoutPacketId: closeoutPacketId.trim(),
    upstreamDecisionPacketId: upstreamDecisionPacket.decisionPacketId,
    upstreamDecisionPacketHashSha256: upstreamDecisionPacket.decisionPacketHashSha256,
    policyId: policy.policyId,
    releaseCandidate: release,
    executionAttestorRegistryId: registry.registryId,
    executionAttestorRegistryHashSha256: registry.registryHashSha256,
    attestations: normalized,
    preparedByRef: preparedByRef.trim(),
    preparedAt: preparedAtIso,
  };

  return deepFreeze({
    ...core,
    status,
    blockers: Object.freeze([]),
    closeoutPacketHashSha256: sha256(core),
    releaseAuthorized: true,
    mergeAuthorized: true,
    deploymentAuthorized: true,
    mergeExecuted,
    deploymentExecuted,
    postDeploymentSmokePassed: smokePassed,
    rollbackReadinessValidated: rollbackReady,
    executionCloseoutComplete: complete,
    ...professionalBoundary(),
    semantics: 'E2H verifies externally attested execution and post-deployment evidence for the exact E2G-approved release candidate. It does not itself perform merge/deployment and does not convert successful software execution into formal professional standards conformance, rule activation, Saudi professional licensing, certified valuation authority, external professional issuance or transaction authority.',
  });
}

function verifyExecutionPostDeploymentCloseoutPacketIntegrity(packet) {
  if (!packet || !/^[a-f0-9]{64}$/i.test(String(packet.closeoutPacketHashSha256 || ''))) return false;
  const core = {
    schemaVersion: packet.schemaVersion,
    closeoutPacketId: packet.closeoutPacketId,
    upstreamDecisionPacketId: packet.upstreamDecisionPacketId,
    upstreamDecisionPacketHashSha256: packet.upstreamDecisionPacketHashSha256,
    policyId: packet.policyId,
    releaseCandidate: packet.releaseCandidate,
    executionAttestorRegistryId: packet.executionAttestorRegistryId,
    executionAttestorRegistryHashSha256: packet.executionAttestorRegistryHashSha256,
    attestations: packet.attestations,
    preparedByRef: packet.preparedByRef,
    preparedAt: packet.preparedAt,
  };
  return sha256(core) === packet.closeoutPacketHashSha256.toLowerCase();
}

module.exports = {
  E2H_STATUS,
  ATTESTATION_TYPE,
  ATTESTATION_RESULT,
  validatePolicy,
  normalizeExecutionAttestorRegistry,
  createExecutionAttestationSigningPayload,
  normalizeAttestation,
  verifyAttestationSignature,
  createExecutionPostDeploymentCloseoutPacket,
  verifyExecutionPostDeploymentCloseoutPacketIntegrity,
};
