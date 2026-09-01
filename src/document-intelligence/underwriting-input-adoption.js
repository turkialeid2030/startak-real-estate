'use strict';

const { READINESS_STATUS, deepFreeze } = require('./contracts');

const UNDERWRITING_INPUT_ADOPTION_STATUS = Object.freeze({
  READY_FOR_HUMAN_ADOPTION_DECISION: 'READY_FOR_HUMAN_ADOPTION_DECISION',
  HOLD_READINESS: 'HOLD_READINESS',
  HOLD_SCOPE: 'HOLD_SCOPE',
  HOLD_MAPPING: 'HOLD_MAPPING',
  HOLD_RECONCILIATION: 'HOLD_RECONCILIATION',
  HOLD_CURRENT_INPUTS: 'HOLD_CURRENT_INPUTS',
  HOLD_EVIDENCE_CHAIN: 'HOLD_EVIDENCE_CHAIN',
});

const UNDERWRITING_INPUT_ADOPTION_OUTCOME = Object.freeze({
  ADOPT_ALL: 'ADOPT_ALL',
  REJECT_PLAN: 'REJECT_PLAN',
  DEFER: 'DEFER',
});

const UNDERWRITING_INPUT_ADOPTION_DECISION_STATUS = Object.freeze({
  DECISION_RECORDED: 'DECISION_RECORDED',
  HOLD_PLAN: 'HOLD_PLAN',
  HOLD_DECISION: 'HOLD_DECISION',
  HOLD_ACKNOWLEDGEMENTS: 'HOLD_ACKNOWLEDGEMENTS',
  HOLD_EVIDENCE_CHAIN: 'HOLD_EVIDENCE_CHAIN',
});

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function cleanRefs(refs) {
  return Array.isArray(refs) ? [...new Set(refs.filter(nonEmptyString).map((ref) => ref.trim()))] : [];
}

function iso(value) {
  if (!nonEmptyString(value)) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function hold(status, reasons, context = {}) {
  return Object.freeze({
    schemaVersion: 1,
    status,
    reasons: Object.freeze(reasons),
    caseId: context.caseId || null,
    studyType: context.studyType || null,
    readyForHumanAdoptionDecision: false,
    humanAdoptionDecisionRecorded: false,
    proposedInputPatch: null,
    approvedInputPatch: null,
    financialEngineInputsWritten: false,
    calculationRunExecuted: false,
    transactionAuthorized: false,
  });
}

function buildUnderwritingInputAdoptionPlan({
  caseId,
  studyType,
  readiness,
  currentInputs,
  currentInputVersionId,
  proposedInputVersionId,
  mappings,
  evidenceRefs = [],
} = {}) {
  const context = { caseId, studyType };
  if (!nonEmptyString(caseId) || !nonEmptyString(studyType)) {
    return hold(UNDERWRITING_INPUT_ADOPTION_STATUS.HOLD_SCOPE, ['caseId and studyType are required'], context);
  }
  const readinessValid = readiness
    && readiness.caseId === caseId
    && readiness.status === READINESS_STATUS.READY_FOR_UNDERWRITING_INPUT
    && readiness.readyForUnderwritingInput === true
    && readiness.financialEngineInputsWritten === false
    && readiness.automaticFinancialEngineAdoption === false
    && readiness.transactionAuthorized === false;
  if (!readinessValid) {
    return hold(UNDERWRITING_INPUT_ADOPTION_STATUS.HOLD_READINESS, ['READY_FOR_UNDERWRITING_INPUT evidence readiness is required and must not have auto-written financial inputs'], context);
  }
  if (!currentInputs || typeof currentInputs !== 'object' || Array.isArray(currentInputs)
      || !nonEmptyString(currentInputVersionId) || !nonEmptyString(proposedInputVersionId)
      || currentInputVersionId.trim() === proposedInputVersionId.trim()) {
    return hold(UNDERWRITING_INPUT_ADOPTION_STATUS.HOLD_CURRENT_INPUTS, ['current inputs and distinct current/proposed input version identifiers are required'], context);
  }
  if (!Array.isArray(mappings) || mappings.length === 0) {
    return hold(UNDERWRITING_INPUT_ADOPTION_STATUS.HOLD_MAPPING, ['at least one explicit semantic-key to financial-input mapping is required'], context);
  }

  const reconciliationByKey = new Map((readiness.reconciliations || []).map((item) => [item.key, item]));
  const seenFields = new Set();
  const normalized = [];
  for (const mapping of mappings) {
    if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)
        || !nonEmptyString(mapping.semanticKey)
        || !nonEmptyString(mapping.inputField)
        || !nonEmptyString(mapping.mappingEvidenceRef)) {
      return hold(UNDERWRITING_INPUT_ADOPTION_STATUS.HOLD_MAPPING, ['every mapping requires semanticKey, inputField, and mappingEvidenceRef'], context);
    }
    const semanticKey = mapping.semanticKey.trim();
    const inputField = mapping.inputField.trim();
    if (seenFields.has(inputField)) {
      return hold(UNDERWRITING_INPUT_ADOPTION_STATUS.HOLD_MAPPING, [`duplicate target inputField: ${inputField}`], context);
    }
    seenFields.add(inputField);
    if (!Object.prototype.hasOwnProperty.call(currentInputs, inputField)) {
      return hold(UNDERWRITING_INPUT_ADOPTION_STATUS.HOLD_CURRENT_INPUTS, [`target input field does not exist in current inputs: ${inputField}`], context);
    }
    const reconciliation = reconciliationByKey.get(semanticKey);
    if (!reconciliation || reconciliation.consensusValue === null || reconciliation.consensusValue === undefined
        || ['MISSING', 'CONFLICT', 'UNIT_MISMATCH'].includes(reconciliation.status)) {
      return hold(UNDERWRITING_INPUT_ADOPTION_STATUS.HOLD_RECONCILIATION, [`usable reconciled consensus is required for ${semanticKey}`], context);
    }
    normalized.push(Object.freeze({
      semanticKey,
      inputField,
      priorValue: currentInputs[inputField],
      proposedValue: reconciliation.consensusValue,
      consensusUnit: reconciliation.consensusUnit || null,
      reconciliationStatus: reconciliation.status,
      sourceFactIds: Object.freeze((reconciliation.evidence || []).map((item) => item.factId).filter(nonEmptyString)),
      sourceDocumentHashes: Object.freeze([...new Set((reconciliation.evidence || []).map((item) => item.documentHashSha256).filter(nonEmptyString))]),
      mappingEvidenceRef: mapping.mappingEvidenceRef.trim(),
    }));
  }

  const suppliedRefs = cleanRefs(evidenceRefs);
  const requiredRefs = cleanRefs(normalized.map((item) => item.mappingEvidenceRef));
  const missingRefs = requiredRefs.filter((ref) => !suppliedRefs.includes(ref));
  if (!suppliedRefs.length || missingRefs.length) {
    return hold(UNDERWRITING_INPUT_ADOPTION_STATUS.HOLD_EVIDENCE_CHAIN, ['mapping evidence-reference chain is incomplete'], context);
  }

  const proposedInputPatch = Object.freeze(Object.fromEntries(normalized.map((item) => [item.inputField, item.proposedValue])));
  return Object.freeze({
    schemaVersion: 1,
    status: UNDERWRITING_INPUT_ADOPTION_STATUS.READY_FOR_HUMAN_ADOPTION_DECISION,
    reasons: Object.freeze([]),
    caseId,
    studyType,
    currentInputVersionId: currentInputVersionId.trim(),
    proposedInputVersionId: proposedInputVersionId.trim(),
    mappings: Object.freeze(normalized),
    proposedInputPatch,
    evidenceRefs: Object.freeze(suppliedRefs),
    readyForHumanAdoptionDecision: true,
    humanAdoptionDecisionRecorded: false,
    financialEngineInputsWritten: false,
    calculationInvalidationRequired: true,
    calculationRunExecuted: false,
    transactionAuthorized: false,
    semantics: 'This plan translates evidence-ready reconciled values into an explicit proposed financial-input patch. It does not mutate current inputs, run calculations, or authorize a transaction. Human adoption and a separate versioned materialization step are required.',
  });
}

function recordUnderwritingInputAdoptionDecision({ plan, decision, evidenceRefs = [] } = {}) {
  const context = { caseId: plan?.caseId, studyType: plan?.studyType };
  const validPlan = plan
    && plan.status === UNDERWRITING_INPUT_ADOPTION_STATUS.READY_FOR_HUMAN_ADOPTION_DECISION
    && plan.readyForHumanAdoptionDecision === true
    && plan.financialEngineInputsWritten === false
    && plan.transactionAuthorized === false;
  if (!validPlan) return hold(UNDERWRITING_INPUT_ADOPTION_DECISION_STATUS.HOLD_PLAN, ['complete adoption plan required'], context);

  const decidedAt = iso(decision?.decidedAt);
  const validDecision = decision
    && nonEmptyString(decision.decisionId)
    && nonEmptyString(decision.decidedByRef)
    && nonEmptyString(decision.decisionEvidenceRef)
    && Object.values(UNDERWRITING_INPUT_ADOPTION_OUTCOME).includes(decision.outcome)
    && decision.conflictDeclarationCompleted === true
    && decidedAt;
  if (!validDecision) return hold(UNDERWRITING_INPUT_ADOPTION_DECISION_STATUS.HOLD_DECISION, ['human decision identity, outcome, evidence reference, conflict declaration, and decidedAt are required'], context);

  const acknowledgements = decision.acknowledgements || {};
  const keys = ['evidenceReadinessReviewed', 'mappingReviewed', 'priorValuesReviewed', 'proposedValuesReviewed', 'calculationInvalidationAcknowledged', 'humanAccountabilityAccepted'];
  if (!keys.every((key) => acknowledgements[key] === true)) {
    return hold(UNDERWRITING_INPUT_ADOPTION_DECISION_STATUS.HOLD_ACKNOWLEDGEMENTS, ['all input-adoption acknowledgements are required'], context);
  }

  const suppliedRefs = cleanRefs(evidenceRefs);
  const requiredRefs = cleanRefs([...(plan.evidenceRefs || []), decision.decidedByRef, decision.decisionEvidenceRef]);
  const missingRefs = requiredRefs.filter((ref) => !suppliedRefs.includes(ref));
  if (!suppliedRefs.length || missingRefs.length) {
    return hold(UNDERWRITING_INPUT_ADOPTION_DECISION_STATUS.HOLD_EVIDENCE_CHAIN, ['human adoption decision evidence chain is incomplete'], context);
  }

  const adopted = decision.outcome === UNDERWRITING_INPUT_ADOPTION_OUTCOME.ADOPT_ALL;
  return Object.freeze({
    schemaVersion: 1,
    status: UNDERWRITING_INPUT_ADOPTION_DECISION_STATUS.DECISION_RECORDED,
    reasons: Object.freeze([]),
    caseId: plan.caseId,
    studyType: plan.studyType,
    currentInputVersionId: plan.currentInputVersionId,
    proposedInputVersionId: plan.proposedInputVersionId,
    decision: Object.freeze({
      decisionId: decision.decisionId.trim(),
      outcome: decision.outcome,
      decidedByRef: decision.decidedByRef.trim(),
      decisionEvidenceRef: decision.decisionEvidenceRef.trim(),
      decidedAt,
      conflictDeclarationCompleted: true,
      acknowledgements: Object.freeze(Object.fromEntries(keys.map((key) => [key, true]))),
    }),
    evidenceRefs: Object.freeze(suppliedRefs),
    humanAdoptionDecisionRecorded: true,
    approvedInputPatch: adopted ? plan.proposedInputPatch : null,
    inputAdoptionApprovedByHuman: adopted,
    calculationInvalidationRequired: adopted,
    financialEngineInputsWritten: false,
    calculationRunExecuted: false,
    transactionAuthorized: false,
    semantics: 'ADOPT_ALL records human approval of the proposed evidence-backed input patch. It still does not mutate the financial engine or execute a calculation. Materialization must create a new input version and the subsequent calculation must carry independent run/version traceability.',
  });
}

function materializeApprovedUnderwritingInputs({ adoptionDecision, currentInputs, currentInputVersionId } = {}) {
  if (!adoptionDecision
      || adoptionDecision.status !== UNDERWRITING_INPUT_ADOPTION_DECISION_STATUS.DECISION_RECORDED
      || adoptionDecision.inputAdoptionApprovedByHuman !== true
      || !adoptionDecision.approvedInputPatch) {
    throw new Error('APPROVED_HUMAN_INPUT_ADOPTION_REQUIRED');
  }
  if (!currentInputs || typeof currentInputs !== 'object' || Array.isArray(currentInputs)) throw new TypeError('currentInputs must be an object');
  if (!nonEmptyString(currentInputVersionId) || currentInputVersionId.trim() !== adoptionDecision.currentInputVersionId) {
    throw new Error('INPUT_VERSION_DRIFT: current input version does not match the human-reviewed plan');
  }
  const nextInputs = deepFreeze({ ...currentInputs, ...adoptionDecision.approvedInputPatch });
  return Object.freeze({
    schemaVersion: 1,
    caseId: adoptionDecision.caseId,
    studyType: adoptionDecision.studyType,
    previousInputVersionId: adoptionDecision.currentInputVersionId,
    inputVersionId: adoptionDecision.proposedInputVersionId,
    inputs: nextInputs,
    adoptedFields: Object.freeze(Object.keys(adoptionDecision.approvedInputPatch)),
    sourceDecisionId: adoptionDecision.decision.decisionId,
    sourceDecisionEvidenceRef: adoptionDecision.decision.decisionEvidenceRef,
    financialEngineInputsMaterialized: true,
    calculationInvalidationRequired: true,
    calculationRunExecuted: false,
    transactionAuthorized: false,
    semantics: 'This materializes a new immutable input version after explicit human adoption. It does not execute the financial engine or reuse a prior calculation result. A new calculation_run_id is required before derived outputs can be treated as current.',
  });
}

module.exports = {
  UNDERWRITING_INPUT_ADOPTION_STATUS,
  UNDERWRITING_INPUT_ADOPTION_OUTCOME,
  UNDERWRITING_INPUT_ADOPTION_DECISION_STATUS,
  buildUnderwritingInputAdoptionPlan,
  recordUnderwritingInputAdoptionDecision,
  materializeApprovedUnderwritingInputs,
};
