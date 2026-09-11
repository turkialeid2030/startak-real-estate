'use strict';

const base = require('./production-go-live-runbook');
const {
  verifyE2fDerivedStateIntegrity,
  verifyE2gDerivedStateIntegrity,
  verifyE2hDerivedStateIntegrity,
  verifyE2iDerivedStateIntegrity,
} = require('./production-stage-derived-state-integrity');

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function strictHold(stage, message, packet = null) {
  const hashFieldByStage = {
    E2F: 'validationPacketHashSha256',
    E2G: 'decisionPacketHashSha256',
    E2H: 'closeoutPacketHashSha256',
    E2I: 'readinessPacketHashSha256',
  };
  return deepFreeze({
    schemaVersion: 1,
    status: base.STATUS.HOLD_PRODUCTION_CHAIN_INTEGRITY,
    blockers: Object.freeze([`${stage}_DERIVED_STATE_INTEGRITY_INVALID`]),
    lastVerifiedStage: null,
    releaseCandidate: packet?.releaseCandidate || null,
    releaseCandidateHashSha256: packet?.releaseCandidate ? base.releaseCandidateHash(packet.releaseCandidate) : null,
    nextRequiredAction: message,
    missingEvidenceTypes: Object.freeze([]),
    verifiedPins: Object.freeze({}),
    observed: Object.freeze({}),
    productionMutationPerformed: false,
    goLiveReadinessConfirmed: false,
    goLiveOperatingMode: 'UNLICENSED_DECISION_SUPPORT',
    noFurtherInternalGateCanSubstituteForExternalEvidence: true,
    rejectedPacketHashSha256: packet?.[hashFieldByStage[stage]] || null,
    authority: base.AUTHORITY,
  });
}

function verifyStage(stage, packet) {
  if (stage === 'E2F') return verifyE2fDerivedStateIntegrity(packet);
  if (stage === 'E2G') return verifyE2gDerivedStateIntegrity(packet);
  if (stage === 'E2H') return verifyE2hDerivedStateIntegrity(packet);
  if (stage === 'E2I') return verifyE2iDerivedStateIntegrity(packet);
  return false;
}

function preparePinnedE2gDecisionSigningRequest(input = {}) {
  if (!verifyStage('E2F', input.upstreamValidationPacket)) {
    return strictHold('E2F', 'Reject the signing request and recreate the E2F packet through the governed E2F factory; status/authority flags must be derivable from the hashed validation records.', input.upstreamValidationPacket);
  }
  return base.preparePinnedE2gDecisionSigningRequest(input);
}

function preparePinnedE2hAttestationSigningRequest(input = {}) {
  if (!verifyStage('E2G', input.upstreamDecisionPacket)) {
    return strictHold('E2G', 'Reject the attestation request and recreate the E2G packet through the governed E2G factory; authorization flags must be derivable from the hashed human decisions.', input.upstreamDecisionPacket);
  }
  return base.preparePinnedE2hAttestationSigningRequest(input);
}

function preparePinnedE2iEvidenceSigningRequest(input = {}) {
  if (!verifyStage('E2H', input.upstreamCloseoutPacket)) {
    return strictHold('E2H', 'Reject the readiness-evidence request and recreate the E2H packet through the governed E2H factory; execution flags must be derivable from the hashed attestations.', input.upstreamCloseoutPacket);
  }
  return base.preparePinnedE2iEvidenceSigningRequest(input);
}

function evaluateProductionGoLiveRunbook(input = {}) {
  const stages = [
    ['E2F', 'e2fValidationPacket'],
    ['E2G', 'e2gDecisionPacket'],
    ['E2H', 'e2hCloseoutPacket'],
    ['E2I', 'e2iReadinessPacket'],
  ];
  for (const [stage, field] of stages) {
    const packet = input[field];
    if (packet && !verifyStage(stage, packet)) {
      return strictHold(stage, `Reject ${stage} packet: mutable derived status/authority fields are inconsistent with the records covered by the packet hash. Recreate the packet from governed source evidence before continuing.`, packet);
    }
  }
  return base.evaluateProductionGoLiveRunbook(input);
}

module.exports = {
  STATUS: base.STATUS,
  AUTHORITY: base.AUTHORITY,
  digest: base.digest,
  releaseCandidateHash: base.releaseCandidateHash,
  pinCheck: base.pinCheck,
  verifyStage,
  preparePinnedE2gDecisionSigningRequest,
  preparePinnedE2hAttestationSigningRequest,
  preparePinnedE2iEvidenceSigningRequest,
  evaluateProductionGoLiveRunbook,
};
