'use strict';

const VALUATION_CASE_SCHEMA_VERSION = 1;

const SAVED_DEAL_VALUATION_MODE = Object.freeze({
  LEGACY_ONLY: 'LEGACY_ONLY',
  VALUATION_V1: 'VALUATION_V1',
});

class ValuationCaseValidationError extends Error {
  constructor(reasonCode, detail) {
    super(`Valuation case structural validation failed: ${reasonCode}`);
    this.name = 'ValuationCaseValidationError';
    this.reasonCode = reasonCode;
    this.detail = detail;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireObject(value, field) {
  if (!isPlainObject(value)) throw new ValuationCaseValidationError('INVALID_OBJECT', field);
  return value;
}

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new ValuationCaseValidationError('INVALID_STRING', field);
  return value;
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]));
}

function validateOptionalObject(container, field) {
  if (!Object.prototype.hasOwnProperty.call(container, field)) return;
  if (container[field] === null) return;
  requireObject(container[field], field);
}

function validateValuationCaseExtension(extension) {
  requireObject(extension, 'valuationCase');
  if (extension.schemaVersion !== VALUATION_CASE_SCHEMA_VERSION) {
    throw new ValuationCaseValidationError('UNSUPPORTED_SCHEMA_VERSION', `schemaVersion=${String(extension.schemaVersion)}`);
  }
  requireNonEmptyString(extension.projectId, 'projectId');
  requireObject(extension.classification, 'classification');
  requireObject(extension.incomePolicy, 'incomePolicy');

  for (const field of [
    'costPolicy',
    'marketComparableInput',
    'evidence',
    'evidencePolicy',
    'criticalEvidenceRequirements',
    'reconciliationPolicy',
  ]) validateOptionalObject(extension, field);

  return extension;
}

function getSavedDealValuationMode(record) {
  requireObject(record, 'savedDeal');
  if (!Object.prototype.hasOwnProperty.call(record, 'valuationCase')) return SAVED_DEAL_VALUATION_MODE.LEGACY_ONLY;
  validateValuationCaseExtension(record.valuationCase);
  return SAVED_DEAL_VALUATION_MODE.VALUATION_V1;
}

function attachValuationCase(record, extension) {
  requireObject(record, 'savedDeal');
  validateValuationCaseExtension(extension);
  return {
    ...record,
    valuationCase: clone(extension),
  };
}

module.exports = {
  VALUATION_CASE_SCHEMA_VERSION,
  SAVED_DEAL_VALUATION_MODE,
  ValuationCaseValidationError,
  validateValuationCaseExtension,
  getSavedDealValuationMode,
  attachValuationCase,
};
