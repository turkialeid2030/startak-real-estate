'use strict';

const crypto = require('crypto');
const {
  MODE,
  STATUS: P32_STATUS,
  evaluateCurrentCanonicalBaselineRegistry,
  stableStringify,
} = require('./canonical-baseline-registry');
const {
  STATUS: P34_STATUS,
} = require('./governed-composite-baseline-evidence-verifier');

const STATUS = Object.freeze({
  HOLD_COMPOSITE_BASELINE_SHADOW: 'HOLD_COMPOSITE_BASELINE_SHADOW',
  SHADOW_COMPOSITE_BASELINE_MATCH_NOT_ACTIVE: 'SHADOW_COMPOSITE_BASELINE_MATCH_NOT_ACTIVE',
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

function sha256Object(value) {
  return crypto.createHash('sha256').update(stableStringify(value), 'utf8').digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function allAuthorityFalse(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.keys(AUTHORITY).every((field) => value[field] === false);
}

function hold(blockers, current = null, candidate = null, evidence = null) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_COMPOSITE_BASELINE_SHADOW,
    blockers: Object.freeze([...blockers]),
    authoritativeMode: current?.activeMode || MODE.LEGACY_FILE_SHA256,
    shadowMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    currentRegistryHashSha256: current?.registryHashSha256 || null,
    candidateRegistryHashSha256: candidate?.candidateRegistryHashSha256 || null,
    compositeEvidenceHashSha256: evidence?.compositeEvidenceHashSha256 || null,
    shadowEvaluationHashSha256: null,
    shadowComparisonMatch: false,
    shadowOnly: true,
    candidateOnly: true,
    activationApplied: false,
    productionEvidenceEstablishedHere: false,
    ...AUTHORITY,
  });
}

function evaluateCompositeBaselineShadow({
  currentRegistry,
  compositeCandidate,
  compositeEvidence,
} = {}) {
  const current = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  if (current.status !== P32_STATUS.LEGACY_BASELINE_REGISTRY_CONFIRMED) {
    return hold(['CURRENT_LEGACY_BASELINE_REGISTRY_NOT_CONFIRMED'], current, compositeCandidate, compositeEvidence);
  }

  const blockers = [];
  const candidate = compositeCandidate;
  const evidence = compositeEvidence;

  if (!candidate || candidate.status !== P32_STATUS.COMPOSITE_REGISTRY_CANDIDATE_READY_FOR_EXPLICIT_CODE_CHANGE) {
    blockers.push('P32_COMPOSITE_REGISTRY_CANDIDATE_REQUIRED');
  } else {
    if (
      candidate.requestedMode !== MODE.GOVERNED_COMPOSITE_BASELINE
      || candidate.supersedesMode !== MODE.LEGACY_FILE_SHA256
      || candidate.candidateOnly !== true
      || candidate.activationApplied !== false
      || candidate.canonicalBaselineChanged !== false
      || !allAuthorityFalse(candidate)
    ) blockers.push('P32_COMPOSITE_CANDIDATE_BOUNDARY_INVALID');

    if (!SHA256_RE.test(candidate.candidateRegistryHashSha256 || '')) blockers.push('P32_CANDIDATE_HASH_INVALID');
    if (!SHA256_RE.test(candidate.activationPlanHashSha256 || '')) blockers.push('P32_ACTIVATION_PLAN_HASH_INVALID');
    if (!SHA256_RE.test(candidate.successorBaselineManifestHashSha256 || '')) blockers.push('P32_SUCCESSOR_MANIFEST_HASH_INVALID');
    if (!candidate.successorBaselineManifest || typeof candidate.successorBaselineManifest !== 'object') {
      blockers.push('P32_SUCCESSOR_MANIFEST_REQUIRED');
    } else {
      const manifest = candidate.successorBaselineManifest;
      if (sha256Object(manifest) !== candidate.successorBaselineManifestHashSha256) blockers.push('P32_SUCCESSOR_MANIFEST_HASH_MISMATCH');
      if (manifest.baselineType !== 'QUALIFIED_GIT_COMMIT_AND_RELEASE_ARTIFACT') blockers.push('P32_SUCCESSOR_BASELINE_TYPE_INVALID');
      if (!COMMIT_RE.test(manifest.qualifiedSourceCommitSha || '')) blockers.push('P32_SUCCESSOR_COMMIT_SHA_INVALID');
      for (const value of [
        manifest.releaseArtifactSha256,
        manifest.environmentConfigSha256,
        manifest.supersedesLegacyCanonicalSha256,
        manifest.governanceDecisionHashSha256,
        manifest.reviewerLockHashSha256,
      ]) {
        if (!SHA256_RE.test(value || '')) blockers.push('P32_SUCCESSOR_SCOPE_HASH_INVALID');
      }
    }

    const candidateCore = {
      schemaVersion: candidate.schemaVersion,
      requestedMode: candidate.requestedMode,
      supersedesMode: candidate.supersedesMode,
      supersedesLegacyCanonicalSha256: candidate.supersedesLegacyCanonicalSha256,
      successorBaselineManifest: candidate.successorBaselineManifest,
      successorBaselineManifestHashSha256: candidate.successorBaselineManifestHashSha256,
      activationPlanHashSha256: candidate.activationPlanHashSha256,
      targetPath: candidate.targetPath,
    };
    if (sha256Object(candidateCore) !== candidate.candidateRegistryHashSha256) blockers.push('P32_CANDIDATE_HASH_MISMATCH');
  }

  if (!evidence || evidence.status !== P34_STATUS.COMPOSITE_BASELINE_EVIDENCE_VERIFIED_CANDIDATE_ONLY) {
    blockers.push('P34_VERIFIED_COMPOSITE_EVIDENCE_REQUIRED');
  } else {
    if (
      evidence.candidateOnly !== true
      || evidence.activationApplied !== false
      || evidence.productionEvidenceEstablishedHere !== false
      || !allAuthorityFalse(evidence)
    ) blockers.push('P34_COMPOSITE_EVIDENCE_BOUNDARY_INVALID');
    if (!SHA256_RE.test(evidence.compositeEvidenceHashSha256 || '')) blockers.push('P34_COMPOSITE_EVIDENCE_HASH_INVALID');

    const evidenceCore = {
      schemaVersion: evidence.schemaVersion,
      verificationId: evidence.verificationId,
      verifiedByRef: evidence.verifiedByRef,
      verifiedAt: evidence.verifiedAt,
      currentRegistryHashSha256: evidence.currentRegistryHashSha256,
      candidateRegistryHashSha256: evidence.candidateRegistryHashSha256,
      activationPlanHashSha256: evidence.activationPlanHashSha256,
      successorBaselineManifestHashSha256: evidence.successorBaselineManifestHashSha256,
      observedQualifiedSourceCommitSha: evidence.observedQualifiedSourceCommitSha,
      observedReleaseArtifactSha256: evidence.observedReleaseArtifactSha256,
      observedEnvironmentConfigSha256: evidence.observedEnvironmentConfigSha256,
    };
    if (sha256Object(evidenceCore) !== evidence.compositeEvidenceHashSha256) blockers.push('P34_COMPOSITE_EVIDENCE_HASH_MISMATCH');
  }

  if (candidate && evidence) {
    if (evidence.currentRegistryHashSha256 !== current.registryHashSha256) blockers.push('SHADOW_CURRENT_REGISTRY_HASH_MISMATCH');
    if (evidence.candidateRegistryHashSha256 !== candidate.candidateRegistryHashSha256) blockers.push('SHADOW_CANDIDATE_HASH_MISMATCH');
    if (evidence.activationPlanHashSha256 !== candidate.activationPlanHashSha256) blockers.push('SHADOW_ACTIVATION_PLAN_HASH_MISMATCH');
    if (evidence.successorBaselineManifestHashSha256 !== candidate.successorBaselineManifestHashSha256) blockers.push('SHADOW_SUCCESSOR_MANIFEST_HASH_MISMATCH');

    const manifest = candidate.successorBaselineManifest || {};
    if (evidence.observedQualifiedSourceCommitSha !== manifest.qualifiedSourceCommitSha) blockers.push('SHADOW_COMMIT_MISMATCH');
    if (evidence.observedReleaseArtifactSha256 !== manifest.releaseArtifactSha256) blockers.push('SHADOW_RELEASE_ARTIFACT_MISMATCH');
    if (evidence.observedEnvironmentConfigSha256 !== manifest.environmentConfigSha256) blockers.push('SHADOW_ENVIRONMENT_CONFIG_MISMATCH');
  }

  if (blockers.length > 0) return hold([...new Set(blockers)], current, candidate, evidence);

  const shadowCore = {
    schemaVersion: 1,
    authoritativeMode: MODE.LEGACY_FILE_SHA256,
    shadowMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    currentRegistryHashSha256: current.registryHashSha256,
    candidateRegistryHashSha256: candidate.candidateRegistryHashSha256,
    compositeEvidenceHashSha256: evidence.compositeEvidenceHashSha256,
    activationPlanHashSha256: candidate.activationPlanHashSha256,
    successorBaselineManifestHashSha256: candidate.successorBaselineManifestHashSha256,
  };

  return deepFreeze({
    ...shadowCore,
    status: STATUS.SHADOW_COMPOSITE_BASELINE_MATCH_NOT_ACTIVE,
    shadowEvaluationHashSha256: sha256Object(shadowCore),
    blockers: Object.freeze([]),
    shadowComparisonMatch: true,
    shadowOnly: true,
    candidateOnly: true,
    activationApplied: false,
    authoritativeBaselineRemainsLegacy: true,
    independentReviewStillRequiredForRealActivation: true,
    explicitActivationCodeChangeStillRequired: true,
    postActivationReleaseVerifyStillRequired: true,
    productionEvidenceEstablishedHere: false,
    ...AUTHORITY,
    semantics: 'The governed-composite candidate and its P34 evidence are internally consistent with the still-authoritative legacy registry. This is shadow comparison only. It does not activate the composite baseline, close historical evidence, satisfy E2I, or grant release authority.',
  });
}

module.exports = {
  STATUS,
  AUTHORITY,
  evaluateCompositeBaselineShadow,
};
