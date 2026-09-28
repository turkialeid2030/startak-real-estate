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

  // Provenance must survive hydration. Default UI exit assumptions must never be
  // injected into a Saved Deal that did not persist them, regardless of model
  // version. LEGACY then remains compatibility-derived; V2 remains missing and
  // fail-closed until the user explicitly enters the assumption.
  if (!Object.prototype.hasOwnProperty.call(recordInputs, 'exitCapRate')) {
    delete inputs.exitCapRate;
  }
  if (!Object.prototype.hasOwnProperty.call(recordInputs, 'exitTransferFeeRate')) {
    delete inputs.exitTransferFeeRate;
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
  // Upgrading changes the governing model version but must never invent new
  // deal evidence. If the legacy record did not persist exit assumptions, V2
  // remains incomplete until they are explicitly supplied.
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
