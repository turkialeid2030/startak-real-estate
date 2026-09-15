'use strict';

const { sha256 } = require('./standards-registry');
const {
  E2D_STATUS,
  verifySubstantiveReviewActivationProposalIntegrity,
} = require('./substantive-review-activation-proposal');

const E2E_STATUS = Object.freeze({
  HOLD_E2D_PROPOSAL: 'HOLD_E2D_PROPOSAL',
  HOLD_IMPLEMENTATION_EVIDENCE: 'HOLD_IMPLEMENTATION_EVIDENCE',
  HOLD_CONFORMANCE_EVIDENCE: 'HOLD_CONFORMANCE_EVIDENCE',
  HOLD_CONFORMANCE_FAILURE: 'HOLD_CONFORMANCE_FAILURE',
  WAITING_FOR_IMPLEMENTATION_EVIDENCE: 'WAITING_FOR_IMPLEMENTATION_EVIDENCE',
  WAITING_FOR_CONFORMANCE_EVIDENCE: 'WAITING_FOR_CONFORMANCE_EVIDENCE',
  RULE_IMPLEMENTATION_EVIDENCE_READY_FOR_EXTERNAL_CONFORMANCE_VALIDATION: 'RULE_IMPLEMENTATION_EVIDENCE_READY_FOR_EXTERNAL_CONFORMANCE_VALIDATION',
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

function commitSha(value, field) {
  assertNonEmpty(value, field);
  if (!/^[a-f0-9]{40}$/i.test(value)) throw new TypeError(`${field} must be a 40-character commit SHA`);
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
  if (policy.operatingMode !== 'UNLICENSED_DECISION_SUPPORT') throw new TypeError('E2E_OPERATING_MODE_MUST_REMAIN_UNLICENSED_DECISION_SUPPORT');
  if (policy.requiredUpstreamStatus !== E2D_STATUS.ACTIVATION_PROPOSAL_READY_FOR_IMPLEMENTATION_GOVERNANCE) throw new TypeError('E2E_REQUIRED_UPSTREAM_STATUS_INVALID');
  if (policy.implementationSelfVerificationAllowed !== false) throw new TypeError('E2E_SELF_VERIFICATION_MUST_REMAIN_FALSE');
  if (policy.callerDeclaredConformanceAcceptedAsFormalConformance !== false) throw new TypeError('E2E_CALLER_DECLARED_CONFORMANCE_MUST_NOT_ESTABLISH_FORMAL_CONFORMANCE');
  if (policy.automaticRuleActivationAllowed !== false) throw new TypeError('E2E_AUTOMATIC_RULE_ACTIVATION_MUST_REMAIN_FALSE');
  if (policy.automaticReleaseAllowed !== false) throw new TypeError('E2E_AUTOMATIC_RELEASE_MUST_REMAIN_FALSE');
  if (!Array.isArray(policy.allowedConformanceResults) || policy.allowedConformanceResults.length === 0) throw new TypeError('policy.allowedConformanceResults must be non-empty');
  return true;
}

function boundary() {
  return deepFreeze({
    formalStandardsConformanceEstablished: false,
    standardsOrRulesActivated: false,
    legalConclusionEstablished: false,
    professionalApplicabilityEstablished: false,
    saudiProfessionalLicensingEstablished: false,
    certifiedValuationAuthorityEstablished: false,
    externalIssuanceAuthorized: false,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    transactionAuthorized: false,
  });
}

function hold(status, packetId, proposalPacket, policy, blockers, preparedByRef, preparedAtIso) {
  return deepFreeze({
    schemaVersion: 1,
    evidencePacketId: packetId,
    upstreamProposalId: proposalPacket?.proposalId || null,
    upstreamProposalHashSha256: proposalPacket?.proposalPacketHashSha256 || null,
    policyId: policy?.policyId || null,
    status,
    blockers: Object.freeze([...blockers]),
    implementationEvidence: Object.freeze([]),
    conformanceEvidence: Object.freeze([]),
    preparedByRef,
    preparedAt: preparedAtIso,
    evidencePacketHashSha256: null,
    implementationEvidenceComplete: false,
    conformanceEvidenceComplete: false,
    independentConformanceEvidenceRecorded: false,
    externalConformanceValidationRequired: true,
    ...boundary(),
  });
}

function normalizedRules(list, field) {
  if (!Array.isArray(list) || list.length === 0) throw new TypeError(`${field} must be a non-empty array`);
  return Object.freeze([...new Set(list.map((value, index) => {
    assertNonEmpty(value, `${field}[${index}]`);
    return value.trim();
  }))].sort());
}

function normalizeImplementation(record) {
  if (!record || typeof record !== 'object') throw new TypeError('implementation evidence record must be an object');
  for (const field of ['implementationId', 'candidateId', 'ruleSetId', 'sourceCommitSha', 'codeArtifactSha256', 'implementationEvidenceRef', 'implementedByRef', 'implementedAt']) {
    assertNonEmpty(record[field], `implementationEvidence.${field}`);
  }
  const core = {
    implementationId: record.implementationId.trim(),
    candidateId: record.candidateId.trim(),
    ruleSetId: record.ruleSetId.trim(),
    implementedRuleRefs: normalizedRules(record.implementedRuleRefs, 'implementationEvidence.implementedRuleRefs'),
    sourceCommitSha: commitSha(record.sourceCommitSha, 'implementationEvidence.sourceCommitSha'),
    codeArtifactSha256: digest(record.codeArtifactSha256, 'implementationEvidence.codeArtifactSha256'),
    implementationEvidenceRef: record.implementationEvidenceRef.trim(),
    implementedByRef: record.implementedByRef.trim(),
    implementedAt: iso(record.implementedAt, 'implementationEvidence.implementedAt'),
  };
  return deepFreeze({ ...core, implementationRecordHashSha256: sha256(core) });
}

function normalizeConformance(record, policy) {
  if (!record || typeof record !== 'object') throw new TypeError('conformance evidence record must be an object');
  for (const field of ['conformanceId', 'candidateId', 'ruleSetId', 'testSuiteRef', 'testArtifactSha256', 'conformanceEvidenceRef', 'conformanceArtifactSha256', 'verifiedByRef', 'verifiedAt', 'result']) {
    assertNonEmpty(record[field], `conformanceEvidence.${field}`);
  }
  if (!policy.allowedConformanceResults.includes(record.result)) throw new TypeError(`CONFORMANCE_RESULT_NOT_ALLOWED:${record.result}`);
  const core = {
    conformanceId: record.conformanceId.trim(),
    candidateId: record.candidateId.trim(),
    ruleSetId: record.ruleSetId.trim(),
    testedRuleRefs: normalizedRules(record.testedRuleRefs, 'conformanceEvidence.testedRuleRefs'),
    testSuiteRef: record.testSuiteRef.trim(),
    testArtifactSha256: digest(record.testArtifactSha256, 'conformanceEvidence.testArtifactSha256'),
    conformanceEvidenceRef: record.conformanceEvidenceRef.trim(),
    conformanceArtifactSha256: digest(record.conformanceArtifactSha256, 'conformanceEvidence.conformanceArtifactSha256'),
    verifiedByRef: record.verifiedByRef.trim(),
    verifiedAt: iso(record.verifiedAt, 'conformanceEvidence.verifiedAt'),
    result: record.result,
  };
  return deepFreeze({ ...core, conformanceRecordHashSha256: sha256(core) });
}

function sameRules(a, b) {
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}

function createRuleImplementationConformanceEvidencePacket({
  evidencePacketId,
  activationProposalPacket,
  policy,
  implementationEvidence = [],
  conformanceEvidence = [],
  preparedByRef,
  preparedAt,
} = {}) {
  assertNonEmpty(evidencePacketId, 'evidencePacketId');
  assertNonEmpty(preparedByRef, 'preparedByRef');
  const preparedAtIso = iso(preparedAt, 'preparedAt');
  validatePolicy(policy);

  if (activationProposalPacket?.status !== E2D_STATUS.ACTIVATION_PROPOSAL_READY_FOR_IMPLEMENTATION_GOVERNANCE || !verifySubstantiveReviewActivationProposalIntegrity(activationProposalPacket)) {
    return hold(E2E_STATUS.HOLD_E2D_PROPOSAL, evidencePacketId.trim(), activationProposalPacket, policy, ['E2D_ACTIVATION_PROPOSAL_NOT_QUALIFIED'], preparedByRef.trim(), preparedAtIso);
  }
  if (!Array.isArray(implementationEvidence) || !Array.isArray(conformanceEvidence)) throw new TypeError('implementationEvidence and conformanceEvidence must be arrays');

  let implementations;
  let conformances;
  try {
    implementations = implementationEvidence.map(normalizeImplementation);
    conformances = conformanceEvidence.map((record) => normalizeConformance(record, policy));
  } catch (error) {
    return hold(E2E_STATUS.HOLD_IMPLEMENTATION_EVIDENCE, evidencePacketId.trim(), activationProposalPacket, policy, [error.message], preparedByRef.trim(), preparedAtIso);
  }

  const proposalByCandidate = new Map(activationProposalPacket.activationProposals.map((proposal) => [proposal.candidateId, proposal]));
  const blockers = [];
  const implementationIds = new Set();
  const implementationCandidates = new Set();
  for (const record of implementations) {
    if (implementationIds.has(record.implementationId)) blockers.push(`DUPLICATE_IMPLEMENTATION_ID:${record.implementationId}`);
    implementationIds.add(record.implementationId);
    if (implementationCandidates.has(record.candidateId)) blockers.push(`DUPLICATE_IMPLEMENTATION_CANDIDATE:${record.candidateId}`);
    implementationCandidates.add(record.candidateId);
    const proposal = proposalByCandidate.get(record.candidateId);
    if (!proposal) {
      blockers.push(`IMPLEMENTATION_FOR_NON_PROPOSED_CANDIDATE:${record.candidateId}`);
      continue;
    }
    if (record.ruleSetId !== proposal.ruleSetId) blockers.push(`IMPLEMENTATION_RULESET_MISMATCH:${record.candidateId}`);
    if (!sameRules(record.implementedRuleRefs, proposal.proposedRuleRefs)) blockers.push(`IMPLEMENTATION_RULE_COVERAGE_MISMATCH:${record.candidateId}`);
    if (Date.parse(record.implementedAt) < Date.parse(proposal.mappedAt)) blockers.push(`IMPLEMENTATION_BEFORE_MAPPING:${record.candidateId}`);
    if (Date.parse(record.implementedAt) > Date.parse(preparedAtIso)) blockers.push(`IMPLEMENTATION_AFTER_PACKET_PREPARATION:${record.candidateId}`);
  }
  if (blockers.length) {
    return hold(E2E_STATUS.HOLD_IMPLEMENTATION_EVIDENCE, evidencePacketId.trim(), activationProposalPacket, policy, blockers, preparedByRef.trim(), preparedAtIso);
  }

  const missingImplementations = activationProposalPacket.activationProposals.filter((proposal) => !implementations.some((record) => record.candidateId === proposal.candidateId)).map((proposal) => proposal.candidateId);
  if (missingImplementations.length) {
    const core = {
      schemaVersion: 1,
      evidencePacketId: evidencePacketId.trim(),
      upstreamProposalId: activationProposalPacket.proposalId,
      upstreamProposalHashSha256: activationProposalPacket.proposalPacketHashSha256,
      policyId: policy.policyId,
      implementationEvidence: implementations,
      conformanceEvidence: conformances,
      missingImplementationEvidence: Object.freeze([...missingImplementations]),
      missingConformanceEvidence: Object.freeze([]),
      preparedByRef: preparedByRef.trim(),
      preparedAt: preparedAtIso,
    };
    return deepFreeze({
      ...core,
      status: E2E_STATUS.WAITING_FOR_IMPLEMENTATION_EVIDENCE,
      blockers: Object.freeze([]),
      evidencePacketHashSha256: sha256(core),
      implementationEvidenceComplete: false,
      conformanceEvidenceComplete: false,
      independentConformanceEvidenceRecorded: false,
      externalConformanceValidationRequired: true,
      ...boundary(),
    });
  }

  const conformanceBlockers = [];
  const conformanceIds = new Set();
  const conformanceCandidates = new Set();
  for (const record of conformances) {
    if (conformanceIds.has(record.conformanceId)) conformanceBlockers.push(`DUPLICATE_CONFORMANCE_ID:${record.conformanceId}`);
    conformanceIds.add(record.conformanceId);
    if (conformanceCandidates.has(record.candidateId)) conformanceBlockers.push(`DUPLICATE_CONFORMANCE_CANDIDATE:${record.candidateId}`);
    conformanceCandidates.add(record.candidateId);
    const proposal = proposalByCandidate.get(record.candidateId);
    const implementation = implementations.find((item) => item.candidateId === record.candidateId);
    if (!proposal || !implementation) {
      conformanceBlockers.push(`CONFORMANCE_FOR_UNIMPLEMENTED_CANDIDATE:${record.candidateId}`);
      continue;
    }
    if (record.ruleSetId !== proposal.ruleSetId || record.ruleSetId !== implementation.ruleSetId) conformanceBlockers.push(`CONFORMANCE_RULESET_MISMATCH:${record.candidateId}`);
    if (!sameRules(record.testedRuleRefs, implementation.implementedRuleRefs)) conformanceBlockers.push(`CONFORMANCE_RULE_COVERAGE_MISMATCH:${record.candidateId}`);
    if (policy.implementationSelfVerificationAllowed === false && record.verifiedByRef === implementation.implementedByRef) conformanceBlockers.push(`IMPLEMENTATION_SELF_VERIFICATION_PROHIBITED:${record.candidateId}`);
    if (Date.parse(record.verifiedAt) < Date.parse(implementation.implementedAt)) conformanceBlockers.push(`CONFORMANCE_BEFORE_IMPLEMENTATION:${record.candidateId}`);
    if (Date.parse(record.verifiedAt) > Date.parse(preparedAtIso)) conformanceBlockers.push(`CONFORMANCE_AFTER_PACKET_PREPARATION:${record.candidateId}`);
  }
  if (conformanceBlockers.length) {
    return hold(E2E_STATUS.HOLD_CONFORMANCE_EVIDENCE, evidencePacketId.trim(), activationProposalPacket, policy, conformanceBlockers, preparedByRef.trim(), preparedAtIso);
  }

  const failed = conformances.filter((record) => record.result === 'FAIL');
  if (failed.length) {
    return hold(E2E_STATUS.HOLD_CONFORMANCE_FAILURE, evidencePacketId.trim(), activationProposalPacket, policy, failed.map((record) => `CONFORMANCE_RESULT_FAIL:${record.candidateId}:${record.conformanceId}`), preparedByRef.trim(), preparedAtIso);
  }

  const missingConformance = implementations.filter((implementation) => !conformances.some((record) => record.candidateId === implementation.candidateId && record.result === 'PASS')).map((implementation) => implementation.candidateId);
  if (missingConformance.length) {
    const core = {
      schemaVersion: 1,
      evidencePacketId: evidencePacketId.trim(),
      upstreamProposalId: activationProposalPacket.proposalId,
      upstreamProposalHashSha256: activationProposalPacket.proposalPacketHashSha256,
      policyId: policy.policyId,
      implementationEvidence: implementations,
      conformanceEvidence: conformances,
      missingImplementationEvidence: Object.freeze([]),
      missingConformanceEvidence: Object.freeze([...missingConformance]),
      preparedByRef: preparedByRef.trim(),
      preparedAt: preparedAtIso,
    };
    return deepFreeze({
      ...core,
      status: E2E_STATUS.WAITING_FOR_CONFORMANCE_EVIDENCE,
      blockers: Object.freeze([]),
      evidencePacketHashSha256: sha256(core),
      implementationEvidenceComplete: true,
      conformanceEvidenceComplete: false,
      independentConformanceEvidenceRecorded: false,
      externalConformanceValidationRequired: true,
      ...boundary(),
    });
  }

  const core = {
    schemaVersion: 1,
    evidencePacketId: evidencePacketId.trim(),
    upstreamProposalId: activationProposalPacket.proposalId,
    upstreamProposalHashSha256: activationProposalPacket.proposalPacketHashSha256,
    policyId: policy.policyId,
    implementationEvidence: implementations,
    conformanceEvidence: conformances,
    missingImplementationEvidence: Object.freeze([]),
    missingConformanceEvidence: Object.freeze([]),
    preparedByRef: preparedByRef.trim(),
    preparedAt: preparedAtIso,
  };
  return deepFreeze({
    ...core,
    status: E2E_STATUS.RULE_IMPLEMENTATION_EVIDENCE_READY_FOR_EXTERNAL_CONFORMANCE_VALIDATION,
    blockers: Object.freeze([]),
    evidencePacketHashSha256: sha256(core),
    implementationEvidenceComplete: true,
    conformanceEvidenceComplete: true,
    independentConformanceEvidenceRecorded: true,
    externalConformanceValidationRequired: true,
    ...boundary(),
    semantics: 'E2E validates exact implementation/conformance evidence coverage and role separation against a qualified E2D proposal. It records evidence readiness only. It does not authenticate independent conformance evidence, establish formal standards conformance, activate rules, establish professional licensing/certified valuation authority, or authorize external issuance/release/merge/deployment/transactions.',
  });
}

function verifyRuleImplementationConformanceEvidencePacketIntegrity(packet) {
  if (!packet || !/^[a-f0-9]{64}$/i.test(String(packet.evidencePacketHashSha256 || ''))) return false;
  const core = {
    schemaVersion: packet.schemaVersion,
    evidencePacketId: packet.evidencePacketId,
    upstreamProposalId: packet.upstreamProposalId,
    upstreamProposalHashSha256: packet.upstreamProposalHashSha256,
    policyId: packet.policyId,
    implementationEvidence: packet.implementationEvidence,
    conformanceEvidence: packet.conformanceEvidence,
    missingImplementationEvidence: packet.missingImplementationEvidence,
    missingConformanceEvidence: packet.missingConformanceEvidence,
    preparedByRef: packet.preparedByRef,
    preparedAt: packet.preparedAt,
  };
  return sha256(core) === packet.evidencePacketHashSha256.toLowerCase();
}

module.exports = {
  E2E_STATUS,
  validatePolicy,
  normalizeImplementation,
  normalizeConformance,
  createRuleImplementationConformanceEvidencePacket,
  verifyRuleImplementationConformanceEvidencePacketIntegrity,
};
