'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  LEARNING_DISPOSITION,
  CHANGE_KIND,
  CHANGE_APPROVAL_DECISION,
  RISK_LEVEL,
  buildLearningChangeControlRegistry,
} = require('../../src/decision-quality/learning-change-control');
const {
  CHANGE_QUALIFICATION_STATUS,
  QUALIFICATION_DECISION,
  INDEPENDENT_REVIEW_DECISION,
  buildEngineeringChangeQualificationGate,
} = require('../../src/decision-quality/engineering-change-qualification');

const projectId = 'PROJECT-CHANGE-QUAL-001';
const caseId = 'CASE-CHANGE-QUAL-001';
const proposalRef = 'CHANGE-PROP-QUAL-001';
const commitSha = 'a'.repeat(40);
const artifactSha = 'b'.repeat(64);
const baselineSha = 'c'.repeat(64);
const candidateCalcSha = 'd'.repeat(64);
const regressionSha = 'e'.repeat(64);
const rollbackSha = 'f'.repeat(64);
const reviewSha = '1'.repeat(64);

const learningReview = Object.freeze({
  schemaVersion: 1,
  projectId,
  caseId,
  status: 'READY_FOR_LEARNING_REVIEW',
  learningCandidateCount: 1,
  learningCandidates: Object.freeze([
    Object.freeze({
      id: 'NOI-UNDERWRITING-VARIANCE',
      label: 'NOI underwriting variance',
      plannedValue: 100,
      actualValue: 90,
      materialVariance: true,
      evidenceRef: 'OUTCOME-EVIDENCE-QUAL-001',
      requiresHumanInterpretation: true,
    }),
  ]),
  mayUpdatePolicyAutomatically: false,
  mayUpdateModelAutomatically: false,
  mayRewritePriorDecision: false,
  transactionAuthorized: false,
});

const disposition = Object.freeze({
  candidateId: 'NOI-UNDERWRITING-VARIANCE',
  disposition: LEARNING_DISPOSITION.ACCEPT_AS_CHANGE_CANDIDATE,
  reviewerRef: 'LEARNING-REVIEWER-001',
  decidedAt: '2026-09-08T19:30:00Z',
  rationale: 'Verified recurring variance merits controlled engineering investigation.',
  humanDecisionConfirmed: true,
  proposalRef,
  changeKind: CHANGE_KIND.MODEL_LOGIC,
  targetRef: 'MODEL:NOI-UNDERWRITING',
  changeSummary: 'Adjust NOI underwriting logic only through governed implementation evidence.',
});

const impactAssessment = Object.freeze({
  assessedBy: 'CHANGE-RISK-001',
  assessedAt: '2026-09-08T19:35:00Z',
  impactSummary: 'Potential calculation impact on acquisition outputs and IC metrics.',
  riskLevel: RISK_LEVEL.HIGH,
  affectedDomains: ['FINANCE', 'VALUATION', 'DECISION_QUALITY'],
  testPlanRef: 'TEST-PLAN-QUAL-001',
  rollbackPlanRef: 'ROLLBACK-PLAN-QUAL-001',
  independentReviewRequired: true,
});

const changeApproval = Object.freeze({
  decision: CHANGE_APPROVAL_DECISION.APPROVE_FOR_ENGINEERING,
  approverRef: 'CHANGE-AUTHORITY-001',
  decidedAt: '2026-09-08T19:40:00Z',
  rationale: 'Engineering work only; no production authority.',
  humanDecisionConfirmed: true,
});

const changeControlRegistry = buildLearningChangeControlRegistry({
  projectId,
  caseId,
  learningReview,
  humanDispositions: [disposition],
  impactAssessmentsByProposalRef: { [proposalRef]: impactAssessment },
  changeApprovalsByProposalRef: { [proposalRef]: changeApproval },
});

assert.strictEqual(changeControlRegistry.status, 'READY_FOR_ENGINEERING_PROPOSAL');
assert.strictEqual(changeControlRegistry.engineeringProposalCount, 1);
assert.strictEqual(changeControlRegistry.authority.implementationAuthorized, false);

let result = buildEngineeringChangeQualificationGate({
  projectId,
  caseId,
  changeControlRegistry,
});
assert.strictEqual(result.status, CHANGE_QUALIFICATION_STATUS.HOLD_IMPLEMENTATION_EVIDENCE);
assert(result.reasonCodes.includes(`MISSING_IMPLEMENTATION_EVIDENCE:${proposalRef}`));
assert.strictEqual(result.authority.productionChangeAuthorized, false);

const implementationEvidence = Object.freeze({
  implementationRef: 'PR-IMPLEMENTATION-001',
  commitSha,
  artifactSha256: artifactSha,
  implementedBy: 'ENGINEER-001',
  implementedAt: '2026-09-08T20:00:00Z',
  scopeSummary: 'Scoped implementation for approved NOI underwriting proposal.',
  changedPaths: ['src/engines/noi-underwriting.js', 'tests/finance/noi-underwriting.test.js'],
  implementationComplete: true,
  productionApplied: false,
});

result = buildEngineeringChangeQualificationGate({
  projectId,
  caseId,
  changeControlRegistry,
  implementationEvidenceByProposalRef: { [proposalRef]: implementationEvidence },
});
assert.strictEqual(result.status, CHANGE_QUALIFICATION_STATUS.HOLD_CALCULATION_EVIDENCE);
assert(result.reasonCodes.includes(`MISSING_BEFORE_AFTER_CALCULATION_EVIDENCE:${proposalRef}`));

const calculationEvidence = Object.freeze({
  baselineRef: 'BASELINE-RC-001',
  baselineArtifactSha256: baselineSha,
  candidateRef: 'CANDIDATE-RC-001',
  candidateArtifactSha256: candidateCalcSha,
  comparisonRef: 'CALCULATION-DIFF-001',
  comparedBy: 'CALCULATION-REVIEWER-001',
  comparedAt: '2026-09-08T20:10:00Z',
  goldenCaseRefs: ['RE-GOLD-001', 'RE-GOLD-002'],
  result: 'NO_UNEXPLAINED_VARIANCE',
  unexplainedVarianceCount: 0,
});

result = buildEngineeringChangeQualificationGate({
  projectId,
  caseId,
  changeControlRegistry,
  implementationEvidenceByProposalRef: { [proposalRef]: implementationEvidence },
  calculationEvidenceByProposalRef: { [proposalRef]: calculationEvidence },
});
assert.strictEqual(result.status, CHANGE_QUALIFICATION_STATUS.HOLD_REGRESSION_EVIDENCE);

assert.throws(() => buildEngineeringChangeQualificationGate({
  projectId,
  caseId,
  changeControlRegistry,
  implementationEvidenceByProposalRef: { [proposalRef]: implementationEvidence },
  calculationEvidenceByProposalRef: { [proposalRef]: { ...calculationEvidence, unexplainedVarianceCount: 1 } },
}), /UNEXPLAINED_CALCULATION_VARIANCE/);

assert.throws(() => buildEngineeringChangeQualificationGate({
  projectId,
  caseId,
  changeControlRegistry,
  implementationEvidenceByProposalRef: { [proposalRef]: implementationEvidence },
  calculationEvidenceByProposalRef: { [proposalRef]: { ...calculationEvidence, result: 'EXPLAINED_EXPECTED_VARIANCE' } },
}), /EXPECTED_VARIANCE_APPROVAL_REF_REQUIRED/);

const regressionEvidence = Object.freeze({
  workflowRunRef: 'RELEASE-VERIFY-CHANGE-001',
  testSuiteRef: 'CANONICAL-REGRESSION-CHANGE-001',
  evidenceSha256: regressionSha,
  completedAt: '2026-09-08T20:20:00Z',
  total: 316,
  passed: 316,
  failed: 0,
  result: 'PASS',
});

result = buildEngineeringChangeQualificationGate({
  projectId,
  caseId,
  changeControlRegistry,
  implementationEvidenceByProposalRef: { [proposalRef]: implementationEvidence },
  calculationEvidenceByProposalRef: { [proposalRef]: calculationEvidence },
  regressionEvidenceByProposalRef: { [proposalRef]: regressionEvidence },
});
assert.strictEqual(result.status, CHANGE_QUALIFICATION_STATUS.HOLD_ROLLBACK_EVIDENCE);

assert.throws(() => buildEngineeringChangeQualificationGate({
  projectId,
  caseId,
  changeControlRegistry,
  implementationEvidenceByProposalRef: { [proposalRef]: implementationEvidence },
  calculationEvidenceByProposalRef: { [proposalRef]: calculationEvidence },
  regressionEvidenceByProposalRef: { [proposalRef]: { ...regressionEvidence, failed: 1, passed: 315, result: 'FAIL' } },
}), /REGRESSION_NOT_PASSING/);

const rollbackEvidence = Object.freeze({
  rollbackPlanRef: 'ROLLBACK-PLAN-QUAL-001',
  rollbackProcedureRef: 'ROLLBACK-PROCEDURE-QUAL-001',
  evidenceSha256: rollbackSha,
  verifiedBy: 'ROLLBACK-REVIEWER-001',
  verifiedAt: '2026-09-08T20:25:00Z',
  drillResult: 'PASS',
  productionRollbackExecuted: false,
});

result = buildEngineeringChangeQualificationGate({
  projectId,
  caseId,
  changeControlRegistry,
  implementationEvidenceByProposalRef: { [proposalRef]: implementationEvidence },
  calculationEvidenceByProposalRef: { [proposalRef]: calculationEvidence },
  regressionEvidenceByProposalRef: { [proposalRef]: regressionEvidence },
  rollbackEvidenceByProposalRef: { [proposalRef]: rollbackEvidence },
});
assert.strictEqual(result.status, CHANGE_QUALIFICATION_STATUS.HOLD_INDEPENDENT_REVIEW);

assert.throws(() => buildEngineeringChangeQualificationGate({
  projectId,
  caseId,
  changeControlRegistry,
  implementationEvidenceByProposalRef: { [proposalRef]: implementationEvidence },
  calculationEvidenceByProposalRef: { [proposalRef]: calculationEvidence },
  regressionEvidenceByProposalRef: { [proposalRef]: regressionEvidence },
  rollbackEvidenceByProposalRef: { [proposalRef]: { ...rollbackEvidence, rollbackPlanRef: 'WRONG-PLAN' } },
}), /ROLLBACK_PLAN_REF_MISMATCH/);

const independentReview = Object.freeze({
  reviewerRef: 'INDEPENDENT-ENGINEERING-REVIEWER-001',
  reviewRef: 'INDEPENDENT-REVIEW-001',
  reviewedAt: '2026-09-08T20:30:00Z',
  evidenceSha256: reviewSha,
  decision: INDEPENDENT_REVIEW_DECISION.APPROVE_WITH_CONDITIONS,
  conditions: ['Preserve backward compatibility and monitor post-release metrics.'],
  independenceConfirmed: true,
});

assert.throws(() => buildEngineeringChangeQualificationGate({
  projectId,
  caseId,
  changeControlRegistry,
  implementationEvidenceByProposalRef: { [proposalRef]: implementationEvidence },
  calculationEvidenceByProposalRef: { [proposalRef]: calculationEvidence },
  regressionEvidenceByProposalRef: { [proposalRef]: regressionEvidence },
  rollbackEvidenceByProposalRef: { [proposalRef]: rollbackEvidence },
  independentReviewByProposalRef: { [proposalRef]: { ...independentReview, reviewerRef: 'ENGINEER-001' } },
}), /INDEPENDENT_REVIEWER_CONFLICT/);

result = buildEngineeringChangeQualificationGate({
  projectId,
  caseId,
  changeControlRegistry,
  implementationEvidenceByProposalRef: { [proposalRef]: implementationEvidence },
  calculationEvidenceByProposalRef: { [proposalRef]: calculationEvidence },
  regressionEvidenceByProposalRef: { [proposalRef]: regressionEvidence },
  rollbackEvidenceByProposalRef: { [proposalRef]: rollbackEvidence },
  independentReviewByProposalRef: { [proposalRef]: independentReview },
});
assert.strictEqual(result.status, CHANGE_QUALIFICATION_STATUS.HOLD_HUMAN_QUALIFICATION);
assert.strictEqual(result.independentReviews[0].authenticityExternallyVerified, false);

const qualificationDecision = Object.freeze({
  decision: QUALIFICATION_DECISION.QUALIFY_FOR_RELEASE_REVIEW,
  qualifierRef: 'CHANGE-QUALIFIER-001',
  decidedAt: '2026-09-08T20:35:00Z',
  rationale: 'Evidence package is structurally complete for downstream release review only.',
  humanDecisionConfirmed: true,
});

assert.throws(() => buildEngineeringChangeQualificationGate({
  projectId,
  caseId,
  changeControlRegistry,
  implementationEvidenceByProposalRef: { [proposalRef]: implementationEvidence },
  calculationEvidenceByProposalRef: { [proposalRef]: calculationEvidence },
  regressionEvidenceByProposalRef: { [proposalRef]: regressionEvidence },
  rollbackEvidenceByProposalRef: { [proposalRef]: rollbackEvidence },
  independentReviewByProposalRef: { [proposalRef]: independentReview },
  qualificationDecisionByProposalRef: { [proposalRef]: { ...qualificationDecision, qualifierRef: independentReview.reviewerRef } },
}), /QUALIFIER_REVIEWER_SEPARATION_REQUIRED/);

result = buildEngineeringChangeQualificationGate({
  projectId,
  caseId,
  changeControlRegistry,
  implementationEvidenceByProposalRef: { [proposalRef]: implementationEvidence },
  calculationEvidenceByProposalRef: { [proposalRef]: calculationEvidence },
  regressionEvidenceByProposalRef: { [proposalRef]: regressionEvidence },
  rollbackEvidenceByProposalRef: { [proposalRef]: rollbackEvidence },
  independentReviewByProposalRef: { [proposalRef]: independentReview },
  qualificationDecisionByProposalRef: { [proposalRef]: qualificationDecision },
});
assert.strictEqual(result.status, CHANGE_QUALIFICATION_STATUS.QUALIFIED_FOR_RELEASE_REVIEW_ONLY);
assert.strictEqual(result.qualifiedForReleaseReviewCount, 1);
assert.deepStrictEqual(result.qualifiedForReleaseReviewProposalRefs, [proposalRef]);
assert.strictEqual(result.independentReviewEvidenceAuthenticityNotEstablishedByThisLayer, true);
assert.strictEqual(result.authority.engineeringImplementationQualified, false);
assert.strictEqual(result.authority.productionChangeAuthorized, false);
assert.strictEqual(result.authority.standardsActivationAuthorized, false);
assert.strictEqual(result.authority.releaseAuthorized, false);
assert.strictEqual(result.authority.mergeAuthorized, false);
assert.strictEqual(result.authority.deploymentAuthorized, false);
assert.strictEqual(result.authority.transactionAuthorized, false);
assert.strictEqual(result.releaseAuthorized, false);
assert.strictEqual(result.mergeAuthorized, false);
assert.strictEqual(result.deploymentAuthorized, false);
assert.strictEqual(result.transactionAuthorized, false);
assert(Object.isFrozen(result));
assert(Object.isFrozen(result.qualificationDecisions));

assert.throws(() => buildEngineeringChangeQualificationGate({
  projectId: 'OTHER-PROJECT',
  caseId,
  changeControlRegistry,
}), /ENGINEERING_CHANGE_REGISTRY_SCOPE_MISMATCH/);

assert.throws(() => buildEngineeringChangeQualificationGate({
  projectId,
  caseId,
  changeControlRegistry,
  implementationEvidenceByProposalRef: { [proposalRef]: { ...implementationEvidence, commitSha: 'bad-sha' } },
}), /40-character commit SHA/);

const qualificationPanelSource = fs.readFileSync(path.join(__dirname, '../../src/components/EngineeringChangeQualificationPanel.jsx'), 'utf8');
const learningPanelSource = fs.readFileSync(path.join(__dirname, '../../src/components/LearningChangeControlPanel.jsx'), 'utf8');
assert(qualificationPanelSource.includes('buildEngineeringChangeQualificationGate'));
assert(qualificationPanelSource.includes('QUALIFIED_FOR_RELEASE_REVIEW_ONLY'));
assert(qualificationPanelSource.includes('أصالة المراجعة المستقلة الخارجية ليست مثبتة'));
assert(!qualificationPanelSource.includes('window.'));
assert(learningPanelSource.includes('EngineeringChangeQualificationPanel'));
assert(learningPanelSource.includes('implementationEvidenceByProposalRef'));

console.log('ENGINEERING_CHANGE_QUALIFICATION_GATE=PASS');
