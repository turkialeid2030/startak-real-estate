'use strict';

const crypto = require('crypto');
const { EXPECTED_CANONICAL_SHA256 } = require('../../tools/canonical-source-evidence');
const { STATUS: P31_STATUS } = require('./canonical-rebaseline-activation-plan');

const MODE = Object.freeze({
  LEGACY_FILE_SHA256: 'LEGACY_FILE_SHA256',
  GOVERNED_COMPOSITE_BASELINE: 'GOVERNED_COMPOSITE_BASELINE',
});

const STATUS = Object.freeze({
  HOLD_CANONICAL_BASELINE_REGISTRY: 'HOLD_CANONICAL_BASELINE_REGISTRY',
  LEGACY_BASELINE_REGISTRY_CONFIRMED: 'LEGACY_BASELINE_REGISTRY_CONFIRMED',
  COMPOSITE_REGISTRY_CANDIDATE_READY_FOR_EXPLICIT_CODE_CHANGE: 'COMPOSITE_REGISTRY_CANDIDATE_READY_FOR_EXPLICIT_CODE_CHANGE',
});

const AUTHORITY = Object.freeze({
  releaseAuthorized: false,
  mergeAuthorized: false,
  deploymentAuthorized: false,
  goLiveAuthorized: false,
  transactionAuthorized: false,
});

const SHA256_RE = /^[a-f0-9]{64}$/i;
const TOP_LEVEL_KEYS = Object.freeze([
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

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(stableStringify(value), 'utf8').digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function hold(blockers) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_CANONICAL_BASELINE_REGISTRY,
    blockers: Object.freeze([...blockers]),
    registryHashSha256: null,
    activeMode: null,
    explicitActivationChangeRequired: true,
    p31ActivationPlanRequired: true,
    activationApplied: false,
    canonicalBaselineChanged: false,
    legacyCanonicalEvidenceClosed: false,
    existingE2iCanonicalEvidenceSatisfied: false,
    ...AUTHORITY,
  });
}

function exactKeys(object, allowed, label) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) throw new TypeError(`${label} must be an object`);
  const actual = Object.keys(object).sort();
  const expected = [...allowed].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new TypeError(`${label} contains missing or unknown fields`);
  }
}

function assertAuthorityFalse(registry) {
  for (const field of Object.keys(AUTHORITY)) {
    if (registry[field] !== false) throw new TypeError(`${field} must remain false`);
  }
}

function evaluateCurrentCanonicalBaselineRegistry(registry) {
  try {
    exactKeys(registry, TOP_LEVEL_KEYS, 'canonical baseline registry');
    if (registry.schemaVersion !== 1) throw new TypeError('schemaVersion must equal 1');
    if (registry.activeMode !== MODE.LEGACY_FILE_SHA256) throw new TypeError('activeMode must remain LEGACY_FILE_SHA256 until an explicit reviewed activation change');

    exactKeys(registry.legacyBaseline, ['expectedSha256', 'sourceAvailability', 'evidenceStatus'], 'legacyBaseline');
    if (!SHA256_RE.test(registry.legacyBaseline.expectedSha256 || '')) throw new TypeError('legacyBaseline.expectedSha256 invalid');
    if (registry.legacyBaseline.expectedSha256.toLowerCase() !== EXPECTED_CANONICAL_SHA256) throw new TypeError('legacyBaseline.expectedSha256 drifted from pinned legacy hash');
    if (registry.legacyBaseline.sourceAvailability !== 'UNAVAILABLE') throw new TypeError('legacyBaseline.sourceAvailability must remain UNAVAILABLE');
    if (registry.legacyBaseline.evidenceStatus !== 'NOT_EVALUATED') throw new TypeError('legacyBaseline.evidenceStatus must remain NOT_EVALUATED while original bytes are unavailable');

    if (registry.governedCompositeBaseline !== null) throw new TypeError('governedCompositeBaseline must remain null before explicit activation');
    if (registry.activationPlanHashSha256 !== null) throw new TypeError('activationPlanHashSha256 must remain null before explicit activation');
    if (registry.activationApplied !== false) throw new TypeError('activationApplied must remain false');
    if (registry.canonicalBaselineChanged !== false) throw new TypeError('canonicalBaselineChanged must remain false');
    if (registry.legacyCanonicalEvidenceClosed !== false) throw new TypeError('legacyCanonicalEvidenceClosed must remain false');
    if (registry.existingE2iCanonicalEvidenceSatisfied !== false) throw new TypeError('existingE2iCanonicalEvidenceSatisfied must remain false');
    assertAuthorityFalse(registry);

    const normalized = {
      schemaVersion: 1,
      activeMode: MODE.LEGACY_FILE_SHA256,
      legacyBaseline: {
        expectedSha256: EXPECTED_CANONICAL_SHA256,
        sourceAvailability: 'UNAVAILABLE',
        evidenceStatus: 'NOT_EVALUATED',
      },
      governedCompositeBaseline: null,
      activationPlanHashSha256: null,
      activationApplied: false,
      canonicalBaselineChanged: false,
      legacyCanonicalEvidenceClosed: false,
      existingE2iCanonicalEvidenceSatisfied: false,
      ...AUTHORITY,
    };

    return deepFreeze({
      schemaVersion: 1,
      status: STATUS.LEGACY_BASELINE_REGISTRY_CONFIRMED,
      activeMode: MODE.LEGACY_FILE_SHA256,
      registryHashSha256: sha256(normalized),
      blockers: Object.freeze([]),
      explicitActivationChangeRequired: true,
      p31ActivationPlanRequired: true,
      activationApplied: false,
      canonicalBaselineChanged: false,
      legacyCanonicalEvidenceClosed: false,
      existingE2iCanonicalEvidenceSatisfied: false,
      ...AUTHORITY,
      semantics: 'The repository explicitly records the current legacy file-SHA256 baseline and its unavailable/not-evaluated evidence state. This confirmation prevents a silent baseline-mode drift; it does not verify the missing historical source or authorize a successor baseline.',
    });
  } catch (error) {
    return hold([error.message]);
  }
}

function createGovernedCompositeBaselineRegistryCandidate({ activationPlan } = {}) {
  if (!activationPlan || activationPlan.status !== P31_STATUS.READY_FOR_EXPLICIT_BASELINE_ACTIVATION_CHANGE_PLAN) {
    return hold(['P31_ACTIVATION_PLAN_REQUIRED']);
  }
  if (!SHA256_RE.test(activationPlan.activationPlanHashSha256 || '') || !SHA256_RE.test(activationPlan.successorBaselineManifestHashSha256 || '')) {
    return hold(['P31_ACTIVATION_PLAN_HASHES_INVALID']);
  }
  if (
    activationPlan.activationApplied !== false
    || activationPlan.canonicalBaselineChanged !== false
    || activationPlan.releaseAuthorized !== false
    || activationPlan.mergeAuthorized !== false
    || activationPlan.deploymentAuthorized !== false
    || activationPlan.goLiveAuthorized !== false
    || activationPlan.transactionAuthorized !== false
  ) return hold(['P31_AUTHORITY_BOUNDARY_INVALID']);

  const candidateCore = {
    schemaVersion: 1,
    requestedMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    supersedesMode: MODE.LEGACY_FILE_SHA256,
    supersedesLegacyCanonicalSha256: EXPECTED_CANONICAL_SHA256,
    successorBaselineManifest: activationPlan.successorBaselineManifest,
    successorBaselineManifestHashSha256: activationPlan.successorBaselineManifestHashSha256,
    activationPlanHashSha256: activationPlan.activationPlanHashSha256,
    targetPath: activationPlan.targetActivationContract.targetPath,
  };

  return deepFreeze({
    ...candidateCore,
    status: STATUS.COMPOSITE_REGISTRY_CANDIDATE_READY_FOR_EXPLICIT_CODE_CHANGE,
    candidateRegistryHashSha256: sha256(candidateCore),
    explicitActivationChangeRequired: true,
    candidateOnly: true,
    activationApplied: false,
    canonicalBaselineChanged: false,
    legacyCanonicalEvidenceClosed: false,
    existingE2iCanonicalEvidenceSatisfied: false,
    ...AUTHORITY,
    semantics: 'This is a deterministic candidate for the separate reviewed registry code change described by P31. It is not the active registry and cannot be treated as baseline activation evidence.',
  });
}

module.exports = {
  MODE,
  STATUS,
  AUTHORITY,
  evaluateCurrentCanonicalBaselineRegistry,
  createGovernedCompositeBaselineRegistryCandidate,
  stableStringify,
};
