'use strict';

const {
  ACTION_TYPE,
  createDecisionAction,
  buildDecisionActionRegister,
} = require('./index');

const DUE_DILIGENCE_ACTION_STATUS = Object.freeze({
  READY: 'READY',
  HOLD_DUE_DILIGENCE: 'HOLD_DUE_DILIGENCE',
  HOLD_ACTION_POLICY: 'HOLD_ACTION_POLICY',
});

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function requiredObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}

function mapDueDiligenceToDecisionAction({
  caseId,
  projectId,
  dueDiligence,
  actionPolicy,
  sourceDecisionRef,
} = {}) {
  const scopedCaseId = requiredString(caseId, 'caseId');
  const scopedProjectId = requiredString(projectId, 'projectId');
  requiredObject(dueDiligence, 'dueDiligence');
  requiredObject(actionPolicy, 'actionPolicy');
  const decisionRef = requiredString(sourceDecisionRef, 'sourceDecisionRef');

  if (dueDiligence.caseId && dueDiligence.caseId !== scopedCaseId) throw new Error('DUE_DILIGENCE_CASE_SCOPE_MISMATCH');
  if (dueDiligence.projectId && dueDiligence.projectId !== scopedProjectId) throw new Error('DUE_DILIGENCE_PROJECT_SCOPE_MISMATCH');

  const next = dueDiligence.nextBestAction;
  if (!next || typeof next !== 'object') {
    return Object.freeze({
      status: DUE_DILIGENCE_ACTION_STATUS.HOLD_DUE_DILIGENCE,
      reasonCodes: Object.freeze(['NEXT_BEST_DUE_DILIGENCE_ACTION_REQUIRED']),
      action: null,
      transactionAuthorized: false,
    });
  }

  const actionId = requiredString(actionPolicy.actionId, 'actionPolicy.actionId');
  const ownerId = requiredString(actionPolicy.ownerId, 'actionPolicy.ownerId');
  const type = actionPolicy.type;
  if (!Object.values(ACTION_TYPE).includes(type)) throw new TypeError(`invalid actionPolicy.type: ${type}`);
  const requiredEvidenceKeys = Array.isArray(actionPolicy.requiredEvidenceKeys)
    ? actionPolicy.requiredEvidenceKeys.map((value, index) => requiredString(value, `actionPolicy.requiredEvidenceKeys[${index}]`))
    : [];

  const action = createDecisionAction({
    actionId,
    caseId: scopedCaseId,
    projectId: scopedProjectId,
    type,
    description: requiredString(actionPolicy.description || next.question, 'actionPolicy.description'),
    ownerId,
    dueDate: actionPolicy.dueDate || null,
    requiresLicensedProfessional: Boolean(actionPolicy.requiresLicensedProfessional || next.professionalReviewType),
    requiredEvidenceKeys,
    sourceDecisionRef: decisionRef,
  });

  return Object.freeze({
    status: DUE_DILIGENCE_ACTION_STATUS.READY,
    reasonCodes: Object.freeze([]),
    dueDiligenceRef: next.id || null,
    priority: next.priority || null,
    blockingGate: next.blockingGate || null,
    professionalReviewType: next.professionalReviewType || null,
    action,
    transactionAuthorized: false,
    semantics: 'This bridge converts a caller-supplied next-best due diligence item into a governed decision action using explicit caller-supplied ownership and action policy. It does not invent owners, deadlines, evidence, professional opinions, or authorize a transaction.',
  });
}

function buildDueDiligenceActionRegister({ caseId, projectId, mappedActions = [] } = {}) {
  const scopedCaseId = requiredString(caseId, 'caseId');
  const scopedProjectId = requiredString(projectId, 'projectId');
  if (!Array.isArray(mappedActions)) throw new TypeError('mappedActions must be an array');
  const actions = mappedActions.map((item, index) => {
    requiredObject(item, `mappedActions[${index}]`);
    if (item.status !== DUE_DILIGENCE_ACTION_STATUS.READY || !item.action) throw new Error(`MAPPED_ACTION_${index}_NOT_READY`);
    return item.action;
  });
  return buildDecisionActionRegister({ caseId: scopedCaseId, projectId: scopedProjectId, actions });
}

module.exports = {
  DUE_DILIGENCE_ACTION_STATUS,
  mapDueDiligenceToDecisionAction,
  buildDueDiligenceActionRegister,
};
