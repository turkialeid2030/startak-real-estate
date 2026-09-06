'use strict';

const {
  ASSUMPTION_MODEL_VERSION,
  V2_APPROVED_ASSUMPTIONS,
  normalizeAssumptionModelVersion,
} = require('./assumption-model');

function cloneRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new TypeError('deal record must be an object');
  }
  return {
    ...record,
    inputs: record.inputs && typeof record.inputs === 'object' && !Array.isArray(record.inputs)
      ? { ...record.inputs }
      : {},
  };
}

function readDealAssumptionVersion(record) {
  return normalizeAssumptionModelVersion(record && record.assumptionModelVersion);
}

function createNewV2DealRecord(record) {
  const next = cloneRecord(record);
  if (record.assumptionModelVersion != null && record.assumptionModelVersion !== ASSUMPTION_MODEL_VERSION.V2) {
    const error = new Error('New deals must be written with assumptionModelVersion V2');
    error.code = 'NEW_DEAL_REQUIRES_V2';
    throw error;
  }
  next.assumptionModelVersion = ASSUMPTION_MODEL_VERSION.V2;
  return next;
}

function upgradeDealToV2(record) {
  const next = cloneRecord(record);
  const fromVersion = readDealAssumptionVersion(record);
  if (fromVersion === ASSUMPTION_MODEL_VERSION.V2) return next;
  next.assumptionModelVersion = ASSUMPTION_MODEL_VERSION.V2;
  next.inputs = {
    ...next.inputs,
    ...V2_APPROVED_ASSUMPTIONS,
  };
  // exitCapRate is intentionally not derived during migration. A legacy deal
  // that relied on marketCapRate remains incomplete under V2 until the user
  // provides an explicit exit assumption.
  if (!Object.prototype.hasOwnProperty.call(record.inputs || {}, 'exitCapRate')) {
    delete next.inputs.exitCapRate;
  }
  return next;
}

function isLegacyCompatibilityDeal(record) {
  return readDealAssumptionVersion(record) === ASSUMPTION_MODEL_VERSION.LEGACY;
}

module.exports = {
  readDealAssumptionVersion,
  createNewV2DealRecord,
  upgradeDealToV2,
  isLegacyCompatibilityDeal,
};
