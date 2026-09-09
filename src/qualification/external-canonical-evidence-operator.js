'use strict';

const fs = require('fs');
const {
  EXPECTED_CANONICAL_SHA256,
  CANONICAL_SOURCE_STATUS,
  evaluateCanonicalSourceEvidence,
} = require('../../tools/canonical-source-evidence');
const {
  PACKAGE_STATUS,
  createCanonicalSourceReadinessEvidencePackage,
} = require('./canonical-source-readiness-evidence-package');

const OPERATOR_STATUS = Object.freeze({
  HOLD_CANONICAL_SOURCE_EVIDENCE: 'HOLD_CANONICAL_SOURCE_EVIDENCE',
  READY_FOR_EXTERNAL_READINESS_VERIFIER_SIGNATURE: PACKAGE_STATUS.READY_FOR_EXTERNAL_READINESS_VERIFIER_SIGNATURE,
});

const AUTHORITY = Object.freeze({
  releaseAuthorized: false,
  mergeAuthorized: false,
  deploymentAuthorized: false,
  goLiveAuthorized: false,
  transactionAuthorized: false,
  canonicalExternalSourceBlockerClosed: false,
});

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function sanitizeEvidence(evidence) {
  return freeze({
    status: evidence?.status || null,
    evaluated: evidence?.evaluated === true,
    verified: evidence?.verified === true,
    sourcePathProvided: evidence?.sourcePathProvided === true,
    expectedSha256: evidence?.expectedSha256 || EXPECTED_CANONICAL_SHA256,
    computedSha256: evidence?.computedSha256 || null,
    reasonCode: evidence?.reasonCode || null,
  });
}

function prepareExternalCanonicalEvidence({
  sourcePath,
  context,
  fsModule = fs,
  evidenceEvaluator = evaluateCanonicalSourceEvidence,
  packageBuilder = createCanonicalSourceReadinessEvidencePackage,
} = {}) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    throw new TypeError('context must be an object');
  }

  const evidence = evidenceEvaluator({
    filePath: sourcePath,
    expectedSha256: EXPECTED_CANONICAL_SHA256,
    requireEvidence: true,
    fsModule,
  });
  const safeEvidence = sanitizeEvidence(evidence);

  if (safeEvidence.status !== CANONICAL_SOURCE_STATUS.VERIFIED || !safeEvidence.verified) {
    return freeze({
      schemaVersion: 1,
      status: OPERATOR_STATUS.HOLD_CANONICAL_SOURCE_EVIDENCE,
      canonicalSourceEvidence: safeEvidence,
      signingPackage: null,
      privateSigningKeyAccepted: false,
      externalReadinessVerifierRequired: true,
      e2iAcceptancePending: true,
      authority: AUTHORITY,
      semantics: 'The external canonical source did not satisfy the strict pinned SHA-256 comparison. No signing package was produced. Raw source paths and private signing keys are not part of this operator result.',
    });
  }

  const signingPackage = packageBuilder({
    canonicalSourceEvidence: safeEvidence,
    evidenceId: context.evidenceId,
    upstreamCloseoutPacketHashSha256: context.upstreamCloseoutPacketHashSha256,
    releaseCandidateId: context.releaseCandidateId,
    sourceCommitSha: context.sourceCommitSha,
    artifactSha256: context.artifactSha256,
    environmentRef: context.environmentRef,
    environmentConfigSha256: context.environmentConfigSha256,
    verifierId: context.verifierId,
    sourceRef: context.sourceRef,
    evidenceArtifactSha256: context.evidenceArtifactSha256,
    verifiedAt: context.verifiedAt,
    expiresAt: context.expiresAt,
    scopeRef: context.scopeRef,
  });

  return freeze({
    schemaVersion: 1,
    status: OPERATOR_STATUS.READY_FOR_EXTERNAL_READINESS_VERIFIER_SIGNATURE,
    canonicalSourceEvidence: safeEvidence,
    signingPackage,
    privateSigningKeyAccepted: false,
    externalReadinessVerifierRequired: true,
    readinessVerifierRegistryTrustRootRequired: true,
    e2iAcceptancePending: true,
    authority: AUTHORITY,
    semantics: 'Strict canonical-source verification succeeded and the exact unsigned E2I signing package was prepared. This is not a signature, verifier authentication, E2I acceptance, blocker closure, release authorization, merge authorization, deployment authorization, or go-live authorization.',
  });
}

module.exports = {
  OPERATOR_STATUS,
  AUTHORITY,
  prepareExternalCanonicalEvidence,
};
