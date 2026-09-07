// src/validation/saved-deal-schema.js -- canonical Saved Deal trust boundary.
//
// The validator is deliberately non-destructive. It separates four public
// failure classes used by the UI/import boundary while retaining structural
// reason codes for diagnostics where that distinction is useful:
//   SAVED_DEAL_SCHEMA_INVALID
//   SAVED_DEAL_SEMANTIC_INCOMPLETE
//   SAVED_DEAL_TIMESTAMP_INVALID
//   SAVED_DEAL_VERSION_UNSUPPORTED
//
// Economic calculations remain owned by numeric-safety/engine code. This
// boundary only proves that the record is structurally valid, carries the
// canonical minimum input set for its study type, has an explicit save
// timestamp, and does not claim an unsupported assumption-model version.

const { hydrateResidentialIncomeOperatingCaseSnapshot } = require('../residential-income-acquisition/operating-case-snapshot');
const { validateValuationCaseExtension } = require('../valuation-intelligence/saved-deal-extension');
const { ASSUMPTION_MODEL_VERSION } = require('../assumptions/assumption-model');
const { STUDY_TYPE } = require('../contracts/study-type');
const { validateRequiredFields, ValidationError } = require('./numeric-safety');

const SAVED_DEAL_FAILURE_CODE = Object.freeze({
  SCHEMA_INVALID: 'SAVED_DEAL_SCHEMA_INVALID',
  SEMANTIC_INCOMPLETE: 'SAVED_DEAL_SEMANTIC_INCOMPLETE',
  TIMESTAMP_INVALID: 'SAVED_DEAL_TIMESTAMP_INVALID',
  VERSION_UNSUPPORTED: 'SAVED_DEAL_VERSION_UNSUPPORTED',
});

class SavedDealValidationError extends Error {
  constructor(reasonCode, detail, failureCode = SAVED_DEAL_FAILURE_CODE.SCHEMA_INVALID) {
    super(`Saved Deal validation failed: ${failureCode}`);
    this.name = 'SavedDealValidationError';
    this.reasonCode = reasonCode; // enumerated diagnostic code; never raw record data
    this.failureCode = failureCode; // stable public taxonomy
    this.code = failureCode;
    this.detail = detail; // short safe diagnostic only
  }
}

const VALID_MODES = ['building', 'land'];

function studyTypeForMode(mode) {
  return mode === 'building' ? STUDY_TYPE.EXISTING_BUILDING : STUDY_TYPE.LAND_DEVELOPMENT;
}

function isIso8601Timestamp(value) {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) return false;
  // Date-only ISO-8601 is retained for historical saved records. Datetimes
  // must carry an explicit UTC/offset designator so cross-locale restores are
  // deterministic rather than dependent on host timezone interpretation.
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  const isoDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
  if (!isoDate.test(value) && !isoDateTime.test(value)) return false;
  return Number.isFinite(Date.parse(value));
}

function assertCanonicalRequiredInputs(inputs, mode) {
  try {
    validateRequiredFields(inputs, studyTypeForMode(mode));
  } catch (error) {
    if (error instanceof ValidationError && error.rule === 'MISSING_REQUIRED_FIELD') {
      throw new SavedDealValidationError(
        SAVED_DEAL_FAILURE_CODE.SEMANTIC_INCOMPLETE,
        `field=${error.field}`,
        SAVED_DEAL_FAILURE_CODE.SEMANTIC_INCOMPLETE,
      );
    }
    throw error;
  }
}

/**
 * validateSavedDealRecord(parsed)
 * Input: already-JSON.parsed value (any type -- caller does JSON.parse first).
 * Throws SavedDealValidationError on any trust-boundary defect.
 * Returns the same object, byte-for-byte, unmodified, on success.
 */
function validateSavedDealRecord(parsed) {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new SavedDealValidationError('ENVELOPE_NOT_OBJECT', `typeof=${Array.isArray(parsed) ? 'array' : typeof parsed}`);
  }

  if (typeof parsed.mode !== 'string' || !VALID_MODES.includes(parsed.mode)) {
    throw new SavedDealValidationError('INVALID_MODE', `modeType=${typeof parsed.mode}`);
  }

  if (parsed.inputs === null || typeof parsed.inputs !== 'object' || Array.isArray(parsed.inputs)) {
    throw new SavedDealValidationError('INVALID_INPUTS_SHAPE', `typeof=${Array.isArray(parsed.inputs) ? 'array' : typeof parsed.inputs}`);
  }

  // Explicit unsupported versions fail closed. Absence is retained only as a
  // legacy compatibility signal; migration/restore code must not invent a
  // supported version on the caller's behalf.
  if (Object.prototype.hasOwnProperty.call(parsed, 'assumptionModelVersion')) {
    if (typeof parsed.assumptionModelVersion !== 'string'
        || !Object.values(ASSUMPTION_MODEL_VERSION).includes(parsed.assumptionModelVersion)) {
      throw new SavedDealValidationError(
        SAVED_DEAL_FAILURE_CODE.VERSION_UNSUPPORTED,
        'assumptionModelVersion is not supported',
        SAVED_DEAL_FAILURE_CODE.VERSION_UNSUPPORTED,
      );
    }
  }

  if (!isIso8601Timestamp(parsed.savedAt)) {
    throw new SavedDealValidationError(
      SAVED_DEAL_FAILURE_CODE.TIMESTAMP_INVALID,
      'savedAt must be an ISO-8601 date or timezone-qualified datetime',
      SAVED_DEAL_FAILURE_CODE.TIMESTAMP_INVALID,
    );
  }

  if (parsed.id !== undefined && typeof parsed.id !== 'string') {
    throw new SavedDealValidationError('INVALID_ID_TYPE', `typeof=${typeof parsed.id}`);
  }
  if (parsed.name !== undefined && typeof parsed.name !== 'string') {
    throw new SavedDealValidationError('INVALID_NAME_TYPE', `typeof=${typeof parsed.name}`);
  }

  // Semantic completeness is checked before any calculation or hydration.
  // This derives from numeric-safety's single canonical required-field map;
  // no second field list is maintained here.
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
  SAVED_DEAL_FAILURE_CODE,
  VALID_MODES,
  isIso8601Timestamp,
};