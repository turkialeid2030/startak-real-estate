'use strict';

const { buildDecisionFeedback, AI_OPINION_STATUS } = require('./feedback-loop');
const { createDecisionReliabilityScorecard, RELIABILITY_LEVEL } = require('./reliability-scorecard');
const { buildNextBestDueDiligence, PRIORITY_LEVEL } = require('./next-best-due-diligence');

const ORCHESTRATION_STATUS = Object.freeze({
  READY_FOR_HUMAN_REVIEW: 'READY_FOR_HUMAN_REVIEW',
  HOLD_STALE_AI_OPINION: 'HOLD_STALE_AI_OPINION',
  HOLD_RELIABILITY: 'HOLD_RELIABILITY',
  DUE_DILIGENCE_REQUIRED: 'DUE_DILIGENCE_REQUIRED',
});

function assertScope(component, caseId, projectId, name) {
  if (!component || typeof component !== 'object') throw new TypeError(`${name} must be an object`);
  if (component.caseId !== caseId) throw new Error(`${name.toUpperCase()}_CASE_SCOPE_MISMATCH`);
  if (component.projectId !== projectId) throw new Error(`${name.toUpperCase()}_PROJECT_SCOPE_MISMATCH`);
}

function buildDecisionQualityOrchestration({
  previousSnapshot,
  currentSnapshot,
  reliabilityDimensions,
  dueDiligenceCandidates,
}) {
  const feedback = buildDecisionFeedback({ previous: previousSnapshot, current: currentSnapshot });
  const { caseId, projectId } = feedback;

  const reliability = createDecisionReliabilityScorecard({
    caseId,
    projectId,
    dimensions: reliabilityDimensions,
  });

  const dueDiligence = buildNextBestDueDiligence({
    caseId,
    projectId,
    candidates: dueDiligenceCandidates,
  });

  assertScope(reliability, caseId, projectId, 'reliability');
  assertScope(dueDiligence, caseId, projectId, 'dueDiligence');

  const staleAi = feedback.aiOpinion.status === AI_OPINION_STATUS.STALE_REANALYSIS_REQUIRED
    || (feedback.materialUpstreamChange && feedback.aiOpinion.status === AI_OPINION_STATUS.NOT_PROVIDED);
  const weakReliability = reliability.overallReliability === RELIABILITY_LEVEL.LOW
    || reliability.overallReliability === RELIABILITY_LEVEL.INSUFFICIENT;
  const criticalDiligence = dueDiligence.nextBestAction.priority === PRIORITY_LEVEL.CRITICAL;

  let status = ORCHESTRATION_STATUS.READY_FOR_HUMAN_REVIEW;
  if (staleAi) status = ORCHESTRATION_STATUS.HOLD_STALE_AI_OPINION;
  else if (weakReliability) status = ORCHESTRATION_STATUS.HOLD_RELIABILITY;
  else if (criticalDiligence) status = ORCHESTRATION_STATUS.DUE_DILIGENCE_REQUIRED;

  return Object.freeze({
    schemaVersion: 1,
    caseId,
    projectId,
    status,
    feedback,
    reliability,
    dueDiligence,
    requiredActions: Object.freeze({
      refreshAIDossier: feedback.reanalysis.refreshAIDossier,
      refreshReliabilityScorecard: feedback.reanalysis.refreshReliabilityScorecard,
      humanReviewRequired: true,
      nextBestDueDiligenceActionId: dueDiligence.nextBestAction.id,
      professionalReviewType: dueDiligence.nextBestAction.professionalReviewType,
      blockingGate: dueDiligence.nextBestAction.blockingGate,
    }),
    aiMayOverrideDeterministicResults: false,
    humanDecisionRequired: true,
    transactionAuthorized: false,
    numericConfidenceScore: null,
    semantics: 'This orchestration layer combines deterministic change-impact feedback, qualitative reliability, and due-diligence prioritization. It does not generate facts, alter financial calculations, create a certified valuation, provide a legal opinion, create a numeric AI confidence score, or authorize a transaction. Material upstream changes invalidate silent reuse of stale AI reasoning and remain subject to human and professional review.',
  });
}

module.exports = {
  ORCHESTRATION_STATUS,
  buildDecisionQualityOrchestration,
};
