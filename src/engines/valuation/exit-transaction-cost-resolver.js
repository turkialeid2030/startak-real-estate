'use strict';

const {
  ASSUMPTION_MODEL_VERSION,
  normalizeAssumptionModelVersion,
} = require('../../assumptions/assumption-model');

const EXIT_TRANSACTION_COST_SOURCE = Object.freeze({
  EXPLICIT: 'EXPLICIT',
  LEGACY_ACQUISITION_RATE_FALLBACK: 'LEGACY_ACQUISITION_RATE_FALLBACK',
  MISSING_REQUIRED: 'MISSING_REQUIRED',
});

function validRate(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}

/**
 * Resolve the economic seller-borne exit transaction-cost assumption for an
 * existing-building study.
 *
 * LEGACY preserves historical economics by falling back to the acquisition
 * transferFeeRate when no dedicated exit rate was persisted. V2 requires an
 * explicit exitTransferFeeRate, including an explicit 0 when no seller-borne
 * exit cost is assumed. This resolver does not determine the statutory Saudi
 * RETT taxpayer and does not infer exemptions.
 */
function resolveExitTransactionCostRate(inputs, { assumptionModelVersion } = {}) {
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) {
    throw new TypeError('inputs must be an object');
  }
  const version = normalizeAssumptionModelVersion(assumptionModelVersion);
  const explicit = validRate(inputs.exitTransferFeeRate);
  if (explicit !== null) {
    return Object.freeze({
      version,
      status: EXIT_TRANSACTION_COST_SOURCE.EXPLICIT,
      value: explicit,
      requiresVisibleDisclosure: false,
      missingRequiredField: null,
      statutoryTaxpayerDetermined: false,
    });
  }

  if (version === ASSUMPTION_MODEL_VERSION.V2) {
    return Object.freeze({
      version,
      status: EXIT_TRANSACTION_COST_SOURCE.MISSING_REQUIRED,
      value: null,
      requiresVisibleDisclosure: true,
      missingRequiredField: 'exitTransferFeeRate',
      statutoryTaxpayerDetermined: false,
    });
  }

  const legacyFallback = validRate(inputs.transferFeeRate);
  if (legacyFallback === null) {
    return Object.freeze({
      version,
      status: EXIT_TRANSACTION_COST_SOURCE.MISSING_REQUIRED,
      value: null,
      requiresVisibleDisclosure: true,
      missingRequiredField: 'exitTransferFeeRate',
      statutoryTaxpayerDetermined: false,
    });
  }

  return Object.freeze({
    version,
    status: EXIT_TRANSACTION_COST_SOURCE.LEGACY_ACQUISITION_RATE_FALLBACK,
    value: legacyFallback,
    requiresVisibleDisclosure: true,
    missingRequiredField: null,
    statutoryTaxpayerDetermined: false,
  });
}

module.exports = {
  EXIT_TRANSACTION_COST_SOURCE,
  resolveExitTransactionCostRate,
};
