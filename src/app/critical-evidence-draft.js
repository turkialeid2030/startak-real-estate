'use strict';

const {
  VALUATION_METHOD,
  EVIDENCE_GRADE,
  INPUT_STATUS,
} = require('../valuation-intelligence');

class CriticalEvidenceDraftError extends Error {
  constructor(reasonCode, field) {
    super(`Critical evidence requirements are incomplete or invalid: ${reasonCode}${field ? ` (${field})` : ''}`);
    this.name = 'CriticalEvidenceDraftError';
    this.reasonCode = reasonCode;
    this.field = field || null;
  }
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]));
}

function emptyCriticalEvidenceRow() {
  return {
    method: '',
    field: '',
    allowedGrades: [],
    allowedStatuses: [],
  };
}

function criticalEvidenceRowsFromValuationCase(valuationCase) {
  const requirements = valuationCase?.criticalEvidenceRequirements;
  if (!requirements || typeof requirements !== 'object' || Array.isArray(requirements)) return [];
  const rows = [];
  for (const [method, items] of Object.entries(requirements)) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      rows.push({
        method,
        field: typeof item.field === 'string' ? item.field : '',
        allowedGrades: Array.isArray(item.allowedGrades) ? [...item.allowedGrades] : [],
        allowedStatuses: Array.isArray(item.allowedStatuses) ? [...item.allowedStatuses] : [],
      });
    }
  }
  return clone(rows);
}

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new CriticalEvidenceDraftError('REQUIRED_FIELD', field);
  return value.trim();
}

function validateEnumList(values, enumeration, field) {
  if (!Array.isArray(values) || values.length === 0) throw new CriticalEvidenceDraftError('AT_LEAST_ONE_REQUIRED', field);
  const unique = [...new Set(values)];
  if (unique.some((value) => !Object.values(enumeration).includes(value))) throw new CriticalEvidenceDraftError('INVALID_ENUM', field);
  return unique;
}

function normalizeCriticalEvidenceRows(rows) {
  if (!Array.isArray(rows)) throw new CriticalEvidenceDraftError('INVALID_DRAFT', 'rows');
  const normalized = rows.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new CriticalEvidenceDraftError('INVALID_ROW', `rows[${index}]`);
    const method = requiredString(row.method, `rows[${index}].method`);
    if (!Object.values(VALUATION_METHOD).includes(method)) throw new CriticalEvidenceDraftError('INVALID_ENUM', `rows[${index}].method`);
    return {
      method,
      field: requiredString(row.field, `rows[${index}].field`),
      allowedGrades: validateEnumList(row.allowedGrades, EVIDENCE_GRADE, `rows[${index}].allowedGrades`),
      allowedStatuses: validateEnumList(row.allowedStatuses, INPUT_STATUS, `rows[${index}].allowedStatuses`),
    };
  });

  const seen = new Set();
  for (const row of normalized) {
    const key = `${row.method}::${row.field}`;
    if (seen.has(key)) throw new CriticalEvidenceDraftError('DUPLICATE_REQUIREMENT', key);
    seen.add(key);
  }
  return normalized;
}

function groupCriticalEvidenceRequirements(rows) {
  const normalized = normalizeCriticalEvidenceRows(rows);
  const grouped = {};
  for (const row of normalized) {
    if (!grouped[row.method]) grouped[row.method] = [];
    grouped[row.method].push({
      field: row.field,
      allowedGrades: [...row.allowedGrades],
      allowedStatuses: [...row.allowedStatuses],
    });
  }
  return grouped;
}

function applyCriticalEvidenceRowsToValuationCase(valuationCase, rows) {
  if (!valuationCase || typeof valuationCase !== 'object' || Array.isArray(valuationCase)) {
    throw new CriticalEvidenceDraftError('BASE_CONFIGURATION_REQUIRED', 'valuationCase');
  }
  const next = clone(valuationCase);
  if (!Array.isArray(rows) || rows.length === 0) {
    delete next.criticalEvidenceRequirements;
    return next;
  }
  next.criticalEvidenceRequirements = groupCriticalEvidenceRequirements(rows);
  return next;
}

module.exports = {
  CriticalEvidenceDraftError,
  emptyCriticalEvidenceRow,
  criticalEvidenceRowsFromValuationCase,
  normalizeCriticalEvidenceRows,
  groupCriticalEvidenceRequirements,
  applyCriticalEvidenceRowsToValuationCase,
};
