'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  LEARNING_CHANGE_CONTROL_STATUS,
  LEARNING_DISPOSITION,
  CHANGE_KIND,
  CHANGE_APPROVAL_DECISION,
  RISK_LEVEL,
  buildLearningChangeControlRegistry,
} = require('../../src/decision-quality/learning-change-control');

const projectId = 'PROJECT-LEARN-001';
const caseId = 'CASE-LEARN-001';
const learningReview = Object.freeze({
  schemaVersion: 1,
  projectId,
  caseId,
  status: 'READY_FOR_LEARNING_REVIEW',
  learningCandidateCount: 2,
  learningCandidates: Object.freeze([
    Object.freeze({
      id: 'NOI-VARIANCE',
      label: 'NOI variance',
      plannedValue: 100,
      actualValue: 88,
      materialVariance: true,
      evidenceRef: 'OUTCOME-EVIDENCE-001',
      requiresHumanInterpretation: true,
    }),
    Object.freeze({
      id: 'EXIT-CAP-VARIANCE',
      label: 'Exit cap variance',
      plannedValue: 0.07,
      actualValue: 0.075,
      materialVariance: true,
      evidenceRef: 'OUTCOME-EVIDENCE-001',
      requiresHumanInterpretation: true,
    }),
  ]),
  mayUpdatePolicyAutomatically: false,
  mayUpdateModelAutomatically: false,
  mayRewritePriorDecision: false,
  transactionAuthorized: false,
});

const acceptedNoi = Object.freeze({
  candidateId: 'NOI-VARIANCE',
  disposition: LEARNING_DISPOSITION.ACCEPT_AS_CHANGE_CANDIDATE,
  reviewerRef: 'HUMAN-REVIEWER-001',
  decidedAt: '2026-09-08T19:20:00Z',
  rationale: 'Material repeated underwriting variance requires controlled model review.',
  humanDecisionConfirmed: true,
  proposalRef: 'CHANGE-PROP-001',
  changeKind: CHANGE_KIND.MODEL_LOGIC,
  targetRef: 'MODEL:NOI-UNDERWRITING',
  changeSummary: 'Review NOI underwriting logic using verified outcome evidence.',
});

const deferredExitCap = Object.freeze({
  candidateId: 'EXIT-CAP-VARIANCE',
  disposition: LEARNING_DISPOSITION.DEFER,
  reviewerRef: 'HUMAN-REVIEWER-001',
  decidedAt: '2026-09-08T19:21:00Z',
  rationale: 'Insufficient longitudinal evidence for a change proposal.',
  humanDecisionConfirmed: true,
});

let result = buildLearningChangeControlRegistry({
  projectId,
  caseId,
  learningReview: { ...learningReview, status: 'HOLD_OUTCOME_FEEDBACK' },
});
assert.strictEqual(result.status, LEARNING_CHANGE_CONTROL_STATUS.HOLD_LEARNING_REVIEW);
assert.strictEqual(result.authority.productionChangeAuthorized, false);
assert.strictEqual(result.transactionAuthorized, false);

result = buildLearningChangeControlRegistry({
  projectId,
  caseId,
  learningReview,
});
assert.strictEqual(result.status, LEARNING_CHANGE_CONTROL_STATUS.WAITING_FOR_HUMAN_DISPOSITIONS);
assert.strictEqual(result.reasonCodes.length, 2);

result = buildLearningChangeControlRegistry({
  projectId,
  caseId,
  learningReview,
  humanDispositions: [acceptedNoi],
});
assert.strictEqual(result.status, LEARNING_CHANGE_CONTROL_STATUS.WAITING_FOR_HUMAN_DISPOSITIONS);
assert(result.reasonCodes.includes('MISSING_HUMAN_DISPOSITION:EXIT-CAP-VARIANCE'));

result = buildLearningChangeControlRegistry({
  projectId,
  caseId,
  learningReview,
  humanDispositions: [
    { ...acceptedNoi, disposition: LEARNING_DISPOSITION.REJECT, proposalRef: undefined, changeKind: undefined, targetRef: undefined, changeSummary: undefined },
    deferredExitCap,
  ],
});
assert.strictEqual(result.status, LEARNING_CHANGE_CONTROL_STATUS.NO_CHANGE_PROPOSALS);
assert.strictEqual(result.proposals.length, 0);
assert.strictEqual(result.authority.automatedModelUpdateAuthorized, false);

result = buildLearningChangeControlRegistry({
  projectId,
  caseId,
  learningReview,
  humanDispositions: [acceptedNoi, deferredExitCap],
});
assert.strictEqual(result.status, LEARNING_CHANGE_CONTROL_STATUS.HOLD_IMPACT_ASSESSMENT);
assert.strictEqual(result.proposals.length, 1);
assert.strictEqual(result.proposals[0].proposalStatus, 'PENDING_IMPACT_ASSESSMENT');
assert.strictEqual(result.proposals[0].requiresSeparateImplementationPR, true);
assert.strictEqual(result.proposals[0].modelPolicyGovernanceRequired, true);
assert.strictEqual(result.proposals[0].productionActivationAuthorized, false);

const impactAssessment = Object.freeze({
  assessedBy: 'CHANGE-RISK-REVIEWER-001',
  assessedAt: '2026-09-08T19:30:00Z',
  impactSummary: 'Potential effect on underwriting outputs and decision thresholds.',
  riskLevel: RISK_LEVEL.HIGH,
  affectedDomains: ['FINANCE', 'DECISION_QUALITY'],
  testPlanRef: 'TEST-PLAN-CHANGE-001',
  rollbackPlanRef: 'ROLLBACK-PLAN-CHANGE-001',
  independentReviewRequired: true,
});

result = buildLearningChangeControlRegistry({
  projectId,
  caseId,
  learningReview,
  humanDispositions: [acceptedNoi, deferredExitCap],
  impactAssessmentsByProposalRef: { 'CHANGE-PROP-001': impactAssessment },
});
assert.strictEqual(result.status, LEARNING_CHANGE_CONTROL_STATUS.HOLD_CHANGE_APPROVAL);
assert.strictEqual(result.impactAssessments.length, 1);
assert.strictEqual(result.authority.implementationAuthorized, false);

const approval = Object.freeze({
  decision: CHANGE_APPROVAL_DECISION.APPROVE_FOR_ENGINEERING,
  approverRef: 'HUMAN-CHANGE-AUTHORITY-001',
  decidedAt: '2026-09-08T19:40:00Z',
  rationale: 'Authorize engineering proposal and regression work only.',
  humanDecisionConfirmed: true,
});

result = buildLearningChangeControlRegistry({
  projectId,
  caseId,
  learningReview,
  humanDispositions: [acceptedNoi, deferredExitCap],
  impactAssessmentsByProposalRef: { 'CHANGE-PROP-001': impactAssessment },
  changeApprovalsByProposalRef: { 'CHANGE-PROP-001': approval },
});
assert.strictEqual(result.status, LEARNING_CHANGE_CONTROL_STATUS.READY_FOR_ENGINEERING_PROPOSAL);
assert.strictEqual(result.engineeringProposalCount, 1);
assert.strictEqual(result.engineeringProposals[0].proposalStatus, 'APPROVED_FOR_ENGINEERING_PROPOSAL_ONLY');
assert.strictEqual(result.engineeringProposals[0].implementationAuthorized, false);
assert.strictEqual(result.engineeringProposals[0].mergeAuthorized, false);
assert.strictEqual(result.engineeringProposals[0].deploymentAuthorized, false);
assert.strictEqual(result.engineeringProposals[0].productionActivationAuthorized, false);
assert.strictEqual(result.authority.automatedPolicyUpdateAuthorized, false);
assert.strictEqual(result.authority.automatedModelUpdateAuthorized, false);
assert.strictEqual(result.authority.automatedRuleActivationAuthorized, false);
assert.strictEqual(result.authority.standardsActivationAuthorized, false);
assert.strictEqual(result.authority.productionChangeAuthorized, false);
assert.strictEqual(result.authority.implementationAuthorized, false);
assert.strictEqual(result.authority.releaseAuthorized, false);
assert.strictEqual(result.authority.mergeAuthorized, false);
assert.strictEqual(result.authority.deploymentAuthorized, false);
assert.strictEqual(result.authority.transactionAuthorized, false);
assert.strictEqual(result.implementationRequiresSeparateChange, true);
assert.strictEqual(result.productionActivationRequiresIndependentReleaseGate, true);
assert(Object.isFrozen(result));
assert(Object.isFrozen(result.engineeringProposals));

const standardsDisposition = Object.freeze({
  ...acceptedNoi,
  proposalRef: 'CHANGE-PROP-STANDARD-001',
  changeKind: CHANGE_KIND.STANDARD_OR_RULE,
  targetRef: 'STANDARD-REGISTRY:IVS',
  changeSummary: 'Propose standards registry lifecycle review only.',
});
result = buildLearningChangeControlRegistry({
  projectId,
  caseId,
  learningReview: { ...learningReview, learningCandidateCount: 1, learningCandidates: [learningReview.learningCandidates[0]] },
  humanDispositions: [standardsDisposition],
});
assert.strictEqual(result.status, LEARNING_CHANGE_CONTROL_STATUS.HOLD_IMPACT_ASSESSMENT);
assert.strictEqual(result.proposals[0].standardsLifecycleGovernanceRequired, true);
assert.strictEqual(result.proposals[0].productionActivationAuthorized, false);

assert.throws(() => buildLearningChangeControlRegistry({
  projectId,
  caseId,
  learningReview,
  humanDispositions: [{ ...acceptedNoi, candidateId: 'UNKNOWN-CANDIDATE' }, deferredExitCap],
}), /UNKNOWN_LEARNING_CANDIDATE/);

assert.throws(() => buildLearningChangeControlRegistry({
  projectId,
  caseId,
  learningReview,
  humanDispositions: [acceptedNoi, acceptedNoi, deferredExitCap],
}), /DUPLICATE_LEARNING_DISPOSITION/);

assert.throws(() => buildLearningChangeControlRegistry({
  projectId,
  caseId,
  learningReview,
  humanDispositions: [{ ...acceptedNoi, humanDecisionConfirmed: false }, deferredExitCap],
}), /HUMAN_LEARNING_DISPOSITION_CONFIRMATION_REQUIRED/);

assert.throws(() => buildLearningChangeControlRegistry({
  projectId: 'OTHER-PROJECT',
  caseId,
  learningReview,
}), /LEARNING_CHANGE_CONTROL_SCOPE_MISMATCH/);

assert.throws(() => buildLearningChangeControlRegistry({
  projectId,
  caseId,
  learningReview,
  humanDispositions: [acceptedNoi, { ...deferredExitCap, disposition: LEARNING_DISPOSITION.ACCEPT_AS_CHANGE_CANDIDATE, proposalRef: 'CHANGE-PROP-001', changeKind: CHANGE_KIND.DOCUMENTATION, targetRef: 'DOC:GUIDE', changeSummary: 'Duplicate proposal ref' }],
}), /DUPLICATE_CHANGE_PROPOSAL_REF/);

assert.throws(() => buildLearningChangeControlRegistry({
  projectId,
  caseId,
  learningReview,
  humanDispositions: [acceptedNoi, deferredExitCap],
  impactAssessmentsByProposalRef: { 'CHANGE-PROP-001': { ...impactAssessment, riskLevel: 'UNBOUNDED' } },
}), /invalid risk level/);

assert.throws(() => buildLearningChangeControlRegistry({
  projectId,
  caseId,
  learningReview,
  humanDispositions: [acceptedNoi, deferredExitCap],
  impactAssessmentsByProposalRef: { 'CHANGE-PROP-001': impactAssessment },
  changeApprovalsByProposalRef: { 'CHANGE-PROP-001': { ...approval, humanDecisionConfirmed: false } },
}), /HUMAN_CHANGE_APPROVAL_CONFIRMATION_REQUIRED/);

const panelSource = fs.readFileSync(path.join(__dirname, '../../src/components/LearningChangeControlPanel.jsx'), 'utf8');
const postDecisionPanelSource = fs.readFileSync(path.join(__dirname, '../../src/components/PostDecisionGovernancePanel.jsx'), 'utf8');
assert(panelSource.includes('buildLearningChangeControlRegistry'));
assert(panelSource.includes('APPROVE_FOR_ENGINEERING'));
assert(panelSource.includes('جميع صلاحيات الإنتاج والمعاملات تظل مقفلة'));
assert(!panelSource.includes('window.'));
assert(postDecisionPanelSource.includes('LearningChangeControlPanel'));
assert(postDecisionPanelSource.includes('learningDispositions'));

console.log('LEARNING_CHANGE_CONTROL_REGISTRY=PASS');
