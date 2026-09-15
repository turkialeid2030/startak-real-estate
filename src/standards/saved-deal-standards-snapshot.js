'use strict';

const { STANDARD_STATUS, sha256 } = require('./standards-registry');
const { assertRouteProductionReady } = require('./purpose-based-standards-router');
const { evaluateProfessionalAssignment, ASSIGNMENT_STATUS } = require('../valuation/professional-assignment');

const RESERVED_METADATA_KEYS = Object.freeze([
  'standardsSnapshotVersion',
  'standardsSnapshot',
  'valuationStandardsContext',
]);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isHash(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

function assignmentFingerprintPayload(assignment) {
  return Object.freeze({
    intended_user: assignment.intended_user,
    intended_use: assignment.intended_use,
    purpose: assignment.purpose,
    asset: Object.freeze({
      type: assignment.asset.type,
      jurisdiction: assignment.asset.jurisdiction,
      location: assignment.asset.location,
    }),
    rights: Object.freeze(assignment.rights.map((right) => Object.freeze({
      type: right.type,
      source_class: right.source_class,
      description: right.description,
      source_reference: right.source_reference || null,
    }))),
    basis: assignment.basis,
    valuation_date: assignment.valuation_date,
    report_date: assignment.report_date,
    scope: assignment.scope,
    assumptions: Object.freeze([...assignment.assumptions]),
    special_assumptions: Object.freeze([...assignment.special_assumptions]),
    information_reliance: Object.freeze([...assignment.information_reliance]),
    limitations: Object.freeze([...assignment.limitations]),
    conflicts: Object.freeze({ ...assignment.conflicts }),
    independence: Object.freeze({ ...assignment.independence }),
    competence: Object.freeze({ ...assignment.competence }),
    reviewer: assignment.reviewer,
  });
}

function buildSavedDealStandardsMetadata({ standards_route, professional_assignment, model_version, report_date }) {
  assertRouteProductionReady(standards_route);
  const assignmentEvaluation = evaluateProfessionalAssignment(professional_assignment);
  if (assignmentEvaluation.status !== ASSIGNMENT_STATUS.READY_FOR_STANDARDS_ROUTING) {
    const error = new Error(`ASSIGNMENT_NOT_READY_FOR_STANDARDS_SNAPSHOT:${assignmentEvaluation.status}`);
    error.code = 'ASSIGNMENT_NOT_READY_FOR_STANDARDS_SNAPSHOT';
    throw error;
  }
  if (!isNonEmptyString(model_version)) {
    const error = new Error('MODEL_VERSION_REQUIRED_FOR_STANDARDS_SNAPSHOT');
    error.code = 'MODEL_VERSION_REQUIRED_FOR_STANDARDS_SNAPSHOT';
    throw error;
  }
  if (!isNonEmptyString(report_date) || !Number.isFinite(Date.parse(report_date))) {
    const error = new Error('REPORT_DATE_REQUIRED_FOR_STANDARDS_SNAPSHOT');
    error.code = 'REPORT_DATE_REQUIRED_FOR_STANDARDS_SNAPSHOT';
    throw error;
  }

  const snapshot = standards_route.standards_snapshot;
  if (snapshot.as_of_date !== professional_assignment.valuation_date) {
    const error = new Error('ASSIGNMENT_ROUTE_VALUATION_DATE_MISMATCH');
    error.code = 'ASSIGNMENT_ROUTE_VALUATION_DATE_MISMATCH';
    throw error;
  }
  if (snapshot.purpose !== professional_assignment.purpose || snapshot.asset_class !== professional_assignment.asset.type) {
    const error = new Error('ASSIGNMENT_ROUTE_SCOPE_MISMATCH');
    error.code = 'ASSIGNMENT_ROUTE_SCOPE_MISMATCH';
    throw error;
  }

  const fingerprintPayload = assignmentFingerprintPayload(professional_assignment);
  const context = Object.freeze({
    schemaVersion: 1,
    valuationDate: professional_assignment.valuation_date,
    reportDate: report_date,
    purpose: professional_assignment.purpose,
    intendedUse: professional_assignment.intended_use,
    intendedUser: professional_assignment.intended_user,
    assetType: professional_assignment.asset.type,
    jurisdiction: professional_assignment.asset.jurisdiction,
    modelVersion: model_version,
    routeHash: standards_route.route_hash,
    assignmentSnapshotHash: sha256(fingerprintPayload),
    historicalReproductionPolicy: 'USE_SAVED_STANDARDS_SNAPSHOT_NOT_CURRENT_REGISTRY',
    automaticRecalculationOnNewStandard: false,
    legalApprovalEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });

  return Object.freeze({
    standardsSnapshotVersion: snapshot.standards_snapshot_version,
    standardsSnapshot: snapshot,
    valuationStandardsContext: context,
  });
}

function validateSavedDealStandardsMetadata(record) {
  const present = RESERVED_METADATA_KEYS.filter((key) => Object.prototype.hasOwnProperty.call(record || {}, key));
  if (present.length === 0) return Object.freeze({ valid: true, present: false, errors: Object.freeze([]) });

  const errors = [];
  if (present.length !== RESERVED_METADATA_KEYS.length) errors.push('STANDARDS_METADATA_GROUP_INCOMPLETE');
  const version = record?.standardsSnapshotVersion;
  const snapshot = record?.standardsSnapshot;
  const context = record?.valuationStandardsContext;

  if (!isHash(version)) errors.push('INVALID_STANDARDS_SNAPSHOT_VERSION');
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    errors.push('INVALID_STANDARDS_SNAPSHOT_OBJECT');
  } else {
    if (snapshot.standards_snapshot_version !== version) errors.push('STANDARDS_SNAPSHOT_VERSION_MISMATCH');
    if (!Array.isArray(snapshot.selected) || snapshot.selected.length === 0) errors.push('STANDARDS_SNAPSHOT_SELECTED_REQUIRED');
    else if (snapshot.selected.some((item) => item?.status !== STANDARD_STATUS.ACTIVE)) errors.push('STANDARDS_SNAPSHOT_NON_ACTIVE_VERSION');
    if (snapshot.historical_reproduction_required !== true) errors.push('HISTORICAL_REPRODUCTION_FLAG_REQUIRED');
    if (snapshot.automatic_recalculation_on_new_standard !== false) errors.push('AUTOMATIC_RECALCULATION_MUST_BE_FALSE');
  }

  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    errors.push('INVALID_VALUATION_STANDARDS_CONTEXT');
  } else {
    for (const key of ['valuationDate', 'reportDate', 'purpose', 'intendedUse', 'intendedUser', 'assetType', 'jurisdiction', 'modelVersion', 'historicalReproductionPolicy']) {
      if (!isNonEmptyString(context[key])) errors.push(`INVALID_VALUATION_STANDARDS_CONTEXT_FIELD:${key}`);
    }
    if (!isHash(context.routeHash)) errors.push('INVALID_STANDARDS_ROUTE_HASH');
    if (!isHash(context.assignmentSnapshotHash)) errors.push('INVALID_ASSIGNMENT_SNAPSHOT_HASH');
    if (context.historicalReproductionPolicy !== 'USE_SAVED_STANDARDS_SNAPSHOT_NOT_CURRENT_REGISTRY') errors.push('INVALID_HISTORICAL_REPRODUCTION_POLICY');
    if (context.automaticRecalculationOnNewStandard !== false) errors.push('CONTEXT_AUTOMATIC_RECALCULATION_MUST_BE_FALSE');
    if (context.legalApprovalEstablished !== false || context.certifiedValuationEstablished !== false || context.transactionAuthorized !== false) {
      errors.push('STANDARDS_METADATA_AUTHORITY_BOUNDARY_INVALID');
    }
    const valuationMs = Date.parse(context.valuationDate || '');
    const reportMs = Date.parse(context.reportDate || '');
    if (!Number.isFinite(valuationMs)) errors.push('INVALID_CONTEXT_VALUATION_DATE');
    if (!Number.isFinite(reportMs)) errors.push('INVALID_CONTEXT_REPORT_DATE');
    if (Number.isFinite(valuationMs) && Number.isFinite(reportMs) && reportMs < valuationMs) errors.push('CONTEXT_REPORT_DATE_BEFORE_VALUATION_DATE');
    if (snapshot && typeof snapshot === 'object') {
      if (snapshot.as_of_date !== context.valuationDate) errors.push('SNAPSHOT_CONTEXT_VALUATION_DATE_MISMATCH');
      if (snapshot.purpose !== context.purpose) errors.push('SNAPSHOT_CONTEXT_PURPOSE_MISMATCH');
      if (snapshot.asset_class !== context.assetType) errors.push('SNAPSHOT_CONTEXT_ASSET_TYPE_MISMATCH');
      if (snapshot.jurisdiction !== context.jurisdiction) errors.push('SNAPSHOT_CONTEXT_JURISDICTION_MISMATCH');
    }
  }

  return Object.freeze({ valid: errors.length === 0, present: true, errors: Object.freeze(errors) });
}

function assertSavedDealStandardsMetadata(record) {
  const result = validateSavedDealStandardsMetadata(record);
  if (!result.valid) {
    const error = new Error(`INVALID_SAVED_DEAL_STANDARDS_METADATA:${result.errors.join('|')}`);
    error.code = 'INVALID_SAVED_DEAL_STANDARDS_METADATA';
    error.errors = result.errors;
    throw error;
  }
  return true;
}

function withStandardsSnapshot(record, metadata) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    const error = new Error('SAVED_DEAL_RECORD_REQUIRED');
    error.code = 'SAVED_DEAL_RECORD_REQUIRED';
    throw error;
  }
  if (record.inputs && typeof record.inputs === 'object') {
    const nested = RESERVED_METADATA_KEYS.filter((key) => Object.prototype.hasOwnProperty.call(record.inputs, key));
    if (nested.length) {
      const error = new Error(`STANDARDS_METADATA_MUST_NOT_BE_ECONOMIC_INPUT:${nested.join(',')}`);
      error.code = 'STANDARDS_METADATA_MUST_NOT_BE_ECONOMIC_INPUT';
      throw error;
    }
  }
  const candidate = Object.freeze({ ...record, ...metadata });
  assertSavedDealStandardsMetadata(candidate);
  return candidate;
}

function reconstructHistoricalStandardsEnvironment(record) {
  assertSavedDealStandardsMetadata(record);
  if (!record.standardsSnapshotVersion) return null;
  return Object.freeze({
    standardsSnapshotVersion: record.standardsSnapshotVersion,
    valuationDate: record.valuationStandardsContext.valuationDate,
    reportDate: record.valuationStandardsContext.reportDate,
    modelVersion: record.valuationStandardsContext.modelVersion,
    routeHash: record.valuationStandardsContext.routeHash,
    selectedStandards: Object.freeze(record.standardsSnapshot.selected.map((item) => Object.freeze({ ...item }))),
    policy: 'USE_SAVED_STANDARDS_SNAPSHOT_NOT_CURRENT_REGISTRY',
    currentRegistryConsulted: false,
    automaticRecalculationOnNewStandard: false,
    legalApprovalEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

module.exports = {
  RESERVED_METADATA_KEYS,
  buildSavedDealStandardsMetadata,
  validateSavedDealStandardsMetadata,
  assertSavedDealStandardsMetadata,
  withStandardsSnapshot,
  reconstructHistoricalStandardsEnvironment,
};
