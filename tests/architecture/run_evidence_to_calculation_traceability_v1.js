'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { READINESS_STATUS } = require('../../src/document-intelligence/contracts');
const {
  UNDERWRITING_INPUT_ADOPTION_OUTCOME,
  buildUnderwritingInputAdoptionPlan,
  recordUnderwritingInputAdoptionDecision,
  materializeApprovedUnderwritingInputs,
} = require('../../src/document-intelligence/underwriting-input-adoption');
const {
  EVIDENCE_CALCULATION_STATUS,
  canonicalStringify,
  executeEvidenceBackedCalculation,
} = require('../../src/document-intelligence/evidence-to-calculation-traceability');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');

const FIXTURE_DIR = path.join(__dirname, '../characterization/fixtures');

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, `${name}.json`), 'utf8'));
}

function makeFlow({ caseId, studyType, currentInputs, semanticKey, inputField, proposedValue }) {
  const mappingEvidenceRef = `${caseId}:mapping-review`;
  const decidedByRef = `${caseId}:underwriter`;
  const decisionEvidenceRef = `${caseId}:adoption-decision-evidence`;
  const sourceFactId = `${caseId}:verified-fact`;
  const documentHash = 'a'.repeat(64);

  const readiness = Object.freeze({
    schemaVersion: 1,
    caseId,
    status: READINESS_STATUS.READY_FOR_UNDERWRITING_INPUT,
    blockers: Object.freeze([]),
    reconciliations: Object.freeze([
      Object.freeze({
        caseId,
        key: semanticKey,
        status: 'SINGLE_SOURCE_UNCORROBORATED',
        consensusValue: proposedValue,
        consensusUnit: 'sar/sqm/year',
        evidence: Object.freeze([
          Object.freeze({ factId: sourceFactId, documentHashSha256: documentHash, truthStatus: 'VERIFIED_FACT' }),
        ]),
      }),
    ]),
    readyForUnderwritingInput: true,
    financialEngineInputsWritten: false,
    automaticFinancialEngineAdoption: false,
    transactionAuthorized: false,
  });

  const plan = buildUnderwritingInputAdoptionPlan({
    caseId,
    studyType,
    readiness,
    currentInputs,
    currentInputVersionId: `${caseId}:inputs-v1`,
    proposedInputVersionId: `${caseId}:inputs-v2`,
    mappings: [{ semanticKey, inputField, mappingEvidenceRef }],
    evidenceRefs: [mappingEvidenceRef],
  });

  const adoptionDecision = recordUnderwritingInputAdoptionDecision({
    plan,
    decision: {
      decisionId: `${caseId}:adopt-decision`,
      outcome: UNDERWRITING_INPUT_ADOPTION_OUTCOME.ADOPT_ALL,
      decidedByRef,
      decisionEvidenceRef,
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
    },
    evidenceRefs: [mappingEvidenceRef, decidedByRef, decisionEvidenceRef],
  });

  const materializedInputs = materializeApprovedUnderwritingInputs({
    adoptionDecision,
    currentInputs,
    currentInputVersionId: `${caseId}:inputs-v1`,
  });

  return {
    readiness,
    plan,
    adoptionDecision,
    materializedInputs,
    refs: { mappingEvidenceRef, decidedByRef, decisionEvidenceRef, sourceFactId, documentHash },
  };
}

async function executeGood(flow, caseId, overrides = {}) {
  const executedByRef = `${caseId}:calculator`;
  const executionEvidenceRef = `${caseId}:calculation-evidence`;
  return executeEvidenceBackedCalculation({
    adoptionPlan: flow.plan,
    adoptionDecision: flow.adoptionDecision,
    materializedInputs: flow.materializedInputs,
    calculationRunId: `${caseId}:calc-run-v2`,
    previousCalculationRunId: `${caseId}:calc-run-v1`,
    executedByRef,
    executionEvidenceRef,
    evidenceRefs: [
      flow.refs.mappingEvidenceRef,
      flow.refs.decidedByRef,
      flow.refs.decisionEvidenceRef,
      executedByRef,
      executionEvidenceRef,
    ],
    executedAt: '2026-09-01T18:21:00Z',
    ...overrides,
  });
}

(async () => {
  const buildingFixture = fixture('RE-GOLD-002-U');
  const buildingInputs = Object.freeze({ ...buildingFixture.input_set });
  const buildingFlow = makeFlow({
    caseId: 'case-trace-building',
    studyType: STUDY_TYPE.EXISTING_BUILDING,
    currentInputs: buildingInputs,
    semanticKey: 'market_rent_per_sqm',
    inputField: 'rentPerSqm',
    proposedValue: 1850,
  });

  const baselineBuilding = calculateInvestmentCase({
    studyType: STUDY_TYPE.EXISTING_BUILDING,
    inputs: buildingInputs,
    leverageEnabled: buildingInputs.leverageEnabled,
  });
  const buildingTrace = await executeGood(buildingFlow, 'case-trace-building');

  assert.strictEqual(buildingTrace.status, EVIDENCE_CALCULATION_STATUS.CALCULATION_CURRENT_FOR_INPUT_VERSION);
  assert.strictEqual(buildingTrace.inputVersionId, 'case-trace-building:inputs-v2');
  assert.strictEqual(buildingTrace.calculationRunId, 'case-trace-building:calc-run-v2');
  assert.strictEqual(buildingTrace.previousCalculationRunId, 'case-trace-building:calc-run-v1');
  assert.strictEqual(buildingTrace.financialEngineResult.rentPerSqm, undefined);
  assert.strictEqual(buildingFlow.materializedInputs.inputs.rentPerSqm, 1850);
  assert.strictEqual(buildingInputs.rentPerSqm, 1800);
  assert.notStrictEqual(buildingTrace.financialEngineResult.npv, baselineBuilding.npv);
  assert.match(buildingTrace.inputHashSha256, /^[a-f0-9]{64}$/);
  assert.match(buildingTrace.calculationResultHashSha256, /^[a-f0-9]{64}$/);
  assert.strictEqual(buildingTrace.fieldLineage.length, 1);
  assert.strictEqual(buildingTrace.fieldLineage[0].inputField, 'rentPerSqm');
  assert.strictEqual(buildingTrace.fieldLineage[0].semanticKey, 'market_rent_per_sqm');
  assert.deepStrictEqual(buildingTrace.fieldLineage[0].sourceFactIds, ['case-trace-building:verified-fact']);
  assert.deepStrictEqual(buildingTrace.fieldLineage[0].sourceDocumentHashes, ['a'.repeat(64)]);
  assert.strictEqual(buildingTrace.calculationRunExecuted, true);
  assert.strictEqual(buildingTrace.calculationCurrent, true);
  assert.strictEqual(buildingTrace.derivedOutputsCurrentForInputVersion, true);
  assert.strictEqual(buildingTrace.priorCalculationResultReusable, false);
  assert.strictEqual(buildingTrace.priorCalculationInvalidated, true);
  assert.strictEqual(buildingTrace.decisionQualityRefreshRequired, true);
  assert.strictEqual(buildingTrace.aiDossierRefreshRequired, true);
  assert.strictEqual(buildingTrace.humanReviewRequired, true);
  assert.strictEqual(buildingTrace.transactionAuthorized, false);

  const directBuilding = calculateInvestmentCase({
    studyType: STUDY_TYPE.EXISTING_BUILDING,
    inputs: buildingFlow.materializedInputs.inputs,
    leverageEnabled: buildingFlow.materializedInputs.inputs.leverageEnabled,
  });
  assert.strictEqual(canonicalStringify(buildingTrace.financialEngineResult), canonicalStringify(directBuilding));

  const reusedRun = await executeGood(buildingFlow, 'case-trace-building', {
    calculationRunId: 'case-trace-building:calc-run-v1',
    previousCalculationRunId: 'case-trace-building:calc-run-v1',
  });
  assert.strictEqual(reusedRun.status, EVIDENCE_CALCULATION_STATUS.HOLD_RUN_ID);
  assert.strictEqual(reusedRun.calculationRunExecuted, false);

  const staleMaterialization = await executeEvidenceBackedCalculation({
    adoptionPlan: buildingFlow.plan,
    adoptionDecision: buildingFlow.adoptionDecision,
    materializedInputs: { ...buildingFlow.materializedInputs, calculationRunExecuted: true },
    calculationRunId: 'case-trace-building:calc-run-v3',
    previousCalculationRunId: 'case-trace-building:calc-run-v2',
    executedByRef: 'case-trace-building:calculator',
    executionEvidenceRef: 'case-trace-building:calculation-evidence-v3',
    evidenceRefs: [
      buildingFlow.refs.mappingEvidenceRef,
      buildingFlow.refs.decidedByRef,
      buildingFlow.refs.decisionEvidenceRef,
      'case-trace-building:calculator',
      'case-trace-building:calculation-evidence-v3',
    ],
    executedAt: '2026-09-01T18:22:00Z',
  });
  assert.strictEqual(staleMaterialization.status, EVIDENCE_CALCULATION_STATUS.HOLD_MATERIALIZED_INPUTS);

  const incompleteEvidence = await executeGood(buildingFlow, 'case-trace-building', { evidenceRefs: [] });
  assert.strictEqual(incompleteEvidence.status, EVIDENCE_CALCULATION_STATUS.HOLD_EVIDENCE_CHAIN);

  const timeTravel = await executeGood(buildingFlow, 'case-trace-building', { executedAt: '2026-09-01T18:19:59Z' });
  assert.strictEqual(timeTravel.status, EVIDENCE_CALCULATION_STATUS.HOLD_EXECUTION_TIME);

  const lineageTamper = await executeEvidenceBackedCalculation({
    adoptionPlan: buildingFlow.plan,
    adoptionDecision: buildingFlow.adoptionDecision,
    materializedInputs: {
      ...buildingFlow.materializedInputs,
      inputs: { ...buildingFlow.materializedInputs.inputs, rentPerSqm: 1900 },
    },
    calculationRunId: 'case-trace-building:calc-run-tampered',
    previousCalculationRunId: 'case-trace-building:calc-run-v1',
    executedByRef: 'case-trace-building:calculator',
    executionEvidenceRef: 'case-trace-building:tamper-evidence',
    evidenceRefs: [
      buildingFlow.refs.mappingEvidenceRef,
      buildingFlow.refs.decidedByRef,
      buildingFlow.refs.decisionEvidenceRef,
      'case-trace-building:calculator',
      'case-trace-building:tamper-evidence',
    ],
    executedAt: '2026-09-01T18:22:00Z',
  });
  assert.strictEqual(lineageTamper.status, EVIDENCE_CALCULATION_STATUS.HOLD_LINEAGE);

  const landFixture = fixture('RE-GOLD-001-U');
  const landInputs = Object.freeze({ ...landFixture.input_set });
  const landFlow = makeFlow({
    caseId: 'case-trace-land',
    studyType: STUDY_TYPE.LAND_DEVELOPMENT,
    currentInputs: landInputs,
    semanticKey: 'market_rent_per_sqm',
    inputField: 'marketRentPerSqm',
    proposedValue: 1850,
  });
  const baselineLand = calculateInvestmentCase({
    studyType: STUDY_TYPE.LAND_DEVELOPMENT,
    inputs: landInputs,
    leverageEnabled: landInputs.leverageEnabled,
  });
  const landTrace = await executeGood(landFlow, 'case-trace-land');
  assert.strictEqual(landTrace.status, EVIDENCE_CALCULATION_STATUS.CALCULATION_CURRENT_FOR_INPUT_VERSION);
  assert.notStrictEqual(landTrace.financialEngineResult.npv, baselineLand.npv);
  assert.strictEqual(landTrace.fieldLineage[0].inputField, 'marketRentPerSqm');
  assert.strictEqual(landTrace.transactionAuthorized, false);

  console.log('EVIDENCE_TO_CALCULATION_TRACEABILITY_V1=PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
