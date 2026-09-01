'use strict';

const assert = require('assert');
const { ACTION_TYPE, ACTION_STATUS } = require('../../src/decision-actions');
const {
  DUE_DILIGENCE_ACTION_STATUS,
  mapDueDiligenceToDecisionAction,
  buildDueDiligenceActionRegister,
} = require('../../src/decision-actions/due-diligence-bridge');
const { WORKSPACE_STATUS } = require('../../src/decision-intelligence/workspace');
const {
  DOSSIER_STATUS,
  buildCommitteeDecisionDossier,
} = require('../../src/investment-committee/decision-dossier');

function baselineDueDiligence(priority = 'HIGH') {
  return {
    caseId: 'case-ic-1',
    projectId: 'project-ic-1',
    nextBestAction: {
      id: 'dd-1',
      question: 'Resolve title evidence gap',
      priority,
      blockingGate: 'TITLE',
      professionalReviewType: 'LEGAL',
    },
  };
}

(function bridgeCreatesGovernedAction() {
  const mapped = mapDueDiligenceToDecisionAction({
    caseId: 'case-ic-1',
    projectId: 'project-ic-1',
    dueDiligence: baselineDueDiligence(),
    actionPolicy: {
      actionId: 'action-1',
      ownerId: 'owner-1',
      type: ACTION_TYPE.LEGAL_REVIEW,
      requiredEvidenceKeys: ['title_verified'],
    },
    sourceDecisionRef: 'decision-quality-v1',
  });
  assert.strictEqual(mapped.status, DUE_DILIGENCE_ACTION_STATUS.READY);
  assert.strictEqual(mapped.action.status, ACTION_STATUS.OPEN);
  assert.strictEqual(mapped.action.requiresLicensedProfessional, true);
  assert.strictEqual(mapped.transactionAuthorized, false);
})();

(function missingNextActionFailsClosed() {
  const mapped = mapDueDiligenceToDecisionAction({
    caseId: 'case-ic-1',
    projectId: 'project-ic-1',
    dueDiligence: { caseId: 'case-ic-1', projectId: 'project-ic-1' },
    actionPolicy: { actionId: 'a', ownerId: 'o', type: ACTION_TYPE.OTHER },
    sourceDecisionRef: 'decision-quality-v1',
  });
  assert.strictEqual(mapped.status, DUE_DILIGENCE_ACTION_STATUS.HOLD_DUE_DILIGENCE);
})();

(function registerAndDossierReadyPath() {
  const mapped = mapDueDiligenceToDecisionAction({
    caseId: 'case-ic-1',
    projectId: 'project-ic-1',
    dueDiligence: baselineDueDiligence('HIGH'),
    actionPolicy: { actionId: 'action-1', ownerId: 'owner-1', type: ACTION_TYPE.LEGAL_REVIEW },
    sourceDecisionRef: 'decision-quality-v1',
  });
  const register = buildDueDiligenceActionRegister({
    caseId: 'case-ic-1',
    projectId: 'project-ic-1',
    mappedActions: [mapped],
  });
  const workspace = {
    caseId: 'case-ic-1',
    projectId: 'project-ic-1',
    status: WORKSPACE_STATUS.READY_FOR_REVIEW,
    summary: { evidenceCount: 2 },
    evidence: [],
    assumptions: [],
    ai: [
      { role: 'ANALYST', narrative: 'a' },
      { role: 'CHALLENGER', narrative: 'c' },
      { role: 'SYNTHESIZER', narrative: 's' },
    ],
    decisionQuality: {
      reliability: 'HIGH',
      nextBestDueDiligence: baselineDueDiligence('HIGH').nextBestAction,
    },
  };
  const dossier = buildCommitteeDecisionDossier({
    caseId: 'case-ic-1',
    projectId: 'project-ic-1',
    workspace,
    actionRegister: register,
  });
  assert.strictEqual(dossier.status, DOSSIER_STATUS.READY_FOR_COMMITTEE_PREPARATION);
  assert.strictEqual(dossier.readyForHumanCommittee, true);
  assert.strictEqual(dossier.executiveSummary.openActionCount, 1);
  assert.strictEqual(dossier.transactionAuthorized, false);
})();

(function criticalOpenActionBlocksCommitteePreparation() {
  const mapped = mapDueDiligenceToDecisionAction({
    caseId: 'case-ic-1',
    projectId: 'project-ic-1',
    dueDiligence: baselineDueDiligence('CRITICAL'),
    actionPolicy: { actionId: 'action-critical', ownerId: 'owner-1', type: ACTION_TYPE.LEGAL_REVIEW },
    sourceDecisionRef: 'dd-1',
  });
  const register = buildDueDiligenceActionRegister({
    caseId: 'case-ic-1',
    projectId: 'project-ic-1',
    mappedActions: [mapped],
  });
  const workspace = {
    caseId: 'case-ic-1',
    projectId: 'project-ic-1',
    status: WORKSPACE_STATUS.READY_FOR_REVIEW,
    summary: {}, evidence: [], assumptions: [], ai: [],
    decisionQuality: {
      reliability: 'MODERATE',
      nextBestDueDiligence: baselineDueDiligence('CRITICAL').nextBestAction,
    },
  };
  const dossier = buildCommitteeDecisionDossier({
    caseId: 'case-ic-1',
    projectId: 'project-ic-1',
    workspace,
    actionRegister: register,
  });
  assert.strictEqual(dossier.status, DOSSIER_STATUS.HOLD_OPEN_CRITICAL_ACTIONS);
  assert.strictEqual(dossier.readyForHumanCommittee, false);
})();

(function workspaceHoldPropagates() {
  const register = { caseId: 'case-ic-1', projectId: 'project-ic-1', actions: [] };
  const workspace = {
    caseId: 'case-ic-1', projectId: 'project-ic-1', status: WORKSPACE_STATUS.HOLD_EVIDENCE,
    summary: {}, evidence: [], assumptions: [], ai: [], decisionQuality: {},
  };
  const dossier = buildCommitteeDecisionDossier({ caseId: 'case-ic-1', projectId: 'project-ic-1', workspace, actionRegister: register });
  assert.strictEqual(dossier.status, DOSSIER_STATUS.HOLD_WORKSPACE);
})();

(function scopeIsolationFailsClosed() {
  const register = { caseId: 'case-ic-1', projectId: 'project-ic-1', actions: [] };
  const workspace = { caseId: 'foreign', projectId: 'project-ic-1', status: WORKSPACE_STATUS.READY_FOR_REVIEW, summary: {}, evidence: [], assumptions: [], ai: [], decisionQuality: {} };
  assert.throws(() => buildCommitteeDecisionDossier({ caseId: 'case-ic-1', projectId: 'project-ic-1', workspace, actionRegister: register }), /SCOPE_MISMATCH/);
})();

console.log('DUE_DILIGENCE_ACTIONS_IC_DOSSIER_V1=PASS');
