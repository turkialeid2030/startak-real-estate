'use strict';

const fs = require('fs');
const path = require('path');
const {
  STATUS: DUAL_MODE_STATUS,
  evaluateDualModeCanonicalBaselineRegistry,
} = require('../src/qualification/dual-mode-canonical-baseline-registry-verifier');
const {
  STATUS: FRESH_DUAL_MODE_STATUS,
  verifyFreshDualModeCanonicalRegistry,
} = require('../src/qualification/fresh-dual-mode-canonical-registry-verifier');
const { MODE } = require('../src/qualification/canonical-baseline-registry');

const STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  MISSING: 'MISSING',
  MALFORMED: 'MALFORMED',
  REGISTRY_HOLD: 'REGISTRY_HOLD',
});

const DEFAULT_REGISTRY_PATH = path.join(__dirname, '..', 'config', 'governance', 'canonical-baseline.json');
const MAX_REGISTRY_BYTES = 256 * 1024;
const MAX_CONTRACT_BYTES = 2 * 1024 * 1024;
const MAX_ACTIVATION_PLAN_BYTES = 2 * 1024 * 1024;
const MAX_CANDIDATE_BYTES = 2 * 1024 * 1024;
const MAX_SAFETY_GUARD_BYTES = 2 * 1024 * 1024;
const MAX_AUTHORITY_REGISTRY_BYTES = 2 * 1024 * 1024;
const MAX_ATTESTATION_BYTES = 512 * 1024;

function result(status, verified, reasonCode, extra = {}) {
  return Object.freeze({ status, verified, reasonCode, ...extra });
}

function safeReadJson(filePath, fsModule, maxBytes, reasonPrefix) {
  if (typeof filePath !== 'string' || filePath.trim() === '') {
    return { ok: false, reasonCode: `${reasonPrefix}_PATH_REQUIRED` };
  }
  try {
    const stat = fsModule.lstatSync(filePath);
    if (stat.isSymbolicLink()) return { ok: false, reasonCode: `${reasonPrefix}_SYMLINK_REJECTED` };
    if (!stat.isFile()) return { ok: false, reasonCode: `${reasonPrefix}_FILE_REQUIRED` };
    if (stat.size > maxBytes) return { ok: false, reasonCode: `${reasonPrefix}_FILE_TOO_LARGE` };
    const raw = fsModule.readFileSync(filePath, 'utf8');
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false, reasonCode: `${reasonPrefix}_JSON_OBJECT_REQUIRED` };
    }
    return { ok: true, value, raw };
  } catch (error) {
    if (error && error.code === 'ENOENT') return { ok: false, reasonCode: `${reasonPrefix}_FILE_MISSING` };
    if (error instanceof SyntaxError) return { ok: false, reasonCode: `${reasonPrefix}_JSON_INVALID` };
    return { ok: false, reasonCode: `${reasonPrefix}_FILE_UNAVAILABLE` };
  }
}

function missingFileStatus(reasonCode) {
  return reasonCode.endsWith('_PATH_REQUIRED')
    || reasonCode.endsWith('_FILE_MISSING')
    || reasonCode.endsWith('_FILE_REQUIRED');
}

function verifyLegacyRegistry(registryRead) {
  // Preserve the pre-P59 legacy contract: semantic JSON verification only.
  // Exact raw file-content binding is mandatory only for the new schema-v3
  // active-composite path, where P57 binds canonical bytes explicitly.
  const evaluated = verifyFreshDualModeCanonicalRegistry({ registry: registryRead.value });
  if (evaluated.status !== FRESH_DUAL_MODE_STATUS.LEGACY_BASELINE_VERIFIED || evaluated.verified !== true) {
    return result(STATUS.REGISTRY_HOLD, false, 'CANONICAL_BASELINE_LEGACY_NOT_VERIFIED', {
      blockers: evaluated.blockers || Object.freeze([]),
      activeMode: evaluated.activeMode || MODE.LEGACY_FILE_SHA256,
      registryHashSha256: evaluated.registryHashSha256 || null,
      registryContentSha256: evaluated.registryContentSha256 || null,
      activationAuthorizationGrantedByGate: false,
    });
  }
  return result(STATUS.VERIFIED, true, null, {
    activeMode: evaluated.activeMode,
    registrySchemaVersion: 1,
    registryHashSha256: evaluated.registryHashSha256,
    registryContentSha256: evaluated.registryContentSha256,
    verificationMode: 'LEGACY_STRICT',
    p39ActivationChangeContractVerified: false,
    signedHumanActivationAuthorizationVerified: false,
    p57ActivationChangeContractVerified: false,
    freshOwnerAuthorizationReverified: false,
    rollbackRegistryVerified: false,
    activationAuthorizationGrantedByGate: false,
    activationApplied: false,
    canonicalBaselineChanged: false,
    activationAppliedObserved: false,
    canonicalBaselineChangedObserved: false,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    goLiveAuthorized: false,
    transactionAuthorized: false,
  });
}

function verifyHistoricalSchemaV2Composite({ registry, env, fsModule }) {
  const required = {
    contract: env.CANONICAL_BASELINE_ACTIVATION_CONTRACT_PATH,
    authorityRegistry: env.CANONICAL_BASELINE_ACTIVATION_AUTHORITY_REGISTRY_PATH,
    attestation: env.CANONICAL_BASELINE_ACTIVATION_ATTESTATION_PATH,
    expectedAuthorityRegistryHash: env.EXPECTED_CANONICAL_BASELINE_ACTIVATION_AUTHORITY_REGISTRY_SHA256,
  };
  const missingInputs = Object.entries(required)
    .filter(([, value]) => typeof value !== 'string' || value.trim() === '')
    .map(([key]) => key);
  if (missingInputs.length > 0) {
    return result(STATUS.REGISTRY_HOLD, false, 'COMPOSITE_BASELINE_ACTIVATION_EVIDENCE_REQUIRED', {
      blockers: Object.freeze(missingInputs.map((key) => `MISSING_${key.toUpperCase()}`)),
      activeMode: MODE.GOVERNED_COMPOSITE_BASELINE,
      registrySchemaVersion: 2,
      registryHashSha256: null,
      activationAuthorizationGrantedByGate: false,
    });
  }

  const contractRead = safeReadJson(required.contract, fsModule, MAX_CONTRACT_BYTES, 'CANONICAL_BASELINE_ACTIVATION_CONTRACT');
  if (!contractRead.ok) return result(STATUS.REGISTRY_HOLD, false, contractRead.reasonCode, { activeMode: MODE.GOVERNED_COMPOSITE_BASELINE, registrySchemaVersion: 2, activationAuthorizationGrantedByGate: false });
  const authorityRead = safeReadJson(required.authorityRegistry, fsModule, MAX_AUTHORITY_REGISTRY_BYTES, 'CANONICAL_BASELINE_ACTIVATION_AUTHORITY_REGISTRY');
  if (!authorityRead.ok) return result(STATUS.REGISTRY_HOLD, false, authorityRead.reasonCode, { activeMode: MODE.GOVERNED_COMPOSITE_BASELINE, registrySchemaVersion: 2, activationAuthorizationGrantedByGate: false });
  const attestationRead = safeReadJson(required.attestation, fsModule, MAX_ATTESTATION_BYTES, 'CANONICAL_BASELINE_ACTIVATION_ATTESTATION');
  if (!attestationRead.ok) return result(STATUS.REGISTRY_HOLD, false, attestationRead.reasonCode, { activeMode: MODE.GOVERNED_COMPOSITE_BASELINE, registrySchemaVersion: 2, activationAuthorizationGrantedByGate: false });

  const evaluated = evaluateDualModeCanonicalBaselineRegistry({
    registry,
    activationChangeContract: contractRead.value,
    activationAuthorityRegistry: authorityRead.value,
    expectedActivationAuthorityRegistryHashSha256: required.expectedAuthorityRegistryHash,
    activationAttestation: attestationRead.value,
  });
  if (evaluated.status !== DUAL_MODE_STATUS.COMPOSITE_BASELINE_VERIFIED_WITH_SIGNED_HUMAN_AUTHORIZATION || evaluated.verified !== true) {
    return result(STATUS.REGISTRY_HOLD, false, 'COMPOSITE_BASELINE_ACTIVATION_EVIDENCE_NOT_VERIFIED', {
      blockers: evaluated.blockers || Object.freeze([]),
      activeMode: MODE.GOVERNED_COMPOSITE_BASELINE,
      registrySchemaVersion: 2,
      registryHashSha256: evaluated.registryHashSha256 || null,
      activationAuthorizationGrantedByGate: false,
    });
  }

  return result(STATUS.VERIFIED, true, null, {
    activeMode: evaluated.activeMode,
    registrySchemaVersion: 2,
    registryHashSha256: evaluated.registryHashSha256,
    verificationMode: 'GOVERNED_COMPOSITE_WITH_SIGNED_HUMAN_AUTHORIZATION',
    p39ActivationChangeContractVerified: evaluated.p39ActivationChangeContractVerified,
    signedHumanActivationAuthorizationVerified: evaluated.signedHumanActivationAuthorizationVerified,
    activationAuthorizationVerificationHashSha256: evaluated.activationAuthorizationVerificationHashSha256,
    p57ActivationChangeContractVerified: false,
    freshOwnerAuthorizationReverified: false,
    rollbackRegistryVerified: false,
    activationAuthorizationGrantedByGate: false,
    activationApplied: true,
    canonicalBaselineChanged: true,
    activationAppliedObserved: true,
    canonicalBaselineChangedObserved: true,
    legacyCanonicalEvidenceClosed: false,
    existingE2iCanonicalEvidenceSatisfied: false,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    goLiveAuthorized: false,
    transactionAuthorized: false,
  });
}

function verifyFreshSchemaV3Composite({ registryRead, env, fsModule }) {
  const required = {
    activationContract: env.FRESH_CANONICAL_ACTIVATION_CONTRACT_PATH,
    activationPlan: env.FRESH_CANONICAL_ACTIVATION_PLAN_PATH,
    candidate: env.FRESH_CANONICAL_COMPOSITE_CANDIDATE_PATH,
    safetyGuard: env.FRESH_CANONICAL_CUTOVER_SAFETY_GUARD_PATH,
    ownerAuthorityRegistry: env.FRESH_CANONICAL_OWNER_AUTHORITY_REGISTRY_PATH,
    expectedOwnerAuthorityRegistryHash: env.EXPECTED_FRESH_CANONICAL_OWNER_AUTHORITY_REGISTRY_SHA256,
    signedOwnerDecision: env.FRESH_CANONICAL_SIGNED_OWNER_DECISION_PATH,
  };
  const missingInputs = Object.entries(required)
    .filter(([, value]) => typeof value !== 'string' || value.trim() === '')
    .map(([key]) => key);
  if (missingInputs.length > 0) {
    return result(STATUS.REGISTRY_HOLD, false, 'FRESH_COMPOSITE_BASELINE_ACTIVATION_EVIDENCE_REQUIRED', {
      blockers: Object.freeze(missingInputs.map((key) => `MISSING_${key.toUpperCase()}`)),
      activeMode: MODE.GOVERNED_COMPOSITE_BASELINE,
      registrySchemaVersion: 3,
      activationAuthorizationGrantedByGate: false,
    });
  }

  const reads = {
    activationChangeContract: safeReadJson(required.activationContract, fsModule, MAX_CONTRACT_BYTES, 'FRESH_CANONICAL_ACTIVATION_CONTRACT'),
    activationPlan: safeReadJson(required.activationPlan, fsModule, MAX_ACTIVATION_PLAN_BYTES, 'FRESH_CANONICAL_ACTIVATION_PLAN'),
    freshCompositeCandidate: safeReadJson(required.candidate, fsModule, MAX_CANDIDATE_BYTES, 'FRESH_CANONICAL_COMPOSITE_CANDIDATE'),
    safetyGuard: safeReadJson(required.safetyGuard, fsModule, MAX_SAFETY_GUARD_BYTES, 'FRESH_CANONICAL_CUTOVER_SAFETY_GUARD'),
    freshOwnerAuthorityRegistry: safeReadJson(required.ownerAuthorityRegistry, fsModule, MAX_AUTHORITY_REGISTRY_BYTES, 'FRESH_CANONICAL_OWNER_AUTHORITY_REGISTRY'),
    signedOwnerDecision: safeReadJson(required.signedOwnerDecision, fsModule, MAX_ATTESTATION_BYTES, 'FRESH_CANONICAL_SIGNED_OWNER_DECISION'),
  };
  for (const [key, read] of Object.entries(reads)) {
    if (!read.ok) {
      return result(STATUS.REGISTRY_HOLD, false, read.reasonCode, {
        blockers: Object.freeze([`${key.toUpperCase()}_NOT_READABLE`]),
        activeMode: MODE.GOVERNED_COMPOSITE_BASELINE,
        registrySchemaVersion: 3,
        activationAuthorizationGrantedByGate: false,
      });
    }
  }

  const evaluated = verifyFreshDualModeCanonicalRegistry({
    registry: registryRead.value,
    observedRegistryContent: registryRead.raw,
    activationChangeContract: reads.activationChangeContract.value,
    activationPlan: reads.activationPlan.value,
    freshCompositeCandidate: reads.freshCompositeCandidate.value,
    safetyGuard: reads.safetyGuard.value,
    freshOwnerAuthorityRegistry: reads.freshOwnerAuthorityRegistry.value,
    expectedFreshOwnerAuthorityRegistryHashSha256: required.expectedOwnerAuthorityRegistryHash,
    signedOwnerDecision: reads.signedOwnerDecision.value,
  });
  if (evaluated.status !== FRESH_DUAL_MODE_STATUS.FRESH_COMPOSITE_BASELINE_VERIFIED_WITH_FRESH_OWNER_AUTHORIZATION || evaluated.verified !== true) {
    return result(STATUS.REGISTRY_HOLD, false, 'FRESH_COMPOSITE_BASELINE_ACTIVATION_EVIDENCE_NOT_VERIFIED', {
      blockers: evaluated.blockers || Object.freeze([]),
      activeMode: MODE.GOVERNED_COMPOSITE_BASELINE,
      registrySchemaVersion: 3,
      registryHashSha256: evaluated.registryHashSha256 || null,
      registryContentSha256: evaluated.registryContentSha256 || null,
      activationAuthorizationGrantedByGate: false,
    });
  }

  return result(STATUS.VERIFIED, true, null, {
    activeMode: evaluated.activeMode,
    registrySchemaVersion: 3,
    registryHashSha256: evaluated.registryHashSha256,
    registryContentSha256: evaluated.registryContentSha256,
    verificationMode: 'FRESH_GOVERNED_COMPOSITE_WITH_REVERIFIED_OWNER_AUTHORIZATION',
    p39ActivationChangeContractVerified: false,
    signedHumanActivationAuthorizationVerified: false,
    p57ActivationChangeContractVerified: evaluated.p57ActivationChangeContractVerified,
    freshOwnerAuthorizationReverified: evaluated.freshOwnerAuthorizationReverified,
    rollbackRegistryVerified: evaluated.rollbackRegistryVerified,
    freshActivationChangeContractHashSha256: evaluated.freshActivationChangeContractHashSha256,
    verifiedFreshOwnerAuthorizationRecordHashSha256: evaluated.verifiedFreshOwnerAuthorizationRecordHashSha256,
    ownerAuthorityRegistryHashSha256: evaluated.ownerAuthorityRegistryHashSha256,
    activationAuthorizationGrantedByGate: false,
    activationApplied: true,
    canonicalBaselineChanged: true,
    activationAppliedObserved: true,
    canonicalBaselineChangedObserved: true,
    legacyCanonicalEvidenceClosed: false,
    existingE2iCanonicalEvidenceSatisfied: false,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    goLiveAuthorized: false,
    transactionAuthorized: false,
  });
}

function verifyCanonicalBaselineRegistryFile({
  filePath = DEFAULT_REGISTRY_PATH,
  fsModule = fs,
  env = process.env,
} = {}) {
  const registryRead = safeReadJson(filePath, fsModule, MAX_REGISTRY_BYTES, 'CANONICAL_BASELINE_REGISTRY');
  if (!registryRead.ok) {
    return result(missingFileStatus(registryRead.reasonCode) ? STATUS.MISSING : STATUS.MALFORMED, false, registryRead.reasonCode);
  }
  const registry = registryRead.value;

  if (registry.activeMode === MODE.LEGACY_FILE_SHA256) return verifyLegacyRegistry(registryRead);

  if (registry.activeMode !== MODE.GOVERNED_COMPOSITE_BASELINE) {
    return result(STATUS.REGISTRY_HOLD, false, 'CANONICAL_BASELINE_ACTIVE_MODE_UNSUPPORTED', {
      activeMode: registry.activeMode || null,
      registryHashSha256: null,
      activationAuthorizationGrantedByGate: false,
    });
  }

  if (registry.schemaVersion === 2) return verifyHistoricalSchemaV2Composite({ registry, env, fsModule });
  if (registry.schemaVersion === 3) return verifyFreshSchemaV3Composite({ registryRead, env, fsModule });

  return result(STATUS.REGISTRY_HOLD, false, 'CANONICAL_BASELINE_COMPOSITE_SCHEMA_UNSUPPORTED', {
    activeMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    registrySchemaVersion: registry.schemaVersion || null,
    activationAuthorizationGrantedByGate: false,
  });
}

module.exports = {
  STATUS,
  verifyCanonicalBaselineRegistryFile,
  safeReadJson,
  verifyLegacyRegistry,
  verifyHistoricalSchemaV2Composite,
  verifyFreshSchemaV3Composite,
};
