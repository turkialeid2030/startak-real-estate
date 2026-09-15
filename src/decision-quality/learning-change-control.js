'use strict';

const LEARNING_CHANGE_CONTROL_STATUS = Object.freeze({
  HOLD_LEARNING_REVIEW: 'HOLD_LEARNING_REVIEW',
  WAITING_FOR_HUMAN_DISPOSITIONS: 'WAITING_FOR_HUMAN_DISPOSITIONS',
  NO_CHANGE_PROPOSALS: 'NO_CHANGE_PROPOSALS',
  HOLD_IMPACT_ASSESSMENT: 'HOLD_IMPACT_ASSESSMENT',
  HOLD_CHANGE_APPROVAL: 'HOLD_CHANGE_APPROVAL',
  READY_FOR_ENGINEERING_PROPOSAL: 'READY_FOR_ENGINEERING_PROPOSAL',
});

const LEARNING_DISPOSITION = Object.freeze({
  ACCEPT_AS_CHANGE_CANDIDATE: 'ACCEPT_AS_CHANGE_CANDIDATE',
  REJECT: 'REJECT',
  DEFER: 'DEFER',
});

const CHANGE_KIND = Object.freeze({
  MODEL_LOGIC: 'MODEL_LOGIC',
  POLICY: 'POLICY',
  STANDARD_OR_RULE: 'STANDARD_OR_RULE',
  WORKFLOW: 'WORKFLOW',
  DATA_SCHEMA: 'DATA_SCHEMA',
  DECISION_THRESHOLD: 'DECISION_THRESHOLD',
  ASSUMPTION_GUIDANCE: 'ASSUMPTION_GUIDANCE',
  DOCUMENTATION: 'DOCUMENTATION',
});

const CHANGE_APPROVAL_DECISION = Object.freeze({
  APPROVE_FOR_ENGINEERING: 'APPROVE_FOR_ENGINEERING',
  REJECT: 'REJECT',
  DEFER: 'DEFER',
});

const RISK_LEVEL = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function requiredObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
  return value;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function normalizeIsoTimestamp(value, field) {
  const text = requiredString(value, field);
  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp)) throw new TypeError(`${field} must be a valid timestamp`);
  return text;
}

function authorityBoundary() {
  return {
    automatedPolicyUpdateAuthorized: false,
    automatedModelUpdateAuthorized: false,
    automatedRuleActivationAuthorized: false,
    standardsActivationAuthorized: false,
    productionChangeAuthorized: false,
    implementationAuthorized: false,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    transactionAuthorized: false,
  };
}

function validateLearningReview(learningReview, projectId, caseId) {
  requiredObject(learningReview, 'learningReview');
  if (learningReview.projectId !== projectId || learningReview.caseId !== caseId) {
    const error = new Error('LEARNING_CHANGE_CONTROL_SCOPE_MISMATCH');
    error.code = LEARNING_CHANGE_CONTROL_STATUS.HOLD_LEARNING_REVIEW;
    throw error;
  }
  return learningReview.status === 'READY_FOR_LEARNING_REVIEW'
    && Array.isArray(learningReview.learningCandidates);
}

function normalizeDisposition(item, index, candidateIds) {
  requiredObject(item, `humanDispositions[${index}]`);
  const candidateId = requiredString(item.candidateId, `humanDispositions[${index}].candidateId`);
  if (!candidateIds.has(candidateId)) throw new Error(`UNKNOWN_LEARNING_CANDIDATE:${candidateId}`);
  if (!Object.values(LEARNING_DISPOSITION).includes(item.disposition)) {
    throw new TypeError(`invalid learning disposition: ${item.disposition}`);
  }

  const normalized = {
    candidateId,
    disposition: item.disposition,
    reviewerRef: requiredString(item.reviewerRef, `humanDispositions[${index}].reviewerRef`),
    decidedAt: normalizeIsoTimestamp(item.decidedAt, `humanDispositions[${index}].decidedAt`),
    rationale: requiredString(item.rationale, `humanDispositions[${index}].rationale`),
    humanDecisionConfirmed: item.humanDecisionConfirmed === true,
  };

  if (!normalized.humanDecisionConfirmed) {
    throw new Error(`HUMAN_LEARNING_DISPOSITION_CONFIRMATION_REQUIRED:${candidateId}`);
  }

  if (item.disposition === LEARNING_DISPOSITION.ACCEPT_AS_CHANGE_CANDIDATE) {
    normalized.proposalRef = requiredString(item.proposalRef, `humanDispositions[${index}].proposalRef`);
    normalized.changeKind = requiredString(item.changeKind, `humanDispositions[${index}].changeKind`);
    if (!Object.values(CHANGE_KIND).includes(normalized.changeKind)) {
      throw new TypeError(`invalid change kind: ${normalized.changeKind}`);
    }
    normalized.targetRef = requiredString(item.targetRef, `humanDispositions[${index}].targetRef`);
    normalized.changeSummary = requiredString(item.changeSummary, `humanDispositions[${index}].changeSummary`);
  }

  return Object.freeze(normalized);
}

function normalizeImpactAssessment(value, proposal, index) {
  requiredObject(value, `impactAssessment:${proposal.proposalRef}`);
  const affectedDomains = Array.isArray(value.affectedDomains)
    ? value.affectedDomains.map((item, domainIndex) => requiredString(item, `affectedDomains[${domainIndex}]`))
    : [];
  if (affectedDomains.length === 0) throw new Error(`AFFECTED_DOMAINS_REQUIRED:${proposal.proposalRef}`);
  const riskLevel = requiredString(value.riskLevel, `impactAssessment:${proposal.proposalRef}.riskLevel`);
  if (!Object.values(RISK_LEVEL).includes(riskLevel)) throw new TypeError(`invalid risk level: ${riskLevel}`);

  return Object.freeze({
    proposalRef: proposal.proposalRef,
    assessedBy: requiredString(value.assessedBy, `impactAssessment:${proposal.proposalRef}.assessedBy`),
    assessedAt: normalizeIsoTimestamp(value.assessedAt, `impactAssessment:${proposal.proposalRef}.assessedAt`),
    impactSummary: requiredString(value.impactSummary, `impactAssessment:${proposal.proposalRef}.impactSummary`),
    riskLevel,
    affectedDomains: Object.freeze(affectedDomains),
    testPlanRef: requiredString(value.testPlanRef, `impactAssessment:${proposal.proposalRef}.testPlanRef`),
    rollbackPlanRef: requiredString(value.rollbackPlanRef, `impactAssessment:${proposal.proposalRef}.rollbackPlanRef`),
    independentReviewRequired: value.independentReviewRequired === true,
    standardsLifecycleGovernanceRequired: proposal.changeKind === CHANGE_KIND.STANDARD_OR_RULE,
    modelPolicyGovernanceRequired: [CHANGE_KIND.MODEL_LOGIC, CHANGE_KIND.POLICY, CHANGE_KIND.DECISION_THRESHOLD].includes(proposal.changeKind),
    index,
  });
}

function normalizeApproval(value, proposal) {
  requiredObject(value, `changeApproval:${proposal.proposalRef}`);
  const decision = requiredString(value.decision, `changeApproval:${proposal.proposalRef}.decision`);
  if (!Object.values(CHANGE_APPROVAL_DECISION).includes(decision)) {
    throw new TypeError(`invalid change approval decision: ${decision}`);
  }
  if (value.humanDecisionConfirmed !== true) {
    throw new Error(`HUMAN_CHANGE_APPROVAL_CONFIRMATION_REQUIRED:${proposal.proposalRef}`);
  }
  return Object.freeze({
    proposalRef: proposal.proposalRef,
    decision,
    approverRef: requiredString(value.approverRef, `changeApproval:${proposal.proposalRef}.approverRef`),
    decidedAt: normalizeIsoTimestamp(value.decidedAt, `changeApproval:${proposal.proposalRef}.decidedAt`),
    rationale: requiredString(value.rationale, `changeApproval:${proposal.proposalRef}.rationale`),
    humanDecisionConfirmed: true,
    implementationAuthorized: false,
    productionActivationAuthorized: false,
  });
}

/**
 * Converts decision-learning candidates into a governed human disposition and
 * change-control register. An accepted learning candidate is only a proposal;
 * it cannot mutate models, policies, thresholds, standards or production code.
 */
function buildLearningChangeControlRegistry({
  projectId,
  caseId,
  learningReview,
  humanDispositions = [],
  impactAssessmentsByProposalRef = {},
  changeApprovalsByProposalRef = {},
} = {}) {
  const scopedProjectId = requiredString(projectId, 'projectId');
  const scopedCaseId = requiredString(caseId, 'caseId');
  if (!Array.isArray(humanDispositions)) throw new TypeError('humanDispositions must be an array');
  requiredObject(impactAssessmentsByProposalRef, 'impactAssessmentsByProposalRef');
  requiredObject(changeApprovalsByProposalRef, 'changeApprovalsByProposalRef');

  const qualifiedLearningReview = validateLearningReview(learningReview, scopedProjectId, scopedCaseId);
  if (!qualifiedLearningReview) {
    return deepFreeze({
      schemaVersion: 1,
      projectId: scopedProjectId,
      caseId: scopedCaseId,
      status: LEARNING_CHANGE_CONTROL_STATUS.HOLD_LEARNING_REVIEW,
      reasonCodes: ['QUALIFIED_LEARNING_REVIEW_REQUIRED'],
      dispositions: [],
      proposals: [],
      authority: authorityBoundary(),
      humanReviewRequired: true,
      transactionAuthorized: false,
    });
  }

  const candidates = learningReview.learningCandidates;
  const candidateIds = new Set(candidates.map((candidate) => requiredString(candidate.id, 'learningCandidate.id')));
  if (candidateIds.size !== candidates.length) throw new Error('DUPLICATE_LEARNING_CANDIDATE_ID');

  const dispositions = humanDispositions.map((item, index) => normalizeDisposition(item, index, candidateIds));
  const dispositionIds = dispositions.map((item) => item.candidateId);
  const duplicateDispositionIds = dispositionIds.filter((id, index) => dispositionIds.indexOf(id) !== index);
  if (duplicateDispositionIds.length) {
    throw new Error(`DUPLICATE_LEARNING_DISPOSITION:${[...new Set(duplicateDispositionIds)].join(',')}`);
  }

  const dispositionByCandidate = new Map(dispositions.map((item) => [item.candidateId, item]));
  const missingCandidateIds = [...candidateIds].filter((id) => !dispositionByCandidate.has(id));
  if (missingCandidateIds.length) {
    return deepFreeze({
      schemaVersion: 1,
      projectId: scopedProjectId,
      caseId: scopedCaseId,
      status: LEARNING_CHANGE_CONTROL_STATUS.WAITING_FOR_HUMAN_DISPOSITIONS,
      reasonCodes: missingCandidateIds.map((id) => `MISSING_HUMAN_DISPOSITION:${id}`),
      dispositions,
      proposals: [],
      authority: authorityBoundary(),
      humanReviewRequired: true,
      transactionAuthorized: false,
    });
  }

  const proposals = dispositions
    .filter((item) => item.disposition === LEARNING_DISPOSITION.ACCEPT_AS_CHANGE_CANDIDATE)
    .map((item) => Object.freeze({
      proposalRef: item.proposalRef,
      sourceCandidateId: item.candidateId,
      changeKind: item.changeKind,
      targetRef: item.targetRef,
      changeSummary: item.changeSummary,
      proposalStatus: 'PENDING_IMPACT_ASSESSMENT',
      requiresSeparateImplementationPR: true,
      requiresRegressionEvidence: true,
      standardsLifecycleGovernanceRequired: item.changeKind === CHANGE_KIND.STANDARD_OR_RULE,
      modelPolicyGovernanceRequired: [CHANGE_KIND.MODEL_LOGIC, CHANGE_KIND.POLICY, CHANGE_KIND.DECISION_THRESHOLD].includes(item.changeKind),
      productionActivationAuthorized: false,
    }));

  const proposalRefs = proposals.map((item) => item.proposalRef);
  const duplicateProposalRefs = proposalRefs.filter((ref, index) => proposalRefs.indexOf(ref) !== index);
  if (duplicateProposalRefs.length) {
    throw new Error(`DUPLICATE_CHANGE_PROPOSAL_REF:${[...new Set(duplicateProposalRefs)].join(',')}`);
  }

  if (proposals.length === 0) {
    return deepFreeze({
      schemaVersion: 1,
      projectId: scopedProjectId,
      caseId: scopedCaseId,
      status: LEARNING_CHANGE_CONTROL_STATUS.NO_CHANGE_PROPOSALS,
      reasonCodes: [],
      dispositions,
      proposals: [],
      impactAssessments: [],
      approvals: [],
      authority: authorityBoundary(),
      humanReviewRequired: true,
      transactionAuthorized: false,
      semantics: 'All learning candidates were explicitly rejected or deferred by humans. No change proposal was created.',
    });
  }

  const missingImpactAssessmentRefs = proposals
    .filter((proposal) => !impactAssessmentsByProposalRef[proposal.proposalRef])
    .map((proposal) => proposal.proposalRef);
  if (missingImpactAssessmentRefs.length) {
    return deepFreeze({
      schemaVersion: 1,
      projectId: scopedProjectId,
      caseId: scopedCaseId,
      status: LEARNING_CHANGE_CONTROL_STATUS.HOLD_IMPACT_ASSESSMENT,
      reasonCodes: missingImpactAssessmentRefs.map((ref) => `MISSING_IMPACT_ASSESSMENT:${ref}`),
      dispositions,
      proposals,
      impactAssessments: [],
      approvals: [],
      authority: authorityBoundary(),
      humanReviewRequired: true,
      transactionAuthorized: false,
    });
  }

  const impactAssessments = proposals.map((proposal, index) => normalizeImpactAssessment(
    impactAssessmentsByProposalRef[proposal.proposalRef],
    proposal,
    index,
  ));

  const missingApprovalRefs = proposals
    .filter((proposal) => !changeApprovalsByProposalRef[proposal.proposalRef])
    .map((proposal) => proposal.proposalRef);
  if (missingApprovalRefs.length) {
    return deepFreeze({
      schemaVersion: 1,
      projectId: scopedProjectId,
      caseId: scopedCaseId,
      status: LEARNING_CHANGE_CONTROL_STATUS.HOLD_CHANGE_APPROVAL,
      reasonCodes: missingApprovalRefs.map((ref) => `MISSING_HUMAN_CHANGE_APPROVAL:${ref}`),
      dispositions,
      proposals,
      impactAssessments,
      approvals: [],
      authority: authorityBoundary(),
      humanReviewRequired: true,
      transactionAuthorized: false,
    });
  }

  const approvals = proposals.map((proposal) => normalizeApproval(
    changeApprovalsByProposalRef[proposal.proposalRef],
    proposal,
  ));
  const approvalByRef = new Map(approvals.map((item) => [item.proposalRef, item]));
  const engineeringProposals = proposals
    .filter((proposal) => approvalByRef.get(proposal.proposalRef)?.decision === CHANGE_APPROVAL_DECISION.APPROVE_FOR_ENGINEERING)
    .map((proposal) => Object.freeze({
      ...proposal,
      proposalStatus: 'APPROVED_FOR_ENGINEERING_PROPOSAL_ONLY',
      implementationAuthorized: false,
      mergeAuthorized: false,
      deploymentAuthorized: false,
      productionActivationAuthorized: false,
    }));

  return deepFreeze({
    schemaVersion: 1,
    projectId: scopedProjectId,
    caseId: scopedCaseId,
    status: LEARNING_CHANGE_CONTROL_STATUS.READY_FOR_ENGINEERING_PROPOSAL,
    reasonCodes: [],
    dispositions,
    proposals,
    impactAssessments,
    approvals,
    engineeringProposals,
    engineeringProposalCount: engineeringProposals.length,
    rejectedOrDeferredProposalCount: approvals.length - engineeringProposals.length,
    authority: authorityBoundary(),
    humanReviewRequired: true,
    implementationRequiresSeparateChange: true,
    productionActivationRequiresIndependentReleaseGate: true,
    transactionAuthorized: false,
    semantics: 'Human acceptance of a learning candidate and approval for engineering creates a controlled proposal only. It never edits a model, policy, threshold, standard, rule or production artifact; implementation, testing, standards lifecycle, release, merge and deployment remain separate governed steps.',
  });
}

module.exports = {
  LEARNING_CHANGE_CONTROL_STATUS,
  LEARNING_DISPOSITION,
  CHANGE_KIND,
  CHANGE_APPROVAL_DECISION,
  RISK_LEVEL,
  buildLearningChangeControlRegistry,
};
