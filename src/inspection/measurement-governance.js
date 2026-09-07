'use strict';

const crypto = require('crypto');

const MEASUREMENT_TYPE = Object.freeze({
  LAND_AREA: 'LAND_AREA',
  GFA: 'GFA',
  BUA: 'BUA',
  NLA: 'NLA',
  GLA: 'GLA',
  RENTABLE_AREA: 'RENTABLE_AREA',
  COMMON_AREA: 'COMMON_AREA',
});

const MEASUREMENT_SOURCE = Object.freeze({
  TITLE_DEED: 'TITLE_DEED',
  REAL_ESTATE_REGISTRY: 'REAL_ESTATE_REGISTRY',
  APPROVED_PLAN: 'APPROVED_PLAN',
  SURVEY: 'SURVEY',
  INSPECTION: 'INSPECTION',
  CLIENT_PROVIDED: 'CLIENT_PROVIDED',
  OTHER: 'OTHER',
});

const MEASUREMENT_RECONCILIATION_STATUS = Object.freeze({
  CLEAR: 'CLEAR',
  HOLD_INSUFFICIENT_EVIDENCE: 'HOLD_INSUFFICIENT_EVIDENCE',
  MEASUREMENT_CONFLICT: 'MEASUREMENT_CONFLICT',
});

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertNonEmpty(value, field) {
  if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`);
}

function assertEnum(value, enumeration, field) {
  if (!Object.values(enumeration).includes(value)) throw new TypeError(`${field} is invalid`);
}

function iso(value, field) {
  if (!nonEmpty(value)) throw new TypeError(`${field} is required`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return date.toISOString();
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function createMeasurementRecord({
  measurementId,
  caseId,
  inspectionId = null,
  type,
  valueSqm,
  source,
  sourceEvidenceRef,
  measurementStandardRef,
  measurementMethod,
  measuredByRef,
  measuredAt,
}) {
  assertNonEmpty(measurementId, 'measurementId');
  assertNonEmpty(caseId, 'caseId');
  assertEnum(type, MEASUREMENT_TYPE, 'type');
  assertEnum(source, MEASUREMENT_SOURCE, 'source');
  assertNonEmpty(sourceEvidenceRef, 'sourceEvidenceRef');
  assertNonEmpty(measurementStandardRef, 'measurementStandardRef');
  assertNonEmpty(measurementMethod, 'measurementMethod');
  assertNonEmpty(measuredByRef, 'measuredByRef');
  if (typeof valueSqm !== 'number' || !Number.isFinite(valueSqm) || valueSqm <= 0) throw new TypeError('valueSqm must be a finite positive number');
  if (inspectionId !== null && !nonEmpty(inspectionId)) throw new TypeError('inspectionId must be null or non-empty string');

  const record = {
    schemaVersion: 1,
    measurementId: measurementId.trim(),
    caseId: caseId.trim(),
    inspectionId: inspectionId ? inspectionId.trim() : null,
    type,
    value: valueSqm,
    unit: 'SQM',
    source,
    sourceEvidenceRef: sourceEvidenceRef.trim(),
    measurementStandardRef: measurementStandardRef.trim(),
    measurementMethod: measurementMethod.trim(),
    measuredByRef: measuredByRef.trim(),
    measuredAt: iso(measuredAt, 'measuredAt'),
  };
  record.measurementHashSha256 = hash(record);
  return freeze(record);
}

function withinTolerance(a, b, tolerance) {
  const absolute = Number.isFinite(tolerance?.absoluteSqm) ? Math.max(0, tolerance.absoluteSqm) : 0;
  const relative = Number.isFinite(tolerance?.relative) ? Math.max(0, tolerance.relative) : 0;
  const delta = Math.abs(a - b);
  if (delta <= absolute) return true;
  const scale = Math.max(Math.abs(a), Math.abs(b), 1);
  return delta <= scale * relative;
}

function reconcileMeasurementRecords({
  caseId,
  records,
  materialTypes,
  toleranceByType = {},
  minimumIndependentSourcesByType = {},
} = {}) {
  assertNonEmpty(caseId, 'caseId');
  if (!Array.isArray(records)) throw new TypeError('records must be an array');
  if (!Array.isArray(materialTypes) || materialTypes.length === 0) throw new TypeError('materialTypes must be a non-empty array');
  for (const type of materialTypes) assertEnum(type, MEASUREMENT_TYPE, 'materialTypes[]');
  for (const record of records) {
    if (!record || record.caseId !== caseId) throw new TypeError('CASE_ISOLATION_VIOLATION: measurement record belongs to another case');
    if (record.unit !== 'SQM') throw new TypeError('MEASUREMENT_UNIT_UNSUPPORTED: only SQM is accepted by this canonical model');
  }

  const checks = [];
  const conflicts = [];
  const insufficient = [];

  for (const type of [...new Set(materialTypes)]) {
    const group = records.filter((record) => record.type === type);
    const sources = [...new Set(group.map((record) => record.source))];
    const minimumSources = Number.isInteger(minimumIndependentSourcesByType[type])
      ? Math.max(1, minimumIndependentSourcesByType[type])
      : 1;
    const evidenceInsufficient = group.length === 0 || sources.length < minimumSources;
    if (evidenceInsufficient) insufficient.push({ type, sourceCount: sources.length, requiredSourceCount: minimumSources });

    let conflict = false;
    if (group.length > 1) {
      const reference = group[0].value;
      conflict = group.slice(1).some((record) => !withinTolerance(reference, record.value, toleranceByType[type] || {}));
      if (conflict) {
        conflicts.push({
          type,
          values: group.map((record) => record.value),
          measurementIds: group.map((record) => record.measurementId),
          sources,
          code: 'MEASUREMENT_CONFLICT',
        });
      }
    }

    checks.push({
      type,
      recordCount: group.length,
      sources,
      sourceCount: sources.length,
      requiredSourceCount: minimumSources,
      evidenceInsufficient,
      conflict,
      consensusValueSqm: !conflict && group.length ? group[0].value : null,
    });
  }

  let status = MEASUREMENT_RECONCILIATION_STATUS.CLEAR;
  if (conflicts.length) status = MEASUREMENT_RECONCILIATION_STATUS.MEASUREMENT_CONFLICT;
  else if (insufficient.length) status = MEASUREMENT_RECONCILIATION_STATUS.HOLD_INSUFFICIENT_EVIDENCE;

  return freeze({
    schemaVersion: 1,
    caseId,
    status,
    checks,
    conflicts,
    insufficient,
    readyForInspectionCompletion: status === MEASUREMENT_RECONCILIATION_STATUS.CLEAR,
    professionalValuationProgressionAllowed: status === MEASUREMENT_RECONCILIATION_STATUS.CLEAR,
    financialEngineAdoptionAllowed: status === MEASUREMENT_RECONCILIATION_STATUS.CLEAR,
    transactionAuthorized: false,
    certifiedValuationEstablished: false,
    semantics: 'Measurement reconciliation compares evidence already expressed in canonical square metres. No silent unit conversion, standard substitution, or source winner selection is performed.',
  });
}

module.exports = {
  MEASUREMENT_TYPE,
  MEASUREMENT_SOURCE,
  MEASUREMENT_RECONCILIATION_STATUS,
  createMeasurementRecord,
  reconcileMeasurementRecords,
};
