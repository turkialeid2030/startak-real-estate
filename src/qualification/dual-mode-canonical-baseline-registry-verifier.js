'use strict';

const crypto = require('crypto');
const { EXPECTED_CANONICAL_SHA256 } = require('../../tools/canonical-source-evidence');
const {
  MODE,
  STATUS: P32_STATUS,
  evaluateCurrentCanonicalBaselineRegistry,
  stableStringify,
} = require('./canonical-baseline-registry');
const { STATUS: P39_STATUS, TARGET_PATH } = require('./composite-baseline-activation-change-contract');

const STATUS = Object.freeze({
  HOLD_DUAL_MODE_CANONICAL_REGISTRY: 'HOLD_DUAL_MODE_CANONICAL_REGISTRY',
  LEGACY_BASELINE_VERIFIED: 'LEGACY_BASELINE_VERIFIED',
  COMPOSITE_BASELINE_VERIFIED_WITH_SIGNED_HUMAN_AUTHORIZATION: 'COMPOSITE_BASELINE_VERIFIED_WITH_SIGNED_HUMAN_AUTHORIZATION',
});

const AUTHORIZATION_STATUS = Object.freeze({
  HOLD_ACTIVATION_AUTHORITY_TRUST_ROOT: 'HOLD_ACTIVATION_AUTHORITY_TRUST_ROOT',
  HOLD_HUMAN_ACTIVATION_AUTHORIZATION: 'HOLD_HUMAN_ACTIVATION_AUTHORIZATION',
  VERIFIED_HUMAN_ACTIVATION_AUTHORIZATION: 'VERIFIED_HUMAN_ACTIVATION_AUTHORIZATION',
});

const RELEASE_AUTHORITY = Object.freeze({
  releaseAuthorized: false,
  mergeAuthorized: false,
  deploymentAuthorized: false,
  goLiveAuthorized: false,
  transactionAuthorized: false,
});

const ACTIVATION_PURPOSE = 'CANONICAL_BASELINE_ACTIVATION';
const ACTIVATION_DECISION = 'AUTHORIZE';
const SHA256_RE = /^[a-f0-9]{64}$/i;
const COMMIT_RE = /^[a-f0-9]{40}$/i;
const COMPOSITE_TOP_LEVEL_KEYS = Object.freeze([
  'schemaVersion',
  'activeMode',
  'legacyBaseline',
  'governedCompositeBaseline',
  'activationPlanHashSha256',
  'activationApplied',
  'canonicalBaselineChanged',
  'legacyCanonicalEvidenceClosed',
  'existingE2iCanonicalEvidenceSatisfied',
  'releaseAuthorized',
  'mergeAuthorized',
  'deploymentAuthorized',
  'goLiveAuthorized',
  'transactionAuthorized',
]);
const COMPOSITE_BASELINE_KEYS = Object.freeze([
  'baselineId',
  'baselineType',
  'qualifiedSourceCommitSha',
  'releaseArtifactSha256',
  'environmentConfigSha256',
  'supersedesLegacyCanonicalSha256',
  'governanceDecisionHashSha256',
  'reviewerLockHashSha256',
  'successorBaselineManifestHashSha256',
  'cutoverSafetyGuardHashSha256',
]);

function sha256Text(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function sha256Object(value) {
  return sha256Text(stableStringify(value));
}

function canonicalFileContent(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function exactKeys(object, allowed, label) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) throw new TypeError(`${label} must be an object`);
  const actual = Object.keys(object).sort();
  const expected = [...allowed].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new TypeError(`${label} contains missing or unknown fields`);
  }
}

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function requiredSha256(value, field) {
  const normalized = requiredString(value, field).toLowerCase();
  if (!SHA256_RE.test(normalized)) throw new TypeError(`${field} must be a SHA-256 hex digest`);
  return normalized;
}

function iso(value, field) {
  const raw = requiredString(value, field);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return parsed.toISOString();
}

function allReleaseAuthorityFalse(value) {
  return Boolean(value && typeof value === 'object' && Object.keys(RELEASE_AUTHORITY).every((field) => value[field] === false));
}

function hold(blockers, activeMode = null, registryHashSha256 = null) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_DUAL_MODE_CANONICAL_REGISTRY,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    activeMode,
    registryHashSha256,
    legacyBaselineVerified: false,
    compositeRegistryShapeVerified: false,
    p39ActivationChangeContractVerified: false,
    signedHumanActivationAuthorizationVerified: false,
    activationAuthorizedByThisVerifier: false,
    productionEvidenceEstablishedHere: false,
    ...RELEASE_AUTHORITY,
  });
}

function authorizationHold(status, blockers, contract = null, authorityRegistryHashSha256 = null) {
  return deepFreeze({
    schemaVersion: 1,
    status,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    activationChangeContractHashSha256: contract?.activationChangeContractHashSha256 || null,
    authorityRegistryHashSha256,
    authorizedActorRef: null,
    signedPayloadHashSha256: null,
    authorizationVerificationHashSha256: null,
    signatureVerified: false,
    trustRootVerified: false,
    humanDecisionRecordVerified: false,
    ...RELEASE_AUTHORITY,
  });
}

function verifyCompositeRegistryShape(registry) {
  const blockers = [];
  try {
    exactKeys(registry, COMPOSITE_TOP_LEVEL_KEYS, 'composite canonical baseline registry');
    if (registry.schemaVersion !== 2) throw new TypeError('schemaVersion must equal 2 for governed composite baseline');
    if (registry.activeMode !== MODE.GOVERNED_COMPOSITE_BASELINE) throw new TypeError('activeMode must equal GOVERNED_COMPOSITE_BASELINE');

    exactKeys(registry.legacyBaseline, ['expectedSha256', 'sourceAvailability', 'evidenceStatus'], 'legacyBaseline');
    if (requiredSha256(registry.legacyBaseline.expectedSha256, 'legacyBaseline.expectedSha256') !== EXPECTED_CANONICAL_SHA256) {
      throw new TypeError('legacyBaseline.expectedSha256 drifted from pinned historical hash');
    }
    if (registry.legacyBaseline.sourceAvailability !== 'UNAVAILABLE') throw new TypeError('legacyBaseline.sourceAvailability must remain UNAVAILABLE');
    if (registry.legacyBaseline.evidenceStatus !== 'NOT_EVALUATED') throw new TypeError('legacyBaseline.evidenceStatus must remain NOT_EVALUATED');

    exactKeys(registry.governedCompositeBaseline, COMPOSITE_BASELINE_KEYS, 'governedCompositeBaseline');
    const baseline = registry.governedCompositeBaseline;
    requiredString(baseline.baselineId, 'governedCompositeBaseline.baselineId');
    if (baseline.baselineType !== 'QUALIFIED_GIT_COMMIT_AND_RELEASE_ARTIFACT') throw new TypeError('governedCompositeBaseline.baselineType invalid');
    if (!COMMIT_RE.test(requiredString(baseline.qualifiedSourceCommitSha, 'governedCompositeBaseline.qualifiedSourceCommitSha'))) {
      throw new TypeError('governedCompositeBaseline.qualifiedSourceCommitSha invalid');
    }
    for (const field of [
      'releaseArtifactSha256',
      'environmentConfigSha256',
      'supersedesLegacyCanonicalSha256',
      'governanceDecisionHashSha256',
      'reviewerLockHashSha256',
      'successorBaselineManifestHashSha256',
      'cutoverSafetyGuardHashSha256',
    ]) requiredSha256(baseline[field], `governedCompositeBaseline.${field}`);
    if (baseline.supersedesLegacyCanonicalSha256 !== EXPECTED_CANONICAL_SHA256) throw new TypeError('governedCompositeBaseline supersedes unexpected legacy hash');
    requiredSha256(registry.activationPlanHashSha256, 'activationPlanHashSha256');
    if (registry.activationApplied !== true) throw new TypeError('activationApplied must equal true for active composite registry');
    if (registry.canonicalBaselineChanged !== true) throw new TypeError('canonicalBaselineChanged must equal true for active composite registry');
    if (registry.legacyCanonicalEvidenceClosed !== false) throw new TypeError('legacyCanonicalEvidenceClosed must remain false');
    if (registry.existingE2iCanonicalEvidenceSatisfied !== false) throw new TypeError('existingE2iCanonicalEvidenceSatisfied must remain false');
    if (!allReleaseAuthorityFalse(registry)) throw new TypeError('release/merge/deployment/go-live/transaction authority must remain false');
  } catch (error) {
    blockers.push(error.message);
  }
  return blockers;
}

function verifyP39Contract(contract, registry) {
  const blockers = [];
  if (!contract || contract.status !== P39_STATUS.EXPLICIT_ACTIVATION_CHANGE_CONTRACT_READY_NOT_AUTHORIZED) {
    return ['P39_ACTIVATION_CHANGE_CONTRACT_REQUIRED'];
  }
  if (
    contract.activationAuthorizationGranted !== false
    || contract.humanActivationAuthorizationStillRequired !== true
    || contract.actualRegistryMutationPerformed !== false
    || contract.actualReleaseGateModeChanged !== false
    || contract.actualDeploymentMutationPerformed !== false
    || contract.activationApplied !== false
    || contract.canonicalBaselineChanged !== false
    || contract.postActivationReleaseVerifyRequired !== true
    || !allReleaseAuthorityFalse(contract)
  ) blockers.push('P39_ACTIVATION_CHANGE_CONTRACT_BOUNDARY_INVALID');

  const hashFields = [
    'expectedPriorRegistryHashSha256',
    'activationPlanHashSha256',
    'successorBaselineManifestHashSha256',
    'reviewerLockHashSha256',
    'cutoverSafetyGuardHashSha256',
    'proposedRegistryHashSha256',
    'proposedRegistryContentSha256',
    'rollbackRegistryHashSha256',
    'rollbackRegistryContentSha256',
    'activationChangeContractHashSha256',
  ];
  for (const field of hashFields) {
    if (!SHA256_RE.test(contract[field] || '')) blockers.push(`P39_${field.toUpperCase()}_INVALID`);
  }
  if (contract.targetPath !== TARGET_PATH || contract.expectedPriorMode !== MODE.LEGACY_FILE_SHA256 || contract.proposedMode !== MODE.GOVERNED_COMPOSITE_BASELINE) {
    blockers.push('P39_TARGET_OR_MODE_CONTRACT_INVALID');
  }

  const core = {
    schemaVersion: contract.schemaVersion,
    contractId: contract.contractId,
    preparedByRef: contract.preparedByRef,
    preparedAt: contract.preparedAt,
    targetPath: contract.targetPath,
    expectedPriorMode: contract.expectedPriorMode,
    proposedMode: contract.proposedMode,
    expectedPriorRegistryHashSha256: contract.expectedPriorRegistryHashSha256,
    activationPlanHashSha256: contract.activationPlanHashSha256,
    successorBaselineManifestHashSha256: contract.successorBaselineManifestHashSha256,
    reviewerLockHashSha256: contract.reviewerLockHashSha256,
    cutoverSafetyGuardHashSha256: contract.cutoverSafetyGuardHashSha256,
    proposedRegistryHashSha256: contract.proposedRegistryHashSha256,
    proposedRegistryContentSha256: contract.proposedRegistryContentSha256,
    rollbackRegistryHashSha256: contract.rollbackRegistryHashSha256,
    rollbackRegistryContentSha256: contract.rollbackRegistryContentSha256,
  };
  if (sha256Object(core) !== contract.activationChangeContractHashSha256) blockers.push('P39_ACTIVATION_CHANGE_CONTRACT_HASH_MISMATCH');

  const proposedContent = canonicalFileContent(registry);
  if (sha256Object(registry) !== contract.proposedRegistryHashSha256) blockers.push('P39_PROPOSED_REGISTRY_LOGICAL_HASH_MISMATCH');
  if (sha256Text(proposedContent) !== contract.proposedRegistryContentSha256) blockers.push('P39_PROPOSED_REGISTRY_CONTENT_HASH_MISMATCH');
  if (stableStringify(contract.proposedRegistry) !== stableStringify(registry)) blockers.push('P39_PROPOSED_REGISTRY_OBJECT_MISMATCH');
  if (contract.proposedRegistryContent !== proposedContent) blockers.push('P39_PROPOSED_REGISTRY_CONTENT_MISMATCH');
  if (contract.activationPlanHashSha256 !== registry.activationPlanHashSha256) blockers.push('P39_ACTIVATION_PLAN_BINDING_MISMATCH');
  if (contract.successorBaselineManifestHashSha256 !== registry.governedCompositeBaseline.successorBaselineManifestHashSha256) blockers.push('P39_SUCCESSOR_MANIFEST_BINDING_MISMATCH');
  if (contract.reviewerLockHashSha256 !== registry.governedCompositeBaseline.reviewerLockHashSha256) blockers.push('P39_REVIEWER_LOCK_BINDING_MISMATCH');
  if (contract.cutoverSafetyGuardHashSha256 !== registry.governedCompositeBaseline.cutoverSafetyGuardHashSha256) blockers.push('P39_CUTOVER_SAFETY_BINDING_MISMATCH');

  const rollback = evaluateCurrentCanonicalBaselineRegistry(contract.rollbackRegistry);
  if (rollback.status !== P32_STATUS.LEGACY_BASELINE_REGISTRY_CONFIRMED) blockers.push('P39_ROLLBACK_REGISTRY_NOT_VALID_LEGACY_BASELINE');
  else if (rollback.registryHashSha256 !== contract.expectedPriorRegistryHashSha256 || rollback.registryHashSha256 !== contract.rollbackRegistryHashSha256) {
    blockers.push('P39_ROLLBACK_REGISTRY_HASH_BINDING_MISMATCH');
  }
  const rollbackContent = canonicalFileContent(contract.rollbackRegistry);
  if (contract.rollbackRegistryContent !== rollbackContent || sha256Text(rollbackContent) !== contract.rollbackRegistryContentSha256) {
    blockers.push('P39_ROLLBACK_REGISTRY_CONTENT_MISMATCH');
  }
  return blockers;
}

function normalizeActivationAuthorityRegistry(registry) {
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) throw new TypeError('activationAuthorityRegistry must be an object');
  exactKeys(registry, ['registryId', 'governanceArtifactSha256', 'authorities'], 'activationAuthorityRegistry');
  if (!Array.isArray(registry.authorities) || registry.authorities.length === 0) throw new TypeError('activationAuthorityRegistry.authorities must be non-empty');
  const seen = new Set();
  const authorities = registry.authorities.map((record) => {
    exactKeys(record, [
      'authorityId', 'actorRef', 'publicKeyPem', 'publicKeySha256', 'governanceEvidenceRef', 'activeFrom', 'activeUntil', 'allowedPurpose',
    ], 'activationAuthority');
    const authorityId = requiredString(record.authorityId, 'activationAuthority.authorityId');
    if (seen.has(authorityId)) throw new TypeError(`DUPLICATE_ACTIVATION_AUTHORITY_ID:${authorityId}`);
    seen.add(authorityId);
    const publicKeyPem = requiredString(record.publicKeyPem, 'activationAuthority.publicKeyPem');
    const publicKeySha256 = requiredSha256(record.publicKeySha256, 'activationAuthority.publicKeySha256');
    if (sha256Text(publicKeyPem) !== publicKeySha256) throw new TypeError(`ACTIVATION_AUTHORITY_PUBLIC_KEY_HASH_MISMATCH:${authorityId}`);
    return deepFreeze({
      authorityId,
      actorRef: requiredString(record.actorRef, 'activationAuthority.actorRef'),
      publicKeyPem,
      publicKeySha256,
      governanceEvidenceRef: requiredString(record.governanceEvidenceRef, 'activationAuthority.governanceEvidenceRef'),
      activeFrom: iso(record.activeFrom, 'activationAuthority.activeFrom'),
      activeUntil: record.activeUntil ? iso(record.activeUntil, 'activationAuthority.activeUntil') : null,
      allowedPurpose: requiredString(record.allowedPurpose, 'activationAuthority.allowedPurpose'),
    });
  });
  const core = {
    registryId: requiredString(registry.registryId, 'activationAuthorityRegistry.registryId'),
    governanceArtifactSha256: requiredSha256(registry.governanceArtifactSha256, 'activationAuthorityRegistry.governanceArtifactSha256'),
    authorities,
  };
  return deepFreeze({ ...core, registryHashSha256: sha256Object(core) });
}

function createHumanActivationSigningPayload({ contract, attestation } = {}) {
  if (!contract || contract.status !== P39_STATUS.EXPLICIT_ACTIVATION_CHANGE_CONTRACT_READY_NOT_AUTHORIZED) {
    throw new TypeError('P39_ACTIVATION_CHANGE_CONTRACT_REQUIRED');
  }
  if (!attestation || typeof attestation !== 'object' || Array.isArray(attestation)) throw new TypeError('activation attestation must be an object');
  const algorithm = requiredString(attestation.signatureAlgorithm, 'attestation.signatureAlgorithm');
  if (algorithm !== 'RSA-SHA256') throw new TypeError('ACTIVATION_ATTESTATION_SIGNATURE_ALGORITHM_INVALID');
  const decision = requiredString(attestation.decision, 'attestation.decision');
  if (decision !== ACTIVATION_DECISION) throw new TypeError('ACTIVATION_ATTESTATION_DECISION_MUST_AUTHORIZE');
  return deepFreeze({
    schemaVersion: 1,
    purpose: ACTIVATION_PURPOSE,
    contractId: requiredString(contract.contractId, 'contract.contractId'),
    activationChangeContractHashSha256: requiredSha256(contract.activationChangeContractHashSha256, 'contract.activationChangeContractHashSha256'),
    expectedPriorRegistryHashSha256: requiredSha256(contract.expectedPriorRegistryHashSha256, 'contract.expectedPriorRegistryHashSha256'),
    proposedRegistryHashSha256: requiredSha256(contract.proposedRegistryHashSha256, 'contract.proposedRegistryHashSha256'),
    proposedRegistryContentSha256: requiredSha256(contract.proposedRegistryContentSha256, 'contract.proposedRegistryContentSha256'),
    rollbackRegistryHashSha256: requiredSha256(contract.rollbackRegistryHashSha256, 'contract.rollbackRegistryHashSha256'),
    reviewerLockHashSha256: requiredSha256(contract.reviewerLockHashSha256, 'contract.reviewerLockHashSha256'),
    authorityId: requiredString(attestation.authorityId, 'attestation.authorityId'),
    actorRef: requiredString(attestation.actorRef, 'attestation.actorRef'),
    decisionId: requiredString(attestation.decisionId, 'attestation.decisionId'),
    decision,
    decisionSourceRef: requiredString(attestation.decisionSourceRef, 'attestation.decisionSourceRef'),
    decisionArtifactSha256: requiredSha256(attestation.decisionArtifactSha256, 'attestation.decisionArtifactSha256'),
    decidedAt: iso(attestation.decidedAt, 'attestation.decidedAt'),
    rationaleRef: requiredString(attestation.rationaleRef, 'attestation.rationaleRef'),
    signatureAlgorithm: algorithm,
  });
}

function verifyHumanActivationAuthorization({
  contract,
  activationAuthorityRegistry,
  expectedActivationAuthorityRegistryHashSha256,
  attestation,
} = {}) {
  let registry;
  let expectedHash;
  try {
    registry = normalizeActivationAuthorityRegistry(activationAuthorityRegistry);
    expectedHash = requiredSha256(expectedActivationAuthorityRegistryHashSha256, 'expectedActivationAuthorityRegistryHashSha256');
  } catch (error) {
    return authorizationHold(AUTHORIZATION_STATUS.HOLD_ACTIVATION_AUTHORITY_TRUST_ROOT, [error.message], contract);
  }
  if (registry.registryHashSha256 !== expectedHash) {
    return authorizationHold(AUTHORIZATION_STATUS.HOLD_ACTIVATION_AUTHORITY_TRUST_ROOT, ['ACTIVATION_AUTHORITY_REGISTRY_HASH_MISMATCH'], contract, registry.registryHashSha256);
  }

  let payload;
  try {
    payload = createHumanActivationSigningPayload({ contract, attestation });
  } catch (error) {
    return authorizationHold(AUTHORIZATION_STATUS.HOLD_HUMAN_ACTIVATION_AUTHORIZATION, [error.message], contract, registry.registryHashSha256);
  }

  const authority = registry.authorities.find((record) => record.authorityId === payload.authorityId);
  if (!authority) return authorizationHold(AUTHORIZATION_STATUS.HOLD_HUMAN_ACTIVATION_AUTHORIZATION, ['ACTIVATION_AUTHORITY_NOT_IN_TRUSTED_REGISTRY'], contract, registry.registryHashSha256);
  if (authority.actorRef !== payload.actorRef) return authorizationHold(AUTHORIZATION_STATUS.HOLD_HUMAN_ACTIVATION_AUTHORIZATION, ['ACTIVATION_AUTHORITY_ACTOR_SCOPE_MISMATCH'], contract, registry.registryHashSha256);
  if (payload.actorRef !== contract.preparedByRef) return authorizationHold(AUTHORIZATION_STATUS.HOLD_HUMAN_ACTIVATION_AUTHORIZATION, ['ACTIVATION_MUST_BE_AUTHORIZED_BY_P39_OWNER'], contract, registry.registryHashSha256);
  if (authority.allowedPurpose !== ACTIVATION_PURPOSE) return authorizationHold(AUTHORIZATION_STATUS.HOLD_HUMAN_ACTIVATION_AUTHORIZATION, ['ACTIVATION_AUTHORITY_PURPOSE_NOT_ALLOWED'], contract, registry.registryHashSha256);
  const decidedMs = Date.parse(payload.decidedAt);
  if (decidedMs < Date.parse(authority.activeFrom) || (authority.activeUntil && decidedMs > Date.parse(authority.activeUntil))) {
    return authorizationHold(AUTHORIZATION_STATUS.HOLD_HUMAN_ACTIVATION_AUTHORIZATION, ['ACTIVATION_AUTHORITY_OUTSIDE_ACTIVE_PERIOD'], contract, registry.registryHashSha256);
  }

  const signatureBase64 = typeof attestation?.signatureBase64 === 'string' ? attestation.signatureBase64.trim() : '';
  if (!signatureBase64) return authorizationHold(AUTHORIZATION_STATUS.HOLD_HUMAN_ACTIVATION_AUTHORIZATION, ['ACTIVATION_ATTESTATION_SIGNATURE_REQUIRED'], contract, registry.registryHashSha256);
  let signatureVerified = false;
  try {
    signatureVerified = crypto.verify(
      'RSA-SHA256',
      Buffer.from(stableStringify(payload), 'utf8'),
      authority.publicKeyPem,
      Buffer.from(signatureBase64, 'base64'),
    );
  } catch (_) {
    signatureVerified = false;
  }
  if (!signatureVerified) return authorizationHold(AUTHORIZATION_STATUS.HOLD_HUMAN_ACTIVATION_AUTHORIZATION, ['ACTIVATION_ATTESTATION_SIGNATURE_INVALID'], contract, registry.registryHashSha256);

  const core = {
    schemaVersion: 1,
    activationChangeContractHashSha256: contract.activationChangeContractHashSha256,
    authorityRegistryHashSha256: registry.registryHashSha256,
    authorityId: authority.authorityId,
    authorizedActorRef: authority.actorRef,
    publicKeySha256: authority.publicKeySha256,
    decisionId: payload.decisionId,
    decision: payload.decision,
    decidedAt: payload.decidedAt,
    signedPayloadHashSha256: sha256Object(payload),
  };
  return deepFreeze({
    ...core,
    status: AUTHORIZATION_STATUS.VERIFIED_HUMAN_ACTIVATION_AUTHORIZATION,
    verified: true,
    blockers: Object.freeze([]),
    authorizationVerificationHashSha256: sha256Object(core),
    signatureVerified: true,
    trustRootVerified: true,
    humanDecisionRecordVerified: true,
    privateSigningKeyAccepted: false,
    releaseAuthorityGrantedHere: false,
    ...RELEASE_AUTHORITY,
    semantics: 'A human owner authorization record is cryptographically bound to the exact P39 activation-change contract and an out-of-band pinned activation-authority registry. This validates the signed activation decision record; it does not merge, deploy, go live or authorize transactions.',
  });
}

function evaluateDualModeCanonicalBaselineRegistry({
  registry,
  activationChangeContract = null,
  activationAuthorityRegistry = null,
  expectedActivationAuthorityRegistryHashSha256 = null,
  activationAttestation = null,
} = {}) {
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) return hold(['CANONICAL_BASELINE_REGISTRY_OBJECT_REQUIRED']);

  if (registry.activeMode === MODE.LEGACY_FILE_SHA256) {
    const legacy = evaluateCurrentCanonicalBaselineRegistry(registry);
    if (legacy.status !== P32_STATUS.LEGACY_BASELINE_REGISTRY_CONFIRMED) {
      return hold(legacy.blockers || ['LEGACY_BASELINE_REGISTRY_NOT_CONFIRMED'], MODE.LEGACY_FILE_SHA256, legacy.registryHashSha256 || null);
    }
    return deepFreeze({
      schemaVersion: 1,
      status: STATUS.LEGACY_BASELINE_VERIFIED,
      verified: true,
      blockers: Object.freeze([]),
      activeMode: MODE.LEGACY_FILE_SHA256,
      registryHashSha256: legacy.registryHashSha256,
      legacyBaselineVerified: true,
      compositeRegistryShapeVerified: false,
      p39ActivationChangeContractVerified: false,
      signedHumanActivationAuthorizationVerified: false,
      activationAuthorizedByThisVerifier: false,
      activationAppliedObserved: false,
      canonicalBaselineChangedObserved: false,
      productionEvidenceEstablishedHere: false,
      ...RELEASE_AUTHORITY,
      semantics: 'P40 preserves the existing strict P32 legacy-baseline verification unchanged. No composite activation evidence is needed while LEGACY_FILE_SHA256 remains active.',
    });
  }

  if (registry.activeMode !== MODE.GOVERNED_COMPOSITE_BASELINE) return hold(['CANONICAL_BASELINE_ACTIVE_MODE_UNSUPPORTED'], registry.activeMode || null);

  const shapeBlockers = verifyCompositeRegistryShape(registry);
  if (shapeBlockers.length > 0) return hold(shapeBlockers, MODE.GOVERNED_COMPOSITE_BASELINE, null);
  const registryHashSha256 = sha256Object(registry);

  const contractBlockers = verifyP39Contract(activationChangeContract, registry);
  if (contractBlockers.length > 0) return hold(contractBlockers, MODE.GOVERNED_COMPOSITE_BASELINE, registryHashSha256);

  const authorization = verifyHumanActivationAuthorization({
    contract: activationChangeContract,
    activationAuthorityRegistry,
    expectedActivationAuthorityRegistryHashSha256,
    attestation: activationAttestation,
  });
  if (authorization.status !== AUTHORIZATION_STATUS.VERIFIED_HUMAN_ACTIVATION_AUTHORIZATION || authorization.verified !== true) {
    return hold([
      'SIGNED_HUMAN_ACTIVATION_AUTHORIZATION_REQUIRED',
      ...(authorization.blockers || []),
    ], MODE.GOVERNED_COMPOSITE_BASELINE, registryHashSha256);
  }

  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.COMPOSITE_BASELINE_VERIFIED_WITH_SIGNED_HUMAN_AUTHORIZATION,
    verified: true,
    blockers: Object.freeze([]),
    activeMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    registryHashSha256,
    legacyBaselineVerified: false,
    compositeRegistryShapeVerified: true,
    p39ActivationChangeContractVerified: true,
    activationChangeContractHashSha256: activationChangeContract.activationChangeContractHashSha256,
    signedHumanActivationAuthorizationVerified: true,
    activationAuthorizationVerificationHashSha256: authorization.authorizationVerificationHashSha256,
    activationAuthorizedByThisVerifier: false,
    activationAppliedObserved: true,
    canonicalBaselineChangedObserved: true,
    historicalLegacySourceEvidenceStillNotEvaluated: true,
    existingE2iCanonicalEvidenceSatisfied: false,
    productionEvidenceEstablishedHere: false,
    ...RELEASE_AUTHORITY,
    semantics: 'P40 recognizes an active governed-composite registry only when it exactly matches a deterministic P39 contract and a cryptographically verified human owner authorization bound to an out-of-band trust root. This verifies registry activation evidence; it grants no release, merge, deployment, go-live or transaction authority.',
  });
}

module.exports = {
  STATUS,
  AUTHORIZATION_STATUS,
  ACTIVATION_PURPOSE,
  ACTIVATION_DECISION,
  RELEASE_AUTHORITY,
  normalizeActivationAuthorityRegistry,
  createHumanActivationSigningPayload,
  verifyHumanActivationAuthorization,
  evaluateDualModeCanonicalBaselineRegistry,
};
