'use strict';

const crypto = require('crypto');
const {
  DEVELOPMENT_SENSITIVITY_INPUT_STATUS,
  verifyDevelopmentSensitivityInputIntegrity,
} = require('../../development/development-sensitivity');
const { DEVELOPER_RETURN_METHOD } = require('../../development/development-property');

const DEVELOPMENT_SENSITIVITY_MODEL_VERSION = 'DEVELOPMENT_SENSITIVITY_1.0';
const DEVELOPMENT_SENSITIVITY_RESULT_STATUS = Object.freeze({
  DEVELOPMENT_SENSITIVITY_READY: 'DEVELOPMENT_SENSITIVITY_READY',
  INVALID_INPUT_SET: 'INVALID_INPUT_SET',
  INVALID_SCENARIO_ECONOMICS: 'INVALID_SCENARIO_ECONOMICS',
});

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = stableClone(value[key]); return out; }, {});
}
function sha256(value) { return crypto.createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex'); }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
function fail(status, blockers, input = null) {
  return deepFreeze({
    schemaVersion: 1,
    modelVersion: DEVELOPMENT_SENSITIVITY_MODEL_VERSION,
    status,
    blockers,
    caseId: input?.caseId || null,
    propertyRef: input?.propertyRef || null,
    valuationDate: input?.valuationDate || null,
    scenarioResults: [],
    range: null,
    probabilitiesAssigned: false,
    monteCarloPerformed: false,
    automaticScenarioGeneration: false,
    automaticValuationSelection: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function calculateDevelopmentSensitivity(input, baseResidualResult) {
  if (!input || input.status !== DEVELOPMENT_SENSITIVITY_INPUT_STATUS.READY_FOR_CANONICAL_SENSITIVITY
      || input.readyForCanonicalSensitivity !== true || !verifyDevelopmentSensitivityInputIntegrity(input)) {
    return fail(DEVELOPMENT_SENSITIVITY_RESULT_STATUS.INVALID_INPUT_SET, ['DEVELOPMENT_SENSITIVITY_INPUT_NOT_READY_OR_INTEGRITY_FAILED'], input);
  }
  if (!baseResidualResult || baseResidualResult.caseId !== input.caseId || baseResidualResult.propertyRef !== input.propertyRef
      || baseResidualResult.calculationHashSha256 !== input.baseCalculationHashSha256) {
    return fail(DEVELOPMENT_SENSITIVITY_RESULT_STATUS.INVALID_INPUT_SET, ['BASE_RESIDUAL_RESULT_BINDING_FAILED'], input);
  }

  const base = {
    totalGdvSar: baseResidualResult.totalGdvSar,
    totalDevelopmentCostsSar: baseResidualResult.totalDevelopmentCostsSar,
    totalFinanceCostsSar: baseResidualResult.totalFinanceCostsSar,
    totalFeesSar: baseResidualResult.totalFeesSar,
    developerReturnMethod: baseResidualResult.developerReturnMethod,
    developerReturnInputValue: baseResidualResult.developerReturnInputValue,
    requiredDeveloperReturnSar: baseResidualResult.requiredDeveloperReturnSar,
    subjectLandAreaSqm: baseResidualResult.subjectLandAreaSqm,
    terminalMonth: baseResidualResult.terminalMonth,
  };
  if (![base.totalGdvSar, base.totalDevelopmentCostsSar, base.totalFinanceCostsSar, base.totalFeesSar, base.requiredDeveloperReturnSar, base.subjectLandAreaSqm].every(Number.isFinite)
      || base.totalGdvSar <= 0 || base.totalDevelopmentCostsSar <= 0 || base.subjectLandAreaSqm <= 0) {
    return fail(DEVELOPMENT_SENSITIVITY_RESULT_STATUS.INVALID_SCENARIO_ECONOMICS, ['BASE_ECONOMICS_INVALID'], input);
  }

  const scenarioResults = [];
  for (const scenario of input.scenarios) {
    const stressedGdvSar = base.totalGdvSar * scenario.gdvMultiplier;
    const stressedDevelopmentCostsSar = base.totalDevelopmentCostsSar * scenario.developmentCostMultiplier;
    const stressedFinanceCostsSar = base.totalFinanceCostsSar * scenario.financeCostMultiplier;
    const stressedFeesSar = base.totalFeesSar * scenario.feeMultiplier;
    const stressedDeveloperReturnSar = base.developerReturnMethod === DEVELOPER_RETURN_METHOD.PERCENT_OF_GDV
      ? stressedGdvSar * base.developerReturnInputValue * scenario.developerReturnMultiplier
      : base.requiredDeveloperReturnSar * scenario.developerReturnMultiplier;
    const residualLandValueSar = stressedGdvSar - stressedDevelopmentCostsSar - stressedFinanceCostsSar - stressedFeesSar - stressedDeveloperReturnSar;
    const residualLandValuePerSqm = residualLandValueSar / base.subjectLandAreaSqm;
    const shiftedTerminalMonth = base.terminalMonth + Math.max(scenario.gdvTimingShiftMonths, scenario.costTimingShiftMonths);
    if (![stressedGdvSar, stressedDevelopmentCostsSar, stressedFinanceCostsSar, stressedFeesSar, stressedDeveloperReturnSar, residualLandValueSar, residualLandValuePerSqm].every(Number.isFinite)
        || stressedGdvSar <= 0 || stressedDevelopmentCostsSar <= 0 || stressedFinanceCostsSar < 0 || stressedFeesSar < 0 || stressedDeveloperReturnSar <= 0 || shiftedTerminalMonth < 0) {
      return fail(DEVELOPMENT_SENSITIVITY_RESULT_STATUS.INVALID_SCENARIO_ECONOMICS, [`SCENARIO_ECONOMICS_INVALID:${scenario.scenarioId}`], input);
    }
    const reviewFlags = [];
    if (residualLandValueSar <= 0) reviewFlags.push('NON_POSITIVE_RESIDUAL_REVIEW_REQUIRED');
    if (scenario.gdvTimingShiftMonths !== 0 || scenario.costTimingShiftMonths !== 0) reviewFlags.push('TIMING_SHIFT_RECORDED_NO_DISCOUNTING_EFFECT_IN_WAVE_11D');
    scenarioResults.push({
      scenarioId: scenario.scenarioId,
      scenarioType: scenario.scenarioType,
      name: scenario.name,
      sensitivityScenarioHashSha256: scenario.sensitivityScenarioHashSha256,
      gdvMultiplier: scenario.gdvMultiplier,
      developmentCostMultiplier: scenario.developmentCostMultiplier,
      financeCostMultiplier: scenario.financeCostMultiplier,
      feeMultiplier: scenario.feeMultiplier,
      developerReturnMultiplier: scenario.developerReturnMultiplier,
      gdvTimingShiftMonths: scenario.gdvTimingShiftMonths,
      costTimingShiftMonths: scenario.costTimingShiftMonths,
      shiftedTerminalMonth,
      stressedGdvSar,
      stressedDevelopmentCostsSar,
      stressedFinanceCostsSar,
      stressedFeesSar,
      stressedDeveloperReturnSar,
      residualLandValueSar,
      residualLandValuePerSqm,
      probability: null,
      reviewFlags,
    });
  }

  const residuals = scenarioResults.map((item) => item.residualLandValueSar);
  const baseScenario = scenarioResults.find((item) => item.scenarioType === 'BASE');
  const minimumResidualSar = Math.min(...residuals);
  const maximumResidualSar = Math.max(...residuals);
  const core = {
    schemaVersion: 1,
    modelVersion: DEVELOPMENT_SENSITIVITY_MODEL_VERSION,
    caseId: input.caseId,
    propertyRef: input.propertyRef,
    valuationDate: input.valuationDate,
    sensitivityInputHashSha256: input.sensitivityInputHashSha256,
    baseCalculationHashSha256: input.baseCalculationHashSha256,
    scenarioResults,
    range: {
      baseResidualSar: baseScenario.residualLandValueSar,
      minimumResidualSar,
      maximumResidualSar,
      spreadSar: maximumResidualSar - minimumResidualSar,
      minimumResidualPerSqm: Math.min(...scenarioResults.map((item) => item.residualLandValuePerSqm)),
      maximumResidualPerSqm: Math.max(...scenarioResults.map((item) => item.residualLandValuePerSqm)),
    },
  };
  return deepFreeze({
    ...core,
    sensitivityCalculationHashSha256: sha256(core),
    status: DEVELOPMENT_SENSITIVITY_RESULT_STATUS.DEVELOPMENT_SENSITIVITY_READY,
    blockers: [],
    probabilitiesAssigned: false,
    monteCarloPerformed: false,
    randomSeedUsed: null,
    automaticScenarioGeneration: false,
    automaticValuationSelection: false,
    automaticUncertaintyClassification: false,
    timingDiscountingApplied: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'This deterministic sensitivity engine applies only explicit reviewed stress multipliers. Scenario timing shifts are recorded but have no valuation effect because Wave 11D introduces no discounting. The output is a scenario range, not a probability distribution, Monte Carlo result, reconciled land value, final valuation conclusion, certification, or transaction authorization.',
  });
}

module.exports = {
  DEVELOPMENT_SENSITIVITY_MODEL_VERSION,
  DEVELOPMENT_SENSITIVITY_RESULT_STATUS,
  calculateDevelopmentSensitivity,
};
