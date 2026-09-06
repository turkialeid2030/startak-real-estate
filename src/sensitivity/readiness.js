'use strict';

const { EXIT_CAP_SOURCE } = require('../engines/valuation/exit-cap-resolver');

const SENSITIVITY_READINESS_STATUS = Object.freeze({
  READY: 'READY',
  HOLD_INCOMPLETE_INPUTS: 'HOLD_INCOMPLETE_INPUTS',
});

const EXIT_DEPENDENT_METRICS = Object.freeze([
  'terminalSaleValue',
  'terminalNetSaleProceeds',
  'irr',
  'npv',
  'leveredIRR',
  'leveredNPV',
]);

function assessSensitivityReadiness({ financialModelStatus = null, exitCapSource = null } = {}) {
  const exitCapMissing = exitCapSource === EXIT_CAP_SOURCE.MISSING_REQUIRED;
  const incompleteFinancialModel = financialModelStatus === 'INCOMPLETE_INPUTS';

  if (exitCapMissing || incompleteFinancialModel) {
    return Object.freeze({
      schemaVersion: 1,
      status: SENSITIVITY_READINESS_STATUS.HOLD_INCOMPLETE_INPUTS,
      ready: false,
      reasonCodes: Object.freeze(['EXIT_CAP_RATE_REQUIRED']),
      blockedMetrics: EXIT_DEPENDENT_METRICS,
      renderPolicy: 'SHOW_CONTROLLED_UNAVAILABLE_STATE',
      numericPlaceholder: null,
      transactionAuthorized: false,
      semantics: 'Sensitivity outputs that depend on a missing required exit capitalization rate are unavailable. The caller must render a controlled unavailable state and must not coerce the missing value to NaN, zero, or a market-cap fallback.',
    });
  }

  return Object.freeze({
    schemaVersion: 1,
    status: SENSITIVITY_READINESS_STATUS.READY,
    ready: true,
    reasonCodes: Object.freeze([]),
    blockedMetrics: Object.freeze([]),
    renderPolicy: 'RENDER_SENSITIVITY_OUTPUTS',
    numericPlaceholder: null,
    transactionAuthorized: false,
    semantics: 'Sensitivity analysis may proceed using explicit, validated engine inputs. This readiness contract does not calculate or authorize an investment decision.',
  });
}

function assertSensitivityReady(input) {
  const readiness = assessSensitivityReadiness(input);
  if (!readiness.ready) {
    const error = new Error('SENSITIVITY_HOLD_INCOMPLETE_INPUTS');
    error.code = 'SENSITIVITY_HOLD_INCOMPLETE_INPUTS';
    error.readiness = readiness;
    throw error;
  }
  return readiness;
}

module.exports = {
  SENSITIVITY_READINESS_STATUS,
  EXIT_DEPENDENT_METRICS,
  assessSensitivityReadiness,
  assertSensitivityReady,
};
