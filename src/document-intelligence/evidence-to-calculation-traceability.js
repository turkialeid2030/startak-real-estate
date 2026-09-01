'use strict';

const { calculateInvestmentCase, STUDY_TYPE } = require('../engines');
const { deepFreeze } = require('./contracts');
const {
  UNDERWRITING_INPUT_ADOPTION_STATUS,
  UNDERWRITING_INPUT_ADOPTION_DECISION_STATUS,
  UNDERWRITING_INPUT_ADOPTION_OUTCOME,
} = require('./underwriting-input-adoption');

const EVIDENCE_CALCULATION_STATUS = Object.freeze({
  CALCULATION_CURRENT_FOR_INPUT_VERSION: 'CALCULATION_CURRENT_FOR_INPUT_VERSION',
  HOLD_SCOPE: 'HOLD_SCOPE',
  HOLD_ADOPTION_PLAN: 'HOLD_ADOPTION_PLAN',
  HOLD_ADOPTION_DECISION: 'HOLD_ADOPTION_DECISION',
  HOLD_MATERIALIZED_INPUTS: 'HOLD_MATERIALIZED_INPUTS',
  HOLD_LINEAGE: 'HOLD_LINEAGE',
  HOLD_RUN_ID: 'HOLD_RUN_ID',
  HOLD_EXECUTION_IDENTITY: 'HOLD_EXECUTION_IDENTITY',
  HOLD_EVIDENCE_CHAIN: 'HOLD_EVIDENCE_CHAIN',
  HOLD_EXECUTION_TIME: 'HOLD_EXECUTION_TIME',
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

function specialNumber(value) {
  if (Number.isNaN(value)) return Object.freeze({ $number: 'NaN' });
  if (value === Infinity) return Object.freeze({ $number: 'Infinity' });
  if (value === -Infinity) return Object.freeze({ $number: '-Infinity' });
  if (Object.is(value, -0)) return Object.freeze({ $number: '-0' });
  return value;
}

function canonicalValue(value, seen = new WeakSet()) {
  if (typeof value === 'number') return specialNumber(value);
  if (typeof value === 'bigint') return { $bigint: value.toString() };
  if (value === undefined) return { $undefined: true };
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (value instanceof Date) return { $date: value.toISOString() };
  if (Array.isArray(value)) return value.map((item) => canonicalValue(item, seen));
  if (typeof value === 'object') {
    if (seen.has(value)) throw new TypeError('CIRCULAR_VALUE_NOT_HASHABLE');
    seen.add(value);
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonicalValue(value[key], seen);
    seen.delete(value);
    return out;
  }
  return { $type: typeof value, $value: String(value) };
}

function canonicalStringify(value) {
  return JSON.stringify(canonicalValue(value));
}

async function sha256Hex(value) {
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (!subtle) throw new Error('WEB_CRYPTO_SHA256_UNAVAILABLE');
  const bytes = new TextEncoder().encode(canonicalStringify(value));
  const digest = await subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function hold(status, reasons, context = {}) {
  return Object.freeze({
    schemaVersion: 1,
    status,
    reasons: Object.freeze(reasons),
    caseId: context.caseId || null,
    studyType: context.studyType || null,
    inputVersionId: context.inputVersionId || null,
    calculationRunId: context.calculationRunId || null,
    calculationRunExecuted: false,
    calculationCurrent: false,
    priorCalculationResultReusable: false,
    financialEngineResult: null,
    transactionAuthorized: false,
  });
}

function sameValue(a, b) {
  return canonicalStringify(a) === canonicalStringify(b);
}

function validateScope({ adoptionPlan, adoptionDecision, materializedInputs }) {
  const caseId = materializedInputs?.caseId || adoptionDecision?.caseId || adoptionPlan?.caseId || null;
  const studyType = materializedInputs?.studyType || adoptionDecision?.studyType || adoptionPlan?.studyType || null;
  if (!nonEmptyString(caseId) || !Object.values(STUDY_TYPE).includes(studyType)) return null;
  if (adoptionPlan.caseId !== caseId || adoptionDecision.caseId !== caseId || materializedInputs.caseId !== caseId) return null;
  if (adoptionPlan.studyType !== studyType || adoptionDecision.studyType !== studyType || materializedInputs.studyType !== studyType) return null;
  return { caseId, studyType };
}

function buildFieldLineage({ adoptionPlan, adoptionDecision, materializedInputs }) {
  if (!Array.isArray(adoptionPlan.mappings) || !adoptionPlan.mappings.length) return null;
  const adoptedFields = Array.isArray(materializedInputs.adoptedFields) ? materializedInputs.adoptedFields : [];
  const adoptedSet = new Set(adoptedFields);
  const planPatch = adoptionPlan.proposedInputPatch || {};
  const approvedPatch = adoptionDecision.approvedInputPatch || {};
  const rows = [];

  for (const mapping of adoptionPlan.mappings) {
    if (!mapping || !nonEmptyString(mapping.inputField) || !nonEmptyString(mapping.semanticKey)) return null;
    if (!adoptedSet.has(mapping.inputField)) return null;
    if (!Object.prototype.hasOwnProperty.call(planPatch, mapping.inputField)) return null;
    if (!Object.prototype.hasOwnProperty.call(approvedPatch, mapping.inputField)) return null;
    if (!Object.prototype.hasOwnProperty.call(materializedInputs.inputs || {}, mapping.inputField)) return null;
    const expected = planPatch[mapping.inputField];
    if (!sameValue(expected, approvedPatch[mapping.inputField]) || !sameValue(expected, materializedInputs.inputs[mapping.inputField])) return null;

    rows.push(Object.freeze({
      inputField: mapping.inputField,
      semanticKey: mapping.semanticKey,
      priorValue: mapping.priorValue,
      adoptedValue: expected,
      consensusUnit: mapping.consensusUnit || null,
      reconciliationStatus: mapping.reconciliationStatus || null,
      sourceFactIds: Object.freeze(Array.isArray(mapping.sourceFactIds) ? [...mapping.sourceFactIds] : []),
      sourceDocumentHashes: Object.freeze(Array.isArray(mapping.sourceDocumentHashes) ? [...mapping.sourceDocumentHashes] : []),
      mappingEvidenceRef: mapping.mappingEvidenceRef || null,
    }));
  }

  if (rows.length !== adoptedSet.size) return null;
  return Object.freeze(rows);
}

async function executeEvidenceBackedCalculation({
  adoptionPlan,
  adoptionDecision,
  materializedInputs,
  calculationRunId,
  previousCalculationRunId = null,
  executedByRef,
  executionEvidenceRef,
  evidenceRefs = [],
  executedAt,
} = {}) {
  const context = {
    caseId: materializedInputs?.caseId || adoptionDecision?.caseId || adoptionPlan?.caseId || null,
    studyType: materializedInputs?.studyType || adoptionDecision?.studyType || adoptionPlan?.studyType || null,
    inputVersionId: materializedInputs?.inputVersionId || null,
    calculationRunId: nonEmptyString(calculationRunId) ? calculationRunId.trim() : null,
  };

  const scope = validateScope({ adoptionPlan, adoptionDecision, materializedInputs });
  if (!scope) return hold(EVIDENCE_CALCULATION_STATUS.HOLD_SCOPE, ['caseId/studyType scope must be valid and identical across plan, decision, and materialized inputs'], context);

  const planValid = adoptionPlan
    && adoptionPlan.status === UNDERWRITING_INPUT_ADOPTION_STATUS.READY_FOR_HUMAN_ADOPTION_DECISION
    && adoptionPlan.readyForHumanAdoptionDecision === true
    && adoptionPlan.financialEngineInputsWritten === false
    && adoptionPlan.calculationRunExecuted === false
    && adoptionPlan.transactionAuthorized === false;
  if (!planValid) return hold(EVIDENCE_CALCULATION_STATUS.HOLD_ADOPTION_PLAN, ['a bounded READY_FOR_HUMAN_ADOPTION_DECISION plan is required'], context);

  const decisionValid = adoptionDecision
    && adoptionDecision.status === UNDERWRITING_INPUT_ADOPTION_DECISION_STATUS.DECISION_RECORDED
    && adoptionDecision.inputAdoptionApprovedByHuman === true
    && adoptionDecision.decision?.outcome === UNDERWRITING_INPUT_ADOPTION_OUTCOME.ADOPT_ALL
    && adoptionDecision.financialEngineInputsWritten === false
    && adoptionDecision.calculationRunExecuted === false
    && adoptionDecision.transactionAuthorized === false
    && adoptionDecision.currentInputVersionId === adoptionPlan.currentInputVersionId
    && adoptionDecision.proposedInputVersionId === adoptionPlan.proposedInputVersionId;
  if (!decisionValid) return hold(EVIDENCE_CALCULATION_STATUS.HOLD_ADOPTION_DECISION, ['an approved human ADOPT_ALL decision matching the adoption plan is required'], context);

  const materializedValid = materializedInputs
    && materializedInputs.financialEngineInputsMaterialized === true
    && materializedInputs.calculationInvalidationRequired === true
    && materializedInputs.calculationRunExecuted === false
    && materializedInputs.transactionAuthorized === false
    && materializedInputs.previousInputVersionId === adoptionPlan.currentInputVersionId
    && materializedInputs.inputVersionId === adoptionPlan.proposedInputVersionId
    && materializedInputs.sourceDecisionId === adoptionDecision.decision?.decisionId
    && materializedInputs.sourceDecisionEvidenceRef === adoptionDecision.decision?.decisionEvidenceRef
    && materializedInputs.inputs
    && typeof materializedInputs.inputs === 'object'
    && !Array.isArray(materializedInputs.inputs);
  if (!materializedValid) return hold(EVIDENCE_CALCULATION_STATUS.HOLD_MATERIALIZED_INPUTS, ['a new immutable materialized input version that invalidates prior calculations is required'], context);

  const fieldLineage = buildFieldLineage({ adoptionPlan, adoptionDecision, materializedInputs });
  if (!fieldLineage) return hold(EVIDENCE_CALCULATION_STATUS.HOLD_LINEAGE, ['adopted input fields must reconcile exactly to the human-reviewed mapping and approved patch'], context);

  const runId = nonEmptyString(calculationRunId) ? calculationRunId.trim() : null;
  const previousRunId = nonEmptyString(previousCalculationRunId) ? previousCalculationRunId.trim() : null;
  if (!runId || (previousRunId && previousRunId === runId)) {
    return hold(EVIDENCE_CALCULATION_STATUS.HOLD_RUN_ID, ['a new calculationRunId is required and cannot reuse the previous calculation run id'], context);
  }

  if (!nonEmptyString(executedByRef) || !nonEmptyString(executionEvidenceRef)) {
    return hold(EVIDENCE_CALCULATION_STATUS.HOLD_EXECUTION_IDENTITY, ['executedByRef and executionEvidenceRef are required'], context);
  }

  const suppliedRefs = cleanRefs(evidenceRefs);
  const requiredRefs = cleanRefs([
    ...(adoptionPlan.evidenceRefs || []),
    ...(adoptionDecision.evidenceRefs || []),
    adoptionDecision.decision?.decidedByRef,
    adoptionDecision.decision?.decisionEvidenceRef,
    materializedInputs.sourceDecisionEvidenceRef,
    executedByRef,
    executionEvidenceRef,
    ...fieldLineage.map((row) => row.mappingEvidenceRef),
  ]);
  const missingRefs = requiredRefs.filter((ref) => !suppliedRefs.includes(ref));
  if (!suppliedRefs.length || missingRefs.length) {
    return hold(EVIDENCE_CALCULATION_STATUS.HOLD_EVIDENCE_CHAIN, [`calculation evidence chain is incomplete${missingRefs.length ? `: ${missingRefs.join(', ')}` : ''}`], context);
  }

  const executionTime = iso(executedAt);
  const decisionTime = iso(adoptionDecision.decision?.decidedAt);
  if (!executionTime || !decisionTime || new Date(executionTime).getTime() < new Date(decisionTime).getTime()) {
    return hold(EVIDENCE_CALCULATION_STATUS.HOLD_EXECUTION_TIME, ['executedAt must be valid and not precede the human adoption decision'], context);
  }

  const inputHashSha256 = await sha256Hex(materializedInputs.inputs);
  const financialEngineResult = calculateInvestmentCase({
    studyType: scope.studyType,
    inputs: materializedInputs.inputs,
    leverageEnabled: materializedInputs.inputs.leverageEnabled,
  });
  const calculationResultHashSha256 = await sha256Hex(financialEngineResult);

  return deepFreeze({
    schemaVersion: 1,
    status: EVIDENCE_CALCULATION_STATUS.CALCULATION_CURRENT_FOR_INPUT_VERSION,
    reasons: Object.freeze([]),
    caseId: scope.caseId,
    studyType: scope.studyType,
    previousInputVersionId: materializedInputs.previousInputVersionId,
    inputVersionId: materializedInputs.inputVersionId,
    calculationRunId: runId,
    previousCalculationRunId: previousRunId,
    executedAt: executionTime,
    executedByRef: executedByRef.trim(),
    executionEvidenceRef: executionEvidenceRef.trim(),
    evidenceRefs: Object.freeze(suppliedRefs),
    inputHashSha256,
    calculationResultHashSha256,
    engineEntryPoint: 'src/engines/index.js#calculateInvestmentCase',
    financialModelVersion: financialEngineResult.financialModelVersion || null,
    financialModelStatus: financialEngineResult.financialModelStatus || null,
    adoptedFields: Object.freeze([...materializedInputs.adoptedFields]),
    fieldLineage,
    sourceAdoptionDecision: Object.freeze({
      decisionId: adoptionDecision.decision.decisionId,
      decisionEvidenceRef: adoptionDecision.decision.decisionEvidenceRef,
      decidedByRef: adoptionDecision.decision.decidedByRef,
      decidedAt: adoptionDecision.decision.decidedAt,
    }),
    financialEngineResult: deepFreeze(financialEngineResult),
    calculationRunExecuted: true,
    calculationCurrent: true,
    derivedOutputsCurrentForInputVersion: true,
    priorCalculationResultReusable: false,
    priorCalculationInvalidated: true,
    decisionQualityRefreshRequired: true,
    aiDossierRefreshRequired: true,
    humanReviewRequired: true,
    transactionAuthorized: false,
    semantics: 'This record executes the canonical financial engine only against the new human-adopted input version and binds the result to a new calculation run, input hash, result hash, and evidence lineage. It invalidates silent reuse of prior derived outputs; it does not approve the investment, certify valuation, issue legal advice, or authorize a transaction.',
  });
}

module.exports = {
  EVIDENCE_CALCULATION_STATUS,
  canonicalStringify,
  sha256Hex,
  executeEvidenceBackedCalculation,
};
