'use strict';

const crypto = require('crypto');
const {
  DEVELOPMENT_RESIDUAL_INPUT_STATUS,
  verifyDevelopmentResidualInputIntegrity,
} = require('./development-property');
const {
  DEVELOPMENT_RESIDUAL_RESULT_STATUS,
} = require('../engines/valuation/residual-land-value');

const DEVELOPMENT_SCENARIO_TYPE = Object.freeze({
  BASE: 'BASE',
  UPSIDE: 'UPSIDE',
  DOWNSIDE: 'DOWNSIDE',
  SEVERE: 'SEVERE',
  CUSTOM: 'CUSTOM',
});

const DEVELOPMENT_UNCERTAINTY_LEVEL = Object.freeze({
  LOW: 'LOW',
  MODERATE: 'MODERATE',
  HIGH: 'HIGH',
  EXCEPTIONAL: 'EXCEPTIONAL',
});

const DEVELOPMENT_SENSITIVITY_INPUT_STATUS = Object.freeze({
  READY_FOR_CANONICAL_SENSITIVITY: 'READY_FOR_CANONICAL_SENSITIVITY',
  HOLD_BASE_CASE: 'HOLD_BASE_CASE',
  HOLD_SCENARIOS: 'HOLD_SCENARIOS',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
});

function nonEmpty(value) { return typeof value === 'string' && value.trim().length > 0; }
function assertNonEmpty(value, field) { if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`); }
function assertEnum(value, enumeration, field) { if (!Object.values(enumeration).includes(value)) throw new TypeError(`${field} is invalid`); }
function iso(value, field) {
  assertNonEmpty(value, field);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return d.toISOString();
}
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
function validSha(value) { return nonEmpty(value) && /^[a-f0-9]{64}$/i.test(value); }
function multiplier(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 10) throw new TypeError(`${field} must be finite, > 0 and <= 10`);
}
function timingShift(value, field) {
  if (!Number.isInteger(value) || value < -120 || value > 120) throw new TypeError(`${field} must be an integer between -120 and 120 months`);
}

function createDevelopmentSensitivityScenario({
  scenarioId,
  caseId,
  propertyRef,
  scenarioType,
  name,
  gdvMultiplier,
  developmentCostMultiplier,
  financeCostMultiplier,
  feeMultiplier,
  developerReturnMultiplier,
  gdvTimingShiftMonths = 0,
  costTimingShiftMonths = 0,
  rationale,
  evidenceRefs,
  preparedByRef,
  preparedAt,
  reviewedByRef,
  reviewedAt,
  reviewEvidenceRef,
  probability,
} = {}) {
  for (const [field, value] of [['scenarioId', scenarioId], ['caseId', caseId], ['propertyRef', propertyRef], ['name', name], ['rationale', rationale], ['preparedByRef', preparedByRef], ['reviewedByRef', reviewedByRef], ['reviewEvidenceRef', reviewEvidenceRef]]) assertNonEmpty(value, field);
  assertEnum(scenarioType, DEVELOPMENT_SCENARIO_TYPE, 'scenarioType');
  [['gdvMultiplier', gdvMultiplier], ['developmentCostMultiplier', developmentCostMultiplier], ['financeCostMultiplier', financeCostMultiplier], ['feeMultiplier', feeMultiplier], ['developerReturnMultiplier', developerReturnMultiplier]].forEach(([field, value]) => multiplier(value, field));
  timingShift(gdvTimingShiftMonths, 'gdvTimingShiftMonths');
  timingShift(costTimingShiftMonths, 'costTimingShiftMonths');
  if (probability !== undefined && probability !== null) throw new TypeError('SCENARIO_PROBABILITY_NOT_ALLOWED_IN_WAVE_11D');
  if (!Array.isArray(evidenceRefs) || evidenceRefs.length === 0 || evidenceRefs.some((ref) => !nonEmpty(ref))) throw new TypeError('evidenceRefs must be a non-empty array');
  const preparedAtIso = iso(preparedAt, 'preparedAt');
  const reviewedAtIso = iso(reviewedAt, 'reviewedAt');
  if (Date.parse(reviewedAtIso) < Date.parse(preparedAtIso)) throw new TypeError('SENSITIVITY_SCENARIO_REVIEW_BEFORE_PREPARATION');
  const core = {
    schemaVersion: 1,
    scenarioId: scenarioId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    scenarioType,
    name: name.trim(),
    gdvMultiplier,
    developmentCostMultiplier,
    financeCostMultiplier,
    feeMultiplier,
    developerReturnMultiplier,
    gdvTimingShiftMonths,
    costTimingShiftMonths,
    rationale: rationale.trim(),
    evidenceRefs: [...new Set(evidenceRefs.map((ref) => ref.trim()))],
    preparedByRef: preparedByRef.trim(),
    preparedAt: preparedAtIso,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewedAtIso,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
    probability: null,
    automaticScenarioGeneration: false,
  };
  return deepFreeze({ ...core, sensitivityScenarioHashSha256: sha256(core) });
}

function verifyDevelopmentSensitivityScenarioIntegrity(scenario) {
  if (!scenario || !validSha(scenario.sensitivityScenarioHashSha256)) return false;
  const { sensitivityScenarioHashSha256, ...core } = scenario;
  return sha256(core) === scenario.sensitivityScenarioHashSha256.toLowerCase();
}

function residualResultCore(result) {
  return {
    schemaVersion: result.schemaVersion,
    modelVersion: result.modelVersion,
    caseId: result.caseId,
    propertyRef: result.propertyRef,
    valuationDate: result.valuationDate,
    inputPacketHashSha256: result.inputPacketHashSha256,
    propertyEvidencePacketHashSha256: result.propertyEvidencePacketHashSha256,
    hbuDecisionHashSha256: result.hbuDecisionHashSha256,
    developmentScenarioId: result.developmentScenarioId,
    developmentUse: result.developmentUse,
    developmentStartDate: result.developmentStartDate,
    terminalMonth: result.terminalMonth,
    subjectLandAreaMeasurement: result.subjectLandAreaMeasurement,
    subjectLandAreaSqm: result.subjectLandAreaSqm,
    totalGdvSar: result.totalGdvSar,
    totalDevelopmentCostsSar: result.totalDevelopmentCostsSar,
    totalFinanceCostsSar: result.totalFinanceCostsSar,
    totalFeesSar: result.totalFeesSar,
    developerReturnMethod: result.developerReturnMethod,
    developerReturnInputValue: result.developerReturnInputValue,
    requiredDeveloperReturnSar: result.requiredDeveloperReturnSar,
    residualLandValueSar: result.residualLandValueSar,
    residualLandValuePerSqm: result.residualLandValuePerSqm,
    nominalSchedule: result.nominalSchedule,
    timingConvention: result.timingConvention,
  };
}

function verifyResidualResultIntegrity(result) {
  return Boolean(result && validSha(result.calculationHashSha256) && sha256(residualResultCore(result)) === result.calculationHashSha256.toLowerCase());
}

function hold(status, blockers, context = {}) {
  return deepFreeze({
    schemaVersion: 1,
    caseId: context.caseId || null,
    propertyRef: context.propertyRef || null,
    status,
    blockers,
    readyForCanonicalSensitivity: false,
    probabilitiesAssigned: false,
    monteCarloPerformed: false,
    automaticScenarioGeneration: false,
    automaticValuationSelection: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function verifyDevelopmentSensitivityInputIntegrity(input) {
  if (!input || !validSha(input.sensitivityInputHashSha256)) return false;
  const { sensitivityInputHashSha256, ...payload } = input;
  const core = { ...payload };
  ['status','blockers','readyForCanonicalSensitivity','probabilitiesAssigned','monteCarloPerformed','automaticScenarioGeneration','automaticValuationSelection','finalValuationConclusionEstablished','certifiedValuationEstablished','transactionAuthorized','semantics'].forEach((key) => delete core[key]);
  return sha256(core) === input.sensitivityInputHashSha256.toLowerCase();
}

function buildDevelopmentSensitivityInput({
  sensitivityId,
  caseId,
  propertyRef,
  baseInputPacket,
  baseResidualResult,
  scenarios,
  preparedByRef,
  preparedAt,
  evidenceRef,
} = {}) {
  for (const [field, value] of [['sensitivityId', sensitivityId], ['caseId', caseId], ['propertyRef', propertyRef], ['preparedByRef', preparedByRef], ['evidenceRef', evidenceRef]]) assertNonEmpty(value, field);
  const preparedAtIso = iso(preparedAt, 'preparedAt');
  if (!baseInputPacket || baseInputPacket.caseId !== caseId || baseInputPacket.propertyRef !== propertyRef
      || baseInputPacket.status !== DEVELOPMENT_RESIDUAL_INPUT_STATUS.READY_FOR_CANONICAL_RESIDUAL_CALCULATION
      || !verifyDevelopmentResidualInputIntegrity(baseInputPacket)) {
    return hold(DEVELOPMENT_SENSITIVITY_INPUT_STATUS.HOLD_BASE_CASE, ['BASE_RESIDUAL_INPUT_NOT_READY_OR_INTEGRITY_FAILED'], { caseId, propertyRef });
  }
  if (!baseResidualResult || baseResidualResult.caseId !== caseId || baseResidualResult.propertyRef !== propertyRef
      || ![DEVELOPMENT_RESIDUAL_RESULT_STATUS.RESIDUAL_LAND_VALUE_INDICATION_READY, DEVELOPMENT_RESIDUAL_RESULT_STATUS.REVIEW_REQUIRED].includes(baseResidualResult.status)
      || baseResidualResult.inputPacketHashSha256 !== baseInputPacket.developmentResidualInputHashSha256
      || !verifyResidualResultIntegrity(baseResidualResult)) {
    return hold(DEVELOPMENT_SENSITIVITY_INPUT_STATUS.HOLD_BASE_CASE, ['BASE_RESIDUAL_RESULT_NOT_READY_OR_INTEGRITY_FAILED'], { caseId, propertyRef });
  }
  if (!Array.isArray(scenarios) || scenarios.length < 2) return hold(DEVELOPMENT_SENSITIVITY_INPUT_STATUS.HOLD_SCENARIOS, ['AT_LEAST_BASE_AND_ONE_STRESS_SCENARIO_REQUIRED'], { caseId, propertyRef });
  const ids = new Set();
  const blockers = [];
  let baseCount = 0;
  for (const scenario of scenarios) {
    if (!scenario || scenario.caseId !== caseId || scenario.propertyRef !== propertyRef) throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:sensitivityScenario');
    if (ids.has(scenario.scenarioId)) blockers.push(`DUPLICATE_SENSITIVITY_SCENARIO_ID:${scenario.scenarioId}`);
    ids.add(scenario.scenarioId);
    if (!verifyDevelopmentSensitivityScenarioIntegrity(scenario)) blockers.push(`SENSITIVITY_SCENARIO_INTEGRITY_FAILED:${scenario.scenarioId || 'UNKNOWN'}`);
    if (scenario.scenarioType === DEVELOPMENT_SCENARIO_TYPE.BASE) {
      baseCount += 1;
      const baseNeutral = scenario.gdvMultiplier === 1 && scenario.developmentCostMultiplier === 1 && scenario.financeCostMultiplier === 1
        && scenario.feeMultiplier === 1 && scenario.developerReturnMultiplier === 1 && scenario.gdvTimingShiftMonths === 0 && scenario.costTimingShiftMonths === 0;
      if (!baseNeutral) blockers.push(`BASE_SCENARIO_MUST_BE_NEUTRAL:${scenario.scenarioId}`);
    }
  }
  if (baseCount !== 1) blockers.push(`EXACTLY_ONE_BASE_SCENARIO_REQUIRED:${baseCount}`);
  if (blockers.length) return hold(DEVELOPMENT_SENSITIVITY_INPUT_STATUS.HOLD_SCENARIOS, blockers, { caseId, propertyRef });

  const core = {
    schemaVersion: 1,
    sensitivityId: sensitivityId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    valuationDate: baseInputPacket.valuationDate,
    baseInputPacketHashSha256: baseInputPacket.developmentResidualInputHashSha256,
    baseCalculationHashSha256: baseResidualResult.calculationHashSha256,
    scenarios: scenarios.map((scenario) => stableClone(scenario)),
    preparedByRef: preparedByRef.trim(),
    preparedAt: preparedAtIso,
    evidenceRef: evidenceRef.trim(),
    probabilityConvention: 'NO_PROBABILITIES_WAVE_11D',
  };
  return deepFreeze({
    ...core,
    sensitivityInputHashSha256: sha256(core),
    status: DEVELOPMENT_SENSITIVITY_INPUT_STATUS.READY_FOR_CANONICAL_SENSITIVITY,
    blockers: [],
    readyForCanonicalSensitivity: true,
    probabilitiesAssigned: false,
    monteCarloPerformed: false,
    automaticScenarioGeneration: false,
    automaticValuationSelection: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'Wave 11D sensitivity scenarios are explicit reviewed deterministic stresses. No probability, random sampling, Monte Carlo, automatic scenario generation, final valuation selection, certification, or transaction authority is introduced.',
  });
}

function recordDevelopmentUncertaintyAssessment({
  assessmentId,
  sensitivityResult,
  level,
  drivers,
  rationale,
  evidenceRefs,
  reviewedByRef,
  reviewedAt,
  reviewEvidenceRef,
} = {}) {
  for (const [field, value] of [['assessmentId', assessmentId], ['rationale', rationale], ['reviewedByRef', reviewedByRef], ['reviewEvidenceRef', reviewEvidenceRef]]) assertNonEmpty(value, field);
  assertEnum(level, DEVELOPMENT_UNCERTAINTY_LEVEL, 'level');
  if (!sensitivityResult || sensitivityResult.status !== 'DEVELOPMENT_SENSITIVITY_READY' || !validSha(sensitivityResult.sensitivityCalculationHashSha256)) throw new TypeError('QUALIFIED_DEVELOPMENT_SENSITIVITY_RESULT_REQUIRED');
  if (!Array.isArray(drivers) || drivers.length === 0 || drivers.some((driver) => !nonEmpty(driver))) throw new TypeError('drivers must be a non-empty array');
  if (!Array.isArray(evidenceRefs) || evidenceRefs.length === 0 || evidenceRefs.some((ref) => !nonEmpty(ref))) throw new TypeError('evidenceRefs must be a non-empty array');
  const core = {
    schemaVersion: 1,
    assessmentId: assessmentId.trim(),
    caseId: sensitivityResult.caseId,
    propertyRef: sensitivityResult.propertyRef,
    valuationDate: sensitivityResult.valuationDate,
    sensitivityCalculationHashSha256: sensitivityResult.sensitivityCalculationHashSha256,
    level,
    drivers: [...new Set(drivers.map((driver) => driver.trim()))],
    rationale: rationale.trim(),
    evidenceRefs: [...new Set(evidenceRefs.map((ref) => ref.trim()))],
    observedScenarioMinimumResidualSar: sensitivityResult.range.minimumResidualSar,
    observedScenarioMaximumResidualSar: sensitivityResult.range.maximumResidualSar,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: iso(reviewedAt, 'reviewedAt'),
    reviewEvidenceRef: reviewEvidenceRef.trim(),
    professionalJudgmentExplicit: true,
    automaticallyClassified: false,
  };
  return deepFreeze({
    ...core,
    uncertaintyAssessmentHashSha256: sha256(core),
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

module.exports = {
  DEVELOPMENT_SCENARIO_TYPE,
  DEVELOPMENT_UNCERTAINTY_LEVEL,
  DEVELOPMENT_SENSITIVITY_INPUT_STATUS,
  createDevelopmentSensitivityScenario,
  verifyDevelopmentSensitivityScenarioIntegrity,
  verifyResidualResultIntegrity,
  buildDevelopmentSensitivityInput,
  verifyDevelopmentSensitivityInputIntegrity,
  recordDevelopmentUncertaintyAssessment,
};
