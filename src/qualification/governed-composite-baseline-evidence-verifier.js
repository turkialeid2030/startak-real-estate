'use strict';

const crypto = require('crypto');
const { EXPECTED_CANONICAL_SHA256 } = require('../../tools/canonical-source-evidence');
const {
  MODE,
  STATUS: P32_STATUS,
  evaluateCurrentCanonicalBaselineRegistry,
  stableStringify,
} = require('./canonical-baseline-registry');

const STATUS = Object.freeze({
  HOLD_COMPOSITE_BASELINE_EVIDENCE: 'HOLD_COMPOSITE_BASELINE_EVIDENCE',
  COMPOSITE_BASELINE_EVIDENCE_VERIFIED_CANDIDATE_ONLY: 'COMPOSITE_BASELINE_EVIDENCE_VERIFIED_CANDIDATE_ONLY',
});

const AUTHORITY = Object.freeze({
  canonicalBaselineChanged: false,
  legacyCanonicalEvidenceClosed: false,
  existingE2iCanonicalEvidenceSatisfied: false,
  releaseAuthorized: false,
  mergeAuthorized: false,
  deploymentAuthorized: false,
  goLiveAuthorized: false,
  transactionAuthorized: false,
});

const SHA256_RE = /^[a-f0-9]{64}$/i;
const COMMIT_RE = /^[a-f0-9]{40}$/i;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function sha256Object(value) {
  return crypto.createHash('sha256').update(stableStringify(value), 'utf8').digest('hex');
}

function bytes(value, field) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'string') return Buffer.from(value, 'utf8');
  throw new TypeError(`${field} must be Buffer, Uint8Array or string bytes`);
}

function sha256Bytes(value, field) {
  return crypto.createHash('sha256').update(bytes(value, field)).digest('hex');
}

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function iso(value, field) {
  const raw = requiredString(value, field);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return parsed.toISOString();
}

function hold(blockers, currentRegistryEvaluation = null, candidate = null) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_COMPOSITE_BASELINE_EVIDENCE,
    blockers: Object.freeze([...blockers]),
    currentRegistryHashSha256: currentRegistryEvaluation?.registryHashSha256 || null,
    candidateRegistryHashSha256: candidate?.candidateRegistryHashSha256 || null,
    compositeEvidenceHashSha256: null,
    candidateOnly: true,
    activationApplied: false,
    explicitActivationCodeChangeRequired: true,
    postActivationReleaseVerifyRequired: true,
    ...AUTHORITY,
  });
}

function verifyCandidate(candidate) {
  if (!candidate || candidate.status !== P32_STATUS.COMPOSITE_REGISTRY_CANDIDATE_READY_FOR_EXPLICIT_CODE_CHANGE) {
    return 'P32_COMPOSITE_REGISTRY_CANDIDATE_REQUIRED';
  }
  if (
    candidate.candidateOnly !== true
    || candidate.activationApplied !== false
    || candidate.canonicalBaselineChanged !== false
    || candidate.releaseAuthorized !== false
    || candidate.mergeAuthorized !== false
    || candidate.deploymentAuthorized !== false
    || candidate.goLiveAuthorized !== false
    || candidate.transactionAuthorized !== false
  ) return 'P32_COMPOSITE_CANDIDATE_AUTHORITY_BOUNDARY_INVALID';
  if (candidate.requestedMode !== MODE.GOVERNED_COMPOSITE_BASELINE || candidate.supersedesMode !== MODE.LEGACY_FILE_SHA256) {
    return 'P32_COMPOSITE_CANDIDATE_MODE_INVALID';
  }
  if (
    candidate.supersedesLegacyCanonicalSha256 !== EXPECTED_CANONICAL_SHA256
    || !SHA256_RE.test(candidate.activationPlanHashSha256 || '')
    || !SHA256_RE.test(candidate.candidateRegistryHashSha256 || '')
    || !SHA256_RE.test(candidate.successorBaselineManifestHashSha256 || '')
  ) return 'P32_COMPOSITE_CANDIDATE_HASH_INVALID';
  if (!candidate.successorBaselineManifest || typeof candidate.successorBaselineManifest !== 'object') {
    return 'P32_SUCCESSOR_BASELINE_MANIFEST_REQUIRED';
  }
  const manifest = candidate.successorBaselineManifest;
  if (
    manifest.schemaVersion !== 1
    || manifest.baselineType !== 'QUALIFIED_GIT_COMMIT_AND_RELEASE_ARTIFACT'
    || !COMMIT_RE.test(manifest.qualifiedSourceCommitSha || '')
    || !SHA256_RE.test(manifest.releaseArtifactSha256 || '')
    || !SHA256_RE.test(manifest.environmentConfigSha256 || '')
    || !SHA256_RE.test(manifest.governanceDecisionHashSha256 || '')
    || !SHA256_RE.test(manifest.reviewerLockHashSha256 || '')
    || manifest.supersedesLegacyCanonicalSha256 !== candidate.supersedesLegacyCanonicalSha256
  ) return 'P32_SUCCESSOR_BASELINE_MANIFEST_SCOPE_INVALID';
  if (sha256Object(manifest) !== candidate.successorBaselineManifestHashSha256) {
    return 'P32_SUCCESSOR_BASELINE_MANIFEST_HASH_MISMATCH';
  }
  const candidateCore = {
    schemaVersion: candidate.schemaVersion,
    requestedMode: candidate.requestedMode,
    supersedesMode: candidate.supersedesMode,
    supersedesLegacyCanonicalSha256: candidate.supersedesLegacyCanonicalSha256,
    successorBaselineManifest: manifest,
    successorBaselineManifestHashSha256: candidate.successorBaselineManifestHashSha256,
    activationPlanHashSha256: candidate.activationPlanHashSha256,
    targetPath: candidate.targetPath,
  };
  if (sha256Object(candidateCore) !== candidate.candidateRegistryHashSha256) {
    return 'P32_COMPOSITE_CANDIDATE_HASH_MISMATCH';
  }
  return null;
}

function verifyGovernedCompositeBaselineEvidence({
  currentRegistry,
  compositeCandidate,
  observedQualifiedSourceCommitSha,
  releaseArtifactBytes,
  environmentConfigBytes,
  verificationId,
  verifiedByRef,
  verifiedAt,
} = {}) {
  const current = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  if (current.status !== P32_STATUS.LEGACY_BASELINE_REGISTRY_CONFIRMED) {
    return hold(['CURRENT_LEGACY_BASELINE_REGISTRY_NOT_CONFIRMED'], current, compositeCandidate);
  }

  const candidateBlocker = verifyCandidate(compositeCandidate);
  if (candidateBlocker) return hold([candidateBlocker], current, compositeCandidate);

  let commitSha;
  let artifactSha256;
  let environmentSha256;
  let evidenceId;
  let verifier;
  let verifiedAtIso;
  try {
    commitSha = requiredString(observedQualifiedSourceCommitSha, 'observedQualifiedSourceCommitSha').toLowerCase();
    if (!COMMIT_RE.test(commitSha)) throw new TypeError('observedQualifiedSourceCommitSha must be a 40-character commit SHA');
    artifactSha256 = sha256Bytes(releaseArtifactBytes, 'releaseArtifactBytes');
    environmentSha256 = sha256Bytes(environmentConfigBytes, 'environmentConfigBytes');
    evidenceId = requiredString(verificationId, 'verificationId');
    verifier = requiredString(verifiedByRef, 'verifiedByRef');
    verifiedAtIso = iso(verifiedAt, 'verifiedAt');
  } catch (error) {
    return hold([error.message], current, compositeCandidate);
  }

  const manifest = compositeCandidate.successorBaselineManifest;
  const blockers = [];
  if (manifest.qualifiedSourceCommitSha !== commitSha) blockers.push('QUALIFIED_SOURCE_COMMIT_SHA_MISMATCH');
  if (manifest.releaseArtifactSha256 !== artifactSha256) blockers.push('RELEASE_ARTIFACT_SHA256_MISMATCH');
  if (manifest.environmentConfigSha256 !== environmentSha256) blockers.push('ENVIRONMENT_CONFIG_SHA256_MISMATCH');
  if (compositeCandidate.targetPath !== 'config/governance/canonical-baseline.json') blockers.push('COMPOSITE_CANDIDATE_TARGET_PATH_INVALID');
  if (blockers.length > 0) return hold(blockers, current, compositeCandidate);

  const evidenceCore = {
    schemaVersion: 1,
    verificationId: evidenceId,
    verifiedByRef: verifier,
    verifiedAt: verifiedAtIso,
    currentRegistryHashSha256: current.registryHashSha256,
    candidateRegistryHashSha256: compositeCandidate.candidateRegistryHashSha256,
    activationPlanHashSha256: compositeCandidate.activationPlanHashSha256,
    successorBaselineManifestHashSha256: compositeCandidate.successorBaselineManifestHashSha256,
    observedQualifiedSourceCommitSha: commitSha,
    observedReleaseArtifactSha256: artifactSha256,
    observedEnvironmentConfigSha256: environmentSha256,
  };

  return deepFreeze({
    ...evidenceCore,
    status: STATUS.COMPOSITE_BASELINE_EVIDENCE_VERIFIED_CANDIDATE_ONLY,
    compositeEvidenceHashSha256: sha256Object(evidenceCore),
    blockers: Object.freeze([]),
    rawReleaseArtifactSerialized: false,
    rawEnvironmentConfigSerialized: false,
    candidateOnly: true,
    activationApplied: false,
    explicitActivationCodeChangeRequired: true,
    independentReviewerEvidenceStillExternallyRequiredForRealActivation: true,
    postActivationReleaseVerifyRequired: true,
    productionEvidenceEstablishedHere: false,
    ...AUTHORITY,
    semantics: 'The supplied candidate commit, release-artifact bytes and environment-config bytes match the P32 governed-composite candidate digests while the active registry remains the confirmed legacy baseline. This verifies only candidate evidence. It neither activates the composite baseline nor closes the missing historical canonical-source evidence, and it grants no release authority.',
  });
}

module.exports = {
  STATUS,
  AUTHORITY,
  verifyGovernedCompositeBaselineEvidence,
  sha256Bytes,
};
