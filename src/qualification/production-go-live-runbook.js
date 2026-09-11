'use strict';

const { sha256 } = require('../standards/standards-registry');
const {
  E2F_STATUS,
  verifyExternalConformanceProductionValidationPacketIntegrity,
} = require('../standards/external-conformance-production-validation');
const {
  E2G_STATUS,
  verifyHumanReleaseAuthorityDecisionPacketIntegrity,
} = require('../standards/human-release-authority-deployment-decision');
const {
  E2H_STATUS,
  verifyExecutionPostDeploymentCloseoutPacketIntegrity,
} = require('../standards/execution-attestation-post-deployment-closeout');
const {
  E2I_STATUS,
  verifyProductionEvidenceGoLiveReadinessPacketIntegrity,
} = require('../standards/production-evidence-go-live-readiness');
const {
  prepareReleaseDecisionSigningRequest,
} = require('./e2g-release-authority-decision-intake');
const {
  prepareExecutionAttestationSigningRequest,
} = require('./e2h-execution-attestor-intake');
const {
  prepareReadinessEvidenceSigningRequest,
} = require('./e2i-readiness-evidence-intake');

const STATUS = Object.freeze({
  HOLD_PRODUCTION_CHAIN_PROVENANCE_PIN: 'HOLD_PRODUCTION_CHAIN_PROVENANCE_PIN',
  HOLD_PRODUCTION_CHAIN_INTEGRITY: 'HOLD_PRODUCTION_CHAIN_INTEGRITY',
  HOLD_PRODUCTION_CHAIN_STAGE_GAP: 'HOLD_PRODUCTION_CHAIN_STAGE_GAP',
  HOLD_RELEASE_CANDIDATE_DRIFT: 'HOLD_RELEASE_CANDIDATE_DRIFT',
  WAITING_FOR_E2F_PRODUCTION_VALIDATION: 'WAITING_FOR_E2F_PRODUCTION_VALIDATION',
  READY_FOR_E2G_HUMAN_RELEASE_DECISIONS: 'READY_FOR_E2G_HUMAN_RELEASE_DECISIONS',
  WAITING_FOR_E2G_HUMAN_RELEASE_DECISIONS: 'WAITING_FOR_E2G_HUMAN_RELEASE_DECISIONS',
  READY_FOR_AUTHORIZED_EXECUTION_SEQUENCE: 'READY_FOR_AUTHORIZED_EXECUTION_SEQUENCE',
  WAITING_FOR_E2H_EXECUTION_CLOSEOUT: 'WAITING_FOR_E2H_EXECUTION_CLOSEOUT',
  READY_FOR_E2I_EXTERNAL_READINESS_EVIDENCE: 'READY_FOR_E2I_EXTERNAL_READINESS_EVIDENCE',
  WAITING_FOR_E2I_EXTERNAL_READINESS_EVIDENCE: 'WAITING_FOR_E2I_EXTERNAL_READINESS_EVIDENCE',
  GO_LIVE_READINESS_CONFIRMED_UNLICENSED_DECISION_SUPPORT: 'GO_LIVE_READINESS_CONFIRMED_UNLICENSED_DECISION_SUPPORT',
});

const AUTHORITY = Object.freeze({
  releaseAuthorizedByRunbook: false,
  mergeAuthorizedByRunbook: false,
  deploymentAuthorizedByRunbook: false,
  mergeExecutedByRunbook: false,
  deploymentExecutedByRunbook: false,
  goLiveAuthorizedByRunbook: false,
  transactionAuthorizedByRunbook: false,
  professionalAuthorityEstablishedByRunbook: false,
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function digest(value, field) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) throw new TypeError(`${field} must be a SHA-256 hex digest`);
  return value.toLowerCase();
}

function releaseCandidateHash(candidate) {
  return candidate && typeof candidate === 'object' ? sha256(candidate) : null;
}

function pinCheck(actual, expected, code) {
  let expectedDigest;
  try {
    expectedDigest = digest(expected, 'expectedUpstreamPacketHashSha256');
  } catch (error) {
    return { ok: false, blocker: `${code}:EXPECTED_PIN_INVALID` };
  }
  if (typeof actual !== 'string' || !/^[a-f0-9]{64}$/i.test(actual)) return { ok: false, blocker: `${code}:ACTUAL_PACKET_HASH_INVALID` };
  if (actual.toLowerCase() !== expectedDigest) return { ok: false, blocker: `${code}:MISMATCH` };
  return { ok: true, expectedDigest };
}

function wrapperHold(blocker, actualHash = null, expectedHash = null) {
  return deepFreeze({
    runbookStatus: STATUS.HOLD_PRODUCTION_CHAIN_PROVENANCE_PIN,
    status: STATUS.HOLD_PRODUCTION_CHAIN_PROVENANCE_PIN,
    blockers: Object.freeze([blocker]),
    upstreamPacketHashSha256: actualHash,
    expectedUpstreamPacketHashSha256: expectedHash,
    upstreamPacketProvenancePinned: false,
    lowerLevelResult: null,
    authority: AUTHORITY,
  });
}

function wrapPinnedResult(lowerLevelResult, actualHash, expectedHash) {
  return deepFreeze({
    runbookStatus: 'PINNED_UPSTREAM_PACKET_VERIFIED',
    status: lowerLevelResult.status,
    blockers: lowerLevelResult.blockers || Object.freeze([]),
    upstreamPacketHashSha256: actualHash,
    expectedUpstreamPacketHashSha256: expectedHash.toLowerCase(),
    upstreamPacketProvenancePinned: true,
    lowerLevelResult,
    authority: AUTHORITY,
  });
}

function preparePinnedE2gDecisionSigningRequest({
  expectedUpstreamValidationPacketHashSha256,
  upstreamValidationPacket,
  ...rest
} = {}) {
  const actual = upstreamValidationPacket?.validationPacketHashSha256 || null;
  const pin = pinCheck(actual, expectedUpstreamValidationPacketHashSha256, 'E2F_PACKET_HASH_PIN');
  if (!pin.ok) return wrapperHold(pin.blocker, actual, expectedUpstreamValidationPacketHashSha256 || null);
  const lowerLevelResult = prepareReleaseDecisionSigningRequest({ upstreamValidationPacket, ...rest });
  return wrapPinnedResult(lowerLevelResult, actual.toLowerCase(), pin.expectedDigest);
}

function preparePinnedE2hAttestationSigningRequest({
  expectedUpstreamDecisionPacketHashSha256,
  upstreamDecisionPacket,
  ...rest
} = {}) {
  const actual = upstreamDecisionPacket?.decisionPacketHashSha256 || null;
  const pin = pinCheck(actual, expectedUpstreamDecisionPacketHashSha256, 'E2G_PACKET_HASH_PIN');
  if (!pin.ok) return wrapperHold(pin.blocker, actual, expectedUpstreamDecisionPacketHashSha256 || null);
  const lowerLevelResult = prepareExecutionAttestationSigningRequest({ upstreamDecisionPacket, ...rest });
  return wrapPinnedResult(lowerLevelResult, actual.toLowerCase(), pin.expectedDigest);
}

function preparePinnedE2iEvidenceSigningRequest({
  expectedUpstreamCloseoutPacketHashSha256,
  upstreamCloseoutPacket,
  ...rest
} = {}) {
  const actual = upstreamCloseoutPacket?.closeoutPacketHashSha256 || null;
  const pin = pinCheck(actual, expectedUpstreamCloseoutPacketHashSha256, 'E2H_PACKET_HASH_PIN');
  if (!pin.ok) return wrapperHold(pin.blocker, actual, expectedUpstreamCloseoutPacketHashSha256 || null);
  const lowerLevelResult = prepareReadinessEvidenceSigningRequest({ upstreamCloseoutPacket, ...rest });
  return wrapPinnedResult(lowerLevelResult, actual.toLowerCase(), pin.expectedDigest);
}

function runbookResult(status, {
  blockers = [],
  lastVerifiedStage = null,
  releaseCandidate = null,
  nextRequiredAction = null,
  missingEvidenceTypes = [],
  verifiedPins = {},
  observed = {},
} = {}) {
  return deepFreeze({
    schemaVersion: 1,
    status,
    blockers: Object.freeze([...blockers]),
    lastVerifiedStage,
    releaseCandidate,
    releaseCandidateHashSha256: releaseCandidateHash(releaseCandidate),
    nextRequiredAction,
    missingEvidenceTypes: Object.freeze([...missingEvidenceTypes]),
    verifiedPins: deepFreeze({ ...verifiedPins }),
    observed: deepFreeze({ ...observed }),
    productionMutationPerformed: false,
    goLiveReadinessConfirmed: status === STATUS.GO_LIVE_READINESS_CONFIRMED_UNLICENSED_DECISION_SUPPORT,
    goLiveOperatingMode: 'UNLICENSED_DECISION_SUPPORT',
    noFurtherInternalGateCanSubstituteForExternalEvidence: true,
    authority: AUTHORITY,
  });
}

function validatePinnedStage({ packet, expectedHash, hashField, integrityFn, pinCode, integrityCode }) {
  const actual = packet?.[hashField] || null;
  const pin = pinCheck(actual, expectedHash, pinCode);
  if (!pin.ok) return { ok: false, status: STATUS.HOLD_PRODUCTION_CHAIN_PROVENANCE_PIN, blocker: pin.blocker };
  if (!integrityFn(packet)) return { ok: false, status: STATUS.HOLD_PRODUCTION_CHAIN_INTEGRITY, blocker: integrityCode };
  return { ok: true, actual: actual.toLowerCase(), expected: pin.expectedDigest };
}

function sameReleaseCandidate(left, right) {
  return releaseCandidateHash(left) !== null && releaseCandidateHash(left) === releaseCandidateHash(right);
}

function evaluateProductionGoLiveRunbook({
  e2fValidationPacket = null,
  expectedE2fValidationPacketHashSha256 = null,
  e2gDecisionPacket = null,
  expectedE2gDecisionPacketHashSha256 = null,
  e2hCloseoutPacket = null,
  expectedE2hCloseoutPacketHashSha256 = null,
  e2iReadinessPacket = null,
  expectedE2iReadinessPacketHashSha256 = null,
} = {}) {
  if (!e2fValidationPacket) {
    if (e2gDecisionPacket || e2hCloseoutPacket || e2iReadinessPacket) {
      return runbookResult(STATUS.HOLD_PRODUCTION_CHAIN_STAGE_GAP, {
        blockers: ['E2F_PACKET_REQUIRED_BEFORE_DOWNSTREAM_STAGES'],
        nextRequiredAction: 'Supply the independently pinned real E2F production-validation packet first.',
      });
    }
    return runbookResult(STATUS.WAITING_FOR_E2F_PRODUCTION_VALIDATION, {
      nextRequiredAction: 'Obtain real E2F external-conformance/security/performance/resilience validation and independently pin its packet hash.',
    });
  }

  const e2f = validatePinnedStage({
    packet: e2fValidationPacket,
    expectedHash: expectedE2fValidationPacketHashSha256,
    hashField: 'validationPacketHashSha256',
    integrityFn: verifyExternalConformanceProductionValidationPacketIntegrity,
    pinCode: 'E2F_PACKET_HASH_PIN',
    integrityCode: 'E2F_PACKET_INTEGRITY_INVALID',
  });
  if (!e2f.ok) return runbookResult(e2f.status, { blockers: [e2f.blocker], nextRequiredAction: 'Resolve E2F packet provenance before any release-authority signing.' });

  const verifiedPins = { e2fValidationPacketHashSha256: e2f.actual };
  const release = e2fValidationPacket.releaseCandidate;
  const e2fComplete = e2fValidationPacket.status === E2F_STATUS.EXTERNAL_CONFORMANCE_AND_PRODUCTION_VALIDATION_COMPLETE_PENDING_RELEASE_AUTHORITY
    && e2fValidationPacket.externalConformanceEvidenceAuthenticityValidated === true
    && e2fValidationPacket.productionSecurityValidated === true
    && e2fValidationPacket.productionPerformanceValidated === true
    && e2fValidationPacket.productionResilienceValidated === true
    && e2fValidationPacket.productionValidationComplete === true;
  if (!e2fComplete) {
    return runbookResult(STATUS.WAITING_FOR_E2F_PRODUCTION_VALIDATION, {
      lastVerifiedStage: 'E2F_PACKET_PROVENANCE', releaseCandidate: release, verifiedPins,
      nextRequiredAction: 'Complete all real E2F production-validation evidence.',
    });
  }

  if (!e2gDecisionPacket) {
    if (e2hCloseoutPacket || e2iReadinessPacket) {
      return runbookResult(STATUS.HOLD_PRODUCTION_CHAIN_STAGE_GAP, {
        blockers: ['E2G_PACKET_REQUIRED_BEFORE_E2H_OR_E2I'], lastVerifiedStage: 'E2F', releaseCandidate: release, verifiedPins,
        nextRequiredAction: 'Obtain the pinned E2G human release decision packet.',
      });
    }
    return runbookResult(STATUS.READY_FOR_E2G_HUMAN_RELEASE_DECISIONS, {
      lastVerifiedStage: 'E2F', releaseCandidate: release, verifiedPins,
      nextRequiredAction: 'Collect separate externally signed RELEASE, MERGE and DEPLOYMENT human decisions through the pinned E2G intake.',
    });
  }

  const e2g = validatePinnedStage({
    packet: e2gDecisionPacket,
    expectedHash: expectedE2gDecisionPacketHashSha256,
    hashField: 'decisionPacketHashSha256',
    integrityFn: verifyHumanReleaseAuthorityDecisionPacketIntegrity,
    pinCode: 'E2G_PACKET_HASH_PIN',
    integrityCode: 'E2G_PACKET_INTEGRITY_INVALID',
  });
  if (!e2g.ok) return runbookResult(e2g.status, { blockers: [e2g.blocker], lastVerifiedStage: 'E2F', releaseCandidate: release, verifiedPins, nextRequiredAction: 'Resolve E2G packet provenance before execution.' });
  verifiedPins.e2gDecisionPacketHashSha256 = e2g.actual;
  if (!sameReleaseCandidate(release, e2gDecisionPacket.releaseCandidate)) {
    return runbookResult(STATUS.HOLD_RELEASE_CANDIDATE_DRIFT, {
      blockers: ['E2F_E2G_RELEASE_CANDIDATE_MISMATCH'], lastVerifiedStage: 'E2F', releaseCandidate: release, verifiedPins,
      nextRequiredAction: 'Recreate E2G against the exact E2F release candidate.',
    });
  }

  const e2gComplete = e2gDecisionPacket.status === E2G_STATUS.HUMAN_RELEASE_DECISIONS_COMPLETE_PENDING_EXECUTION
    && e2gDecisionPacket.releaseAuthorized === true
    && e2gDecisionPacket.mergeAuthorized === true
    && e2gDecisionPacket.deploymentAuthorized === true;
  if (!e2gComplete) {
    return runbookResult(STATUS.WAITING_FOR_E2G_HUMAN_RELEASE_DECISIONS, {
      lastVerifiedStage: 'E2G_PACKET_PROVENANCE', releaseCandidate: release, verifiedPins,
      nextRequiredAction: 'Complete the missing cryptographically verified E2G human decisions.',
    });
  }

  if (!e2hCloseoutPacket) {
    if (e2iReadinessPacket) {
      return runbookResult(STATUS.HOLD_PRODUCTION_CHAIN_STAGE_GAP, {
        blockers: ['E2H_PACKET_REQUIRED_BEFORE_E2I'], lastVerifiedStage: 'E2G', releaseCandidate: release, verifiedPins,
        nextRequiredAction: 'Execute only the human-authorized merge/deployment externally, then collect E2H attestations.',
      });
    }
    return runbookResult(STATUS.READY_FOR_AUTHORIZED_EXECUTION_SEQUENCE, {
      lastVerifiedStage: 'E2G', releaseCandidate: release, verifiedPins,
      observed: { releaseAuthorized: true, mergeAuthorized: true, deploymentAuthorized: true },
      nextRequiredAction: 'A human/operator may execute the exact authorized merge and deployment outside this runbook; then obtain merge, deployment, smoke and rollback-readiness E2H attestations.',
    });
  }

  const e2h = validatePinnedStage({
    packet: e2hCloseoutPacket,
    expectedHash: expectedE2hCloseoutPacketHashSha256,
    hashField: 'closeoutPacketHashSha256',
    integrityFn: verifyExecutionPostDeploymentCloseoutPacketIntegrity,
    pinCode: 'E2H_PACKET_HASH_PIN',
    integrityCode: 'E2H_PACKET_INTEGRITY_INVALID',
  });
  if (!e2h.ok) return runbookResult(e2h.status, { blockers: [e2h.blocker], lastVerifiedStage: 'E2G', releaseCandidate: release, verifiedPins, nextRequiredAction: 'Resolve E2H packet provenance before E2I evidence collection.' });
  verifiedPins.e2hCloseoutPacketHashSha256 = e2h.actual;
  if (!sameReleaseCandidate(release, e2hCloseoutPacket.releaseCandidate)) {
    return runbookResult(STATUS.HOLD_RELEASE_CANDIDATE_DRIFT, {
      blockers: ['E2F_E2H_RELEASE_CANDIDATE_MISMATCH'], lastVerifiedStage: 'E2G', releaseCandidate: release, verifiedPins,
      nextRequiredAction: 'Recreate E2H against the exact authorized release candidate.',
    });
  }

  const e2hComplete = e2hCloseoutPacket.status === E2H_STATUS.EXECUTION_AND_POST_DEPLOYMENT_CLOSEOUT_COMPLETE
    && e2hCloseoutPacket.mergeExecuted === true
    && e2hCloseoutPacket.deploymentExecuted === true
    && e2hCloseoutPacket.postDeploymentSmokePassed === true
    && e2hCloseoutPacket.rollbackReadinessValidated === true
    && e2hCloseoutPacket.executionCloseoutComplete === true;
  if (!e2hComplete) {
    return runbookResult(STATUS.WAITING_FOR_E2H_EXECUTION_CLOSEOUT, {
      lastVerifiedStage: 'E2H_PACKET_PROVENANCE', releaseCandidate: release, verifiedPins,
      observed: {
        mergeExecuted: e2hCloseoutPacket.mergeExecuted === true,
        deploymentExecuted: e2hCloseoutPacket.deploymentExecuted === true,
        postDeploymentSmokePassed: e2hCloseoutPacket.postDeploymentSmokePassed === true,
        rollbackReadinessValidated: e2hCloseoutPacket.rollbackReadinessValidated === true,
      },
      nextRequiredAction: 'Complete missing E2H execution/smoke/rollback attestations for the exact deployment.',
    });
  }

  if (!e2iReadinessPacket) {
    return runbookResult(STATUS.READY_FOR_E2I_EXTERNAL_READINESS_EVIDENCE, {
      lastVerifiedStage: 'E2H', releaseCandidate: release, verifiedPins,
      observed: { mergeExecuted: true, deploymentExecuted: true, postDeploymentSmokePassed: true, rollbackReadinessValidated: true },
      nextRequiredAction: 'Collect the six real independently signed E2I evidence classes and pin the final E2I packet hash.',
    });
  }

  const e2i = validatePinnedStage({
    packet: e2iReadinessPacket,
    expectedHash: expectedE2iReadinessPacketHashSha256,
    hashField: 'readinessPacketHashSha256',
    integrityFn: verifyProductionEvidenceGoLiveReadinessPacketIntegrity,
    pinCode: 'E2I_PACKET_HASH_PIN',
    integrityCode: 'E2I_PACKET_INTEGRITY_INVALID',
  });
  if (!e2i.ok) return runbookResult(e2i.status, { blockers: [e2i.blocker], lastVerifiedStage: 'E2H', releaseCandidate: release, verifiedPins, nextRequiredAction: 'Resolve E2I packet provenance before treating readiness as confirmed.' });
  verifiedPins.e2iReadinessPacketHashSha256 = e2i.actual;
  if (!sameReleaseCandidate(release, e2iReadinessPacket.releaseCandidate)) {
    return runbookResult(STATUS.HOLD_RELEASE_CANDIDATE_DRIFT, {
      blockers: ['E2F_E2I_RELEASE_CANDIDATE_MISMATCH'], lastVerifiedStage: 'E2H', releaseCandidate: release, verifiedPins,
      nextRequiredAction: 'Recreate E2I against the exact executed release candidate.',
    });
  }

  if (e2iReadinessPacket.status !== E2I_STATUS.GO_LIVE_READY_FOR_UNLICENSED_DECISION_SUPPORT || e2iReadinessPacket.goLiveReady !== true) {
    return runbookResult(STATUS.WAITING_FOR_E2I_EXTERNAL_READINESS_EVIDENCE, {
      lastVerifiedStage: 'E2I_PACKET_PROVENANCE', releaseCandidate: release, verifiedPins,
      missingEvidenceTypes: e2iReadinessPacket.missingEvidenceTypes || [],
      nextRequiredAction: 'Obtain and verify every missing real external E2I evidence class; internal tests cannot substitute.',
    });
  }

  if (e2iReadinessPacket.goLiveOperatingMode !== 'UNLICENSED_DECISION_SUPPORT') {
    return runbookResult(STATUS.HOLD_PRODUCTION_CHAIN_INTEGRITY, {
      blockers: ['E2I_GO_LIVE_OPERATING_MODE_INVALID'], lastVerifiedStage: 'E2H', releaseCandidate: release, verifiedPins,
      nextRequiredAction: 'Restore the approved UNLICENSED_DECISION_SUPPORT operating-mode boundary.',
    });
  }

  return runbookResult(STATUS.GO_LIVE_READINESS_CONFIRMED_UNLICENSED_DECISION_SUPPORT, {
    lastVerifiedStage: 'E2I', releaseCandidate: release, verifiedPins,
    observed: {
      e2fProductionValidationComplete: true,
      e2gHumanReleaseDecisionsComplete: true,
      e2hExecutionCloseoutComplete: true,
      e2iGoLiveReady: true,
    },
    nextRequiredAction: 'A human owner may make the separate operational decision to expose the already deployed system within the approved UNLICENSED_DECISION_SUPPORT boundary. This runbook performs no go-live action.',
  });
}

module.exports = {
  STATUS,
  AUTHORITY,
  digest,
  releaseCandidateHash,
  pinCheck,
  preparePinnedE2gDecisionSigningRequest,
  preparePinnedE2hAttestationSigningRequest,
  preparePinnedE2iEvidenceSigningRequest,
  evaluateProductionGoLiveRunbook,
};
