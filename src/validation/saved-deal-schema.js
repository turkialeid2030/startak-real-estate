// src/validation/saved-deal-schema.js -- SDI-001: canonical STRUCTURAL
// validation boundary for a parsed Saved Deal record, applied after
// JSON.parse succeeds but before the record is trusted (setMode/setInputs).
//
// Scope discipline (per SDI-001 mandate):
// - STRUCTURE only (shape/type of required fields) -- NOT economic-domain
//   validation. Economic rules (e.g. OBS-001's buildingPrice>0) remain
//   exclusively in numeric-safety.js's validateEngineInputs(), invoked
//   separately by calculateInvestmentCase(). This validator does not
//   duplicate that layer.
// - Non-destructive: never mutates, repairs, or deletes anything. It only
//   inspects and throws or returns.
// - "Legacy" investigation finding: src/migrations/legacy-saved-deal-adapter.js
//   exists but serves a completely different purpose (converting a record to
//   an ExecutableInvestmentCase for a separate consumer) -- it expects the
//   exact same {id, name, mode, inputs, savedAt} shape validated here, not
//   an alternate historical shape. There is no other/older record shape that
//   loadDeal() has ever needed to support. SUPPORTED_LEGACY_RECORDS_IDENTIFIED
//   = FALSE for this load path specifically.

class SavedDealValidationError extends Error {
  constructor(reasonCode, detail) {
    super(`Saved Deal structural validation failed: ${reasonCode}`);
    this.name = 'SavedDealValidationError';
    this.reasonCode = reasonCode; // safe, internal, enumerated -- never a raw value dump
    this.detail = detail; // safe short string only, never raw record/stack
  }
}

const VALID_MODES = ['building', 'land'];

/**
 * validateSavedDealRecord(parsed)
 * Input: already-JSON.parsed value (any type -- caller does JSON.parse first).
 * Throws SavedDealValidationError on any structural defect.
 * Returns the same object, byte-for-byte, unmodified, on success.
 */
function validateSavedDealRecord(parsed) {
  // Envelope: must be a plain object, not null/array/string/number.
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new SavedDealValidationError('ENVELOPE_NOT_OBJECT', `typeof=${Array.isArray(parsed) ? 'array' : typeof parsed}`);
  }

  // Study mode/type: must be exactly one of the two known values.
  if (typeof parsed.mode !== 'string' || !VALID_MODES.includes(parsed.mode)) {
    throw new SavedDealValidationError('INVALID_MODE', `mode=${JSON.stringify(parsed.mode)}`);
  }

  // Raw inputs payload: must be a plain object (not null/array/primitive).
  if (parsed.inputs === null || typeof parsed.inputs !== 'object' || Array.isArray(parsed.inputs)) {
    throw new SavedDealValidationError('INVALID_INPUTS_SHAPE', `typeof=${Array.isArray(parsed.inputs) ? 'array' : typeof parsed.inputs}`);
  }

  // id/name: structurally required for list rendering and update/delete
  // targeting; must be strings if present (do not require non-empty --
  // that would be a content rule, not a structural one).
  if (parsed.id !== undefined && typeof parsed.id !== 'string') {
    throw new SavedDealValidationError('INVALID_ID_TYPE', `typeof=${typeof parsed.id}`);
  }
  if (parsed.name !== undefined && typeof parsed.name !== 'string') {
    throw new SavedDealValidationError('INVALID_NAME_TYPE', `typeof=${typeof parsed.name}`);
  }

  return parsed; // unmodified -- non-destructive by construction
}

module.exports = { validateSavedDealRecord, SavedDealValidationError, VALID_MODES };
