'use strict';

const { buildDecisionControlGate } = require('../project-model/decision-control-orchestrator');
const { createDecisionDossier } = require('../decision-intelligence');
const { createDecisionReliabilityScorecard } = require('../decision-quality/reliability-scorecard');
const {
  evaluateProfessionalReviewNeeds,
  REVIEW_MATRIX_STATUS,
} = require('../decision-quality/professional-review-matrix');

const VERTICAL_SLICE_STATUS = Object.freeze({
  ANALYTICAL_PACKAGE_READY: 'ANALYTICAL_PACKAGE_READY',
  HOLD_CONTROL_GATE: 'HOLD_CONTROL_GATE',
  HOLD_REVIEW_POLICY: 'HOLD_REVIEW_POLICY',
  HOLD_RELIABILITY_INPUT: 'HOLD_RELIABILITY_INPUT',
  PROFESSIONAL_REVIEW_REQUIRED: 'PROFESSIONAL_REVIEW_REQUIRED',
});

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

function assertIsolation({ projectId, caseId, candidate, label }) {
  if (!candidate || typeof candidate !== 'object') return;
  if (candidate.projectId != null && candidate.projectId !== projectId) {
    throw new TypeError(`PROJECT_ISOLATION_VIOLATION:${label}`);
  }
  if (candidate.caseId != null && candidate.caseId !== caseId) {
    throw new TypeError(`CASE_ISOLATION_VIOLATION:${label}`);
  }
}

/**
 * Composes already-qualified deterministic modules into one auditable analytical package.
 *
 * This orchestrator intentionally does not fetch external data, mutate canonical financial
 * formulas, infer missing professional-review policy, or authorize a transaction.
 */
function buildAnalyticalVerticalSlice({
  profile,
  evidenceOrchestration,
  titleAssessment,
  tenantAssessment = null,
  regulatoryAssessment,
  financialResult = null,
  evidenceFacts = [],
  analyticalMetrics = {},
  scenarioResults = [],
  riskFlags = [],
  simulation = null,
  sensitivity = [],
  reliabilityDimensions = [],
  professionalReviewSignals = {},
  professionalReviewRules = [],
  locale = 'ar',
} = {}) {
  assertObject(profile, 'profile');
  assertObject(evidenceOrchestration, 'evidenceOrchestration');
  assertObject(titleAssessment, 'titleAssessment');
  assertObject(regulatoryAssessment, 'regulatoryAssessment');

  const projectId = profile.projectId;
  const caseId = evidenceOrchestration.caseId;
  if (typeof projectId !== 'string' || !projectId.trim()) throw new TypeError('profile.projectId is required');
  if (typeof caseId !== 'string' || !caseId.trim()) throw new TypeError('evidenceOrchestration.caseId is required');

  assertIsolation({ projectId, caseId, candidate: titleAssessment, label: 'TITLE' });
  assertIsolation({ projectId, caseId, candidate: tenantAssessment, label: 'TENANT' });
  assertIsolation({ projectId, caseId, candidate: regulatoryAssessment, label: 'REGULATORY' });
  assertIsolation({ projectId, caseId, candidate: financialResult, label: 'FINANCIAL' });

  const controlGate = buildDecisionControlGate({
    profile,
    evidenceOrchestration,
    titleAssessment,
    tenantAssessment,
    regulatoryAssessment,
  });

  if (!Array.isArray(professionalReviewRules) || professionalReviewRules.length === 0) {
    return freeze({
      schemaVersion: 1,
      projectId,
      caseId,
      status: VERTICAL_SLICE_STATUS.HOLD_REVIEW_POLICY,
      controlGate,
      professionalReview: null,
      reliability: null,
      dossier: null,
      reasonCodes: ['PROFESSIONAL_REVIEW_RULES_NOT_SUPPLIED'],
      humanDecisionRequired: true,
      transactionAuthorized: false,
      semantics: 'The analytical package cannot claim review readiness without an explicit professional-review policy. No policy is inferred by the platform.',
    });
  }

  const professionalReview = evaluateProfessionalReviewNeeds({
    caseId,
    projectId,
    signals: professionalReviewSignals,
    rules: professionalReviewRules,
  });

  if (!Array.isArray(reliabilityDimensions) || reliabilityDimensions.length === 0) {
    return freeze({
      schemaVersion: 1,
      projectId,
      caseId,
      status: VERTICAL_SLICE_STATUS.HOLD_RELIABILITY_INPUT,
      controlGate,
      professionalReview,
      reliability: null,
      dossier: null,
      reasonCodes: ['RELIABILITY_DIMENSIONS_NOT_SUPPLIED'],
      humanDecisionRequired: true,
      transactionAuthorized: false,
      semantics: 'Decision reliability is not inferred from code execution. Explicit classified reliability dimensions are required.',
    });
  }

  const reliability = createDecisionReliabilityScorecard({
    caseId,
    projectId,
    dimensions: reliabilityDimensions,
  });

  const dossier = createDecisionDossier({
    controlGate,
    financialResult,
    evidenceFacts,
    analyticalMetrics,
    scenarioResults,
    riskFlags,
    simulation,
    sensitivity,
    locale,
  });

  const reasons = [];
  let status = VERTICAL_SLICE_STATUS.ANALYTICAL_PACKAGE_READY;

  if (controlGate.status !== 'READY_FOR_ANALYTICAL_UNDERWRITING') {
    status = VERTICAL_SLICE_STATUS.HOLD_CONTROL_GATE;
    reasons.push(`CONTROL_GATE:${controlGate.status}`);
  } else if (professionalReview.status === REVIEW_MATRIX_STATUS.HOLD_EVIDENCE) {
    status = VERTICAL_SLICE_STATUS.HOLD_CONTROL_GATE;
    reasons.push('PROFESSIONAL_REVIEW_MATRIX:HOLD_EVIDENCE');
  } else if (professionalReview.status === REVIEW_MATRIX_STATUS.REVIEW_REQUIRED) {
    status = VERTICAL_SLICE_STATUS.PROFESSIONAL_REVIEW_REQUIRED;
    reasons.push('PROFESSIONAL_REVIEW_MATRIX:REVIEW_REQUIRED');
  }

  return freeze({
    schemaVersion: 1,
    projectId,
    caseId,
    status,
    controlGate,
    professionalReview,
    reliability,
    dossier,
    reasonCodes: reasons,
    boundaries: {
      externalDataFetchedByThisOrchestrator: false,
      officialIntegrationUsed: false,
      canonicalFinancialFormulaChanged: false,
      professionalOpinionProduced: false,
      certifiedValuationProduced: false,
      automatedInvestmentDecisionProduced: false,
    },
    humanDecisionRequired: true,
    transactionAuthorized: false,
    semantics: 'This vertical slice composes evidence, title, tenant, regulatory, financial, scenario/risk, professional-review and reliability outputs into an auditable analytical package. It does not fetch official data, provide regulated professional opinions, certify valuation, or authorize an investment transaction.',
  });
}

module.exports = {
  VERTICAL_SLICE_STATUS,
  buildAnalyticalVerticalSlice,
};
