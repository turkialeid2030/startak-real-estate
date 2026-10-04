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

function cloneAssumptionRegistry(value) {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) return value;
  return value.map((item) => (
    item && typeof item === 'object' && !Array.isArray(item)
      ? { ...item }
      : item
  ));
}

function cloneDealRecord(record) {
  assertPlainObject(record, 'deal record');
  const cloned = {
    ...record,
    inputs: record.inputs && typeof record.inputs === 'object' && !Array.isArray(record.inputs)
      ? { ...record.inputs }
      : {},
  };

  // Assumption Registry is optional envelope metadata. Absence has a distinct
  // governed meaning (NOT_EVALUATED / no override provenance) and must remain
  // absence across clone/save boundaries. Materializing an absent registry as
  // `null` creates a structurally invalid Saved Deal because the persistence
  // schema intentionally requires any *present* registry to be an array.
  if (Object.prototype.hasOwnProperty.call(record, 'assumptionRegistry')) {
    cloned.assumptionRegistry = cloneAssumptionRegistry(record.assumptionRegistry);
  } else {
    delete cloned.assumptionRegistry;
  }

  return cloned;
}

function createFreshWorkspaceState(defaultInputs) {
  assertPlainObject(defaultInputs, 'defaultInputs');
  return {
    assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
    inputs: { ...defaultInputs },
    // P25: a fresh deal has no override provenance until the user supplies it.
    // `null` is intentional in workspace state and must never be expanded into
    // synthetic approval. Persistence keeps this as *absent* optional metadata.
    assumptionRegistry: null,
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
    assumptionRegistry: cloneAssumptionRegistry(record.assumptionRegistry),
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
  // remains incomplete until they are explicitly supplied. P25 override
  // provenance is carried forward byte-for-byte at the field level.
  return {
    ...upgraded,
    assumptionRegistry: cloneAssumptionRegistry(upgraded.assumptionRegistry),
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
