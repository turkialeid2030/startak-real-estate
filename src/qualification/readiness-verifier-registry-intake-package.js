'use strict';

const {
  EVIDENCE_TYPE,
  normalizeReadinessVerifierRegistry,
} = require('../standards/production-evidence-go-live-readiness');

const STATUS = Object.freeze({
  HOLD_INVALID_READINESS_VERIFIER_REGISTRY: 'HOLD_INVALID_READINESS_VERIFIER_REGISTRY',
  HOLD_READINESS_VERIFIER_COVERAGE: 'HOLD_READINESS_VERIFIER_COVERAGE',
  HOLD_READINESS_VERIFIER_SUBJECT_DIVERSITY: 'HOLD_READINESS_VERIFIER_SUBJECT_DIVERSITY',
  READY_FOR_OUT_OF_BAND_TRUST_ROOT_PINNING: 'READY_FOR_OUT_OF_BAND_TRUST_ROOT_PINNING',
});

const REQUIRED_EVIDENCE_TYPES = Object.freeze(Object.values(EVIDENCE_TYPE));

const AUTHORITY = Object.freeze({
  releaseAuthorized: false,
  mergeAuthorized: false,
  deploymentAuthorized: false,
  goLiveAuthorized: false,
  transactionAuthorized: false,
  readinessVerifierTrustEstablished: false,
  readinessVerifierRegistryPinnedOutOfBand: false,
  externalEvidenceAccepted: false,
  legalApprovalEstablished: false,
  professionalAuthorityEstablished: false,
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function containsForbiddenSecretMaterial(value, path = 'registry') {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const hit = containsForbiddenSecretMaterial(value[index], `${path}[${index}]`);
      if (hit) return hit;
    }
    return null;
  }
  for (const [key, child] of Object.entries(value)) {
    if (/(private.?key|secret|password|token|credential)/i.test(key)) return `${path}.${key}`;
    const hit = containsForbiddenSecretMaterial(child, `${path}.${key}`);
    if (hit) return hit;
  }
  return null;
}

function hold(status, blockers, normalizedRegistry = null, coverage = null) {
  return deepFreeze({
    schemaVersion: 1,
    status,
    blockers: Object.freeze([...blockers]),
    requiredEvidenceTypes: REQUIRED_EVIDENCE_TYPES,
    normalizedRegistry,
    registryId: normalizedRegistry?.registryId || null,
    registryHashSha256: normalizedRegistry?.registryHashSha256 || null,
    outOfBandPinValue: null,
    coverage,
    allRequiredEvidenceTypesCovered: false,
    minimumDistinctVerifierSubjectsSatisfied: false,
    outOfBandPinningStillRequired: true,
    e2iAcceptancePending: true,
    privateSigningKeyAccepted: false,
    authority: AUTHORITY,
  });
}

function buildCoverage(normalizedRegistry) {
  const coverage = {};
  for (const evidenceType of REQUIRED_EVIDENCE_TYPES) {
    const matching = normalizedRegistry.verifiers.filter((record) => record.allowedEvidenceTypes.includes(evidenceType));
    coverage[evidenceType] = Object.freeze(matching.map((record) => Object.freeze({
      verifierId: record.verifierId,
      verifierSubjectRef: record.verifierSubjectRef,
      publicKeySha256: record.publicKeySha256,
    })));
  }
  return deepFreeze(coverage);
}

function prepareReadinessVerifierRegistryIntake({ registry } = {}) {
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) {
    return hold(STATUS.HOLD_INVALID_READINESS_VERIFIER_REGISTRY, ['READINESS_VERIFIER_REGISTRY_REQUIRED']);
  }

  const forbiddenPath = containsForbiddenSecretMaterial(registry);
  if (forbiddenPath) {
    return hold(STATUS.HOLD_INVALID_READINESS_VERIFIER_REGISTRY, [`FORBIDDEN_SECRET_MATERIAL:${forbiddenPath}`]);
  }

  let normalizedRegistry;
  try {
    normalizedRegistry = normalizeReadinessVerifierRegistry(registry);
  } catch (error) {
    return hold(STATUS.HOLD_INVALID_READINESS_VERIFIER_REGISTRY, [error.message]);
  }

  const coverage = buildCoverage(normalizedRegistry);
  const missingEvidenceTypes = REQUIRED_EVIDENCE_TYPES.filter((type) => coverage[type].length === 0);
  if (missingEvidenceTypes.length > 0) {
    return hold(
      STATUS.HOLD_READINESS_VERIFIER_COVERAGE,
      missingEvidenceTypes.map((type) => `READINESS_VERIFIER_COVERAGE_MISSING:${type}`),
      normalizedRegistry,
      coverage,
    );
  }

  const distinctSubjects = [...new Set(normalizedRegistry.verifiers.map((record) => record.verifierSubjectRef))].sort();
  if (distinctSubjects.length < 2) {
    return hold(
      STATUS.HOLD_READINESS_VERIFIER_SUBJECT_DIVERSITY,
      ['AT_LEAST_TWO_DISTINCT_READINESS_VERIFIER_SUBJECTS_REQUIRED'],
      normalizedRegistry,
      coverage,
    );
  }

  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.READY_FOR_OUT_OF_BAND_TRUST_ROOT_PINNING,
    blockers: Object.freeze([]),
    requiredEvidenceTypes: REQUIRED_EVIDENCE_TYPES,
    normalizedRegistry,
    registryId: normalizedRegistry.registryId,
    registryHashSha256: normalizedRegistry.registryHashSha256,
    outOfBandPinValue: normalizedRegistry.registryHashSha256,
    coverage,
    distinctVerifierSubjects: Object.freeze(distinctSubjects),
    allRequiredEvidenceTypesCovered: true,
    minimumDistinctVerifierSubjectsSatisfied: true,
    outOfBandPinningStillRequired: true,
    e2iAcceptancePending: true,
    privateSigningKeyAccepted: false,
    authority: AUTHORITY,
    semantics: 'This package validates the structural integrity and E2I evidence-type coverage of a proposed production-readiness verifier registry and emits the deterministic registry SHA-256 that must be pinned out of band. It does not establish verifier identity or trust, perform the out-of-band pinning, accept external evidence, authorize release/merge/deployment/go-live/transactions, or establish legal/professional authority.',
  });
}

module.exports = {
  STATUS,
  REQUIRED_EVIDENCE_TYPES,
  AUTHORITY,
  containsForbiddenSecretMaterial,
  buildCoverage,
  prepareReadinessVerifierRegistryIntake,
};
