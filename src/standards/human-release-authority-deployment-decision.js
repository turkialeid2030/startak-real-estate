'use strict';

const crypto = require('crypto');
const { sha256 } = require('./standards-registry');
const {
  E2F_STATUS,
  verifyExternalConformanceProductionValidationPacketIntegrity,
} = require('./external-conformance-production-validation');

const E2G_STATUS = Object.freeze({
  HOLD_E2F_VALIDATION_PACKET: 'HOLD_E2F_VALIDATION_PACKET',
  HOLD_RELEASE_AUTHORITY_ROOT: 'HOLD_RELEASE_AUTHORITY_ROOT',
  HOLD_DECISION_INTEGRITY: 'HOLD_DECISION_INTEGRITY',
  HOLD_HUMAN_DECISION_REJECTED: 'HOLD_HUMAN_DECISION_REJECTED',
  HOLD_HUMAN_DECISION: 'HOLD_HUMAN_DECISION',
  WAITING_FOR_RELEASE_APPROVAL: 'WAITING_FOR_RELEASE_APPROVAL',
  WAITING_FOR_MERGE_APPROVAL: 'WAITING_FOR_MERGE_APPROVAL',
  WAITING_FOR_DEPLOYMENT_APPROVAL: 'WAITING_FOR_DEPLOYMENT_APPROVAL',
  HUMAN_RELEASE_DECISIONS_COMPLETE_PENDING_EXECUTION: 'HUMAN_RELEASE_DECISIONS_COMPLETE_PENDING_EXECUTION',
});

const DECISION_TYPE = Object.freeze({
  RELEASE_APPROVAL: 'RELEASE_APPROVAL',
  MERGE_APPROVAL: 'MERGE_APPROVAL',
  DEPLOYMENT_APPROVAL: 'DEPLOYMENT_APPROVAL',
});

const DECISION_RESULT = Object.freeze({
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  HOLD: 'HOLD',
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
  if (policy.operatingMode !== 'UNLICENSED_DECISION_SUPPORT') throw new TypeError('E2G_OPERATING_MODE_MUST_REMAIN_UNLICENSED_DECISION_SUPPORT');
  if (policy.requiredUpstreamStatus !== E2F_STATUS.EXTERNAL_CONFORMANCE_AND_PRODUCTION_VALIDATION_COMPLETE_PENDING_RELEASE_AUTHORITY) {
    throw new TypeError('E2G_REQUIRED_UPSTREAM_STATUS_INVALID');
  }
  if (policy.releaseAuthorityRegistryRequired !== true) throw new TypeError('E2G_RELEASE_AUTHORITY_REGISTRY_REQUIRED');
  if (policy.releaseAuthorityRegistryHashPinnedOutOfBandRequired !== true) throw new TypeError('E2G_OUT_OF_BAND_RELEASE_AUTHORITY_ROOT_REQUIRED');
  if (policy.mergeRequiresReleaseApproval !== true) throw new TypeError('E2G_MERGE_REQUIRES_RELEASE_APPROVAL');
  if (policy.deploymentRequiresMergeApproval !== true) throw new TypeError('E2G_DEPLOYMENT_REQUIRES_MERGE_APPROVAL');
  if (policy.sameActorMayAuthorizeMergeAndDeployment !== false) throw new TypeError('E2G_MERGE_DEPLOYMENT_ACTOR_SEPARATION_REQUIRED');
  if (policy.sameActorMayAuthorizeAllThreeDecisions !== false) throw new TypeError('E2G_ALL_DECISIONS_SINGLE_ACTOR_PROHIBITED');
  for (const field of [
    'callerDeclaredDecisionAccepted',
    'automaticReleaseAllowed',
    'automaticMergeAllowed',
    'automaticDeploymentAllowed',
    'automaticRuleActivationAllowed',
  ]) {
    if (policy[field] !== false) throw new TypeError(`E2G_AUTHORITY_FLAG_MUST_REMAIN_FALSE:${field}`);
  }
  if (!Array.isArray(policy.requiredDecisionTypes) || policy.requiredDecisionTypes.length === 0) throw new TypeError('policy.requiredDecisionTypes must be non-empty');
  for (const type of Object.values(DECISION_TYPE)) {
    if (!policy.requiredDecisionTypes.includes(type)) throw new TypeError(`E2G_REQUIRED_DECISION_TYPE_MISSING:${type}`);
  }
  if (!Array.isArray(policy.allowedDecisionResults) || policy.allowedDecisionResults.length === 0) throw new TypeError('policy.allowedDecisionResults must be non-empty');
  for (const result of Object.values(DECISION_RESULT)) {
    if (!policy.allowedDecisionResults.includes(result)) throw new TypeError(`E2G_ALLOWED_DECISION_RESULT_MISSING:${result}`);
  }
  if (!Array.isArray(policy.signatureAlgorithmsAllowed) || !policy.signatureAlgorithmsAllowed.includes('RSA-SHA256')) throw new TypeError('E2G_RSA_SHA256_MUST_BE_ALLOWED');
  if (!Array.isArray(policy.requiredUpstreamValidationFlags) || policy.requiredUpstreamValidationFlags.length === 0) throw new TypeError('policy.requiredUpstreamValidationFlags must be non-empty');
  return true;
}

function normalizeReleaseAuthorityRegistry(registry) {
  if (!registry || typeof registry !== 'object') throw new TypeError('releaseAuthorityRegistry must be an object');
  assertNonEmpty(registry.registryId, 'releaseAuthorityRegistry.registryId');
  assertNonEmpty(registry.governanceArtifactSha256, 'releaseAuthorityRegistry.governanceArtifactSha256');
  if (!Array.isArray(registry.authorities) || registry.authorities.length === 0) throw new TypeError('releaseAuthorityRegistry.authorities must be non-empty');

  const seen = new Set();
  const authorities = registry.authorities.map((record) => {
    for (const field of ['authorityId', 'authoritySubjectRef', 'publicKeyPem', 'publicKeySha256', 'governanceEvidenceRef', 'activeFrom']) {
      assertNonEmpty(record[field], `releaseAuthority.${field}`);
    }
    if (seen.has(record.authorityId)) throw new TypeError(`DUPLICATE_RELEASE_AUTHORITY_ID:${record.authorityId}`);
    seen.add(record.authorityId);
    if (!Array.isArray(record.allowedDecisionTypes) || record.allowedDecisionTypes.length === 0) throw new TypeError(`RELEASE_AUTHORITY_DECISION_TYPES_REQUIRED:${record.authorityId}`);
    for (const type of record.allowedDecisionTypes) {
      if (!Object.values(DECISION_TYPE).includes(type)) throw new TypeError(`RELEASE_AUTHORITY_DECISION_TYPE_INVALID:${record.authorityId}:${type}`);
    }
    const publicKeySha256 = digest(record.publicKeySha256, 'releaseAuthority.publicKeySha256');
    if (sha256(record.publicKeyPem.trim()) !== publicKeySha256) throw new TypeError(`RELEASE_AUTHORITY_PUBLIC_KEY_HASH_MISMATCH:${record.authorityId}`);
    return deepFreeze({
      authorityId: record.authorityId.trim(),
      authoritySubjectRef: record.authoritySubjectRef.trim(),
      allowedDecisionTypes: Object.freeze([...record.allowedDecisionTypes]),
      publicKeyPem: record.publicKeyPem.trim(),
      publicKeySha256,
      governanceEvidenceRef: record.governanceEvidenceRef.trim(),
      activeFrom: iso(record.activeFrom, 'releaseAuthority.activeFrom'),
      activeUntil: nonEmpty(record.activeUntil) ? iso(record.activeUntil, 'releaseAuthority.activeUntil') : null,
    });
  });

  const core = {
    registryId: registry.registryId.trim(),
    governanceArtifactSha256: digest(registry.governanceArtifactSha256, 'releaseAuthorityRegistry.governanceArtifactSha256'),
    authorities,
  };
  return deepFreeze({
    ...core,
    registryHashSha256: sha256(core),
  });
}

function createReleaseDecisionSigningPayload(record, policy) {
  if (!record || typeof record !== 'object') throw new TypeError('release decision record must be an object');
  for (const field of [
    'decisionId', 'decisionType', 'releaseCandidateId', 'validationPacketHashSha256', 'sourceCommitSha',
    'artifactSha256', 'environmentRef', 'environmentConfigSha256', 'authorityId', 'decisionSourceRef',
    'decisionArtifactSha256', 'decidedAt', 'result', 'rationaleRef', 'signatureAlgorithm',
  ]) {
    assertNonEmpty(record[field], `decision.${field}`);
  }
  if (!policy.requiredDecisionTypes.includes(record.decisionType)) throw new TypeError(`DECISION_TYPE_NOT_ALLOWED:${record.decisionType}`);
  if (!policy.allowedDecisionResults.includes(record.result)) throw new TypeError(`DECISION_RESULT_NOT_ALLOWED:${record.result}`);
  if (!policy.signatureAlgorithmsAllowed.includes(record.signatureAlgorithm)) throw new TypeError(`DECISION_SIGNATURE_ALGORITHM_NOT_ALLOWED:${record.signatureAlgorithm}`);
  return deepFreeze({
    decisionId: record.decisionId.trim(),
    decisionType: record.decisionType,
    releaseCandidateId: record.releaseCandidateId.trim(),
    validationPacketHashSha256: digest(record.validationPacketHashSha256, 'decision.validationPacketHashSha256'),
    sourceCommitSha: commitSha(record.sourceCommitSha, 'decision.sourceCommitSha'),
    artifactSha256: digest(record.artifactSha256, 'decision.artifactSha256'),
    environmentRef: record.environmentRef.trim(),
    environmentConfigSha256: digest(record.environmentConfigSha256, 'decision.environmentConfigSha256'),
    authorityId: record.authorityId.trim(),
    decisionSourceRef: record.decisionSourceRef.trim(),
    decisionArtifactSha256: digest(record.decisionArtifactSha256, 'decision.decisionArtifactSha256'),
    decidedAt: iso(record.decidedAt, 'decision.decidedAt'),
    expiresAt: nonEmpty(record.expiresAt) ? iso(record.expiresAt, 'decision.expiresAt') : null,
    result: record.result,
    rationaleRef: record.rationaleRef.trim(),
    signatureAlgorithm: record.signatureAlgorithm,
  });
}

function normalizeDecision(record, policy) {
  const payload = createReleaseDecisionSigningPayload(record, policy);
  assertNonEmpty(record.signatureBase64, 'decision.signatureBase64');
  let signature;
  try {
    signature = Buffer.from(record.signatureBase64, 'base64');
  } catch (error) {
    throw new TypeError(`DECISION_SIGNATURE_BASE64_INVALID:${payload.decisionId}`);
  }
  if (!signature.length) throw new TypeError(`DECISION_SIGNATURE_BASE64_INVALID:${payload.decisionId}`);
  return deepFreeze({
    ...payload,
    signatureBase64: record.signatureBase64.trim(),
    decisionPayloadHashSha256: sha256(payload),
  });
}

function verifyDecisionSignature(record, authority, policy) {
  if (record.signatureAlgorithm !== 'RSA-SHA256') return false;
  try {
    const payload = createReleaseDecisionSigningPayload(record, policy);
    return crypto.verify(
      'RSA-SHA256',
      Buffer.from(stableStringify(payload), 'utf8'),
      authority.publicKeyPem,
      Buffer.from(record.signatureBase64, 'base64'),
    );
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

function hold(status, decisionPacketId, upstream, policy, blockers, preparedByRef, preparedAtIso, registryHash = null) {
  return deepFreeze({
    schemaVersion: 1,
    decisionPacketId,
    upstreamValidationPacketId: upstream?.validationPacketId || null,
    upstreamValidationPacketHashSha256: upstream?.validationPacketHashSha256 || null,
    policyId: policy?.policyId || null,
    releaseCandidate: upstream?.releaseCandidate || null,
    releaseAuthorityRegistryHashSha256: registryHash,
    status,
    blockers: Object.freeze([...blockers]),
    decisions: Object.freeze([]),
    preparedByRef,
    preparedAt: preparedAtIso,
    decisionPacketHashSha256: null,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    mergeExecuted: false,
    deploymentExecuted: false,
    postDecisionExecutionAttestationRequired: true,
    ...professionalBoundary(),
  });
}

function approved(decisions, type) {
  return decisions.some((record) => record.decisionType === type && record.result === DECISION_RESULT.APPROVE);
}

function createHumanReleaseAuthorityDecisionPacket({
  decisionPacketId,
  upstreamValidationPacket,
  policy,
  releaseAuthorityRegistry,
  expectedReleaseAuthorityRegistryHashSha256,
  decisions = [],
  preparedByRef,
  preparedAt,
} = {}) {
  assertNonEmpty(decisionPacketId, 'decisionPacketId');
  assertNonEmpty(preparedByRef, 'preparedByRef');
  const preparedAtIso = iso(preparedAt, 'preparedAt');
  validatePolicy(policy);

  const upstreamQualified = upstreamValidationPacket?.status === E2F_STATUS.EXTERNAL_CONFORMANCE_AND_PRODUCTION_VALIDATION_COMPLETE_PENDING_RELEASE_AUTHORITY
    && verifyExternalConformanceProductionValidationPacketIntegrity(upstreamValidationPacket)
    && policy.requiredUpstreamValidationFlags.every((field) => upstreamValidationPacket[field] === true);
  if (!upstreamQualified) {
    return hold(E2G_STATUS.HOLD_E2F_VALIDATION_PACKET, decisionPacketId.trim(), upstreamValidationPacket, policy, ['E2F_PRODUCTION_VALIDATION_NOT_QUALIFIED'], preparedByRef.trim(), preparedAtIso);
  }

  let registry;
  let expectedRegistryHash;
  try {
    registry = normalizeReleaseAuthorityRegistry(releaseAuthorityRegistry);
    expectedRegistryHash = digest(expectedReleaseAuthorityRegistryHashSha256, 'expectedReleaseAuthorityRegistryHashSha256');
  } catch (error) {
    return hold(E2G_STATUS.HOLD_RELEASE_AUTHORITY_ROOT, decisionPacketId.trim(), upstreamValidationPacket, policy, [error.message], preparedByRef.trim(), preparedAtIso);
  }
  if (registry.registryHashSha256 !== expectedRegistryHash) {
    return hold(E2G_STATUS.HOLD_RELEASE_AUTHORITY_ROOT, decisionPacketId.trim(), upstreamValidationPacket, policy, ['RELEASE_AUTHORITY_REGISTRY_HASH_MISMATCH'], preparedByRef.trim(), preparedAtIso, registry.registryHashSha256);
  }

  if (!Array.isArray(decisions)) throw new TypeError('decisions must be an array');
  let normalized;
  try {
    normalized = decisions.map((record) => normalizeDecision(record, policy));
  } catch (error) {
    return hold(E2G_STATUS.HOLD_DECISION_INTEGRITY, decisionPacketId.trim(), upstreamValidationPacket, policy, [error.message], preparedByRef.trim(), preparedAtIso, registry.registryHashSha256);
  }

  const blockers = [];
  const seenIds = new Set();
  const seenTypes = new Set();
  const authorityById = new Map(registry.authorities.map((record) => [record.authorityId, record]));
  const release = upstreamValidationPacket.releaseCandidate;

  for (const decision of normalized) {
    if (seenIds.has(decision.decisionId)) blockers.push(`DUPLICATE_DECISION_ID:${decision.decisionId}`);
    seenIds.add(decision.decisionId);
    if (seenTypes.has(decision.decisionType)) blockers.push(`DUPLICATE_DECISION_TYPE:${decision.decisionType}`);
    seenTypes.add(decision.decisionType);

    const authority = authorityById.get(decision.authorityId);
    if (!authority) {
      blockers.push(`DECISION_AUTHORITY_NOT_TRUSTED:${decision.decisionId}:${decision.authorityId}`);
      continue;
    }
    if (!authority.allowedDecisionTypes.includes(decision.decisionType)) blockers.push(`DECISION_AUTHORITY_TYPE_NOT_ALLOWED:${decision.decisionId}:${decision.authorityId}:${decision.decisionType}`);
    if (Date.parse(decision.decidedAt) < Date.parse(authority.activeFrom) || (authority.activeUntil && Date.parse(decision.decidedAt) > Date.parse(authority.activeUntil))) blockers.push(`DECISION_AUTHORITY_OUTSIDE_ACTIVE_PERIOD:${decision.decisionId}`);
    if (Date.parse(decision.decidedAt) > Date.parse(preparedAtIso)) blockers.push(`DECISION_AFTER_PACKET_PREPARATION:${decision.decisionId}`);
    if (Date.parse(decision.decidedAt) < Date.parse(upstreamValidationPacket.preparedAt)) blockers.push(`DECISION_BEFORE_E2F_VALIDATION_PACKET:${decision.decisionId}`);
    if (decision.expiresAt && Date.parse(decision.expiresAt) < Date.parse(decision.decidedAt)) blockers.push(`DECISION_EXPIRY_BEFORE_DECISION:${decision.decisionId}`);
    if (decision.expiresAt && Date.parse(decision.expiresAt) < Date.parse(preparedAtIso)) blockers.push(`DECISION_EXPIRED_AT_PACKET_PREPARATION:${decision.decisionId}`);

    if (decision.releaseCandidateId !== release.releaseCandidateId) blockers.push(`DECISION_RELEASE_CANDIDATE_MISMATCH:${decision.decisionId}`);
    if (decision.validationPacketHashSha256 !== upstreamValidationPacket.validationPacketHashSha256) blockers.push(`DECISION_UPSTREAM_VALIDATION_HASH_MISMATCH:${decision.decisionId}`);
    if (decision.sourceCommitSha !== release.sourceCommitSha) blockers.push(`DECISION_SOURCE_COMMIT_MISMATCH:${decision.decisionId}`);
    if (decision.artifactSha256 !== release.artifactSha256) blockers.push(`DECISION_ARTIFACT_HASH_MISMATCH:${decision.decisionId}`);
    if (decision.environmentRef !== release.environmentRef) blockers.push(`DECISION_ENVIRONMENT_MISMATCH:${decision.decisionId}`);
    if (decision.environmentConfigSha256 !== release.environmentConfigSha256) blockers.push(`DECISION_ENV_CONFIG_HASH_MISMATCH:${decision.decisionId}`);
    if (!verifyDecisionSignature(decision, authority, policy)) blockers.push(`DECISION_SIGNATURE_INVALID:${decision.decisionId}`);
  }

  const typeToDecision = new Map(normalized.map((record) => [record.decisionType, record]));
  const releaseDecision = typeToDecision.get(DECISION_TYPE.RELEASE_APPROVAL);
  const mergeDecision = typeToDecision.get(DECISION_TYPE.MERGE_APPROVAL);
  const deployDecision = typeToDecision.get(DECISION_TYPE.DEPLOYMENT_APPROVAL);
  if (mergeDecision && mergeDecision.result === DECISION_RESULT.APPROVE && (!releaseDecision || releaseDecision.result !== DECISION_RESULT.APPROVE)) blockers.push('MERGE_APPROVAL_REQUIRES_RELEASE_APPROVAL');
  if (deployDecision && deployDecision.result === DECISION_RESULT.APPROVE && (!mergeDecision || mergeDecision.result !== DECISION_RESULT.APPROVE)) blockers.push('DEPLOYMENT_APPROVAL_REQUIRES_MERGE_APPROVAL');
  if (mergeDecision && deployDecision) {
    const mergeAuthority = authorityById.get(mergeDecision.authorityId);
    const deployAuthority = authorityById.get(deployDecision.authorityId);
    if (mergeAuthority && deployAuthority && mergeAuthority.authoritySubjectRef === deployAuthority.authoritySubjectRef) blockers.push('MERGE_AND_DEPLOYMENT_SAME_ACTOR_PROHIBITED');
  }
  if (releaseDecision && mergeDecision && deployDecision) {
    const subjects = [releaseDecision, mergeDecision, deployDecision]
      .map((record) => authorityById.get(record.authorityId)?.authoritySubjectRef)
      .filter(Boolean);
    if (new Set(subjects).size === 1) blockers.push('ALL_RELEASE_DECISIONS_SINGLE_ACTOR_PROHIBITED');
  }

  if (blockers.length) {
    return hold(E2G_STATUS.HOLD_DECISION_INTEGRITY, decisionPacketId.trim(), upstreamValidationPacket, policy, blockers, preparedByRef.trim(), preparedAtIso, registry.registryHashSha256);
  }

  const rejected = normalized.filter((record) => record.result === DECISION_RESULT.REJECT);
  if (rejected.length) {
    return hold(E2G_STATUS.HOLD_HUMAN_DECISION_REJECTED, decisionPacketId.trim(), upstreamValidationPacket, policy, rejected.map((record) => `HUMAN_DECISION_REJECTED:${record.decisionType}:${record.decisionId}`), preparedByRef.trim(), preparedAtIso, registry.registryHashSha256);
  }
  const held = normalized.filter((record) => record.result === DECISION_RESULT.HOLD);
  if (held.length) {
    return hold(E2G_STATUS.HOLD_HUMAN_DECISION, decisionPacketId.trim(), upstreamValidationPacket, policy, held.map((record) => `HUMAN_DECISION_HOLD:${record.decisionType}:${record.decisionId}`), preparedByRef.trim(), preparedAtIso, registry.registryHashSha256);
  }

  const releaseApproved = approved(normalized, DECISION_TYPE.RELEASE_APPROVAL);
  const mergeApproved = releaseApproved && approved(normalized, DECISION_TYPE.MERGE_APPROVAL);
  const deploymentApproved = mergeApproved && approved(normalized, DECISION_TYPE.DEPLOYMENT_APPROVAL);

  const status = !releaseApproved
    ? E2G_STATUS.WAITING_FOR_RELEASE_APPROVAL
    : !mergeApproved
      ? E2G_STATUS.WAITING_FOR_MERGE_APPROVAL
      : !deploymentApproved
        ? E2G_STATUS.WAITING_FOR_DEPLOYMENT_APPROVAL
        : E2G_STATUS.HUMAN_RELEASE_DECISIONS_COMPLETE_PENDING_EXECUTION;

  const core = {
    schemaVersion: 1,
    decisionPacketId: decisionPacketId.trim(),
    upstreamValidationPacketId: upstreamValidationPacket.validationPacketId,
    upstreamValidationPacketHashSha256: upstreamValidationPacket.validationPacketHashSha256,
    policyId: policy.policyId,
    releaseCandidate: release,
    releaseAuthorityRegistryId: registry.registryId,
    releaseAuthorityRegistryHashSha256: registry.registryHashSha256,
    decisions: normalized,
    preparedByRef: preparedByRef.trim(),
    preparedAt: preparedAtIso,
  };

  return deepFreeze({
    ...core,
    status,
    blockers: Object.freeze([]),
    decisionPacketHashSha256: sha256(core),
    releaseAuthorized: releaseApproved,
    mergeAuthorized: mergeApproved,
    deploymentAuthorized: deploymentApproved,
    mergeExecuted: false,
    deploymentExecuted: false,
    postDecisionExecutionAttestationRequired: true,
    ...professionalBoundary(),
    semantics: 'E2G accepts only integrity-valid completed E2F production validation and cryptographically verifiable human authority decisions bound to the exact release candidate. Release, merge and deployment approvals are explicit and separate. Decision authorization does not itself execute merge/deployment, activate standards/rules, establish Saudi professional licensing, certify valuation authority, authorize external professional issuance or authorize transactions.',
  });
}

function verifyHumanReleaseAuthorityDecisionPacketIntegrity(packet) {
  if (!packet || !/^[a-f0-9]{64}$/i.test(String(packet.decisionPacketHashSha256 || ''))) return false;
  const core = {
    schemaVersion: packet.schemaVersion,
    decisionPacketId: packet.decisionPacketId,
    upstreamValidationPacketId: packet.upstreamValidationPacketId,
    upstreamValidationPacketHashSha256: packet.upstreamValidationPacketHashSha256,
    policyId: packet.policyId,
    releaseCandidate: packet.releaseCandidate,
    releaseAuthorityRegistryId: packet.releaseAuthorityRegistryId,
    releaseAuthorityRegistryHashSha256: packet.releaseAuthorityRegistryHashSha256,
    decisions: packet.decisions,
    preparedByRef: packet.preparedByRef,
    preparedAt: packet.preparedAt,
  };
  return sha256(core) === packet.decisionPacketHashSha256.toLowerCase();
}

module.exports = {
  E2G_STATUS,
  DECISION_TYPE,
  DECISION_RESULT,
  validatePolicy,
  normalizeReleaseAuthorityRegistry,
  createReleaseDecisionSigningPayload,
  normalizeDecision,
  verifyDecisionSignature,
  createHumanReleaseAuthorityDecisionPacket,
  verifyHumanReleaseAuthorityDecisionPacketIntegrity,
};
