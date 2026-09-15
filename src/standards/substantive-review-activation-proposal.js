'use strict';

const { sha256 } = require('./standards-registry');
const {
  APPLICABILITY_PACKET_STATUS,
  REVIEW_DISPOSITION,
  verifyApplicabilityPacketIntegrity,
} = require('./saudi-legal-professional-applicability');
const {
  E2B_STATUS,
  verifyExternalEvidenceEnvelopeIntegrity,
} = require('./external-review-credential-evidence');
const {
  E2C_STATUS,
  verifyExternalAuthorityValidationPacketIntegrity,
} = require('./external-authority-validation');

const E2D_STATUS = Object.freeze({
  HOLD_APPLICABILITY_DISPOSITION: 'HOLD_APPLICABILITY_DISPOSITION',
  HOLD_E2B_EVIDENCE_CHAIN: 'HOLD_E2B_EVIDENCE_CHAIN',
  HOLD_E2C_AUTHORITY_VALIDATION: 'HOLD_E2C_AUTHORITY_VALIDATION',
  HOLD_PROPOSAL_INTEGRITY: 'HOLD_PROPOSAL_INTEGRITY',
  HOLD_SUBSTANTIVE_REVIEW: 'HOLD_SUBSTANTIVE_REVIEW',
  WAITING_FOR_ACTIVATION_MAPPING: 'WAITING_FOR_ACTIVATION_MAPPING',
  NO_ACTIVATION_PROPOSED: 'NO_ACTIVATION_PROPOSED',
  ACTIVATION_PROPOSAL_READY_FOR_IMPLEMENTATION_GOVERNANCE: 'ACTIVATION_PROPOSAL_READY_FOR_IMPLEMENTATION_GOVERNANCE',
});

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertNonEmpty(value, field) {
  if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`);
}

function iso(value, field) {
  assertNonEmpty(value, field);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return date.toISOString();
}

function digest(value, field) {
  assertNonEmpty(value, field);
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new TypeError(`${field} must be a SHA-256 hex digest`);
  return value.toLowerCase();
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function validatePolicy(policy) {
  if (!policy || typeof policy !== 'object') throw new TypeError('policy must be an object');
  assertNonEmpty(policy.policyId, 'policy.policyId');
  if (policy.operatingMode !== 'UNLICENSED_DECISION_SUPPORT') throw new TypeError('E2D_OPERATING_MODE_MUST_REMAIN_UNLICENSED_DECISION_SUPPORT');
  if (policy.requiredApplicabilityStatus !== APPLICABILITY_PACKET_STATUS.HUMAN_REVIEW_DISPOSITIONS_RECORDED_PENDING_AUTHORITY_VALIDATION) {
    throw new TypeError('E2D_REQUIRED_APPLICABILITY_STATUS_INVALID');
  }
  if (policy.requiredExternalEvidenceStatus !== E2B_STATUS.READY_FOR_EXTERNAL_AUTHORITY_VALIDATION) throw new TypeError('E2D_REQUIRED_E2B_STATUS_INVALID');
  if (policy.requiredAuthorityValidationStatus !== E2C_STATUS.AUTHORITY_VALIDATION_COMPLETE_PENDING_SUBSTANTIVE_REVIEW) throw new TypeError('E2D_REQUIRED_E2C_STATUS_INVALID');
  for (const field of [
    'automaticActivationAllowed',
    'automaticLegalConclusionAllowed',
    'automaticProfessionalConclusionAllowed',
    'automaticComplianceConclusionAllowed',
    'callerDeclaredActivationAuthorityAccepted',
  ]) {
    if (policy[field] !== false) throw new TypeError(`E2D_AUTHORITY_FLAG_MUST_REMAIN_FALSE:${field}`);
  }
  if (!policy.allowedDispositionActions || typeof policy.allowedDispositionActions !== 'object') throw new TypeError('policy.allowedDispositionActions must be an object');
  for (const disposition of Object.values(REVIEW_DISPOSITION)) {
    assertNonEmpty(policy.allowedDispositionActions[disposition], `policy.allowedDispositionActions.${disposition}`);
  }
  if (!Array.isArray(policy.mappingRequiredForDispositions)) throw new TypeError('policy.mappingRequiredForDispositions must be an array');
  return true;
}

function substantiveBoundary() {
  return deepFreeze({
    standardsOrRulesActivated: false,
    legalConclusionEstablished: false,
    professionalApplicabilityEstablished: false,
    formalStandardsConformanceEstablished: false,
    saudiProfessionalLicensingEstablished: false,
    pdplComplianceEstablished: false,
    taxComplianceEstablished: false,
    financialReportingComplianceEstablished: false,
    certifiedValuationAuthorityEstablished: false,
    externalIssuanceAuthorized: false,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    transactionAuthorized: false,
  });
}

function hold(status, proposalId, applicabilityPacket, envelope, authorityPacket, policy, blockers, preparedByRef, preparedAtIso) {
  return deepFreeze({
    schemaVersion: 1,
    proposalId,
    applicabilityPacketId: applicabilityPacket?.reviewPacketId || null,
    applicabilityPacketHashSha256: applicabilityPacket?.packetHashSha256 || null,
    externalEvidenceEnvelopeId: envelope?.envelopeId || null,
    externalEvidenceEnvelopeHashSha256: envelope?.envelopeHashSha256 || null,
    authorityValidationPacketId: authorityPacket?.validationPacketId || null,
    authorityValidationPacketHashSha256: authorityPacket?.validationPacketHashSha256 || null,
    policyId: policy?.policyId || null,
    status,
    blockers: Object.freeze([...blockers]),
    activationProposals: Object.freeze([]),
    exclusions: Object.freeze([]),
    preparedByRef,
    preparedAt: preparedAtIso,
    proposalPacketHashSha256: null,
    substantiveReviewDispositionChainValidated: false,
    activationProposalPrepared: false,
    implementationGovernanceRequired: true,
    ...substantiveBoundary(),
  });
}

function normalizeActivationMapping(record, conditionalRequiresConditionsRef) {
  if (!record || typeof record !== 'object') throw new TypeError('activation mapping must be an object');
  for (const field of ['candidateId', 'ruleSetId', 'implementationScopeRef', 'mappingEvidenceRef', 'mappingArtifactSha256', 'mappedByRef', 'mappedAt']) {
    assertNonEmpty(record[field], `activationMapping.${field}`);
  }
  if (!Array.isArray(record.proposedRuleRefs) || record.proposedRuleRefs.length === 0) throw new TypeError(`ACTIVATION_MAPPING_RULE_REFS_REQUIRED:${record.candidateId}`);
  const proposedRuleRefs = record.proposedRuleRefs.map((ref, index) => {
    assertNonEmpty(ref, `activationMapping.proposedRuleRefs[${index}]`);
    return ref.trim();
  });
  const normalized = {
    candidateId: record.candidateId.trim(),
    ruleSetId: record.ruleSetId.trim(),
    proposedRuleRefs: Object.freeze([...new Set(proposedRuleRefs)].sort()),
    implementationScopeRef: record.implementationScopeRef.trim(),
    mappingEvidenceRef: record.mappingEvidenceRef.trim(),
    mappingArtifactSha256: digest(record.mappingArtifactSha256, 'activationMapping.mappingArtifactSha256'),
    conditionsRef: nonEmpty(record.conditionsRef) ? record.conditionsRef.trim() : null,
    mappedByRef: record.mappedByRef.trim(),
    mappedAt: iso(record.mappedAt, 'activationMapping.mappedAt'),
  };
  if (conditionalRequiresConditionsRef && record.disposition === REVIEW_DISPOSITION.CONDITIONAL && !normalized.conditionsRef) {
    throw new TypeError(`CONDITIONAL_ACTIVATION_MAPPING_CONDITIONS_REQUIRED:${normalized.candidateId}`);
  }
  return deepFreeze(normalized);
}

function validateChain(applicabilityPacket, envelope, authorityPacket) {
  const blockers = [];
  if (applicabilityPacket?.status !== APPLICABILITY_PACKET_STATUS.HUMAN_REVIEW_DISPOSITIONS_RECORDED_PENDING_AUTHORITY_VALIDATION || !verifyApplicabilityPacketIntegrity(applicabilityPacket)) {
    blockers.push('E2_APPLICABILITY_DISPOSITIONS_NOT_QUALIFIED');
    return blockers;
  }
  if (!applicabilityPacket.triggeredCandidates.every((candidate) => candidate.reviewDisposition && candidate.reviewerRef && candidate.humanReviewEvidenceRef && candidate.reviewedAt)) {
    blockers.push('E2_ALL_TRIGGERED_CANDIDATE_DISPOSITIONS_REQUIRED');
  }
  if (envelope?.status !== E2B_STATUS.READY_FOR_EXTERNAL_AUTHORITY_VALIDATION || !verifyExternalEvidenceEnvelopeIntegrity(envelope)) {
    blockers.push('E2B_EXTERNAL_EVIDENCE_ENVELOPE_NOT_QUALIFIED');
  } else if (envelope.applicabilityPacketHash !== applicabilityPacket.packetHashSha256) {
    blockers.push('E2_TO_E2B_HASH_CHAIN_MISMATCH');
  }
  if (authorityPacket?.status !== E2C_STATUS.AUTHORITY_VALIDATION_COMPLETE_PENDING_SUBSTANTIVE_REVIEW || !verifyExternalAuthorityValidationPacketIntegrity(authorityPacket)) {
    blockers.push('E2C_AUTHORITY_VALIDATION_NOT_QUALIFIED');
  } else if (envelope?.envelopeHashSha256 && authorityPacket.upstreamEnvelopeHashSha256 !== envelope.envelopeHashSha256) {
    blockers.push('E2B_TO_E2C_HASH_CHAIN_MISMATCH');
  }
  if (authorityPacket && [
    'externalReviewAuthenticityValidated',
    'credentialAuthenticityValidated',
    'reviewerAuthorityValidated',
    'reviewerCredentialsVerified',
    'reviewerIndependenceVerified',
    'externalAuthorityValidationComplete',
  ].some((field) => authorityPacket[field] !== true)) {
    blockers.push('E2C_REQUIRED_AUTHORITY_GATES_NOT_ALL_TRUE');
  }
  if (envelope && applicabilityPacket?.triggeredCandidates) {
    for (const candidate of applicabilityPacket.triggeredCandidates) {
      const reviewEvidence = envelope.reviewEvidence?.find((record) => record.candidateId === candidate.candidateId && record.evidenceId === candidate.humanReviewEvidenceRef && record.reviewerRef === candidate.reviewerRef);
      if (!reviewEvidence) blockers.push(`HUMAN_DISPOSITION_EVIDENCE_NOT_LINKED_TO_E2B:${candidate.candidateId}`);
    }
  }
  return blockers;
}

function createSubstantiveReviewActivationProposal({
  proposalId,
  applicabilityPacket,
  externalEvidenceEnvelope,
  authorityValidationPacket,
  policy,
  activationMappings = [],
  preparedByRef,
  preparedAt,
} = {}) {
  assertNonEmpty(proposalId, 'proposalId');
  assertNonEmpty(preparedByRef, 'preparedByRef');
  const preparedAtIso = iso(preparedAt, 'preparedAt');
  validatePolicy(policy);

  const chainBlockers = validateChain(applicabilityPacket, externalEvidenceEnvelope, authorityValidationPacket);
  if (chainBlockers.some((item) => item.startsWith('E2_APPLICABILITY'))) {
    return hold(E2D_STATUS.HOLD_APPLICABILITY_DISPOSITION, proposalId.trim(), applicabilityPacket, externalEvidenceEnvelope, authorityValidationPacket, policy, chainBlockers, preparedByRef.trim(), preparedAtIso);
  }
  if (chainBlockers.some((item) => item.startsWith('E2B_') || item.startsWith('E2_TO_E2B') || item.startsWith('HUMAN_DISPOSITION_EVIDENCE'))) {
    return hold(E2D_STATUS.HOLD_E2B_EVIDENCE_CHAIN, proposalId.trim(), applicabilityPacket, externalEvidenceEnvelope, authorityValidationPacket, policy, chainBlockers, preparedByRef.trim(), preparedAtIso);
  }
  if (chainBlockers.length) {
    return hold(E2D_STATUS.HOLD_E2C_AUTHORITY_VALIDATION, proposalId.trim(), applicabilityPacket, externalEvidenceEnvelope, authorityValidationPacket, policy, chainBlockers, preparedByRef.trim(), preparedAtIso);
  }

  if (!Array.isArray(activationMappings)) throw new TypeError('activationMappings must be an array');
  const mappingBlockers = [];
  const candidateById = new Map(applicabilityPacket.triggeredCandidates.map((candidate) => [candidate.candidateId, candidate]));
  const normalizedMappings = [];
  const seen = new Set();
  for (const raw of activationMappings) {
    const candidate = candidateById.get(raw?.candidateId);
    if (!candidate) {
      mappingBlockers.push(`ACTIVATION_MAPPING_FOR_NON_TRIGGERED_CANDIDATE:${raw?.candidateId || 'MISSING'}`);
      continue;
    }
    if (!policy.mappingRequiredForDispositions.includes(candidate.reviewDisposition)) {
      mappingBlockers.push(`ACTIVATION_MAPPING_NOT_ALLOWED_FOR_DISPOSITION:${candidate.candidateId}:${candidate.reviewDisposition}`);
      continue;
    }
    let normalized;
    try {
      normalized = normalizeActivationMapping({ ...raw, disposition: candidate.reviewDisposition }, policy.conditionalDispositionRequiresConditionsRef === true);
    } catch (error) {
      mappingBlockers.push(error.message);
      continue;
    }
    if (seen.has(normalized.candidateId)) mappingBlockers.push(`DUPLICATE_ACTIVATION_MAPPING:${normalized.candidateId}`);
    seen.add(normalized.candidateId);
    if (Date.parse(normalized.mappedAt) < Date.parse(candidate.reviewedAt)) mappingBlockers.push(`ACTIVATION_MAPPING_BEFORE_HUMAN_REVIEW:${normalized.candidateId}`);
    if (Date.parse(normalized.mappedAt) > Date.parse(preparedAtIso)) mappingBlockers.push(`ACTIVATION_MAPPING_AFTER_PROPOSAL_PREPARATION:${normalized.candidateId}`);
    normalizedMappings.push(normalized);
  }
  if (mappingBlockers.length) {
    return hold(E2D_STATUS.HOLD_PROPOSAL_INTEGRITY, proposalId.trim(), applicabilityPacket, externalEvidenceEnvelope, authorityValidationPacket, policy, mappingBlockers, preparedByRef.trim(), preparedAtIso);
  }

  const heldCandidates = applicabilityPacket.triggeredCandidates.filter((candidate) => candidate.reviewDisposition === REVIEW_DISPOSITION.HOLD);
  if (heldCandidates.length) {
    return hold(E2D_STATUS.HOLD_SUBSTANTIVE_REVIEW, proposalId.trim(), applicabilityPacket, externalEvidenceEnvelope, authorityValidationPacket, policy, heldCandidates.map((candidate) => `HUMAN_REVIEW_DISPOSITION_HOLD:${candidate.candidateId}`), preparedByRef.trim(), preparedAtIso);
  }

  const proposalCandidates = applicabilityPacket.triggeredCandidates.filter((candidate) => policy.mappingRequiredForDispositions.includes(candidate.reviewDisposition));
  const missingMappings = proposalCandidates.filter((candidate) => !normalizedMappings.some((mapping) => mapping.candidateId === candidate.candidateId));
  if (missingMappings.length) {
    const core = {
      schemaVersion: 1,
      proposalId: proposalId.trim(),
      applicabilityPacketId: applicabilityPacket.reviewPacketId,
      applicabilityPacketHashSha256: applicabilityPacket.packetHashSha256,
      externalEvidenceEnvelopeId: externalEvidenceEnvelope.envelopeId,
      externalEvidenceEnvelopeHashSha256: externalEvidenceEnvelope.envelopeHashSha256,
      authorityValidationPacketId: authorityValidationPacket.validationPacketId,
      authorityValidationPacketHashSha256: authorityValidationPacket.validationPacketHashSha256,
      policyId: policy.policyId,
      activationMappings: normalizedMappings,
      missingActivationMappings: Object.freeze(missingMappings.map((candidate) => candidate.candidateId)),
      preparedByRef: preparedByRef.trim(),
      preparedAt: preparedAtIso,
    };
    return deepFreeze({
      ...core,
      status: E2D_STATUS.WAITING_FOR_ACTIVATION_MAPPING,
      blockers: Object.freeze([]),
      activationProposals: Object.freeze([]),
      exclusions: Object.freeze(applicabilityPacket.triggeredCandidates.filter((candidate) => candidate.reviewDisposition === REVIEW_DISPOSITION.NOT_APPLICABLE).map((candidate) => deepFreeze({ candidateId: candidate.candidateId, disposition: candidate.reviewDisposition, action: policy.allowedDispositionActions[candidate.reviewDisposition] }))),
      proposalPacketHashSha256: sha256(core),
      substantiveReviewDispositionChainValidated: true,
      activationProposalPrepared: false,
      implementationGovernanceRequired: true,
      ...substantiveBoundary(),
    });
  }

  const activationProposals = proposalCandidates.map((candidate) => {
    const mapping = normalizedMappings.find((item) => item.candidateId === candidate.candidateId);
    return deepFreeze({
      candidateId: candidate.candidateId,
      domain: candidate.domain,
      reviewClass: candidate.reviewClass,
      validatedHumanDisposition: candidate.reviewDisposition,
      reviewerRef: candidate.reviewerRef,
      humanReviewEvidenceRef: candidate.humanReviewEvidenceRef,
      sourceEvidenceRefs: candidate.sourceEvidenceRefs,
      proposedAction: policy.allowedDispositionActions[candidate.reviewDisposition],
      ruleSetId: mapping.ruleSetId,
      proposedRuleRefs: mapping.proposedRuleRefs,
      implementationScopeRef: mapping.implementationScopeRef,
      mappingEvidenceRef: mapping.mappingEvidenceRef,
      mappingArtifactSha256: mapping.mappingArtifactSha256,
      conditionsRef: mapping.conditionsRef,
      mappedByRef: mapping.mappedByRef,
      mappedAt: mapping.mappedAt,
      proposalOnly: true,
      activationAuthorized: false,
    });
  });
  const exclusions = applicabilityPacket.triggeredCandidates
    .filter((candidate) => candidate.reviewDisposition === REVIEW_DISPOSITION.NOT_APPLICABLE)
    .map((candidate) => deepFreeze({
      candidateId: candidate.candidateId,
      disposition: candidate.reviewDisposition,
      action: policy.allowedDispositionActions[candidate.reviewDisposition],
      activationAuthorized: false,
    }));

  const status = activationProposals.length === 0
    ? E2D_STATUS.NO_ACTIVATION_PROPOSED
    : E2D_STATUS.ACTIVATION_PROPOSAL_READY_FOR_IMPLEMENTATION_GOVERNANCE;

  const core = {
    schemaVersion: 1,
    proposalId: proposalId.trim(),
    applicabilityPacketId: applicabilityPacket.reviewPacketId,
    applicabilityPacketHashSha256: applicabilityPacket.packetHashSha256,
    externalEvidenceEnvelopeId: externalEvidenceEnvelope.envelopeId,
    externalEvidenceEnvelopeHashSha256: externalEvidenceEnvelope.envelopeHashSha256,
    authorityValidationPacketId: authorityValidationPacket.validationPacketId,
    authorityValidationPacketHashSha256: authorityValidationPacket.validationPacketHashSha256,
    policyId: policy.policyId,
    activationProposals,
    exclusions,
    preparedByRef: preparedByRef.trim(),
    preparedAt: preparedAtIso,
  };

  return deepFreeze({
    ...core,
    status,
    blockers: Object.freeze([]),
    proposalPacketHashSha256: sha256(core),
    substantiveReviewDispositionChainValidated: true,
    activationProposalPrepared: activationProposals.length > 0,
    implementationGovernanceRequired: activationProposals.length > 0,
    ...substantiveBoundary(),
    semantics: 'E2D validates the chain from recorded human disposition through E2B evidence and E2C authority validation, then prepares a non-executing rule-implementation proposal. The proposal does not activate any standard/rule and does not establish legal/professional/compliance conclusions, platform licensing, certified valuation authority, external issuance, release, merge, deployment or transaction authority.',
  });
}

function verifySubstantiveReviewActivationProposalIntegrity(packet) {
  if (!packet || !/^[a-f0-9]{64}$/i.test(String(packet.proposalPacketHashSha256 || ''))) return false;
  let core;
  if (packet.status === E2D_STATUS.WAITING_FOR_ACTIVATION_MAPPING) {
    core = {
      schemaVersion: packet.schemaVersion,
      proposalId: packet.proposalId,
      applicabilityPacketId: packet.applicabilityPacketId,
      applicabilityPacketHashSha256: packet.applicabilityPacketHashSha256,
      externalEvidenceEnvelopeId: packet.externalEvidenceEnvelopeId,
      externalEvidenceEnvelopeHashSha256: packet.externalEvidenceEnvelopeHashSha256,
      authorityValidationPacketId: packet.authorityValidationPacketId,
      authorityValidationPacketHashSha256: packet.authorityValidationPacketHashSha256,
      policyId: packet.policyId,
      activationMappings: packet.activationMappings,
      missingActivationMappings: packet.missingActivationMappings,
      preparedByRef: packet.preparedByRef,
      preparedAt: packet.preparedAt,
    };
  } else {
    core = {
      schemaVersion: packet.schemaVersion,
      proposalId: packet.proposalId,
      applicabilityPacketId: packet.applicabilityPacketId,
      applicabilityPacketHashSha256: packet.applicabilityPacketHashSha256,
      externalEvidenceEnvelopeId: packet.externalEvidenceEnvelopeId,
      externalEvidenceEnvelopeHashSha256: packet.externalEvidenceEnvelopeHashSha256,
      authorityValidationPacketId: packet.authorityValidationPacketId,
      authorityValidationPacketHashSha256: packet.authorityValidationPacketHashSha256,
      policyId: packet.policyId,
      activationProposals: packet.activationProposals,
      exclusions: packet.exclusions,
      preparedByRef: packet.preparedByRef,
      preparedAt: packet.preparedAt,
    };
  }
  return sha256(core) === packet.proposalPacketHashSha256.toLowerCase();
}

module.exports = {
  E2D_STATUS,
  validatePolicy,
  normalizeActivationMapping,
  validateChain,
  createSubstantiveReviewActivationProposal,
  verifySubstantiveReviewActivationProposalIntegrity,
};
