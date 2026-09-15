'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  CHANGE_QUALIFICATION_STATUS,
  CALCULATION_SENSITIVE_KINDS,
  isCalculationSensitiveKind,
} = require('../../src/decision-quality/engineering-change-qualification');
const {
  HANDOFF_STATUS,
  OPERATING_MODE,
  CANONICAL_COMPARISON_STATUS,
  buildChangeReleaseGovernanceHandoff,
} = require('../../src/decision-quality/change-release-governance-handoff');

const projectId = 'PROJECT-HANDOFF-001';
const caseId = 'CASE-HANDOFF-001';
const proposalRef = 'CHANGE-PROP-HANDOFF-001';
const commitSha = 'a'.repeat(40);
const artifactSha256 = 'b'.repeat(64);

assert(Array.isArray(CALCULATION_SENSITIVE_KINDS));
assert(Object.isFrozen(CALCULATION_SENSITIVE_KINDS));
assert.strictEqual(typeof CALCULATION_SENSITIVE_KINDS.add, 'undefined');
assert.strictEqual(isCalculationSensitiveKind('MODEL_LOGIC'), true);
assert.strictEqual(isCalculationSensitiveKind('DOCUMENTATION'), false);
assert.throws(() => CALCULATION_SENSITIVE_KINDS.push('MUTATED_KIND'), TypeError);
assert.strictEqual(CALCULATION_SENSITIVE_KINDS.includes('MUTATED_KIND'), false);

const qualifiedPackage = Object.freeze({
  schemaVersion: 1,
  projectId,
  caseId,
  status: CHANGE_QUALIFICATION_STATUS.QUALIFIED_FOR_RELEASE_REVIEW_ONLY,
  qualifiedForReleaseReviewProposalRefs: Object.freeze([proposalRef]),
  implementationEvidence: Object.freeze([
    Object.freeze({
      proposalRef,
      implementationRef: 'IMPLEMENTATION-HANDOFF-001',
      commitSha,
      artifactSha256,
      implementedBy: 'ENGINEER-001',
      productionApplied: false,
    }),
  ]),
  qualificationDecisions: Object.freeze([
    Object.freeze({
      proposalRef,
      decision: 'QUALIFY_FOR_RELEASE_REVIEW',
      qualifierRef: 'QUALIFIER-001',
      humanDecisionConfirmed: true,
      releaseAuthorized: false,
      mergeAuthorized: false,
      deploymentAuthorized: false,
    }),
  ]),
  releaseAuthorized: false,
  mergeAuthorized: false,
  deploymentAuthorized: false,
  transactionAuthorized: false,
});

const candidate = Object.freeze({
  candidateId: 'RC-HANDOFF-001',
  candidateRef: 'RELEASE-CANDIDATE-HANDOFF-001',
  commitSha,
  artifactSha256,
  operatingMode: OPERATING_MODE,
});

let result = buildChangeReleaseGovernanceHandoff({
  projectId,
  caseId,
  engineeringChangeQualification: { ...qualifiedPackage, status: CHANGE_QUALIFICATION_STATUS.HOLD_HUMAN_QUALIFICATION },
  selectedProposalRefs: [proposalRef],
  releaseCandidate: candidate,
});
assert.strictEqual(result.status, HANDOFF_STATUS.HOLD_CHANGE_QUALIFICATION);
assert.strictEqual(result.releaseAuthorized, false);

result = buildChangeReleaseGovernanceHandoff({
  projectId,
  caseId,
  engineeringChangeQualification: qualifiedPackage,
  selectedProposalRefs: [],
  releaseCandidate: candidate,
});
assert.strictEqual(result.status, HANDOFF_STATUS.HOLD_EXPLICIT_SELECTION);
assert(result.reasonCodes.includes('EXPLICIT_CHANGE_PROPOSAL_SELECTION_REQUIRED'));

result = buildChangeReleaseGovernanceHandoff({
  projectId,
  caseId,
  engineeringChangeQualification: qualifiedPackage,
  selectedProposalRefs: ['UNQUALIFIED-PROPOSAL'],
  releaseCandidate: candidate,
});
assert.strictEqual(result.status, HANDOFF_STATUS.HOLD_UNQUALIFIED_SELECTION);
assert(result.reasonCodes.includes('SELECTED_PROPOSAL_NOT_QUALIFIED:UNQUALIFIED-PROPOSAL'));

assert.throws(() => buildChangeReleaseGovernanceHandoff({
  projectId,
  caseId,
  engineeringChangeQualification: qualifiedPackage,
  selectedProposalRefs: [proposalRef, proposalRef],
  releaseCandidate: candidate,
}), /DUPLICATE_SELECTED_CHANGE_PROPOSAL_REF/);

result = buildChangeReleaseGovernanceHandoff({
  projectId,
  caseId,
  engineeringChangeQualification: qualifiedPackage,
  selectedProposalRefs: [proposalRef],
  releaseCandidate: { ...candidate, commitSha: 'bad-sha' },
});
assert.strictEqual(result.status, HANDOFF_STATUS.HOLD_RELEASE_CANDIDATE);

result = buildChangeReleaseGovernanceHandoff({
  projectId,
  caseId,
  engineeringChangeQualification: qualifiedPackage,
  selectedProposalRefs: [proposalRef],
  releaseCandidate: { ...candidate, operatingMode: 'CERTIFIED_VALUATION' },
});
assert.strictEqual(result.status, HANDOFF_STATUS.HOLD_OPERATING_MODE);
assert(result.reasonCodes.includes(`OPERATING_MODE_MUST_REMAIN:${OPERATING_MODE}`));

result = buildChangeReleaseGovernanceHandoff({
  projectId,
  caseId,
  engineeringChangeQualification: qualifiedPackage,
  selectedProposalRefs: [proposalRef],
  releaseCandidate: { ...candidate, commitSha: 'c'.repeat(40) },
});
assert.strictEqual(result.status, HANDOFF_STATUS.HOLD_CANDIDATE_BINDING);
assert(result.reasonCodes.includes(`CANDIDATE_COMMIT_MISMATCH:${proposalRef}`));

result = buildChangeReleaseGovernanceHandoff({
  projectId,
  caseId,
  engineeringChangeQualification: qualifiedPackage,
  selectedProposalRefs: [proposalRef],
  releaseCandidate: { ...candidate, artifactSha256: 'd'.repeat(64) },
});
assert.strictEqual(result.status, HANDOFF_STATUS.HOLD_CANDIDATE_BINDING);
assert(result.reasonCodes.includes(`CANDIDATE_ARTIFACT_MISMATCH:${proposalRef}`));

result = buildChangeReleaseGovernanceHandoff({
  projectId,
  caseId,
  engineeringChangeQualification: qualifiedPackage,
  selectedProposalRefs: [proposalRef],
  releaseCandidate: candidate,
  canonicalOriginalComparison: {
    status: CANONICAL_COMPARISON_STATUS.MISMATCH,
    expectedSha256: '1'.repeat(64),
    observedSha256: '2'.repeat(64),
    evidenceRef: 'CANONICAL-COMPARE-001',
  },
});
assert.strictEqual(result.status, HANDOFF_STATUS.HOLD_CANDIDATE_BINDING);
assert(result.reasonCodes.includes('CANONICAL_ORIGINAL_COMPARISON_MISMATCH'));

assert.throws(() => buildChangeReleaseGovernanceHandoff({
  projectId,
  caseId,
  engineeringChangeQualification: qualifiedPackage,
  selectedProposalRefs: [proposalRef],
  releaseCandidate: candidate,
  canonicalOriginalComparison: {
    status: CANONICAL_COMPARISON_STATUS.MATCH,
    expectedSha256: '1'.repeat(64),
    observedSha256: '2'.repeat(64),
    evidenceRef: 'INVALID-MATCH',
  },
}), /CANONICAL_COMPARISON_MATCH_HASH_MISMATCH/);

result = buildChangeReleaseGovernanceHandoff({
  projectId,
  caseId,
  engineeringChangeQualification: qualifiedPackage,
  selectedProposalRefs: [proposalRef],
  releaseCandidate: candidate,
  canonicalOriginalComparison: {
    status: CANONICAL_COMPARISON_STATUS.SKIPPED,
  },
});
assert.strictEqual(result.status, HANDOFF_STATUS.READY_FOR_EXISTING_RELEASE_GOVERNANCE_REVIEW);
assert.strictEqual(result.canonicalOriginalComparison.status, CANONICAL_COMPARISON_STATUS.SKIPPED);
assert.strictEqual(result.canonicalOriginalComparisonEstablished, false);
assert.strictEqual(result.canonicalOriginalComparisonAuthenticityVerified, false);
assert.strictEqual(result.externalEvidenceRequired, true);
assert.strictEqual(result.downstreamReleaseGovernanceRequired, true);
assert(result.downstreamGovernanceTargets.includes('independent-release-qualification'));
assert(result.downstreamGovernanceTargets.includes('institutional-go-live-gate'));
assert.strictEqual(result.operatingMode, OPERATING_MODE);
assert.strictEqual(result.releaseAuthorized, false);
assert.strictEqual(result.mergeAuthorized, false);
assert.strictEqual(result.deploymentAuthorized, false);
assert.strictEqual(result.transactionAuthorized, false);
assert.strictEqual(result.authority.formalStandardsConformanceEstablished, false);
assert.strictEqual(result.authority.saudiProfessionalLicensingEstablished, false);
assert.strictEqual(result.authority.pdplComplianceEstablished, false);
assert.strictEqual(result.authority.certifiedValuationAuthorityEstablished, false);
assert.strictEqual(result.authority.externalEvidenceAuthenticityVerified, false);
assert(/^[a-f0-9]{64}$/.test(result.handoffIntegritySha256));
assert(Object.isFrozen(result));
assert(Object.isFrozen(result.releaseCandidate));

const noComparison = buildChangeReleaseGovernanceHandoff({
  projectId,
  caseId,
  engineeringChangeQualification: qualifiedPackage,
  selectedProposalRefs: [proposalRef],
  releaseCandidate: candidate,
});
assert.strictEqual(noComparison.status, HANDOFF_STATUS.READY_FOR_EXISTING_RELEASE_GOVERNANCE_REVIEW);
assert.strictEqual(noComparison.canonicalOriginalComparison.status, CANONICAL_COMPARISON_STATUS.NOT_PROVIDED);
assert.strictEqual(noComparison.canonicalOriginalComparisonEstablished, false);
assert.strictEqual(noComparison.releaseAuthorized, false);

assert.throws(() => buildChangeReleaseGovernanceHandoff({
  projectId: 'OTHER-PROJECT',
  caseId,
  engineeringChangeQualification: qualifiedPackage,
  selectedProposalRefs: [proposalRef],
  releaseCandidate: candidate,
}), /CHANGE_RELEASE_HANDOFF_SCOPE_MISMATCH/);

const source = fs.readFileSync(path.join(__dirname, '../../src/decision-quality/change-release-governance-handoff.js'), 'utf8');
assert(source.includes('READY_FOR_EXISTING_RELEASE_GOVERNANCE_REVIEW'));
assert(source.includes('independent-release-qualification'));
assert(source.includes('institutional-go-live-gate'));
assert(source.includes('UNLICENSED_DECISION_SUPPORT'));
assert(!source.includes('window.'));

console.log('CHANGE_RELEASE_GOVERNANCE_HANDOFF=PASS');
