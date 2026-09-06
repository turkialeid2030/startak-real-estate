'use strict';

const { calculateInvestmentCase, STUDY_TYPE } = require('../engines');
const { ASSUMPTION_MODEL_VERSION } = require('./assumption-model');

function metricSnapshot(result) {
  return Object.freeze({
    assumptionModelVersion: result.assumptionModelVersion || ASSUMPTION_MODEL_VERSION.LEGACY,
    status: result.financialModelStatus || null,
    NOI: result.NOI,
    irr: result.irr,
    npv: result.npv,
    verdict: result.verdict,
    decisionStatus: result.decisionStatus,
    exitCapSource: result.exitCapSource || null,
    incompleteInputs: Array.isArray(result.incompleteInputs) ? [...result.incompleteInputs] : [],
  });
}

function buildAssumptionMigrationComparison({ inputs, leverageEnabled = false, v2ExitCapRate } = {}) {
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) {
    throw new TypeError('inputs must be an object');
  }

  const legacyInputs = { ...inputs };
  const v2Inputs = { ...inputs };
  if (v2ExitCapRate !== undefined) v2Inputs.exitCapRate = v2ExitCapRate;

  const legacyResult = calculateInvestmentCase({
    studyType: STUDY_TYPE.EXISTING_BUILDING,
    inputs: legacyInputs,
    leverageEnabled,
    assumptionModelVersion: ASSUMPTION_MODEL_VERSION.LEGACY,
  });
  const v2Result = calculateInvestmentCase({
    studyType: STUDY_TYPE.EXISTING_BUILDING,
    inputs: v2Inputs,
    leverageEnabled,
    assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
  });

  return Object.freeze({
    schemaVersion: 1,
    requiresExplicitUpgrade: true,
    sourceVersion: ASSUMPTION_MODEL_VERSION.LEGACY,
    targetVersion: ASSUMPTION_MODEL_VERSION.V2,
    legacy: metricSnapshot(legacyResult),
    v2: metricSnapshot(v2Result),
  });
}

module.exports = { buildAssumptionMigrationComparison, metricSnapshot };
