'use strict';

const {
  CONFIDENCE,
  evaluateAssumptionRegistry,
} = require('./assumption-registry');

const SAVED_DEAL_ASSUMPTION_REGISTRY_VERSION = 'SAVED_DEAL_ASSUMPTION_REGISTRY_V1';

class AssumptionRegistryPersistenceError extends Error {
  constructor(reasonCode, detail = null) {
    super(`Assumption registry persistence validation failed: ${reasonCode}`);
    this.name = 'AssumptionRegistryPersistenceError';
    this.reasonCode = reasonCode;
    this.detail = detail;
  }
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]));
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validateOptionalString(value, field, index) {
  if (value !== undefined && value !== null && typeof value !== 'string') {
    throw new AssumptionRegistryPersistenceError('INVALID_STRING_FIELD', `assumption[${index}].${field}`);
  }
}

function validatePersistedAssumptionRegistry(value) {
  if (!Array.isArray(value)) {
    throw new AssumptionRegistryPersistenceError('REGISTRY_NOT_ARRAY');
  }

  const ids = new Set();
  value.forEach((item, index) => {
    if (!isPlainObject(item)) throw new AssumptionRegistryPersistenceError('ASSUMPTION_NOT_OBJECT', `index=${index}`);
    if (typeof item.id !== 'string' || item.id.trim() === '') {
      throw new AssumptionRegistryPersistenceError('ASSUMPTION_ID_REQUIRED', `index=${index}`);
    }
    if (ids.has(item.id.trim())) throw new AssumptionRegistryPersistenceError('DUPLICATE_ASSUMPTION_ID', item.id.trim());
    ids.add(item.id.trim());

    const valueType = typeof item.value;
    const validValue = (valueType === 'number' && Number.isFinite(item.value))
      || valueType === 'string'
      || valueType === 'boolean';
    if (!validValue) throw new AssumptionRegistryPersistenceError('INVALID_ASSUMPTION_VALUE', `id=${item.id}`);

    if (item.critical !== undefined && typeof item.critical !== 'boolean') {
      throw new AssumptionRegistryPersistenceError('INVALID_CRITICAL_FLAG', `id=${item.id}`);
    }
    if (item.evidenceCount !== undefined && (!Number.isInteger(item.evidenceCount) || item.evidenceCount < 0)) {
      throw new AssumptionRegistryPersistenceError('INVALID_EVIDENCE_COUNT', `id=${item.id}`);
    }
    if (item.confidence !== undefined && !Object.values(CONFIDENCE).includes(item.confidence)) {
      throw new AssumptionRegistryPersistenceError('INVALID_CONFIDENCE', `id=${item.id}`);
    }
    if (item.override !== undefined && typeof item.override !== 'boolean') {
      throw new AssumptionRegistryPersistenceError('INVALID_OVERRIDE_FLAG', `id=${item.id}`);
    }
    if (item.override === true && (typeof item.overrideReason !== 'string' || item.overrideReason.trim() === '')) {
      throw new AssumptionRegistryPersistenceError('OVERRIDE_REASON_REQUIRED', `id=${item.id}`);
    }

    [
      'label', 'unit', 'sourceType', 'sourceReference', 'sourceDate', 'geography',
      'assetType', 'owner', 'reviewer', 'expiresAt', 'overrideReason',
    ].forEach((field) => validateOptionalString(item[field], field, index));
  });

  return value;
}

function assumptionRegistryFromSavedDeal(record) {
  if (!isPlainObject(record)) throw new TypeError('saved deal record must be an object');
  if (!Object.prototype.hasOwnProperty.call(record, 'assumptionRegistry')) return null;
  validatePersistedAssumptionRegistry(record.assumptionRegistry);
  return clone(record.assumptionRegistry);
}

function withAssumptionRegistry(record, assumptionRegistry) {
  if (!isPlainObject(record)) throw new TypeError('saved deal record must be an object');
  const { assumptionRegistry: _discarded, ...withoutRegistry } = record;
  if (assumptionRegistry === null || assumptionRegistry === undefined) return withoutRegistry;
  validatePersistedAssumptionRegistry(assumptionRegistry);
  return {
    ...withoutRegistry,
    assumptionRegistry: clone(assumptionRegistry),
    assumptionRegistryVersion: SAVED_DEAL_ASSUMPTION_REGISTRY_VERSION,
  };
}

function evaluateSavedDealAssumptionRegistry(record, options = {}) {
  if (!isPlainObject(record)) throw new TypeError('saved deal record must be an object');
  if (!Object.prototype.hasOwnProperty.call(record, 'assumptionRegistry')) {
    return Object.freeze({
      status: 'NOT_EVALUATED',
      assumptions: [],
      blockers: [],
      warnings: [],
      registryHashSha256: null,
      version: null,
    });
  }
  validatePersistedAssumptionRegistry(record.assumptionRegistry);
  const evaluated = evaluateAssumptionRegistry(record.assumptionRegistry, options);
  return Object.freeze({
    ...evaluated,
    version: record.assumptionRegistryVersion || SAVED_DEAL_ASSUMPTION_REGISTRY_VERSION,
  });
}

module.exports = {
  SAVED_DEAL_ASSUMPTION_REGISTRY_VERSION,
  AssumptionRegistryPersistenceError,
  validatePersistedAssumptionRegistry,
  assumptionRegistryFromSavedDeal,
  withAssumptionRegistry,
  evaluateSavedDealAssumptionRegistry,
};
