'use strict';

const CHANGE_KIND = Object.freeze({
  EVIDENCE_CHANGED: 'EVIDENCE_CHANGED',
  INPUTS_CHANGED: 'INPUTS_CHANGED',
  RULES_CHANGED: 'RULES_CHANGED',
  CALCULATION_CHANGED: 'CALCULATION_CHANGED',
  DECISION_CONTROL_CHANGED: 'DECISION_CONTROL_CHANGED',
  RELIABILITY_CHANGED: 'RELIABILITY_CHANGED',
  PROFESSIONAL_REVIEW_CHANGED: 'PROFESSIONAL_REVIEW_CHANGED',
});

const AI_OPINION_STATUS = Object.freeze({
  CURRENT: 'CURRENT',
  STALE_REANALYSIS_REQUIRED: 'STALE_REANALYSIS_REQUIRED',
  NOT_PROVIDED: 'NOT_PROVIDED',
});

function assertNonEmpty(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`);
}

function normalizeHash(value) {
  if (value == null) return null;
  const out = String(value).trim();
  return out || null;
}

function normalizeSnapshot(snapshot, name) {
  if (!snapshot || typeof snapshot !== 'object') throw new TypeError(`${name} must be an object`);
  assertNonEmpty(snapshot.caseId, `${name}.caseId`);
  assertNonEmpty(snapshot.projectId, `${name}.projectId`);
  assertNonEmpty(snapshot.versionId, `${name}.versionId`);

  return Object.freeze({
    caseId: snapshot.caseId,
    projectId: snapshot.projectId,
    versionId: snapshot.versionId,
    evidenceHash: normalizeHash(snapshot.evidenceHash),
    inputHash: normalizeHash(snapshot.inputHash),
    regulatoryRuleHash: normalizeHash(snapshot.regulatoryRuleHash),
    calculationHash: normalizeHash(snapshot.calculationHash),
    decisionControlStatus: snapshot.decisionControlStatus == null ? null : String(snapshot.decisionControlStatus),
    reliabilityLevel: snapshot.reliabilityLevel == null ? null : String(snapshot.reliabilityLevel),
    professionalReviewStatus: snapshot.professionalReviewStatus == null ? null : String(snapshot.professionalReviewStatus),
    aiOpinionVersionId: snapshot.aiOpinionVersionId == null ? null : String(snapshot.aiOpinionVersionId),
  });
}

function changed(a, b) {
  return a !== b;
}

function buildDecisionFeedback({ previous, current }) {
  const before = normalizeSnapshot(previous, 'previous');
  const after = normalizeSnapshot(current, 'current');

  if (before.caseId !== after.caseId) throw new Error('CASE_SCOPE_MISMATCH');
  if (before.projectId !== after.projectId) throw new Error('PROJECT_SCOPE_MISMATCH');
  if (before.versionId === after.versionId) throw new Error('VERSION_ID_MUST_ADVANCE');

  const changes = [];
  if (changed(before.evidenceHash, after.evidenceHash)) changes.push(CHANGE_KIND.EVIDENCE_CHANGED);
  if (changed(before.inputHash, after.inputHash)) changes.push(CHANGE_KIND.INPUTS_CHANGED);
  if (changed(before.regulatoryRuleHash, after.regulatoryRuleHash)) changes.push(CHANGE_KIND.RULES_CHANGED);
  if (changed(before.calculationHash, after.calculationHash)) changes.push(CHANGE_KIND.CALCULATION_CHANGED);
  if (changed(before.decisionControlStatus, after.decisionControlStatus)) changes.push(CHANGE_KIND.DECISION_CONTROL_CHANGED);
  if (changed(before.reliabilityLevel, after.reliabilityLevel)) changes.push(CHANGE_KIND.RELIABILITY_CHANGED);
  if (changed(before.professionalReviewStatus, after.professionalReviewStatus)) changes.push(CHANGE_KIND.PROFESSIONAL_REVIEW_CHANGED);

  const materialUpstreamChange = changes.some((kind) => [
    CHANGE_KIND.EVIDENCE_CHANGED,
    CHANGE_KIND.INPUTS_CHANGED,
    CHANGE_KIND.RULES_CHANGED,
    CHANGE_KIND.CALCULATION_CHANGED,
    CHANGE_KIND.DECISION_CONTROL_CHANGED,
    CHANGE_KIND.RELIABILITY_CHANGED,
    CHANGE_KIND.PROFESSIONAL_REVIEW_CHANGED,
  ].includes(kind));

  const reanalysis = Object.freeze({
    reRunEvidenceReconciliation: changes.includes(CHANGE_KIND.EVIDENCE_CHANGED),
    reRunRegulatoryAssessment: changes.includes(CHANGE_KIND.EVIDENCE_CHANGED) || changes.includes(CHANGE_KIND.RULES_CHANGED),
    reRunFinancialCalculation: changes.includes(CHANGE_KIND.INPUTS_CHANGED) || changes.includes(CHANGE_KIND.CALCULATION_CHANGED),
    reRunDecisionControl: materialUpstreamChange,
    refreshReliabilityScorecard: materialUpstreamChange,
    refreshAIDossier: materialUpstreamChange,
    humanReviewRequired: materialUpstreamChange,
  });

  const priorAiOpinionPresent = Boolean(before.aiOpinionVersionId);
  const currentAiOpinionPresent = Boolean(after.aiOpinionVersionId);
  const aiOpinionStatus = !currentAiOpinionPresent
    ? AI_OPINION_STATUS.NOT_PROVIDED
    : materialUpstreamChange && after.aiOpinionVersionId === before.aiOpinionVersionId
      ? AI_OPINION_STATUS.STALE_REANALYSIS_REQUIRED
      : AI_OPINION_STATUS.CURRENT;

  return Object.freeze({
    schemaVersion: 1,
    caseId: after.caseId,
    projectId: after.projectId,
    previousVersionId: before.versionId,
    currentVersionId: after.versionId,
    changes: Object.freeze(changes),
    materialUpstreamChange,
    reanalysis,
    aiOpinion: Object.freeze({
      priorOpinionPresent: priorAiOpinionPresent,
      currentOpinionPresent: currentAiOpinionPresent,
      status: aiOpinionStatus,
      mayReusePriorOpinion: !materialUpstreamChange,
      requiresFreshOpinion: materialUpstreamChange,
    }),
    transactionAuthorized: false,
    semantics: 'A material upstream change invalidates silent reuse of prior decision-support reasoning. The loop records change impact and required re-analysis only; it does not invent facts, alter approved assumptions, authorize a transaction, or substitute for professional or human review.',
  });
}

module.exports = {
  CHANGE_KIND,
  AI_OPINION_STATUS,
  buildDecisionFeedback,
};
