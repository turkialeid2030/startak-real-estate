'use strict';

const crypto = require('crypto');
const {
  CHANGE_QUALIFICATION_STATUS,
} = require('./engineering-change-qualification');

const HANDOFF_STATUS = Object.freeze({
  HOLD_CHANGE_QUALIFICATION: 'HOLD_CHANGE_QUALIFICATION',
  HOLD_EXPLICIT_SELECTION: 'HOLD_EXPLICIT_SELECTION',
  HOLD_UNQUALIFIED_SELECTION: 'HOLD_UNQUALIFIED_SELECTION',
  HOLD_RELEASE_CANDIDATE: 'HOLD_RELEASE_CANDIDATE',
  HOLD_CANDIDATE_BINDING: 'HOLD_CANDIDATE_BINDING',
  HOLD_OPERATING_MODE: 'HOLD_OPERATING_MODE',
  READY_FOR_EXISTING_RELEASE_GOVERNANCE_REVIEW: 'READY_FOR_EXISTING_RELEASE_GOVERNANCE_REVIEW',
});

const OPERATING_MODE = 'UNLICENSED_DECISION_SUPPORT';

const CANONICAL_COMPARISON_STATUS = Object.freeze({
  NOT_PROVIDED: 'NOT_PROVIDED',
  SKIPPED: 'SKIPPED',
  INCONCLUSIVE: 'INCONCLUSIVE',
  MATCH: 'MATCH',
  MISMATCH: 'MISMATCH',
});

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function requiredObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}

function sha256(value, field) {
  const text = requiredString(value, field).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(text)) throw new TypeError(`${field} must be a SHA-256 hex digest`);
  return text;
}

function commitSha(value, field) {
  const text = requiredString(value, field).toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(text)) throw new TypeError(`${field} must be a 40-character commit SHA`);
  return text;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function stableSort(value) {
  if (Array.isArray(value)) return value.map(stableSort);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = stableSort(value[key]);
    return result;
  }, {});
}

function integrityHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stableSort(value))).digest('hex');
}

function authorityBoundary() {
  return {
    formalStandardsConformanceEstablished: false,
    saudiProfessionalLicensingEstablished: false,
    pdplComplianceEstablished: false,
    certifiedValuationAuthorityEstablished: false,
    professionalReportExternalIssuanceAuthorized: false,
    canonicalOriginalComparisonAuthenticityVerified: false,
    externalEvidenceAuthenticityVerified: false,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    transactionAuthorized: false,
  };
}

function holdEnvelope({ projectId, caseId, status, reasonCodes, records = {} }) {
  return deepFreeze({
    schemaVersion: 1,
    projectId,
    caseId,
    status,
    reasonCodes: [...reasonCodes],
    ...records,
    authority: authorityBoundary(),
    downstreamReleaseGovernanceRequired: true,
    externalEvidenceRequired: true,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    transactionAuthorized: false,
  });
}

function normalizeReleaseCandidate(value) {
  requiredObject(value, 'releaseCandidate');
  return Object.freeze({
    candidateId: requiredString(value.candidateId, 'releaseCandidate.candidateId'),
    candidateRef: requiredString(value.candidateRef, 'releaseCandidate.candidateRef'),
    commitSha: commitSha(value.commitSha, 'releaseCandidate.commitSha'),
    artifactSha256: sha256(value.artifactSha256, 'releaseCandidate.artifactSha256'),
    operatingMode: requiredString(value.operatingMode, 'releaseCandidate.operatingMode'),
  });
}

function normalizeCanonicalOriginalComparison(value) {
  if (value == null) {
    return Object.freeze({
      status: CANONICAL_COMPARISON_STATUS.NOT_PROVIDED,
      comparisonEstablished: false,
      evidenceRef: null,
      expectedSha256: null,
      observedSha256: null,
      authenticityVerified: false,
    });
  }
  requiredObject(value, 'canonicalOriginalComparison');
  const status = requiredString(value.status, 'canonicalOriginalComparison.status');
  if (!Object.values(CANONICAL_COMPARISON_STATUS).includes(status)) {
    throw new TypeError(`invalid canonical comparison status: ${status}`);
  }
  if ([CANONICAL_COMPARISON_STATUS.NOT_PROVIDED, CANONICAL_COMPARISON_STATUS.SKIPPED, CANONICAL_COMPARISON_STATUS.INCONCLUSIVE].includes(status)) {
    return Object.freeze({
      status,
      comparisonEstablished: false,
      evidenceRef: value.evidenceRef == null ? null : requiredString(value.evidenceRef, 'canonicalOriginalComparison.evidenceRef'),
      expectedSha256: value.expectedSha256 == null ? null : sha256(value.expectedSha256, 'canonicalOriginalComparison.expectedSha256'),
      observedSha256: value.observedSha256 == null ? null : sha256(value.observedSha256, 'canonicalOriginalComparison.observedSha256'),
      authenticityVerified: false,
    });
  }

  const expectedSha256 = sha256(value.expectedSha256, 'canonicalOriginalComparison.expectedSha256');
  const observedSha256 = sha256(value.observedSha256, 'canonicalOriginalComparison.observedSha256');
  const evidenceRef = requiredString(value.evidenceRef, 'canonicalOriginalComparison.evidenceRef');
  if (status === CANONICAL_COMPARISON_STATUS.MATCH && expectedSha256 !== observedSha256) {
    throw new Error('CANONICAL_COMPARISON_MATCH_HASH_MISMATCH');
  }
  if (status === CANONICAL_COMPARISON_STATUS.MISMATCH && expectedSha256 === observedSha256) {
    throw new Error('CANONICAL_COMPARISON_MISMATCH_HASH_EQUAL');
  }
  return Object.freeze({
    status,
    comparisonEstablished: status === CANONICAL_COMPARISON_STATUS.MATCH,
    evidenceRef,
    expectedSha256,
    observedSha256,
    authenticityVerified: false,
  });
}

/**
 * Bridge a qualified engineering-change evidence package into the existing
 * release-governance machinery. This adapter deliberately does not create a
 * new release authority framework and does not promote any proposal implicitly.
 */
function buildChangeReleaseGovernanceHandoff({
  projectId,
  caseId,
  engineeringChangeQualification,
  selectedProposalRefs = [],
  releaseCandidate,
  canonicalOriginalComparison = null,
} = {}) {
  const scopedProjectId = requiredString(projectId, 'projectId');
  const scopedCaseId = requiredString(caseId, 'caseId');
  requiredObject(engineeringChangeQualification, 'engineeringChangeQualification');
  if (engineeringChangeQualification.projectId !== scopedProjectId || engineeringChangeQualification.caseId !== scopedCaseId) {
    throw new Error('CHANGE_RELEASE_HANDOFF_SCOPE_MISMATCH');
  }

  if (engineeringChangeQualification.status !== CHANGE_QUALIFICATION_STATUS.QUALIFIED_FOR_RELEASE_REVIEW_ONLY) {
    return holdEnvelope({
      projectId: scopedProjectId,
      caseId: scopedCaseId,
      status: HANDOFF_STATUS.HOLD_CHANGE_QUALIFICATION,
      reasonCodes: ['QUALIFIED_ENGINEERING_CHANGE_PACKAGE_REQUIRED'],
    });
  }

  if (!Array.isArray(selectedProposalRefs)) throw new TypeError('selectedProposalRefs must be an array');
  const selected = selectedProposalRefs.map((ref, index) => requiredString(ref, `selectedProposalRefs[${index}]`));
  const uniqueSelected = [...new Set(selected)];
  if (uniqueSelected.length !== selected.length) throw new Error('DUPLICATE_SELECTED_CHANGE_PROPOSAL_REF');
  if (uniqueSelected.length === 0) {
    return holdEnvelope({
      projectId: scopedProjectId,
      caseId: scopedCaseId,
      status: HANDOFF_STATUS.HOLD_EXPLICIT_SELECTION,
      reasonCodes: ['EXPLICIT_CHANGE_PROPOSAL_SELECTION_REQUIRED'],
    });
  }

  const qualifiedRefs = new Set(engineeringChangeQualification.qualifiedForReleaseReviewProposalRefs || []);
  const unqualifiedRefs = uniqueSelected.filter((ref) => !qualifiedRefs.has(ref));
  if (unqualifiedRefs.length) {
    return holdEnvelope({
      projectId: scopedProjectId,
      caseId: scopedCaseId,
      status: HANDOFF_STATUS.HOLD_UNQUALIFIED_SELECTION,
      reasonCodes: unqualifiedRefs.map((ref) => `SELECTED_PROPOSAL_NOT_QUALIFIED:${ref}`),
      records: { selectedProposalRefs: uniqueSelected },
    });
  }

  let candidate;
  try {
    candidate = normalizeReleaseCandidate(releaseCandidate);
  } catch (error) {
    return holdEnvelope({
      projectId: scopedProjectId,
      caseId: scopedCaseId,
      status: HANDOFF_STATUS.HOLD_RELEASE_CANDIDATE,
      reasonCodes: [error.message],
      records: { selectedProposalRefs: uniqueSelected },
    });
  }

  if (candidate.operatingMode !== OPERATING_MODE) {
    return holdEnvelope({
      projectId: scopedProjectId,
      caseId: scopedCaseId,
      status: HANDOFF_STATUS.HOLD_OPERATING_MODE,
      reasonCodes: [`OPERATING_MODE_MUST_REMAIN:${OPERATING_MODE}`],
      records: { selectedProposalRefs: uniqueSelected, releaseCandidate: candidate },
    });
  }

  const implementationByRef = new Map(
    (engineeringChangeQualification.implementationEvidence || []).map((item) => [item.proposalRef, item]),
  );
  const selectedImplementations = uniqueSelected.map((ref) => implementationByRef.get(ref));
  const missingImplementationRefs = uniqueSelected.filter((ref, index) => !selectedImplementations[index]);
  if (missingImplementationRefs.length) {
    return holdEnvelope({
      projectId: scopedProjectId,
      caseId: scopedCaseId,
      status: HANDOFF_STATUS.HOLD_CANDIDATE_BINDING,
      reasonCodes: missingImplementationRefs.map((ref) => `QUALIFIED_IMPLEMENTATION_EVIDENCE_MISSING:${ref}`),
      records: { selectedProposalRefs: uniqueSelected, releaseCandidate: candidate },
    });
  }

  const bindingMismatches = selectedImplementations.flatMap((implementation) => {
    const mismatches = [];
    if (implementation.commitSha !== candidate.commitSha) mismatches.push(`CANDIDATE_COMMIT_MISMATCH:${implementation.proposalRef}`);
    if (implementation.artifactSha256 !== candidate.artifactSha256) mismatches.push(`CANDIDATE_ARTIFACT_MISMATCH:${implementation.proposalRef}`);
    return mismatches;
  });
  if (bindingMismatches.length) {
    return holdEnvelope({
      projectId: scopedProjectId,
      caseId: scopedCaseId,
      status: HANDOFF_STATUS.HOLD_CANDIDATE_BINDING,
      reasonCodes: bindingMismatches,
      records: { selectedProposalRefs: uniqueSelected, releaseCandidate: candidate },
    });
  }

  const canonicalComparison = normalizeCanonicalOriginalComparison(canonicalOriginalComparison);
  if (canonicalComparison.status === CANONICAL_COMPARISON_STATUS.MISMATCH) {
    return holdEnvelope({
      projectId: scopedProjectId,
      caseId: scopedCaseId,
      status: HANDOFF_STATUS.HOLD_CANDIDATE_BINDING,
      reasonCodes: ['CANONICAL_ORIGINAL_COMPARISON_MISMATCH'],
      records: {
        selectedProposalRefs: uniqueSelected,
        releaseCandidate: candidate,
        canonicalOriginalComparison: canonicalComparison,
      },
    });
  }

  const selectedQualificationDecisions = (engineeringChangeQualification.qualificationDecisions || [])
    .filter((item) => uniqueSelected.includes(item.proposalRef));
  const envelopeCore = {
    schemaVersion: 1,
    projectId: scopedProjectId,
    caseId: scopedCaseId,
    status: HANDOFF_STATUS.READY_FOR_EXISTING_RELEASE_GOVERNANCE_REVIEW,
    reasonCodes: [],
    operatingMode: OPERATING_MODE,
    selectedProposalRefs: uniqueSelected,
    releaseCandidate: candidate,
    implementationBindings: selectedImplementations.map((item) => Object.freeze({
      proposalRef: item.proposalRef,
      commitSha: item.commitSha,
      artifactSha256: item.artifactSha256,
      implementationRef: item.implementationRef,
    })),
    qualificationDecisions: selectedQualificationDecisions,
    canonicalOriginalComparison: canonicalComparison,
    canonicalOriginalComparisonEstablished: canonicalComparison.comparisonEstablished,
    canonicalOriginalComparisonAuthenticityVerified: false,
    externalEvidenceRequired: true,
    downstreamReleaseGovernanceRequired: true,
    downstreamGovernanceTargets: Object.freeze([
      'independent-release-qualification',
      'institutional-go-live-gate',
      'human-go-live-decision',
      'controlled-production-activation',
      'production-deployment-evidence',
    ]),
    authority: authorityBoundary(),
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    transactionAuthorized: false,
    semantics: 'This is an explicit handoff into the existing release/go-live governance machinery. It does not create a parallel release authority, treat skipped canonical comparison as success, authenticate external evidence, or authorize release, merge, deployment or transaction execution.',
  };
  return deepFreeze({
    ...envelopeCore,
    handoffIntegritySha256: integrityHash(envelopeCore),
  });
}

module.exports = {
  HANDOFF_STATUS,
  OPERATING_MODE,
  CANONICAL_COMPARISON_STATUS,
  buildChangeReleaseGovernanceHandoff,
};
