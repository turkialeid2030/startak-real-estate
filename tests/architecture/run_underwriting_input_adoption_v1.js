'use strict';

const assert = require('assert');
const { READINESS_STATUS } = require('../../src/document-intelligence/contracts');
const {
  UNDERWRITING_INPUT_ADOPTION_STATUS,
  UNDERWRITING_INPUT_ADOPTION_OUTCOME,
  UNDERWRITING_INPUT_ADOPTION_DECISION_STATUS,
  buildUnderwritingInputAdoptionPlan,
  recordUnderwritingInputAdoptionDecision,
  materializeApprovedUnderwritingInputs,
} = require('../../src/document-intelligence/underwriting-input-adoption');

const caseId = 'case-adoption-1';
const readiness = Object.freeze({
  schemaVersion: 1,
  caseId,
  status: READINESS_STATUS.READY_FOR_UNDERWRITING_INPUT,
  blockers: Object.freeze([]),
  reconciliations: Object.freeze([
    Object.freeze({
      caseId,
      key: 'market_rent_per_sqm',
      status: 'SINGLE_SOURCE_UNCORROBORATED',
      consensusValue: 1850,
      consensusUnit: 'sar/sqm/year',
      evidence: Object.freeze([
        Object.freeze({ factId: 'fact-rent-1', documentHashSha256: 'a'.repeat(64), truthStatus: 'VERIFIED_FACT' }),
      ]),
    }),
  ]),
  readyForUnderwritingInput: true,
  financialEngineInputsWritten: false,
  automaticFinancialEngineAdoption: false,
  transactionAuthorized: false,
});
const currentInputs = Object.freeze({ rentPerSqm: 1800, marketCapRate: 0.07, occupancyRate: 1 });

function plan(overrides = {}) {
  return buildUnderwritingInputAdoptionPlan({
    caseId,
    studyType: 'EXISTING_BUILDING',
    readiness,
    currentInputs,
    currentInputVersionId: 'inputs-v1',
    proposedInputVersionId: 'inputs-v2',
    mappings: [{ semanticKey: 'market_rent_per_sqm', inputField: 'rentPerSqm', mappingEvidenceRef: 'mapping-review-001' }],
    evidenceRefs: ['mapping-review-001'],
    ...overrides,
  });
}

function decision(goodPlan, overrides = {}) {
  return recordUnderwritingInputAdoptionDecision({
    plan: goodPlan,
    decision: {
      decisionId: 'adopt-decision-001',
      outcome: UNDERWRITING_INPUT_ADOPTION_OUTCOME.ADOPT_ALL,
      decidedByRef: 'underwriter-001',
      decisionEvidenceRef: 'adoption-decision-evidence-001',
      decidedAt: '2026-09-01T18:20:00Z',
      conflictDeclarationCompleted: true,
      acknowledgements: {
        evidenceReadinessReviewed: true,
        mappingReviewed: true,
        priorValuesReviewed: true,
        proposedValuesReviewed: true,
        calculationInvalidationAcknowledged: true,
        humanAccountabilityAccepted: true,
      },
      ...(overrides.decision || {}),
    },
    evidenceRefs: overrides.evidenceRefs || ['mapping-review-001', 'underwriter-001', 'adoption-decision-evidence-001'],
  });
}

(function buildsPlanWithoutMutatingCurrentInputs() {
  const result = plan();
  assert.strictEqual(result.status, UNDERWRITING_INPUT_ADOPTION_STATUS.READY_FOR_HUMAN_ADOPTION_DECISION);
  assert.deepStrictEqual(result.proposedInputPatch, { rentPerSqm: 1850 });
  assert.strictEqual(currentInputs.rentPerSqm, 1800);
  assert.strictEqual(result.financialEngineInputsWritten, false);
  assert.strictEqual(result.calculationRunExecuted, false);
  assert.strictEqual(result.transactionAuthorized, false);
})();

(function readinessMustBePositiveAndBounded() {
  const result = plan({ readiness: { ...readiness, status: READINESS_STATUS.HOLD_EVIDENCE, readyForUnderwritingInput: false } });
  assert.strictEqual(result.status, UNDERWRITING_INPUT_ADOPTION_STATUS.HOLD_READINESS);
})();

(function mappingCannotTargetUnknownInputField() {
  const result = plan({ mappings: [{ semanticKey: 'market_rent_per_sqm', inputField: 'doesNotExist', mappingEvidenceRef: 'mapping-review-001' }] });
  assert.strictEqual(result.status, UNDERWRITING_INPUT_ADOPTION_STATUS.HOLD_CURRENT_INPUTS);
})();

(function reconciliationMustProvideUsableConsensus() {
  const badReadiness = { ...readiness, reconciliations: [{ ...readiness.reconciliations[0], status: 'CONFLICT', consensusValue: null }] };
  const result = plan({ readiness: badReadiness });
  assert.strictEqual(result.status, UNDERWRITING_INPUT_ADOPTION_STATUS.HOLD_RECONCILIATION);
})();

(function mappingEvidenceChainIsRequired() {
  const result = plan({ evidenceRefs: [] });
  assert.strictEqual(result.status, UNDERWRITING_INPUT_ADOPTION_STATUS.HOLD_EVIDENCE_CHAIN);
})();

(function humanAdoptionStillDoesNotWriteInputs() {
  const approved = decision(plan());
  assert.strictEqual(approved.status, UNDERWRITING_INPUT_ADOPTION_DECISION_STATUS.DECISION_RECORDED);
  assert.strictEqual(approved.inputAdoptionApprovedByHuman, true);
  assert.deepStrictEqual(approved.approvedInputPatch, { rentPerSqm: 1850 });
  assert.strictEqual(approved.financialEngineInputsWritten, false);
  assert.strictEqual(approved.calculationRunExecuted, false);
})();

(function rejectDecisionDoesNotExposeApprovedPatch() {
  const rejected = decision(plan(), { decision: { outcome: UNDERWRITING_INPUT_ADOPTION_OUTCOME.REJECT_PLAN } });
  assert.strictEqual(rejected.status, UNDERWRITING_INPUT_ADOPTION_DECISION_STATUS.DECISION_RECORDED);
  assert.strictEqual(rejected.inputAdoptionApprovedByHuman, false);
  assert.strictEqual(rejected.approvedInputPatch, null);
})();

(function materializationCreatesNewVersionAndInvalidatesCalculation() {
  const approved = decision(plan());
  const materialized = materializeApprovedUnderwritingInputs({ adoptionDecision: approved, currentInputs, currentInputVersionId: 'inputs-v1' });
  assert.strictEqual(materialized.previousInputVersionId, 'inputs-v1');
  assert.strictEqual(materialized.inputVersionId, 'inputs-v2');
  assert.strictEqual(materialized.inputs.rentPerSqm, 1850);
  assert.strictEqual(materialized.inputs.marketCapRate, 0.07);
  assert.strictEqual(materialized.financialEngineInputsMaterialized, true);
  assert.strictEqual(materialized.calculationInvalidationRequired, true);
  assert.strictEqual(materialized.calculationRunExecuted, false);
  assert.strictEqual(materialized.transactionAuthorized, false);
})();

(function materializationFailsOnVersionDrift() {
  const approved = decision(plan());
  assert.throws(() => materializeApprovedUnderwritingInputs({ adoptionDecision: approved, currentInputs, currentInputVersionId: 'inputs-v3' }), /INPUT_VERSION_DRIFT/);
})();

console.log('UNDERWRITING_INPUT_ADOPTION_V1=PASS');
