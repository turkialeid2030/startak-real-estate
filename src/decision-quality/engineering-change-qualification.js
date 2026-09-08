'use strict';

const {
  LEARNING_CHANGE_CONTROL_STATUS,
  CHANGE_KIND,
} = require('./learning-change-control');

const CHANGE_QUALIFICATION_STATUS = Object.freeze({
  HOLD_CHANGE_CONTROL_REGISTRY: 'HOLD_CHANGE_CONTROL_REGISTRY',
  NO_ENGINEERING_PROPOSALS: 'NO_ENGINEERING_PROPOSALS',
  HOLD_IMPLEMENTATION_EVIDENCE: 'HOLD_IMPLEMENTATION_EVIDENCE',
  HOLD_CALCULATION_EVIDENCE: 'HOLD_CALCULATION_EVIDENCE',
  HOLD_REGRESSION_EVIDENCE: 'HOLD_REGRESSION_EVIDENCE',
  HOLD_ROLLBACK_EVIDENCE: 'HOLD_ROLLBACK_EVIDENCE',
  HOLD_INDEPENDENT_REVIEW: 'HOLD_INDEPENDENT_REVIEW',
  HOLD_HUMAN_QUALIFICATION: 'HOLD_HUMAN_QUALIFICATION',
  QUALIFIED_FOR_RELEASE_REVIEW_ONLY: 'QUALIFIED_FOR_RELEASE_REVIEW_ONLY',
});

const QUALIFICATION_DECISION = Object.freeze({
  QUALIFY_FOR_RELEASE_REVIEW: 'QUALIFY_FOR_RELEASE_REVIEW',
  REJECT: 'REJECT',
  DEFER: 'DEFER',
});

const INDEPENDENT_REVIEW_DECISION = Object.freeze({
  APPROVE: 'APPROVE',
  APPROVE_WITH_CONDITIONS: 'APPROVE_WITH_CONDITIONS',
  REJECT: 'REJECT',
});

const CALCULATION_SENSITIVE_KINDS = Object.freeze(new Set([
  CHANGE_KIND.MODEL_LOGIC,
  CHANGE_KIND.POLICY,
  CHANGE_KIND.STANDARD_OR_RULE,
  CHANGE_KIND.DECISION_THRESHOLD,
  CHANGE_KIND.ASSUMPTION_GUIDANCE,
]));

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function requiredObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}

function requiredArray(value, field) {
  if (!Array.isArray(value)) throw new TypeError(`${field} must be an array`);
  return value;
}

function isoTimestamp(value, field) {
  const text = requiredString(value, field);
  if (!Number.isFinite(Date.parse(text))) throw new TypeError(`${field} must be a valid timestamp`);
  return text;
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

function authorityBoundary() {
  return {
    engineeringImplementationQualified: false,
    independentReviewAuthenticityVerified: false,
    productionChangeAuthorized: false,
    standardsActivationAuthorized: false,
    automatedModelUpdateAuthorized: false,
    automatedPolicyUpdateAuthorized: false,
    automatedRuleActivationAuthorized: false,
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
    humanReviewRequired: true,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    transactionAuthorized: false,
  });
}

function assertRegistry(changeControlRegistry, projectId, caseId) {
  requiredObject(changeControlRegistry, 'changeControlRegistry');
  if (changeControlRegistry.projectId !== projectId || changeControlRegistry.caseId !== caseId) {
    throw new Error('ENGINEERING_CHANGE_REGISTRY_SCOPE_MISMATCH');
  }
  if (changeControlRegistry.status !== LEARNING_CHANGE_CONTROL_STATUS.READY_FOR_ENGINEERING_PROPOSAL) return false;
  if (!Array.isArray(changeControlRegistry.engineeringProposals)) return false;
  return true;
}

function implementationRecord(value, proposal) {
  requiredObject(value, `implementationEvidence:${proposal.proposalRef}`);
  const changedPaths = requiredArray(value.changedPaths, `implementationEvidence:${proposal.proposalRef}.changedPaths`)
    .map((item, index) => requiredString(item, `changedPaths[${index}]`));
  if (changedPaths.length === 0) throw new Error(`CHANGED_PATHS_REQUIRED:${proposal.proposalRef}`);
  if (value.implementationComplete !== true) throw new Error(`IMPLEMENTATION_NOT_COMPLETE:${proposal.proposalRef}`);
  if (value.productionApplied === true) throw new Error(`PRODUCTION_CHANGE_MUST_NOT_PRECEDE_QUALIFICATION:${proposal.proposalRef}`);
  return Object.freeze({
    proposalRef: proposal.proposalRef,
    implementationRef: requiredString(value.implementationRef, `implementationEvidence:${proposal.proposalRef}.implementationRef`),
    commitSha: commitSha(value.commitSha, `implementationEvidence:${proposal.proposalRef}.commitSha`),
    artifactSha256: sha256(value.artifactSha256, `implementationEvidence:${proposal.proposalRef}.artifactSha256`),
    implementedBy: requiredString(value.implementedBy, `implementationEvidence:${proposal.proposalRef}.implementedBy`),
    implementedAt: isoTimestamp(value.implementedAt, `implementationEvidence:${proposal.proposalRef}.implementedAt`),
    scopeSummary: requiredString(value.scopeSummary, `implementationEvidence:${proposal.proposalRef}.scopeSummary`),
    changedPaths: Object.freeze(changedPaths),
    implementationComplete: true,
    productionApplied: false,
  });
}

function calculationRecord(value, proposal) {
  requiredObject(value, `calculationEvidence:${proposal.proposalRef}`);
  const goldenCaseRefs = requiredArray(value.goldenCaseRefs, `calculationEvidence:${proposal.proposalRef}.goldenCaseRefs`)
    .map((item, index) => requiredString(item, `goldenCaseRefs[${index}]`));
  if (goldenCaseRefs.length === 0) throw new Error(`GOLDEN_CASE_REFS_REQUIRED:${proposal.proposalRef}`);
  const result = requiredString(value.result, `calculationEvidence:${proposal.proposalRef}.result`);
  if (!['NO_UNEXPLAINED_VARIANCE', 'EXPLAINED_EXPECTED_VARIANCE'].includes(result)) {
    throw new TypeError(`invalid calculation comparison result: ${result}`);
  }
  return Object.freeze({
    proposalRef: proposal.proposalRef,
    baselineRef: requiredString(value.baselineRef, `calculationEvidence:${proposal.proposalRef}.baselineRef`),
    baselineArtifactSha256: sha256(value.baselineArtifactSha256, `calculationEvidence:${proposal.proposalRef}.baselineArtifactSha256`),
    candidateRef: requiredString(value.candidateRef, `calculationEvidence:${proposal.proposalRef}.candidateRef`),
    candidateArtifactSha256: sha256(value.candidateArtifactSha256, `calculationEvidence:${proposal.proposalRef}.candidateArtifactSha256`),
    comparisonRef: requiredString(value.comparisonRef, `calculationEvidence:${proposal.proposalRef}.comparisonRef`),
    comparedBy: requiredString(value.comparedBy, `calculationEvidence:${proposal.proposalRef}.comparedBy`),
    comparedAt: isoTimestamp(value.comparedAt, `calculationEvidence:${proposal.proposalRef}.comparedAt`),
    goldenCaseRefs: Object.freeze(goldenCaseRefs),
    result,
    unexplainedVarianceCount: Number.isInteger(value.unexplainedVarianceCount) ? value.unexplainedVarianceCount : 0,
    approvedExpectedVarianceRef: value.approvedExpectedVarianceRef == null ? null : requiredString(value.approvedExpectedVarianceRef, `calculationEvidence:${proposal.proposalRef}.approvedExpectedVarianceRef`),
  });
}

function regressionRecord(value, proposal) {
  requiredObject(value, `regressionEvidence:${proposal.proposalRef}`);
  const total = Number(value.total);
  const passed = Number(value.passed);
  const failed = Number(value.failed);
  if (![total, passed, failed].every(Number.isInteger) || total <= 0 || passed < 0 || failed < 0) {
    throw new TypeError(`invalid regression counts:${proposal.proposalRef}`);
  }
  if (value.result !== 'PASS' || failed !== 0 || passed !== total) throw new Error(`REGRESSION_NOT_PASSING:${proposal.proposalRef}`);
  return Object.freeze({
    proposalRef: proposal.proposalRef,
    workflowRunRef: requiredString(value.workflowRunRef, `regressionEvidence:${proposal.proposalRef}.workflowRunRef`),
    testSuiteRef: requiredString(value.testSuiteRef, `regressionEvidence:${proposal.proposalRef}.testSuiteRef`),
    evidenceSha256: sha256(value.evidenceSha256, `regressionEvidence:${proposal.proposalRef}.evidenceSha256`),
    completedAt: isoTimestamp(value.completedAt, `regressionEvidence:${proposal.proposalRef}.completedAt`),
    total,
    passed,
    failed,
    result: 'PASS',
  });
}

function rollbackRecord(value, proposal, impactAssessment) {
  requiredObject(value, `rollbackEvidence:${proposal.proposalRef}`);
  requiredObject(impactAssessment, `impactAssessment:${proposal.proposalRef}`);
  const rollbackPlanRef = requiredString(value.rollbackPlanRef, `rollbackEvidence:${proposal.proposalRef}.rollbackPlanRef`);
  if (rollbackPlanRef !== impactAssessment.rollbackPlanRef) throw new Error(`ROLLBACK_PLAN_REF_MISMATCH:${proposal.proposalRef}`);
  if (value.drillResult !== 'PASS') throw new Error(`ROLLBACK_DRILL_NOT_PASSING:${proposal.proposalRef}`);
  if (value.productionRollbackExecuted === true) throw new Error(`PRODUCTION_ROLLBACK_EXECUTION_NOT_EXPECTED:${proposal.proposalRef}`);
  return Object.freeze({
    proposalRef: proposal.proposalRef,
    rollbackPlanRef,
    rollbackProcedureRef: requiredString(value.rollbackProcedureRef, `rollbackEvidence:${proposal.proposalRef}.rollbackProcedureRef`),
    evidenceSha256: sha256(value.evidenceSha256, `rollbackEvidence:${proposal.proposalRef}.evidenceSha256`),
    verifiedBy: requiredString(value.verifiedBy, `rollbackEvidence:${proposal.proposalRef}.verifiedBy`),
    verifiedAt: isoTimestamp(value.verifiedAt, `rollbackEvidence:${proposal.proposalRef}.verifiedAt`),
    drillResult: 'PASS',
    productionRollbackExecuted: false,
  });
}

function independentReviewRecord(value, proposal, implementation, approval) {
  requiredObject(value, `independentReview:${proposal.proposalRef}`);
  requiredObject(implementation, `implementation:${proposal.proposalRef}`);
  requiredObject(approval, `approval:${proposal.proposalRef}`);
  const reviewerRef = requiredString(value.reviewerRef, `independentReview:${proposal.proposalRef}.reviewerRef`);
  if (reviewerRef === implementation.implementedBy || reviewerRef === approval.approverRef) {
    throw new Error(`INDEPENDENT_REVIEWER_CONFLICT:${proposal.proposalRef}`);
  }
  if (value.independenceConfirmed !== true) throw new Error(`INDEPENDENCE_CONFIRMATION_REQUIRED:${proposal.proposalRef}`);
  const decision = requiredString(value.decision, `independentReview:${proposal.proposalRef}.decision`);
  if (!Object.values(INDEPENDENT_REVIEW_DECISION).includes(decision)) throw new TypeError(`invalid independent review decision: ${decision}`);
  if (decision === INDEPENDENT_REVIEW_DECISION.REJECT) throw new Error(`INDEPENDENT_REVIEW_REJECTED:${proposal.proposalRef}`);
  return Object.freeze({
    proposalRef: proposal.proposalRef,
    reviewerRef,
    reviewRef: requiredString(value.reviewRef, `independentReview:${proposal.proposalRef}.reviewRef`),
    reviewedAt: isoTimestamp(value.reviewedAt, `independentReview:${proposal.proposalRef}.reviewedAt`),
    evidenceSha256: sha256(value.evidenceSha256, `independentReview:${proposal.proposalRef}.evidenceSha256`),
    decision,
    conditions: Object.freeze(Array.isArray(value.conditions) ? value.conditions.map((item, index) => requiredString(item, `conditions[${index}]`)) : []),
    independenceConfirmed: true,
    authenticityExternallyVerified: false,
  });
}

function qualificationRecord(value, proposal, independentReview) {
  requiredObject(value, `qualificationDecision:${proposal.proposalRef}`);
  const decision = requiredString(value.decision, `qualificationDecision:${proposal.proposalRef}.decision`);
  if (!Object.values(QUALIFICATION_DECISION).includes(decision)) throw new TypeError(`invalid qualification decision: ${decision}`);
  if (value.humanDecisionConfirmed !== true) throw new Error(`HUMAN_QUALIFICATION_CONFIRMATION_REQUIRED:${proposal.proposalRef}`);
  const qualifierRef = requiredString(value.qualifierRef, `qualificationDecision:${proposal.proposalRef}.qualifierRef`);
  if (independentReview && qualifierRef === independentReview.reviewerRef) {
    throw new Error(`QUALIFIER_REVIEWER_SEPARATION_REQUIRED:${proposal.proposalRef}`);
  }
  return Object.freeze({
    proposalRef: proposal.proposalRef,
    decision,
    qualifierRef,
    decidedAt: isoTimestamp(value.decidedAt, `qualificationDecision:${proposal.proposalRef}.decidedAt`),
    rationale: requiredString(value.rationale, `qualificationDecision:${proposal.proposalRef}.rationale`),
    humanDecisionConfirmed: true,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
  });
}

function buildEngineeringChangeQualificationGate({
  projectId,
  caseId,
  changeControlRegistry,
  implementationEvidenceByProposalRef = {},
  calculationEvidenceByProposalRef = {},
  regressionEvidenceByProposalRef = {},
  rollbackEvidenceByProposalRef = {},
  independentReviewByProposalRef = {},
  qualificationDecisionByProposalRef = {},
} = {}) {
  const scopedProjectId = requiredString(projectId, 'projectId');
  const scopedCaseId = requiredString(caseId, 'caseId');
  [
    ['implementationEvidenceByProposalRef', implementationEvidenceByProposalRef],
    ['calculationEvidenceByProposalRef', calculationEvidenceByProposalRef],
    ['regressionEvidenceByProposalRef', regressionEvidenceByProposalRef],
    ['rollbackEvidenceByProposalRef', rollbackEvidenceByProposalRef],
    ['independentReviewByProposalRef', independentReviewByProposalRef],
    ['qualificationDecisionByProposalRef', qualificationDecisionByProposalRef],
  ].forEach(([field, value]) => requiredObject(value, field));

  if (!assertRegistry(changeControlRegistry, scopedProjectId, scopedCaseId)) {
    return holdEnvelope({
      projectId: scopedProjectId,
      caseId: scopedCaseId,
      status: CHANGE_QUALIFICATION_STATUS.HOLD_CHANGE_CONTROL_REGISTRY,
      reasonCodes: ['ENGINEERING_PROPOSAL_REGISTRY_REQUIRED'],
    });
  }

  const proposals = changeControlRegistry.engineeringProposals;
  if (proposals.length === 0) {
    return holdEnvelope({
      projectId: scopedProjectId,
      caseId: scopedCaseId,
      status: CHANGE_QUALIFICATION_STATUS.NO_ENGINEERING_PROPOSALS,
      reasonCodes: [],
      records: { proposals: [] },
    });
  }

  const impactByRef = new Map((changeControlRegistry.impactAssessments || []).map((item) => [item.proposalRef, item]));
  const approvalByRef = new Map((changeControlRegistry.approvals || []).map((item) => [item.proposalRef, item]));

  const missingImplementation = proposals.filter((proposal) => !implementationEvidenceByProposalRef[proposal.proposalRef]);
  if (missingImplementation.length) {
    return holdEnvelope({
      projectId: scopedProjectId,
      caseId: scopedCaseId,
      status: CHANGE_QUALIFICATION_STATUS.HOLD_IMPLEMENTATION_EVIDENCE,
      reasonCodes: missingImplementation.map((proposal) => `MISSING_IMPLEMENTATION_EVIDENCE:${proposal.proposalRef}`),
      records: { proposals },
    });
  }
  const implementationEvidence = proposals.map((proposal) => implementationRecord(implementationEvidenceByProposalRef[proposal.proposalRef], proposal));

  const calcRequired = proposals.filter((proposal) => CALCULATION_SENSITIVE_KINDS.has(proposal.changeKind));
  const missingCalculation = calcRequired.filter((proposal) => !calculationEvidenceByProposalRef[proposal.proposalRef]);
  if (missingCalculation.length) {
    return holdEnvelope({
      projectId: scopedProjectId,
      caseId: scopedCaseId,
      status: CHANGE_QUALIFICATION_STATUS.HOLD_CALCULATION_EVIDENCE,
      reasonCodes: missingCalculation.map((proposal) => `MISSING_BEFORE_AFTER_CALCULATION_EVIDENCE:${proposal.proposalRef}`),
      records: { proposals, implementationEvidence },
    });
  }
  const calculationEvidence = calcRequired.map((proposal) => {
    const record = calculationRecord(calculationEvidenceByProposalRef[proposal.proposalRef], proposal);
    if (record.unexplainedVarianceCount !== 0) throw new Error(`UNEXPLAINED_CALCULATION_VARIANCE:${proposal.proposalRef}`);
    if (record.result === 'EXPLAINED_EXPECTED_VARIANCE' && !record.approvedExpectedVarianceRef) {
      throw new Error(`EXPECTED_VARIANCE_APPROVAL_REF_REQUIRED:${proposal.proposalRef}`);
    }
    return record;
  });

  const missingRegression = proposals.filter((proposal) => !regressionEvidenceByProposalRef[proposal.proposalRef]);
  if (missingRegression.length) {
    return holdEnvelope({
      projectId: scopedProjectId,
      caseId: scopedCaseId,
      status: CHANGE_QUALIFICATION_STATUS.HOLD_REGRESSION_EVIDENCE,
      reasonCodes: missingRegression.map((proposal) => `MISSING_REGRESSION_EVIDENCE:${proposal.proposalRef}`),
      records: { proposals, implementationEvidence, calculationEvidence },
    });
  }
  const regressionEvidence = proposals.map((proposal) => regressionRecord(regressionEvidenceByProposalRef[proposal.proposalRef], proposal));

  const missingRollback = proposals.filter((proposal) => !rollbackEvidenceByProposalRef[proposal.proposalRef]);
  if (missingRollback.length) {
    return holdEnvelope({
      projectId: scopedProjectId,
      caseId: scopedCaseId,
      status: CHANGE_QUALIFICATION_STATUS.HOLD_ROLLBACK_EVIDENCE,
      reasonCodes: missingRollback.map((proposal) => `MISSING_ROLLBACK_EVIDENCE:${proposal.proposalRef}`),
      records: { proposals, implementationEvidence, calculationEvidence, regressionEvidence },
    });
  }
  const rollbackEvidence = proposals.map((proposal) => rollbackRecord(
    rollbackEvidenceByProposalRef[proposal.proposalRef],
    proposal,
    impactByRef.get(proposal.proposalRef),
  ));

  const requiresIndependentReview = (proposal) => {
    const impact = impactByRef.get(proposal.proposalRef);
    return impact?.independentReviewRequired === true
      || ['HIGH', 'CRITICAL'].includes(impact?.riskLevel)
      || CALCULATION_SENSITIVE_KINDS.has(proposal.changeKind);
  };
  const reviewRequired = proposals.filter(requiresIndependentReview);
  const missingIndependentReview = reviewRequired.filter((proposal) => !independentReviewByProposalRef[proposal.proposalRef]);
  if (missingIndependentReview.length) {
    return holdEnvelope({
      projectId: scopedProjectId,
      caseId: scopedCaseId,
      status: CHANGE_QUALIFICATION_STATUS.HOLD_INDEPENDENT_REVIEW,
      reasonCodes: missingIndependentReview.map((proposal) => `MISSING_INDEPENDENT_REVIEW:${proposal.proposalRef}`),
      records: { proposals, implementationEvidence, calculationEvidence, regressionEvidence, rollbackEvidence },
    });
  }
  const implementationByRef = new Map(implementationEvidence.map((item) => [item.proposalRef, item]));
  const independentReviews = reviewRequired.map((proposal) => independentReviewRecord(
    independentReviewByProposalRef[proposal.proposalRef],
    proposal,
    implementationByRef.get(proposal.proposalRef),
    approvalByRef.get(proposal.proposalRef),
  ));

  const missingQualification = proposals.filter((proposal) => !qualificationDecisionByProposalRef[proposal.proposalRef]);
  if (missingQualification.length) {
    return holdEnvelope({
      projectId: scopedProjectId,
      caseId: scopedCaseId,
      status: CHANGE_QUALIFICATION_STATUS.HOLD_HUMAN_QUALIFICATION,
      reasonCodes: missingQualification.map((proposal) => `MISSING_HUMAN_CHANGE_QUALIFICATION:${proposal.proposalRef}`),
      records: { proposals, implementationEvidence, calculationEvidence, regressionEvidence, rollbackEvidence, independentReviews },
    });
  }

  const independentByRef = new Map(independentReviews.map((item) => [item.proposalRef, item]));
  const qualificationDecisions = proposals.map((proposal) => qualificationRecord(
    qualificationDecisionByProposalRef[proposal.proposalRef],
    proposal,
    independentByRef.get(proposal.proposalRef) || null,
  ));
  const qualified = qualificationDecisions.filter((item) => item.decision === QUALIFICATION_DECISION.QUALIFY_FOR_RELEASE_REVIEW);
  const rejectedOrDeferred = qualificationDecisions.length - qualified.length;

  return deepFreeze({
    schemaVersion: 1,
    projectId: scopedProjectId,
    caseId: scopedCaseId,
    status: CHANGE_QUALIFICATION_STATUS.QUALIFIED_FOR_RELEASE_REVIEW_ONLY,
    reasonCodes: [],
    proposals,
    implementationEvidence,
    calculationEvidence,
    regressionEvidence,
    rollbackEvidence,
    independentReviews,
    qualificationDecisions,
    qualifiedForReleaseReviewProposalRefs: qualified.map((item) => item.proposalRef),
    qualifiedForReleaseReviewCount: qualified.length,
    rejectedOrDeferredCount: rejectedOrDeferred,
    authority: authorityBoundary(),
    humanReviewRequired: true,
    independentReviewEvidenceAuthenticityNotEstablishedByThisLayer: true,
    releaseProcessStillRequired: true,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    transactionAuthorized: false,
    semantics: 'This gate qualifies an engineering change evidence package for downstream release review only. It does not authenticate external reviewers, activate standards, modify production, authorize release/merge/deployment, or execute a transaction.',
  });
}

module.exports = {
  CHANGE_QUALIFICATION_STATUS,
  QUALIFICATION_DECISION,
  INDEPENDENT_REVIEW_DECISION,
  CALCULATION_SENSITIVE_KINDS,
  buildEngineeringChangeQualificationGate,
};
