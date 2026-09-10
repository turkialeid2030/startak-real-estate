'use strict';

const fs = require('fs');
const path = require('path');
const {
  STATUS: DUAL_MODE_STATUS,
  evaluateDualModeCanonicalBaselineRegistry,
} = require('../src/qualification/dual-mode-canonical-baseline-registry-verifier');
const { MODE } = require('../src/qualification/canonical-baseline-registry');

const STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  MISSING: 'MISSING',
  MALFORMED: 'MALFORMED',
  REGISTRY_HOLD: 'REGISTRY_HOLD',
});

const DEFAULT_REGISTRY_PATH = path.join(__dirname, '..', 'config', 'governance', 'canonical-baseline.json');
const MAX_REGISTRY_BYTES = 256 * 1024;
const MAX_CONTRACT_BYTES = 1024 * 1024;
const MAX_AUTHORITY_REGISTRY_BYTES = 1024 * 1024;
const MAX_ATTESTATION_BYTES = 256 * 1024;

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
    return { ok: true, value: JSON.parse(fsModule.readFileSync(filePath, 'utf8')) };
  } catch (error) {
    if (error && error.code === 'ENOENT') return { ok: false, reasonCode: `${reasonPrefix}_FILE_MISSING` };
    if (error instanceof SyntaxError) return { ok: false, reasonCode: `${reasonPrefix}_JSON_INVALID` };
    return { ok: false, reasonCode: `${reasonPrefix}_FILE_UNAVAILABLE` };
  }
}

function verifyCanonicalBaselineRegistryFile({
  filePath = DEFAULT_REGISTRY_PATH,
  fsModule = fs,
  env = process.env,
} = {}) {
  const registryRead = safeReadJson(filePath, fsModule, MAX_REGISTRY_BYTES, 'CANONICAL_BASELINE_REGISTRY');
  if (!registryRead.ok) {
    const missing = registryRead.reasonCode.endsWith('_PATH_REQUIRED') || registryRead.reasonCode.endsWith('_FILE_MISSING') || registryRead.reasonCode.endsWith('_FILE_REQUIRED');
    return result(missing ? STATUS.MISSING : STATUS.MALFORMED, false, registryRead.reasonCode);
  }
  const registry = registryRead.value;

  // Legacy remains the zero-extra-evidence path. This preserves the P32/P33
  // behavior while P40 adds a future composite mode that is fail-closed unless
  // the exact P39 contract and a signed human-owner authorization are supplied.
  if (registry?.activeMode === MODE.LEGACY_FILE_SHA256) {
    const evaluated = evaluateDualModeCanonicalBaselineRegistry({ registry });
    if (evaluated.status !== DUAL_MODE_STATUS.LEGACY_BASELINE_VERIFIED || evaluated.verified !== true) {
      return result(STATUS.REGISTRY_HOLD, false, 'CANONICAL_BASELINE_LEGACY_NOT_VERIFIED', {
        blockers: evaluated.blockers || Object.freeze([]),
        activeMode: evaluated.activeMode || MODE.LEGACY_FILE_SHA256,
        registryHashSha256: evaluated.registryHashSha256 || null,
      });
    }
    return result(STATUS.VERIFIED, true, null, {
      activeMode: evaluated.activeMode,
      registryHashSha256: evaluated.registryHashSha256,
      verificationMode: 'LEGACY_STRICT',
      p39ActivationChangeContractVerified: false,
      signedHumanActivationAuthorizationVerified: false,
      activationAuthorizationGrantedByGate: false,
      activationAppliedObserved: false,
      canonicalBaselineChangedObserved: false,
    });
  }

  if (registry?.activeMode !== MODE.GOVERNED_COMPOSITE_BASELINE) {
    const evaluated = evaluateDualModeCanonicalBaselineRegistry({ registry });
    return result(STATUS.REGISTRY_HOLD, false, 'CANONICAL_BASELINE_ACTIVE_MODE_UNSUPPORTED', {
      blockers: evaluated.blockers || Object.freeze([]),
      activeMode: registry?.activeMode || null,
      registryHashSha256: evaluated.registryHashSha256 || null,
    });
  }

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
      registryHashSha256: null,
      activationAuthorizationGrantedByGate: false,
    });
  }

  const contractRead = safeReadJson(required.contract, fsModule, MAX_CONTRACT_BYTES, 'CANONICAL_BASELINE_ACTIVATION_CONTRACT');
  if (!contractRead.ok) return result(STATUS.REGISTRY_HOLD, false, contractRead.reasonCode, { activeMode: MODE.GOVERNED_COMPOSITE_BASELINE, activationAuthorizationGrantedByGate: false });
  const authorityRead = safeReadJson(required.authorityRegistry, fsModule, MAX_AUTHORITY_REGISTRY_BYTES, 'CANONICAL_BASELINE_ACTIVATION_AUTHORITY_REGISTRY');
  if (!authorityRead.ok) return result(STATUS.REGISTRY_HOLD, false, authorityRead.reasonCode, { activeMode: MODE.GOVERNED_COMPOSITE_BASELINE, activationAuthorizationGrantedByGate: false });
  const attestationRead = safeReadJson(required.attestation, fsModule, MAX_ATTESTATION_BYTES, 'CANONICAL_BASELINE_ACTIVATION_ATTESTATION');
  if (!attestationRead.ok) return result(STATUS.REGISTRY_HOLD, false, attestationRead.reasonCode, { activeMode: MODE.GOVERNED_COMPOSITE_BASELINE, activationAuthorizationGrantedByGate: false });

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
      registryHashSha256: evaluated.registryHashSha256 || null,
      activationAuthorizationGrantedByGate: false,
    });
  }

  return result(STATUS.VERIFIED, true, null, {
    activeMode: evaluated.activeMode,
    registryHashSha256: evaluated.registryHashSha256,
    verificationMode: 'GOVERNED_COMPOSITE_WITH_SIGNED_HUMAN_AUTHORIZATION',
    p39ActivationChangeContractVerified: evaluated.p39ActivationChangeContractVerified,
    signedHumanActivationAuthorizationVerified: evaluated.signedHumanActivationAuthorizationVerified,
    activationAuthorizationVerificationHashSha256: evaluated.activationAuthorizationVerificationHashSha256,
    activationAuthorizationGrantedByGate: false,
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

module.exports = {
  STATUS,
  verifyCanonicalBaselineRegistryFile,
};
