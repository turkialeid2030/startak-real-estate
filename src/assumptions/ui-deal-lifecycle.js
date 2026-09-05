'use strict';

const {
  ASSUMPTION_MODEL_VERSION,
  normalizeAssumptionModelVersion,
} = require('./assumption-model');
const {
  readDealAssumptionVersion,
  createNewV2DealRecord,
  upgradeDealToV2,
} = require('./deal-assumption-envelope');

function assertPlainObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

function cloneDealRecord(record) {
  assertPlainObject(record, 'deal record');
  return {
    ...record,
    inputs: record.inputs && typeof record.inputs === 'object' && !Array.isArray(record.inputs)
      ? { ...record.inputs }
      : {},
  };
}

function createFreshWorkspaceState(defaultInputs) {
  assertPlainObject(defaultInputs, 'defaultInputs');
  return {
    assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
    inputs: { ...defaultInputs },
    legacyCompatibility: false,
    explicitUpgradeRequired: false,
    transactionAuthorized: false,
  };
}

function hydrateSavedDealForUi(record, defaultInputs) {
  assertPlainObject(record, 'deal record');
  assertPlainObject(defaultInputs, 'defaultInputs');
  const recordInputs = record.inputs && typeof record.inputs === 'object' && !Array.isArray(record.inputs)
    ? record.inputs
    : {};
  const assumptionModelVersion = readDealAssumptionVersion(record);
  const inputs = { ...defaultInputs, ...recordInputs };

  // Provenance must survive hydration. A default UI exit cap must never be
  // injected into a Saved Deal that did not persist one, regardless of model
  // version. Legacy then remains LEGACY_DERIVED; V2 remains MISSING_REQUIRED.
  if (!Object.prototype.hasOwnProperty.call(recordInputs, 'exitCapRate')) {
    delete inputs.exitCapRate;
  }

  return {
    assumptionModelVersion,
    inputs,
    legacyCompatibility: assumptionModelVersion === ASSUMPTION_MODEL_VERSION.LEGACY,
    explicitUpgradeRequired: assumptionModelVersion === ASSUMPTION_MODEL_VERSION.LEGACY,
    transactionAuthorized: false,
  };
}

function buildNewSavedDealRecord(record) {
  return createNewV2DealRecord(cloneDealRecord(record));
}

function buildUpdatedSavedDealRecord(record, assumptionModelVersion) {
  const next = cloneDealRecord(record);
  next.assumptionModelVersion = normalizeAssumptionModelVersion(assumptionModelVersion);
  return next;
}

function explicitlyUpgradeUiDeal(record) {
  const upgraded = upgradeDealToV2(cloneDealRecord(record));
  return {
    ...upgraded,
    transactionAuthorized: false,
  };
}

module.exports = {
  createFreshWorkspaceState,
  hydrateSavedDealForUi,
  buildNewSavedDealRecord,
  buildUpdatedSavedDealRecord,
  explicitlyUpgradeUiDeal,
};
