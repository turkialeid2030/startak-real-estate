'use strict';

const assert = require('assert');
const {
  ASSUMPTION_MODEL_VERSION,
  V2_APPROVED_ASSUMPTIONS,
  applyAssumptionModel,
  normalizeAssumptionModelVersion,
} = require('../../src/assumptions/assumption-model');
const {
  readDealAssumptionVersion,
  createNewV2DealRecord,
  upgradeDealToV2,
  isLegacyCompatibilityDeal,
} = require('../../src/assumptions/deal-assumption-envelope');
const {
  EXIT_CAP_SOURCE,
  resolveExitCapRate,
} = require('../../src/engines/valuation/exit-cap-resolver');
const {
  EXTERNAL_DECISION_LABEL,
  externalizeInternalVerdict,
  renderDecisionSupportLabel,
} = require('../../src/compliance/decision-support');
const {
  getVerdictLabel,
  setVerdictPresentationMode,
  VERDICT_PRESENTATION_MODE,
} = require('../../src/i18n/domain-presentation');
const {
  AI_ROLE,
  AI_STAGE_STATUS,
  buildAiExpertStage,
  validateAiRoleOutput,
} = require('../../src/decision-intelligence/ai-expert-orchestrator');
const {
  SENSITIVITY_READINESS_STATUS,
  assessSensitivityReadiness,
  assertSensitivityReady,
} = require('../../src/sensitivity/readiness');
const {
  buildAssumptionDisclosureEnvelope,
} = require('../../src/assumptions/assumption-disclosure');

function run() {
  assert.strictEqual(normalizeAssumptionModelVersion(undefined), ASSUMPTION_MODEL_VERSION.LEGACY);
  assert.deepStrictEqual(V2_APPROVED_ASSUMPTIONS, {
    maintenanceRate: 0.05,
    managementFeeRate: 0.035,
    fixedOpexPerSqm: 40,
    replacementReservePerSqm: 20,
    opexGrowthRate: 0.02,
  });
  const baseInputs = { maintenanceRate: 0.01, marketCapRate: 0.07 };
  const appliedV2 = applyAssumptionModel(baseInputs, ASSUMPTION_MODEL_VERSION.V2);
  assert.strictEqual(baseInputs.maintenanceRate, 0.01);
  assert.strictEqual(appliedV2.maintenanceRate, 0.05);
  assert.strictEqual(appliedV2.managementFeeRate, 0.035);

  const legacyDeal = {
    id: 'legacy-1',
    mode: 'building',
    inputs: { marketCapRate: 0.07, maintenanceRate: 0.01 },
  };
  assert.strictEqual(readDealAssumptionVersion(legacyDeal), ASSUMPTION_MODEL_VERSION.LEGACY);
  assert.strictEqual(isLegacyCompatibilityDeal(legacyDeal), true);
  const newDeal = createNewV2DealRecord({ id: 'new-1', mode: 'building', inputs: { marketCapRate: 0.07 } });
  assert.strictEqual(newDeal.assumptionModelVersion, ASSUMPTION_MODEL_VERSION.V2);
  assert.throws(
    () => createNewV2DealRecord({ mode: 'building', inputs: {}, assumptionModelVersion: ASSUMPTION_MODEL_VERSION.LEGACY }),
    (error) => error && error.code === 'NEW_DEAL_REQUIRES_V2',
  );
  const upgraded = upgradeDealToV2(legacyDeal);
  assert.strictEqual(upgraded.assumptionModelVersion, ASSUMPTION_MODEL_VERSION.V2);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(upgraded.inputs, 'exitCapRate'), false);
  assert.strictEqual(upgraded.inputs.marketCapRate, 0.07);
  assert.strictEqual(upgraded.inputs.maintenanceRate, 0.05);
  assert.strictEqual(legacyDeal.inputs.maintenanceRate, 0.01);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(legacyDeal.inputs, 'exitCapRate'), false);

  const explicit = resolveExitCapRate(
    { marketCapRate: 0.07, exitCapRate: 0.08 },
    { assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2 },
  );
  assert.strictEqual(explicit.status, EXIT_CAP_SOURCE.EXPLICIT);
  assert.strictEqual(explicit.value, 0.08);

  const legacyDerived = resolveExitCapRate(
    { marketCapRate: 0.07 },
    { assumptionModelVersion: ASSUMPTION_MODEL_VERSION.LEGACY },
  );
  assert.strictEqual(legacyDerived.status, EXIT_CAP_SOURCE.LEGACY_DERIVED);
  assert.strictEqual(legacyDerived.value, 0.07);
  assert.strictEqual(legacyDerived.requiresVisibleDisclosure, true);

  const v2Missing = resolveExitCapRate(
    { marketCapRate: 0.07 },
    { assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2 },
  );
  assert.strictEqual(v2Missing.status, EXIT_CAP_SOURCE.MISSING_REQUIRED);
  assert.strictEqual(v2Missing.value, null);
  assert.strictEqual(v2Missing.missingRequiredField, 'exitCapRate');

  const incompleteLabel = externalizeInternalVerdict('INCOMPLETE_INPUTS');
  assert.strictEqual(incompleteLabel, EXTERNAL_DECISION_LABEL.INCOMPLETE_INPUTS);
  assert.strictEqual(
    renderDecisionSupportLabel(incompleteLabel, 'ar'),
    'المدخلات غير مكتملة — يلزم استكمال الافتراضات المطلوبة',
  );
  assert.strictEqual(
    renderDecisionSupportLabel(incompleteLabel, 'en'),
    'Incomplete Inputs — Required Assumptions Must Be Completed',
  );

  const tAr = (key) => key === 'app.title' ? 'دراسات الجدوى العقارية' : key;
  const tEn = (key) => key === 'app.title' ? 'Real Estate Feasibility Studies' : key;
  setVerdictPresentationMode(VERDICT_PRESENTATION_MODE.LEGACY_CHARACTERIZATION);
  assert.strictEqual(getVerdictLabel('INCOMPLETE_INPUTS', tAr), 'المدخلات غير مكتملة — يلزم استكمال الافتراضات المطلوبة');
  assert.strictEqual(getVerdictLabel('INCOMPLETE_INPUTS', tEn), 'Incomplete Inputs — Required Assumptions Must Be Completed');
  setVerdictPresentationMode(VERDICT_PRESENTATION_MODE.EXTERNAL_DECISION_SUPPORT);
  assert.strictEqual(getVerdictLabel('INCOMPLETE_INPUTS', tAr), 'المدخلات غير مكتملة — يلزم استكمال الافتراضات المطلوبة');
  assert.throws(() => getVerdictLabel('UNMAPPED_TEST_VERDICT', tEn), /Unmapped recommendation verdict/);
  setVerdictPresentationMode(VERDICT_PRESENTATION_MODE.LEGACY_CHARACTERIZATION);

  const decisionQuality = {
    caseId: 'CASE-W2',
    projectId: 'PROJECT-W2',
    status: 'READY_FOR_HUMAN_REVIEW',
    reliability: { overallReliability: 'HIGH' },
    feedback: {},
    dueDiligence: {},
  };
  const dossier = {
    caseId: 'CASE-W2',
    projectId: 'PROJECT-W2',
    dossierStatus: 'READY_FOR_HUMAN_REVIEW',
    aiNarrativeContext: { factRefs: [] },
  };
  const aiStage = buildAiExpertStage({
    role: AI_ROLE.ANALYST,
    caseId: 'CASE-W2',
    projectId: 'PROJECT-W2',
    contextVersionId: 'CTX-W2',
    evidenceHash: 'sha256:test-wave2',
    decisionQuality,
    dossier,
    financialModelStatus: 'INCOMPLETE_INPUTS',
  });
  assert.strictEqual(aiStage.status, AI_STAGE_STATUS.HOLD_INCOMPLETE_INPUTS);
  assert.strictEqual(aiStage.modelCallExecuted, false);
  assert.strictEqual(aiStage.transactionAuthorized, false);
  assert.ok(aiStage.holdReasons.includes('FINANCIAL_MODEL_INCOMPLETE_INPUTS'));
  const rejectedOutput = validateAiRoleOutput({ stage: aiStage, output: {} });
  assert.strictEqual(rejectedOutput.accepted, false);
  assert.deepStrictEqual(rejectedOutput.reasonCodes, ['STAGE_NOT_READY']);

  const sensitivityHold = assessSensitivityReadiness({
    financialModelStatus: 'INCOMPLETE_INPUTS',
    exitCapSource: EXIT_CAP_SOURCE.MISSING_REQUIRED,
  });
  assert.strictEqual(sensitivityHold.status, SENSITIVITY_READINESS_STATUS.HOLD_INCOMPLETE_INPUTS);
  assert.strictEqual(sensitivityHold.ready, false);
  assert.strictEqual(sensitivityHold.numericPlaceholder, null);
  assert.strictEqual(Number.isNaN(sensitivityHold.numericPlaceholder), false);
  assert.ok(sensitivityHold.blockedMetrics.includes('irr'));
  assert.ok(sensitivityHold.blockedMetrics.includes('npv'));
  assert.throws(
    () => assertSensitivityReady({ financialModelStatus: 'INCOMPLETE_INPUTS', exitCapSource: EXIT_CAP_SOURCE.MISSING_REQUIRED }),
    (error) => error && error.code === 'SENSITIVITY_HOLD_INCOMPLETE_INPUTS',
  );
  const sensitivityReady = assessSensitivityReadiness({ financialModelStatus: 'VALID', exitCapSource: EXIT_CAP_SOURCE.EXPLICIT });
  assert.strictEqual(sensitivityReady.ready, true);

  const v2Disclosure = buildAssumptionDisclosureEnvelope({
    assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
    exitCapSource: EXIT_CAP_SOURCE.MISSING_REQUIRED,
  });
  assert.strictEqual(v2Disclosure.assumptionModelVersion, ASSUMPTION_MODEL_VERSION.V2);
  assert.strictEqual(v2Disclosure.requiresExplicitExitCap, true);
  assert.strictEqual(v2Disclosure.exportMetadata.exitCapRequired, true);
  assert.strictEqual(v2Disclosure.badge.ar, 'إصدار الافتراضات V2');
  assert.strictEqual(v2Disclosure.badge.en, 'Assumption Model V2');
  assert.strictEqual(v2Disclosure.transactionAuthorized, false);
  assert.deepStrictEqual(v2Disclosure.approvedAssumptionKeys, Object.keys(V2_APPROVED_ASSUMPTIONS));

  const legacyDisclosure = buildAssumptionDisclosureEnvelope({
    assumptionModelVersion: ASSUMPTION_MODEL_VERSION.LEGACY,
    exitCapSource: EXIT_CAP_SOURCE.LEGACY_DERIVED,
  });
  assert.strictEqual(legacyDisclosure.legacyCompatibility, true);
  assert.ok(legacyDisclosure.exitCapNotice.ar.includes('توافق قديم'));
  assert.ok(legacyDisclosure.exitCapNotice.en.includes('Legacy compatibility'));

  console.log('WAVE2_ASSUMPTION_MODEL=PASS');
  console.log('WAVE2_EXIT_CAP_POLICY=PASS');
  console.log('WAVE2_SAVED_DEAL_MIGRATION=PASS');
  console.log('WAVE2_INCOMPLETE_PRESENTATION=PASS');
  console.log('WAVE2_AI_INCOMPLETE_GATE=PASS');
  console.log('WAVE2_SENSITIVITY_READINESS=PASS');
  console.log('WAVE2_ASSUMPTION_DISCLOSURE=PASS');
}

run();
