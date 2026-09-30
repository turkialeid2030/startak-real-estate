'use strict';

const assert = require('assert');
const {
  C4_REVIEW_RECOMMENDATION,
  C4_REPORT_CLASSIFICATION,
} = require('../../src/contracts/governed-deal-decision');
const {
  C3_VALUATION_RECONCILIATION_SCHEMA_VERSION,
  RECONCILIATION_GATE_STATUS,
  VALUATION_VALUE_SCOPE,
} = require('../../src/contracts/valuation-reconciliation');
const {
  computeC3ResultHash,
  buildGovernedDealDecision,
} = require('../../src/decision-intelligence/governed-deal-decision');
const {
  C5_OPERATIONAL_STATUS,
  computeSavedDealStateHash,
  evaluateGovernedDecisionOperationalState,
  buildGovernedDecisionOperationalExport,
  verifyGovernedDecisionOperationalExport,
} = require('../../src/app/governed-decision-operational');
const {
  valuationCaseFromSavedDeal,
  withValuationCase,
  governedDecisionOperationalContextFromValuationCase,
  buildGovernedDecisionOperationalExportFromValuationCase,
} = require('../../src/app/valuation-saved-deal-bridge');
const { validateSavedDealRecord } = require('../../src/validation/saved-deal-schema');

function hash(char) {
  return char.repeat(64);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function minimalReconciliation() {
  const method = {
    id: 'market-c5',
    approachFamily: 'MARKET',
    valueScope: 'WHOLE_PROPERTY',
    modelVersion: 'WHOLE_PROPERTY_SALES_COMPARISON_1.0',
    sourceStatus: 'WHOLE_PROPERTY_MARKET_VALUE_INDICATION_READY',
    propertyRef: 'PROPERTY-C5-001',
    valuationDate: '2026-09-29T00:00:00.000Z',
    valueSar: 11200000,
    calculationHashSha256: hash('1'),
    sourceResultHashSha256: hash('2'),
    verifiedBy: 'reviewer-c5',
    verificationReference: 'VERIFY-C5',
    verifiedAt: '2026-09-30T07:00:00.000Z',
    blockers: [],
  };
  const core = {
    version: 'C3_VALUATION_RECONCILIATION_GOVERNANCE_V1',
    schemaVersion: C3_VALUATION_RECONCILIATION_SCHEMA_VERSION,
    propertyRef: 'PROPERTY-C5-001',
    valuationDate: '2026-09-29T00:00:00.000Z',
    valuationScope: VALUATION_VALUE_SCOPE.WHOLE_PROPERTY,
    asOf: '2026-09-30T08:00:00.000Z',
    status: RECONCILIATION_GATE_STATUS.READY,
    decisionReady: true,
    reconciliationPolicyId: 'C5-FIXTURE-POLICY',
    dependencyStatus: { c1: 'READY', c2: 'READY' },
    marketContextBinding: { bindingId: 'C5-MARKET-CONTEXT' },
    methodCoverage: {
      eligibleMethodCount: 1,
      eligibleApproachFamilies: ['MARKET'],
      requiredApproachFamilies: ['MARKET'],
      requiredFamilyCoverageRatio: 1,
    },
    eligibleMethodIndications: [method],
    reconciliationInstruction: { instructionId: 'C5-REC' },
    weightedTrace: [],
    candidateWeightedValueSar: 11200000,
    analyticalRangeLowSar: 10800000,
    analyticalRangeHighSar: 11600000,
    spreadRatio: 800000 / 11200000,
    analyticalConfidenceClass: 'MODERATE',
    analyticalValueIndicationSar: 11200000,
    blockers: [],
    warnings: [],
  };
  return {
    ...core,
    resultHashSha256: computeC3ResultHash(core),
    c1ReevaluatedInternally: true,
    c2ReevaluatedInternally: true,
    marketContextBindingRequired: true,
    valuationScopeEnforced: true,
    professionalReconciliationInstructionUsed: true,
    automaticMethodSelection: false,
    automaticReconciliationWeightsGenerated: false,
    statisticalConfidenceClaimed: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    publicAiAuthorized: false,
    semantics: 'C5 regression fixture',
  };
}

function governedDecision() {
  const reconciliation = minimalReconciliation();
  return buildGovernedDealDecision({
    caseId: 'CASE-C5-001',
    projectId: 'PROJECT-C5-001',
    propertyRef: 'PROPERTY-C5-001',
    valuationDate: '2026-09-29T00:00:00.000Z',
    reconciliation,
    evidenceLineage: {
      c1ResultHashSha256: hash('a'),
      c2ResultHashSha256: hash('b'),
      reconciliationResultHashSha256: reconciliation.resultHashSha256,
      sourceEvidenceHashes: [hash('c')],
      methodSourceResultHashesById: {
        'market-c5': hash('2'),
      },
    },
    generatedAt: '2026-09-30T09:00:00.000Z',
    maxReconciliationAgeHours: 24,
    humanReview: {
      reviewerId: 'investment-reviewer-c5',
      recommendation: C4_REVIEW_RECOMMENDATION.CONTINUE_DUE_DILIGENCE,
      rationale: 'Continue governed diligence; separate approval authority remains required.',
      reviewedAt: '2026-09-30T08:30:00.000Z',
    },
  });
}

function savedDeal(overrides = {}) {
  return {
    id: 'DEAL-C5-001',
    name: 'C5 governed saved deal',
    mode: 'building',
    inputs: { buildingPrice: 12000000, rentPerSqm: 1500 },
    savedAt: '2026-09-30T09:05:00.000Z',
    valuationCase: {
      schemaVersion: 1,
      projectId: 'PROJECT-C5-001',
      classification: {},
      incomePolicy: {},
    },
    governedDealDecision: governedDecision(),
    ...overrides,
  };
}

function expectSavedDealReason(reasonCode, value) {
  assert.throws(
    () => validateSavedDealRecord(value),
    (error) => error && error.reasonCode === reasonCode,
    `expected saved-deal reason ${reasonCode}`,
  );
}

(function run() {
  const record = savedDeal();
  assert.strictEqual(validateSavedDealRecord(record), record);

  const ready = evaluateGovernedDecisionOperationalState({
    savedDealRecord: record,
    expectedContext: {
      caseId: 'CASE-C5-001',
      projectId: 'PROJECT-C5-001',
      propertyRef: 'PROPERTY-C5-001',
    },
    asOf: '2026-09-30T10:00:00.000Z',
  });
  assert.strictEqual(ready.status, C5_OPERATIONAL_STATUS.READY_FOR_GOVERNED_EXPORT);
  assert.strictEqual(ready.canExport, true);
  assert.strictEqual(ready.transactionAuthorized, false);
  assert.strictEqual(ready.approvalAuthorized, false);
  assert.strictEqual(ready.publicAiAuthorized, false);
  assert.strictEqual(ready.commercialGoLive, 'HOLD');
  assert.strictEqual(ready.reviewerRecommendation, C4_REVIEW_RECOMMENDATION.CONTINUE_DUE_DILIGENCE);
  assert.strictEqual(ready.approvalStatus, 'NOT_ESTABLISHED');

  const exportEnvelope = buildGovernedDecisionOperationalExport({
    savedDealRecord: record,
    expectedContext: { projectId: 'PROJECT-C5-001' },
    reportId: 'REPORT-C5-001',
    generatedAt: '2026-09-30T10:00:00.000Z',
  });
  assert.strictEqual(exportEnvelope.classification, C4_REPORT_CLASSIFICATION.NON_AUTHORIZING_ANALYTICAL_OUTPUT);
  assert.strictEqual(exportEnvelope.report.classification, C4_REPORT_CLASSIFICATION.NON_AUTHORIZING_ANALYTICAL_OUTPUT);
  assert.strictEqual(exportEnvelope.approvalStatus, 'NOT_ESTABLISHED');
  assert.strictEqual(exportEnvelope.transactionAuthorized, false);
  assert.strictEqual(exportEnvelope.approvalAuthorized, false);
  assert.strictEqual(exportEnvelope.publicAiAuthorized, false);
  assert.strictEqual(exportEnvelope.commercialGoLive, 'HOLD');
  assert(exportEnvelope.disclosures.includes('REVIEWER_RECOMMENDATION_DOES_NOT_EQUAL_APPROVAL'));
  assert.strictEqual(verifyGovernedDecisionOperationalExport(exportEnvelope), true);
  assert(/^[a-f0-9]{64}$/.test(exportEnvelope.exportHashSha256));

  const deterministicAgain = buildGovernedDecisionOperationalExport({
    savedDealRecord: clone(record),
    expectedContext: { projectId: 'PROJECT-C5-001' },
    reportId: 'REPORT-C5-001',
    generatedAt: '2026-09-30T10:00:00.000Z',
  });
  assert.strictEqual(deterministicAgain.exportHashSha256, exportEnvelope.exportHashSha256);

  const presentationOnlyChange = clone(record);
  presentationOnlyChange.name = 'Renamed deal';
  presentationOnlyChange.savedAt = '2026-09-30T10:10:00.000Z';
  assert.strictEqual(computeSavedDealStateHash(presentationOnlyChange), computeSavedDealStateHash(record));
  const economicChange = clone(record);
  economicChange.inputs.buildingPrice += 1;
  assert.notStrictEqual(computeSavedDealStateHash(economicChange), computeSavedDealStateHash(record));

  const stale = evaluateGovernedDecisionOperationalState({
    savedDealRecord: record,
    asOf: '2026-10-02T10:00:00.000Z',
  });
  assert.strictEqual(stale.status, C5_OPERATIONAL_STATUS.HOLD_STALE);
  assert(stale.reasonCodes.includes('C5_RECONCILIATION_STALE_NOW'));
  assert.strictEqual(stale.canExport, false);
  assert.throws(
    () => buildGovernedDecisionOperationalExport({ savedDealRecord: record, generatedAt: '2026-10-02T10:00:00.000Z' }),
    (error) => error && error.code === 'C5_EXPORT_BLOCKED',
  );

  for (const [expectedContext, reason] of [
    [{ caseId: 'OTHER-CASE' }, 'C5_CASE_ID_MISMATCH'],
    [{ projectId: 'OTHER-PROJECT' }, 'C5_PROJECT_ID_MISMATCH'],
    [{ propertyRef: 'OTHER-PROPERTY' }, 'C5_PROPERTY_REF_MISMATCH'],
  ]) {
    const held = evaluateGovernedDecisionOperationalState({ savedDealRecord: record, expectedContext, asOf: '2026-09-30T10:00:00.000Z' });
    assert.strictEqual(held.status, C5_OPERATIONAL_STATUS.HOLD_SCOPE_MISMATCH);
    assert(held.reasonCodes.includes(reason));
    assert.strictEqual(held.canExport, false);
  }

  const tampered = clone(record);
  tampered.governedDealDecision.reconciliationSummary.analyticalValueIndicationSar += 1;
  expectSavedDealReason('INVALID_GOVERNED_DEAL_DECISION', tampered);
  const tamperedOperational = evaluateGovernedDecisionOperationalState({ savedDealRecord: tampered, asOf: '2026-09-30T10:00:00.000Z' });
  assert.strictEqual(tamperedOperational.status, C5_OPERATIONAL_STATUS.HOLD_INVALID_GOVERNED_DECISION);
  assert.strictEqual(tamperedOperational.canExport, false);

  const forgedAuthority = clone(record);
  forgedAuthority.governedDealDecision.authorityBoundary.transactionAuthority = true;
  expectSavedDealReason('INVALID_GOVERNED_DEAL_DECISION', forgedAuthority);

  const landRecord = clone(record);
  landRecord.mode = 'land';
  expectSavedDealReason('GOVERNED_DECISION_REQUIRES_BUILDING_MODE', landRecord);

  const noValuationCase = clone(record);
  delete noValuationCase.valuationCase;
  expectSavedDealReason('GOVERNED_DECISION_REQUIRES_VALUATION_CASE', noValuationCase);
  const noValuationOperational = evaluateGovernedDecisionOperationalState({ savedDealRecord: noValuationCase, asOf: '2026-09-30T10:00:00.000Z' });
  assert.strictEqual(noValuationOperational.status, C5_OPERATIONAL_STATUS.HOLD_SCOPE_MISMATCH);

  const projectMismatch = clone(record);
  projectMismatch.valuationCase.projectId = 'OTHER-PROJECT';
  expectSavedDealReason('GOVERNED_DECISION_PROJECT_MISMATCH', projectMismatch);
  const projectMismatchOperational = evaluateGovernedDecisionOperationalState({ savedDealRecord: projectMismatch, asOf: '2026-09-30T10:00:00.000Z' });
  assert.strictEqual(projectMismatchOperational.status, C5_OPERATIONAL_STATUS.HOLD_SCOPE_MISMATCH);
  assert(projectMismatchOperational.reasonCodes.includes('C5_VALUATION_CASE_PROJECT_MISMATCH'));

  const loadedValuationCase = valuationCaseFromSavedDeal(record);
  const uiContext = governedDecisionOperationalContextFromValuationCase(loadedValuationCase, { asOf: '2026-09-30T10:00:00.000Z' });
  assert(uiContext);
  assert.strictEqual(uiContext.viewModel.canExport, true);
  assert.strictEqual(uiContext.viewModel.sourceSavedDealStateOnly, undefined);

  const bridgeExport = buildGovernedDecisionOperationalExportFromValuationCase(loadedValuationCase, {
    reportId: 'REPORT-C5-BRIDGE',
    generatedAt: '2026-09-30T10:00:00.000Z',
  });
  assert.strictEqual(verifyGovernedDecisionOperationalExport(bridgeExport), true);
  assert.strictEqual(bridgeExport.transactionAuthorized, false);

  const baseForUnchangedUpdate = clone(record);
  delete baseForUnchangedUpdate.valuationCase;
  delete baseForUnchangedUpdate.governedDealDecision;
  baseForUnchangedUpdate.savedAt = '2026-09-30T10:15:00.000Z';
  const preserved = withValuationCase(baseForUnchangedUpdate, loadedValuationCase);
  assert(preserved.governedDealDecision);
  assert.strictEqual(preserved.governedDealDecision.snapshotHashSha256, record.governedDealDecision.snapshotHashSha256);

  const loadedValuationCaseChangedInputs = valuationCaseFromSavedDeal(record);
  const changedBase = clone(baseForUnchangedUpdate);
  changedBase.inputs.buildingPrice += 1000;
  const invalidated = withValuationCase(changedBase, loadedValuationCaseChangedInputs);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(invalidated, 'governedDealDecision'), false);
  assert.strictEqual(governedDecisionOperationalContextFromValuationCase(loadedValuationCaseChangedInputs, { asOf: '2026-09-30T10:00:00.000Z' }), null);

  const loadedValuationCaseReplaced = valuationCaseFromSavedDeal(record);
  const replacedValuationCase = clone(loadedValuationCaseReplaced);
  const replacementOutput = withValuationCase(baseForUnchangedUpdate, replacedValuationCase);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(replacementOutput, 'governedDealDecision'), false);

  const tamperedExport = clone(exportEnvelope);
  tamperedExport.report.reconciliation.analyticalValueIndicationSar += 1;
  assert.strictEqual(verifyGovernedDecisionOperationalExport(tamperedExport), false);

  console.log('C5 governed decision UI/export integration: PASS');
})();
