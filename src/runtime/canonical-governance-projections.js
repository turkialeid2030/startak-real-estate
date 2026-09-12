'use strict';

const { WORKSPACE_STATUS } = require('../decision-intelligence/workspace');
const { buildDecisionActionRegister } = require('../decision-actions');
const {
  buildCommitteeDecisionDossier,
  DOSSIER_STATUS,
} = require('../investment-committee/decision-dossier');

function requiredObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
  return value;
}

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

/**
 * Produce a deliberately conservative Decision Intelligence projection from a
 * canonical in-app case workspace.
 *
 * This bridge does NOT manufacture evidence records, approved assumptions,
 * decision-quality scoring or AI outputs. A case with unresolved lifecycle
 * sections remains HOLD_STUDY. A structurally complete canonical case still
 * remains HOLD_AI_OUTPUTS until the dedicated Decision Intelligence workflow
 * supplies accepted Analyst / Challenger / Synthesizer outputs and its own
 * evidence/decision-quality records.
 */
function projectCanonicalWorkspaceToDecisionIntelligence(canonicalWorkspace) {
  requiredObject(canonicalWorkspace, 'canonicalWorkspace');
  const projectId = requiredString(canonicalWorkspace.projectId, 'canonicalWorkspace.projectId');
  const caseId = requiredString(canonicalWorkspace.caseId, 'canonicalWorkspace.caseId');
  requiredObject(canonicalWorkspace.orchestration, 'canonicalWorkspace.orchestration');

  const unresolved = Array.isArray(canonicalWorkspace.orchestration.unresolvedLifecycleSections)
    ? canonicalWorkspace.orchestration.unresolvedLifecycleSections.map(String)
    : [];
  const lifecycleReasons = Array.isArray(canonicalWorkspace.orchestration.reasonCodes)
    ? canonicalWorkspace.orchestration.reasonCodes.map(String)
    : unresolved.map((section) => `LIFECYCLE_GAP:${section}`);

  const status = unresolved.length
    ? WORKSPACE_STATUS.HOLD_STUDY
    : WORKSPACE_STATUS.HOLD_AI_OUTPUTS;
  const reasonCodes = unresolved.length
    ? lifecycleReasons
    : ['REQUIRED_AI_ROLE_OUTPUTS_MISSING', 'DECISION_INTELLIGENCE_RECORDS_NOT_SUPPLIED_BY_CANONICAL_CASE_PATH'];

  return freeze({
    schemaVersion: 1,
    projectId,
    caseId,
    status,
    reasonCodes,
    summary: {
      evidenceCount: 0,
      staleEvidenceCount: 0,
      conflictingEvidenceCount: 0,
      unverifiedEvidenceCount: 0,
      assumptionCount: 0,
      materialUnapprovedAssumptionCount: 0,
      acceptedAiRoleCount: 0,
      missingAiRoles: ['ANALYST', 'CHALLENGER', 'SYNTHESIZER'],
    },
    evidence: [],
    assumptions: [],
    ai: [],
    decisionQuality: {
      status,
      reliability: 'UNQUALIFIED_FOR_PROFESSIONAL_RELEASE',
      nextBestDueDiligence: unresolved.length
        ? { id: `LIFECYCLE:${unresolved[0]}`, priority: 'HIGH' }
        : { id: 'DECISION_INTELLIGENCE:COMPLETE_BOUNDED_REVIEW', priority: 'HIGH' },
      requiredActions: null,
    },
    sourceBoundary: 'CANONICAL_CASE_WORKSPACE_SAFE_PROJECTION',
    aiMayOverrideDeterministicResults: false,
    humanDecisionRequired: true,
    transactionAuthorized: false,
    semantics: 'Conservative projection only. No evidence, assumptions, decision-quality scores or AI outputs are inferred from the canonical case. Dedicated Decision Intelligence records are required before READY_FOR_REVIEW.',
  });
}

/**
 * Project the canonical case into an Investment Committee preparation dossier.
 * The empty action register is explicit, scoped and non-authorizing. Because the
 * conservative Decision Intelligence projection is never READY_FOR_REVIEW at
 * this boundary, the dossier must remain HOLD_WORKSPACE. A later controlled
 * workflow may supply a qualified Decision Intelligence workspace and action
 * register through a separate integration boundary; this function cannot be
 * used to bypass that work.
 */
function buildCanonicalCommitteePreparation(canonicalWorkspace) {
  const decisionWorkspace = projectCanonicalWorkspaceToDecisionIntelligence(canonicalWorkspace);
  const actionRegister = buildDecisionActionRegister({
    caseId: decisionWorkspace.caseId,
    projectId: decisionWorkspace.projectId,
    actions: [],
  });
  const committeeDossier = buildCommitteeDecisionDossier({
    caseId: decisionWorkspace.caseId,
    projectId: decisionWorkspace.projectId,
    workspace: decisionWorkspace,
    actionRegister,
    valuation: canonicalWorkspace.executableCase?.valuation || null,
    financial: canonicalWorkspace.executableCase?.financialModel || null,
  });

  if (committeeDossier.status !== DOSSIER_STATUS.HOLD_WORKSPACE) {
    throw new Error('CANONICAL_COMMITTEE_PROJECTION_MUST_HOLD_WORKSPACE');
  }

  return freeze({
    schemaVersion: 1,
    projectId: decisionWorkspace.projectId,
    caseId: decisionWorkspace.caseId,
    decisionWorkspace,
    actionRegister,
    committeeDossier,
    authority: {
      professionalValuationAuthorityEstablished: false,
      committeeDecisionRecorded: false,
      releaseAuthorized: false,
      mergeAuthorized: false,
      deploymentAuthorized: false,
      transactionAuthorized: false,
    },
    humanDecisionRequired: true,
    semantics: 'Investment Committee preparation projection only. The dossier remains held until a separately qualified Decision Intelligence workspace and governed action workflow are supplied; no vote, approval or transaction authority is created here.',
  });
}

module.exports = {
  projectCanonicalWorkspaceToDecisionIntelligence,
  buildCanonicalCommitteePreparation,
};
