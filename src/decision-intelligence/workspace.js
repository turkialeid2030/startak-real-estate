'use strict';

const { STUDY_ORCHESTRATION_STATUS } = require('../study-orchestration/end-to-end-study-orchestrator');
const { AI_ROLE, AI_STAGE_STATUS } = require('./ai-expert-orchestrator');

const WORKSPACE_STATUS = Object.freeze({
  READY_FOR_REVIEW: 'READY_FOR_REVIEW',
  HOLD_STUDY: 'HOLD_STUDY',
  HOLD_EVIDENCE: 'HOLD_EVIDENCE',
  HOLD_AI_OUTPUTS: 'HOLD_AI_OUTPUTS',
});

const RECORD_KIND = Object.freeze({
  EVIDENCE: 'EVIDENCE',
  ASSUMPTION: 'ASSUMPTION',
});

function nonEmpty(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function object(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}

function assertScope(component, caseId, projectId, field) {
  object(component, field);
  if (component.caseId !== caseId || component.projectId !== projectId) throw new Error(`${field.toUpperCase()}_SCOPE_MISMATCH`);
}

function normalizeEvidenceRecord(raw, caseId, projectId, index) {
  object(raw, `evidenceRecords[${index}]`);
  if (raw.caseId !== caseId || raw.projectId !== projectId) throw new Error('EVIDENCE_RECORD_SCOPE_MISMATCH');
  return Object.freeze({
    kind: RECORD_KIND.EVIDENCE,
    id: nonEmpty(raw.id, `evidenceRecords[${index}].id`),
    domain: nonEmpty(raw.domain, `evidenceRecords[${index}].domain`),
    label: nonEmpty(raw.label, `evidenceRecords[${index}].label`),
    sourceRef: nonEmpty(raw.sourceRef, `evidenceRecords[${index}].sourceRef`),
    status: nonEmpty(raw.status, `evidenceRecords[${index}].status`),
    versionId: raw.versionId == null ? null : nonEmpty(raw.versionId, `evidenceRecords[${index}].versionId`),
    effectiveAt: raw.effectiveAt == null ? null : nonEmpty(raw.effectiveAt, `evidenceRecords[${index}].effectiveAt`),
    stale: raw.stale === true,
    conflict: raw.conflict === true,
    verified: raw.verified === true,
  });
}

function normalizeAssumptionRecord(raw, caseId, projectId, index) {
  object(raw, `assumptionRecords[${index}]`);
  if (raw.caseId !== caseId || raw.projectId !== projectId) throw new Error('ASSUMPTION_RECORD_SCOPE_MISMATCH');
  return Object.freeze({
    kind: RECORD_KIND.ASSUMPTION,
    id: nonEmpty(raw.id, `assumptionRecords[${index}].id`),
    domain: nonEmpty(raw.domain, `assumptionRecords[${index}].domain`),
    label: nonEmpty(raw.label, `assumptionRecords[${index}].label`),
    valueDisplay: nonEmpty(raw.valueDisplay, `assumptionRecords[${index}].valueDisplay`),
    basis: nonEmpty(raw.basis, `assumptionRecords[${index}].basis`),
    evidenceRefs: Object.freeze(Array.isArray(raw.evidenceRefs) ? [...new Set(raw.evidenceRefs.map(String).filter(Boolean))] : []),
    material: raw.material === true,
    sensitivityRequired: raw.sensitivityRequired === true,
    approved: raw.approved === true,
  });
}

function normalizeAiOutput(raw, caseId, projectId, index) {
  object(raw, `aiOutputs[${index}]`);
  if (raw.caseId !== caseId || raw.projectId !== projectId) throw new Error('AI_OUTPUT_SCOPE_MISMATCH');
  if (!Object.values(AI_ROLE).includes(raw.role)) throw new Error(`UNSUPPORTED_AI_ROLE: ${raw.role}`);
  return Object.freeze({
    role: raw.role,
    status: nonEmpty(raw.status, `aiOutputs[${index}].status`),
    narrative: typeof raw.narrative === 'string' ? raw.narrative : '',
    citedEvidenceRefs: Object.freeze(Array.isArray(raw.citedEvidenceRefs) ? [...new Set(raw.citedEvidenceRefs.map(String).filter(Boolean))] : []),
    uncertainties: Object.freeze(Array.isArray(raw.uncertainties) ? raw.uncertainties.map(String) : []),
    disagreements: Object.freeze(Array.isArray(raw.disagreements) ? raw.disagreements.map(String) : []),
    diligenceSuggestions: Object.freeze(Array.isArray(raw.diligenceSuggestions) ? raw.diligenceSuggestions.map(String) : []),
  });
}

function buildDecisionIntelligenceWorkspace({
  caseId,
  projectId,
  studyOrchestration,
  decisionQuality,
  evidenceRecords = [],
  assumptionRecords = [],
  aiOutputs = [],
} = {}) {
  const scopedCaseId = nonEmpty(caseId, 'caseId');
  const scopedProjectId = nonEmpty(projectId, 'projectId');
  assertScope(studyOrchestration, scopedCaseId, scopedProjectId, 'studyOrchestration');
  assertScope(decisionQuality, scopedCaseId, scopedProjectId, 'decisionQuality');
  if (!Array.isArray(evidenceRecords)) throw new TypeError('evidenceRecords must be an array');
  if (!Array.isArray(assumptionRecords)) throw new TypeError('assumptionRecords must be an array');
  if (!Array.isArray(aiOutputs)) throw new TypeError('aiOutputs must be an array');

  const evidence = Object.freeze(evidenceRecords.map((item, index) => normalizeEvidenceRecord(item, scopedCaseId, scopedProjectId, index)));
  const assumptions = Object.freeze(assumptionRecords.map((item, index) => normalizeAssumptionRecord(item, scopedCaseId, scopedProjectId, index)));
  const ai = Object.freeze(aiOutputs.map((item, index) => normalizeAiOutput(item, scopedCaseId, scopedProjectId, index)));

  const duplicateIds = [];
  const ids = new Set();
  for (const item of [...evidence, ...assumptions]) {
    if (ids.has(item.id)) duplicateIds.push(item.id);
    ids.add(item.id);
  }
  if (duplicateIds.length) throw new Error(`DUPLICATE_WORKSPACE_RECORD_ID: ${[...new Set(duplicateIds)].join(',')}`);

  const evidenceBlockers = evidence.filter((item) => item.stale || item.conflict || !item.verified);
  const materialUnapprovedAssumptions = assumptions.filter((item) => item.material && !item.approved);
  const acceptedAiRoles = new Set(ai.filter((item) => item.status === AI_STAGE_STATUS.OUTPUT_ACCEPTED).map((item) => item.role));
  const requiredAiRoles = [AI_ROLE.ANALYST, AI_ROLE.CHALLENGER, AI_ROLE.SYNTHESIZER];
  const missingAiRoles = requiredAiRoles.filter((role) => !acceptedAiRoles.has(role));

  let status = WORKSPACE_STATUS.READY_FOR_REVIEW;
  const reasonCodes = [];
  if (studyOrchestration.status !== STUDY_ORCHESTRATION_STATUS.READY_FOR_AI_AND_HUMAN_REVIEW) {
    status = WORKSPACE_STATUS.HOLD_STUDY;
    reasonCodes.push(`STUDY_${String(studyOrchestration.status || 'UNKNOWN')}`);
  } else if (evidenceBlockers.length || materialUnapprovedAssumptions.length) {
    status = WORKSPACE_STATUS.HOLD_EVIDENCE;
    if (evidenceBlockers.length) reasonCodes.push('EVIDENCE_WORKSPACE_HAS_UNRESOLVED_ITEMS');
    if (materialUnapprovedAssumptions.length) reasonCodes.push('MATERIAL_ASSUMPTIONS_REQUIRE_APPROVAL');
  } else if (missingAiRoles.length) {
    status = WORKSPACE_STATUS.HOLD_AI_OUTPUTS;
    reasonCodes.push('REQUIRED_AI_ROLE_OUTPUTS_MISSING');
  }

  return Object.freeze({
    schemaVersion: 1,
    caseId: scopedCaseId,
    projectId: scopedProjectId,
    status,
    reasonCodes: Object.freeze(reasonCodes),
    summary: Object.freeze({
      evidenceCount: evidence.length,
      staleEvidenceCount: evidence.filter((item) => item.stale).length,
      conflictingEvidenceCount: evidence.filter((item) => item.conflict).length,
      unverifiedEvidenceCount: evidence.filter((item) => !item.verified).length,
      assumptionCount: assumptions.length,
      materialUnapprovedAssumptionCount: materialUnapprovedAssumptions.length,
      acceptedAiRoleCount: acceptedAiRoles.size,
      missingAiRoles: Object.freeze(missingAiRoles),
    }),
    evidence,
    assumptions,
    ai,
    decisionQuality: Object.freeze({
      status: decisionQuality.status || null,
      reliability: decisionQuality.reliability?.overallReliability || null,
      nextBestDueDiligence: decisionQuality.dueDiligence?.nextBestAction || null,
      requiredActions: decisionQuality.requiredActions || null,
    }),
    uiSections: Object.freeze([
      'STUDY_GATE',
      'EVIDENCE_AND_ASSUMPTIONS',
      'DECISION_RELIABILITY',
      'NEXT_BEST_DUE_DILIGENCE',
      'AI_ANALYST',
      'AI_CHALLENGER',
      'AI_SYNTHESIZER',
      'HUMAN_REVIEW',
    ]),
    numericAiConfidence: null,
    aiMayOverrideDeterministicResults: false,
    humanDecisionRequired: true,
    transactionAuthorized: false,
    semantics: 'This UI-ready workspace projection exposes evidence, assumptions, decision quality, and bounded AI role outputs without changing deterministic financial results. It does not call an LLM, invent facts, issue a licensed opinion, authorize a transaction, or replace human review.',
  });
}

module.exports = {
  WORKSPACE_STATUS,
  RECORD_KIND,
  buildDecisionIntelligenceWorkspace,
};
