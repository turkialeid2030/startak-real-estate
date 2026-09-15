// src/validation/saved-deal-schema.js -- SDI-001: canonical STRUCTURAL
// validation boundary for a parsed Saved Deal record, applied after
// JSON.parse succeeds but before the record is trusted (setMode/setInputs).
//
// Scope discipline (per SDI-001 mandate):
// - STRUCTURE only (shape/type of required fields) -- NOT economic-domain
//   validation. Economic rules remain exclusively in numeric-safety.js.
// - Non-destructive: never mutates, repairs, or deletes anything.
// - Legacy records without additive metadata remain valid.

const { hydrateResidentialIncomeOperatingCaseSnapshot } = require('../residential-income-acquisition/operating-case-snapshot');
const { validateValuationCaseExtension } = require('../valuation-intelligence/saved-deal-extension');
const { ASSUMPTION_MODEL_VERSION } = require('../assumptions/assumption-model');
const { validateUserEnteredZakatCase } = require('../zakat/user-entered-zakat');
const { validateSavedDealStandardsMetadata, RESERVED_METADATA_KEYS } = require('../standards/saved-deal-standards-snapshot');
const { DEAL_PROVENANCE } = require('../decision-governance/deal-provenance');

class SavedDealValidationError extends Error {
  constructor(reasonCode, detail) {
    super(`Saved Deal structural validation failed: ${reasonCode}`);
    this.name = 'SavedDealValidationError';
    this.reasonCode = reasonCode;
    this.detail = detail;
  }
}

const VALID_MODES = ['building', 'land'];

function validateSavedDealRecord(parsed) {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new SavedDealValidationError('ENVELOPE_NOT_OBJECT', `typeof=${Array.isArray(parsed) ? 'array' : typeof parsed}`);
  }

  if (typeof parsed.mode !== 'string' || !VALID_MODES.includes(parsed.mode)) {
    throw new SavedDealValidationError('INVALID_MODE', `mode=${JSON.stringify(parsed.mode)}`);
  }

  if (parsed.inputs === null || typeof parsed.inputs !== 'object' || Array.isArray(parsed.inputs)) {
    throw new SavedDealValidationError('INVALID_INPUTS_SHAPE', `typeof=${Array.isArray(parsed.inputs) ? 'array' : typeof parsed.inputs}`);
  }

  const nestedStandardsKeys = RESERVED_METADATA_KEYS.filter((key) => Object.prototype.hasOwnProperty.call(parsed.inputs, key));
  if (nestedStandardsKeys.length) {
    throw new SavedDealValidationError('STANDARDS_METADATA_IN_ECONOMIC_INPUTS', nestedStandardsKeys.join(','));
  }
  if (Object.prototype.hasOwnProperty.call(parsed.inputs, 'provenance')) {
    throw new SavedDealValidationError('DEAL_PROVENANCE_IN_ECONOMIC_INPUTS', 'provenance');
  }

  if (Object.prototype.hasOwnProperty.call(parsed, 'assumptionModelVersion')) {
    if (typeof parsed.assumptionModelVersion !== 'string'
        || !Object.values(ASSUMPTION_MODEL_VERSION).includes(parsed.assumptionModelVersion)) {
      throw new SavedDealValidationError('INVALID_ASSUMPTION_MODEL_VERSION', `version=${JSON.stringify(parsed.assumptionModelVersion)}`);
    }
  }

  if (Object.prototype.hasOwnProperty.call(parsed, 'provenance')) {
    const provenance = parsed.provenance;
    if (provenance === null || typeof provenance !== 'object' || Array.isArray(provenance)) {
      throw new SavedDealValidationError('INVALID_DEAL_PROVENANCE', 'not_object');
    }
    if (!Object.values(DEAL_PROVENANCE).includes(provenance.kind)) {
      throw new SavedDealValidationError('INVALID_DEAL_PROVENANCE_KIND', `kind=${JSON.stringify(provenance.kind)}`);
    }
    if (Object.prototype.hasOwnProperty.call(provenance, 'isDemo') && typeof provenance.isDemo !== 'boolean') {
      throw new SavedDealValidationError('INVALID_DEAL_PROVENANCE_IS_DEMO', `typeof=${typeof provenance.isDemo}`);
    }
    if (Object.prototype.hasOwnProperty.call(provenance, 'requiresRealDealConfirmation')
        && typeof provenance.requiresRealDealConfirmation !== 'boolean') {
      throw new SavedDealValidationError('INVALID_DEAL_PROVENANCE_CONFIRMATION_FLAG', `typeof=${typeof provenance.requiresRealDealConfirmation}`);
    }
  }

  if (parsed.id !== undefined && typeof parsed.id !== 'string') {
    throw new SavedDealValidationError('INVALID_ID_TYPE', `typeof=${typeof parsed.id}`);
  }
  if (parsed.name !== undefined && typeof parsed.name !== 'string') {
    throw new SavedDealValidationError('INVALID_NAME_TYPE', `typeof=${typeof parsed.name}`);
  }

  if (Object.prototype.hasOwnProperty.call(parsed, 'zakatCase')) {
    try {
      validateUserEnteredZakatCase(parsed.zakatCase);
    } catch (error) {
      throw new SavedDealValidationError('INVALID_ZAKAT_CASE', error.code || error.name || 'UNKNOWN');
    }
  }

  if (Object.prototype.hasOwnProperty.call(parsed, 'operatingCase')) {
    if (parsed.mode !== 'building') {
      throw new SavedDealValidationError('OPERATING_CASE_REQUIRES_BUILDING_MODE', `mode=${parsed.mode}`);
    }
    try {
      hydrateResidentialIncomeOperatingCaseSnapshot(parsed.operatingCase);
    } catch (error) {
      throw new SavedDealValidationError('INVALID_OPERATING_CASE', error.reasonCode || error.name || 'UNKNOWN');
    }
  }

  if (Object.prototype.hasOwnProperty.call(parsed, 'valuationCase')) {
    if (parsed.mode !== 'building') {
      throw new SavedDealValidationError('VALUATION_CASE_REQUIRES_BUILDING_MODE', `mode=${parsed.mode}`);
    }
    try {
      validateValuationCaseExtension(parsed.valuationCase);
    } catch (error) {
      throw new SavedDealValidationError('INVALID_VALUATION_CASE', error.reasonCode || error.name || 'UNKNOWN');
    }
  }

  const hasAnyStandardsMetadata = RESERVED_METADATA_KEYS.some((key) => Object.prototype.hasOwnProperty.call(parsed, key));
  if (hasAnyStandardsMetadata) {
    const result = validateSavedDealStandardsMetadata(parsed);
    if (!result.valid) {
      throw new SavedDealValidationError('INVALID_STANDARDS_SNAPSHOT_METADATA', result.errors[0] || 'UNKNOWN');
    }
  }

  return parsed;
}

module.exports = { validateSavedDealRecord, SavedDealValidationError, VALID_MODES };
