'use strict';

const { normalizeAssumptionModelVersion } = require('./assumption-model');
const { buildAssumptionDisclosureEnvelope } = require('./assumption-disclosure');
const { assessSensitivityReadiness } = require('../sensitivity/readiness');
const { EXIT_CAP_SOURCE } = require('../engines/valuation/exit-cap-resolver');

function formatOptionalPercentInput(value) {
  if (value === undefined || value === null || value === '') return '';
  if (!Number.isFinite(value)) {
    const error = new TypeError('optional percent value must be finite when present');
    error.code = 'OPTIONAL_PERCENT_NON_FINITE';
    throw error;
  }
  return String(Number((value * 100).toFixed(4)));
}

function parseOptionalPercentInput(raw, { min = 0, max = 1 } = {}) {
  const text = String(raw ?? '').trim();
  if (text === '') return Object.freeze({ present: false, value: undefined });
  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(text)) {
    const error = new Error('optional percent input must be a valid numeric percentage or blank');
    error.code = 'OPTIONAL_PERCENT_INVALID';
    throw error;
  }
  const percent = Number(text);
  const value = percent / 100;
  if (!Number.isFinite(value) || value < min || value > max) {
    const error = new RangeError(`optional percent input must be between ${min * 100}% and ${max * 100}%`);
    error.code = 'OPTIONAL_PERCENT_OUT_OF_RANGE';
    throw error;
  }
  return Object.freeze({ present: true, value });
}

function applyOptionalPercentToInputs(inputs, key, parsed) {
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) {
    throw new TypeError('inputs must be an object');
  }
  if (typeof key !== 'string' || key.length === 0) {
    throw new TypeError('key must be a non-empty string');
  }
  if (!parsed || typeof parsed !== 'object' || typeof parsed.present !== 'boolean') {
    throw new TypeError('parsed optional-percent state is required');
  }
  const next = { ...inputs };
  if (!parsed.present) delete next[key];
  else next[key] = parsed.value;
  return next;
}

function buildUiAssumptionGovernance({ assumptionModelVersion, financialResults }) {
  if (!financialResults || typeof financialResults !== 'object' || Array.isArray(financialResults)) {
    throw new TypeError('financialResults must be an object');
  }
  const version = normalizeAssumptionModelVersion(assumptionModelVersion);
  const exitCapSource = financialResults.exitCapSource || null;
  const disclosure = buildAssumptionDisclosureEnvelope({
    assumptionModelVersion: version,
    exitCapSource,
  });
  const sensitivity = assessSensitivityReadiness({
    financialModelStatus: financialResults.financialModelStatus,
    exitCapSource,
  });
  const exitCapInputRequired = disclosure.requiresExplicitExitCap
    && exitCapSource === EXIT_CAP_SOURCE.MISSING_REQUIRED;

  return Object.freeze({
    assumptionModelVersion: version,
    disclosure,
    sensitivity,
    exitCapInputRequired,
    sensitivityReady: sensitivity.status === 'READY',
    transactionAuthorized: false,
  });
}

module.exports = {
  formatOptionalPercentInput,
  parseOptionalPercentInput,
  applyOptionalPercentToInputs,
  buildUiAssumptionGovernance,
};
