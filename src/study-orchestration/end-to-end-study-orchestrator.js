'use strict';

const { READINESS_STATUS } = require('../document-intelligence/contracts');
const { ORCHESTRATION_STATUS: EVIDENCE_ORCHESTRATION_STATUS } = require('../project-model/universal-evidence-orchestrator');
const { ORCHESTRATION_STATUS: DECISION_QUALITY_STATUS } = require('../decision-quality/orchestrator');
const { AI_STAGE_STATUS } = require('../decision-intelligence/ai-expert-orchestrator');

const STUDY_ORCHESTRATION_STATUS = Object.freeze({
  READY_FOR_AI_AND_HUMAN_REVIEW: 'READY_FOR_AI_AND_HUMAN_REVIEW',
  HOLD_SCOPE_MISMATCH: 'HOLD_SCOPE_MISMATCH',
  HOLD_EVIDENCE: 'HOLD_EVIDENCE',
  HOLD_ANALYTICAL_ENGINES: 'HOLD_ANALYTICAL_ENGINES',
  HOLD_DECISION_CONTROL: 'HOLD_DECISION_CONTROL',
  HOLD_DECISION_QUALITY: 'HOLD_DECISION_QUALITY',
  HOLD_AI: 'HOLD_AI',
  HOLD_PROFESSIONAL_REVIEW: 'HOLD_PROFESSIONAL_REVIEW',
  HOLD_IC_DOSSIER: 'HOLD_IC_DOSSIER',
});

const REQUIRED_ANALYTICAL_STAGES = Object.freeze([
  'property',
  'tenant',
  'regulatory',
  'valuation',
  'financial',
  'scenarioRisk',
  'decisionThresholds',
]);

function requireString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function requireObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}

function assertScoped(component, caseId, projectId, field) {
  requireObject(component, field);
  if (component.caseId !== caseId || component.projectId !== projectId) {
    const error = new Error(`${field.toUpperCase()}_SCOPE_MISMATCH`);
    error.code = 'STUDY_SCOPE_MISMATCH';
    throw error;
  }
}

function normalizeAnalyticalStages(stages, caseId, projectId) {
  requireObject(stages, 'analyticalStages');
  const out = {};
  for (const name of REQUIRED_ANALYTICAL_STAGES) {
    const stage = requireObject(stages[name], `analyticalStages.${name}`);
    assertScoped(stage, caseId, projectId, `analyticalStages.${name}`);
    out[name] = Object.freeze({
      status: stage.status || null,
      readyForDecisionControl: stage.readyForDecisionControl === true,
      evidenceRefs: Object.freeze(Array.isArray(stage.evidenceRefs) ? [...new Set(stage.evidenceRefs.map(String))] : []),
    });
  }
  return Object.freeze(out);
}

function buildEndToEndStudyOrchestration({
  caseId,
  projectId,
  evidenceOrchestration,
  analyticalStages,
  decisionControl,
  decisionQuality,
  aiStages = [],
  professionalReview,
  icDossier,
} = {}) {
  const normalizedCaseId = requireString(caseId, 'caseId');
  const normalizedProjectId = requireString(projectId, 'projectId');
  assertScoped(evidenceOrchestration, normalizedCaseId, normalizedProjectId, 'evidenceOrchestration');
  assertScoped(decisionControl, normalizedCaseId, normalizedProjectId, 'decisionControl');
  assertScoped(decisionQuality, normalizedCaseId, normalizedProjectId, 'decisionQuality');
  assertScoped(professionalReview, normalizedCaseId, normalizedProjectId, 'professionalReview');
  assertScoped(icDossier, normalizedCaseId, normalizedProjectId, 'icDossier');
  if (!Array.isArray(aiStages)) throw new TypeError('aiStages must be an array');
  for (let i = 0; i < aiStages.length; i += 1) assertScoped(aiStages[i], normalizedCaseId, normalizedProjectId, `aiStages[${i}]`);

  const normalizedStages = normalizeAnalyticalStages(analyticalStages, normalizedCaseId, normalizedProjectId);
  const reasonCodes = [];
  let status = STUDY_ORCHESTRATION_STATUS.READY_FOR_AI_AND_HUMAN_REVIEW;

  const evidenceReady = evidenceOrchestration.orchestrationStatus === EVIDENCE_ORCHESTRATION_STATUS.PROCESSED
    && evidenceOrchestration.readiness?.status === READINESS_STATUS.READY_FOR_UNDERWRITING_INPUT;
  const analyticalReady = REQUIRED_ANALYTICAL_STAGES.every((name) => normalizedStages[name].readyForDecisionControl);
  const decisionControlReady = decisionControl.readyForDecisionQuality === true
    && decisionControl.professionalReviewRequired !== true;
  const decisionQualityReady = [
    DECISION_QUALITY_STATUS.READY_FOR_HUMAN_REVIEW,
    DECISION_QUALITY_STATUS.DUE_DILIGENCE_REQUIRED,
  ].includes(decisionQuality.status);
  const aiBlocked = aiStages.some((stage) => stage.status !== AI_STAGE_STATUS.READY_FOR_MODEL_CALL
    && stage.status !== AI_STAGE_STATUS.OUTPUT_ACCEPTED);
  const professionalReviewReady = professionalReview.required !== true || professionalReview.completed === true;
  const icReady = icDossier.readyForHumanCommittee === true;

  if (!evidenceReady) {
    status = STUDY_ORCHESTRATION_STATUS.HOLD_EVIDENCE;
    reasonCodes.push('EVIDENCE_NOT_READY_FOR_UNDERWRITING');
  } else if (!analyticalReady) {
    status = STUDY_ORCHESTRATION_STATUS.HOLD_ANALYTICAL_ENGINES;
    for (const name of REQUIRED_ANALYTICAL_STAGES) {
      if (!normalizedStages[name].readyForDecisionControl) reasonCodes.push(`ANALYTICAL_STAGE_${name.toUpperCase()}_NOT_READY`);
    }
  } else if (!decisionControlReady) {
    status = STUDY_ORCHESTRATION_STATUS.HOLD_DECISION_CONTROL;
    reasonCodes.push('DECISION_CONTROL_NOT_READY');
  } else if (!decisionQualityReady) {
    status = STUDY_ORCHESTRATION_STATUS.HOLD_DECISION_QUALITY;
    reasonCodes.push(`DECISION_QUALITY_${String(decisionQuality.status || 'UNKNOWN')}`);
  } else if (aiBlocked) {
    status = STUDY_ORCHESTRATION_STATUS.HOLD_AI;
    reasonCodes.push('AI_STAGE_NOT_READY_OR_ACCEPTED');
  } else if (!professionalReviewReady) {
    status = STUDY_ORCHESTRATION_STATUS.HOLD_PROFESSIONAL_REVIEW;
    reasonCodes.push('REQUIRED_PROFESSIONAL_REVIEW_NOT_COMPLETED');
  } else if (!icReady) {
    status = STUDY_ORCHESTRATION_STATUS.HOLD_IC_DOSSIER;
    reasonCodes.push('IC_DOSSIER_NOT_READY_FOR_HUMAN_COMMITTEE');
  }

  return Object.freeze({
    schemaVersion: 1,
    caseId: normalizedCaseId,
    projectId: normalizedProjectId,
    status,
    reasonCodes: Object.freeze(reasonCodes),
    gates: Object.freeze({
      evidenceReady,
      analyticalReady,
      decisionControlReady,
      decisionQualityReady,
      aiReady: !aiBlocked,
      professionalReviewReady,
      icDossierReady: icReady,
    }),
    analyticalStages: normalizedStages,
    nextBestDueDiligenceActionId: decisionQuality.requiredActions?.nextBestDueDiligenceActionId || null,
    humanDecisionRequired: true,
    transactionAuthorized: false,
    aiMayOverrideDeterministicResults: false,
    productionExecutionClaimed: false,
    semantics: 'This fail-closed orchestration gate connects evidence readiness, analytical engines, decision control, decision quality, bounded AI stages, professional review, and the investment-committee dossier for one case/project scope. It does not calculate financial metrics itself, invent evidence, replace licensed professional review, issue an investment recommendation, authorize a transaction, or prove production execution.',
  });
}

module.exports = {
  STUDY_ORCHESTRATION_STATUS,
  REQUIRED_ANALYTICAL_STAGES,
  buildEndToEndStudyOrchestration,
};
