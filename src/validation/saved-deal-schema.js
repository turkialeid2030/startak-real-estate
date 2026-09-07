// src/validation/saved-deal-schema.js -- canonical Saved Deal trust boundary.
//
// Fail-closed load contract:
//   Parse -> Schema Version -> Structural -> Semantic -> Migration -> Load
//
// This validator is deliberately non-destructive. It never invents missing
// underwriting inputs and never silently upgrades a legacy assumption model.
// The public failure taxonomy is intentionally small and stable:
//   DEAL_SCHEMA_INVALID
//   DEAL_VERSION_UNSUPPORTED
//   DEAL_MIGRATION_REQUIRED

const { hydrateResidentialIncomeOperatingCaseSnapshot } = require('../residential-income-acquisition/operating-case-snapshot');
const { validateValuationCaseExtension } = require('../valuation-intelligence/saved-deal-extension');
const { ASSUMPTION_MODEL_VERSION } = require('../assumptions/assumption-model');
const { STUDY_TYPE } = require('../contracts/study-type');
const { validateRequiredFields, ValidationError } = require('./numeric-safety');

const DEAL_FAILURE_CODE = Object.freeze({
  SCHEMA_INVALID: 'DEAL_SCHEMA_INVALID',
  VERSION_UNSUPPORTED: 'DEAL_VERSION_UNSUPPORTED',
  MIGRATION_REQUIRED: 'DEAL_MIGRATION_REQUIRED',
});

class SavedDealValidationError extends Error {
  constructor(reasonCode, detail, failureCode = DEAL_FAILURE_CODE.SCHEMA_INVALID) {
    super(`Saved Deal validation failed: ${failureCode}`);
    this.name = 'SavedDealValidationError';
    this.reasonCode = reasonCode; // safe enumerated diagnostic code
    this.failureCode = failureCode; // stable public boundary code
    this.code = failureCode;
    this.detail = detail; // safe short diagnostic; never raw record/stack
  }
}

const VALID_MODES = ['building', 'land'];

function studyTypeForMode(mode) {
  return mode === 'building' ? STUDY_TYPE.EXISTING_BUILDING : STUDY_TYPE.LAND_DEVELOPMENT;
}

function isIso8601Timestamp(value) {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) return false;
  // Historical date-only values remain valid ISO-8601. Datetimes must carry
  // an explicit timezone/offset to make restore behavior deterministic.
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  const isoDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
  if (!isoDate.test(value) && !isoDateTime.test(value)) return false;
  return Number.isFinite(Date.parse(value));
}

function assertSchemaVersion(parsed) {
  if (!Object.prototype.hasOwnProperty.call(parsed, 'assumptionModelVersion')
      || parsed.assumptionModelVersion === null
      || parsed.assumptionModelVersion === ''
      || parsed.assumptionModelVersion === ASSUMPTION_MODEL_VERSION.LEGACY) {
    throw new SavedDealValidationError(
      'LEGACY_ASSUMPTION_MODEL_REQUIRES_EXPLICIT_MIGRATION',
      'legacy or missing assumptionModelVersion must pass through an explicit migration boundary before load',
      DEAL_FAILURE_CODE.MIGRATION_REQUIRED,
    );
  }

  if (typeof parsed.assumptionModelVersion !== 'string'
      || !Object.values(ASSUMPTION_MODEL_VERSION).includes(parsed.assumptionModelVersion)) {
    throw new SavedDealValidationError(
      'UNSUPPORTED_ASSUMPTION_MODEL_VERSION',
      'assumptionModelVersion is not supported by this runtime',
      DEAL_FAILURE_CODE.VERSION_UNSUPPORTED,
    );
  }
}

function assertCanonicalRequiredInputs(inputs, mode) {
  try {
    validateRequiredFields(inputs, studyTypeForMode(mode));
  } catch (error) {
    if (error instanceof ValidationError && error.rule === 'MISSING_REQUIRED_FIELD') {
      throw new SavedDealValidationError(
        'SEMANTIC_INPUTS_INCOMPLETE',
        `field=${error.field}`,
        DEAL_FAILURE_CODE.SCHEMA_INVALID,
      );
    }
    throw error;
  }
}

/**
 * validateSavedDealRecord(parsed)
 * Input: already-JSON.parsed value.
 * Throws SavedDealValidationError on any trust-boundary defect.
 * Returns the exact same object, unmodified, on success.
 */
function validateSavedDealRecord(parsed) {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new SavedDealValidationError('ENVELOPE_NOT_OBJECT', `typeof=${Array.isArray(parsed) ? 'array' : typeof parsed}`);
  }

  // Version is classified before structural/semantic loading so callers can
  // distinguish an explicit migration requirement from a malformed V2 deal.
  assertSchemaVersion(parsed);

  if (typeof parsed.mode !== 'string' || !VALID_MODES.includes(parsed.mode)) {
    throw new SavedDealValidationError('INVALID_MODE', `modeType=${typeof parsed.mode}`);
  }

  if (parsed.inputs === null || typeof parsed.inputs !== 'object' || Array.isArray(parsed.inputs)) {
    throw new SavedDealValidationError('INVALID_INPUTS_SHAPE', `typeof=${Array.isArray(parsed.inputs) ? 'array' : typeof parsed.inputs}`);
  }

  if (!isIso8601Timestamp(parsed.savedAt)) {
    throw new SavedDealValidationError('SAVED_AT_INVALID', 'savedAt must be an ISO-8601 date or timezone-qualified datetime');
  }

  if (parsed.id !== undefined && typeof parsed.id !== 'string') {
    throw new SavedDealValidationError('INVALID_ID_TYPE', `typeof=${typeof parsed.id}`);
  }
  if (parsed.name !== undefined && typeof parsed.name !== 'string') {
    throw new SavedDealValidationError('INVALID_NAME_TYPE', `typeof=${typeof parsed.name}`);
  }

  // Semantic completeness is derived from numeric-safety's single canonical
  // REQUIRED_ENGINE_FIELDS map. No duplicate field list is maintained here.
  assertCanonicalRequiredInputs(parsed.inputs, parsed.mode);

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

  return parsed;
}

module.exports = {
  validateSavedDealRecord,
  SavedDealValidationError,
  DEAL_FAILURE_CODE,
  VALID_MODES,
  isIso8601Timestamp,
};