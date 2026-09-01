'use strict';

const { WORKSPACE_STATUS } = require('../decision-intelligence/workspace');
const { ACTION_STATUS } = require('../decision-actions');

const DOSSIER_STATUS = Object.freeze({
  READY_FOR_COMMITTEE_PREPARATION: 'READY_FOR_COMMITTEE_PREPARATION',
  HOLD_WORKSPACE: 'HOLD_WORKSPACE',
  HOLD_OPEN_CRITICAL_ACTIONS: 'HOLD_OPEN_CRITICAL_ACTIONS',
  HOLD_SCOPE_MISMATCH: 'HOLD_SCOPE_MISMATCH',
});

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function requiredObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}

function buildCommitteeDecisionDossier({
  caseId,
  projectId,
  workspace,
  actionRegister,
  decisionThresholds = null,
  scenarioRisk = null,
  valuation = null,
  financial = null,
} = {}) {
  const scopedCaseId = requiredString(caseId, 'caseId');
  const scopedProjectId = requiredString(projectId, 'projectId');
  requiredObject(workspace, 'workspace');
  requiredObject(actionRegister, 'actionRegister');

  for (const [name, component] of Object.entries({ workspace, actionRegister })) {
    if (component.caseId !== scopedCaseId || component.projectId !== scopedProjectId) {
      const error = new Error(`${name.toUpperCase()}_SCOPE_MISMATCH`);
      error.code = DOSSIER_STATUS.HOLD_SCOPE_MISMATCH;
      throw error;
    }
  }

  const optionalComponents = { decisionThresholds, scenarioRisk, valuation, financial };
  for (const [name, component] of Object.entries(optionalComponents)) {
    if (!component) continue;
    requiredObject(component, name);
    if ((component.caseId && component.caseId !== scopedCaseId) || (component.projectId && component.projectId !== scopedProjectId)) {
      const error = new Error(`${name.toUpperCase()}_SCOPE_MISMATCH`);
      error.code = DOSSIER_STATUS.HOLD_SCOPE_MISMATCH;
      throw error;
    }
  }

  const openActions = (actionRegister.actions || []).filter((action) => action.status !== ACTION_STATUS.CLOSED);
  const criticalActionIds = new Set();
  const nextBest = workspace.decisionQuality && workspace.decisionQuality.nextBestDueDiligence;
  if (nextBest && nextBest.priority === 'CRITICAL' && nextBest.id) {
    for (const action of openActions) {
      if (action.sourceDecisionRef === nextBest.id || action.actionId === nextBest.id) criticalActionIds.add(action.actionId);
    }
  }

  let status = DOSSIER_STATUS.READY_FOR_COMMITTEE_PREPARATION;
  const reasonCodes = [];
  if (workspace.status !== WORKSPACE_STATUS.READY_FOR_REVIEW) {
    status = DOSSIER_STATUS.HOLD_WORKSPACE;
    reasonCodes.push(`WORKSPACE_${String(workspace.status || 'UNKNOWN')}`);
  } else if (criticalActionIds.size) {
    status = DOSSIER_STATUS.HOLD_OPEN_CRITICAL_ACTIONS;
    reasonCodes.push('CRITICAL_DUE_DILIGENCE_ACTIONS_REMAIN_OPEN');
  }

  const aiOutputs = Array.isArray(workspace.ai) ? workspace.ai : [];
  const byRole = Object.fromEntries(aiOutputs.map((item) => [item.role, item]));

  return Object.freeze({
    schemaVersion: 1,
    caseId: scopedCaseId,
    projectId: scopedProjectId,
    status,
    reasonCodes: Object.freeze(reasonCodes),
    readyForHumanCommittee: status === DOSSIER_STATUS.READY_FOR_COMMITTEE_PREPARATION,
    executiveSummary: Object.freeze({
      workspaceStatus: workspace.status,
      decisionReliability: workspace.decisionQuality?.reliability || null,
      nextBestDueDiligence: nextBest || null,
      evidenceSummary: workspace.summary || null,
      openActionCount: openActions.length,
      criticalOpenActionIds: Object.freeze([...criticalActionIds]),
    }),
    evidenceAndAssumptions: Object.freeze({
      evidence: Object.freeze([...(workspace.evidence || [])]),
      assumptions: Object.freeze([...(workspace.assumptions || [])]),
    }),
    aiReview: Object.freeze({
      analyst: byRole.ANALYST || null,
      challenger: byRole.CHALLENGER || null,
      synthesizer: byRole.SYNTHESIZER || null,
      numericConfidence: null,
    }),
    analyticalAttachments: Object.freeze({
      decisionThresholds: decisionThresholds || null,
      scenarioRisk: scenarioRisk || null,
      valuation: valuation || null,
      financial: financial || null,
    }),
    actionRegister,
    humanDecisionRequired: true,
    automatedDecision: false,
    transactionAuthorized: false,
    semantics: 'This dossier projection assembles already-supplied analytical, evidence, AI-review, and action-control material for human investment-committee preparation. It does not cast votes, issue a certified valuation or legal opinion, approve a transaction, or replace committee governance.',
  });
}

module.exports = {
  DOSSIER_STATUS,
  buildCommitteeDecisionDossier,
};
