'use strict';

const {
  ASSUMPTION_MODEL_VERSION,
  normalizeAssumptionModelVersion,
} = require('../../assumptions/assumption-model');

const EXIT_CAP_SOURCE = Object.freeze({
  EXPLICIT: 'EXPLICIT',
  LEGACY_DERIVED: 'LEGACY_DERIVED',
  MISSING_REQUIRED: 'MISSING_REQUIRED',
});

function positiveFinite(value) {
  return Number.isFinite(value) && value > 0 ? value : null;
}

function resolveExitCapRate(inputs, { assumptionModelVersion } = {}) {
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) {
    throw new TypeError('inputs must be an object');
  }
  const version = normalizeAssumptionModelVersion(assumptionModelVersion);
  const explicit = positiveFinite(inputs.exitCapRate);
  if (explicit !== null) {
    return Object.freeze({
      version,
      status: EXIT_CAP_SOURCE.EXPLICIT,
      value: explicit,
      requiresVisibleDisclosure: false,
      missingRequiredField: null,
    });
  }

  if (version === ASSUMPTION_MODEL_VERSION.V2) {
    return Object.freeze({
      version,
      status: EXIT_CAP_SOURCE.MISSING_REQUIRED,
      value: null,
      requiresVisibleDisclosure: true,
      missingRequiredField: 'exitCapRate',
    });
  }

  const legacyDerived = positiveFinite(inputs.marketCapRate);
  if (legacyDerived === null) {
    return Object.freeze({
      version,
      status: EXIT_CAP_SOURCE.MISSING_REQUIRED,
      value: null,
      requiresVisibleDisclosure: true,
      missingRequiredField: 'exitCapRate',
    });
  }

  return Object.freeze({
    version,
    status: EXIT_CAP_SOURCE.LEGACY_DERIVED,
    value: legacyDerived,
    requiresVisibleDisclosure: true,
    missingRequiredField: null,
  });
}

module.exports = {
  EXIT_CAP_SOURCE,
  resolveExitCapRate,
};
